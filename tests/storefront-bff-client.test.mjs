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
    Headers,
    Response,
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

const headersSource = readFileSync(new URL("../src/shared/bff/headers.ts", import.meta.url), "utf8");
const requestClientSource = readFileSync(new URL("../src/shared/bff/request-client.ts", import.meta.url), "utf8");
const storefrontClientSource = readFileSync(new URL("../src/shared/bff/storefront-client.ts", import.meta.url), "utf8");
const envSource = readFileSync(new URL("../src/shared/config/env.ts", import.meta.url), "utf8");

test("Storefront has an explicit BFF destination with the local 3025 fallback", () => {
  const env = loadModule(envSource, {}, { process: { env: {} } });

  assert.equal(env.storefrontBffBaseUrl, "http://localhost:3025/api/v1");
  assert.match(storefrontClientSource, /storefrontBffBaseUrl/);
  assert.doesNotMatch(storefrontClientSource, /adminBffToken|getAdminAuthorizationToken|getAdminRequestAuthorizationToken/);
});

test("Storefront request client uses its supplied target without injecting authorization", async () => {
  const headers = loadModule(headersSource);
  let requestUrl = "";
  let requestHeaders;
  const requestClient = loadModule(
    requestClientSource,
    { "./headers": headers },
    {
      fetch: async (url, init) => {
        requestUrl = String(url);
        requestHeaders = new Headers(init.headers);
        return Response.json({ source: "storefront" });
      },
    },
  );

  const result = await requestClient.requestBffAt(
    "http://storefront.test:3025/api/v1/",
    "/storefront/page?path=%2F",
    { context: { locale: "es-ES" } },
  );

  assert.equal(requestUrl, "http://storefront.test:3025/api/v1/storefront/page?path=%2F");
  assert.equal(requestHeaders.get("authorization"), null);
  assert.equal(requestHeaders.get("x-locale"), "es-ES");
  assert.equal(result.ok, true);
});

test("Storefront raw-response client preserves non-JSON Accept headers", async () => {
  const headers = loadModule(headersSource);
  let requestUrl = "";
  let requestHeaders;
  const requestClient = loadModule(
    requestClientSource,
    { "./headers": headers },
    {
      fetch: async (url, init) => {
        requestUrl = String(url);
        requestHeaders = new Headers(init.headers);
        return new Response("%PDF-1.4", {
          status: 200,
          headers: { "content-type": "application/pdf" },
        });
      },
    },
  );

  const result = await requestClient.requestBffResponseAt(
    "http://storefront.test:3025/api/v1",
    "/storefront/me/invoices/invoice-1/document",
    {
      init: {
        headers: { accept: "application/pdf" },
      },
    },
  );

  assert.equal(requestUrl, "http://storefront.test:3025/api/v1/storefront/me/invoices/invoice-1/document");
  assert.equal(requestHeaders.get("accept"), "application/pdf");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.headers.get("content-type"), "application/pdf");
  }
});

test("Storefront wrapper does not receive an Admin token parameter", () => {
  assert.match(storefrontClientSource, /requestBffAt\(storefrontBffBaseUrl, path, options\)/);
  assert.match(storefrontClientSource, /requestBffResponseAt\(storefrontBffBaseUrl, path, options\)/);
});

test("migrated Storefront readers, actions and technical handlers use the explicit client", () => {
  const consumers = [
    "src/modules/storefront/order-tracking.ts",
    "src/modules/storefront/pdp.ts",
    "src/modules/storefront/plp.ts",
    "src/modules/storefront/public-page.ts",
    "src/modules/storefront/public-path.ts",
    "src/modules/storefront/storefront-account.ts",
    "src/modules/storefront/storefront-auth-actions.ts",
    "src/modules/catalogo/product-storefront-preview.ts",
    "app/api/storefront/cart/items/route.ts",
    "app/api/storefront/cart/offerings/route.ts",
    "app/api/storefront/cart/route.ts",
    "app/api/storefront/checkout/context/route.ts",
    "app/api/storefront/checkout/route.ts",
    "app/api/storefront/me/addresses/route.ts",
    "app/api/storefront/orders/[orderId]/tracking-link/route.ts",
    "app/api/storefront/payments/payment-systems/route.ts",
    "app/api/storefront/payments/transactions/route.ts",
    "app/api/storefront/payments/transactions/[transactionId]/route.ts",
    "app/api/storefront/payments/transactions/[transactionId]/[provider]/complete-return/route.ts",
    "app/api/storefront/search/events/route.ts",
  ];

  for (const relativePath of consumers) {
    const consumer = source(relativePath);
    assert.match(consumer, /shared\/bff\/storefront-client/);
    assert.match(consumer, /requestStorefrontBff/);
    assert.doesNotMatch(consumer, /shared\/bff\/client/);
  }

  const accountSource = source("src/modules/storefront/storefront-account.ts");
  assert.match(accountSource, /requestStorefrontBffResponse/);
  assert.doesNotMatch(accountSource, /storefrontBffBaseUrl|makeAuthUrl\(|fetch\(/);

  const invoiceRoute = source("app/account/invoices/[invoiceId]/document/route.ts");
  assert.match(invoiceRoute, /requestStorefrontBffResponse/);
  assert.doesNotMatch(invoiceRoute, /storefrontBffBaseUrl|shared\/bff\/client|\bbffBaseUrl\b|fetch\(/);
});

test("Storefront E2E fixtures isolate the dedicated BFF destination", () => {
  for (const relativePath of [
    "tests/e2e/storefront-public-routing.spec.ts",
    "tests/e2e/storefront-guest-tracking.spec.ts",
    "tests/e2e/storefront-address-book.spec.ts",
  ]) {
    const fixture = source(relativePath);
    assert.match(fixture, /ECOMMIUM_STOREFRONT_BFF_BASE_URL/);
    assert.match(fixture, /ECOMMIUM_BFF_BASE_URL: "http:\/\/127\.0\.0\.1:1\/api\/v1"/);
  }
});
