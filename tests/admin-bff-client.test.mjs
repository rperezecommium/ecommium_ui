import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function loadModule(source, dependencies = {}, globals = {}) {
  const commonJsExports = {};
  const context = {
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(path) {
      if (!(path in dependencies)) {
        throw new Error(`Unexpected dependency: ${path}`);
      }
      return dependencies[path];
    },
    ...globals,
  };

  vm.runInNewContext(transpile(source), context);
  return context.module.exports;
}

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const envSource = source("src/shared/config/env.ts");
const adminClientSource = source("src/shared/bff/admin-client.ts");

test("Admin has a dedicated StoreAdmin URL with the local 3026 fallback", () => {
  const env = loadModule(envSource, {}, { process: { env: {} } });

  assert.equal(env.adminBffBaseUrl, "http://localhost:3026/api/v1");
  assert.doesNotMatch(envSource, /ECOMMIUM_BFF_BASE_URL|localhost:3010/);
  assert.match(adminClientSource, /requestAdminBff/);
  assert.match(adminClientSource, /adminBffBaseUrl/);
  assert.doesNotMatch(adminClientSource, /storefrontBffBaseUrl/);
});

test("Admin JSON and raw-response clients keep the StoreAdmin destination and session resolution", async () => {
  const calls = [];
  const client = loadModule(adminClientSource, {
    "../config/env": {
      adminBffBaseUrl: "http://admin.test:3026/api/v1",
    },
    "../auth/admin-request-session": {
      getAdminRequestAuthorizationToken: () => "request-session-token",
    },
    "../auth/session": {
      getAdminAuthorizationToken: async () => "cookie-token",
    },
    "./request-client": {
      requestBffAt: async (...args) => {
        calls.push({ kind: "json", args });
        return { ok: true, data: { source: "admin" }, status: 200, correlationId: "corr-json" };
      },
      requestBffResponseAt: async (...args) => {
        calls.push({ kind: "raw", args });
        return { ok: true, data: new Response("pdf"), status: 200, correlationId: "corr-raw" };
      },
    },
  }, { Response });

  await client.requestAdminBff("/admin/context/available");
  await client.requestAdminBffResponse("/admin/invoices/invoice-1/document", {
    context: { locale: "es-ES" },
    init: { headers: { accept: "application/pdf" } },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].kind, "json");
  assert.equal(calls[0].args[0], "http://admin.test:3026/api/v1");
  assert.equal(calls[0].args[1], "/admin/context/available");
  assert.equal(calls[0].args[3], "request-session-token");
  assert.equal(calls[1].kind, "raw");
  assert.equal(calls[1].args[0], "http://admin.test:3026/api/v1");
  assert.equal(calls[1].args[1], "/admin/invoices/invoice-1/document");
  assert.equal(calls[1].args[3], "request-session-token");
});

test("Admin private-resource client uses the validated employee bearer and never the technical fallback", async () => {
  const calls = [];
  const client = loadModule(adminClientSource, {
    "../config/env": { adminBffBaseUrl: "http://admin.test:3026/api/v1" },
    "../auth/admin-request-session": { getAdminRequestAuthorizationToken: () => undefined },
    "../auth/session": { getAdminAuthorizationToken: async () => undefined },
    "./request-client": {
      requestBffAt: async () => ({ ok: true, data: {}, status: 200 }),
      requestBffResponseAt: async (...args) => {
        calls.push(args);
        return { ok: true, data: new Response("document"), status: 200, correlationId: "corr" };
      },
    },
  }, { Response, Headers });

  await client.requestAdminBffResponseAsEmployee("/admin/invoices/invoice-1/document", "employee-token");

  assert.equal(calls[0][3], undefined);
  assert.equal(calls[0][2].withAuth, false);
  assert.equal(calls[0][2].init.headers.get("authorization"), "Bearer employee-token");
});

test("Admin binary proxies delegate URL, authentication and fetch to the explicit client", () => {
  for (const relativePath of [
    "app/api/admin/media-assets/[mediaAssetId]/content/route.ts",
    "app/(admin)/admin/pagos/invoices/[invoiceId]/document/route.ts",
  ]) {
    const handler = source(relativePath);
    assert.match(handler, /requireAdminRouteAccess/);
    assert.match(handler, /requestAdminBffResponseAsEmployee/);
    assert.doesNotMatch(handler, /adminBffToken|getAdminAuthorizationToken/);
    assert.doesNotMatch(handler, /\bfetch\(|adminBffBaseUrl|adminBffToken|getAdminAuthorizationToken|createBffHeaders/);
  }
});

test("Admin client cannot fall back to a technical bearer", () => {
  assert.doesNotMatch(adminClientSource, /adminBffToken|ECOMMIUM_ADMIN_BFF_TOKEN/);
});

test("Admin and Storefront E2E fixtures configure distinct BFF URLs", () => {
  for (const relativePath of [
    "tests/e2e/admin-login.spec.ts",
    "tests/e2e/checkout-configuration.spec.ts",
  ]) {
    assert.match(source(relativePath), /ECOMMIUM_ADMIN_BFF_BASE_URL/);
  }

  for (const relativePath of [
    "tests/e2e/storefront-public-routing.spec.ts",
    "tests/e2e/storefront-guest-tracking.spec.ts",
    "tests/e2e/storefront-address-book.spec.ts",
  ]) {
    const fixture = source(relativePath);
    assert.match(fixture, /ECOMMIUM_STOREFRONT_BFF_BASE_URL/);
    assert.match(fixture, /ECOMMIUM_ADMIN_BFF_BASE_URL: "http:\/\/127\.0\.0\.1:1\/api\/v1"/);
  }
});
