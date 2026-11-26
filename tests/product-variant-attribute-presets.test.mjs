import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";
const categoryId = "11111111-1111-4111-8111-111111111111";
function setup({ permissions = ["catalog.specifications.write"], available = true, initial = [] } = {}) {
  const fields = [...initial], calls = [];
  const context = { organizationId: "org-a", shopId: "shop-a", locale: "es-ES" };
  const actions = loadTs("src/modules/catalogo/product-variant-attribute-actions.ts", {
    "../auth/current-admin-session": { getCurrentAdminSession: async () => ({ permissions }) },
    "../../shared/config/admin-context": { getAdminContext: async () => context },
    "./catalog-attributes-features": {
      listCatalogAttributeFeatureData: async (scope) => {
        assert.equal(scope, context);
        return { source: available ? "bff" : "unavailable", fields, message: "No disponible" };
      },
      createCatalogSpecificationField: async (scope, input) => {
        assert.equal(scope, context);
        calls.push(input);
        const field = { fieldId: `field-${input.name}`, groupId: `group-${input.name}`, groupName: input.groupName, name: input.name, isActive: input.isActive, isStockKeepingUnit: input.tab === "attributes", values: input.values.map((name) => ({ fieldValueId: name, name, isActive: true })) };
        fields.push(field);
        return { ok: true, data: { fields: [field] } };
      },
    },
  });
  return { actions, calls };
}
test("common attributes require write permission and a valid category", async () => {
  const denied = setup({ permissions: ["catalog.products.read"] });
  assert.equal((await denied.actions.createCommonVariantAttributes(categoryId)).ok, false);
  assert.equal(denied.calls.length, 0);
  const invalid = setup();
  assert.equal((await invalid.actions.createCommonVariantAttributes("not-a-category")).ok, false);
  assert.equal(invalid.calls.length, 0);
});
test("common attributes are created through scoped BFF writes and reused on repeat", async () => {
  const { actions, calls } = setup();
  const result = await actions.createCommonVariantAttributes(categoryId);
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map((input) => input.name), ["Talla", "Color", "Acabado"]);
  assert.equal(calls.every((input) => input.categoryId === categoryId && input.tab === "attributes"), true);
  assert.deepEqual(result.fields[0].values.map((value) => value.name), ["XS", "S", "M", "L", "XL", "XXL"]);
  assert.equal(result.fields.every((field) => field.fieldId && field.isStockKeepingUnit), true);
  assert.equal((await actions.createCommonVariantAttributes(categoryId)).ok, true);
  assert.equal(calls.length, 3);
});
test("unavailable catalog never triggers blind creation", async () => {
  const { actions, calls } = setup({ available: false });
  assert.equal((await actions.createCommonVariantAttributes(categoryId)).ok, false);
  assert.equal(calls.length, 0);
});
test("descriptive features do not count as existing variant attributes", async () => {
  const { actions, calls } = setup({ initial: [{ name: "Color", fieldId: "descriptive", isActive: true, isStockKeepingUnit: false, values: [] }] });
  const result = await actions.createCommonVariantAttributes(categoryId);
  assert.equal(result.ok, true);
  assert.equal(calls.some((input) => input.name === "Color"), true);
  assert.equal(result.fields.some((field) => field.fieldId === "descriptive"), false);
});
