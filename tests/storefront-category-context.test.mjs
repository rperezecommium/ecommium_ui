import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

test('navigation sends the resolved tenant and keeps nested categories instead of fallback entries', async () => {
  const requests = [];
  const { getStorefrontCategories } = loadTs('src/modules/storefront/plp.ts', {
    '../../shared/bff/storefront-client': {
      requestStorefrontBff: async (path, options) => {
        requests.push({ path, context: options.context });
        const query = new URL(path, 'http://bff').searchParams;
        if (!query.get('organizationId') || !query.get('shopId')) return { ok: false, status: 400 };
        return { ok: true, data: { categories: [{ id: 'parent', name: 'Bicicletas', linkId: 'bicicletas', children: [{ id: 'child', name: 'Gravel', linkId: 'gravel', children: [] }] }] } };
      },
    },
    './storefront-context': {},
  });
  for (const shopId of ['shop-a', 'shop-b']) {
    const context = { organizationId: 'organization', shopId, locale: 'es-ES', currency: 'EUR', country: 'ES', channel: 'web' };
    const categories = await getStorefrontCategories(context, 'gravel');
    assert.deepEqual(categories.map(c => c.name), ['Bicicletas', 'Gravel']);
    const request = requests.at(-1);
    const query = new URL(request.path, 'http://bff').searchParams;
    assert.equal(query.get('organizationId'), context.organizationId);
    assert.equal(query.get('shopId'), shopId);
    assert.equal(query.get('locale'), context.locale);
    assert.equal(request.context, context);
  }
});
