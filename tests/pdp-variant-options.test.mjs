import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { pdpVariantForOption, pdpVariantOptionGroups } = loadTs("src/modules/storefront/pdp-variant-options.ts");
const variant = (id, size, color, available = true) => ({
  variantId: id, available,
  options: [{ attributeCode: "size", valueCode: size }, { attributeCode: "color", valueCode: color }],
});
const variants = [variant("s-red", "S", "rojo"), variant("m-red", "M", "rojo"), variant("m-green", "M", "verde")];

test("groups unique values by real attribute, preserving order and excluding empty options", () => {
  const groups = pdpVariantOptionGroups([...variants, { variantId: "empty", available: true, options: [{ attributeCode: "", valueCode: "invalid" }] }]);
  assert.deepEqual(groups, [{ attribute: "size", values: ["S", "M"] }, { attribute: "color", values: ["rojo", "verde"] }]);
});

test("changing one option retains the other selected attributes when the combination exists", () => {
  assert.equal(pdpVariantForOption(variants, variants[2], "color", "rojo").variantId, "m-red");
  assert.equal(pdpVariantForOption(variants, variants[0], "size", "M").variantId, "m-red");
});

test("sparse combinations choose an existing variant rather than inventing a SKU", () => {
  assert.equal(pdpVariantForOption(variants, variants[0], "color", "verde").variantId, "m-green");
  assert.equal(pdpVariantForOption(variants, variants[1], "size", "L"), undefined);
});

test("unavailable values cannot select a variant, consistent with image selection", () => {
  assert.equal(pdpVariantForOption([variant("out", "L", "verde", false)], variants[0], "size", "L"), undefined);
});

test("selecting the active value retains the exact variant identity", () => {
  assert.equal(pdpVariantForOption(variants, variants[1], "color", "rojo").variantId, "m-red");
  assert.deepEqual(pdpVariantOptionGroups([]), []);
});
