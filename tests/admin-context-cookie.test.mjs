import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/shared/config/admin-context.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

const cookieJar = new Map();
let currentSession = null;

const commonJsExports = {};
const moduleContext = {
  process,
  exports: commonJsExports,
  module: { exports: commonJsExports },
  require(specifier) {
    if (specifier === "next/headers") {
      return {
        cookies: async () => ({
          get(name) {
            const value = cookieJar.get(name);
            return value ? { value } : undefined;
          },
          set(name, value) {
            cookieJar.set(name, value);
          },
          delete(name) {
            cookieJar.delete(name);
          },
        }),
      };
    }
    if (specifier === "../auth/session") {
      return {
        getAdminSession: async () => currentSession,
      };
    }
    if (specifier === "./env") {
      return {
        defaultAdminContext: {
          organizationId: "default-org",
          shopId: "default-shop",
          shopAlias: "default-shop-alias",
          locale: "es-ES",
          currency: "EUR",
          country: "ES",
          channel: "admin",
        },
      };
    }

    throw new Error(`Unexpected require: ${specifier}`);
  },
};

vm.runInNewContext(outputText, moduleContext);

const {
  clearAdminContext,
  contextCookieName,
  getAdminContext,
  saveAdminContext,
} = moduleContext.module.exports;

test("admin context cookie is scoped by principal", async () => {
  cookieJar.clear();
  currentSession = { employeeId: "employee-1", email: "one@example.com" };

  await saveAdminContext({
    organizationId: "org-1",
    shopId: "shop-1",
    shopAlias: "tienda-uno",
    shopName: "Tienda Uno",
    primaryDomain: "",
    shopStatus: "ACTIVE",
    locale: "es-ES",
    currency: "EUR",
    country: "ES",
    channel: "admin",
  });

  assert.ok(cookieJar.get(contextCookieName).includes("employee-1"));
  assert.equal((await getAdminContext()).shopId, "shop-1");

  currentSession = { employeeId: "employee-2", email: "two@example.com" };
  const otherPrincipalContext = await getAdminContext();

  assert.equal(otherPrincipalContext.organizationId, "");
  assert.equal(otherPrincipalContext.shopId, "");
  assert.equal(otherPrincipalContext.shopAlias, "");
  assert.equal(otherPrincipalContext.locale, "es-ES");

  currentSession = { employeeId: "employee-1", email: "one@example.com" };
  assert.equal((await getAdminContext()).shopId, "shop-1");

  await clearAdminContext();
  assert.equal(cookieJar.has(contextCookieName), false);
});
