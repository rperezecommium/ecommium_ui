import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(new URL('..', import.meta.url).pathname);
function load(file, imports = () => ({}), env = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const exports = {};
  const context = { exports, module: { exports }, require: imports, process: { env }, Intl, URLSearchParams, encodeURIComponent };
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
for (const enabled of [false, true]) test('PLP consumer flag=' + enabled + ' preserves cards, CTA and CMS through BFF', async () => {
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
  }, enabled ? { ECOMMIUM_STOREFRONT_PLP_CARDS_ENABLED: 'true' } : {});
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
