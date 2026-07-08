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

function loadOrdersAdminModule(requestBff) {
  const source = readFileSync(path.resolve(root, "src/modules/pedidos/orders-admin.ts"), "utf8");
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
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
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

function loadOrdersActionsModule({
  requestBff,
  getAdminContext = async () => context,
  getAdminSession = async () => ({ employeeId: "employee-1", scope: "admin", permissions: ["admin:*"] }),
  revalidatePath = () => undefined,
  redirect = (url) => {
    throw Object.assign(new Error("redirect"), { url });
  },
}) {
  const source = readFileSync(path.resolve(root, "src/modules/pedidos/orders-admin-actions.ts"), "utf8");
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
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
      }
      if (specifier.endsWith("/shared/auth/session")) {
        return { getAdminSession };
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

test("orders admin route replaces placeholder with operative module", () => {
  const routeSource = readFileSync(path.resolve(root, "app/(admin)/admin/pedidos/page.tsx"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "src/modules/pedidos/orders-admin-page.tsx"), "utf8");
  const dataSource = readFileSync(path.resolve(root, "src/modules/pedidos/orders-admin.ts"), "utf8");

  assert.match(routeSource, /getOrdersAdminData/);
  assert.match(routeSource, /getOrdersAdminCapabilities/);
  assert.match(routeSource, /OrdersAdminPage/);
  assert.doesNotMatch(routeSource, /Modulo pendiente de implementar/);
  assert.match(pageSource, /Centro operativo para pedido, pago, shipping, facturas y postventa/);
  assert.match(pageSource, /Preview plantilla factura/);
  assert.match(pageSource, /Bandeja postventa/);
  assert.match(pageSource, /assignAfterSalesCaseAction/);
  assert.match(pageSource, /issueOrderInvoiceAction/);
  assert.match(pageSource, /createInvoiceAdjustmentAction/);
  assert.match(pageSource, /Nota de credito/);
  assert.match(pageSource, /\/admin\/pagos\?invoiceId=/);
  assert.match(pageSource, /\/admin\/pagos\/invoices\/.*\/document/);
  assert.match(pageSource, /\/admin\/postventa\?caseId=/);
  assert.match(pageSource, /Atender caso/);
  assert.match(pageSource, /Auditoria del pedido/);
  assert.match(pageSource, /OrderAuditTimelinePanel/);
  assert.match(pageSource, /Paginacion de pedidos/);
  assert.match(pageSource, /Anterior/);
  assert.match(pageSource, /Siguiente/);
  assert.match(dataSource, /\/admin\/orders/);
  assert.match(dataSource, /\/admin\/invoices\/document-template\/preview/);
  assert.match(dataSource, /\/admin\/after-sales\/cases/);
  assert.match(dataSource, /buildOrderAuditTimeline/);
  assert.match(dataSource, /PAYMENT_STATUS/);
  assert.match(dataSource, /INVOICE_ADJUSTMENT/);
  assert.match(dataSource, /COMPOSITION_WARNING/);
});

test("orders admin capabilities map order invoice and after-sales permissions", () => {
  const { getOrdersAdminCapabilities } = loadOrdersAdminModule(async () => ({ ok: true, data: {} }));
  const empty = getOrdersAdminCapabilities(null);
  const reader = getOrdersAdminCapabilities({ scope: "admin", permissions: ["orders.read"] });
  const manager = getOrdersAdminCapabilities({ scope: "admin", permissions: ["orders.read", "invoices.manage", "after-sales.manage"] });

  assert.equal(empty.canReadOrders, false);
  assert.equal(reader.canReadOrders, true);
  assert.equal(reader.canManageInvoices, false);
  assert.equal(reader.canManageAfterSales, false);
  assert.equal(manager.canReadOrders, true);
  assert.equal(manager.canManageInvoices, true);
  assert.equal(manager.canManageAfterSales, true);
});

test("orders admin loads list detail invoice preview and after-sales through BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    const raw = pathValue.includes("/admin/orders/order-1?")
      ? {
          order: {
            orderId: "order-1",
            customerId: "customer-1",
            status: "PAID",
            totalAmountMinor: 1234,
            currency: "EUR",
            createdAt: "2026-07-07T09:00:00.000Z",
          },
          payment: {
            transactionId: "tx-1",
            transaction: { status: "SETTLED", provider: "stripe", updatedAt: "2026-07-07T09:05:00.000Z" },
          },
          shipping: {
            fulfillment: { status: "READY", carrierName: "DHL", trackingNumber: "TRACK-1", updatedAt: "2026-07-07T09:10:00.000Z" },
          },
          invoice: {
            items: [
              {
                invoiceId: "invoice-1",
                invoiceNumber: "FAC-1",
                status: "ISSUED",
                issuedAt: "2026-07-07T09:15:00.000Z",
                adjustments: [
                  {
                    adjustmentId: "adjustment-1",
                    adjustmentType: "CREDIT_NOTE",
                    amountMinor: 1299,
                    currency: "EUR",
                    issuedAt: "2026-07-07T09:20:00.000Z",
                  },
                ],
              },
            ],
            total: 1,
            limit: 20,
            offset: 0,
          },
          afterSales: {
            items: [
              { caseId: "case-1", status: "OPEN", assignedEmployeeId: "employee-1", createdAt: "2026-07-07T09:25:00.000Z" },
            ],
            total: 1,
            limit: 20,
            offset: 0,
          },
          warnings: [{ section: "payment", message: "partial" }],
          generatedAt: "2026-07-07T09:30:00.000Z",
        }
      : pathValue.includes("/document-template/preview")
        ? { html: "<html>Factura</html>", generatedAt: "2026-07-07T10:00:00.000Z" }
        : pathValue.includes("/after-sales/cases")
          ? { items: [{ caseId: "case-1", orderId: "order-1", assignedEmployeeId: "employee-1" }], total: 1, limit: 10, offset: 0 }
          : { items: [{ orderId: "order-1", customerId: "customer-1", totalAmountMinor: 1234, currency: "EUR" }], total: 1, limit: 25, offset: 0 };

    return { ok: true, data: options.parse ? options.parse(raw) : raw, status: 200, correlationId: "corr-orders" };
  };
  const { getOrdersAdminData } = loadOrdersAdminModule(requestBff);
  const { buildOrderAuditTimeline } = loadOrdersAdminModule(requestBff);
  const capabilities = { canReadOrders: true, canManageInvoices: true, canManageAfterSales: true };

  const data = await getOrdersAdminData(context, { orderId: "order-1", customerId: "customer-1" }, capabilities);
  const timeline = buildOrderAuditTimeline(data.selectedOrder.data);

  assert.equal(data.orders.data.items[0].orderId, "order-1");
  assert.equal(data.selectedOrder.data.payment.status, "SETTLED");
  assert.equal(data.selectedOrder.data.shipping.trackingNumber, "TRACK-1");
  assert.equal(data.selectedOrder.data.invoice.invoiceId, "invoice-1");
  assert.equal(data.selectedOrder.data.afterSales.caseId, "case-1");
  assert.equal(data.invoicePreview.data.html, "<html>Factura</html>");
  assert.equal(data.afterSalesCases.data.items[0].assignedEmployeeId, "employee-1");
  assert.equal(timeline[0].eventType, "COMPOSITION_WARNING");
  assert.equal(timeline.some((event) => event.eventType === "PAYMENT_STATUS" && event.referenceId === "tx-1"), true);
  assert.equal(timeline.some((event) => event.eventType === "INVOICE_ADJUSTMENT" && event.referenceId === "adjustment-1"), true);
  assert.equal(timeline.some((event) => event.eventType === "AFTER_SALES_CASE" && event.referenceId === "case-1"), true);
  assert.deepEqual(calls.map((call) => call.path), [
    "/admin/orders?organizationId=org-1&shopId=shop-1&customerId=customer-1&limit=25&offset=0",
    "/admin/orders/order-1?organizationId=org-1&shopId=shop-1",
    "/admin/invoices/document-template/preview?organizationId=org-1&shopId=shop-1&currency=EUR",
    "/admin/after-sales/cases?organizationId=org-1&shopId=shop-1&orderId=order-1&customerId=customer-1&limit=10&offset=0",
  ]);
});

test("orders admin actions assign after-sales, issue invoice and create fiscal adjustments through scoped BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-orders" };
  };
  const { assignAfterSalesCaseAction, createInvoiceAdjustmentAction, issueOrderInvoiceAction } = loadOrdersActionsModule({ requestBff });
  const formData = new FormData();
  formData.set("caseId", "case-1");
  formData.set("orderId", "order-1");
  formData.set("assignedEmployeeId", "employee-2");
  formData.set("invoiceId", "invoice-1");
  formData.set("adjustmentType", "CREDIT_NOTE");
  formData.set("amountMinor", "1299");
  formData.set("currency", "EUR");
  formData.set("reason", "Devolucion parcial");

  await assert.rejects(() => assignAfterSalesCaseAction(formData), { url: "/admin/pedidos?notice=Caso+postventa+asignado.&orderId=order-1" });
  await assert.rejects(() => issueOrderInvoiceAction(formData), { url: "/admin/pedidos?notice=Factura+solicitada.&orderId=order-1" });
  await assert.rejects(() => createInvoiceAdjustmentAction(formData), { url: "/admin/pedidos?notice=Ajuste+fiscal+solicitado.&orderId=order-1" });

  assert.deepEqual(calls, [
    {
      path: "/admin/after-sales/cases/case-1/assignment?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
      body: {
        assignedEmployeeId: "employee-2",
        assignedBy: "employee-1",
      },
    },
    {
      path: "/admin/invoices/issue?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: {
        orderId: "order-1",
        idempotencyKey: "admin-order-invoice-order-1",
      },
    },
    {
      path: "/admin/invoices/adjustments?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: {
        orderId: "order-1",
        invoiceId: "invoice-1",
        source: "admin-ui",
        idempotencyKey: "admin-invoice-adjustment-invoice-1-CREDIT_NOTE-1299",
        adjustmentType: "CREDIT_NOTE",
        amountMinor: 1299,
        currency: "EUR",
        reason: "Devolucion parcial",
      },
    },
  ]);
});
