import assert from "node:assert/strict";
import { File } from "node:buffer";
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

function loadAfterSalesAdminModule(requestAdminBff) {
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
  requestAdminBff,
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
    Buffer,
    FormData,
    File,
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
  assert.match(pageSource, /Cola operativa/);
  assert.match(pageSource, /Mensaje del cliente/);
  assert.match(pageSource, /Evidencia pendiente/);
  assert.match(pageSource, /Propuesta rechazada/);
  assert.match(pageSource, /Propuesta aceptada/);
  assert.match(pageSource, /Caso nuevo/);
  assert.match(pageSource, /caseFocus/);
  assert.match(pageSource, /attendAfterSalesTaskAction/);
  assert.match(pageSource, /CaseHistoryTimelinePanel/);
  assert.match(pageSource, /Recorrido del caso/);
  assert.match(pageSource, /afterSalesHistoryTimeline/);
  assert.match(pageSource, /afterSalesHistoryProposalSummary/);
  assert.match(pageSource, /Propuesta \{event\.proposal\.version\}/);
  assert.match(pageSource, /afterSalesHistoryExecutionSummary/);
  assert.doesNotMatch(pageSource, /encType=/);
  assert.match(pageSource, /variant="inline"/);
  assert.match(pageSource, /evidenceIds=\{\[event\.evidenceId\]\}/);
  assert.match(pageSource, /AfterSalesCaseDrawer/);
  assert.match(pageSource, /afterSalesSideDrawer/);
  assert.match(pageSource, /Cerrar detalle de postventa/);
  assert.match(pageSource, /requestAfterSalesDocumentAdjustmentAction/);
  assert.match(dataSource, /\/admin\/after-sales\/cases/);
  assert.match(dataSource, /\/admin\/after-sales\/tasks\/summary/);
  assert.match(dataSource, /\/admin\/after-sales\/tasks/);
  assert.match(dataSource, /buildAfterSalesCaseHistory/);
  assert.match(dataSource, /CASE_ASSIGNED/);
  assert.match(dataSource, /El reembolso fue completado/);
  assert.doesNotMatch(pageSource, /CaseCollectionPanel/);
  assert.doesNotMatch(pageSource, /SolutionProposalHistoryPanel/);
  assert.doesNotMatch(pageSource, /Aun no hay resoluciones registradas/);
  assert.doesNotMatch(pageSource, /<th>Referencia<\/th><th>Estado o tipo<\/th>/);
  assert.match(actionsSource, /return-authorizations/);
  assert.match(actionsSource, /refund-requests/);
  assert.match(actionsSource, /inventory-dispositions/);
  assert.match(actionsSource, /document-adjustments/);
  assert.match(actionsSource, /recordAfterSalesClosureProofAction/);
  assert.match(actionsSource, /solution-finalization/);
  assert.match(actionsSource, /closureProofNote/);
  assert.match(pageSource, /Prueba de cierre/);
  assert.match(pageSource, /Imagen privada \(opcional\)/);
  assert.match(pageSource, /Confirmación interna del reembolso/);
  assert.match(pageSource, /Confirmación interna de entrega/);
  assert.match(pageSource, /Cómo se confirmó el reembolso \(obligatorio\)/);
  assert.match(pageSource, /Adjuntar imagen \(opcional\)/);
  assert.doesNotMatch(pageSource, /encType=/);
  assert.match(dataSource, /closureProofRequired/);
  assert.match(dataSource, /closureProofs/);
  assert.match(actionsSource, /tasks\/\$\{encodeURIComponent\(taskId\)\}/);
  assert.match(shellSource, /\/admin\/postventa/);
  assert.match(shellSource, /getAfterSalesTaskSummary/);
  assert.match(shellSource, /pendingAfterSalesTasks/);
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

test("after-sales drawer presents the guided flow and maps legacy deep links", () => {
  const pageSource = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin-page.tsx"), "utf8");
  const dataSource = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin.ts"), "utf8");

  assert.match(pageSource, /\{ id: "caso", label: "Caso" \}/);
  assert.match(pageSource, /\{ id: "propuesta", label: "Propuesta" \}/);
  assert.match(pageSource, /\{ id: "ejecucion", label: "Ejecución" \}/);
  assert.match(pageSource, /\{ id: "historial", label: "Historial" \}/);
  assert.match(pageSource, /operacion: "caso"/);
  assert.match(pageSource, /devolucion: "ejecucion"/);
  assert.match(pageSource, /resolucion: "ejecucion"/);
  assert.match(pageSource, /auditoria: "historial"/);
  assert.match(pageSource, /El cambio de estado se ejecuta una sola vez desde esta acción guiada/);
  assert.match(pageSource, /Operación histórica/);
  assert.match(pageSource, /const canSendProposal = workflow\.primaryAction === "SEND_PROPOSAL"/);
  assert.match(pageSource, /Nueva propuesta de solución/);
  assert.match(pageSource, /La oferta anterior queda en el historial; esta se enviará como una nueva versión\./);
  assert.match(dataSource, /AfterSalesAdminLegacyDrawerTab/);
});

test("after-sales admin capabilities map after-sales permissions", () => {
  const { getAfterSalesAdminCapabilities } = loadAfterSalesAdminModule(async () => ({ ok: true, data: {} }));

  const reader = getAfterSalesAdminCapabilities({ scope: "admin", permissions: ["admin:after-sales:view"] });
  assert.equal(getAfterSalesAdminCapabilities(null).canManageAfterSales, false);
  assert.equal(getAfterSalesAdminCapabilities({ scope: "admin", permissions: ["after-sales.manage"] }).canManageAfterSales, true);
  assert.equal(getAfterSalesAdminCapabilities({ scope: "admin", permissions: ["after_sales.manage"] }).canManageAfterSales, true);
  assert.equal(getAfterSalesAdminCapabilities({ scope: "storefront", permissions: ["after-sales.manage"] }).canManageAfterSales, false);
  assert.equal(reader.canViewAfterSales, true);
  assert.equal(reader.canManageAfterSales, false);
  assert.equal(getAfterSalesAdminCapabilities(null).canViewAfterSales, false);
});

test("after-sales read-only access can query the cockpit but never exposes mutations", async () => {
  const calls = [];
  const { getAfterSalesAdminData } = loadAfterSalesAdminModule(async (pathValue) => {
    calls.push(pathValue);
    return { ok: true, data: { items: [] }, status: 200, correlationId: "corr-read-only" };
  });
  const denied = await getAfterSalesAdminData(context, {}, { canViewAfterSales: false, canManageAfterSales: false });
  const pageSource = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin-page.tsx"), "utf8");

  assert.equal(denied.cases.ok, false);
  assert.equal(denied.cases.error, "Falta permiso admin:after-sales:view.");
  assert.deepEqual(calls, []);
  assert.match(pageSource, /capabilities\.canManageAfterSales \? "Atender" : "Ver caso"/);
  assert.match(pageSource, /Tu permiso permite consultar el historial, pero no enviar respuestas/);
  assert.match(pageSource, /capabilities\.canManageAfterSales \? <th>Acciones<\/th> : null/);
  assert.match(pageSource, /<dt>Motivo del cliente<\/dt><dd className="afterSalesCustomerReasonCell">\{selectedCase\.customerMessage \? <>/);
  assert.match(pageSource, /<em>\{selectedCase\.customerMessage\}<\/em>/);
  assert.doesNotMatch(pageSource, /className="afterSalesCustomerReason"/);
  assert.match(pageSource, /afterSalesConversationThread/);
  assert.match(pageSource, /message\.kind === "OPENING" \? <span>Mensaje inicial<\/span> : null/);
  assert.match(pageSource, /conversationDateTimeText\(message\.createdAt\)/);
  assert.doesNotMatch(pageSource, /return "Mensaje";/);
  assert.match(pageSource, /Mensaje del equipo para el cliente/);
  assert.match(pageSource, /className="afterSalesProposalCustomerMessage"/);
  assert.match(pageSource, /Enviar respuesta y avisar por email/);
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");
  assert.match(cssSource, /\.afterSalesCustomerReasonCell\s*\{\s*color: var\(--admin-primary\);/);
  assert.match(cssSource, /\.afterSalesConversationBubble/);
  assert.match(cssSource, /\.afterSalesProposalCustomerMessage/);
  assert.match(cssSource, /\.afterSalesConversationBubble\s*\{\s*width: 85%;/);
  assert.match(cssSource, /\.afterSalesConversationMessageTeam \.afterSalesConversationBubble\s*\{\s*margin-right: 0;\s*margin-left: auto;/);
});

test("after-sales admin maps proposals to controlled human workflow states", () => {
  const { getAfterSalesWorkflowPresentation, normalizeAfterSalesCase } = loadAfterSalesAdminModule(async () => ({ ok: true, data: {} }));
  const baseCase = {
    caseId: "case-1",
    orderId: "order-1",
    lifecycleStatus: "IN_PROGRESS",
    status: "AWAITING_CUSTOMER",
    solutionProposals: [{
      proposalId: "proposal-1",
      version: 2,
      status: "PENDING_CUSTOMER",
      solutionType: "REFUND",
      customerMessage: "Ofrecemos el reembolso acordado.",
      amountMinor: 5118,
      currency: "EUR",
      returnRequired: true,
      returnShippingPaidBy: "STORE",
      createdAt: "2026-08-21T10:00:00.000Z",
      respondedAt: null,
      expiresAt: "2026-08-28T10:00:00.000Z",
    }],
  };
  const waitingCase = normalizeAfterSalesCase(baseCase);
  const waiting = getAfterSalesWorkflowPresentation(waitingCase);
  const hibernatingCase = normalizeAfterSalesCase({
    ...baseCase,
    solutionProposals: [{ ...baseCase.solutionProposals[0], status: "EXPIRED", expiresAt: "2026-08-20T10:00:00.000Z" }],
  });
  const hibernating = getAfterSalesWorkflowPresentation(hibernatingCase);
  const execution = getAfterSalesWorkflowPresentation(normalizeAfterSalesCase({
    caseId: "case-2",
    orderId: "order-2",
    status: "RESOLUTION_IN_PROGRESS",
    resolutions: [],
  }));
  const completing = getAfterSalesWorkflowPresentation(normalizeAfterSalesCase({
    caseId: "case-3",
    orderId: "order-3",
    status: "RESOLUTION_IN_PROGRESS",
    resolutions: [{ resolutionId: "resolution-1", status: "IN_PROGRESS" }],
  }));

  assert.equal(waitingCase.solutionProposals[0].version, 2);
  assert.equal(waiting.phase, "WAITING_CUSTOMER");
  assert.equal(waiting.title, "Esperando al cliente");
  assert.equal(waiting.primaryAction, null);
  assert.equal(hibernating.phase, "HIBERNATING");
  assert.equal(hibernating.title, "Invernando");
  assert.equal(execution.primaryAction, "START_SOLUTION_EXECUTION");
  assert.equal(completing.primaryAction, "COMPLETE_SOLUTION");
  assert.equal(getAfterSalesWorkflowPresentation(normalizeAfterSalesCase({ caseId: "legacy", orderId: "order-legacy", status: "AWAITING_RETURN" })).usesLegacyOperations, true);
});

test("after-sales admin only enables completion once agreed refund impacts are confirmed", () => {
  const { getAfterSalesExecutionSummary, getAfterSalesWorkflowPresentation, normalizeAfterSalesCase } = loadAfterSalesAdminModule(async () => ({ ok: true, data: {} }));
  const baseCase = {
    caseId: "case-refund-gate",
    orderId: "order-refund-gate",
    status: "RESOLUTION_IN_PROGRESS",
    solutionProposals: [{
      proposalId: "proposal-refund",
      version: 1,
      status: "ACCEPTED",
      solutionType: "REFUND",
      customerMessage: "Reembolso acordado.",
      amountMinor: 5118,
      currency: "EUR",
      returnRequired: false,
      returnShippingPaidBy: "NOT_REQUIRED",
    }],
    resolutions: [{ resolutionId: "resolution-refund", status: "IN_PROGRESS", resolutionType: "REFUND", amountMinor: 5118, currency: "EUR" }],
  };
  const pending = normalizeAfterSalesCase(baseCase);
  const requested = normalizeAfterSalesCase({
    ...baseCase,
    refundRequests: [{ refundRequestId: "refund-1", resolutionId: "resolution-refund", status: "REQUESTED", amountMinor: 5118, currency: "EUR" }],
  });
  const completed = normalizeAfterSalesCase({
    ...baseCase,
    refundRequests: [{ refundRequestId: "refund-1", resolutionId: "resolution-refund", status: "COMPLETED", amountMinor: 5118, currency: "EUR" }],
  });

  assert.equal(getAfterSalesWorkflowPresentation(pending).primaryAction, "PROCESS_REFUND");
  assert.equal(getAfterSalesWorkflowPresentation(requested).primaryAction, null);
  assert.equal(getAfterSalesWorkflowPresentation(completed).primaryAction, "COMPLETE_SOLUTION");
  assert.equal(getAfterSalesExecutionSummary(requested).refundStatus, "REQUESTED");
});

test("after-sales admin waits for customer confirmation after the internal proof", () => {
  const { getAfterSalesWorkflowPresentation, normalizeAfterSalesCase } = loadAfterSalesAdminModule(async () => ({ ok: true, data: {} }));
  const pageSource = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin-page.tsx"), "utf8");
  const pendingProof = normalizeAfterSalesCase({
    caseId: "case-proof",
    orderId: "order-proof",
    status: "RESOLVED",
    lifecycleStatus: "RESOLVED",
    closureProofRequired: true,
    closureProofs: [],
  });
  const registeredProof = normalizeAfterSalesCase({
    ...pendingProof,
    closureProofs: [{
      closureProofId: "proof-1",
      resolutionId: "resolution-1",
      evidenceId: null,
      source: "ADMIN_EVIDENCE",
      visibility: "INTERNAL",
      note: "Entrega comprobada.",
      createdBy: "employee-1",
      createdAt: "2026-08-23T10:00:00.000Z",
      invalidatedAt: null,
    }],
  });

  assert.equal(getAfterSalesWorkflowPresentation(pendingProof).primaryAction, "RECORD_CLOSURE_PROOF");
  assert.equal(getAfterSalesWorkflowPresentation(registeredProof).phase, "WAITING_CUSTOMER_CONFIRMATION");
  assert.equal(getAfterSalesWorkflowPresentation(registeredProof).title, "Esperando confirmación del cliente");
  assert.equal(getAfterSalesWorkflowPresentation(registeredProof).primaryAction, null);
  assert.match(pageSource, /if \(caseRecord\.closureProofRequired\) return \[\];/);
  assert.match(pageSource, /No requiere un cierre manual del equipo/);
  assert.match(pageSource, /El cliente fue informado de la solución/);
});

test("after-sales history model narrates the case without technical references", () => {
  const { buildAfterSalesCaseHistory, normalizeAfterSalesCase } = loadAfterSalesAdminModule(async () => ({ ok: true, data: {} }));
  const caseHistory = buildAfterSalesCaseHistory(normalizeAfterSalesCase({
    caseId: "case-history",
    orderId: "order-history",
    customerMessage: "La batidora llegó rota.",
    submittedAt: "2026-08-23T10:00:00.000Z",
    assignedAt: "2026-08-23T10:05:00.000Z",
    reviewedAt: "2026-08-23T10:10:00.000Z",
    messages: [{ messageId: "message-team", authorType: "EMPLOYEE", body: "Estamos revisando tu caso.", createdAt: "2026-08-23T10:12:00.000Z" }],
    solutionProposals: [{
      proposalId: "proposal-1",
      version: 1,
      status: "ACCEPTED",
      solutionType: "REPAIR",
      customerMessage: "Repararemos la batidora.",
      returnRequired: true,
      returnShippingPaidBy: "STORE",
      createdAt: "2026-08-23T11:00:00.000Z",
      respondedAt: "2026-08-23T12:00:00.000Z",
    }],
    resolutionReason: "La reparación fue revisada y funciona correctamente.",
    resolutions: [{ resolutionId: "resolution-1", status: "COMPLETED", resolutionType: "REPAIR", createdAt: "2026-08-23T12:05:00.000Z", completedAt: "2026-08-23T14:00:00.000Z" }],
    closureProofs: [{
      closureProofId: "proof-1",
      resolutionId: "resolution-1",
      evidenceId: "evidence-1",
      source: "ADMIN_EVIDENCE",
      visibility: "INTERNAL",
      note: "Reparación verificada por el técnico.",
      createdAt: "2026-08-23T14:05:00.000Z",
      invalidatedAt: null,
    }],
  }));

  assert.deepEqual(Array.from(caseHistory, (event) => event.title), [
    "El cliente abrió el caso",
    "El caso fue asignado al equipo",
    "El equipo inició la revisión",
    "El equipo respondió al cliente",
    "El equipo envió una propuesta de reparación",
    "El cliente aceptó la propuesta",
    "El equipo inició la ejecución: Reparación",
    "Solución completada: Reparación",
    "El equipo aportó una prueba de cierre",
  ]);
  assert.equal(caseHistory.at(-1)?.detail, "Reparación verificada por el técnico.");
  assert.equal(caseHistory.at(-1)?.evidenceId, "evidence-1");
  const sentProposal = caseHistory.find((event) => event.kind === "PROPOSAL_SENT");
  const acceptedProposal = caseHistory.find((event) => event.kind === "PROPOSAL_ACCEPTED");
  assert.equal(sentProposal?.proposal?.solutionLabel, "reparación");
  assert.equal(acceptedProposal?.proposal?.version, 1);
  const completedSolution = caseHistory.find((event) => event.kind === "SOLUTION_COMPLETED");
  assert.equal(completedSolution?.execution?.label, "Reparación");
  assert.equal(completedSolution?.detail, "La reparación fue revisada y funciona correctamente.");
  assert.equal(caseHistory.some((event) => event.title.includes("resolution-1") || event.title.includes("ADMIN_EVIDENCE")), false);
});

test("after-sales admin summarizes execution from BFF facts without deciding completion", () => {
  const { getAfterSalesExecutionSummary, normalizeAfterSalesCase } = loadAfterSalesAdminModule(async () => ({ ok: true, data: {} }));
  const selectedCase = normalizeAfterSalesCase({
    caseId: "case-execution",
    orderId: "order-execution",
    status: "RESOLUTION_IN_PROGRESS",
    solutionProposals: [{
      proposalId: "proposal-accepted",
      version: 1,
      status: "ACCEPTED",
      solutionType: "REFUND",
      customerMessage: "Reembolso acordado.",
      amountMinor: 5118,
      currency: "EUR",
      returnRequired: true,
      returnShippingPaidBy: "STORE",
    }],
    resolutions: [{ resolutionId: "resolution-1", status: "IN_PROGRESS", resolutionType: "REFUND", amountMinor: 5118, currency: "EUR" }],
    returnAuthorizations: [{ returnAuthorizationId: "return-1", status: "RECEIVED" }],
    refundRequests: [{ refundRequestId: "refund-1", resolutionId: "resolution-1", status: "COMPLETED", amountMinor: 5118, currency: "EUR" }],
  });
  const summary = getAfterSalesExecutionSummary(selectedCase);

  assert.equal(summary.acceptedProposal?.proposalId, "proposal-accepted");
  assert.equal(summary.resolution?.resolutionId, "resolution-1");
  assert.equal(summary.requiresReturn, true);
  assert.equal(summary.returnReceived, true);
  assert.equal(summary.requiresRefund, true);
  assert.equal(summary.refundCompleted, true);
  assert.equal("canComplete" in summary, false);
});

test("after-sales admin loads health list and selected case through BFF", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });
    const raw = pathValue.includes("/health")
      ? { service: "after-sales", status: "ok", persistence: { reachable: true }, events: { publisherEnabled: true, consumerEnabled: true } }
      : pathValue.includes("/tasks/summary")
        ? { pendingCount: 2, openCount: 1, assignedCount: 1 }
        : pathValue.includes("/admin/after-sales/tasks?")
          ? {
              items: [{
                taskId: "task-1",
                caseId: "case-1",
                taskType: "CUSTOMER_MESSAGE",
                status: "ASSIGNED",
                priority: "HIGH",
                assignedEmployeeId: "employee-1",
                assignedBy: "manager-1",
                assignedAt: "2026-07-07T10:10:00.000Z",
                lastActivityAt: "2026-07-07T10:20:00.000Z",
                completedAt: null,
                completedBy: null,
              }],
              total: 1,
              limit: 20,
              offset: 0,
            }
      : pathValue.includes("/admin/after-sales/cases/case-1?")
        ? {
            caseId: "case-1",
            orderId: "order-1",
            customerId: "customer-1",
            caseType: "RETURN",
            status: "UNDER_REVIEW",
            lifecycleStatus: "IN_PROGRESS",
            operationalStage: "REVIEW",
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
        : pathValue.includes("/admin/orders/order-1?")
          ? {
              payment: {
                transactionId: "transaction-1",
                transaction: { transactionId: "transaction-1", paymentReference: "PAY-0001" },
              },
              invoice: { items: [] },
            }
        : {
            items: [{ caseId: "case-1", orderId: "order-1", customerId: "customer-1", status: "SUBMITTED" }],
            total: 1,
            limit: 25,
            offset: 0,
          };

    return { ok: true, data: options.parse ? options.parse(raw) : raw, status: 200, correlationId: "corr-after-sales" };
  };
  const { getAfterSalesAdminData } = loadAfterSalesAdminModule(requestAdminBff);
  const { buildAfterSalesCaseHistory } = loadAfterSalesAdminModule(requestAdminBff);
  const capabilities = { canViewAfterSales: true, canManageAfterSales: true };

  const data = await getAfterSalesAdminData(context, { caseId: "case-1", status: "SUBMITTED", customerId: "customer-1", orderId: "order-1", assignedEmployeeId: "employee-1" }, capabilities);
  const timeline = buildAfterSalesCaseHistory(data.selectedCase.data);

  assert.equal(data.health.data.databaseReachable, true);
  assert.equal(data.cases.data.items[0].caseId, "case-1");
  assert.equal(data.taskSummary.data.pendingCount, 2);
  assert.equal(data.tasks.data.items[0].taskType, "CUSTOMER_MESSAGE");
  assert.equal(data.selectedCase.data.items[0].name, "Producto");
  assert.equal(data.selectedCase.data.lifecycleStatus, "IN_PROGRESS");
  assert.equal(data.selectedCase.data.operationalStage, "REVIEW");
  assert.equal(data.selectedCase.data.refundRequests.length, 1);
  assert.equal(data.orderReferences.data.transactions[0].id, "transaction-1");
  assert.equal(data.orderReferences.data.transactions[0].label, "PAY-0001");
  assert.equal(data.selectedCustomerReference, "C-CLIENTE");
  assert.equal(timeline[0].kind, "CASE_OPENED");
  assert.equal(timeline.some((event) => event.kind === "CASE_ASSIGNED" && event.actor === "TEAM"), true);
  assert.equal(timeline.some((event) => event.kind === "REFUND_COMPLETED"), false);
  assert.deepEqual(calls.map((call) => call.path), [
    "/admin/after-sales/health",
    "/admin/after-sales/cases?organizationId=org-1&shopId=shop-1&status=SUBMITTED&customerId=customer-1&orderId=order-1&assignedEmployeeId=employee-1&limit=25&offset=0",
    "/admin/after-sales/tasks/summary?organizationId=org-1&shopId=shop-1",
    "/admin/after-sales/tasks?organizationId=org-1&shopId=shop-1&limit=20&offset=0",
    "/admin/after-sales/cases/case-1?organizationId=org-1&shopId=shop-1",
    "/admin/employees?organizationId=org-1&shopId=shop-1",
    "/admin/orders/order-1?organizationId=org-1&shopId=shop-1",
  ]);
});

test("after-sales admin actions mutate case lifecycle through scoped BFF", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-after-sales" };
  };
  const actions = loadAfterSalesActionsModule({ requestAdminBff });
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
  const resolveFormData = new FormData();
  resolveFormData.set("caseId", "case-1");
  resolveFormData.set("caseAction", "resolve");
  resolveFormData.set("resolutionOutcome", "REFUND");
  resolveFormData.set("resolutionReason", "Reembolso procesado.");
  const closeFormData = new FormData();
  closeFormData.set("caseId", "case-1");
  closeFormData.set("caseAction", "close");
  closeFormData.set("closureReason", "COMPLETED");

  await assert.rejects(() => actions.assignAfterSalesOwnerAction(formData), { url: "/admin/postventa?notice=Caso+asignado.&caseId=case-1" });
  await assert.rejects(() => actions.transitionAfterSalesCaseAction(formData), { url: "/admin/postventa?notice=Caso+actualizado.&caseId=case-1" });
  await assert.rejects(() => actions.authorizeAfterSalesReturnAction(formData), { url: "/admin/postventa?notice=Retorno+autorizado.&caseId=case-1" });
  await assert.rejects(() => actions.createAfterSalesResolutionAction(formData), { url: "/admin/postventa?notice=Resolucion+registrada.&caseId=case-1" });
  await assert.rejects(() => actions.requestAfterSalesRefundAction(formData), { url: "/admin/postventa?notice=Refund+solicitado.&caseId=case-1" });
  await assert.rejects(() => actions.requestAfterSalesInventoryDispositionAction(formData), { url: "/admin/postventa?notice=Disposicion+de+inventario+solicitada.&caseId=case-1" });
  await assert.rejects(() => actions.requestAfterSalesDocumentAdjustmentAction(formData), { url: "/admin/postventa?notice=Ajuste+documental+solicitado.&caseId=case-1" });
  await assert.rejects(() => actions.replyToAfterSalesCustomerAction(formData), { url: "/admin/postventa?notice=Respuesta+enviada+al+cliente.&caseId=case-1" });
  await assert.rejects(() => actions.transitionAfterSalesCaseAction(resolveFormData), { url: "/admin/postventa?notice=Caso+actualizado.&caseId=case-1" });
  await assert.rejects(() => actions.transitionAfterSalesCaseAction(closeFormData), { url: "/admin/postventa?notice=Caso+actualizado.&caseId=case-1" });

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
    {
      path: "/admin/after-sales/cases/case-1/resolve?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
      body: { resolutionOutcome: "REFUND", resolutionReason: "Reembolso procesado." },
    },
    {
      path: "/admin/after-sales/cases/case-1/close?organizationId=org-1&shopId=shop-1",
      method: "PATCH",
      body: { closureReason: "COMPLETED" },
    },
  ]);
});

test("after-sales admin registers an internal closure proof before customer confirmation", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-closure-proof" };
  };
  const actions = loadAfterSalesActionsModule({ requestAdminBff });
  const formData = new FormData();
  formData.set("caseId", "case-1");
  formData.set("caseTab", "ejecucion");
  formData.set("resolutionId", "resolution-1");
  formData.set("note", "Reparación comprobada por el técnico.");

  await assert.rejects(
    () => actions.recordAfterSalesClosureProofAction(formData),
    { url: "/admin/postventa?notice=Prueba+de+cierre+registrada.&caseId=case-1&caseTab=ejecucion" },
  );
  assert.deepEqual(calls, [{
    path: "/admin/after-sales/cases/case-1/closure-proofs?organizationId=org-1&shopId=shop-1",
    method: "POST",
    body: { resolutionId: "resolution-1", note: "Reparación comprobada por el técnico." },
  }]);
});

test("after-sales admin validates and sends an optional private closure image", async () => {
  const calls = [];
  const actions = loadAfterSalesActionsModule({
    requestAdminBff: async (pathValue, options = {}) => {
      calls.push({
        path: pathValue,
        method: options.init?.method,
        body: options.init?.body ? JSON.parse(options.init.body) : undefined,
      });
      return { ok: true, data: {}, status: 200, correlationId: "corr-closure-proof-image" };
    },
  });
  const formData = new FormData();
  formData.set("caseId", "case-1");
  formData.set("caseTab", "ejecucion");
  formData.set("resolutionId", "resolution-1");
  formData.set("note", "Sustitución entregada y revisada.");
  formData.set("evidenceIdempotencyKey", "closure-proof-image-1");
  formData.set("evidence", new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "prueba.jpg", { type: "image/jpeg" }));

  await assert.rejects(
    () => actions.recordAfterSalesClosureProofAction(formData),
    { url: "/admin/postventa?notice=Prueba+de+cierre+registrada.&caseId=case-1&caseTab=ejecucion" },
  );
  assert.deepEqual(calls, [{
    path: "/admin/after-sales/cases/case-1/closure-proofs?organizationId=org-1&shopId=shop-1",
    method: "POST",
    body: {
      resolutionId: "resolution-1",
      note: "Sustitución entregada y revisada.",
      evidence: {
        contentBase64: "/9j/AA==",
        mimeType: "image/jpeg",
        idempotencyKey: "closure-proof-image-1",
      },
    },
  }]);
});

test("after-sales admin finalizes the solution and registers its proof atomically", async () => {
  const calls = [];
  const actions = loadAfterSalesActionsModule({
    requestAdminBff: async (pathValue, options = {}) => {
      calls.push({
        path: pathValue,
        method: options.init?.method,
        body: options.init?.body ? JSON.parse(options.init.body) : undefined,
      });
      return { ok: true, data: {}, status: 200, correlationId: "corr-complete-with-proof" };
    },
  });
  const formData = new FormData();
  formData.set("caseId", "case-1");
  formData.set("caseTab", "ejecucion");
  formData.set("resolutionReason", "El reembolso acordado ya se ha completado.");
  formData.set("idempotencyKey", "completion-with-proof-1");
  formData.set("closureProofNote", "Comprobante de reembolso validado por el equipo.");
  formData.set("evidenceIdempotencyKey", "proof-1");
  formData.set("evidence", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "comprobante.png", { type: "image/png" }));

  await assert.rejects(
    () => actions.completeAfterSalesSolutionAction(formData),
    { url: "/admin/postventa?notice=Soluci%C3%B3n+finalizada.+El+cliente+puede+confirmar+el+cierre.&caseId=case-1&caseTab=ejecucion" },
  );
  assert.deepEqual(calls, [{
    path: "/admin/after-sales/cases/case-1/solution-finalization?organizationId=org-1&shopId=shop-1",
    method: "POST",
    body: {
      resolutionReason: "El reembolso acordado ya se ha completado.",
      closureProof: {
        note: "Comprobante de reembolso validado por el equipo.",
        evidence: {
          contentBase64: "iVBORw0KGgo=",
          mimeType: "image/png",
          idempotencyKey: "proof-1",
        },
      },
      idempotencyKey: "completion-with-proof-1",
    },
  }]);
});

test("after-sales admin does not split finalization when BFF rejects the atomic command", async () => {
  const calls = [];
  const actions = loadAfterSalesActionsModule({
    requestAdminBff: async (pathValue, options = {}) => {
      calls.push({
        path: pathValue,
        method: options.init?.method,
        body: options.init?.body ? JSON.parse(options.init.body) : undefined,
      });
      return { ok: false, error: "La devolución debe recibirse antes de finalizar.", status: 409, correlationId: "corr-finalization-rejected" };
    },
  });
  const formData = new FormData();
  formData.set("caseId", "case-1");
  formData.set("caseTab", "ejecucion");
  formData.set("resolutionReason", "El reembolso se ha completado.");
  formData.set("closureProofNote", "El equipo verificó el comprobante.");
  formData.set("idempotencyKey", "finalization-rejected-1");

  await assert.rejects(
    () => actions.completeAfterSalesSolutionAction(formData),
    { url: "/admin/postventa?notice=La+devoluci%C3%B3n+debe+recibirse+antes+de+finalizar.&noticeKind=error&caseId=case-1&caseTab=ejecucion" },
  );
  assert.deepEqual(calls, [{
    path: "/admin/after-sales/cases/case-1/solution-finalization?organizationId=org-1&shopId=shop-1",
    method: "POST",
    body: {
      resolutionReason: "El reembolso se ha completado.",
      closureProof: { note: "El equipo verificó el comprobante." },
      idempotencyKey: "finalization-rejected-1",
    },
  }]);
});

test("after-sales closure proof returns a visible validation notice instead of a Server Action error", async () => {
  const calls = [];
  const actions = loadAfterSalesActionsModule({
    requestAdminBff: async (...args) => {
      calls.push(args);
      return { ok: true, data: {}, status: 200, correlationId: "corr-unexpected" };
    },
  });
  const formData = new FormData();
  formData.set("caseId", "case-1");
  formData.set("caseTab", "ejecucion");
  formData.set("resolutionId", "resolution-1");
  formData.set("evidence", new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "prueba.jpg", { type: "image/jpeg" }));

  await assert.rejects(
    () => actions.recordAfterSalesClosureProofAction(formData),
    { url: "/admin/postventa?notice=Describe+internamente+c%C3%B3mo+se+verific%C3%B3+la+soluci%C3%B3n+antes+de+adjuntar+una+imagen.&noticeKind=error&caseId=case-1&caseTab=ejecucion" },
  );
  assert.deepEqual(calls, []);
});

test("after-sales task attendance retires one alert, preserves the case focus and refreshes its badge", async () => {
  const calls = [];
  const revalidations = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-after-sales-task" };
  };
  const actions = loadAfterSalesActionsModule({
    requestAdminBff,
    revalidatePath: (...args) => revalidations.push(args),
  });
  const attendance = new FormData();
  attendance.set("taskId", "task-1");
  attendance.set("caseId", "case-1");
  attendance.set("caseFocus", "evidence");

  await assert.rejects(() => actions.attendAfterSalesTaskAction(attendance), { url: "/admin/postventa?notice=Caso+atendido+y+tarea+retirada+de+la+cola.&caseId=case-1&caseTab=caso&caseFocus=evidence" });
  const invalidFilter = new FormData();
  invalidFilter.set("taskStatus", "OPEN;DROP");
  await assert.rejects(() => actions.applyAfterSalesTaskFiltersAction(invalidFilter), /Estado de tarea no es válido/);
  const invalidFocus = new FormData();
  invalidFocus.set("taskId", "task-2");
  invalidFocus.set("caseId", "case-1");
  invalidFocus.set("caseFocus", "internal-note");
  await assert.rejects(() => actions.attendAfterSalesTaskAction(invalidFocus), /Foco de caso no es válido/);

  assert.deepEqual(calls, [
    {
      path: "/admin/after-sales/tasks/task-1/attend?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: undefined,
    },
  ]);
  assert.deepEqual(revalidations, [["/admin/postventa"], ["/admin", "layout"]]);
});

test("after-sales proposal-rejection task opens the proposal tab after attendance", async () => {
  const actions = loadAfterSalesActionsModule({
    requestAdminBff: async () => ({ ok: true, data: {}, status: 200, correlationId: "corr-after-sales-rejection" }),
  });
  const attendance = new FormData();
  attendance.set("taskId", "task-rejection-1");
  attendance.set("caseId", "case-1");
  attendance.set("taskType", "SOLUTION_PROPOSAL_REJECTED");

  await assert.rejects(
    () => actions.attendAfterSalesTaskAction(attendance),
    { url: "/admin/postventa?notice=Caso+atendido+y+tarea+retirada+de+la+cola.&caseId=case-1&caseTab=propuesta" },
  );
});

test("after-sales proposal-acceptance task opens the execution tab after attendance", async () => {
  const actions = loadAfterSalesActionsModule({
    requestAdminBff: async () => ({ ok: true, data: {}, status: 200, correlationId: "corr-accepted-proposal" }),
  });
  const attendance = new FormData();
  attendance.set("taskId", "task-accepted-proposal");
  attendance.set("caseId", "case-1");
  attendance.set("taskType", "SOLUTION_PROPOSAL_ACCEPTED");

  await assert.rejects(
    () => actions.attendAfterSalesTaskAction(attendance),
    { url: "/admin/postventa?notice=Caso+atendido+y+tarea+retirada+de+la+cola.&caseId=case-1&caseTab=ejecucion" },
  );
});

test("after-sales guided solution actions only send the agreed proposal data", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method,
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });
    return { ok: true, data: {}, status: 200, correlationId: "corr-after-sales-solution" };
  };
  const actions = loadAfterSalesActionsModule({ requestAdminBff });
  const proposal = new FormData();
  proposal.set("caseId", "case-1");
  proposal.set("caseTab", "propuesta");
  proposal.set("solutionType", "REFUND");
  proposal.set("customerMessage", "Ofrecemos un reembolso de 51,18 €.");
  proposal.set("amount", "51,18 €");
  proposal.set("currency", "eur");
  proposal.set("returnRequired", "true");
  proposal.set("returnShippingPaidBy", "STORE");
  proposal.set("expiresInDays", "7");
  proposal.set("idempotencyKey", "proposal-1");
  const execution = new FormData();
  execution.set("caseId", "case-1");
  execution.set("caseTab", "ejecucion");
  execution.set("idempotencyKey", "execution-1");
  const completion = new FormData();
  completion.set("caseId", "case-1");
  completion.set("caseTab", "ejecucion");
  completion.set("resolutionReason", "El reembolso acordado ya se ha completado.");
  completion.set("closureProofNote", "Reembolso comprobado por el equipo.");
  completion.set("idempotencyKey", "completion-1");

  await assert.rejects(() => actions.sendAfterSalesSolutionProposalAction(proposal), { url: "/admin/postventa?notice=Propuesta+enviada+al+cliente.&caseId=case-1&caseTab=propuesta" });
  await assert.rejects(() => actions.startAfterSalesSolutionExecutionAction(execution), { url: "/admin/postventa?notice=La+soluci%C3%B3n+est%C3%A1+en+ejecuci%C3%B3n.&caseId=case-1&caseTab=ejecucion" });
  await assert.rejects(() => actions.completeAfterSalesSolutionAction(completion), { url: "/admin/postventa?notice=Soluci%C3%B3n+finalizada.+El+cliente+puede+confirmar+el+cierre.&caseId=case-1&caseTab=ejecucion" });

  assert.deepEqual(calls, [
    {
      path: "/admin/after-sales/cases/case-1/solution-proposals?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: {
        solutionType: "REFUND",
        customerMessage: "Ofrecemos un reembolso de 51,18 €.",
        amountMinor: 5118,
        currency: "EUR",
        returnRequired: true,
        returnShippingPaidBy: "STORE",
        expiresInDays: 7,
        idempotencyKey: "proposal-1",
      },
    },
    {
      path: "/admin/after-sales/cases/case-1/solution-execution?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: { idempotencyKey: "execution-1" },
    },
    {
      path: "/admin/after-sales/cases/case-1/solution-finalization?organizationId=org-1&shopId=shop-1",
      method: "POST",
      body: {
        resolutionReason: "El reembolso acordado ya se ha completado.",
        closureProof: {
          note: "Reembolso comprobado por el equipo.",
        },
        idempotencyKey: "completion-1",
      },
    },
  ]);
});

test("after-sales proposal normalizes human money formats and rejects ambiguous decimals", async () => {
  const calls = [];
  const actions = loadAfterSalesActionsModule({
    requestAdminBff: async (_pathValue, options = {}) => {
      calls.push(JSON.parse(options.init.body));
      return { ok: true, data: {}, status: 200, correlationId: "corr-money" };
    },
  });
  const proposal = new FormData();
  proposal.set("caseId", "case-1");
  proposal.set("solutionType", "REFUND");
  proposal.set("customerMessage", "Te reembolsaremos el importe indicado.");
  proposal.set("currency", "EUR");
  proposal.set("amount", "1.234,50 €");
  proposal.set("idempotencyKey", "proposal-money-format");

  await assert.rejects(() => actions.sendAfterSalesSolutionProposalAction(proposal), { url: /notice=Propuesta/ });
  assert.equal(calls[0].amountMinor, 123450);

  proposal.set("amount", "51,189");
  await assert.rejects(() => actions.sendAfterSalesSolutionProposalAction(proposal), /como máximo dos decimales/);
});

test("after-sales guided actions validate input and return public failure notices", async () => {
  const calls = [];
  const actions = loadAfterSalesActionsModule({
    requestAdminBff: async (pathValue, options = {}) => {
      calls.push({ path: pathValue, method: options.init?.method });
      return { ok: false, error: "No tienes permiso para realizar esta acción.", status: 403, correlationId: "corr-forbidden" };
    },
  });
  const invalidProposal = new FormData();
  invalidProposal.set("caseId", "case-1");
  invalidProposal.set("solutionType", "UNKNOWN");
  invalidProposal.set("customerMessage", "Propuesta no válida");
  const invalidCurrency = new FormData();
  invalidCurrency.set("caseId", "case-1");
  invalidCurrency.set("solutionType", "REFUND");
  invalidCurrency.set("customerMessage", "Reembolso");
  invalidCurrency.set("amountMinor", "5118");
  invalidCurrency.set("currency", "EURO");
  const forbiddenExecution = new FormData();
  forbiddenExecution.set("caseId", "case-1");
  forbiddenExecution.set("caseTab", "ejecucion");
  forbiddenExecution.set("idempotencyKey", "execution-forbidden");
  const pageSource = readFileSync(path.resolve(root, "src/modules/postventa/after-sales-admin-page.tsx"), "utf8");

  await assert.rejects(() => actions.sendAfterSalesSolutionProposalAction(invalidProposal), /Solución no es válido/);
  await assert.rejects(() => actions.sendAfterSalesSolutionProposalAction(invalidCurrency), /La moneda debe usar código ISO de tres letras/);
  await assert.rejects(() => actions.startAfterSalesSolutionExecutionAction(forbiddenExecution), { url: "/admin/postventa?notice=Falta+permiso+after-sales.manage.&noticeKind=error&caseId=case-1&caseTab=ejecucion" });

  assert.deepEqual(calls, [{
    path: "/admin/after-sales/cases/case-1/solution-execution?organizationId=org-1&shopId=shop-1",
    method: "POST",
  }]);
  assert.match(pageSource, /filters\.noticeKind === "error" \? "adminBannerError" : "adminBannerSuccess"/);
});
