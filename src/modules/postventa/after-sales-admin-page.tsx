import Link from "next/link";
import { randomUUID } from "crypto";
import { ClipboardCheck, FileText, PackageCheck, RotateCcw, Search, Truck, X } from "lucide-react";
import type {
  AfterSalesAdminCapabilities,
  AfterSalesAdminCase,
  AfterSalesAdminAuditEvent,
  AfterSalesAdminData,
  AfterSalesAdminDrawerTab,
  AfterSalesAdminEmployee,
  AfterSalesAdminFilters,
  AfterSalesAdminMessage,
  AfterSalesAdminReferenceOption,
} from "./after-sales-admin";
import { buildAfterSalesAuditTimeline } from "./after-sales-admin";
import { AfterSalesResolutionForm } from "./after-sales-resolution-form";
import {
  applyAfterSalesFiltersAction,
  assignAfterSalesOwnerAction,
  authorizeAfterSalesReturnAction,
  requestAfterSalesDocumentAdjustmentAction,
  requestAfterSalesInventoryDispositionAction,
  replyToAfterSalesCustomerAction,
  requestAfterSalesRefundAction,
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
  { id: "operacion", label: "Operacion" },
  { id: "caso", label: "Caso" },
  { id: "devolucion", label: "Devolucion" },
  { id: "resolucion", label: "Resolucion" },
  { id: "auditoria", label: "Auditoria" },
];

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
  return caseDrawerTabs.some((tab) => tab.id === filters.caseTab)
    ? filters.caseTab as AfterSalesAdminDrawerTab
    : "operacion";
}

function caseTransitionOptions(status: string | undefined) {
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
    case "RESOLVED":
      return [{ value: "close", label: "Cerrar caso" }];
    default:
      return [];
  }
}

function caseNextStep(caseRecord: AfterSalesAdminCase) {
  const status = caseRecord.status ?? "SUBMITTED";
  if (status === "RETURN_RECEIVED") return "Registrar la resolucion y sus impactos";
  if (status === "RESOLUTION_IN_PROGRESS") return "Completar impactos y resolver el caso";
  const transition = caseTransitionOptions(status)[0];
  if (transition) return transition.label;
  if (status === "APPROVED") return "Autorizar devolucion o registrar la resolucion";
  if (status === "AWAITING_RETURN") return "Esperar y registrar la recepcion del retorno";
  if (status === "REJECTED" || status === "CLOSED" || status === "CANCELLED") return "No requiere nuevas acciones";
  return "Completar los impactos pendientes";
}

function caseOperationHealth(caseRecord: AfterSalesAdminCase) {
  const status = caseRecord.status ?? "";
  if (["REJECTED", "CLOSED", "CANCELLED"].includes(status)) {
    return { label: "Finalizado", badgeClass: "adminBadge adminBadgeOk" };
  }
  if (!caseRecord.assignedEmployeeId) {
    return { label: "Requiere responsable", badgeClass: "adminBadge adminBadgeWarn" };
  }
  if (["SUBMITTED", "UNDER_REVIEW", "AWAITING_RETURN", "RETURN_RECEIVED", "RESOLUTION_IN_PROGRESS"].includes(status)) {
    return { label: "En curso", badgeClass: "adminBadge adminBadgeWarn" };
  }
  return { label: "Operable", badgeClass: "adminBadge adminBadgeOk" };
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

function statusBadgeClass(status: string | undefined) {
  const value = status?.toUpperCase();
  if (value === "APPROVED" || value === "RESOLVED" || value === "CLOSED" || value === "RETURN_RECEIVED") {
    return "adminBadge adminBadgeOk";
  }
  if (value === "SUBMITTED" || value === "UNDER_REVIEW" || value === "AWAITING_CUSTOMER" || value === "AWAITING_RETURN" || value === "RESOLUTION_IN_PROGRESS") {
    return "adminBadge adminBadgeWarn";
  }
  if (value === "REJECTED" || value === "CANCELLED") {
    return "adminBadge adminBadgeError";
  }

  return "adminBadge";
}

function resultCount(value: unknown[]) {
  return value.length ? String(value.length) : "-";
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
  const open = cases.filter((item) => !["RESOLVED", "CLOSED", "CANCELLED", "REJECTED"].includes(item.status ?? "")).length;
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

function CasesTable({ data, filters }: Pick<Props, "data" | "filters">) {
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
            <th>Estado</th>
            <th>Responsable</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.cases.data.items.map((item) => (
            <tr key={item.caseId}>
              <td>
                <strong>{item.caseId}</strong>
                <div className="adminMuted">{dateText(item.submittedAt ?? item.createdAt)}</div>
              </td>
              <td>{valueText(item.orderId)}</td>
              <td>{valueText(item.customerId)}</td>
              <td>{valueText(item.caseType)}</td>
              <td><span className={statusBadgeClass(item.status)}>{valueText(item.status)}</span></td>
              <td>{valueText(item.assignedEmployeeId)}</td>
              <td>
                <Link className="adminButton adminButtonTiny" href={casesHref(filters, { caseId: item.caseId })}>
                  Atender
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        <div><dt>Estado</dt><dd><span className={statusBadgeClass(selectedCase.status)}>{valueText(selectedCase.status)}</span></dd></div>
        <div><dt>Responsable</dt><dd>{valueText(selectedCase.assignedEmployeeId)}</dd></div>
        <div><dt>Motivo</dt><dd>{valueText(selectedCase.reasonCode)}</dd></div>
        <div><dt>Enviado</dt><dd>{dateText(selectedCase.submittedAt ?? selectedCase.createdAt)}</dd></div>
      </dl>
      {selectedCase.customerMessage ? (
        <div className="adminBanner adminBannerInfo">
          <p>{selectedCase.customerMessage}</p>
        </div>
      ) : null}
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

function CaseCollectionsPanel({ selectedCase }: { selectedCase: AfterSalesAdminCase }) {
  const rows = [
    ["Evidencias", selectedCase.evidences],
    ["Resoluciones", selectedCase.resolutions],
    ["Autorizaciones retorno", selectedCase.returnAuthorizations],
    ["Refund requests", selectedCase.refundRequests],
    ["Inventario", selectedCase.inventoryDispositions],
    ["Ajustes documentales", selectedCase.documentAdjustments],
  ] as const;

  return (
    <div className="customersOverviewList">
      {rows.map(([label, items]) => (
        <div className="customersOverviewListItem" key={label}>
          <strong>{label}</strong>
          <span>{resultCount(items)}</span>
          <span>{valueText(recordField(items[0], ["status", "resolutionType", "adjustmentType", "dispositionType"]))}</span>
        </div>
      ))}
    </div>
  );
}

function CaseCollectionPanel({
  title,
  items,
  emptyMessage,
  referenceKeys,
}: {
  title: string;
  items: unknown[];
  emptyMessage: string;
  referenceKeys: string[];
}) {
  if (!items.length) {
    return (
      <section className="adminCard afterSalesCollectionPanel">
        <div className="adminCardHeader"><h3>{title}</h3></div>
        <div className="adminEmptyState">{emptyMessage}</div>
      </section>
    );
  }

  return (
    <section className="adminCard afterSalesCollectionPanel">
      <div className="adminCardHeader"><h3>{title}</h3><span className="adminBadge">{items.length}</span></div>
      <div className="adminTableScroller">
        <table className="adminTable pricingTable">
          <thead>
            <tr><th>Referencia</th><th>Estado o tipo</th><th>Detalle</th><th>Actualizacion</th></tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={String(recordField(item, referenceKeys) ?? index)}>
                <td>{valueText(recordField(item, referenceKeys))}</td>
                <td><span className={statusBadgeClass(String(recordField(item, ["status", "resolutionType", "adjustmentType", "dispositionType", "evidenceType"]) ?? ""))}>{valueText(recordField(item, ["status", "resolutionType", "adjustmentType", "dispositionType", "evidenceType"]))}</span></td>
                <td>{valueText(recordField(item, ["transactionId", "caseItemId", "invoiceId", "warehouseId", "externalReference", "note"]))}</td>
                <td>{dateText(String(recordField(item, ["updatedAt", "requestedAt", "authorizedAt", "receivedAt", "createdAt", "issuedAt"]) ?? ""))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AfterSalesDrawerSummary({ selectedCase }: { selectedCase: AfterSalesAdminCase }) {
  const health = caseOperationHealth(selectedCase);

  return (
    <section className="ordersFulfillmentSummary afterSalesDrawerSummary">
      <div className="ordersFulfillmentSummaryHeader">
        <div>
          <span>Resumen operativo</span>
          <strong>{caseNextStep(selectedCase)}</strong>
        </div>
        <span className={health.badgeClass}>{health.label}</span>
      </div>
      <dl className="ordersFulfillmentSummaryMeta">
        <div><dt>Estado</dt><dd><span className={statusBadgeClass(selectedCase.status)}>{valueText(selectedCase.status)}</span></dd></div>
        <div><dt>Responsable</dt><dd>{valueText(selectedCase.assignedEmployeeId)}</dd></div>
        <div><dt>Lineas</dt><dd>{selectedCase.items.length}</dd></div>
        <div><dt>Retornos</dt><dd>{selectedCase.returnAuthorizations.length}</dd></div>
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

function AdminAuditTimelinePanel({ events }: { events: AfterSalesAdminAuditEvent[] }) {
  if (!events.length) {
    return <div className="adminEmptyState">Sin eventos administrativos para este caso.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th>Evento</th>
            <th>Estado</th>
            <th>Actor</th>
            <th>Referencia</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 12).map((event) => (
            <tr key={event.eventId}>
              <td>
                <strong>{event.label}</strong>
                <div className="adminMuted">{event.eventType} · {event.source}</div>
              </td>
              <td><span className={statusBadgeClass(event.status)}>{valueText(event.status)}</span></td>
              <td>{valueText(event.actor)}</td>
              <td>
                <strong>{valueText(event.referenceId)}</strong>
                <div className="adminMuted">{valueText(event.detail)}</div>
              </td>
              <td>{dateText(event.occurredAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerConversationPanel({
  caseTab,
  messages,
  selectedCase,
}: {
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
        <div className="adminTableScroller">
          <table className="adminTable pricingTable">
            <thead><tr><th>Autor</th><th>Mensaje</th><th>Enviado</th></tr></thead>
            <tbody>
              {chronologicalMessages.map((message) => (
                <tr key={message.messageId}>
                  <td><strong>{message.authorType === "CUSTOMER" ? "Cliente" : "Equipo"}</strong><div className="adminMuted">{valueText(message.kind)}</div></td>
                  <td>{valueText(message.body)}</td>
                  <td>{dateText(message.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="adminEmptyState">Aun no hay mensajes en el historial.</div>}
      <form action={replyToAfterSalesCustomerAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <input name="caseTab" type="hidden" value={caseTab} />
        <input name="idempotencyKey" type="hidden" value={`admin-after-sales-message-${randomUUID()}`} />
        <label className="adminField">
          <span>Respuesta para el cliente</span>
          <textarea maxLength={4000} name="body" placeholder="Escribe una respuesta clara para el cliente" required rows={4} />
        </label>
        <button className="adminButton" type="submit">Enviar respuesta y avisar por email</button>
      </form>
    </section>
  );
}

function AssignmentForm({
  selectedCase,
  caseTab,
  employees,
}: {
  selectedCase: AfterSalesAdminCase;
  caseTab: AfterSalesAdminDrawerTab;
  employees: AfterSalesAdminEmployee[];
}) {
  const activeEmployees = employees.filter((employee) => employee.active);

  return (
    <form action={assignAfterSalesOwnerAction} className="pricingDenseForm">
      <input name="caseId" type="hidden" value={selectedCase.caseId} />
      <input name="caseTab" type="hidden" value={caseTab} />
      <label className="adminField">
        <span>Responsable</span>
        <select defaultValue={selectedCase.assignedEmployeeId ?? "__null__"} name="assignedEmployeeId" disabled={!activeEmployees.length}>
          <option value="__null__">Sin responsable</option>
          {activeEmployees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.label}</option>)}
        </select>
      </label>
      {activeEmployees.length ? <button className="adminButton" type="submit">Guardar responsable</button> : <p className="adminMuted">No hay empleados activos disponibles para este contexto.</p>}
    </form>
  );
}

function TransitionForms({ selectedCase, caseTab }: { selectedCase: AfterSalesAdminCase; caseTab: AfterSalesAdminDrawerTab }) {
  const transitions = caseTransitionOptions(selectedCase.status);

  if (!transitions.length) {
    return <div className="adminEmptyState">No hay una transicion manual disponible para el estado actual.</div>;
  }

  return (
    <div className="adminStatusList">
      <form action={transitionAfterSalesCaseAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <input name="caseTab" type="hidden" value={caseTab} />
        <label className="adminField">
          <span>Accion</span>
          <select name="caseAction" required>
            {transitions.map((transition) => (
              <option key={transition.value} value={transition.value}>{transition.label}</option>
            ))}
          </select>
        </label>
        <label className="adminField">
          <span>Notas</span>
          <input name="adminNotes" placeholder="Notas internas" />
        </label>
        <label className="adminField">
          <span>Motivo rechazo</span>
          <input name="reason" placeholder="Opcional" />
        </label>
        <button className="adminButton" type="submit">Aplicar estado</button>
      </form>
    </div>
  );
}

function ReturnAuthorizationForm({ selectedCase, caseTab }: { selectedCase: AfterSalesAdminCase; caseTab: AfterSalesAdminDrawerTab }) {
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
  const closeHref = casesHref(filters, { caseId: undefined, caseTab: undefined, notice: undefined });

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
  const auditEvents = buildAfterSalesAuditTimeline(selectedCase);
  const activeTab = activeCaseDrawerTab(filters);

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

          {activeTab === "operacion" ? (
            <div className="afterSalesDrawerTabPanel">
              <section className="adminCard">
                <div className="adminCardHeader"><div><h3>Atencion operativa</h3><p>Asigna un responsable y aplica solo la siguiente transicion valida.</p></div><ClipboardCheck aria-hidden="true" size={18} /></div>
                <div className="afterSalesOperationForms">
                  {capabilities.canManageAfterSales ? <AssignmentForm caseTab={activeTab} employees={data.employees.ok ? data.employees.data : []} selectedCase={selectedCase} /> : null}
                  {capabilities.canManageAfterSales ? <TransitionForms caseTab={activeTab} selectedCase={selectedCase} /> : null}
                </div>
              </section>
              <section className="adminCard">
                <div className="adminCardHeader"><div><h3>Estado de las integraciones</h3><p>Resumen de los registros generados desde este caso.</p></div></div>
                <CaseCollectionsPanel selectedCase={selectedCase} />
              </section>
            </div>
          ) : null}

          {activeTab === "caso" ? (
            <div className="afterSalesDrawerTabPanel">
              <section className="adminCard"><div className="adminCardHeader"><div><h3>Datos del caso</h3><p>Solicitud original, cliente y pedido relacionados.</p></div><FileText aria-hidden="true" size={18} /></div><DetailSummary customerReference={data.selectedCustomerReference} selectedCase={selectedCase} /></section>
              {capabilities.canManageAfterSales ? <CustomerConversationPanel caseTab={activeTab} messages={selectedCase.messages} selectedCase={selectedCase} /> : null}
              <section className="adminCard"><div className="adminCardHeader"><div><h3>Lineas afectadas</h3><p>Unidades solicitadas, aprobadas y su estado.</p></div></div><CaseItemsPanel selectedCase={selectedCase} /></section>
              <CaseCollectionPanel emptyMessage="El cliente no adjunto evidencias." items={selectedCase.evidences} referenceKeys={["evidenceId", "id", "url"]} title="Evidencias" />
            </div>
          ) : null}

          {activeTab === "devolucion" ? (
            <div className="afterSalesDrawerTabPanel">
              <section className="adminCard"><div className="adminCardHeader"><div><h3>Gestion de retorno</h3><p>Autoriza el retorno tras aprobar el caso y registra su recepcion desde Operacion.</p></div><Truck aria-hidden="true" size={18} /></div>{capabilities.canManageAfterSales ? <ReturnAuthorizationForm caseTab={activeTab} selectedCase={selectedCase} /> : null}</section>
              <CaseCollectionPanel emptyMessage="Aun no hay autorizaciones de retorno." items={selectedCase.returnAuthorizations} referenceKeys={["returnAuthorizationId", "id"]} title="Autorizaciones de retorno" />
            </div>
          ) : null}

          {activeTab === "resolucion" ? (
            <div className="afterSalesDrawerTabPanel">
              <section className="adminCard"><div className="adminCardHeader"><div><h3>Resolucion e impactos</h3><p>Primero decide la solución. Después se habilitan únicamente los efectos compatibles.</p></div><RotateCcw aria-hidden="true" size={18} /></div>{capabilities.canManageAfterSales ? <ImpactForms caseTab={activeTab} currency={data.context.currency} invoiceOptions={data.orderReferences.ok && data.orderReferences.data ? data.orderReferences.data.invoices : []} paymentOptions={data.orderReferences.ok && data.orderReferences.data ? data.orderReferences.data.transactions : []} selectedCase={selectedCase} /> : null}</section>
              <CaseCollectionPanel emptyMessage="Aun no hay resoluciones registradas." items={selectedCase.resolutions} referenceKeys={["resolutionId", "id"]} title="Resoluciones" />
              <CaseCollectionPanel emptyMessage="Aun no hay solicitudes de refund." items={selectedCase.refundRequests} referenceKeys={["refundRequestId", "id"]} title="Solicitudes de refund" />
              <CaseCollectionPanel emptyMessage="Aun no hay disposiciones de inventario." items={selectedCase.inventoryDispositions} referenceKeys={["inventoryDispositionId", "id"]} title="Disposiciones de inventario" />
              <CaseCollectionPanel emptyMessage="Aun no hay ajustes documentales." items={selectedCase.documentAdjustments} referenceKeys={["documentAdjustmentId", "id"]} title="Ajustes documentales" />
            </div>
          ) : null}

          {activeTab === "auditoria" ? (
            <div className="afterSalesDrawerTabPanel"><section className="adminCard"><div className="adminCardHeader"><div><h3>Auditoria administrativa</h3><p>Eventos del caso y de cada integracion asociada.</p></div></div><AdminAuditTimelinePanel events={auditEvents} /></section></div>
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
          <p className="adminPageIntro">Bandeja para atender casos, asignar responsables, gestionar retornos, refunds, inventario y ajustes documentales.</p>
        </div>
      </div>
      {filters.notice ? (
        <div className="adminBanner adminBannerSuccess">
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
          <CasesTable data={data} filters={filters} />
        </section>
      </div>

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
