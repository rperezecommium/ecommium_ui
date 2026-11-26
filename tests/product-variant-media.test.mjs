import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";
const { createEmptyProductDraft } = loadTs("src/modules/catalogo/product-editor-draft.ts");
const { assignVariantImage, effectiveVariantImage, ownVariantImage, normalizeVariantMedia } = loadTs("src/modules/catalogo/product-variant-media.ts");
function fixture() {
  const draft = createEmptyProductDraft();
  draft.defaultVariantId = "variant-zero";
  draft.variants = [{ localId: "one", variantId: "persisted-one" }, { localId: "two" }];
  draft.media.items = ["a", "b", "c"].map((localId) => ({ localId, mediaAssetId: `asset-${localId}`, active: true, isMain: false, alt: {}, title: {} }));
  return draft;
}
test("empty product and unassigned collection have no implicit image", () => {
  assert.equal(effectiveVariantImage(createEmptyProductDraft(), "default"), undefined);
  const draft = normalizeVariantMedia(fixture());
  assert.equal(effectiveVariantImage(draft, "default"), undefined);
  assert.equal(effectiveVariantImage(draft, "one"), undefined);
  assert.deepEqual(draft.media.assignments.default, []);
});
test("cover is unique and drives variant zero plus inheriting variants", () => {
  let draft = assignVariantImage(fixture(), "default", "a");
  assert.equal(effectiveVariantImage(draft, "variant-zero").localId, "a");
  assert.equal(effectiveVariantImage(draft, "two").localId, "a");
  assert.equal(ownVariantImage(draft, "two"), undefined);
  draft = assignVariantImage(draft, "one", "b");
  draft = assignVariantImage(draft, "default", "c");
  assert.equal(draft.media.items.filter((item) => item.isMain).length, 1);
  assert.equal(effectiveVariantImage(draft, "two").localId, "c");
  assert.equal(effectiveVariantImage(draft, "one").localId, "b");
  assert.deepEqual(draft.media.assignments.default, ["c"]);
  assert.equal(draft.media.assignments.two, undefined);
});
test("deactivating an override clears its persisted assignment and restores inheritance", () => {
  let draft = assignVariantImage(assignVariantImage(fixture(), "default", "a"), "persisted-one", "b");
  draft.media.items = draft.media.items.map((item) => item.localId === "b" ? { ...item, active: false } : item);
  draft = normalizeVariantMedia(draft);
  assert.equal(effectiveVariantImage(draft, "one").localId, "a");
  assert.deepEqual(draft.media.assignments.one, []);
  assert.equal(draft.media.mainByVariant.one, undefined);
  draft.media.items = draft.media.items.map((item) => ({ ...item, active: true }));
  assert.equal(effectiveVariantImage(draft, "one").localId, "a");
});
test("unassign, inactive cover and removal never choose an unrelated collection image", () => {
  let draft = assignVariantImage(assignVariantImage(fixture(), "default", "a"), "one", "b");
  draft = assignVariantImage(draft, "one");
  assert.equal(effectiveVariantImage(draft, "one").localId, "a");
  draft.media.items = draft.media.items.map((item) => item.localId === "a" ? { ...item, active: false } : item);
  draft = normalizeVariantMedia(draft);
  assert.equal(effectiveVariantImage(draft, "one"), undefined);
  assert.deepEqual(draft.media.assignments.default, []);
  assert.equal(assignVariantImage(draft, "one", "a"), draft);
  draft.media.items = draft.media.items.filter((item) => item.localId !== "a");
  assert.equal(effectiveVariantImage(normalizeVariantMedia(draft), "default"), undefined);
});
test("legacy persisted IDs resolve active main images and canonicalize keys", () => {
  const draft = fixture();
  draft.media.items[0].isMain = true;
  draft.media.assignments = { "variant-zero": ["asset-b"], "persisted-one": ["asset-b", "asset-c"] };
  draft.media.mainByVariant = { "persisted-one": "asset-c" };
  const normalized = normalizeVariantMedia(draft);
  assert.deepEqual(normalized.media.assignments, { default: ["a"], one: ["c"] });
  assert.equal(normalized.media.mainByVariant.one, "c");
  assert.deepEqual(normalizeVariantMedia(normalized), normalized);
});
