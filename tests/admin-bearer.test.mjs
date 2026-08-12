import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/shared/auth/admin-bearer.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

const commonJsExports = {};
const moduleContext = {
  exports: commonJsExports,
  module: { exports: commonJsExports },
  process: {
    env: {},
  },
};

vm.runInNewContext(outputText, moduleContext);

const { hasUsableAdminBearer } = moduleContext.module.exports;

test("rejects an admin session without access token", () => {
  assert.equal(hasUsableAdminBearer({ permissions: [] }), false);
});

test("accepts an admin session with an access token", () => {
  assert.equal(hasUsableAdminBearer({ accessToken: "access-token", permissions: [] }), true);
});
