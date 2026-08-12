import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("global security headers disable framing, sniffing and platform disclosure", () => {
  const config = source("next.config.ts");
  assert.match(config, /poweredByHeader:\s*false/);
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /Referrer-Policy/);
  assert.match(config, /Permissions-Policy/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /challenges\.cloudflare\.com/);
  assert.match(config, /NODE_ENV !== "production"/);
  assert.match(config, /isDevelopment \? \["'unsafe-eval'"\]/);
});

test("BFF calls are bounded and public proxy requests cannot have unbounded paths", () => {
  const requestClient = source("src/shared/bff/request-client.ts");
  const proxy = source("proxy.ts");
  assert.match(requestClient, /bffRequestTimeoutMs = 15_000/);
  assert.match(requestClient, /AbortSignal\.timeout/);
  assert.match(requestClient, /AbortSignal\.any/);
  assert.match(proxy, /maximumPublicPathLength = 2048/);
  assert.match(proxy, /maximumPublicQueryLength = 2048/);
  assert.match(proxy, /maximumPublicPathSegments = 12/);
});

test("invoice proxies limit responses before rendering or returning them", () => {
  for (const route of [
    "app/(admin)/admin/pagos/invoices/[invoiceId]/document/route.ts",
    "app/account/invoices/[invoiceId]/document/route.ts",
  ]) {
    const handler = source(route);
    assert.match(handler, /maximumInvoiceDocumentBytes/);
    assert.match(handler, /content\.byteLength > maximumInvoiceDocumentBytes/);
    assert.match(handler, /x-content-type-options/);
  }
});

test("supply chain uses a pinned package manager and a production audit workflow", () => {
  const manifest = JSON.parse(source("package.json"));
  const workflow = source(".github/workflows/supply-chain.yml");
  assert.equal(manifest.packageManager, "npm@10.9.2");
  assert.match(manifest.engines.node, /^>=20\.19\.0/);
  assert.equal(manifest.scripts["audit:production"], "npm audit --omit=dev --audit-level=high");
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run audit:production/);
});
