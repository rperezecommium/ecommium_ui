import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(new URL('..', import.meta.url).pathname);
function load(file, imports = () => ({}), env = {}, commercialOptions = {withAuth:false}) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const exports = {};
  const context = { exports, module: { exports }, require: specifier => specifier.endsWith("/storefront-commercial-policy") ? load("src/shared/config/storefront-commercial-policy.ts", undefined, env) : specifier.endsWith("/storefront-commercial-context") ? { getStorefrontCommercialReadOptions: async () => commercialOptions } : imports(specifier), process: { env }, Intl, URL, URLSearchParams, encodeURIComponent };
  vm.runInNewContext(outputText, context);
  return context.module.exports;
}
const contract = load('src/modules/storefront/plp-cards-contract.ts');
const expected = { categorySlug: 'clothes', limit: 16, offset: 0, currency: 'EUR' };
const card = { productId: 'p', selectedVariantId: 'v', name: 'Linen', slug: 'linen', brand: 'Brand', image: null,
  price: { currentAmountMinor: 0, previousAmountMinor: null, currency: 'EUR' }, isAvailable: true, productUrlPath: '/pdp/linen' };
const payload = () => ({ view: 'cards', resolvedLocale: 'es-ES', ...expected, total: 1, products: [structuredClone(card)],
  cmsBlocks: { beforeList: [{ blockId: 'intro', type: 'text', props: { text: 'Editorial' } }], afterList: [] } });

test('compact contract accepts zero price and confirmed absence of media/price', () => {
  const p = payload(); assert.equal(contract.parsePlpCardsPayload(p, expected), p);
  p.products[0].price = null; assert.equal(contract.parsePlpCardsPayload(p, expected), p);
});
test('compact contract accepts an empty page past the final product', () => {
  const p = { ...payload(), offset: 16, products: [] };
  assert.equal(contract.parsePlpCardsPayload(p, { ...expected, offset: 16 }), p);
});
for (const [name, change] of [
  ['wrong category', p => { p.categorySlug = 'foreign'; }],
  ['wrong currency', p => { p.products[0].price.currency = 'USD'; }],
  ['duplicate product', p => { p.total = 2; p.products.push(p.products[0]); }],
  ['missing variant', p => { delete p.products[0].selectedVariantId; }],
  ['invalid page count', p => { p.total = 2; }],
  ['unsafe product link', p => { p.products[0].productUrlPath = '//foreign'; }],
]) test('compact contract rejects ' + name, () => {
  const p = payload(); change(p); assert.throws(() => contract.parsePlpCardsPayload(p, expected), /PLP_CARDS_INVALID_RESPONSE/);
});
for (const [name, env, enabled] of [
  ['disabled', {}, false],
  ['legacy cards flag', { ECOMMIUM_STOREFRONT_PLP_CARDS_ENABLED: 'true' }, true],
  ['read index global flag', { ECOMMIUM_STOREFRONT_READ_INDEX_ENABLED: 'true' }, true],
  ['read index PLP flag', { ECOMMIUM_STOREFRONT_PLP_READ_INDEX_ENABLED: 'true' }, true],
]) test('PLP consumer ' + name + ' preserves cards, CTA and CMS through BFF', async () => {
  const calls = [], context = { organizationId: 'oa', shopId: 'sa', locale: 'es-ES', currency: 'EUR', country: 'ES', channel: 'web' };
  const plpModule = load('src/modules/storefront/plp.ts', specifier => {
    if (specifier === './plp-cards-contract') return contract;
    if (specifier === './storefront-context') return { getStorefrontContext: async () => context };
    if (specifier.endsWith('/shared/bff/storefront-client')) return { requestStorefrontBff: async (url, options) => {
      calls.push({ url, options });
      const p = url.startsWith('/storefront/plp/') ? payload() : { categories: [] };
      return { ok: true, status: 200, correlationId: 'test', data: options.parse ? options.parse(p) : p };
    } };
    return {};
  }, env);
  const result = await plpModule.getStorefrontPlp('clothes'); assert.equal(result.ok, true);
  const request = calls.find(x => x.url.startsWith('/storefront/plp/'));
  assert.equal(request.url.includes('view=cards'), enabled);
  assert.equal(typeof request.options.parse === 'function', enabled);
  assert.equal(request.options.withAuth, false);
  assert.equal(result.data.products[0].variantId, 'v');
  assert.equal(result.data.products[0].name, 'Linen');
  assert.equal(result.data.products[0].available, true);
  assert.equal(result.data.products[0].productUrlPath, '/pdp/linen');
  assert.equal(result.data.cmsBlocks.beforeList[0].blockId, 'intro');
  assert.match(result.data.products[0].priceDisplay, /0,00/);
});

test('authenticated PLP uses the canonical segmented endpoint instead of guest-only cards', async () => {
  const calls = [];
  const context = { organizationId: 'oa', shopId: 'sa', locale: 'es-ES', currency: 'EUR', country: 'ES', channel: 'web' };
  const plpModule = load('src/modules/storefront/plp.ts', specifier => {
    if (specifier === './plp-cards-contract') return contract;
    if (specifier === './storefront-context') return { getStorefrontContext: async () => context };
    if (specifier.endsWith('/shared/bff/storefront-client')) return { requestStorefrontBff: async (url, options) => { calls.push({url,options}); return {ok:true,status:200,data:url.startsWith('/storefront/plp/')?payload():{categories:[]}}; } };
    return {};
  }, { ECOMMIUM_STOREFRONT_PLP_CARDS_ENABLED:'true' }, {withAuth:false,init:{cache:'no-store',headers:{authorization:'Bearer customer','x-commercial-context-required':'true'}}});
  assert.equal((await plpModule.getStorefrontPlp('clothes')).ok,true);
  const read=calls.find(c=>c.url.startsWith('/storefront/plp/'));
  assert.equal(read.url.includes('view=cards'),false);
  assert.equal(read.options.init.headers.authorization,'Bearer customer');
  assert.equal(read.options.init.cache,'no-store');
});

for (const shopId of ['sa', 'another-shop']) test('deployment policy selects compatible PLP contract for ' + shopId, async () => {
  const calls=[];
  const context={organizationId:'oa',shopId,locale:'es-ES',currency:'EUR',country:'ES',channel:'web'};
  const env={ECOMMIUM_STOREFRONT_PLP_CARDS_ENABLED:'true',ECOMMIUM_STOREFRONT_ORGANIZATION_ID:'oa',ECOMMIUM_STOREFRONT_SHOP_ID:'sa',ECOMMIUM_STOREFRONT_TRADE_POLICY:'default'};
  const plp=load('src/modules/storefront/plp.ts', specifier=>{
    if(specifier==='./plp-cards-contract')return contract;
    if(specifier==='./storefront-context')return {getStorefrontContext:async()=>context};
    if(specifier.endsWith('/shared/bff/storefront-client'))return {requestStorefrontBff:async(url,options)=>{
      calls.push({url,options});const query=new URL(url,'http://test').searchParams;
      if(query.has('view')&&query.has('tradePolicy'))return {ok:false,status:403};
      const p=url.startsWith('/storefront/plp/')?payload():{categories:[]};
      return {ok:true,status:200,data:options.parse?options.parse(p):p};
    }};return {};
  },env);
  const result=await plp.getStorefrontPlp('clothes');assert.equal(result.ok,true);assert.equal(result.data.products.length,1);
  const read=calls.find(c=>c.url.startsWith('/storefront/plp/'));const q=new URL(read.url,'http://test').searchParams;
  assert.equal(q.get('tradePolicy'),shopId==='sa'?'default':null);
  assert.equal(q.get('view'),shopId==='sa'?null:'cards');
  assert.equal(typeof read.options.parse==='function',shopId!=='sa');
});
