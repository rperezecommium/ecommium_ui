import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { registeredCombinations, registeredVariantName, registeredVariantSku } = loadTs("src/modules/catalogo/product-registered-combinations.ts");
const fields = [
  { fieldId: "size", name: "Talla", categoryIds: ["bikes"], isActive: true, isStockKeepingUnit: true, values: [{ fieldValueId: "small", name: "S", isActive: true }, { fieldValueId: "medium", name: "M", isActive: true }] },
  { fieldId: "color", name: "Color", categoryIds: ["bikes"], isActive: true, isStockKeepingUnit: true, values: [{ fieldValueId: "grey", name: "Gris", isActive: true }, { fieldValueId: "blue", name: "Azul", isActive: true }] },
];

test("variant SKUs extend the parent reference with values instead of the product title", () => {
  assert.equal(registeredVariantSku("BICI-20260929-172", [{ attributeCode: "size", valueCode: "s" }]), "BICI-20260929-172-S");
  assert.equal(registeredVariantSku("BICI-20260929-172", [{ attributeCode: "color", valueCode: "gris" }, { attributeCode: "size", valueCode: "m" }]), "BICI-20260929-172-GRIS-M");
  assert.equal(registeredVariantSku("BICI-20260929-172", [], "V3"), "BICI-20260929-172-V3");
  const long = "REFERENCIA".repeat(10);
  const first = registeredVariantSku(long, [{ attributeCode: "model", valueCode: "valor".repeat(20) }]);
  assert.ok(first.length <= 64);
  assert.equal(first, registeredVariantSku(long, [{ attributeCode: "model", valueCode: "valor".repeat(20) }]));
  assert.notEqual(first, registeredVariantSku(long, [{ attributeCode: "model", valueCode: "valor".repeat(20) + "-otro" }]));
});

test("generation uses registered value identities and canonical labels for arbitrary attributes", () => {
  const result = registeredCombinations(fields, "bikes", { size: ["small", "medium"], color: ["grey", "blue"] });
  assert.equal(result.error, null);
  assert.equal(result.combinations.length, 4);
  assert.deepEqual(result.combinations[0].map((option) => [option.attributeCode, option.valueCode]), [["talla", "s"], ["color", "gris"]]);
  assert.equal(registeredVariantName("Bicicleta", result.combinations[0], fields), "Bicicleta / S / Gris");
});

test("unknown, inactive, descriptive or unrelated definitions and values cannot generate variants", () => {
  for (const catalog of [[], [{ ...fields[0], isActive: false }], [{ ...fields[0], isStockKeepingUnit: false }], [{ ...fields[0], categoryIds: ["shoes"] }]]) {
    assert.ok(registeredCombinations(catalog, "bikes", { size: ["small"] }).error);
  }
  assert.ok(registeredCombinations(fields, "bikes", { size: ["invented"] }).error);
  assert.ok(registeredCombinations([{ ...fields[0], values: [{ ...fields[0].values[0], isActive: false }] }], "bikes", { size: ["small"] }).error);
  assert.ok(registeredCombinations(fields, "bikes", {}).error);
});

test("ambiguous attribute or value codes and excessive cartesian products are rejected", () => {
  assert.ok(registeredCombinations([...fields, { ...fields[0], fieldId: "other" }], "bikes", { size: ["small"], other: ["small"] }).error);
  const duplicate = { ...fields[0], values: [fields[0].values[0], { fieldValueId: "same", name: "s", isActive: true }] };
  assert.ok(registeredCombinations([duplicate], "bikes", { size: ["small", "same"] }).error);
  const many = { ...fields[0], values: Array.from({ length: 101 }, (_, i) => ({ fieldValueId: `value-${i}`, name: `Value ${i}`, isActive: true })) };
  assert.match(registeredCombinations([many], "bikes", { size: many.values.map((value) => value.fieldValueId) }).error, /100/);
});

test("regenerated names follow updated active options and preserve full product names", () => {
  const options = [{ attributeCode: "talla", valueCode: "m", isActive: true }, { attributeCode: "color", valueCode: "gris", markedForDeletion: true }];
  assert.equal(registeredVariantName("Producto / Edición especial", options, fields), "Producto / Edición especial / M");
  assert.equal(registeredVariantName("Producto", [], fields), "Producto");
  assert.equal(registeredVariantName("Producto", [{ attributeCode: "size", valueCode: "s" }], fields), "Producto / S");
});
