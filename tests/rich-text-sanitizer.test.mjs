import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import sanitizeHtml from "sanitize-html";

const source = readFileSync(new URL("../src/shared/security/rich-text.ts", import.meta.url), "utf8");
const outputText = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const commonJsExports = {};
const moduleContext = {
  URL,
  exports: commonJsExports,
  module: { exports: commonJsExports },
  require(specifier) {
    if (specifier === "sanitize-html") return sanitizeHtml;
    throw new Error(`Unexpected dependency: ${specifier}`);
  },
};
vm.runInNewContext(outputText, moduleContext);
const { sanitizeRichTextHtml } = moduleContext.module.exports;

test("rich text sanitizer removes active markup, mXSS payloads and unsafe URLs", () => {
  const payload = [
    '<script>alert(1)</script><p onclick="alert(1)">Texto</p>',
    '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
    '<a href="java&#x0A;script:alert(1)">enlace</a>',
    '<img src=x onerror="alert(1)"><style>body{display:none}</style>',
    '<math><mi xlink:href="data:x">X</mi></math>',
  ].join("");
  const sanitized = sanitizeRichTextHtml(payload);

  assert.doesNotMatch(sanitized, /script|svg|math|img|style|onerror|onclick|javascript:|data:/i);
  assert.match(sanitized, /<p>Texto<\/p>/);
  assert.match(sanitized, /<a>enlace<\/a>/);
});

test("rich text sanitizer preserves only allowlisted safe markup", () => {
  const sanitized = sanitizeRichTextHtml('<h2>Título</h2><p><a href="/catalogo" title="Catálogo">Ver</a> <strong>ahora</strong></p>');

  assert.equal(
    sanitized,
    '<h2>Título</h2><p><a href="/catalogo" rel="noopener noreferrer" title="Catálogo">Ver</a> <strong>ahora</strong></p>',
  );
});
