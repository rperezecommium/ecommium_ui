import Link from "next/link";
import { randomUUID } from "crypto";
import { ClipboardCheck, FileText, Headphones, ImagePlus, PackageCheck, RotateCcw, Search, Send, UserRound, X } from "lucide-react";
import type {
  AfterSalesAdminCapabilities,
  AfterSalesAdminCase,
  AfterSalesAdminData,
  AfterSalesAdminDrawerTab,
  AfterSalesAdminEmployee,
  AfterSalesAdminFilters,
  AfterSalesAdminHistoryEvent,
  AfterSalesAdminMessage,
  AfterSalesAdminReferenceOption,
  AfterSalesAdminTask,
  AfterSalesAdminSolutionType,
} from "./after-sales-admin";
import {
  buildAfterSalesCaseHistory,
  getAfterSalesExecutionSummary,
  getAfterSalesWorkflowPresentation,
} from "./after-sales-admin";
import { AfterSalesEvidenceGallery } from "./after-sales-evidence-gallery";
import { AfterSalesResolutionForm } from "./after-sales-resolution-form";
import { AfterSalesSolutionProposalForm } from "./after-sales-solution-proposal-form";
import {
  applyAfterSalesFiltersAction,
  applyAfterSalesTaskFiltersAction,
  attendAfterSalesTaskAction,
  assignAfterSalesOwnerAction,
  authorizeAfterSalesReturnAction,
  completeAfterSalesSolutionAction,
  recordAfterSalesClosureProofAction,
  requestAfterSalesDocumentAdjustmentAction,
  requestAfterSalesInventoryDispositionAction,
  replyToAfterSalesCustomerAction,
  requestAfterSalesRefundAction,
  startAfterSalesSolutionExecutionAction,
  transitionAfterSalesCaseAction,
} from "./after-sales-admin-actions";

type Props = {
  capabilities: AfterSalesAdminCapabilities;
  data: AfterSalesAdminData;
  filters: AfterSalesAdminFilters;
};

const statuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "AWAITING_CUSTOMER",
  "AWAITING_RETURN",
  "RETURN_RECEIVED",
  "RESOLUTION_IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

const caseDrawerTabs: Array<{ id: AfterSalesAdminDrawerTab; label: string }> = [
  { id: "caso", label: "Caso" },
  { id: "propuesta", label: "Propuesta" },
  { id: "ejecucion", label: "Ejecución" },
  { id: "historial", label: "Historial" },
];

const legacyDrawerTabTargets = {
  operacion: "caso",
  devolucion: "ejecucion",
  resolucion: "ejecucion",
  auditoria: "historial",
} as const satisfies Record<string, AfterSalesAdminDrawerTab>;

function casesHref(filters: AfterSalesAdminFilters, patch: Partial<AfterSalesAdminFilters>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...patch };

  Object.entries(next).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  });

  return `/admin/postventa${params.size ? `?${params.toString()}` : ""}`;
}

function activeCaseDrawerTab(filters: AfterSalesAdminFilters): AfterSalesAdminDrawerTab {
  if (caseDrawerTabs.some((tab) => tab.id === filters.caseTab)) {
    return filters.caseTab as AfterSalesAdminDrawerTab;
  }

  return filters.caseTab && filters.caseTab in legacyDrawerTabTargets
    ? legacyDrawerTabTargets[filters.caseTab as keyof typeof legacyDrawerTabTargets]
    : "caso";
}

function lifecycleStatus(caseRecord: AfterSalesAdminCase) {
  if (caseRecord.lifecycleStatus) return caseRecord.lifecycleStatus;
  if (caseRecord.status === "CLOSED" || caseRecord.status === "CANCELLED") return "CLOSED";
  if (caseRecord.status === "RESOLVED" || caseRecord.status === "REJECTED") return "RESOLVED";
  return caseRecord.status === "SUBMITTED" ? "OPEN" : "IN_PROGRESS";
}

function lifecycleLabel(caseRecord: AfterSalesAdminCase) {
  const status = lifecycleStatus(caseRecord);
  if (status === "OPEN") return "Abierto";
  if (status === "IN_PROGRESS") return "En curso";
  if (status === "RESOLVED") return "Resuelto";
  return "Cerrado";
}

function resolutionOutcomeLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    REFUND: "Reembolso",
    EXCHANGE: "Cambio",
    REPAIR: "Reparación",
    REPLACEMENT: "Reemplazo",
    STORE_CREDIT: "Crédito en tienda",
    REJECTED: "Rechazado",
    NO_ACTION: "Sin acción",
    MIXED: "Resolución mixta",
  };
  return value ? labels[value] ?? value : "-";
}

function caseTransitionOptions(caseRecord: AfterSalesAdminCase) {
  const lifecycle = lifecycleStatus(caseRecord);
  if (lifecycle === "CLOSED") return [];
  if (lifecycle === "RESOLVED") {
    if (caseRecord.closureProofRequired) return [];
    return [{ value: "close", label: "Cerrar caso" }];
  }

  const status = caseRecord.status;
  switch (status) {
    case "SUBMITTED":
      return [{ value: "review", label: "Iniciar revision" }];
    case "UNDER_REVIEW":
      return [
        { value: "approve", label: "Aprobar caso" },
        { value: "reject", label: "Rechazar caso" },
      ];
    case "AWAITING_RETURN":
      return [{ value: "receive-return", label: "Registrar retorno recibido" }];
    case "RETURN_RECEIVED":
      return [{ value: "resolve", label: "Resolver caso" }];
    case "RESOLUTION_IN_PROGRESS":
      return [{ value: "resolve", label: "Resolver caso" }];
    default:
      return [];
  }
}


function valueText(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "-";
}

function dateText(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function conversationDateTimeText(value: string | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusBadgeClass(status: string | undefined) {
  const value = status?.toUpperCase();
  if (value === "APPROVED" || value === "RESOLVED" || value === "CLOSED" || value === "RETURN_RECEIVED" || value === "DONE") {
    return "adminBadge adminBadgeOk";
  }
  if (value === "OPEN" || value === "IN_PROGRESS" || value === "SUBMITTED" || value === "UNDER_REVIEW" || value === "AWAITING_CUSTOMER" || value === "AWAITING_RETURN" || value === "RESOLUTION_IN_PROGRESS") {
    return "adminBadge adminBadgeWarn";
  }
  if (value === "REJECTED" || value === "CANCELLED") {
    return "adminBadge adminBadgeError";
  }

  return "adminBadge";
}

function recordField(value: unknown, keys: string[]) {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  for (const key of keys) {
    const field = record[key];
    if (typeof field === "string" || typeof field === "number" || typeof field === "boolean") {
      return String(field);
    }
  }

  return undefined;
}

function ResultBanner({ result }: { result: { ok: boolean; error?: string } }) {
  if (result.ok) {
    return null;
  }

  return (
    <div className="adminBanner adminBannerError">
      <p>{result.error}</p>
    </div>
  );
}

function FiltersPanel({ filters, employees }: { filters: AfterSalesAdminFilters; employees: AfterSalesAdminEmployee[] }) {
  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Busqueda postventa</h2>
          <p>Filtra por caso, pedido, cliente, estado o responsable.</p>
        </div>
        <Search aria-hidden="true" size={18} />
      </div>
      <form action={applyAfterSalesFiltersAction} className="pricingDenseForm">
        <label className="adminField">
          <span>Caso</span>
          <input name="caseId" placeholder="caseId" defaultValue={filters.caseId ?? ""} />
        </label>
        <label className="adminField">
          <span>Pedido</span>
          <input name="orderId" placeholder="orderId" defaultValue={filters.orderId ?? ""} />
        </label>
        <label className="adminField">
          <span>Cliente</span>
          <input name="customerId" placeholder="customerId" defaultValue={filters.customerId ?? ""} />
        </label>
        <label className="adminField">
          <span>Responsable</span>
          <select name="assignedEmployeeId" defaultValue={filters.assignedEmployeeId ?? ""}>
            <option value="">Todos</option>
            {employees.filter((employee) => employee.active).map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.label}</option>)}
          </select>
        </label>
        <label className="adminField">
          <span>Estado</span>
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="adminField">
          <span>Limite</span>
          <input name="limit" min="1" max="100" type="number" defaultValue={filters.limit ?? "25"} />
        </label>
        <button className="adminButton adminButtonPrimary" type="submit">Buscar</button>
      </form>
    </section>
  );
}

function CasesKpis({ data }: Pick<Props, "data">) {
  const cases = data.cases.ok ? data.cases.data.items : [];
  const open = cases.filter((item) => ["OPEN", "IN_PROGRESS"].includes(lifecycleStatus(item))).length;
  const unassigned = cases.filter((item) => !item.assignedEmployeeId).length;
  const awaitingReturn = cases.filter((item) => item.status === "AWAITING_RETURN").length;

  return (
    <section className="adminKpiGrid">
      <div className="adminKpi">
        <span>After Sales</span>
        <strong>{data.health.ok ? valueText(data.health.data?.status) : "Sin conexion"}</strong>
        <p>{data.health.ok ? `DB ${data.health.data?.databaseReachable ? "ok" : "pendiente"}` : data.health.error}</p>
      </div>
      <div className="adminKpi">
        <span>Casos abiertos</span>
        <strong>{open}</strong>
        <p>{data.cases.ok ? `${data.cases.data.total} en filtro` : "Sin datos"}</p>
      </div>
      <div className="adminKpi">
        <span>Sin responsable</span>
        <strong>{unassigned}</strong>
        <p>Requieren asignacion</p>
      </div>
      <div className="adminKpi">
        <span>Esperando retorno</span>
        <strong>{awaitingReturn}</strong>
        <p>{data.health.ok && data.health.data?.publisherEnabled ? "Eventos activos" : "Eventos pendientes"}</p>
      </div>
    </section>
  );
}

function CasesTable({ capabilities, data, filters }: Pick<Props, "capabilities" | "data" | "filters">) {
  if (!data.cases.ok) {
    return <ResultBanner result={data.cases} />;
  }

  if (!data.cases.data.items.length) {
    return <div className="adminEmptyState">No hay casos para el filtro actual.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th>Caso</th>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Ciclo</th>
            <th>Responsable</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.cases.data.items.map((item) => {
            const activeEmployees = data.employees.ok ? data.employees.data.filter((employee) => employee.active) : [];
            const editable = lifecycleStatus(item) !== "CLOSED";

            return (
            <tr key={item.caseId}>
              <td>
                <strong>{item.caseId}</strong>
                <div className="adminMuted">{dateText(item.submittedAt ?? item.createdAt)}</div>
              </td>
              <td>{valueText(item.orderId)}</td>
              <td>{valueText(item.customerId)}</td>
              <td>{valueText(item.caseType)}</td>
              <td><span className={statusBadgeClass(lifecycleStatus(item))}>{lifecycleLabel(item)}</span><div className="adminMuted">{valueText(item.operationalStage ?? item.status)}</div></td>
              <td>{capabilities.canManageAfterSales && editable && activeEmployees.length ? (
                <form action={assignAfterSalesOwnerAction} className="afterSalesTaskAssignment">
                  <input name="caseId" type="hidden" value={item.caseId} />
                  <select aria-label={`Responsable del caso ${item.caseId}`} defaultValue={item.assignedEmployeeId ?? "__null__"} name="assignedEmployeeId">
                    <option value="__null__">Sin responsable</option>
                    {activeEmployees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.label}</option>)}
                  </select>
                  <button className="adminButton adminButtonTiny" type="submit">Asignar</button>
                </form>
              ) : valueText(item.assignedEmployeeId)}</td>
              <td>
                <Link className="adminButton adminButtonTiny" href={casesHref(filters, { caseId: item.caseId })}>
                  {capabilities.canManageAfterSales ? "Atender" : "Ver caso"}
                </Link>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function taskTypeLabel(taskType: AfterSalesAdminTask["taskType"]) {
  if (taskType === "CUSTOMER_MESSAGE") return "Mensaje del cliente";
  if (taskType === "EVIDENCE_REVIEW") return "Evidencia pendiente";
  if (taskType === "SOLUTION_PROPOSAL_REJECTED") return "Propuesta rechazada";
  if (taskType === "SOLUTION_PROPOSAL_ACCEPTED") return "Propuesta aceptada";
  return "Caso nuevo";
}

function taskStatusLabel(status: AfterSalesAdminTask["status"]) {
  return status === "ASSIGNED" ? "Asignada" : "Pendiente";
}

function TaskInbox({ capabilities, data, filters }: Pick<Props, "capabilities" | "data" | "filters">) {
  if (!data.tasks.ok) {
    return <ResultBanner result={data.tasks} />;
  }

  const { items, limit, offset, total } = data.tasks.data;
  const previousOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  return (
    <section className="adminCard afterSalesTasksCard">
      <div className="adminCardHeader">
        <div>
          <h2>Cola operativa</h2>
          <p>Tareas de casos, mensajes y evidencias; no contienen texto ni archivos privados.</p>
        </div>
        <span className="adminBadge adminBadgeWarn">{data.taskSummary.ok ? data.taskSummary.data?.pendingCount ?? 0 : "-"} pendientes</span>
      </div>
      <form action={applyAfterSalesTaskFiltersAction} className="pricingDenseForm afterSalesTaskFilters">
        <label className="adminField">
          <span>Tipo</span>
          <select defaultValue={filters.taskType ?? ""} name="taskType">
            <option value="">Todos</option>
            <option value="NEW_CASE">Caso nuevo</option>
            <option value="CUSTOMER_MESSAGE">Mensaje del cliente</option>
            <option value="EVIDENCE_REVIEW">Evidencia</option>
            <option value="SOLUTION_PROPOSAL_REJECTED">Propuesta rechazada</option>
            <option value="SOLUTION_PROPOSAL_ACCEPTED">Propuesta aceptada</option>
          </select>
        </label>
        <label className="adminField">
          <span>Estado</span>
          <select defaultValue={filters.taskStatus ?? ""} name="taskStatus">
            <option value="">Todos</option>
            <option value="OPEN">Abierta</option>
            <option value="ASSIGNED">Asignada</option>
          </select>
        </label>
        <button className="adminButton" type="submit">Filtrar tareas</button>
      </form>
      {items.length ? (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable">
            <thead>
              <tr><th>Tarea</th><th>Caso</th><th>Estado</th><th>Actividad</th>{capabilities.canManageAfterSales ? <th>Acciones</th> : null}</tr>
            </thead>
            <tbody>
              {items.map((task) => (
                <tr key={task.taskId}>
                  <td><strong>{taskTypeLabel(task.taskType)}</strong><div className="adminMuted">{task.priority === "HIGH" ? "Prioridad alta" : "Prioridad normal"}</div></td>
                  <td>{task.caseId}</td>
                  <td><span className={statusBadgeClass(task.status)}>{taskStatusLabel(task.status)}</span></td>
                  <td>{dateText(task.lastActivityAt)}</td>
                  {capabilities.canManageAfterSales ? <td><form action={attendAfterSalesTaskAction}><input name="taskId" type="hidden" value={task.taskId} /><input name="caseId" type="hidden" value={task.caseId} /><input name="taskType" type="hidden" value={task.taskType} />{task.taskType === "CUSTOMER_MESSAGE" ? <input name="caseFocus" type="hidden" value="message" /> : null}{task.taskType === "EVIDENCE_REVIEW" ? <input name="caseFocus" type="hidden" value="evidence" /> : null}<button className="adminButton adminButtonTiny" type="submit">Atender</button></form></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="adminEmptyState">No hay tareas para el filtro actual.</div>}
      {total > limit ? <div className="adminButtonRow afterSalesTaskPagination">{offset > 0 ? <Link className="adminButton adminButtonTiny" href={casesHref(filters, { taskLimit: String(limit), taskOffset: String(previousOffset) })}>Anterior</Link> : null}{nextOffset < total ? <Link className="adminButton adminButtonTiny" href={casesHref(filters, { taskLimit: String(limit), taskOffset: String(nextOffset) })}>Siguiente</Link> : null}<span className="adminMuted">{offset + 1}-{Math.min(offset + items.length, total)} de {total}</span></div> : null}
    </section>
  );
}

function DetailSummary({
  selectedCase,
  customerReference,
}: {
  selectedCase: AfterSalesAdminCase;
  customerReference: string | null;
}) {
  return (
    <>
      <dl className="adminDefinitionList adminDetailFields">
        <div><dt>Caso</dt><dd>{selectedCase.caseId}</dd></div>
        <div><dt>Pedido</dt><dd>{selectedCase.orderId}</dd></div>
        <div><dt>Cliente</dt><dd>{valueText(customerReference ?? selectedCase.customerId)}</dd></div>
        <div><dt>Tipo</dt><dd>{valueText(selectedCase.caseType)}</dd></div>
        <div><dt>Motivo del cliente</dt><dd className="afterSalesCustomerReasonCell">{selectedCase.customerMessage ? <><span aria-hidden="true">“</span><em>{selectedCase.customerMessage}</em><span aria-hidden="true">”</span></> : "-"}</dd></div>
        <div><dt>Ciclo</dt><dd><span className={statusBadgeClass(lifecycleStatus(selectedCase))}>{lifecycleLabel(selectedCase)}</span></dd></div>
        <div><dt>Etapa operativa</dt><dd>{valueText(selectedCase.operationalStage ?? selectedCase.status)}</dd></div>
        <div><dt>Resultado</dt><dd>{resolutionOutcomeLabel(selectedCase.resolutionOutcome)}</dd></div>
        <div><dt>Explicación de la resolución</dt><dd>{valueText(selectedCase.resolutionReason)}</dd></div>
        {lifecycleStatus(selectedCase) === "RESOLVED" ? <div><dt>Cierre automático</dt><dd>{dateText(selectedCase.autoCloseAt)}</dd></div> : null}
        {lifecycleStatus(selectedCase) === "CLOSED" ? <div><dt>Cerrado</dt><dd>{dateText(selectedCase.closedAt)}</dd></div> : null}
        <div><dt>Responsable</dt><dd>{valueText(selectedCase.assignedEmployeeId)}</dd></div>
        <div><dt>Categoría</dt><dd>{valueText(selectedCase.reasonCode)}</dd></div>
        <div><dt>Enviado</dt><dd>{dateText(selectedCase.submittedAt ?? selectedCase.createdAt)}</dd></div>
      </dl>
      <div className="adminButtonRow">
        <Link className="adminButton" href={`/admin/pedidos?orderId=${encodeURIComponent(selectedCase.orderId)}`}>Abrir pedido</Link>
        {customerReference ? (
          <Link
            className="adminButton"
            href={`/admin/clientes/${encodeURIComponent(customerReference)}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            Abrir cliente
          </Link>
        ) : null}
      </div>
    </>
  );
}

function CaseItemsPanel({ selectedCase }: { selectedCase: AfterSalesAdminCase }) {
  if (!selectedCase.items.length) {
    return <div className="adminEmptyState">Sin lineas de caso.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th>Item</th>
            <th>Producto</th>
            <th>Solicitado</th>
            <th>Aprobado</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {selectedCase.items.map((item) => (
            <tr key={item.caseItemId}>
              <td>
                <strong>{valueText(item.name ?? item.caseItemId)}</strong>
                <div className="adminMuted">{item.caseItemId}</div>
              </td>
              <td>{valueText(item.productId ?? item.variantId)}</td>
              <td>{valueText(item.quantityRequested)}</td>
              <td>{valueText(item.quantityApproved)}</td>
              <td>{valueText(item.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function moneyText(amountMinor: number | null, currency: string | null) {
  if (amountMinor === null || !currency) return "No aplica";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(amountMinor / 100);
}

function SolutionProposalPanel({
  capabilities,
  currency,
  selectedCase,
}: {
  capabilities: AfterSalesAdminCapabilities;
  currency: string;
  selectedCase: AfterSalesAdminCase;
}) {
  const proposals = [...selectedCase.solutionProposals].sort((left, right) => right.version - left.version);
  const proposal = proposals[0] ?? null;
  const workflow = getAfterSalesWorkflowPresentation(selectedCase);
  const canSendProposal = workflow.primaryAction === "SEND_PROPOSAL" && capabilities.canManageAfterSales;

  if (!proposal) {
    return (
      <section className="adminCard">
        <div className="adminCardHeader"><div><h3>Propuesta de solución</h3><p>Cuando tengas toda la información, aquí podrás ofrecer una solución clara al cliente.</p></div><FileText aria-hidden="true" size={18} /></div>
        {canSendProposal ? <AfterSalesSolutionProposalForm currency={currency} selectedCase={selectedCase} /> : <div className="adminEmptyState">Todavía no se ha enviado una propuesta.</div>}
      </section>
    );
  }

  return (
    <>
      <section className="adminCard">
        <div className="adminCardHeader">
          <div><h3>Propuesta de solución</h3><p>Versión {proposal.version} enviada al cliente.</p></div>
          <span className={statusBadgeClass(proposal.status)}>{proposal.status === "PENDING_CUSTOMER" ? "Esperando respuesta" : proposal.status}</span>
        </div>
        <dl className="ordersFulfillmentSummaryMeta">
          <div><dt>Solución</dt><dd>{resolutionOutcomeLabel(proposal.solutionType)}</dd></div>
          <div><dt>Importe</dt><dd>{moneyText(proposal.amountMinor, proposal.currency)}</dd></div>
          <div><dt>Devolución</dt><dd>{proposal.returnRequired ? "Requerida" : "No requerida"}</dd></div>
          {proposal.returnRequired ? <div><dt>Transporte</dt><dd>{proposal.returnShippingPaidBy === "STORE" ? "Asumido por la tienda" : "Asumido por el cliente"}</dd></div> : null}
          <div><dt>Enviada</dt><dd>{dateText(proposal.createdAt)}</dd></div>
          {proposal.expiresAt ? <div><dt>Vence</dt><dd>{dateText(proposal.expiresAt)}</dd></div> : null}
        </dl>
        {proposal.customerMessage ? (
          <div className="afterSalesProposalCustomerMessage">
            <strong>Mensaje del equipo para el cliente</strong>
            <p>“{proposal.customerMessage}”</p>
          </div>
        ) : null}
      </section>
      {canSendProposal ? (
        <section className="adminCard">
          <div className="adminCardHeader"><div><h3>Nueva propuesta de solución</h3><p>La oferta anterior queda en el historial; esta se enviará como una nueva versión.</p></div><FileText aria-hidden="true" size={18} /></div>
          <AfterSalesSolutionProposalForm currency={currency} selectedCase={selectedCase} />
        </section>
      ) : null}
    </>
  );
}

function ExecutionPanel({
  capabilities,
  currency,
  invoiceOptions,
  paymentOptions,
  selectedCase,
}: {
  capabilities: AfterSalesAdminCapabilities;
  currency: string;
  invoiceOptions: AfterSalesAdminReferenceOption[];
  paymentOptions: AfterSalesAdminReferenceOption[];
  selectedCase: AfterSalesAdminCase;
}) {
  const workflow = getAfterSalesWorkflowPresentation(selectedCase);
  const summary = getAfterSalesExecutionSummary(selectedCase);
  const isLegacyExecution = workflow.usesLegacyOperations
    || (!summary.acceptedProposal && ["APPROVED", "AWAITING_RETURN", "RETURN_RECEIVED", "RESOLUTION_IN_PROGRESS"].includes(selectedCase.status ?? ""));

  if (lifecycleStatus(selectedCase) === "RESOLVED" && selectedCase.closureProofRequired) {
    return <ClosureProofPanel capabilities={capabilities} selectedCase={selectedCase} />;
  }

  if (isLegacyExecution) {
    return (
      <div className="afterSalesDrawerTabPanel">
        <section className="adminCard">
          <div className="adminCardHeader"><div><h3>Operación histórica</h3><p>Este expediente se inició antes del acuerdo guiado. Sus controles se mantienen agrupados hasta completarlo.</p></div><RotateCcw aria-hidden="true" size={18} /></div>
          {capabilities.canManageAfterSales ? <TransitionForms caseTab="ejecucion" selectedCase={selectedCase} /> : null}
          <details>
            <summary>Ver operaciones específicas del caso histórico</summary>
            {capabilities.canManageAfterSales ? <ReturnAuthorizationForm caseTab="ejecucion" selectedCase={selectedCase} /> : null}
            {capabilities.canManageAfterSales ? <ImpactForms caseTab="ejecucion" currency={currency} invoiceOptions={invoiceOptions} paymentOptions={paymentOptions} selectedCase={selectedCase} /> : null}
          </details>
        </section>
      </div>
    );
  }

  if (!summary.acceptedProposal) {
    return <div className="adminEmptyState">La ejecución estará disponible cuando el cliente acepte una propuesta.</div>;
  }

  return (
    <section className="adminCard">
      <div className="adminCardHeader"><div><h3>Solución acordada</h3><p>El sistema registra el avance operativo; los detalles técnicos permanecen en el historial.</p></div><PackageCheck aria-hidden="true" size={18} /></div>
      <dl className="ordersFulfillmentSummaryMeta">
        <div><dt>Solución</dt><dd>{resolutionOutcomeLabel(summary.acceptedProposal.solutionType)}</dd></div>
        <div><dt>Resolución</dt><dd>{summary.resolution ? valueText(summary.resolution.status) : "Pendiente de iniciar"}</dd></div>
        {summary.requiresReturn ? <div><dt>Devolución</dt><dd>{summary.returnReceived ? "Producto recibido" : "Pendiente de recepción"}</dd></div> : null}
        {summary.requiresRefund ? <div><dt>Reembolso</dt><dd>{summary.refundCompleted ? "Completado" : summary.refundStatus ? "En curso" : "Pendiente"}</dd></div> : null}
      </dl>
      <p className="adminMuted">{workflow.detail}</p>
      {capabilities.canManageAfterSales && workflow.primaryAction === "START_SOLUTION_EXECUTION" ? <SolutionExecutionAction action="start" caseId={selectedCase.caseId} /> : null}
      {capabilities.canManageAfterSales && workflow.primaryAction === "PROCESS_REFUND" ? (
        <RefundExecutionAction
          caseId={selectedCase.caseId}
          paymentOptions={paymentOptions}
          resolutionId={summary.resolution?.resolutionId ?? null}
        />
      ) : null}
      {capabilities.canManageAfterSales && workflow.primaryAction === "COMPLETE_SOLUTION" ? (
        <SolutionExecutionAction
          action="complete"
          caseId={selectedCase.caseId}
          solutionType={summary.acceptedProposal.solutionType}
        />
      ) : null}
    </section>
  );
}

function RefundExecutionAction({
  caseId,
  paymentOptions,
  resolutionId,
}: {
  caseId: string;
  paymentOptions: AfterSalesAdminReferenceOption[];
  resolutionId: string | null;
}) {
  if (!resolutionId) {
    return <div className="adminEmptyState">Aún no hay una resolución preparada para procesar el reembolso.</div>;
  }

  if (!paymentOptions.length) {
    return <div className="adminEmptyState">No hay un pago disponible para reembolsar. La solución no puede finalizarse todavía.</div>;
  }

  const hasSinglePayment = paymentOptions.length === 1;
  return (
    <form action={requestAfterSalesRefundAction} className="pricingDenseForm">
      <input name="caseId" type="hidden" value={caseId} />
      <input name="caseTab" type="hidden" value="ejecucion" />
      <input name="resolutionId" type="hidden" value={resolutionId} />
      {hasSinglePayment ? (
        <input name="transactionId" type="hidden" value={paymentOptions[0].id} />
      ) : (
        <label className="adminField">
          <span>Pago que se reembolsará</span>
          <select defaultValue="" name="transactionId" required>
            <option disabled value="">Selecciona el pago</option>
            {paymentOptions.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}
          </select>
        </label>
      )}
      <button className="adminButton adminButtonPrimary" type="submit">Procesar reembolso</button>
    </form>
  );
}

function ClosureProofPanel({
  capabilities,
  selectedCase,
}: {
  capabilities: AfterSalesAdminCapabilities;
  selectedCase: AfterSalesAdminCase;
}) {
  const activeProof = selectedCase.closureProofs.find((proof) => proof.invalidatedAt === null) ?? null;
  const completedResolution = selectedCase.resolutions.find((resolution) => resolution.status === "COMPLETED") ?? null;
  const proofEvidenceIds = activeProof?.evidenceId ? [activeProof.evidenceId] : [];

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h3>Prueba de cierre</h3>
          <p>Registro interno de que la solución se ha completado. El cliente no verá esta nota ni la imagen.</p>
        </div>
        <ImagePlus aria-hidden="true" size={18} />
      </div>
      {activeProof ? (
        <div className="adminStatusList">
          <p><span className="adminBadge adminBadgeOk">Registrada</span> {dateText(activeProof.createdAt)}</p>
          <p>{activeProof.note ?? "Sin nota."}</p>
          {proofEvidenceIds.length ? (
            <AfterSalesEvidenceGallery
              caseId={selectedCase.caseId}
              evidenceIds={proofEvidenceIds}
              emptyMessage="La prueba se registró sin imagen adjunta."
              evidences={selectedCase.evidences}
              title="Imagen interna"
            />
          ) : null}
          <p className="adminMuted">El cliente ya puede confirmar que recibió la solución. Si no responde, el caso se cerrará automáticamente el {dateText(selectedCase.autoCloseAt)}. No requiere un cierre manual del equipo.</p>
        </div>
      ) : capabilities.canManageAfterSales && completedResolution ? (
        <form action={recordAfterSalesClosureProofAction} className="pricingDenseForm">
          <input name="caseId" type="hidden" value={selectedCase.caseId} />
          <input name="caseTab" type="hidden" value="ejecucion" />
          <input name="resolutionId" type="hidden" value={completedResolution.resolutionId} />
          <input name="evidenceIdempotencyKey" type="hidden" value={`admin-after-sales-closure-proof-image-${randomUUID()}`} />
          <label className="adminField">
            <span>Nota interna (obligatoria)</span>
            <textarea maxLength={4000} name="note" placeholder="Describe cómo se verificó la solución." required rows={3} />
          </label>
          <label className="adminField">
            <span>Imagen privada (opcional)</span>
            <input accept="image/jpeg,image/png,image/webp" name="evidence" type="file" />
            <small>JPG, PNG o WebP, hasta 6 MB. Solo es visible para el equipo.</small>
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Registrar prueba de cierre</button>
        </form>
      ) : (
        <div className="adminEmptyState">La solución no contiene una resolución completada apta para registrar la prueba de cierre.</div>
      )}
    </section>
  );
}

function SolutionExecutionAction({
  action,
  caseId,
  solutionType,
}: {
  action: "start" | "complete";
  caseId: string;
  solutionType?: AfterSalesAdminSolutionType;
}) {
  const isCompletion = action === "complete";
  const completionProofCopy = solutionType === "REFUND"
    ? {
        legend: "Confirmación interna del reembolso",
        detail: "Regístrala únicamente cuando Payments haya confirmado que el dinero fue devuelto a la cuenta del cliente. La nota interna es obligatoria; la imagen es opcional y solo la verá el equipo.",
        label: "Cómo se confirmó el reembolso (obligatorio)",
        placeholder: "Ej.: Payments confirma el reembolso; comprobante adjunto.",
      }
    : solutionType === "EXCHANGE" || solutionType === "REPLACEMENT"
      ? {
          legend: "Confirmación interna de entrega",
          detail: "Regístrala únicamente cuando se haya confirmado la entrega del cambio o reemplazo. La nota interna es obligatoria; la imagen es opcional y solo la verá el equipo.",
          label: "Cómo se confirmó la entrega (obligatorio)",
          placeholder: "Ej.: transportista confirma la entrega; comprobante adjunto.",
        }
      : {
          legend: "Confirmación interna de la solución",
          detail: "Regístrala únicamente cuando se haya confirmado la reparación o el servicio acordado. La nota interna es obligatoria; la imagen es opcional y solo la verá el equipo.",
          label: "Cómo se confirmó la solución (obligatorio)",
          placeholder: "Ej.: reparación comprobada y producto entregado.",
        };
  return (
    <form action={isCompletion ? completeAfterSalesSolutionAction : startAfterSalesSolutionExecutionAction} className={isCompletion ? "pricingDenseForm" : "adminButtonRow"}>
      <input name="caseId" type="hidden" value={caseId} />
      <input name="caseTab" type="hidden" value="ejecucion" />
      <input name="idempotencyKey" type="hidden" value={`admin-after-sales-${isCompletion ? "solution-finalization" : "execution"}-${randomUUID()}`} />
      {isCompletion ? (
        <label className="adminField">
          <span>Explicación de la resolución</span>
          <textarea maxLength={4000} name="resolutionReason" placeholder="Explica al cliente cómo se ha completado la solución." required rows={3} />
        </label>
      ) : null}
      {isCompletion ? (
        <fieldset className="afterSalesClosureProofCapture">
          <legend>{completionProofCopy.legend}</legend>
          <p>{completionProofCopy.detail}</p>
          <input name="evidenceIdempotencyKey" type="hidden" value={`admin-after-sales-closure-proof-image-${randomUUID()}`} />
          <label className="adminField">
            <span>{completionProofCopy.label}</span>
            <textarea maxLength={4000} name="closureProofNote" placeholder={completionProofCopy.placeholder} required rows={3} />
          </label>
          <label className="adminField">
            <span>Adjuntar imagen (opcional)</span>
            <input accept="image/jpeg,image/png,image/webp" name="evidence" type="file" />
            <small>JPG, PNG o WebP, hasta 6 MB. Una imagen por prueba.</small>
          </label>
        </fieldset>
      ) : null}
      <button className="adminButton" type="submit">{isCompletion ? "Marcar como resuelta y avisar al cliente" : "Procesar solución"}</button>
    </form>
  );
}

function AfterSalesDrawerSummary({ selectedCase }: { selectedCase: AfterSalesAdminCase }) {
  const workflow = getAfterSalesWorkflowPresentation(selectedCase);

  return (
    <section className="ordersFulfillmentSummary afterSalesDrawerSummary">
      <div className="ordersFulfillmentSummaryHeader">
        <div>
          <span>Estado actual</span>
          <strong>{workflow.title}</strong>
          <p>{workflow.detail}</p>
        </div>
        <span className={statusBadgeClass(selectedCase.status)}>{workflow.title}</span>
      </div>
      <dl className="ordersFulfillmentSummaryMeta">
        <div><dt>Responsable</dt><dd>{valueText(selectedCase.assignedEmployeeId)}</dd></div>
        <div><dt>Pedido</dt><dd>{selectedCase.orderId}</dd></div>
        <div><dt>Productos</dt><dd>{selectedCase.items.length}</dd></div>
        {lifecycleStatus(selectedCase) === "RESOLVED" ? <div><dt>Confirmación hasta</dt><dd>{dateText(selectedCase.autoCloseAt)}</dd></div> : null}
      </dl>
    </section>
  );
}

function AfterSalesDrawerTabs({
  filters,
  activeTab,
}: {
  filters: AfterSalesAdminFilters;
  activeTab: AfterSalesAdminDrawerTab;
}) {
  return (
    <nav aria-label="Secciones del caso" className="productEditorTabs ordersDrawerTabs afterSalesDrawerTabs">
      {caseDrawerTabs.map((tab) => (
        <Link
          aria-current={activeTab === tab.id ? "page" : undefined}
          className={`productEditorTab${activeTab === tab.id ? " productEditorTabActive" : ""}`}
          href={casesHref(filters, { caseTab: tab.id, notice: undefined })}
          key={tab.id}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function historyActorLabel(actor: AfterSalesAdminHistoryEvent["actor"]) {
  if (actor === "CUSTOMER") return "Cliente";
  if (actor === "TEAM") return "Equipo";
  return "Sistema";
}

function HistoryEventIcon({ event }: { event: AfterSalesAdminHistoryEvent }) {
  if (event.actor === "CUSTOMER") return <UserRound aria-hidden="true" size={16} />;
  if (event.actor === "TEAM") return <Headphones aria-hidden="true" size={16} />;
  return <PackageCheck aria-hidden="true" size={16} />;
}

function CaseHistoryTimelinePanel({
  caseId,
  evidences,
  events,
}: {
  caseId: string;
  evidences: AfterSalesAdminCase["evidences"];
  events: AfterSalesAdminHistoryEvent[];
}) {
  if (!events.length) {
    return <div className="adminEmptyState">Aún no hay actividad registrada para este caso.</div>;
  }

  return (
    <ol className="afterSalesHistoryTimeline">
      {events.map((event) => (
        <li className={`afterSalesHistoryEvent afterSalesHistoryEvent${event.actor[0]}${event.visibility === "INTERNAL" ? " afterSalesHistoryEventInternal" : ""}`} key={event.eventId}>
          <span className="afterSalesHistoryEventIcon"><HistoryEventIcon event={event} /></span>
          <div className="afterSalesHistoryEventBody">
            <div className="afterSalesHistoryEventMeta">
              <strong>{event.title}</strong>
              <time dateTime={event.occurredAt}>{dateText(event.occurredAt)}</time>
            </div>
            <div className="afterSalesHistoryEventLabels">
              <span>{historyActorLabel(event.actor)}</span>
              {event.visibility === "INTERNAL" ? <span className="adminBadge">Solo equipo</span> : null}
            </div>
            {event.detail ? <blockquote>{event.detail}</blockquote> : null}
            {event.proposal ? (
              <dl className="afterSalesHistoryProposalSummary">
                <div><dt>Propuesta {event.proposal.version}</dt><dd>{event.proposal.solutionLabel}</dd></div>
                {event.proposal.amountMinor !== null && event.proposal.currency ? <div><dt>Importe</dt><dd>{moneyText(event.proposal.amountMinor, event.proposal.currency)}</dd></div> : null}
                {event.proposal.returnRequired ? <div><dt>Devolución</dt><dd>Requerida</dd></div> : null}
              </dl>
            ) : null}
            {event.execution ? (
              <dl className="afterSalesHistoryExecutionSummary">
                <div><dt>Resultado</dt><dd>{event.execution.label}</dd></div>
                {event.execution.amountMinor !== null && event.execution.amountMinor !== undefined && event.execution.currency ? <div><dt>Importe</dt><dd>{moneyText(event.execution.amountMinor, event.execution.currency)}</dd></div> : null}
              </dl>
            ) : null}
            {event.evidenceId ? (
              <AfterSalesEvidenceGallery
                caseId={caseId}
                evidenceIds={[event.evidenceId]}
                evidences={evidences}
                variant="inline"
              />
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function CustomerConversationPanel({
  canManage,
  caseTab,
  messages,
  selectedCase,
}: {
  canManage: boolean;
  caseTab: AfterSalesAdminDrawerTab;
  messages: AfterSalesAdminMessage[];
  selectedCase: AfterSalesAdminCase;
}) {
  const chronologicalMessages = [...messages].sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""));

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h3>Conversacion con el cliente</h3>
          <p>El cliente ve este mismo historial en su caso. Cada respuesta del equipo genera un aviso por email.</p>
        </div>
      </div>
      {chronologicalMessages.length ? (
        <div className="afterSalesConversationThread" aria-label="Historial de conversación">
          {chronologicalMessages.map((message) => {
            const isCustomer = message.authorType === "CUSTOMER";
            const author = isCustomer ? "Cliente" : "Equipo";

            return (
              <article className={`afterSalesConversationMessage ${isCustomer ? "afterSalesConversationMessageCustomer" : "afterSalesConversationMessageTeam"}`} key={message.messageId}>
                <div className="afterSalesConversationMeta">
                  <span aria-hidden="true" className="afterSalesConversationAvatar">
                    {isCustomer ? <UserRound size={22} /> : <Headphones size={22} />}
                  </span>
                  <div className="afterSalesConversationIdentity">
                    <strong>{author}</strong>
                    {message.kind === "OPENING" ? <span>Mensaje inicial</span> : null}
                  </div>
                  <time dateTime={message.createdAt}>{conversationDateTimeText(message.createdAt)}</time>
                </div>
                <p className="afterSalesConversationBubble">{valueText(message.body)}</p>
              </article>
            );
          })}
        </div>
      ) : <div className="adminEmptyState">Aun no hay mensajes en el historial.</div>}
      {lifecycleStatus(selectedCase) === "CLOSED" ? <p className="adminEmptyState">El expediente está cerrado y conserva este historial en modo consulta.</p> : canManage ? (
        <form action={replyToAfterSalesCustomerAction} className="afterSalesConversationComposer">
          <input name="caseId" type="hidden" value={selectedCase.caseId} />
          <input name="caseTab" type="hidden" value={caseTab} />
          <input name="idempotencyKey" type="hidden" value={`admin-after-sales-message-${randomUUID()}`} />
          <label className="adminField">
            <span>Respuesta para el cliente</span>
            <textarea maxLength={4000} name="body" placeholder="Escribe una respuesta clara para el cliente" required rows={4} />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit"><Send aria-hidden="true" size={18} />Enviar respuesta y avisar por email</button>
        </form>
      ) : <p className="adminEmptyState">Tu permiso permite consultar el historial, pero no enviar respuestas.</p>}
    </section>
  );
}

function TransitionForms({ selectedCase, caseTab }: { selectedCase: AfterSalesAdminCase; caseTab: AfterSalesAdminDrawerTab }) {
  const transitions = caseTransitionOptions(selectedCase);

  if (!transitions.length) {
    return <div className="adminEmptyState">No hay una transicion manual disponible para el estado actual.</div>;
  }

  return (
    <div className="adminStatusList">
      {transitions.map((transition) => (
        <form action={transitionAfterSalesCaseAction} className="pricingDenseForm" key={transition.value}>
          <input name="caseId" type="hidden" value={selectedCase.caseId} />
          <input name="caseTab" type="hidden" value={caseTab} />
          <input name="caseAction" type="hidden" value={transition.value} />
          {transition.value === "resolve" ? <>
            <label className="adminField">
              <span>Resultado</span>
              <select name="resolutionOutcome" required defaultValue="">
                <option disabled value="">Selecciona el resultado</option>
                <option value="REFUND">Reembolso</option>
                <option value="EXCHANGE">Cambio</option>
                <option value="REPAIR">Reparación</option>
                <option value="REPLACEMENT">Reemplazo</option>
                <option value="STORE_CREDIT">Crédito en tienda</option>
                <option value="REJECTED">Rechazado</option>
                <option value="NO_ACTION">Sin acción</option>
                <option value="MIXED">Resolución mixta</option>
              </select>
            </label>
            <label className="adminField"><span>Explicación de la resolución</span><textarea name="resolutionReason" placeholder="Explica al cliente por qué se aplica esta resolución" required rows={3} maxLength={4000} /></label>
          </> : transition.value === "close" ? <>
            <p className="adminMuted">Al cerrar, el expediente y la conversación quedarán en modo consulta.</p>
            <label className="adminField"><span>Motivo de cierre</span><select defaultValue="COMPLETED" name="closureReason"><option value="COMPLETED">Gestión completada</option><option value="CANCELLED">Cancelado</option></select></label>
          </> : <>
            <label className="adminField"><span>Notas</span><input name="adminNotes" placeholder="Notas internas" /></label>
            {transition.value === "reject" ? <label className="adminField"><span>Motivo de rechazo</span><input name="reason" placeholder="Obligatorio para comunicar la decisión" /></label> : null}
          </>}
          <button className="adminButton" type="submit">{transition.label}</button>
        </form>
      ))}
    </div>
  );
}

function ReturnAuthorizationForm({ selectedCase, caseTab }: { selectedCase: AfterSalesAdminCase; caseTab: AfterSalesAdminDrawerTab }) {
  if (lifecycleStatus(selectedCase) === "CLOSED") {
    return <div className="adminEmptyState">El expediente está cerrado; las autorizaciones se consultan abajo.</div>;
  }
  if (selectedCase.status !== "APPROVED") {
    return <div className="adminEmptyState">La autorizacion de retorno estara disponible cuando el caso sea aprobado.</div>;
  }

  return (
    <form action={authorizeAfterSalesReturnAction} className="pricingDenseForm">
      <input name="caseId" type="hidden" value={selectedCase.caseId} />
      <input name="caseTab" type="hidden" value={caseTab} />
      <label className="adminField">
        <span>Instrucciones de retorno</span>
        <input name="note" placeholder="Indicaciones para el retorno" />
      </label>
      <button className="adminButton" type="submit">Autorizar retorno</button>
    </form>
  );
}

function ImpactForms({
  selectedCase,
  currency,
  caseTab,
  paymentOptions,
  invoiceOptions,
}: {
  selectedCase: AfterSalesAdminCase;
  currency: string;
  caseTab: AfterSalesAdminDrawerTab;
  paymentOptions: AfterSalesAdminReferenceOption[];
  invoiceOptions: AfterSalesAdminReferenceOption[];
}) {
  if (lifecycleStatus(selectedCase) === "CLOSED") {
    return <div className="adminEmptyState">El expediente está cerrado; los impactos generados permanecen disponibles para consulta.</div>;
  }
  const refundResolutions = selectedCase.resolutions.filter((resolution) => recordField(resolution, ["resolutionType"]) === "REFUND");
  const canRequestRefund = refundResolutions.length > 0;
  const canRequestInventoryDisposition = ["RETURN_RECEIVED", "RESOLUTION_IN_PROGRESS", "RESOLVED"].includes(selectedCase.status ?? "");

  return (
    <div className="adminStatusList">
      <AfterSalesResolutionForm caseId={selectedCase.caseId} caseTab={caseTab} currency={currency} items={selectedCase.items} />
      {canRequestRefund ? <form action={requestAfterSalesRefundAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <input name="caseTab" type="hidden" value={caseTab} />
        <label className="adminField">
          <span>Transacción</span>
          <select name="transactionId" required disabled={!paymentOptions.length} defaultValue="">
            <option value="">Selecciona transacción</option>
            {paymentOptions.map((transaction) => <option key={transaction.id} value={transaction.id}>{transaction.label}</option>)}
          </select>
        </label>
        <label className="adminField">
          <span>Resolucion</span>
          <select name="resolutionId" defaultValue="">
            <option value="">Selecciona resolucion</option>
            {selectedCase.resolutions.map((resolution, index) => {
              const resolutionId = recordField(resolution, ["resolutionId", "id"]);
              return resolutionId ? <option key={resolutionId} value={resolutionId}>{recordField(resolution, ["resolutionType", "status"]) ?? `Resolucion ${index + 1}`}</option> : null;
            })}
          </select>
        </label>
        {paymentOptions.length ? <button className="adminButton" type="submit">Solicitar reembolso</button> : <p className="adminMuted">No pudimos identificar una transacción reembolsable de este pedido.</p>}
      </form> : <div className="adminEmptyState">El reembolso se habilita al confirmar una decisión de tipo Reembolso.</div>}
      {canRequestInventoryDisposition ? <form action={requestAfterSalesInventoryDispositionAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <input name="caseTab" type="hidden" value={caseTab} />
        <label className="adminField">
          <span>Linea recibida</span>
          <select name="caseItemId" required>
            {selectedCase.items.map((item) => (
              <option key={item.caseItemId} value={item.caseItemId}>{valueText(item.name ?? item.caseItemId)}</option>
            ))}
          </select>
        </label>
        <label className="adminField">
          <span>Disposicion</span>
          <select name="dispositionType" defaultValue="QUARANTINE">
            <option value="QUARANTINE">QUARANTINE</option>
            <option value="RESTOCK">RESTOCK</option>
            <option value="DISCARD">DISCARD</option>
          </select>
        </label>
        <button className="adminButton" type="submit">Inventario</button>
      </form> : <div className="adminEmptyState">La disposición de inventario se habilita al registrar la recepción del retorno.</div>}
      {selectedCase.refundRequests.length ? <form action={requestAfterSalesDocumentAdjustmentAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <input name="caseTab" type="hidden" value={caseTab} />
        <label className="adminField">
          <span>Solicitud de refund</span>
          <select name="refundRequestId" defaultValue="">
            <option value="">Selecciona solicitud</option>
            {selectedCase.refundRequests.map((refundRequest, index) => {
              const refundRequestId = recordField(refundRequest, ["refundRequestId", "id"]);
              return refundRequestId ? <option key={refundRequestId} value={refundRequestId}>{recordField(refundRequest, ["status", "transactionId"]) ?? `Solicitud ${index + 1}`}</option> : null;
            })}
          </select>
        </label>
        <label className="adminField">
          <span>Factura</span>
          <select name="invoiceId" required disabled={!invoiceOptions.length} defaultValue="">
            <option value="">Selecciona factura</option>
            {invoiceOptions.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.label}</option>)}
          </select>
        </label>
        <label className="adminField">
          <span>Documento</span>
          <select name="adjustmentType" defaultValue="CREDIT_NOTE">
            <option value="CREDIT_NOTE">Nota de credito</option>
            <option value="INVOICE_ADJUSTMENT">Ajuste factura</option>
          </select>
        </label>
        {invoiceOptions.length ? <button className="adminButton" type="submit">Ajuste documental</button> : <p className="adminMuted">No pudimos identificar una factura para este pedido.</p>}
      </form> : <div className="adminEmptyState">El ajuste documental se habilita tras solicitar el reembolso.</div>}
    </div>
  );
}

function AfterSalesCaseDrawer({
  capabilities,
  data,
  filters,
}: Pick<Props, "capabilities" | "data" | "filters">) {
  const closeHref = casesHref(filters, { caseId: undefined, caseTab: undefined, caseFocus: undefined, notice: undefined });

  if (!data.selectedCase.ok) {
    return (
      <div className="adminDrawerBackdrop afterSalesDrawerBackdrop">
        <Link aria-label="Cerrar detalle de postventa" className="afterSalesDrawerBackdropLink" href={closeHref} />
        <aside aria-label="Detalle de caso postventa" aria-modal="true" className="adminSideDrawer afterSalesSideDrawer" role="dialog">
          <div className="adminSideDrawerHeader">
            <div>
              <h2>Atencion del caso</h2>
              <p>No pudimos cargar este expediente.</p>
            </div>
            <Link aria-label="Cerrar" className="adminButton adminButtonTiny" href={closeHref}>
              <X aria-hidden="true" size={16} />
            </Link>
          </div>
          <div className="afterSalesDrawerBody">
            <ResultBanner result={data.selectedCase} />
          </div>
        </aside>
      </div>
    );
  }
  if (!data.selectedCase.data) {
    return null;
  }

  const selectedCase = data.selectedCase.data;
  const historyEvents = buildAfterSalesCaseHistory(selectedCase);
  const activeTab = activeCaseDrawerTab(filters);
  const workflow = getAfterSalesWorkflowPresentation(selectedCase);

  return (
    <div className="adminDrawerBackdrop afterSalesDrawerBackdrop">
      <Link aria-label="Cerrar detalle de postventa" className="afterSalesDrawerBackdropLink" href={closeHref} />
      <aside aria-label={`Atender caso ${selectedCase.caseId}`} aria-modal="true" className="adminSideDrawer afterSalesSideDrawer" role="dialog">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>Atencion del caso</h2>
            <p>{selectedCase.caseId}</p>
          </div>
          <Link aria-label="Cerrar" className="adminButton adminButtonTiny" href={closeHref}>
            <X aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="afterSalesDrawerBody">
          <AfterSalesDrawerSummary selectedCase={selectedCase} />
          <AfterSalesDrawerTabs activeTab={activeTab} filters={filters} />

          {activeTab === "caso" ? (
            <div className="afterSalesDrawerTabPanel">
              {(["SUBMITTED", "RESOLVED"].includes(selectedCase.status ?? "") || lifecycleStatus(selectedCase) === "RESOLVED") ? (
                <section className="adminCard">
                  <div className="adminCardHeader"><div><h3>Siguiente acción</h3><p>El cambio de estado se ejecuta una sola vez desde esta acción guiada.</p></div><ClipboardCheck aria-hidden="true" size={18} /></div>
                  {capabilities.canManageAfterSales ? workflow.primaryAction === "RECORD_CLOSURE_PROOF" ? (
                    <Link className="adminButton adminButtonPrimary" href={casesHref(filters, { caseTab: "ejecucion" })}>Aportar prueba de cierre</Link>
                  ) : workflow.phase === "WAITING_CUSTOMER_CONFIRMATION" ? (
                    <div className="adminStatusList">
                      <p className="adminMuted">El cliente fue informado de la solución. Puede confirmarla desde su cuenta hasta {dateText(selectedCase.autoCloseAt)}; si no responde, el sistema cerrará el caso automáticamente.</p>
                      <Link className="adminButton" href={casesHref(filters, { caseTab: "ejecucion" })}>Ver prueba y plazo</Link>
                    </div>
                  ) : <TransitionForms caseTab={activeTab} selectedCase={selectedCase} /> : null}
                </section>
              ) : null}
              <section className="adminCard"><div className="adminCardHeader"><div><h3>Datos del caso</h3><p>Solicitud original, cliente y pedido relacionados.</p></div><FileText aria-hidden="true" size={18} /></div><DetailSummary customerReference={data.selectedCustomerReference} selectedCase={selectedCase} /></section>
              <div className={filters.caseFocus === "message" ? "afterSalesTaskFocus" : undefined}><CustomerConversationPanel canManage={capabilities.canManageAfterSales} caseTab={activeTab} messages={selectedCase.messages} selectedCase={selectedCase} /></div>
              <section className="adminCard"><div className="adminCardHeader"><div><h3>Lineas afectadas</h3><p>Unidades solicitadas, aprobadas y su estado.</p></div></div><CaseItemsPanel selectedCase={selectedCase} /></section>
              <div className={filters.caseFocus === "evidence" ? "afterSalesTaskFocus" : undefined}><AfterSalesEvidenceGallery caseId={selectedCase.caseId} evidences={selectedCase.evidences} /></div>
            </div>
          ) : null}

          {activeTab === "propuesta" ? (
            <div className="afterSalesDrawerTabPanel">
              <SolutionProposalPanel capabilities={capabilities} currency={data.context.currency} selectedCase={selectedCase} />
            </div>
          ) : null}

          {activeTab === "ejecucion" ? (
            <div className="afterSalesDrawerTabPanel">
              <ExecutionPanel
                capabilities={capabilities}
                currency={data.context.currency}
                invoiceOptions={data.orderReferences.ok && data.orderReferences.data ? data.orderReferences.data.invoices : []}
                paymentOptions={data.orderReferences.ok && data.orderReferences.data ? data.orderReferences.data.transactions : []}
                selectedCase={selectedCase}
              />
            </div>
          ) : null}

          {activeTab === "historial" ? (
            <div className="afterSalesDrawerTabPanel">
              <section className="adminCard"><div className="adminCardHeader"><div><h3>Recorrido del caso</h3><p>La conversación y los hitos se presentan en el orden en que ocurrieron.</p></div></div><CaseHistoryTimelinePanel caseId={selectedCase.caseId} evidences={selectedCase.evidences} events={historyEvents} /></section>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function AfterSalesAdminPage({ capabilities, data, filters }: Props) {
  return (
    <main className="adminPage afterSalesAdminPage">
      <div className="adminBreadcrumb">Admin / Postventa</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Postventa y soporte</h1>
          <p className="adminPageIntro">Bandeja para revisar casos, conversar con el cliente, acordar una solución y cerrar el expediente.</p>
        </div>
      </div>
      {filters.notice ? (
        <div className={`adminBanner ${filters.noticeKind === "error" ? "adminBannerError" : "adminBannerSuccess"}`}>
          <p>{filters.notice}</p>
        </div>
      ) : null}
      <CasesKpis data={data} />
      <div className="adminStatusList">
        <FiltersPanel employees={data.employees.ok ? data.employees.data : []} filters={filters} />
        <section className="adminCard afterSalesCasesCard">
          <div className="adminCardHeader">
            <div>
              <h2>Bandeja de casos</h2>
              <p>Casos storefront y operativos pendientes de atencion.</p>
            </div>
            <ClipboardCheck aria-hidden="true" size={18} />
          </div>
          <CasesTable capabilities={capabilities} data={data} filters={filters} />
        </section>
      </div>
      <TaskInbox capabilities={capabilities} data={data} filters={filters} />

      <section className="adminGrid afterSalesSupportGrid">
        <section className="adminCard">
          <div className="adminCardHeader">
            <div>
              <h2>Flujo esperado</h2>
              <p>Secuencia operativa conectada con Payments, Inventory e Invoice.</p>
            </div>
            <RotateCcw aria-hidden="true" size={18} />
          </div>
          <div className="customersOverviewList">
            <div className="customersOverviewListItem"><strong>1. Revision</strong><span>UNDER_REVIEW</span></div>
            <div className="customersOverviewListItem"><strong>2. Decision</strong><span>APPROVED / REJECTED</span></div>
            <div className="customersOverviewListItem"><strong>3. Retorno</strong><span>AWAITING_RETURN / RETURN_RECEIVED</span></div>
            <div className="customersOverviewListItem"><strong>4. Impactos</strong><span>Refund, inventario, documento</span></div>
            <div className="customersOverviewListItem"><strong>5. Cierre</strong><span>RESOLVED / CLOSED</span></div>
          </div>
        </section>
        <section className="adminCard">
          <div className="adminCardHeader">
            <div>
              <h2>Continuidad</h2>
              <p>Atajos al resto del backoffice.</p>
            </div>
            <PackageCheck aria-hidden="true" size={18} />
          </div>
          <div className="adminButtonRow">
            <Link className="adminButton" href="/admin/clientes">Clientes</Link>
            <Link className="adminButton" href="/admin/pedidos">Pedidos</Link>
            <Link className="adminButton" href="/admin/pagos">Facturas</Link>
          </div>
        </section>
      </section>
      {filters.caseId ? <AfterSalesCaseDrawer capabilities={capabilities} data={data} filters={filters} /> : null}
    </main>
  );
}
