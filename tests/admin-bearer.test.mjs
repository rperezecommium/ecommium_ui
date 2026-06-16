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

const { canUseDevAdminSession, hasUsableAdminBearer } = moduleContext.module.exports;

test("rejects an admin session without access token or server fallback token", () => {
  assert.equal(hasUsableAdminBearer({ permissions: [] }, ""), false);
});

test("accepts an admin session with an access token", () => {
  assert.equal(hasUsableAdminBearer({ accessToken: "access-token", permissions: [] }, ""), true);
});

test("accepts a dev admin session only when the server fallback token exists", () => {
  moduleContext.process.env.ECOMMIUM_ADMIN_DEV_SESSION = "1";

  assert.equal(canUseDevAdminSession(""), false);
  assert.equal(canUseDevAdminSession("server-token"), true);
  assert.equal(hasUsableAdminBearer({ permissions: [] }, "server-token"), true);
});
