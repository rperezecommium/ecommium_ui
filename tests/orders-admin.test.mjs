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

function loadOrdersAdminModule(requestAdminBff) {
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

function loadOrdersActionsModule({
  requestAdminBff,
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
      if (specifier.endsWith("/shared/bff/admin-client")) {
        return { requestAdminBff };
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
  assert.match(routeSource, /noticeKind/);
  assert.match(routeSource, /orderTab/);
  assert.match(routeSource, /OrdersAdminPage/);
  assert.doesNotMatch(routeSource, /Modulo pendiente de implementar/);
  assert.match(pageSource, /Gestiona cada parte del pedido en su contexto/);
  assert.match(pageSource, /noticeBannerClass/);
  assert.match(pageSource, /adminBannerSuccess/);
  assert.doesNotMatch(pageSource, /Preview plantilla factura/);
  assert.doesNotMatch(pageSource, /Bandeja postventa/);
  assert.match(pageSource, /assignAfterSalesCaseAction/);
  assert.match(pageSource, /issueOrderInvoiceAction/);
  assert.match(pageSource, /createInvoiceAdjustmentAction/);
  assert.match(pageSource, /transitionFulfillmentStatusAction/);
  assert.match(pageSource, /createOrderFulfillmentAction/);
  assert.match(pageSource, /Gestionar reembolso en Postventa/);
  assert.match(pageSource, /Un reembolso devuelve dinero al cliente/);
  assert.match(pageSource, /Nota de credito/);
  assert.match(pageSource, /\/admin\/pagos\?invoiceId=/);
  assert.match(pageSource, /\/admin\/pagos\/invoices\/.*\/document/);
  assert.match(pageSource, /\/admin\/postventa\?caseId=/);
  assert.match(pageSource, /Atender caso/);
  assert.match(pageSource, /Auditoria del pedido/);
  assert.match(pageSource, /OrderAuditTimelinePanel/);
  assert.match(pageSource, /orderShortReference/);
  assert.match(pageSource, /customerLabel/);
  assert.match(pageSource, /Invitado/);
  assert.doesNotMatch(pageSource, /<td>\{valueText\(order\.customerId\)\}<\/td>/);
  assert.match(pageSource, /orderNextStep/);
  assert.match(pageSource, /isOrderPaid/);
  assert.match(pageSource, /orderStatus === "PAYMENT_SETTLED"/);
  assert.match(pageSource, /Pago confirmado/);
  assert.match(pageSource, /orderPaymentLabel/);
  assert.match(pageSource, /ID interno/);
  assert.match(pageSource, /OrderDetailDrawer/);
  assert.match(pageSource, /OrderDrawerSummary/);
  assert.match(pageSource, /Resumen operativo/);
  assert.match(pageSource, /Bloqueos/);
  assert.match(pageSource, /Avisos/);
  assert.match(pageSource, /OrderDrawerTabs/);
  assert.match(pageSource, /activeOrderDrawerTab/);
  assert.match(pageSource, /orderDrawerTabs/);
  assert.match(pageSource, /Secciones del pedido/);
  assert.match(pageSource, /orderTab: "operacion"/);
  assert.match(pageSource, /orderTab: undefined/);
  assert.match(pageSource, /ordersDrawerBackdrop/);
  assert.match(pageSource, /ordersSideDrawer/);
  assert.match(pageSource, /Cerrar panel de pedido/);
  assert.match(pageSource, /aria-modal="true"/);
  assert.match(pageSource, /Documentos fiscales/);
  assert.match(pageSource, /Postventa/);
  assert.match(pageSource, /Cobro y reembolsos/);
  assert.match(pageSource, /Facturacion y documentos fiscales/);
  assert.match(pageSource, /invoiceDocumentActions/);
  assert.match(pageSource, /Emitir documento fiscal/);
  assert.match(pageSource, /Auditoria/);
  assert.match(pageSource, /Siguiente paso/);
  assert.match(pageSource, /Iniciar preparacion/);
  assert.match(pageSource, /En despacho/);
  assert.match(pageSource, /Esperar pago/);
  assert.match(pageSource, /Operar/);
  assert.doesNotMatch(pageSource, /Ver detalle/);
  assert.match(pageSource, /Operacion del pedido/);
  assert.match(pageSource, /OrderOperationWorkspace/);
  assert.match(pageSource, /OperationPrimaryAction/);
  assert.match(pageSource, /targetFulfillmentStatus/);
  assert.match(pageSource, /canManageShipping/);
  assert.match(pageSource, /Sin acciones pendientes/);
  assert.match(pageSource, /Requiere atencion/);
  assert.match(pageSource, /Progreso operativo/);
  assert.match(pageSource, /CREATE_FULFILLMENT/);
  assert.match(pageSource, /requiresTracking/);
  assert.match(pageSource, /Transportista actual/);
  assert.match(pageSource, /Actualizar estado/);
  assert.match(pageSource, /Numero de seguimiento/);
  assert.match(pageSource, /name="trackingNumber"/);
  assert.match(pageSource, /name="carrierId"/);
  assert.doesNotMatch(pageSource, /Carrier ID/);
  assert.match(pageSource, /type="submit"/);
  assert.match(pageSource, /Siguiente paso/);
  assert.match(pageSource, /Falta permiso shipping\.logistics\.write/);
  assert.match(pageSource, /Sin estado operativo/);
  const detailMount = pageSource.slice(pageSource.indexOf("function OrdersAdminPage"), pageSource.length);
  assert.match(detailMount, /OrderDetailDrawer/);
  assert.doesNotMatch(detailMount, /<OrderDetailPanel/);
  assert.match(pageSource, /Paginacion de pedidos/);
  assert.match(pageSource, /Anterior/);
  assert.match(pageSource, /Siguiente/);
  assert.match(dataSource, /\/admin\/orders/);
  assert.doesNotMatch(dataSource, /\/admin\/invoices\/document-template\/preview/);
  assert.doesNotMatch(dataSource, /\/admin\/after-sales\/cases/);
  assert.match(dataSource, /buildOrderAuditTimeline/);
  assert.match(dataSource, /PAYMENT_STATUS/);
  assert.match(dataSource, /INVOICE_ADJUSTMENT/);
  assert.match(dataSource, /COMPOSITION_WARNING/);
  const actionsSource = readFileSync(path.resolve(root, "src/modules/pedidos/orders-admin-actions.ts"), "utf8");
  assert.match(actionsSource, /createOrderFulfillmentAction/);
  assert.match(actionsSource, /transitionFulfillmentStatusAction/);
  assert.match(actionsSource, /admin\/orders\/.*\/fulfillment/);
  assert.doesNotMatch(actionsSource, /admin\/shipping\/fulfillments/);
  assert.match(actionsSource, /noticeKind/);
  assert.match(actionsSource, /Numero de tracking requerido para marcar como enviado/);
});

test("orders admin capabilities map order invoice and after-sales permissions", () => {
  const { getOrdersAdminCapabilities } = loadOrdersAdminModule(async () => ({ ok: true, data: {} }));
  const empty = getOrdersAdminCapabilities(null);
  const reader = getOrdersAdminCapabilities({ scope: "admin", permissions: ["orders.read"] });
  const manager = getOrdersAdminCapabilities({ scope: "admin", permissions: ["orders.read", "invoices.manage", "after-sales.manage"] });
  const logistics = getOrdersAdminCapabilities({ scope: "admin", permissions: ["orders.read", "shipping.logistics.write"] });

  assert.equal(empty.canReadOrders, false);
  assert.equal(empty.canManageShipping, false);
  assert.equal(reader.canReadOrders, true);
  assert.equal(reader.canManageInvoices, false);
  assert.equal(reader.canManageAfterSales, false);
  assert.equal(reader.canManageShipping, false);
  assert.equal(manager.canReadOrders, true);
  assert.equal(manager.canManageInvoices, true);
  assert.equal(manager.canManageAfterSales, true);
  assert.equal(manager.canManageShipping, false);
  assert.equal(logistics.canReadOrders, true);
  assert.equal(logistics.canManageShipping, true);
});

test("orders admin fulfillment UI uses BFF primaryAction as the operation source", () => {
  const pageSource = readFileSync(path.resolve(root, "src/modules/pedidos/orders-admin-page.tsx"), "utf8");
  const workspace = pageSource.slice(
    pageSource.indexOf("function OperationPrimaryAction"),
    pageSource.indexOf("function OrderOperationWorkspace"),
  );

  assert.match(workspace, /action\.type === "CREATE_FULFILLMENT"/);
  assert.match(workspace, /action\.targetFulfillmentStatus/);
  assert.match(workspace, /action\.requiresTracking/);
  assert.match(workspace, /transitionFulfillmentStatusAction/);
  assert.match(workspace, /shippingCarrierLabel/);
  assert.match(workspace, /Transportista actual/);
  assert.match(workspace, /Numero de seguimiento/);
  assert.match(workspace, /type="hidden" value=\{carrierIdValue\}/);
  assert.doesNotMatch(workspace, /fulfillmentActionByStatus/);
  assert.doesNotMatch(workspace, /fulfillmentId/);
  assert.doesNotMatch(workspace, /Carrier ID/);
});

test("orders admin loads solo lista y detalle del pedido mediante BFF", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
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
          operation: {
            status: "PACKED",
            paymentState: "PAID",
            fulfillmentStatus: "PACKED",
            primaryAction: {
              type: "MARK_SHIPPED",
              label: "Marcar enviado",
              enabled: true,
              targetFulfillmentStatus: "SHIPPED",
              requiresTracking: true,
              requiresCarrier: true,
              reason: null,
            },
            blockers: [],
            sections: [
              { code: "payment", label: "Pago", status: "ready", message: "Pago confirmado.", count: null },
              { code: "fulfillment", label: "Preparacion y envio", status: "pending", message: "Preparacion o envio en curso.", count: 1 },
            ],
            timeline: [
              { code: "ORDER_RECEIVED", label: "Pedido recibido", state: "completed" },
              { code: "SHIPPED", label: "Enviado", state: "current" },
            ],
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
      : {
              items: [{
                orderId: "order-1",
                customerId: "customer-1",
                customer: { kind: "REGISTERED", reference: "C-4K7M2P" },
                totalAmountMinor: 1234,
                currency: "EUR",
              }],
              total: 1,
              limit: 25,
              offset: 0,
            };

    return { ok: true, data: options.parse ? options.parse(raw) : raw, status: 200, correlationId: "corr-orders" };
  };
  const { getOrdersAdminData } = loadOrdersAdminModule(requestAdminBff);
  const { buildOrderAuditTimeline } = loadOrdersAdminModule(requestAdminBff);
  const capabilities = { canReadOrders: true, canManageInvoices: true, canManageAfterSales: true, canManageShipping: true };

  const data = await getOrdersAdminData(context, { orderId: "order-1", customerId: "customer-1" }, capabilities);
  const timeline = buildOrderAuditTimeline(data.selectedOrder.data);

  assert.equal(data.orders.data.items[0].orderId, "order-1");
  assert.equal(data.orders.data.items[0].customer.reference, "C-4K7M2P");
  assert.equal(data.selectedOrder.data.payment.status, "SETTLED");
  assert.equal(data.selectedOrder.data.shipping.trackingNumber, "TRACK-1");
  assert.equal(data.selectedOrder.data.operation.primaryAction.targetFulfillmentStatus, "SHIPPED");
  assert.equal(data.selectedOrder.data.operation.sections[0].status, "ready");
  assert.equal(data.selectedOrder.data.invoice.invoiceId, "invoice-1");
  assert.equal(data.selectedOrder.data.afterSales.caseId, "case-1");
  assert.equal(timeline[0].eventType, "COMPOSITION_WARNING");
  assert.equal(timeline.some((event) => event.eventType === "PAYMENT_STATUS" && event.referenceId === "tx-1"), true);
  assert.equal(timeline.some((event) => event.eventType === "INVOICE_ADJUSTMENT" && event.referenceId === "adjustment-1"), true);
  assert.equal(timeline.some((event) => event.eventType === "AFTER_SALES_CASE" && event.referenceId === "case-1"), true);
  assert.deepEqual(calls.map((call) => call.path), [
    "/admin/orders?organizationId=org-1&shopId=shop-1&customerId=customer-1&limit=25&offset=0",
    "/admin/orders/order-1?organizationId=org-1&shopId=shop-1",
  ]);
});

test("orders admin actions assign after-sales, issue invoice and create fiscal adjustments through scoped BFF", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-orders" };
  };
  const {
    assignAfterSalesCaseAction,
    createOrderFulfillmentAction,
    createInvoiceAdjustmentAction,
    issueOrderInvoiceAction,
    transitionFulfillmentStatusAction,
  } = loadOrdersActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("caseId", "case-1");
  formData.set("orderId", "order-1");
  formData.set("assignedEmployeeId", "employee-2");
  formData.set("invoiceId", "invoice-1");
  formData.set("adjustmentType", "CREDIT_NOTE");
  formData.set("amountMinor", "1299");
  formData.set("currency", "EUR");
  formData.set("reason", "Devolucion parcial");
  formData.set("status", "SHIPPED");
  formData.set("trackingNumber", "TRACK-001");
  formData.set("carrierId", "carrier-standard");

  await assert.rejects(() => assignAfterSalesCaseAction(formData), { url: "/admin/pedidos?notice=Caso+postventa+asignado.&orderId=order-1" });
  await assert.rejects(() => issueOrderInvoiceAction(formData), { url: "/admin/pedidos?notice=Factura+solicitada.&orderId=order-1" });
  await assert.rejects(() => createInvoiceAdjustmentAction(formData), { url: "/admin/pedidos?notice=Ajuste+fiscal+solicitado.&orderId=order-1" });
  await assert.rejects(() => createOrderFulfillmentAction(formData), { url: "/admin/pedidos?notice=Pedido+en+preparacion.&orderId=order-1&noticeKind=success" });
  await assert.rejects(() => transitionFulfillmentStatusAction(formData), { url: "/admin/pedidos?notice=Estado+logistico+actualizado+a+SHIPPED.&orderId=order-1&noticeKind=success" });

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
    {
      path: "/admin/orders/order-1/fulfillment?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: {},
    },
    {
      path: "/admin/orders/order-1/fulfillment/status?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
      body: {
        status: "SHIPPED",
        trackingNumber: "TRACK-001",
        carrierId: "carrier-standard",
      },
    },
  ]);
});

test("orders admin fulfillment action redirects validation errors without calling BFF", async () => {
  const calls = [];
  const requestAdminBff = async () => {
    calls.push("called");
    return { ok: true, data: {}, status: 200, correlationId: "corr-orders" };
  };
  const { transitionFulfillmentStatusAction } = loadOrdersActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("orderId", "order-1");
  formData.set("status", "SHIPPED");

  await assert.rejects(() => transitionFulfillmentStatusAction(formData), {
    url: "/admin/pedidos?notice=Numero+de+tracking+requerido+para+marcar+como+enviado.&orderId=order-1&noticeKind=error",
  });
  assert.deepEqual(calls, []);
});

test("orders admin fulfillment action advances non-shipped states without tracking", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-orders" };
  };
  const { transitionFulfillmentStatusAction } = loadOrdersActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("orderId", "order-1");
  formData.set("status", "PACKED");

  await assert.rejects(() => transitionFulfillmentStatusAction(formData), {
    url: "/admin/pedidos?notice=Estado+logistico+actualizado+a+En+despacho.&orderId=order-1&noticeKind=success",
  });
  assert.deepEqual(calls, [{
    path: "/admin/orders/order-1/fulfillment/status?organizationId=org-1&shopId=shop-1",
    method: "PATCH",
    body: {
      status: "PACKED",
    },
  }]);
});

test("orders admin fulfillment action surfaces permission errors", async () => {
  const requestAdminBff = async () => ({ ok: false, error: "Forbidden", status: 403, correlationId: "corr-orders" });
  const { transitionFulfillmentStatusAction } = loadOrdersActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("orderId", "order-1");
  formData.set("status", "DELIVERED");

  await assert.rejects(() => transitionFulfillmentStatusAction(formData), {
    url: "/admin/pedidos?notice=Falta+permiso+shipping.logistics.write.&orderId=order-1&noticeKind=error",
  });
});

test("orders admin fulfillment action rejects invalid status before BFF", async () => {
  const calls = [];
  const requestAdminBff = async () => {
    calls.push("called");
    return { ok: true, data: {}, status: 200, correlationId: "corr-orders" };
  };
  const { transitionFulfillmentStatusAction } = loadOrdersActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("orderId", "order-1");
  formData.set("status", "DELIVERED_WITH_MAGIC");

  await assert.rejects(() => transitionFulfillmentStatusAction(formData), {
    url: "/admin/pedidos?notice=Estado+logistico+no+permitido.&orderId=order-1&noticeKind=error",
  });
  assert.deepEqual(calls, []);
});
