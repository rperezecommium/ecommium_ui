import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

const context = {
  organizationId: "org-1",
  shopId: "shop-1",
  shopAlias: "shop",
  shopName: "Shop",
  primaryDomain: "shop.test",
  shopStatus: "ACTIVE",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

function loadInvoicesAdminModule(requestAdminBff) {
  const source = readFileSync(path.resolve(root, "src/modules/pagos/invoices-admin.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/admin-client")) {
        return { requestAdminBff };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return {
          hasRequiredAdminContext(value) {
            return Boolean(value.organizationId && value.shopId);
          },
        };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function loadInvoicesActionsModule({
  requestAdminBff,
  getAdminContext = async () => context,
  revalidatePath = () => undefined,
  redirect = (url) => {
    throw Object.assign(new Error("redirect"), { url });
  },
}) {
  const source = readFileSync(path.resolve(root, "src/modules/pagos/invoices-admin-actions.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    FormData,
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier === "next/cache") {
        return { revalidatePath };
      }
      if (specifier === "next/navigation") {
        return { redirect };
      }
      if (specifier.endsWith("/shared/bff/admin-client")) {
        return { requestAdminBff };
      }
      if (specifier.endsWith("/shared/config/admin-context")) {
        return { getAdminContext };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

test("invoices admin replaces pagos placeholder and exposes fiscal navigation", () => {
  const routeSource = readFileSync(path.resolve(root, "app/(admin)/admin/pagos/page.tsx"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "src/modules/pagos/invoices-admin-page.tsx"), "utf8");
  const dataSource = readFileSync(path.resolve(root, "src/modules/pagos/invoices-admin.ts"), "utf8");
  const actionsSource = readFileSync(path.resolve(root, "src/modules/pagos/invoices-admin-actions.ts"), "utf8");
  const permissionsSource = readFileSync(path.resolve(root, "src/shared/permissions/permissions.ts"), "utf8");
  const documentRouteSource = readFileSync(path.resolve(root, "app/(admin)/admin/pagos/invoices/[invoiceId]/document/route.ts"), "utf8");
  const detailRouteSource = readFileSync(path.resolve(root, "app/(admin)/admin/pagos/facturas/[invoiceId]/page.tsx"), "utf8");

  assert.match(routeSource, /getInvoiceAdminData/);
  assert.match(routeSource, /getPaymentsAdminData/);
  assert.match(routeSource, /PaymentsAdminPage/);
  assert.doesNotMatch(routeSource, /Modulo pendiente de implementar/);
  assert.match(readFileSync(path.resolve(root, "src/modules/pagos/payments-admin-page.tsx"), "utf8"), /<InvoicesAdminPage capabilities=\{invoiceCapabilities\} data=\{invoiceData\} embedded filters=\{invoiceFilters\}/);
  assert.match(pageSource, /Abrir factura/);
  assert.match(pageSource, /Resumen fiscal/);
  assert.match(pageSource, /Rectificación fiscal/);
  assert.match(pageSource, /invoiceDetailHref/);
  assert.doesNotMatch(pageSource, /adminCodePreview/);
  assert.match(pageSource, /createFiscalInvoiceAdjustmentAction/);
  assert.match(dataSource, /\/admin\/invoices/);
  assert.match(actionsSource, /\/admin\/invoices\/adjustments/);
  assert.match(permissionsSource, /invoices\.manage/);
  assert.match(documentRouteSource, /\/admin\/invoices\/.*\/document/);
  assert.match(documentRouteSource, /renderInvoiceDocumentPdf/);
  assert.match(documentRouteSource, /application\/pdf/);
  assert.match(detailRouteSource, /getInvoiceAdminData/);
  assert.match(detailRouteSource, /InvoiceDetailAdminPage/);
});

test("invoices admin capabilities map fiscal permissions", () => {
  const { getInvoiceAdminCapabilities } = loadInvoicesAdminModule(async () => ({ ok: true, data: {} }));

  assert.equal(getInvoiceAdminCapabilities(null).canManageInvoices, false);
  assert.equal(getInvoiceAdminCapabilities({ scope: "admin", permissions: ["invoices.manage"] }).canManageInvoices, true);
  assert.equal(getInvoiceAdminCapabilities({ scope: "admin", permissions: ["invoice.manage"] }).canManageInvoices, true);
  assert.equal(getInvoiceAdminCapabilities({ scope: "storefront", permissions: ["invoices.manage"] }).canManageInvoices, false);
});

test("invoices admin loads the commercial list and selected detail through BFF", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    const raw = pathValue.includes("/admin/invoices/invoice-1?")
      ? { invoiceId: "invoice-1", orderId: "order-1", status: "ISSUED", currency: "EUR", totalMinor: 1234, lines: [{ lineId: "line-1", name: "Producto" }] }
      : { items: [{ invoiceId: "invoice-1", orderId: "order-1", status: "ISSUED", currency: "EUR", totalMinor: 1234 }], total: 1, limit: 25, offset: 0 };

    return { ok: true, data: options.parse ? options.parse(raw) : raw, status: 200, correlationId: "corr-invoices" };
  };
  const { getInvoiceAdminData } = loadInvoicesAdminModule(requestAdminBff);
  const capabilities = { canManageInvoices: true };

  const data = await getInvoiceAdminData(context, { invoiceId: "invoice-1", orderId: "order-1", status: "ISSUED" }, capabilities);

  assert.equal(data.invoices.data.items[0].invoiceId, "invoice-1");
  assert.equal(data.selectedInvoice.data.lines[0].name, "Producto");
  assert.deepEqual(calls.map((call) => call.path), [
    "/admin/invoices?organizationId=org-1&shopId=shop-1&orderId=order-1&status=ISSUED&limit=25&offset=0",
    "/admin/invoices/invoice-1?organizationId=org-1&shopId=shop-1",
  ]);
});

test("invoices admin actions issue invoices and create fiscal adjustments through scoped BFF", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-invoices" };
  };
  const { createFiscalInvoiceAdjustmentAction, issueInvoiceFromFiscalConsoleAction } = loadInvoicesActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("orderId", "order-1");
  formData.set("invoiceId", "invoice-1");
  formData.set("adjustmentType", "CREDIT_NOTE");
  formData.set("amountMinor", "1299");
  formData.set("currency", "EUR");
  formData.set("reason", "Devolucion parcial");

  await assert.rejects(() => issueInvoiceFromFiscalConsoleAction(formData), { url: "/admin/pagos?tab=facturas&notice=Factura+solicitada." });
  await assert.rejects(() => createFiscalInvoiceAdjustmentAction(formData), { url: "/admin/pagos?tab=facturas&notice=Nota+o+ajuste+fiscal+solicitado.&invoiceId=invoice-1" });

  formData.set("returnTo", "/admin/pagos/facturas/invoice-1?discarded=true");
  await assert.rejects(() => createFiscalInvoiceAdjustmentAction(formData), { url: "/admin/pagos/facturas/invoice-1?notice=Nota+o+ajuste+fiscal+solicitado." });

  assert.deepEqual(calls, [
    {
      path: "/admin/invoices/issue?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: {
        orderId: "order-1",
        idempotencyKey: "admin-fiscal-console-invoice-order-1",
      },
    },
    {
      path: "/admin/invoices/adjustments?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: {
        orderId: "order-1",
        invoiceId: "invoice-1",
        source: "admin-fiscal-console",
        idempotencyKey: "admin-fiscal-adjustment-invoice-1-CREDIT_NOTE-1299",
        adjustmentType: "CREDIT_NOTE",
        amountMinor: 1299,
        currency: "EUR",
        reason: "Devolucion parcial",
      },
    },
    {
      path: "/admin/invoices/adjustments?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: {
        orderId: "order-1",
        invoiceId: "invoice-1",
        source: "admin-fiscal-console",
        idempotencyKey: "admin-fiscal-adjustment-invoice-1-CREDIT_NOTE-1299",
        adjustmentType: "CREDIT_NOTE",
        amountMinor: 1299,
        currency: "EUR",
        reason: "Devolucion parcial",
      },
    },
  ]);
});
