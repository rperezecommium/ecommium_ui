import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
const { productSpecificationCatalog, groupProductSpecificationFields } = loadTs(
  "src/modules/catalogo/product-specification-fields.ts",
);
function group(overrides = {}) {
  return {
    specificationGroupId: "technical",
    name: "Datos técnicos",
    categoryId: "bikes",
    linkedCategoryIds: ["parts"],
    isActive: true,
    fields: [
      {
        fieldId: "material",
        name: "Material",
        isActive: true,
        isStockKeepingUnit: false,
        values: [
          { fieldValueId: "carbon", name: "Carbono", isActive: true },
          { fieldValueId: "old", name: "Antiguo", isActive: false },
        ],
      },
    ],
    ...overrides,
  };
}
test("category links survive mapping and groups share fields only across explicit categories", () => {
  const catalog = productSpecificationCatalog([group()]);
  assert.deepEqual(catalog.fields[0].categoryIds, ["bikes", "parts"]);
  for (const id of ["bikes", "parts"])
    assert.equal(
      groupProductSpecificationFields(catalog.fields, id, []).suggested[0]
        .fields[0].fieldId,
      "material",
    );
  assert.equal(
    groupProductSpecificationFields(catalog.fields, "clothing", []).suggested
      .length,
    0,
  );
  assert.equal(
    groupProductSpecificationFields(catalog.fields, "", []).suggested.length,
    0,
  );
});
test("inactive groups, inactive fields, SKU attributes and inactive values do not become product features", () => {
  const catalog = productSpecificationCatalog([
    group({ isActive: false }),
    group({
      specificationGroupId: "live",
      fields: [
        { ...group().fields[0], isActive: false },
        { ...group().fields[0], fieldId: "size", isStockKeepingUnit: true },
        { ...group().fields[0], fieldId: "weight" },
      ],
    }),
  ]);
  assert.equal(catalog.groups.length, 1);
  assert.equal(catalog.fields.length, 1);
  assert.deepEqual(
    catalog.fields[0].values.map((v) => v.fieldValueId),
    ["carbon"],
  );
});
test("changing category preserves selected fields in a separate section, without adding unselected unrelated fields", () => {
  const catalog = productSpecificationCatalog([group()]);
  const result = groupProductSpecificationFields(catalog.fields, "clothing", [
    "material",
  ]);
  assert.equal(result.suggested.length, 0);
  assert.equal(result.additional[0].fields[0].fieldId, "material");
  assert.equal(
    groupProductSpecificationFields(catalog.fields, "clothing", []).additional
      .length,
    0,
  );
});
const categoryId = "013320a6-527e-4a80-8513-74e4b2b29ecd";
function actions({
  permissions = ["catalog.specifications.write"],
  result,
  throws = false,
} = {}) {
  const calls = [];
  const api = loadTs("src/modules/catalogo/product-feature-actions.ts", {
    "../auth/current-admin-session": {
      getCurrentAdminSession: async () => ({ permissions }),
    },
    "../../shared/config/admin-context": {
      getAdminContext: async () => ({
        organizationId: "org",
        shopId: "shop",
        locale: "es-ES",
      }),
    },
    "./catalog-attributes-features": {
      createCatalogSpecificationField: async (ctx, input) => {
        calls.push({ ctx, input });
        if (throws) throw Error("secret upstream");
        return result;
      },
      getCatalogSpecificationGroup: async () => ({
        ok: true,
        data: group({ categoryId }),
      }),
    },
  });
  const form = new FormData();
  form.set("name", "Material");
  form.set("categoryId", categoryId);
  form.set("groupName", "Datos técnicos");
  form.set("values", "Carbono, Aluminio");
  form.set("isActive", "on");
  return { api, calls, form };
}
test("inline creation gates permissions and validates the form before any mutation", async () => {
  const denied = actions({ permissions: [] });
  assert.match(
    (await denied.api.createProductFeatureAction(denied.form)).state.error,
    /permiso/,
  );
  assert.equal(denied.calls.length, 0);
  const invalid = actions();
  invalid.form.delete("values");
  assert.ok(
    (await invalid.api.createProductFeatureAction(invalid.form)).state
      .fieldErrors.values,
  );
  assert.equal(invalid.calls.length, 0);
});
test("confirmed inline creation returns the BFF catalog without redirecting or attaching values to the product", async () => {
  const { api, calls, form } = actions({
    result: { ok: true, data: group({ categoryId }) },
  });
  const result = await api.createProductFeatureAction(form);
  assert.ok(result.state.success);
  assert.equal(result.catalog.fields[0].fieldId, "material");
  assert.equal(calls[0].input.tab, "features");
  assert.equal(calls[0].input.categoryId, categoryId);
  assert.equal("productId" in calls[0].input, false);
});

test("attribute management preserves SKU identity, category links and active values", () => {
  const catalog = productSpecificationCatalog([group({ fields: [
    group().fields[0],
    { ...group().fields[0], fieldId: "size", name: "Talla", isStockKeepingUnit: true },
    { ...group().fields[0], fieldId: "inactive", isStockKeepingUnit: true, isActive: false },
  ] })], "attributes");
  assert.deepEqual(catalog.fields.map((field) => field.fieldId), ["size"]);
  assert.equal(catalog.fields[0].isStockKeepingUnit, true);
  assert.deepEqual(catalog.fields[0].categoryIds, ["bikes", "parts"]);
  assert.deepEqual(catalog.fields[0].values.map((value) => value.fieldValueId), ["carbon"]);
});

test("inline attribute creation uses the attribute contract and rejects a descriptive confirmation", async () => {
  const attribute = { ...group().fields[0], isStockKeepingUnit: true };
  const accepted = actions({ result: { ok: true, data: group({ categoryId, fields: [attribute] }) } });
  accepted.form.set("tab", "attributes");
  const response = await accepted.api.createProductFeatureAction(accepted.form);
  assert.equal(accepted.calls[0].input.tab, "attributes");
  assert.ok(response.state.success);
  assert.equal(response.catalog.fields[0].isStockKeepingUnit, true);
  const rejected = actions({ result: { ok: true, data: group({ categoryId }) } });
  rejected.form.set("tab", "attributes");
  const failure = await rejected.api.createProductFeatureAction(rejected.form);
  assert.ok(failure.state.error);
  assert.equal(failure.catalog, undefined);
  const denied = actions({ permissions: [] });
  denied.form.set("tab", "attributes");
  assert.match((await denied.api.createProductFeatureAction(denied.form)).state.error, /permiso/);
  assert.equal(denied.calls.length, 0);
});

test("adding an attribute option returns confirmed SKU values without attaching them to a variant", async () => {
  const calls = [];
  const api = loadTs("src/modules/catalogo/product-feature-actions.ts", {
    "../auth/current-admin-session": { getCurrentAdminSession: async () => ({ permissions: ["catalog.specifications.write"] }) },
    "../../shared/config/admin-context": { getAdminContext: async () => ({ organizationId: "org", shopId: "shop", locale: "es-ES" }) },
    "./catalog-attributes-features": { addCatalogSpecificationValue: async (ctx, input) => {
      calls.push({ ctx, input });
      return { ok: true, data: group({ fields: [{ ...group().fields[0], isStockKeepingUnit: true }] }) };
    } },
  });
  const form = new FormData();
  form.set("tab", "attributes");
  form.set("groupId", "technical");
  form.set("fieldId", "material");
  form.set("value", "Carbono");
  const result = await api.addProductFeatureValueAction(form);
  assert.ok(result.state.success);
  assert.equal(result.catalog.fields[0].isStockKeepingUnit, true);
  assert.equal(result.catalog.fields[0].values[0].name, "Carbono");
  assert.deepEqual(calls[0].input, { groupId: "technical", fieldId: "material", value: "Carbono" });
  assert.equal(calls[0].ctx.shopId, "shop");
  form.set("value", "");
  assert.ok((await api.addProductFeatureValueAction(form)).state.error);
  assert.equal(calls.length, 1);
});
test("failed or unconfirmed inline creation stays in the form without inventing selectable data", async () => {
  for (const result of [
    { ok: false, error: "Solicitud rechazada" },
    { ok: true, data: group({ fields: [] }) },
  ]) {
    const { api, form } = actions({ result });
    const response = await api.createProductFeatureAction(form);
    assert.ok(response.state.error);
    assert.equal(response.catalog, undefined);
  }
  const failed = actions({ throws: true });
  assert.doesNotMatch(
    (await failed.api.createProductFeatureAction(failed.form)).state.error,
    /secret upstream/,
  );
});

test("linking a group preserves its primary category, existing links, fields and SKU flags", async () => {
  const calls = [];
  const original = group({
    categoryId: "brakes",
    linkedCategoryIds: ["brakes", "parts"],
    fields: [{ ...group().fields[0], isStockKeepingUnit: true }],
  });
  const taxonomyModule = loadTs(
    "src/modules/catalogo/catalog-attributes-features.ts",
    {
      "../../shared/bff/admin-client": {
        requestAdminBff: async (endpoint, options) => {
          calls.push({ endpoint, options });
          if (!options.init) return { ok: true, data: original };
          return { ok: true, data: {} };
        },
      },
    },
  );
  await taxonomyModule.linkCatalogSpecificationGroupToCategory(
    { organizationId: "org", shopId: "shop", locale: "es-ES" },
    "technical",
    "bikes",
  );
  const payload = JSON.parse(calls[1].options.init.body);
  assert.equal(payload.categoryId, "brakes");
  assert.deepEqual(payload.linkedCategoryIds, ["brakes", "parts", "bikes"]);
  assert.equal(payload.fields[0].isStockKeepingUnit, true);
  assert.equal(payload.fields[0].fieldId, "material");
  assert.match(calls[1].endpoint, /organizationId=org/);
  assert.match(calls[1].endpoint, /shopId=shop/);
});
