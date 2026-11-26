import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTs } from './helpers/load-ts.mjs';

test('preview navigation requires Employee CMS permissions and uses the selected shop/locale', async () => {
  let session = null;
  const calls = [];
  const actions = loadTs('src/modules/cms/cms-site-part-preview-actions.ts', {
    '../auth/current-admin-session': { getCurrentAdminSession: async () => session },
    '../../shared/config/admin-context': { getAdminContext: async () => ({ organizationId: 'org-selected', shopId: 'shop-selected', locale: 'es-ES' }) },
    '../storefront/plp': { getStorefrontNavigationRead: async context => { calls.push(context); return { categories: [{ id:'category', name:'Real category' }] }; } },
  });
  assert.match((await actions.loadCmsPreviewNavigation('es-ES')).message, /permisos CMS/);
  session = { permissions: ['orders.read'] };
  await actions.loadCmsPreviewNavigation('es-ES');
  assert.equal(calls.length, 0);
  session = { permissions: ['cms.settings.write'] };
  assert.match((await actions.loadCmsPreviewNavigation('<script>')).message, /idioma/);
  assert.equal(calls.length, 0);
  assert.equal((await actions.loadCmsPreviewNavigation('fr-FR')).categories[0].id, 'category');
  assert.deepEqual(calls, [{ organizationId:'org-selected', shopId:'shop-selected', locale:'fr-FR' }]);
});

test('preview and storefront share navigation parsing and explicitly identify fallback data', async () => {
  let response;
  const calls = [];
  const plp = loadTs('src/modules/storefront/plp.ts', {
    '../../shared/config/storefront-commercial-policy': {},
    './storefront-commercial-context': {},
    './plp-cards-contract': {},
    '../../shared/bff/storefront-client': { requestStorefrontBff: async (path, options) => { calls.push({path, options}); return response; } },
    './storefront-context': {},
  });
  const context = {organizationId:'org',shopId:'shop',locale:'fr-FR'};
  response = {ok:true,data:{categories:[{id:'category',name:'Bicis',linkId:'bicis'}]}};
  const result = await plp.getStorefrontNavigationRead(context);
  assert.equal(result.categories[0].name, 'Bicis');
  assert.equal(result.categories[0].href, '/plp/bicis');
  assert.equal(result.message, undefined);
  assert.equal(calls[0].options.withAuth, false);
  assert.match(calls[0].path, /organizationId=org&shopId=shop&locale=fr-FR/);
  response = {ok:false};
  const failed = await plp.getStorefrontNavigationRead(context);
  assert.match(failed.message, /provisional/);
  assert.deepEqual(failed.categories, await plp.getStorefrontCategories(context, ''));
  response = {ok:true,data:{categories:'malformed'}};
  assert.match((await plp.getStorefrontNavigationRead(context)).message, /no válida/);
});
