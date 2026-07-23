import { randomUUID } from "crypto";
import Link from "next/link";
import { CreditCard, GitBranch, Landmark, Radar, ReceiptText, RotateCcw, Search } from "lucide-react";
import type { InvoiceAdminCapabilities, InvoiceAdminData, InvoiceAdminFilters } from "./invoices-admin";
import { InvoicesAdminPage } from "./invoices-admin-page";
import type {
  PaymentAffiliationAdminRecord,
  PaymentRuleAdminRecord,
  PaymentOperationAdminRecord,
  PaymentRefundEvidence,
  PaymentSystemAdminRecord,
  PaymentTransactionEvidence,
  PaymentsAdminCapabilities,
  PaymentsAdminData,
  PaymentsAdminFilters,
  PaymentsAdminTab,
} from "./payments-admin";
import {
  createPaymentAffiliationAction,
  createPaymentRuleAction,
  createPaymentSystemAction,
  setPaymentResourceActiveAction,
} from "./payments-admin-actions";
import { PaymentRefundRequestForm } from "./payment-refund-request-form";
import { PaymentRefundEvidenceAutoRefresh } from "./payment-refund-evidence-auto-refresh";

type Props = {
  invoiceCapabilities: InvoiceAdminCapabilities;
  invoiceData: InvoiceAdminData;
  invoiceFilters: InvoiceAdminFilters;
  paymentsCapabilities: PaymentsAdminCapabilities;
  paymentsData: PaymentsAdminData;
  paymentsFilters: PaymentsAdminFilters;
};

const tabs: Array<{ domain: "operacion" | "configuracion"; href: PaymentsAdminTab; icon: typeof CreditCard; label: string }> = [
  { domain: "operacion", href: "resumen", icon: ReceiptText, label: "Resumen" },
  { domain: "operacion", href: "operaciones", icon: CreditCard, label: "Operaciones" },
  { domain: "operacion", href: "reembolsos", icon: RotateCcw, label: "Reembolsos" },
  { domain: "operacion", href: "facturas", icon: ReceiptText, label: "Facturación" },
  { domain: "configuracion", href: "metodos", icon: CreditCard, label: "Métodos" },
  { domain: "configuracion", href: "proveedores", icon: Landmark, label: "Proveedores" },
  { domain: "configuracion", href: "routing", icon: GitBranch, label: "Routing" },
  { domain: "configuracion", href: "diagnostico", icon: Radar, label: "Diagnóstico" },
];

function activeTab(filters: PaymentsAdminFilters): PaymentsAdminTab {
  if (filters.tab === "afiliaciones") {
    return "proveedores";
  }
  if (filters.tab === "reglas") {
    return "routing";
  }

  return tabs.some((tab) => tab.href === filters.tab) ? filters.tab as PaymentsAdminTab : "resumen";
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

function moneyText(value: number | undefined, currency: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Sin límite";
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(value / 100);
}

function dateText(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function paymentSystemName(items: PaymentSystemAdminRecord[], paymentSystemId?: string) {
  if (!paymentSystemId) {
    return "Sin método asignado";
  }

  return items.find((item) => item.paymentSystemId === paymentSystemId)?.name ?? "Método no disponible";
}

function affiliationName(items: PaymentAffiliationAdminRecord[], affiliationId?: string) {
  if (!affiliationId) {
    return "Sin proveedor asignado";
  }

  return items.find((item) => item.affiliationId === affiliationId)?.name ?? "Proveedor no disponible";
}

function badge(active: boolean) {
  return active ? "adminBadge adminBadgeOk" : "adminBadge adminBadgeWarn";
}

function transactionStatusBadge(status: string) {
  if (["SETTLED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(status)) {
    return "adminBadge adminBadgeOk";
  }
  if (["FAILED", "CANCELLED", "REJECTED"].includes(status)) {
    return "adminBadge adminBadgeWarn";
  }
  return "adminBadge";
}

function transactionStatusText(status: string) {
  const labels: Record<string, string> = {
    AUTHORIZED: "Autorizado",
    CANCELLED: "Cancelado",
    FAILED: "Fallido",
    PARTIALLY_REFUNDED: "Reembolsado parcial",
    PENDING: "Pendiente",
    REFUNDED: "Reembolsado",
    SETTLED: "Capturado",
  };
  return labels[status] ?? status;
}

function refundStatusBadge(status: string) {
  if (["SUCCEEDED", "REFUNDED"].includes(status)) {
    return "adminBadge adminBadgeOk";
  }
  if (["FAILED", "CANCELED", "MANUAL_REVIEW", "REQUIRES_ACTION"].includes(status)) {
    return "adminBadge adminBadgeError";
  }
  return "adminBadge adminBadgeWarn";
}

function refundStatusText(status: string) {
  const labels: Record<string, string> = {
    CANCELED: "Cancelado",
    FAILED: "Fallido",
    MANUAL_REVIEW: "Revisión manual",
    PENDING: "Pendiente de confirmación",
    PROVIDER_ACCEPTED: "Aceptado por PSP",
    REFUNDED: "Reembolsado",
    REQUESTED: "Solicitado",
    REQUIRES_ACTION: "Requiere acción",
    SUBMITTING: "Enviando al PSP",
    SUCCEEDED: "Confirmado",
  };
  return labels[status] ?? status;
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

function tabHref(tab: PaymentsAdminTab, includeInactive: boolean) {
  const params = new URLSearchParams({ tab });
  if (includeInactive) {
    params.set("includeInactive", "true");
  }
  return `/admin/pagos?${params.toString()}`;
}

function PaymentsTabs({ current, includeInactive }: { current: PaymentsAdminTab; includeInactive: boolean }) {
  const currentDomain = tabs.find((tab) => tab.href === current)?.domain ?? "operacion";
  const visibleTabs = tabs.filter((tab) => tab.domain === currentDomain);

  return (
    <nav aria-label="Secciones de pagos" className="paymentsTabs">
      <div aria-label="Dominio de Pagos" className="paymentsPrimaryTabs" role="tablist">
        <Link
          aria-selected={currentDomain === "operacion"}
          className={`adminButton ${currentDomain === "operacion" ? "adminButtonPrimary" : ""}`}
          href={tabHref("resumen", includeInactive)}
          role="tab"
        >
          Operaciones
        </Link>
        <Link
          aria-selected={currentDomain === "configuracion"}
          className={`adminButton ${currentDomain === "configuracion" ? "adminButtonPrimary" : ""}`}
          href={tabHref("metodos", includeInactive)}
          role="tab"
        >
          Configuración
        </Link>
      </div>
      <div aria-label={currentDomain === "operacion" ? "Secciones de Operaciones" : "Secciones de Configuración"} className="paymentsTabsGroup">
        <span>{currentDomain === "operacion" ? "Operaciones" : "Configuración"}</span>
        <div className="adminButtonRow">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                aria-current={current === tab.href ? "page" : undefined}
                className={`adminButton ${current === tab.href ? "adminButtonPrimary" : ""}`}
                href={tabHref(tab.href, includeInactive)}
                key={tab.href}
              >
                <Icon aria-hidden="true" size={16} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function isConfigurationTab(tab: PaymentsAdminTab) {
  return tab === "metodos" || tab === "proveedores" || tab === "routing" || tab === "diagnostico";
}

function PaymentsToolbar({ current, includeInactive }: { current: PaymentsAdminTab; includeInactive: boolean }) {
  const nextParams = new URLSearchParams({ tab: current });
  if (!includeInactive) {
    nextParams.set("includeInactive", "true");
  }

  return (
    <div className="adminButtonRow">
      <Link className="adminButton" href={`/admin/pagos?${nextParams.toString()}`}>
        {includeInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
      </Link>
    </div>
  );
}

function paymentConfigurationHref(
  tab: "metodos" | "proveedores" | "routing",
  includeInactive: boolean,
  drawer?: "create-payment-system" | "create-affiliation" | "create-payment-rule",
) {
  const params = new URLSearchParams({ tab });
  if (includeInactive) {
    params.set("includeInactive", "true");
  }
  if (drawer) {
    params.set("drawer", drawer);
  }
  return `/admin/pagos?${params.toString()}`;
}

function paymentConfigurationStats(data: PaymentsAdminData) {
  const methods = data.paymentSystems.ok ? data.paymentSystems.data : [];
  const affiliations = data.affiliations.ok ? data.affiliations.data : [];
  const rules = data.rules.ok ? data.rules.data : [];

  return {
    activeAffiliations: affiliations.filter((item) => item.active).length,
    activeMethods: methods.filter((item) => item.active).length,
    activeRules: rules.filter((item) => item.active).length,
    affiliations: affiliations.length,
    methods: methods.length,
    rules: rules.length,
  };
}

function PaymentsPageHeader({ data }: { data: PaymentsAdminData }) {
  const stats = paymentConfigurationStats(data);

  return (
    <header className="paymentsPageHeader">
      <div>
        <div className="adminBreadcrumb">Admin / Pagos</div>
        <h1 className="adminPageTitle">Pagos</h1>
        <p className="adminPageIntro">Operación financiera y configuración de cobro por tienda.</p>
      </div>
      <div aria-label="Contexto de pagos" className="paymentsPageContext">
        <strong>{data.context.shopAlias || data.context.shopId || "Tienda sin contexto"}</strong>
        <span>{data.context.currency} · {data.context.country}</span>
        <span>{stats.activeMethods} métodos activos</span>
      </div>
    </header>
  );
}

function PaymentsKpis({ data }: { data: PaymentsAdminData }) {
  const stats = paymentConfigurationStats(data);

  return (
    <section className="adminKpiGrid">
      <div className="adminKpi">
        <span>Métodos activos</span>
        <strong>{stats.activeMethods}</strong>
        <p>{stats.methods} configurados</p>
      </div>
      <div className="adminKpi">
        <span>Proveedores activos</span>
        <strong>{stats.activeAffiliations}</strong>
        <p>PayPal, Stripe u otros PSP</p>
      </div>
      <div className="adminKpi">
        <span>Reglas de routing activas</span>
        <strong>{stats.activeRules}</strong>
        <p>{stats.rules} configuradas</p>
      </div>
    </section>
  );
}

function ConfigurationKpis({
  items,
}: {
  items: Array<{ active: boolean }>;
}) {
  const active = items.filter((item) => item.active).length;
  const inactive = items.length - active;

  return (
    <section className="adminKpiGrid paymentsConfigurationKpis">
      <div className="adminKpi">
        <span>Configurados</span>
        <strong>{items.length}</strong>
        <p>En esta tienda</p>
      </div>
      <div className="adminKpi">
        <span>Activos</span>
        <strong>{active}</strong>
        <p>Disponibles para operar</p>
      </div>
      <div className="adminKpi">
        <span>Inactivos</span>
        <strong>{inactive}</strong>
        <p>Fuera de la operación</p>
      </div>
    </section>
  );
}

function OperationsKpis({ data }: { data: PaymentsAdminData }) {
  if (!data.transactions.ok) {
    return <ResultBanner result={data.transactions} />;
  }

  const { summary } = data.transactions.data;
  const netMinor = Math.max(summary.capturedMinor - summary.refundedMinor, 0);
  const currency = data.transactions.data.items[0]?.currency ?? data.context.currency;

  return (
    <section className="adminKpiGrid paymentsOperationsKpis">
      <div className="adminKpi"><span>Capturado</span><strong>{moneyText(summary.capturedMinor, currency)}</strong><p>En los resultados cargados</p></div>
      <div className="adminKpi"><span>Pendientes</span><strong>{summary.pendingCount}</strong><p>Requieren seguimiento</p></div>
      <div className="adminKpi"><span>Incidencias</span><strong>{summary.failedCount}</strong><p>Operaciones fallidas</p></div>
      <div className="adminKpi"><span>Neto tras reembolsos</span><strong>{moneyText(netMinor, currency)}</strong><p>{moneyText(summary.refundedMinor, currency)} reembolsados</p></div>
    </section>
  );
}

function OperationsFilters({ current, filters }: { current: "operaciones" | "reembolsos"; filters: PaymentsAdminFilters }) {
  return (
    <form action="/admin/pagos" className="paymentsOperationsFilters" method="get">
      <input name="tab" type="hidden" value={current} />
      <label className="adminField"><span>Estado</span>
        <select defaultValue={filters.transactionStatus ?? ""} name="transactionStatus">
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="AUTHORIZED">Autorizado</option>
          <option value="SETTLED">Capturado</option>
          <option value="PARTIALLY_REFUNDED">Reembolsado parcial</option>
          <option value="REFUNDED">Reembolsado</option>
          <option value="FAILED">Fallido</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </label>
      <label className="adminField"><span>Referencia de compra</span><input defaultValue={filters.transactionReference ?? ""} name="transactionReference" placeholder="Buscar referencia" /></label>
      <button className="adminButton adminButtonPrimary" type="submit"><Search aria-hidden="true" size={16} /> Aplicar filtros</button>
      <Link className="adminButton" href={`/admin/pagos?tab=${current}`}>Limpiar</Link>
    </form>
  );
}

function refundEvidenceHref(transactionId: string, filters: PaymentsAdminFilters) {
  const params = new URLSearchParams({ tab: "reembolsos", transactionId, drawer: "refund-evidence" });
  if (filters.transactionReference?.trim()) params.set("transactionReference", filters.transactionReference.trim());
  if (filters.transactionStatus?.trim()) params.set("transactionStatus", filters.transactionStatus.trim());
  return `/admin/pagos?${params.toString()}`;
}

function operationsResultText(data: PaymentsAdminData) {
  if (!data.transactions.ok) {
    return null;
  }

  const { items, offset, total } = data.transactions.data;
  if (!items.length) {
    return "No hay operaciones que coincidan con los filtros.";
  }
  return `Mostrando ${offset + 1}–${offset + items.length} de ${total} operaciones.`;
}

function OperationTable({
  items,
  showManagementLink = false,
}: {
  items: PaymentOperationAdminRecord[];
  showManagementLink?: boolean;
}) {
  if (!items.length) {
    return <div className="adminEmptyState">No hay operaciones que coincidan con los filtros.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable paymentsOperationsTable">
        <thead>
          <tr>
            <th>Referencia</th><th>Estado</th><th>Método</th><th>Importe</th><th>Capturado</th><th>Reembolsado</th><th>Actualización</th>{showManagementLink ? <th>Acción</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const methods = item.paymentMethods.map((method) => method.name).join(" · ") || "Sin método informado";
            const canManage = item.refundableMinor > 0 || item.cancellableMinor > 0 || item.refundsCount > 0 || item.cancellationsCount > 0;
            return (
              <tr key={item.transactionId}>
                <td><strong>{item.paymentReference ?? item.referenceId ?? "Pago sin referencia"}</strong></td>
                <td><span className={transactionStatusBadge(item.status)}>{transactionStatusText(item.status)}</span></td>
                <td>{methods}</td>
                <td>{moneyText(item.valueMinor, item.currency)}</td>
                <td>{moneyText(item.settledMinor, item.currency)}</td>
                <td>{moneyText(item.refundedMinor, item.currency)}</td>
                <td>{dateText(item.updatedAt ?? item.createdAt)}</td>
                {showManagementLink ? <td>{canManage ? <Link className="adminButton" href={`/admin/pagos?tab=reembolsos&transactionReference=${encodeURIComponent(item.paymentReference ?? item.referenceId ?? "")}`}>Gestionar</Link> : "-"}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReimbursementActionForm({
  item,
  kind,
  canManage,
}: {
  item: PaymentOperationAdminRecord;
  kind: "refund" | "cancellation";
  canManage: boolean;
}) {
  const valueMinor = kind === "refund" ? item.refundableMinor : item.cancellableMinor;
  if (!canManage || valueMinor <= 0) {
    return null;
  }

  if (kind === "refund") {
    return (
      <div className="paymentsOperationAction">
        <PaymentRefundRequestForm
          currency={item.currency}
          referenceId={item.referenceId}
          refundId={randomUUID()}
          refundableMinor={valueMinor}
          transactionId={item.transactionId}
        />
      </div>
    );
  }

  return (
    <div className="paymentsOperationAction paymentsOperationRestricted">
      <span>Cancelación de {moneyText(valueMinor, item.currency)}</span>
      <span>La cancelación directa sigue bloqueada: solo aplica antes de una captura confirmada.</span>
    </div>
  );
}

function RefundsTable({
  capabilities,
  filters,
  items,
}: {
  capabilities: PaymentsAdminCapabilities;
  filters: PaymentsAdminFilters;
  items: PaymentOperationAdminRecord[];
}) {
  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable paymentsRefundsTable">
        <thead><tr><th>Referencia</th><th>Estado</th><th>Capturado</th><th>Reembolsado</th><th>Saldo reembolsable</th><th>Acciones</th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.transactionId}>
              <td><strong>{item.referenceId ?? "Compra sin referencia"}</strong></td>
              <td><span className={transactionStatusBadge(item.status)}>{transactionStatusText(item.status)}</span></td>
              <td>{moneyText(item.settledMinor, item.currency)}</td>
              <td>{moneyText(item.refundedMinor, item.currency)}</td>
              <td>{moneyText(item.refundableMinor, item.currency)}</td>
              <td>
                <div className="paymentsOperationActions">
                  {item.refundsCount > 0 ? <Link className="adminButton" href={refundEvidenceHref(item.transactionId, filters)}>Ver evidencia</Link> : null}
                  <ReimbursementActionForm canManage={capabilities.canRefundPayments} item={item} kind="refund" />
                  <ReimbursementActionForm canManage={capabilities.canProcessTransactions} item={item} kind="cancellation" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RefundTimeline({ refund }: { refund: PaymentRefundEvidence }) {
  const events = [
    { at: refund.requestedAt, label: "Solicitud creada", detail: "El importe quedó reservado para evitar duplicados." },
    { at: refund.submittedAt, label: "Envío iniciado al proveedor", detail: refund.providerName ? `Operación enviada a ${refund.providerName}.` : "Operación enviada al proveedor original." },
    { at: refund.providerAcceptedAt, label: "Proveedor aceptó la solicitud", detail: refund.providerStatus ? `Estado inicial del proveedor: ${refund.providerStatus}.` : "La solicitud obtuvo una referencia externa." },
    { at: refund.succeededAt, label: "Reembolso confirmado", detail: "El proveedor confirmó el resultado financiero." },
    { at: refund.failedAt, label: "Reembolso fallido", detail: refund.failureMessage ?? "El proveedor confirmó que la operación no se completó." },
    { at: refund.updatedAt, label: "Última actualización", detail: `Estado actual: ${refundStatusText(refund.status)}.` },
  ].filter((event) => Boolean(event.at));
  const uniqueEvents = events.filter((event, index, all) =>
    all.findIndex((candidate) => candidate.at === event.at && candidate.label === event.label) === index,
  );

  return (
    <ol className="paymentsRefundTimeline">
      {uniqueEvents.map((event) => (
        <li key={`${event.label}-${event.at}`}>
          <time>{dateText(event.at)}</time>
          <div><strong>{event.label}</strong><span>{event.detail}</span></div>
        </li>
      ))}
    </ol>
  );
}

function refundProgressCopy(refund: PaymentRefundEvidence) {
  switch (refund.status) {
    case "REQUESTED":
      return "Solicitud guardada y saldo reservado. El worker seguro todavía debe iniciar el envío al proveedor.";
    case "SUBMITTING":
      return "Payments está enviando la solicitud al proveedor original con una clave idempotente.";
    case "PROVIDER_ACCEPTED":
      return "El proveedor aceptó la solicitud y devolvió una referencia. Falta la confirmación financiera final.";
    case "PENDING":
      return "El proveedor mantiene el reembolso pendiente de confirmación. El importe sigue reservado para evitar duplicados.";
    case "REQUIRES_ACTION":
      return "El proveedor requiere una revisión o información adicional. No se ha confirmado el movimiento de dinero.";
    case "SUCCEEDED":
    case "REFUNDED":
      return "El proveedor confirmó el reembolso. El estado del pago ya refleja el importe efectivamente devuelto.";
    case "FAILED":
      return "El proveedor confirmó que el reembolso falló. El importe no debe considerarse devuelto al comprador.";
    case "MANUAL_REVIEW":
      return "La operación requiere revisión manual antes de tomar cualquier otra acción financiera.";
    default:
      return "Payments conserva el estado y la evidencia del proveedor para esta operación.";
  }
}

function isRefundConfirmationInProgress(status: string) {
  return ["REQUESTED", "SUBMITTING", "PROVIDER_ACCEPTED", "PENDING"].includes(status);
}

function RefundEvidencePanel({
  evidence,
  filters,
}: {
  evidence: PaymentTransactionEvidence;
  filters: PaymentsAdminFilters;
}) {
  const closeParams = new URLSearchParams({ tab: "reembolsos" });
  if (filters.transactionReference?.trim()) closeParams.set("transactionReference", filters.transactionReference.trim());
  if (filters.transactionStatus?.trim()) closeParams.set("transactionStatus", filters.transactionStatus.trim());

  return (
    <div className="adminDrawerBackdrop paymentsRefundEvidenceBackdrop">
      <Link aria-label="Cerrar evidencia del reembolso" className="paymentsRefundEvidenceBackdropLink" href={`/admin/pagos?${closeParams.toString()}`} />
      <aside aria-label="Evidencia del reembolso" aria-modal="true" className="adminSideDrawer paymentsRefundEvidenceDrawer" role="dialog">
      <div className="adminSideDrawerHeader">
        <div>
          <h2>Evidencia del reembolso</h2>
          <p>Confirmación financiera obtenida desde Payments. No se muestra respuesta cruda ni secretos del PSP.</p>
        </div>
        <Link className="adminButton" href={`/admin/pagos?${closeParams.toString()}`}>Cerrar detalle</Link>
      </div>
      <div className="paymentsRefundEvidenceDrawerBody">
      <PaymentRefundEvidenceAutoRefresh active={evidence.refunds.some((refund) => isRefundConfirmationInProgress(refund.status))} />
      <section className="paymentsRefundEvidenceSummary" aria-label="Resumen del pago">
        <h3>Pago original</h3>
        <dl className="paymentsRefundEvidenceDetails">
          <div><dt>Referencia de pago</dt><dd><strong>{evidence.paymentReference ?? evidence.referenceId ?? "Pago sin referencia"}</strong></dd></div>
          <div><dt>Estado de pago</dt><dd><span className={transactionStatusBadge(evidence.status)}>{transactionStatusText(evidence.status)}</span></dd></div>
          <div><dt>Capturado</dt><dd>{moneyText(evidence.settledMinor, evidence.currency)}</dd></div>
          <div><dt>Reembolsado confirmado</dt><dd>{moneyText(evidence.refundedMinor, evidence.currency)}</dd></div>
          <div><dt>Disponible para reembolsar</dt><dd>{moneyText(evidence.refundableMinor, evidence.currency)}</dd></div>
        </dl>
      </section>
      {!evidence.refunds.length ? <div className="adminEmptyState">Esta operación no tiene reembolsos registrados.</div> : evidence.refunds.map((refund) => (
        <section className="paymentsRefundEvidenceItem" key={refund.refundId}>
          <div className="paymentsRefundEvidenceTitle">
            <div><h3>Reembolso {moneyText(refund.valueMinor, refund.currency)}</h3><p>Solicitado {dateText(refund.requestedAt)}</p></div>
            <span className={refundStatusBadge(refund.status)}>{refundStatusText(refund.status)}</span>
          </div>
          <p className="paymentsRefundProgressCopy">{refundProgressCopy(refund)}</p>
          <dl className="paymentsRefundEvidenceDetails">
            <div><dt>Proveedor</dt><dd>{refund.providerName ?? "Pendiente de asignar"}</dd></div>
            <div><dt>Estado del proveedor</dt><dd>{refund.providerStatus ?? "Pendiente de confirmación"}</dd></div>
            <div><dt>Referencia del proveedor</dt><dd>{refund.providerRefundId ? <code>{refund.providerRefundId}</code> : "Pendiente de referencia"}</dd></div>
            <div><dt>Resultado o incidencia</dt><dd>{refund.failureMessage ?? refund.failureCode ?? "Sin incidencias"}</dd></div>
            <div><dt>Solicitud creada</dt><dd>{dateText(refund.requestedAt)}</dd></div>
            <div><dt>Enviado al proveedor</dt><dd>{dateText(refund.submittedAt)}</dd></div>
            <div><dt>Aceptado por proveedor</dt><dd>{dateText(refund.providerAcceptedAt)}</dd></div>
            <div><dt>Confirmación final</dt><dd>{dateText(refund.succeededAt ?? refund.failedAt)}</dd></div>
          </dl>
          <div className="paymentsRefundTimelineSection"><h4>Timeline auditable</h4><RefundTimeline refund={refund} /></div>
        </section>
      ))}
      </div>
      </aside>
    </div>
  );
}

function OperationsPanel({ data, filters }: { data: PaymentsAdminData; filters: PaymentsAdminFilters }) {
  const items = data.transactions.ok ? data.transactions.data.items : [];
  return (
    <div className="paymentsOperationsLayout">
      <section className="adminCard paymentsOperationsOverview">
        <div className="adminCardHeader"><div><h2>Operaciones</h2><p>Consulta cobros y excepciones por tenant. Los KPIs reflejan solo los resultados cargados.</p></div></div>
        <OperationsKpis data={data} />
      </section>
      <section className="adminCard paymentsOperationsTableCard">
        <div className="adminCardHeader"><div><h2>Bandeja de operaciones</h2><p>{operationsResultText(data) ?? "No se ha podido consultar la bandeja."}</p></div></div>
        <OperationsFilters current="operaciones" filters={filters} />
        {!data.transactions.ok ? <ResultBanner result={data.transactions} /> : <OperationTable items={items} showManagementLink />}
      </section>
    </div>
  );
}

function RefundsPanel({ capabilities, data, filters }: { capabilities: PaymentsAdminCapabilities; data: PaymentsAdminData; filters: PaymentsAdminFilters }) {
  const items = data.transactions.ok
    ? data.transactions.data.items.filter((item) => item.refundableMinor > 0 || item.cancellableMinor > 0 || item.refundsCount > 0 || item.cancellationsCount > 0)
    : [];

  return (
    <div className="paymentsOperationsLayout">
      <section className="adminCard paymentsOperationsOverview">
        <div className="adminCardHeader"><div><h2>Reembolsos y cancelaciones</h2><p>Solicitudes financieras con confirmación explícita; el estado final se actualiza desde Payments.</p></div><RotateCcw aria-hidden="true" size={18} /></div>
        <OperationsKpis data={data} />
      </section>
      <section className="adminCard paymentsOperationsTableCard">
        <div className="adminCardHeader"><div><h2>Bandeja de postventa financiera</h2><p>Solo se muestran operaciones con reembolsos, cancelaciones o saldo pendiente de gestionar.</p></div></div>
        <OperationsFilters current="reembolsos" filters={filters} />
        {!data.transactions.ok ? <ResultBanner result={data.transactions} /> : !items.length ? <div className="adminEmptyState">No hay reembolsos ni cancelaciones para gestionar con estos filtros.</div> : <RefundsTable capabilities={capabilities} filters={filters} items={items} />}
      </section>
      {filters.drawer === "refund-evidence" && filters.transactionId ? !data.transactionEvidence.ok ? <ResultBanner result={data.transactionEvidence} /> : data.transactionEvidence.data ? <RefundEvidencePanel evidence={data.transactionEvidence.data} filters={filters} /> : null : null}
    </div>
  );
}

function PaymentsSummaryPanel({ data }: { data: PaymentsAdminData }) {
  return (
    <div className="paymentsSummaryLayout">
      <section className="adminCard">
        <div className="adminCardHeader">
          <div>
            <h2>Resumen de Pagos</h2>
            <p>Estado de la configuración disponible para este tenant.</p>
          </div>
        </div>
        <PaymentsKpis data={data} />
      </section>
      <section className="adminCard">
        <div className="adminCardHeader"><div><h2>Operación financiera</h2><p>Cobros y excepciones de los resultados cargados.</p></div></div>
        <OperationsKpis data={data} />
      </section>
    </div>
  );
}

function StatusActionForm({
  active,
  canManage,
  id,
  includeInactive,
  resource,
  tab,
}: {
  active: boolean;
  canManage: boolean;
  id: string;
  includeInactive: boolean;
  resource: "payment-systems" | "affiliations" | "rules";
  tab: PaymentsAdminTab;
}) {
  if (!canManage) {
    return null;
  }

  return (
    <form action={setPaymentResourceActiveAction}>
      <input name="tab" type="hidden" value={tab} />
      <input name="resource" type="hidden" value={resource} />
      <input name="id" type="hidden" value={id} />
      <input name="active" type="hidden" value={active ? "false" : "true"} />
      <input name="includeInactive" type="hidden" value={includeInactive ? "true" : "false"} />
      <button className="adminButton" type="submit">{active ? "Desactivar" : "Reactivar"}</button>
    </form>
  );
}

function PaymentSystemsTable({
  canManage,
  includeInactive,
  items,
}: {
  canManage: boolean;
  includeInactive: boolean;
  items: PaymentSystemAdminRecord[];
}) {
  if (!items.length) {
    return <div className="adminEmptyState">No hay metodos de pago configurados.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th>Método</th>
            <th>Proveedor</th>
            <th>Grupo</th>
            <th>Tipo</th>
            <th>Cuotas</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.paymentSystemId}>
              <td><strong>{item.name}</strong></td>
              <td>{valueText(item.provider)}</td>
              <td>{valueText(item.groupName)}</td>
              <td>{valueText(item.methodType)}</td>
              <td>{item.supportsInstallments ? valueText(item.maxInstallments) : "No"}</td>
              <td><span className={badge(item.active)}>{item.active ? "Activo" : "Inactivo"}</span></td>
              <td>
                <StatusActionForm
                  active={item.active}
                  canManage={canManage}
                  id={item.paymentSystemId}
                  includeInactive={includeInactive}
                  resource="payment-systems"
                  tab="metodos"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AffiliationsTable({
  canManage,
  includeInactive,
  items,
}: {
  canManage: boolean;
  includeInactive: boolean;
  items: PaymentAffiliationAdminRecord[];
}) {
  if (!items.length) {
    return <div className="adminEmptyState">No hay afiliaciones PSP configuradas.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Integración</th>
            <th>Cuenta merchant</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.affiliationId}>
              <td><strong>{item.name}</strong></td>
              <td>{valueText(item.provider)}</td>
              <td>{valueText(item.merchantId)}</td>
              <td><span className={badge(item.active)}>{item.active ? "Activa" : "Inactiva"}</span></td>
              <td>
                <StatusActionForm
                  active={item.active}
                  canManage={canManage}
                  id={item.affiliationId}
                  includeInactive={includeInactive}
                  resource="affiliations"
                  tab="proveedores"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RulesTable({
  canManage,
  currency,
  affiliations,
  includeInactive,
  items,
  paymentSystems,
}: {
  canManage: boolean;
  currency: string;
  affiliations: PaymentAffiliationAdminRecord[];
  includeInactive: boolean;
  items: PaymentRuleAdminRecord[];
  paymentSystems: PaymentSystemAdminRecord[];
}) {
  if (!items.length) {
    return <div className="adminEmptyState">No hay reglas de routing de pagos.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th>Regla</th>
            <th>Prioridad</th>
            <th>Método</th>
            <th>Proveedor</th>
            <th>País / moneda</th>
            <th>Rango</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.ruleId}>
              <td><strong>{item.name}</strong></td>
              <td>{typeof item.priority === "number" ? `Prioridad ${item.priority}` : "Sin prioridad"}</td>
              <td>{paymentSystemName(paymentSystems, item.paymentSystemId)}</td>
              <td>{affiliationName(affiliations, item.affiliationId)}</td>
              <td>{valueText(item.country)} / {valueText(item.currency)}</td>
              <td>{moneyText(item.minValueMinor, item.currency ?? currency)} — {moneyText(item.maxValueMinor, item.currency ?? currency)}</td>
              <td><span className={badge(item.active)}>{item.active ? "Activa" : "Inactiva"}</span></td>
              <td>
                <StatusActionForm
                  active={item.active}
                  canManage={canManage}
                  id={item.ruleId}
                  includeInactive={includeInactive}
                  resource="rules"
                  tab="routing"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreatePaymentSystemDrawer({ includeInactive }: { includeInactive: boolean }) {
  return (
    <div className="adminDrawerBackdrop">
      <Link aria-label="Cerrar creación de método" className="paymentsConfigurationDrawerBackdropLink" href={paymentConfigurationHref("metodos", includeInactive)} />
      <aside aria-label="Añadir método de pago" aria-modal="true" className="adminSideDrawer paymentsConfigurationDrawer" role="dialog">
        <div className="adminSideDrawerHeader">
        <div>
          <h2>Añadir método</h2>
          <p>Define un método que ya esté instalado y soportado por Payments.</p>
        </div>
          <Link className="adminButton adminButtonTiny" href={paymentConfigurationHref("metodos", includeInactive)}>Cerrar</Link>
        </div>
        <form action={createPaymentSystemAction} className="pricingDenseForm">
          <label className="adminField"><span>Identificador interno</span><input name="paymentSystemId" placeholder="stripe-card" required /></label>
          <label className="adminField"><span>Nombre</span><input name="name" placeholder="Tarjeta" required /></label>
          <label className="adminField"><span>Proveedor</span><select name="provider" required><option value="stripe">Stripe</option><option value="paypal">PayPal</option></select></label>
          <label className="adminField"><span>Grupo</span><input name="groupName" placeholder="cards" /></label>
          <label className="adminField"><span>Tipo</span><input name="methodType" placeholder="CREDIT_CARD" /></label>
          <label className="adminField"><span>Máximo de cuotas</span><input name="maxInstallments" min="1" type="number" /></label>
          <label className="adminCheckbox"><input name="supportsInstallments" type="checkbox" /> Permite cuotas</label>
          <label className="adminCheckbox"><input defaultChecked name="active" type="checkbox" /> Activo</label>
          <button className="adminButton adminButtonPrimary" type="submit">Guardar método</button>
        </form>
      </aside>
    </div>
  );
}

function CreateAffiliationDrawer({ includeInactive }: { includeInactive: boolean }) {
  return (
    <div className="adminDrawerBackdrop">
      <Link aria-label="Cerrar creación de proveedor" className="paymentsConfigurationDrawerBackdropLink" href={paymentConfigurationHref("proveedores", includeInactive)} />
      <aside aria-label="Añadir proveedor de pago" aria-modal="true" className="adminSideDrawer paymentsConfigurationDrawer" role="dialog">
        <div className="adminSideDrawerHeader">
        <div>
          <h2>Añadir proveedor</h2>
          <p>Guarda referencias operativas; las credenciales se mantienen en Payments/BFF.</p>
        </div>
          <Link className="adminButton adminButtonTiny" href={paymentConfigurationHref("proveedores", includeInactive)}>Cerrar</Link>
        </div>
        <form action={createPaymentAffiliationAction} className="pricingDenseForm">
          <label className="adminField"><span>Identificador interno</span><input name="affiliationId" placeholder="stripe-main" required /></label>
          <label className="adminField"><span>Nombre</span><input name="name" placeholder="Stripe principal" required /></label>
          <label className="adminField"><span>Proveedor</span><select name="provider" required><option value="stripe">Stripe</option><option value="paypal">PayPal</option></select></label>
          <label className="adminField"><span>Cuenta merchant</span><input name="merchantId" placeholder="acct_..." /></label>
          <label className="adminCheckbox"><input defaultChecked name="active" type="checkbox" /> Activa</label>
          <button className="adminButton adminButtonPrimary" type="submit">Guardar proveedor</button>
        </form>
      </aside>
    </div>
  );
}

function CreateRuleDrawer({ data, includeInactive }: { data: PaymentsAdminData; includeInactive: boolean }) {
  const systems = data.paymentSystems.ok ? data.paymentSystems.data : [];
  const affiliations = data.affiliations.ok ? data.affiliations.data : [];

  return (
    <div className="adminDrawerBackdrop">
      <Link aria-label="Cerrar creación de regla" className="paymentsConfigurationDrawerBackdropLink" href={paymentConfigurationHref("routing", includeInactive)} />
      <aside aria-label="Añadir regla de routing" aria-modal="true" className="adminSideDrawer paymentsConfigurationDrawer" role="dialog">
        <div className="adminSideDrawerHeader">
        <div>
          <h2>Añadir regla</h2>
          <p>Define el orden de selección por contexto comercial y proveedor.</p>
        </div>
          <Link className="adminButton adminButtonTiny" href={paymentConfigurationHref("routing", includeInactive)}>Cerrar</Link>
        </div>
        <form action={createPaymentRuleAction} className="pricingDenseForm">
          <label className="adminField"><span>Identificador interno</span><input name="ruleId" placeholder="stripe-es-eur" required /></label>
          <label className="adminField"><span>Nombre</span><input name="name" placeholder="Stripe ES EUR" required /></label>
          <label className="adminField"><span>Método</span><select name="paymentSystemId" required>{systems.map((item) => <option key={item.paymentSystemId} value={item.paymentSystemId}>{item.name}</option>)}</select></label>
          <label className="adminField"><span>Proveedor</span><select name="affiliationId" required>{affiliations.map((item) => <option key={item.affiliationId} value={item.affiliationId}>{item.name}</option>)}</select></label>
          <label className="adminField"><span>Prioridad</span><input defaultValue="100" name="priority" type="number" /></label>
          <label className="adminField"><span>País</span><input defaultValue={data.context.country} name="country" /></label>
          <label className="adminField"><span>Moneda</span><input defaultValue={data.context.currency} name="currency" /></label>
          <label className="adminField"><span>Importe mínimo (céntimos)</span><input name="minValueMinor" type="number" /></label>
          <label className="adminField"><span>Importe máximo (céntimos)</span><input name="maxValueMinor" type="number" /></label>
          <label className="adminCheckbox"><input defaultChecked name="active" type="checkbox" /> Activa</label>
          <button className="adminButton adminButtonPrimary" type="submit">Guardar regla</button>
        </form>
      </aside>
    </div>
  );
}

function MethodsPanel({
  capabilities,
  data,
  includeInactive,
}: {
  capabilities: PaymentsAdminCapabilities;
  data: PaymentsAdminData;
  includeInactive: boolean;
}) {
  const items = data.paymentSystems.ok ? data.paymentSystems.data : [];

  return (
    <div className="paymentsConfigurationLayout">
      <ConfigurationKpis items={items} />
      <section className="adminCard paymentsConfigurationTable">
        <div className="adminCardHeader">
          <div><h2>Métodos de pago</h2><p>Storefront solo ofrece los métodos activos para esta tienda.</p></div>
          {capabilities.canManagePayments ? <Link className="adminButton adminButtonPrimary" href={paymentConfigurationHref("metodos", includeInactive, "create-payment-system")}>Nuevo método</Link> : null}
        </div>
        {!data.paymentSystems.ok ? (
          <ResultBanner result={data.paymentSystems} />
        ) : (
          <PaymentSystemsTable
            canManage={capabilities.canManagePayments}
            includeInactive={includeInactive}
            items={data.paymentSystems.data}
          />
        )}
      </section>
    </div>
  );
}

function AffiliationsPanel({
  capabilities,
  data,
  includeInactive,
}: {
  capabilities: PaymentsAdminCapabilities;
  data: PaymentsAdminData;
  includeInactive: boolean;
}) {
  const items = data.affiliations.ok ? data.affiliations.data : [];

  return (
    <div className="paymentsConfigurationLayout">
      <ConfigurationKpis items={items} />
      <section className="adminCard paymentsConfigurationTable">
        <div className="adminCardHeader">
          <div><h2>Proveedores de pago</h2><p>Conectores operativos para Stripe, PayPal y futuros proveedores.</p></div>
          {capabilities.canManagePayments ? <Link className="adminButton adminButtonPrimary" href={paymentConfigurationHref("proveedores", includeInactive, "create-affiliation")}>Nuevo proveedor</Link> : null}
        </div>
        {!data.affiliations.ok ? (
          <ResultBanner result={data.affiliations} />
        ) : (
          <AffiliationsTable
            canManage={capabilities.canManagePayments}
            includeInactive={includeInactive}
            items={data.affiliations.data}
          />
        )}
      </section>
    </div>
  );
}

function RulesPanel({
  capabilities,
  data,
  includeInactive,
}: {
  capabilities: PaymentsAdminCapabilities;
  data: PaymentsAdminData;
  includeInactive: boolean;
}) {
  const items = data.rules.ok ? data.rules.data : [];
  const paymentSystems = data.paymentSystems.ok ? data.paymentSystems.data : [];
  const affiliations = data.affiliations.ok ? data.affiliations.data : [];

  return (
    <div className="paymentsConfigurationLayout">
      <ConfigurationKpis items={items} />
      <section className="adminCard paymentsConfigurationTable">
        <div className="adminCardHeader">
          <div><h2>Reglas de routing</h2><p>Orden de selección por método, proveedor, país, moneda e importe.</p></div>
          {capabilities.canManagePayments ? <Link className="adminButton adminButtonPrimary" href={paymentConfigurationHref("routing", includeInactive, "create-payment-rule")}>Nueva regla</Link> : null}
        </div>
        {!data.rules.ok ? (
          <ResultBanner result={data.rules} />
        ) : (
          <RulesTable
            canManage={capabilities.canManagePayments}
            currency={data.context.currency}
            affiliations={affiliations}
            includeInactive={includeInactive}
            items={items}
            paymentSystems={paymentSystems}
          />
        )}
      </section>
    </div>
  );
}

function DiagnosticsPanel({ data, filters }: { data: PaymentsAdminData; filters: PaymentsAdminFilters }) {
  const paymentSystems = data.paymentSystems.ok ? data.paymentSystems.data : [];
  const affiliations = data.affiliations.ok ? data.affiliations.data : [];
  const rules = data.rules.ok ? data.rules.data : [];

  return (
    <div className="paymentsConfigurationLayout">
      <section className="adminCard paymentsConfigurationTable">
        <div className="adminCardHeader"><div><h2>Estado de configuración</h2><p>Comprueba que exista una ruta activa antes de habilitar un método en Storefront.</p></div></div>
        <div className="adminTableScroller">
          <table className="adminTable pricingTable">
            <thead><tr><th>Dominio</th><th>Configurados</th><th>Activos</th><th>Comprobación</th></tr></thead>
            <tbody>
              <tr><td>Métodos</td><td>{paymentSystems.length}</td><td>{paymentSystems.filter((item) => item.active).length}</td><td>Disponibles para checkout</td></tr>
              <tr><td>Proveedores</td><td>{affiliations.length}</td><td>{affiliations.filter((item) => item.active).length}</td><td>Conectores habilitados</td></tr>
              <tr><td>Routing</td><td>{rules.length}</td><td>{rules.filter((item) => item.active).length}</td><td>Rutas para seleccionar proveedor</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <div className="adminGrid paymentsDiagnosticsGrid">
      <section className="adminCard">
        <div className="adminCardHeader"><div><h2>Lookup de tarjeta</h2><p>Valida BIN contra Payments sin tocar datos PAN/CVV.</p></div><Radar aria-hidden="true" size={18} /></div>
        <form action="/admin/pagos" className="pricingDenseForm" method="get">
          <input name="tab" type="hidden" value="diagnostico" />
          {filters.includeInactive === "true" ? <input name="includeInactive" type="hidden" value="true" /> : null}
          <label className="adminField"><span>BIN</span><input name="cardBin" placeholder="424242" defaultValue={filters.cardBin ?? ""} /></label>
          <button className="adminButton adminButtonPrimary" type="submit">Consultar</button>
        </form>
        {!data.cardLookup.ok ? <ResultBanner result={data.cardLookup} /> : null}
        {data.cardLookup.ok && data.cardLookup.data ? (
          <dl className="adminDefinitionList">
            <div><dt>BIN</dt><dd>{valueText(data.cardLookup.data.bin ?? filters.cardBin)}</dd></div>
            <div><dt>Marca</dt><dd>{valueText(data.cardLookup.data.brand)}</dd></div>
            <div><dt>Metodos compatibles</dt><dd>{data.cardLookup.data.paymentSystems.map((item) => item.name).join(", ") || "-"}</dd></div>
          </dl>
        ) : (
          <div className="adminEmptyState">Introduce un BIN para comprobar routing de tarjeta.</div>
        )}
      </section>
      <section className="adminCard">
        <div className="adminCardHeader"><div><h2>Seguridad operativa</h2><p>La UI no captura PAN/CVV ni expone secretos PSP.</p></div></div>
        <ul className="adminStatusList">
          <li>PayPal y Stripe se operan mediante Payments/BFF.</li>
          <li>Los secretos quedan fuera de variables NEXT_PUBLIC.</li>
          <li>Storefront solo consume métodos activos por tenant.</li>
          <li>Una ruta inactiva no debe utilizarse para captar cobros.</li>
        </ul>
      </section>
      </div>
    </div>
  );
}

export function PaymentsAdminPage({
  invoiceCapabilities,
  invoiceData,
  invoiceFilters,
  paymentsCapabilities,
  paymentsData,
  paymentsFilters,
}: Props) {
  const current = activeTab(paymentsFilters);
  const includeInactive = paymentsFilters.includeInactive === "true";

  return (
    <main className="adminPage paymentsAdminPage">
      <PaymentsPageHeader data={paymentsData} />
      {paymentsFilters.notice ? (
        <div className="adminBanner adminBannerSuccess">
          <p>{paymentsFilters.notice}</p>
        </div>
      ) : null}
      <PaymentsTabs current={current} includeInactive={includeInactive} />
      {isConfigurationTab(current) ? <PaymentsToolbar current={current} includeInactive={includeInactive} /> : null}
      <div className="paymentsPageContent">
        {current === "resumen" ? <PaymentsSummaryPanel data={paymentsData} /> : null}
        {current === "operaciones" ? <OperationsPanel data={paymentsData} filters={paymentsFilters} /> : null}
        {current === "reembolsos" ? <RefundsPanel capabilities={paymentsCapabilities} data={paymentsData} filters={paymentsFilters} /> : null}
        {current === "facturas" ? (
          <InvoicesAdminPage capabilities={invoiceCapabilities} data={invoiceData} embedded filters={invoiceFilters} />
        ) : null}
        {current === "metodos" ? (
          <MethodsPanel capabilities={paymentsCapabilities} data={paymentsData} includeInactive={includeInactive} />
        ) : null}
        {current === "proveedores" ? (
          <AffiliationsPanel capabilities={paymentsCapabilities} data={paymentsData} includeInactive={includeInactive} />
        ) : null}
        {current === "routing" ? (
          <RulesPanel capabilities={paymentsCapabilities} data={paymentsData} includeInactive={includeInactive} />
        ) : null}
        {current === "diagnostico" ? <DiagnosticsPanel data={paymentsData} filters={paymentsFilters} /> : null}
      </div>
      {current === "metodos" && paymentsFilters.drawer === "create-payment-system" && paymentsCapabilities.canManagePayments ? <CreatePaymentSystemDrawer includeInactive={includeInactive} /> : null}
      {current === "proveedores" && paymentsFilters.drawer === "create-affiliation" && paymentsCapabilities.canManagePayments ? <CreateAffiliationDrawer includeInactive={includeInactive} /> : null}
      {current === "routing" && paymentsFilters.drawer === "create-payment-rule" && paymentsCapabilities.canManagePayments ? <CreateRuleDrawer data={paymentsData} includeInactive={includeInactive} /> : null}
    </main>
  );
}
