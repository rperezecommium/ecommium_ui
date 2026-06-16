import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/modules/auth/admin-login-payload.ts", import.meta.url), "utf8");
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
};

vm.runInNewContext(outputText, moduleContext);

const { buildAdminLoginPayload } = moduleContext.module.exports;

test("admin login payload does not include organizationId or shopId", () => {
  const payload = buildAdminLoginPayload("admin@example.com", "secret123");

  assert.equal(JSON.stringify(payload), JSON.stringify({
    email: "admin@example.com",
    password: "secret123",
    scope: "admin",
  }));
  assert.equal("organizationId" in payload, false);
  assert.equal("shopId" in payload, false);
});
