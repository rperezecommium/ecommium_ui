import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadModule(relativePath, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const context = {
    URL,
    exports,
    module: { exports },
    process: { env: {} },
    require(specifier) {
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  };
  vm.runInNewContext(output, { ...context, ...globals });
  return context.module.exports;
}

const storefrontEnv = loadModule("src/shared/config/storefront-env.ts");
const instrumentationSource = readFileSync(new URL("../instrumentation.ts", import.meta.url), "utf8");

test("Storefront accepts an unresolved tenant hint and never falls back to Admin IDs", () => {
  const hints = storefrontEnv.getStorefrontRuntimeContextHints({
    NODE_ENV: "production",
    ECOMMIUM_DEFAULT_ORGANIZATION_ID: "admin-org-must-not-be-used",
    ECOMMIUM_DEFAULT_SHOP_ID: "admin-shop-must-not-be-used",
  });

  assert.equal(hints.organizationId, undefined);
  assert.equal(hints.shopId, undefined);
  assert.equal(hints.locale, "es-ES");
  assert.throws(
    () => storefrontEnv.getStorefrontRuntimeContext({ NODE_ENV: "production" }),
    /resuelto por el BFF/,
  );

  const context = storefrontEnv.getStorefrontRuntimeContext({
    NODE_ENV: "production",
    ECOMMIUM_DEFAULT_ORGANIZATION_ID: "admin-org-must-not-be-used",
    ECOMMIUM_DEFAULT_SHOP_ID: "admin-shop-must-not-be-used",
    ECOMMIUM_STOREFRONT_ORGANIZATION_ID: "storefront-org",
    ECOMMIUM_STOREFRONT_SHOP_ID: "storefront-shop",
  });

  assert.equal(context.organizationId, "storefront-org");
  assert.equal(context.shopId, "storefront-shop");
  assert.equal(context.channel, "web");
});

test("Storefront fixtures require an explicit development-only switch", () => {
  const unresolved = storefrontEnv.getStorefrontRuntimeContextHints({ NODE_ENV: "development" });
  assert.equal(unresolved.organizationId, undefined);
  assert.equal(unresolved.shopId, undefined);

  const fixture = storefrontEnv.getStorefrontRuntimeContext({
    NODE_ENV: "development",
    ECOMMIUM_UI_ALLOW_STOREFRONT_FIXTURES: "true",
  });

  assert.equal(fixture.organizationId, "11111111-1111-4111-8111-111111111111");
  assert.equal(fixture.shopId, "22222222-2222-4222-8222-222222222222");
  assert.throws(
    () => storefrontEnv.getStorefrontRuntimeContext({
      NODE_ENV: "production",
      ECOMMIUM_UI_ALLOW_STOREFRONT_FIXTURES: "true",
    }),
    /resuelto por el BFF/,
  );
});

test("Storefront BFF URL is required and HTTPS in production", () => {
  assert.throws(
    () => storefrontEnv.getStorefrontBffBaseUrl({ NODE_ENV: "production" }),
    /ECOMMIUM_STOREFRONT_BFF_BASE_URL/,
  );
  assert.throws(
    () => storefrontEnv.getStorefrontBffBaseUrl({
      NODE_ENV: "production",
      ECOMMIUM_STOREFRONT_BFF_BASE_URL: "http://bff.example.test/api/v1",
    }),
    /HTTPS fuera de desarrollo/,
  );
  assert.equal(
    storefrontEnv.getStorefrontBffBaseUrl({
      NODE_ENV: "production",
      ECOMMIUM_STOREFRONT_BFF_BASE_URL: "https://bff.example.test/api/v1/",
    }),
    "https://bff.example.test/api/v1",
  );
});

test("Production validates the Storefront configuration before accepting requests", () => {
  assert.match(instrumentationSource, /export function register/);
  assert.match(instrumentationSource, /process\.env\.NODE_ENV !== "production"/);
  assert.match(instrumentationSource, /getStorefrontBffBaseUrl\(\)/);
  assert.doesNotMatch(instrumentationSource, /getStorefrontRuntimeContext\(\)/);

  const startup = loadModule("instrumentation.ts", {
    "./src/shared/config/storefront-env": {
      getStorefrontBffBaseUrl: () => { throw new Error("missing Storefront BFF URL"); },
    },
  }, { process: { env: { NODE_ENV: "production" } } });

  assert.throws(() => startup.register(), /missing Storefront BFF URL/);
});

test("Customer sessions cannot cross the active Storefront tenant", () => {
  const customerSession = loadModule("src/modules/storefront/storefront-customer-session.ts", {
    "next/headers": { cookies: async () => ({}) },
    "./storefront-context": { getStorefrontContext: () => ({ organizationId: "org-1", shopId: "shop-1" }) },
  });
  const session = { organizationId: "org-1", shopId: "shop-1" };

  assert.equal(customerSession.isStorefrontCustomerSessionForContext(session, session), true);
  assert.equal(
    customerSession.isStorefrontCustomerSessionForContext(session, { organizationId: "org-2", shopId: "shop-1" }),
    false,
  );
  assert.equal(
    customerSession.isStorefrontCustomerSessionForContext({ organizationId: undefined, shopId: "shop-1" }, session),
    false,
  );
});
