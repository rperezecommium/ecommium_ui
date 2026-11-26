import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { createEmptyProductDraft } = loadTs("src/modules/catalogo/product-editor-draft.ts");
const { prepareProductSaveAttempt, acknowledgeProductSaveAttempt, productSaveSignature, applyProductSavePatch } = loadTs("src/modules/catalogo/product-save-attempt.ts");

function request(draft) {
  const form = new FormData();
  form.set("draft", JSON.stringify(draft));
  form.append("fileLocalIds", "image-new");
  form.append("files", new Blob(["image-bytes"], { type: "image/png" }), "bike.png");
  return form;
}

test("partial acknowledgement updates the editor but retry replays the original command and files", async () => {
  const draft = createEmptyProductDraft();
  const attempt = prepareProductSaveAttempt(null, productSaveSignature(draft, false), request(draft), () => "key-1");
  const report = { ok: false, operationId: "operation-1", retryable: true, draftPatch: { productId: "created-product", defaultVariantId: "created-default", saveState: { catalog: "success" } } };
  const acknowledged = applyProductSavePatch(draft, report);
  const pending = acknowledgeProductSaveAttempt(attempt, report, productSaveSignature(acknowledged, false));
  const retry = prepareProductSaveAttempt(pending, productSaveSignature(acknowledged, false), request(acknowledged), () => { throw new Error("must not rotate"); });
  assert.equal(retry.key, "key-1");
  assert.equal(retry.request, attempt.request);
  assert.equal(JSON.parse(retry.request.get("draft")).productId, undefined);
  assert.equal(await retry.request.get("files").text(), "image-bytes");
  assert.equal(acknowledged.productId, "created-product");
});

test("editing after an acknowledged partial failure creates a new command with the acknowledged IDs", () => {
  const draft = createEmptyProductDraft();
  const attempt = prepareProductSaveAttempt(null, productSaveSignature(draft, true), request(draft), () => "key-1");
  const report = { ok: false, operationId: "operation-1", retryable: true, draftPatch: { productId: "created-product" } };
  const acknowledged = applyProductSavePatch(draft, report);
  const pending = acknowledgeProductSaveAttempt(attempt, report, productSaveSignature(acknowledged, true));
  const edited = { ...acknowledged, basic: { ...acknowledged.basic, name: "Corrected combination" } };
  const next = prepareProductSaveAttempt(pending, productSaveSignature(edited, true), request(edited), () => "key-2");
  assert.equal(next.key, "key-2");
  assert.equal(JSON.parse(next.request.get("draft")).productId, "created-product");
});

test("unconfirmed outcome retains exact retry and blocks a different command", () => {
  const draft = createEmptyProductDraft();
  const signature = productSaveSignature(draft, false);
  const attempt = prepareProductSaveAttempt(null, signature, request(draft), () => "key-1");
  const pending = acknowledgeProductSaveAttempt(attempt, { ok: false, retryable: true }, signature);
  assert.equal(prepareProductSaveAttempt(pending, signature, request(draft), () => "key-2"), pending);
  assert.throws(() => prepareProductSaveAttempt(pending, "edited", request(draft), () => "key-2"), /no está confirmado/);
  assert.equal(acknowledgeProductSaveAttempt(attempt, { ok: true }, signature), null);
  assert.equal(acknowledgeProductSaveAttempt(attempt, { ok: false, retryable: false }, signature), null);
});
