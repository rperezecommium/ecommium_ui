import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/shared/bff/headers.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

const commonJsExports = {};
const moduleContext = {
  Headers,
  exports: commonJsExports,
  module: { exports: commonJsExports },
};

vm.runInNewContext(outputText, moduleContext);

const { createBffHeaders } = moduleContext.module.exports;

test("adds the server-side admin BFF token as a bearer authorization header", () => {
  const headers = createBffHeaders({
    adminToken: "admin-token",
    correlationId: "corr-1",
    locale: "es-ES",
  });

  assert.equal(headers.get("authorization"), "Bearer admin-token");
  assert.equal(headers.get("x-correlation-id"), "corr-1");
  assert.equal(headers.get("x-locale"), "es-ES");
  assert.equal(headers.get("accept"), "application/json");
});

test("does not override an explicit authorization header", () => {
  const headers = createBffHeaders({
    adminToken: "admin-token",
    correlationId: "corr-2",
    initHeaders: {
      authorization: "Bearer request-token",
    },
  });

  assert.equal(headers.get("authorization"), "Bearer request-token");
});
