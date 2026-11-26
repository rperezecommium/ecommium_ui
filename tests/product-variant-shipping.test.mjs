import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
const { parseShippingPackageOverride } = loadTs('src/modules/catalogo/product-variant-shipping.ts');
const { createEmptyProductDraft } = loadTs('src/modules/catalogo/product-editor-draft.ts');
const { normalizeProductDraft } = loadTs('src/modules/catalogo/product-editor-validation.ts');

test('own shipping fields validate, retain explicit zero and clear null inheritance', () => {
  assert.deepEqual(parseShippingPackageOverride({ widthMm: 400, weightGrams: 0, heightMm: null }), { widthMm: 400, weightGrams: 0 });
  for (const invalid of [null, [], { widthMm: -1 }, { widthMm: 1.5 }, { widthMm: '400' }, { unsupported: 1 }]) assert.throws(() => parseShippingPackageOverride(invalid));
});

test('saving a variant retains its physical override without copying inherited measurements', () => {
  const draft = createEmptyProductDraft();
  draft.shipping.package = { weightGrams: 900, widthMm: 200, heightMm: 100, depthMm: 300 };
  draft.variants = [{ localId: 'xl', name: 'ExtraXL', refId: 'SHOE-XL', options: [], shippingPackage: { widthMm: 400 }, isActive: true, isVisible: true }];
  const result = normalizeProductDraft(draft);
  assert.deepEqual(result.variants[0].shippingPackage, { widthMm: 400 });
  assert.equal(result.shipping.package.widthMm, 200);
  const persisted = JSON.parse(JSON.stringify(result));
  assert.deepEqual(persisted.variants[0].shippingPackage, { widthMm: 400 });
  draft.variants[0].shippingPackage = {};
  assert.deepEqual(normalizeProductDraft(draft).variants[0].shippingPackage, {});
});
