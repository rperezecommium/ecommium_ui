import Link from "next/link";
import { ClipboardCheck, LifeBuoy, PackageCheck, RotateCcw, Search } from "lucide-react";
import type {
  AfterSalesAdminCapabilities,
  AfterSalesAdminCase,
  AfterSalesAdminAuditEvent,
  AfterSalesAdminData,
  AfterSalesAdminFilters,
} from "./after-sales-admin";
import { buildAfterSalesAuditTimeline } from "./after-sales-admin";
import {
  applyAfterSalesFiltersAction,
  assignAfterSalesOwnerAction,
  authorizeAfterSalesReturnAction,
  createAfterSalesResolutionAction,
  requestAfterSalesDocumentAdjustmentAction,
  requestAfterSalesInventoryDispositionAction,
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
      return field;
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

function FiltersPanel({ filters }: { filters: AfterSalesAdminFilters }) {
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
          <input name="assignedEmployeeId" placeholder="employeeId" defaultValue={filters.assignedEmployeeId ?? ""} />
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

function DetailSummary({ selectedCase }: { selectedCase: AfterSalesAdminCase }) {
  return (
    <>
      <dl className="adminDefinitionList">
        <div><dt>Caso</dt><dd>{selectedCase.caseId}</dd></div>
        <div><dt>Pedido</dt><dd>{selectedCase.orderId}</dd></div>
        <div><dt>Cliente</dt><dd>{valueText(selectedCase.customerId)}</dd></div>
        <div><dt>Tipo</dt><dd>{valueText(selectedCase.caseType)}</dd></div>
        <div><dt>Estado</dt><dd><span className={statusBadgeClass(selectedCase.status)}>{valueText(selectedCase.status)}</span></dd></div>
        <div><dt>Responsable</dt><dd>{valueText(selectedCase.assignedEmployeeId)}</dd></div>
        <div><dt>Motivo</dt><dd>{valueText(selectedCase.reasonCode)}</dd></div>
        <div><dt>Enviado</dt><dd>{dateText(selectedCase.submittedAt ?? selectedCase.createdAt)}</dd></div>
      </dl>
      {selectedCase.customerMessage ? (
        <div className="adminBanner">
          <p>{selectedCase.customerMessage}</p>
        </div>
      ) : null}
      <div className="adminButtonRow">
        <Link className="adminButton" href={`/admin/pedidos?orderId=${encodeURIComponent(selectedCase.orderId)}`}>Abrir pedido</Link>
        {selectedCase.customerId ? (
          <Link className="adminButton" href={`/admin/clientes?customerId=${encodeURIComponent(selectedCase.customerId)}`}>Abrir cliente</Link>
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

function AssignmentForm({ selectedCase }: { selectedCase: AfterSalesAdminCase }) {
  return (
    <form action={assignAfterSalesOwnerAction} className="pricingDenseForm">
      <input name="caseId" type="hidden" value={selectedCase.caseId} />
      <label className="adminField">
        <span>Responsable</span>
        <input name="assignedEmployeeId" placeholder="employeeId o __null__" defaultValue={selectedCase.assignedEmployeeId ?? ""} />
      </label>
      <button className="adminButton" type="submit">Asignar</button>
    </form>
  );
}

function TransitionForms({ selectedCase }: { selectedCase: AfterSalesAdminCase }) {
  return (
    <div className="adminStatusList">
      <form action={transitionAfterSalesCaseAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <label className="adminField">
          <span>Accion</span>
          <select name="caseAction" required>
            <option value="review">Poner en revision</option>
            <option value="approve">Aprobar</option>
            <option value="reject">Rechazar</option>
            <option value="receive-return">Recibir retorno</option>
            <option value="resolve">Resolver</option>
            <option value="close">Cerrar</option>
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
      <form action={authorizeAfterSalesReturnAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <label className="adminField">
          <span>Nota retorno</span>
          <input name="note" placeholder="Instrucciones internas" />
        </label>
        <button className="adminButton" type="submit">Autorizar retorno</button>
      </form>
    </div>
  );
}

function ImpactForms({ selectedCase, currency }: { selectedCase: AfterSalesAdminCase; currency: string }) {
  const firstItemId = selectedCase.items[0]?.caseItemId ?? "";

  return (
    <div className="adminStatusList">
      <form action={createAfterSalesResolutionAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <input name="currency" type="hidden" value={currency} />
        <label className="adminField">
          <span>Item</span>
          <input name="caseItemId" placeholder="caseItemId" defaultValue={firstItemId} />
        </label>
        <label className="adminField">
          <span>Resolucion</span>
          <select name="resolutionType" defaultValue="REFUND">
            <option value="REFUND">REFUND</option>
            <option value="EXCHANGE">EXCHANGE</option>
            <option value="REPAIR">REPAIR</option>
            <option value="REPLACEMENT">REPLACEMENT</option>
            <option value="STORE_CREDIT">STORE_CREDIT</option>
            <option value="NO_ACTION">NO_ACTION</option>
          </select>
        </label>
        <label className="adminField">
          <span>Importe menor</span>
          <input name="amountMinor" min="1" placeholder="1299" type="number" />
        </label>
        <label className="adminField">
          <span>Referencia</span>
          <input name="externalReference" placeholder="ref externa" />
        </label>
        <button className="adminButton" type="submit">Registrar resolucion</button>
      </form>
      <form action={requestAfterSalesRefundAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <label className="adminField">
          <span>Transaction</span>
          <input name="transactionId" placeholder="transactionId" />
        </label>
        <label className="adminField">
          <span>Resolucion</span>
          <input name="resolutionId" placeholder="resolutionId" />
        </label>
        <button className="adminButton" type="submit">Solicitar refund</button>
      </form>
      <form action={requestAfterSalesInventoryDispositionAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <label className="adminField">
          <span>Item</span>
          <input name="caseItemId" placeholder="caseItemId" defaultValue={firstItemId} />
        </label>
        <label className="adminField">
          <span>Disposicion</span>
          <select name="dispositionType" defaultValue="QUARANTINE">
            <option value="QUARANTINE">QUARANTINE</option>
            <option value="RESTOCK">RESTOCK</option>
            <option value="DISCARD">DISCARD</option>
          </select>
        </label>
        <label className="adminField">
          <span>Warehouse</span>
          <input name="warehouseId" placeholder="warehouseId" />
        </label>
        <button className="adminButton" type="submit">Inventario</button>
      </form>
      <form action={requestAfterSalesDocumentAdjustmentAction} className="pricingDenseForm">
        <input name="caseId" type="hidden" value={selectedCase.caseId} />
        <label className="adminField">
          <span>Refund request</span>
          <input name="refundRequestId" placeholder="refundRequestId" />
        </label>
        <label className="adminField">
          <span>Factura</span>
          <input name="invoiceId" placeholder="invoiceId" />
        </label>
        <label className="adminField">
          <span>Documento</span>
          <select name="adjustmentType" defaultValue="CREDIT_NOTE">
            <option value="CREDIT_NOTE">Nota de credito</option>
            <option value="INVOICE_ADJUSTMENT">Ajuste factura</option>
          </select>
        </label>
        <button className="adminButton" type="submit">Ajuste documental</button>
      </form>
    </div>
  );
}

function CaseDetail({ capabilities, data }: Pick<Props, "capabilities" | "data">) {
  if (!data.selectedCase.ok) {
    return <ResultBanner result={data.selectedCase} />;
  }
  if (!data.selectedCase.data) {
    return <div className="adminEmptyState">Selecciona un caso para atenderlo, asignarlo y registrar impactos.</div>;
  }

  const selectedCase = data.selectedCase.data;
  const auditEvents = buildAfterSalesAuditTimeline(selectedCase);

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Atencion del caso</h2>
          <p>{selectedCase.caseId}</p>
        </div>
        <LifeBuoy aria-hidden="true" size={18} />
      </div>
      <DetailSummary selectedCase={selectedCase} />
      <div className="customersOverviewSubsection">
        <h3>Lineas afectadas</h3>
        <CaseItemsPanel selectedCase={selectedCase} />
      </div>
      <div className="customersOverviewSubsection">
        <h3>Trazabilidad operativa</h3>
        <CaseCollectionsPanel selectedCase={selectedCase} />
      </div>
      <div className="customersOverviewSubsection">
        <h3>Auditoria administrativa</h3>
        <AdminAuditTimelinePanel events={auditEvents} />
      </div>
      {capabilities.canManageAfterSales ? (
        <div className="customersOverviewSubsection">
          <h3>Acciones de soporte</h3>
          <AssignmentForm selectedCase={selectedCase} />
          <TransitionForms selectedCase={selectedCase} />
          <ImpactForms selectedCase={selectedCase} currency={data.context.currency} />
        </div>
      ) : null}
    </section>
  );
}

export function AfterSalesAdminPage({ capabilities, data, filters }: Props) {
  return (
    <main className="adminPage">
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
      <div className="adminGrid">
        <div className="adminStatusList">
          <FiltersPanel filters={filters} />
          <section className="adminCard">
            <div className="adminCardHeader">
              <div>
                <h2>Bandeja de casos</h2>
                <p>Casos storefront y operativos pendientes de atencion.</p>
              </div>
              <ClipboardCheck aria-hidden="true" size={18} />
            </div>
            <CasesTable data={data} filters={filters} />
          </section>
          <CaseDetail capabilities={capabilities} data={data} />
        </div>
        <div className="adminStatusList">
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
        </div>
      </div>
    </main>
  );
}
