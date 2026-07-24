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

function loadAfterSalesAdminModule(requestBff) {
  const source = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin.ts"), "utf8");
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
      if (specifier.endsWith("/clientes/customers-admin")) {
        return {
          getCustomerDetail: async () => ({ ok: true, data: { customerReference: "C-CLIENTE" } }),
        };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function loadAfterSalesActionsModule({
  requestBff,
  getAdminContext = async () => context,
  revalidatePath = () => undefined,
  redirect = (url) => {
    throw Object.assign(new Error("redirect"), { url });
  },
}) {
  const source = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin-actions.ts"), "utf8");
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
    Set,
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
      if (specifier.endsWith("/shared/config/admin-context")) {
        return { getAdminContext };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

test("after-sales admin route and navigation expose support cockpit", () => {
  const routeSource = readFileSync(path.resolve(root, "app/(admin)/admin/postventa/page.tsx"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin-page.tsx"), "utf8");
  const dataSource = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin.ts"), "utf8");
  const actionsSource = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin-actions.ts"), "utf8");
  const shellSource = readFileSync(path.resolve(root, "src/app-shell/admin-shell.tsx"), "utf8");
  const permissionsSource = readFileSync(path.resolve(root, "src/shared/permissions/permissions.ts"), "utf8");

  assert.match(routeSource, /getAfterSalesAdminData/);
  assert.match(routeSource, /AfterSalesAdminPage/);
  assert.match(pageSource, /Postventa y soporte/);
  assert.match(pageSource, /Bandeja de casos/);
  assert.match(pageSource, /Auditoria administrativa/);
  assert.match(pageSource, /AdminAuditTimelinePanel/);
  assert.match(pageSource, /AfterSalesCaseDrawer/);
  assert.match(pageSource, /afterSalesSideDrawer/);
  assert.match(pageSource, /Cerrar detalle de postventa/);
  assert.match(pageSource, /requestAfterSalesDocumentAdjustmentAction/);
  assert.match(dataSource, /\/admin\/after-sales\/cases/);
  assert.match(dataSource, /buildAfterSalesAuditTimeline/);
  assert.match(dataSource, /CASE_ASSIGNED/);
  assert.match(dataSource, /Refund solicitado/);
  assert.match(actionsSource, /return-authorizations/);
  assert.match(actionsSource, /refund-requests/);
  assert.match(actionsSource, /inventory-dispositions/);
  assert.match(actionsSource, /document-adjustments/);
  assert.match(shellSource, /\/admin\/postventa/);
  assert.match(permissionsSource, /admin:after-sales:view/);
  assert.match(permissionsSource, /after-sales\.manage/);
});

test("after-sales cases tray keeps its card scrollable", () => {
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin-page.tsx"), "utf8");
  const cardRule = cssSource.match(/\.afterSalesCasesCard\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(pageSource, /adminCard afterSalesCasesCard/);
  assert.match(cardRule, /overflow:\s*auto/);
});

test("after-sales admin capabilities map after-sales permissions", () => {
  const { getAfterSalesAdminCapabilities } = loadAfterSalesAdminModule(async () => ({ ok: true, data: {} }));

  assert.equal(getAfterSalesAdminCapabilities(null).canManageAfterSales, false);
  assert.equal(getAfterSalesAdminCapabilities({ scope: "admin", permissions: ["after-sales.manage"] }).canManageAfterSales, true);
  assert.equal(getAfterSalesAdminCapabilities({ scope: "admin", permissions: ["after_sales.manage"] }).canManageAfterSales, true);
  assert.equal(getAfterSalesAdminCapabilities({ scope: "storefront", permissions: ["after-sales.manage"] }).canManageAfterSales, false);
});

test("after-sales admin loads health list and selected case through BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    const raw = pathValue.includes("/health")
      ? { service: "after-sales", status: "ok", persistence: { reachable: true }, events: { publisherEnabled: true, consumerEnabled: true } }
      : pathValue.includes("/admin/after-sales/cases/case-1?")
        ? {
            caseId: "case-1",
            orderId: "order-1",
            customerId: "customer-1",
            caseType: "RETURN",
            status: "UNDER_REVIEW",
            assignedEmployeeId: "employee-1",
            assignedBy: "manager-1",
            assignedAt: "2026-07-07T10:10:00.000Z",
            createdAt: "2026-07-07T10:00:00.000Z",
            submittedAt: "2026-07-07T10:05:00.000Z",
            reviewedAt: "2026-07-07T10:15:00.000Z",
            items: [{ caseItemId: "item-1", name: "Producto", quantityRequested: 1 }],
            refundRequests: [{ refundRequestId: "refund-1", status: "REQUESTED", createdAt: "2026-07-07T10:30:00.000Z" }],
            inventoryDispositions: [{ inventoryDispositionId: "inventory-1", dispositionType: "RESTOCK", createdAt: "2026-07-07T10:35:00.000Z" }],
            documentAdjustments: [{ documentAdjustmentId: "doc-adjustment-1", adjustmentType: "CREDIT_NOTE", invoiceId: "invoice-1", createdAt: "2026-07-07T10:40:00.000Z" }],
          }
        : {
            items: [{ caseId: "case-1", orderId: "order-1", customerId: "customer-1", status: "SUBMITTED" }],
            total: 1,
            limit: 25,
            offset: 0,
          };

    return { ok: true, data: options.parse ? options.parse(raw) : raw, status: 200, correlationId: "corr-after-sales" };
  };
  const { getAfterSalesAdminData } = loadAfterSalesAdminModule(requestBff);
  const { buildAfterSalesAuditTimeline } = loadAfterSalesAdminModule(requestBff);
  const capabilities = { canManageAfterSales: true };

  const data = await getAfterSalesAdminData(context, { caseId: "case-1", status: "SUBMITTED", customerId: "customer-1", orderId: "order-1", assignedEmployeeId: "employee-1" }, capabilities);
  const timeline = buildAfterSalesAuditTimeline(data.selectedCase.data);

  assert.equal(data.health.data.databaseReachable, true);
  assert.equal(data.cases.data.items[0].caseId, "case-1");
  assert.equal(data.selectedCase.data.items[0].name, "Producto");
  assert.equal(data.selectedCase.data.refundRequests.length, 1);
  assert.equal(data.selectedCustomerReference, "C-CLIENTE");
  assert.equal(timeline[0].eventType, "DOCUMENT");
  assert.equal(timeline.some((event) => event.eventType === "CASE_ASSIGNED" && event.actor === "manager-1"), true);
  assert.equal(timeline.some((event) => event.eventType === "REFUND" && event.referenceId === "refund-1"), true);
  assert.equal(timeline.some((event) => event.eventType === "INVENTORY" && event.referenceId === "inventory-1"), true);
  assert.deepEqual(calls.map((call) => call.path), [
    "/admin/after-sales/health",
    "/admin/after-sales/cases?organizationId=org-1&shopId=shop-1&status=SUBMITTED&customerId=customer-1&orderId=order-1&assignedEmployeeId=employee-1&limit=25&offset=0",
    "/admin/after-sales/cases/case-1?organizationId=org-1&shopId=shop-1",
    "/admin/employees?organizationId=org-1&shopId=shop-1",
    "/admin/orders/order-1?organizationId=org-1&shopId=shop-1",
  ]);
});

test("after-sales admin actions mutate case lifecycle through scoped BFF", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-after-sales" };
  };
  const actions = loadAfterSalesActionsModule({ requestBff });
  const formData = new FormData();
  formData.set("caseId", "case-1");
  formData.set("assignedEmployeeId", "employee-2");
  formData.set("caseAction", "approve");
  formData.set("adminNotes", "Aprobado por soporte");
  formData.set("reason", "ok");
  formData.set("note", "Retorno autorizado");
  formData.set("caseItemId", "item-1");
  formData.set("resolutionType", "REFUND");
  formData.set("amountMinor", "1299");
  formData.set("currency", "EUR");
  formData.set("externalReference", "res-ref");
  formData.set("transactionId", "tx-1");
  formData.set("resolutionId", "resolution-1");
  formData.set("dispositionType", "RESTOCK");
  formData.set("warehouseId", "warehouse-1");
  formData.set("refundRequestId", "refund-1");
  formData.set("invoiceId", "invoice-1");
  formData.set("adjustmentType", "CREDIT_NOTE");
  formData.set("body", "Te hemos respondido en el historial del caso.");
  formData.set("idempotencyKey", "reply-1");

  await assert.rejects(() => actions.assignAfterSalesOwnerAction(formData), { url: "/admin/postventa?notice=Caso+asignado.&caseId=case-1" });
  await assert.rejects(() => actions.transitionAfterSalesCaseAction(formData), { url: "/admin/postventa?notice=Caso+actualizado.&caseId=case-1" });
  await assert.rejects(() => actions.authorizeAfterSalesReturnAction(formData), { url: "/admin/postventa?notice=Retorno+autorizado.&caseId=case-1" });
  await assert.rejects(() => actions.createAfterSalesResolutionAction(formData), { url: "/admin/postventa?notice=Resolucion+registrada.&caseId=case-1" });
  await assert.rejects(() => actions.requestAfterSalesRefundAction(formData), { url: "/admin/postventa?notice=Refund+solicitado.&caseId=case-1" });
  await assert.rejects(() => actions.requestAfterSalesInventoryDispositionAction(formData), { url: "/admin/postventa?notice=Disposicion+de+inventario+solicitada.&caseId=case-1" });
  await assert.rejects(() => actions.requestAfterSalesDocumentAdjustmentAction(formData), { url: "/admin/postventa?notice=Ajuste+documental+solicitado.&caseId=case-1" });
  await assert.rejects(() => actions.replyToAfterSalesCustomerAction(formData), { url: "/admin/postventa?notice=Respuesta+enviada+al+cliente.&caseId=case-1" });

  assert.deepEqual(calls, [
    {
      path: "/admin/after-sales/cases/case-1/assignment?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
      body: { assignedEmployeeId: "employee-2" },
    },
    {
      path: "/admin/after-sales/cases/case-1/approve?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
      body: { adminNotes: "Aprobado por soporte", reason: "ok" },
    },
    {
      path: "/admin/after-sales/cases/case-1/return-authorizations?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: { metadataJson: { note: "Retorno autorizado" } },
    },
    {
      path: "/admin/after-sales/cases/case-1/resolutions?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: {
        caseItemId: "item-1",
        resolutionType: "REFUND",
        amountMinor: 1299,
        currency: "EUR",
        externalReference: "res-ref",
        metadataJson: { note: "Retorno autorizado" },
      },
    },
    {
      path: "/admin/after-sales/cases/case-1/refund-requests?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: { transactionId: "tx-1", resolutionId: "resolution-1" },
    },
    {
      path: "/admin/after-sales/cases/case-1/inventory-dispositions?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: { caseItemId: "item-1", dispositionType: "RESTOCK", warehouseId: "warehouse-1" },
    },
    {
      path: "/admin/after-sales/cases/case-1/document-adjustments?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: { refundRequestId: "refund-1", invoiceId: "invoice-1", adjustmentType: "CREDIT_NOTE" },
    },
    {
      path: "/admin/after-sales/cases/case-1/messages?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: { body: "Te hemos respondido en el historial del caso.", idempotencyKey: "reply-1" },
    },
  ]);
});
