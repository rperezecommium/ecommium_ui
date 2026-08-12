import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/shared/security/media-upload.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(output, { File, Uint8Array, String, exports, module: { exports } });
const media = exports;

test("media upload accepts only image signatures and normalizes the filename", async () => {
  const png = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])], "../../cartel <x>.png", { type: "image/png" });
  const result = await media.validateMediaUpload(png);
  assert.equal(result.ok, true);
  assert.equal(result.file.type, "image/png");
  assert.match(result.file.name, /^[a-zA-Z0-9._-]+\.png$/);
});

test("media upload rejects active content, forged MIME types and oversize batches", async () => {
  const svg = new File(["<svg onload=alert(1) />"], "active.svg", { type: "image/svg+xml" });
  const forged = new File(["not an image"], "forged.png", { type: "image/png" });
  assert.equal((await media.validateMediaUpload(svg)).ok, false);
  assert.equal((await media.validateMediaUpload(forged)).ok, false);
  const png = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "safe.png", { type: "image/png" });
  assert.equal((await media.validateMediaUploads(Array.from({ length: 13 }, () => png))).ok, false);
});
