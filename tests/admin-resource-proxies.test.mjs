import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const context = {
  organizationId: "org-1",
  shopId: "shop-1",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

function loadRoute(relativePath, { requireAdminRouteAccess, requestAdminBffResponseAsEmployee }) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const outputText = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJsExports = {};
  const moduleContext = {
    Buffer,
    Headers,
    Response,
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/admin-client")) return { requestAdminBffResponseAsEmployee };
      if (specifier.endsWith("/shared/auth/require-admin-route-access")) return { requireAdminRouteAccess };
      if (specifier.endsWith("/shared/security/media-upload")) return {
        maximumMediaBytes: 8 * 1024 * 1024,
        isSafeInlineMediaType: (contentType) => contentType === "image/png" ? "image/png" : undefined,
      };
      if (specifier.endsWith("/shared/invoice/invoice-document-pdf")) return {
        invoicePdfFilename: () => "invoice.pdf",
        renderInvoiceDocumentPdf: () => Buffer.from("pdf"),
      };
      if (specifier === "next/server") return {};
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  };
  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

for (const fixture of [
  {
    name: "media",
    file: "app/api/admin/media-assets/[mediaAssetId]/content/route.ts",
    permission: "media.assets.write",
    params: { mediaAssetId: "asset-1" },
    request: { nextUrl: new URL("http://ui.test/api/admin/media-assets/asset-1/content?variant=original") },
  },
  {
    name: "invoice",
    file: "app/(admin)/admin/pagos/invoices/[invoiceId]/document/route.ts",
    permission: "invoices.manage",
    params: { invoiceId: "invoice-1" },
    request: { nextUrl: new URL("http://ui.test/admin/pagos/invoices/invoice-1/document") },
  },
]) {
  test(`Admin ${fixture.name} proxy rejects unauthenticated direct requests before BFF access`, async () => {
    let proxied = false;
    const route = loadRoute(fixture.file, {
      requireAdminRouteAccess: async (permission) => {
        assert.equal(permission, fixture.permission);
        return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
      },
      requestAdminBffResponseAsEmployee: async () => {
        proxied = true;
        return { ok: true, data: new Response("unexpected") };
      },
    });

    const response = await route.GET(fixture.request, { params: Promise.resolve(fixture.params) });
    assert.equal(response.status, 401);
    assert.equal(proxied, false);
  });

  test(`Admin ${fixture.name} proxy sends only the validated employee bearer and authorized tenant`, async () => {
    const calls = [];
    const route = loadRoute(fixture.file, {
      requireAdminRouteAccess: async () => ({
        ok: true,
        data: { accessToken: "employee-token", context, employeeId: "employee-1" },
      }),
      requestAdminBffResponseAsEmployee: async (...args) => {
        calls.push(args);
        return {
          ok: true,
          data: fixture.name === "invoice"
            ? new Response(JSON.stringify({ html: "<p>Factura</p>" }), { headers: { "content-type": "application/json" } })
            : new Response("image", { headers: { "content-type": "image/png" } }),
        };
      },
    });

    const response = await route.GET(fixture.request, { params: Promise.resolve(fixture.params) });
    assert.equal(response.status, 200);
    assert.equal(calls[0][1], "employee-token");
    assert.match(calls[0][0], /organizationId=org-1/);
    assert.match(calls[0][0], /shopId=shop-1/);
  });
}

test("Admin media proxy forces unknown content to download and prevents MIME sniffing", async () => {
  const route = loadRoute("app/api/admin/media-assets/[mediaAssetId]/content/route.ts", {
    requireAdminRouteAccess: async () => ({ ok: true, data: { accessToken: "employee-token", context, employeeId: "employee-1" } }),
    requestAdminBffResponseAsEmployee: async () => ({ ok: true, data: new Response("<svg onload=alert(1) />", { headers: { "content-type": "image/svg+xml" } }) }),
  });

  const response = await route.GET(
    { nextUrl: new URL("http://ui.test/api/admin/media-assets/asset-1/content") },
    { params: Promise.resolve({ mediaAssetId: "asset-1" }) },
  );
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-disposition"), /^attachment/);
});
