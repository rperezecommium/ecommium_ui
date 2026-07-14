import Link from "next/link";
import { Boxes, CreditCard, FileText, LifeBuoy, Search, Truck, X } from "lucide-react";
import type { ReactNode } from "react";
import type {
  AdminOrderDetail,
  AdminOrderOperation,
  AdminOrderSummary,
  AfterSalesCase,
  InvoiceTemplatePreview,
  OrdersAdminDrawerTab,
  OrdersAdminAuditEvent,
  OrdersAdminCapabilities,
  OrdersAdminData,
  OrdersAdminFilters,
} from "./orders-admin";
import { buildOrderAuditTimeline } from "./orders-admin";
import {
  applyOrdersFiltersAction,
  assignAfterSalesCaseAction,
  createOrderFulfillmentAction,
  createInvoiceAdjustmentAction,
  issueOrderInvoiceAction,
  requestOrderRefundAction,
  transitionFulfillmentStatusAction,
} from "./orders-admin-actions";

type Props = {
  capabilities: OrdersAdminCapabilities;
  data: OrdersAdminData;
  filters: OrdersAdminFilters;
};

const orderDrawerTabs: Array<{ id: OrdersAdminDrawerTab; label: string }> = [
  { id: "operacion", label: "Operacion" },
  { id: "datos", label: "Datos" },
  { id: "documentos", label: "Documentos" },
  { id: "soporte", label: "Soporte" },
  { id: "auditoria", label: "Auditoria" },
];

function ordersHref(filters: OrdersAdminFilters, patch: Partial<OrdersAdminFilters>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...patch };

  Object.entries(next).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  });

  return `/admin/pedidos${params.size ? `?${params.toString()}` : ""}`;
}

function activeOrderDrawerTab(filters: OrdersAdminFilters): OrdersAdminDrawerTab {
  return orderDrawerTabs.some((tab) => tab.id === filters.orderTab) ? filters.orderTab as OrdersAdminDrawerTab : "operacion";
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

function dateText(value: string | undefined) {
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

function moneyText(amountMinor: number | undefined, currency = "EUR") {
  if (typeof amountMinor !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function orderShortReference(orderId: string | undefined) {
  const normalized = orderId?.replace(/[^a-zA-Z0-9]/g, "").trim();
  if (!normalized) {
    return "-";
  }

  if (normalized.length <= 8) {
    return `#${normalized.toUpperCase()}`;
  }

  return `#${normalized.slice(-7).toUpperCase()}`;
}

function statusBadgeClass(status: string | undefined) {
  const value = status?.toUpperCase();
  if (value === "PAID" || value === "PAYMENT_SETTLED" || value === "SETTLED" || value === "ISSUED" || value === "DELIVERED" || value === "APPROVED") {
    return "adminBadge adminBadgeOk";
  }
  if (value === "PENDING" || value === "OPEN" || value === "IN_REVIEW" || value === "DRAFT") {
    return "adminBadge adminBadgeWarn";
  }
  if (value === "FAILED" || value === "CANCELED" || value === "REJECTED") {
    return "adminBadge adminBadgeError";
  }

  return "adminBadge";
}

function fulfillmentStepLabel(status: string | undefined) {
  switch (status?.toUpperCase()) {
    case "PENDING_FULFILLMENT":
    case "READY_TO_PICK":
    case "PICKING":
      return "En preparacion";
    case "PACKED":
      return "En despacho";
    case "SHIPPED":
      return "Enviado";
    case "DELIVERED":
      return "Entregado";
    case "FAILED":
      return "Revisar envio";
    default:
      return "En preparacion";
  }
}

function isOrderPaid(order: AdminOrderSummary) {
  const paymentStatus = order.paymentStatus?.toUpperCase();
  const orderStatus = order.status?.toUpperCase();

  return (
    paymentStatus === "PAID" ||
    paymentStatus === "SETTLED" ||
    paymentStatus === "APPROVED" ||
    orderStatus === "PAYMENT_SETTLED" ||
    orderStatus === "PAID" ||
    orderStatus === "SETTLED"
  );
}

function orderPaymentLabel(order: AdminOrderSummary) {
  if (order.paymentStatus) {
    return order.paymentStatus;
  }

  return isOrderPaid(order) ? "Pago confirmado" : "-";
}

function orderNextStep(order: AdminOrderSummary) {
  const fulfillmentStatus = order.fulfillmentStatus?.toUpperCase();
  const orderStatus = order.status?.toUpperCase();

  if (orderStatus === "CANCELED" || orderStatus === "FAILED") {
    return { label: "Revisar pedido", detail: valueText(order.status), badgeClass: "adminBadge adminBadgeError" };
  }
  if (!isOrderPaid(order)) {
    return { label: "Esperar pago", detail: valueText(order.paymentStatus), badgeClass: "adminBadge adminBadgeWarn" };
  }
  if (fulfillmentStatus === "DELIVERED") {
    return { label: "Completado", detail: "Entregado", badgeClass: "adminBadge adminBadgeOk" };
  }
  if (fulfillmentStatus === "FAILED") {
    return { label: "Resolver envio", detail: valueText(order.fulfillmentStatus), badgeClass: "adminBadge adminBadgeError" };
  }

  return {
    label: fulfillmentStepLabel(order.fulfillmentStatus),
    detail: valueText(order.fulfillmentStatus),
    badgeClass: fulfillmentStatus === "SHIPPED" ? "adminBadge adminBadgeOk" : "adminBadge adminBadgeWarn",
  };
}

function recordField(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

function nestedRecordField(record: Record<string, unknown> | null, parentKeys: string[], childKeys: string[]) {
  if (!record) {
    return undefined;
  }

  for (const parentKey of parentKeys) {
    const parent = record[parentKey];
    if (typeof parent !== "object" || parent === null || Array.isArray(parent)) {
      continue;
    }

    const value = recordField(parent as Record<string, unknown>, childKeys);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function shippingCarrierLabel(shipping: Record<string, unknown> | null) {
  return (
    recordField(shipping, ["carrierName", "carrierLabel", "selectedCarrier", "carrier"]) ??
    nestedRecordField(shipping, ["carrier", "selectedCarrier"], ["label", "name", "carrierName", "id"])
  );
}

function shippingCarrierId(shipping: Record<string, unknown> | null) {
  return (
    recordField(shipping, ["carrierId", "selectedCarrierId"]) ??
    nestedRecordField(shipping, ["carrier", "selectedCarrier"], ["id", "carrierId"])
  );
}

function shippingTrackingNumber(shipping: Record<string, unknown> | null) {
  return recordField(shipping, ["trackingNumber", "trackingCode", "trackingReference"]);
}

function recordArray(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) {
    return [];
  }

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
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

function noticeBannerClass(kind: OrdersAdminFilters["noticeKind"]) {
  if (kind === "error") {
    return "adminBanner adminBannerError";
  }
  if (kind === "success") {
    return "adminBanner adminBannerSuccess";
  }

  return "adminBanner adminBannerInfo";
}

function OrdersPagination({
  count,
  filters,
  limit,
  offset,
  total,
}: {
  count: number;
  filters: OrdersAdminFilters;
  limit: number;
  offset: number;
  total: number;
}) {
  const currentLimit = limit > 0 ? limit : count || 25;
  const currentOffset = Math.max(0, offset);
  const firstItem = total > 0 ? currentOffset + 1 : 0;
  const lastItem = Math.min(currentOffset + count, total);
  const previousOffset = Math.max(0, currentOffset - currentLimit);
  const nextOffset = currentOffset + currentLimit;
  const hasPrevious = currentOffset > 0;
  const hasNext = nextOffset < total;

  return (
    <nav className="productListPagination" aria-label="Paginacion de pedidos">
      <p>
        Mostrando {firstItem}-{lastItem} de {total} pedidos
      </p>
      <div className="productListPaginationControls">
        <Link
          aria-disabled={!hasPrevious}
          className={`adminButton adminButtonTiny${hasPrevious ? "" : " adminButtonDisabled"}`}
          href={hasPrevious ? ordersHref(filters, { limit: String(currentLimit), offset: String(previousOffset) }) : ordersHref(filters, {})}
        >
          Anterior
        </Link>
        <Link
          aria-disabled={!hasNext}
          className={`adminButton adminButtonTiny${hasNext ? "" : " adminButtonDisabled"}`}
          href={hasNext ? ordersHref(filters, { limit: String(currentLimit), offset: String(nextOffset) }) : ordersHref(filters, {})}
        >
          Siguiente
        </Link>
      </div>
    </nav>
  );
}

function OrdersTable({ data, filters }: Props) {
  if (!data.orders.ok) {
    return <ResultBanner result={data.orders} />;
  }

  const orders = data.orders.data;

  if (!orders.items.length) {
    return <div className="adminEmptyState">No hay pedidos para el filtro actual.</div>;
  }

  return (
    <>
      <div className="adminTableScroller">
        <table className="adminTable pricingTable">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Pago</th>
              <th>Envio</th>
              <th>Siguiente paso</th>
              <th>Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.items.map((order) => {
              const nextStep = orderNextStep(order);

              return (
                <tr key={order.orderId}>
                  <td>
                    <strong>{orderShortReference(order.orderId)}</strong>
                    <div className="adminMuted">{dateText(order.createdAt)}</div>
                  </td>
                  <td>{valueText(order.customerId)}</td>
                  <td><span className={statusBadgeClass(order.status)}>{valueText(order.status)}</span></td>
                  <td><span className={isOrderPaid(order) ? "adminBadge adminBadgeOk" : statusBadgeClass(order.paymentStatus)}>{orderPaymentLabel(order)}</span></td>
                  <td><span className={statusBadgeClass(order.fulfillmentStatus)}>{valueText(order.fulfillmentStatus)}</span></td>
                  <td>
                    <span className={nextStep.badgeClass}>{nextStep.label}</span>
                    <div className="adminMuted">{nextStep.detail}</div>
                  </td>
                  <td>{moneyText(order.totalAmountMinor, order.currency)}</td>
                  <td>
                    <Link className="adminButton adminButtonTiny" href={ordersHref(filters, { orderId: order.orderId, orderTab: "operacion" })}>
                      Operar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <OrdersPagination
        count={orders.items.length}
        filters={filters}
        limit={orders.limit}
        offset={orders.offset}
        total={orders.total}
      />
    </>
  );
}

function DetailSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>{title}</h2>
        </div>
        {icon}
      </div>
      {children}
    </article>
  );
}

function OrderCoreDetail({ order }: { order: AdminOrderSummary | null }) {
  return (
    <dl className="adminDefinitionList">
      <div><dt>Referencia</dt><dd>{orderShortReference(order?.orderId)}</dd></div>
      <div><dt>ID interno</dt><dd>{valueText(order?.orderId)}</dd></div>
      <div><dt>Cliente</dt><dd>{valueText(order?.customerId)}</dd></div>
      <div><dt>Estado</dt><dd>{valueText(order?.status)}</dd></div>
      <div><dt>Total</dt><dd>{moneyText(order?.totalAmountMinor, order?.currency)}</dd></div>
    </dl>
  );
}

function firstRecordField(items: unknown[], keys: string[]) {
  for (const item of items) {
    const value = recordField(typeof item === "object" && item !== null ? item as Record<string, unknown> : null, keys);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function PaymentDetail({
  capabilities,
  detail,
}: {
  capabilities: OrdersAdminCapabilities;
  detail: AdminOrderDetail;
}) {
  const payment = detail.payment;
  const afterSales = detail.afterSales;
  const orderId = detail.order?.orderId;
  const caseId = String(recordField(afterSales, ["caseId"]) ?? "");
  const transactionId = String(recordField(payment, ["transactionId", "paymentId", "authorizationId"]) ?? "");
  const resolutionId = String(firstRecordField(recordArray(afterSales, ["resolutions"]), ["resolutionId", "id"]) ?? "");

  return (
    <>
      <dl className="adminDefinitionList">
        <div><dt>Estado</dt><dd>{valueText(recordField(payment, ["status", "transactionStatus", "paymentStatus"]))}</dd></div>
        <div><dt>Transaction</dt><dd>{valueText(transactionId)}</dd></div>
        <div><dt>PSP</dt><dd>{valueText(recordField(payment, ["provider", "psp", "gateway"]))}</dd></div>
        <div><dt>Refunds</dt><dd>{valueText(recordField(payment, ["refundsCount", "refundCount"]))}</dd></div>
      </dl>
      {capabilities.canManageAfterSales && caseId && transactionId ? (
        <form action={requestOrderRefundAction} className="pricingDenseForm">
          <input name="caseId" type="hidden" value={caseId} />
          <input name="orderId" type="hidden" value={orderId ?? ""} />
          <input name="transactionId" type="hidden" value={transactionId} />
          <label className="adminField">
            <span>Resolucion</span>
            <input name="resolutionId" placeholder="resolutionId" defaultValue={resolutionId} />
          </label>
          <button className="adminButton" type="submit">Solicitar refund</button>
        </form>
      ) : (
        <div className="adminButtonRow">
          {orderId ? (
            <Link className="adminButton adminButtonTiny" href={`/admin/postventa?orderId=${encodeURIComponent(orderId)}`}>
              Abrir postventa para refund
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}

function operationStatusLabel(status: string | undefined) {
  switch (status) {
    case "PAYMENT_REQUIRED":
      return "Pago pendiente";
    case "READY_TO_PREPARE":
    case "PREPARING":
      return "En preparacion";
    case "PICKING":
      return "En preparacion";
    case "DISPATCHING":
    case "PACKED":
      return "En despacho";
    case "SHIPPED":
      return "Enviado";
    case "DELIVERED":
      return "Entregado";
    case "FAILED":
      return "Incidencia";
    case "BLOCKED":
      return "Bloqueado";
    default:
      return "Sin estado operativo";
  }
}

function sectionStatusBadgeClass(status: string | undefined) {
  if (status === "ready") {
    return "adminBadge adminBadgeOk";
  }
  if (status === "attention" || status === "degraded") {
    return "adminBadge adminBadgeError";
  }
  if (status === "pending" || status === "empty") {
    return "adminBadge adminBadgeWarn";
  }

  return "adminBadge";
}

function OperationPrimaryAction({
  canManageShipping,
  operation,
  orderId,
  shipping,
}: {
  canManageShipping: boolean;
  operation: AdminOrderOperation;
  orderId: string | undefined;
  shipping: Record<string, unknown> | null;
}) {
  const action = operation.primaryAction;
  const currentCarrierLabel = shippingCarrierLabel(shipping);
  const currentCarrierId = shippingCarrierId(shipping);
  const currentTrackingNumber = shippingTrackingNumber(shipping);
  const carrierIdValue = typeof currentCarrierId === "string" || typeof currentCarrierId === "number" ? String(currentCarrierId) : "";
  const trackingNumberValue = typeof currentTrackingNumber === "string" ? currentTrackingNumber : "";

  if (!action || action.type === "NONE") {
    return (
      <div className="adminButtonRow">
        <span className={statusBadgeClass(operation.status)}>{action?.label ?? operationStatusLabel(operation.status)}</span>
      </div>
    );
  }

  if (!action.enabled) {
    return (
      <div className="adminButtonRow">
        <span className="adminBadge adminBadgeWarn">{action.label ?? "Accion no disponible"}</span>
        {action.reason ? <span className="adminMuted">{action.reason}</span> : null}
      </div>
    );
  }

  if (!canManageShipping) {
    return (
      <div className="adminButtonRow">
        <span className="adminBadge adminBadgeWarn">Falta permiso shipping.logistics.write</span>
      </div>
    );
  }

  if (action.type === "CREATE_FULFILLMENT") {
    return (
      <form action={createOrderFulfillmentAction} className="adminButtonRow">
        <input name="orderId" type="hidden" value={orderId ?? ""} />
        <button className="adminButton adminButtonPrimary" disabled={!orderId} type="submit">
          {action.label ?? "Iniciar preparacion"}
        </button>
      </form>
    );
  }

  if (!action.targetFulfillmentStatus) {
    return (
      <div className="adminButtonRow">
        <span className="adminBadge adminBadgeWarn">Siguiente estado no disponible</span>
      </div>
    );
  }

  if (action.requiresTracking) {
    return (
      <form action={transitionFulfillmentStatusAction} aria-label="Datos de envio" className="pricingDenseForm">
        <input name="orderId" type="hidden" value={orderId ?? ""} />
        <input name="status" type="hidden" value={action.targetFulfillmentStatus} />
        <div className="ordersFulfillmentSummary" aria-label="Resumen de envio">
          <div className="ordersFulfillmentSummaryHeader">
            <div>
              <span>Envio</span>
              <strong>{carrierIdValue ? "Listo para notificar" : "Falta transportista"}</strong>
            </div>
            <span className={carrierIdValue ? "adminBadge adminBadgeOk" : "adminBadge adminBadgeWarn"}>Seguimiento</span>
          </div>
          <dl className="ordersFulfillmentSummaryMeta">
            <div>
              <dt>Transportista actual</dt>
              <dd>{valueText(currentCarrierLabel)}</dd>
            </div>
            <div>
              <dt>Seguimiento actual</dt>
              <dd>{valueText(currentTrackingNumber)}</dd>
            </div>
          </dl>
        </div>
        <label className="adminField">
          <span>Numero de seguimiento</span>
          <input name="trackingNumber" placeholder="TRACK-001" defaultValue={trackingNumberValue} required />
        </label>
        {carrierIdValue ? (
          <input name="carrierId" type="hidden" value={carrierIdValue} />
        ) : (
          <label className="adminField">
            <span>Transportista</span>
            <input name="carrierId" placeholder="standard" required={action.requiresCarrier === true} />
          </label>
        )}
        <button className="adminButton adminButtonPrimary" disabled={!orderId} type="submit">
          {action.label ?? "Actualizar estado"}
        </button>
      </form>
    );
  }

  return (
    <form action={transitionFulfillmentStatusAction} className="adminButtonRow">
      <input name="orderId" type="hidden" value={orderId ?? ""} />
      <input name="status" type="hidden" value={action.targetFulfillmentStatus} />
      <button className="adminButton adminButtonPrimary" disabled={!orderId} type="submit">
        {action.label ?? "Actualizar estado"}
      </button>
    </form>
  );
}

function OrderOperationWorkspace({
  canManageShipping,
  detail,
}: {
  canManageShipping: boolean;
  detail: AdminOrderDetail;
}) {
  const operation = detail.operation;
  const orderId = detail.order?.orderId;

  if (!operation) {
    return (
      <section className="adminCard">
        <div className="adminCardHeader">
          <div>
            <h2>Operacion del pedido</h2>
            <p>El detalle aun no expone el resumen operativo del BFF.</p>
          </div>
          <span className="adminBadge adminBadgeWarn">Legacy</span>
        </div>
        <div className="adminEmptyState">Actualiza el BFF o vuelve a cargar el pedido.</div>
      </section>
    );
  }

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Operacion del pedido</h2>
          <p>Accion principal, bloqueos y salud operativa del pedido.</p>
        </div>
        <span className={statusBadgeClass(operation.status)}>{operationStatusLabel(operation.status)}</span>
      </div>
      <div className="customersOverviewSubsection">
        <h3>Siguiente paso</h3>
        <div className="ordersFulfillmentNext">
          <span>{operation.primaryAction?.type ?? "NONE"}</span>
          <strong>{operation.primaryAction?.label ?? operationStatusLabel(operation.status)}</strong>
        </div>
        <OperationPrimaryAction
          canManageShipping={canManageShipping}
          operation={operation}
          orderId={orderId}
          shipping={detail.shipping}
        />
      </div>
      {operation.blockers?.length ? (
        <div className="customersOverviewSubsection">
          <h3>Bloqueos</h3>
          {operation.blockers.map((blocker, index) => (
            <div className="adminBanner adminBannerWarning" key={`${blocker.code ?? "blocker"}-${index}`}>
              <p>{blocker.message ?? blocker.code}</p>
            </div>
          ))}
        </div>
      ) : null}
      {operation.sections?.length ? (
        <div className="customersOverviewSubsection">
          <h3>Checklist operativo</h3>
          <div className="customersOverviewList">
            {operation.sections.map((section) => (
              <div className="customersOverviewListItem" key={section.code ?? section.label}>
                <strong>{section.label ?? section.code}</strong>
                <span>{section.message ?? "-"}</span>
                <span className={sectionStatusBadgeClass(section.status)}>{valueText(section.status)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {operation.timeline?.length ? (
        <div className="customersOverviewSubsection">
          <h3>Linea operativa</h3>
          <div className="customersOverviewList">
            {operation.timeline.map((step) => (
              <div className="customersOverviewListItem" key={step.code ?? step.label}>
                <strong>{step.label ?? step.code}</strong>
                <span className={sectionStatusBadgeClass(step.state)}>{valueText(step.state)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ShippingDetail({ detail }: { detail: AdminOrderDetail }) {
  const shipping = detail.shipping;

  return (
    <>
      <dl className="adminDefinitionList">
        <div><dt>Estado</dt><dd>{valueText(recordField(shipping, ["status", "fulfillmentStatus"]))}</dd></div>
        <div><dt>Transportista</dt><dd>{valueText(shippingCarrierLabel(shipping))}</dd></div>
        <div><dt>Seguimiento</dt><dd>{valueText(recordField(shipping, ["trackingNumber", "trackingUrl"]))}</dd></div>
        <div><dt>Entrega</dt><dd>{valueText(recordField(shipping, ["estimatedDeliveryAt", "deliveredAt"]))}</dd></div>
      </dl>
    </>
  );
}

function InvoiceDetail({
  capabilities,
  detail,
}: {
  capabilities: OrdersAdminCapabilities;
  detail: AdminOrderDetail;
}) {
  const invoice = detail.invoice;
  const orderId = detail.order?.orderId;
  const invoiceId = String(recordField(invoice, ["invoiceId", "id"]) ?? "");
  const currency = String(recordField(invoice, ["currency"]) ?? detail.order?.currency ?? "EUR");
  const adjustments = recordArray(invoice, ["adjustments", "fiscalAdjustments", "creditNotes"]);

  return (
    <>
      <dl className="adminDefinitionList">
        <div><dt>Factura</dt><dd>{valueText(recordField(invoice, ["invoiceNumber", "invoiceId"]))}</dd></div>
        <div><dt>Estado</dt><dd>{valueText(recordField(invoice, ["status"]))}</dd></div>
        <div><dt>Total</dt><dd>{valueText(recordField(invoice, ["totalAmountMinor", "amountMinor"]))}</dd></div>
        <div><dt>Emitida</dt><dd>{valueText(recordField(invoice, ["issuedAt", "createdAt"]))}</dd></div>
      </dl>
      <div className="adminButtonRow">
        {invoiceId ? (
          <>
            <Link className="adminButton adminButtonTiny" href={`/admin/pagos?invoiceId=${encodeURIComponent(invoiceId)}`}>
              Abrir factura fiscal
            </Link>
            <Link className="adminButton adminButtonTiny" href={`/admin/pagos/invoices/${encodeURIComponent(invoiceId)}/document`} target="_blank">
              Ver documento
            </Link>
          </>
        ) : orderId ? (
          <Link className="adminButton adminButtonTiny" href={`/admin/pagos?orderId=${encodeURIComponent(orderId)}`}>
            Buscar facturas del pedido
          </Link>
        ) : null}
      </div>
      {capabilities.canManageInvoices && orderId ? (
        <form action={issueOrderInvoiceAction} className="adminButtonRow">
          <input name="orderId" type="hidden" value={orderId} />
          <button className="adminButton adminButtonPrimary" type="submit">Emitir factura</button>
        </form>
      ) : null}
      {adjustments.length ? (
        <div className="customersOverviewSubsection">
          <h3>Ajustes fiscales</h3>
          <div className="customersOverviewList">
            {adjustments.slice(0, 4).map((adjustment, index) => {
              const item = typeof adjustment === "object" && adjustment !== null ? adjustment as Record<string, unknown> : null;
              const label = valueText(recordField(item, ["adjustmentNumberFormatted", "externalReference", "adjustmentId"]));
              const amount = recordField(item, ["amountMinor"]);
              const itemCurrency = String(recordField(item, ["currency"]) ?? currency);

              return (
                <div className="customersOverviewListItem" key={`${label}-${index}`}>
                  <strong>{label}</strong>
                  <span>{valueText(recordField(item, ["adjustmentType", "documentType"]))}</span>
                  <span>{typeof amount === "number" ? moneyText(amount, itemCurrency) : valueText(amount)}</span>
                  <span>{dateText(String(recordField(item, ["issuedAt", "createdAt"]) ?? ""))}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {capabilities.canManageInvoices && orderId && invoiceId ? (
        <form action={createInvoiceAdjustmentAction} className="pricingDenseForm">
          <input name="orderId" type="hidden" value={orderId} />
          <input name="invoiceId" type="hidden" value={invoiceId} />
          <input name="currency" type="hidden" value={currency} />
          <label className="adminField">
            <span>Documento</span>
            <select name="adjustmentType" required>
              <option value="CREDIT_NOTE">Nota de credito</option>
              <option value="FISCAL_ADJUSTMENT">Ajuste fiscal</option>
            </select>
          </label>
          <label className="adminField">
            <span>Importe menor</span>
            <input name="amountMinor" min="1" placeholder="1299" required type="number" />
          </label>
          <label className="adminField">
            <span>Motivo</span>
            <input name="reason" placeholder="Devolucion parcial, correccion fiscal..." required />
          </label>
          <button className="adminButton" type="submit">Crear nota/ajuste</button>
        </form>
      ) : null}
    </>
  );
}

function AfterSalesDetail({
  capabilities,
  detail,
}: {
  capabilities: OrdersAdminCapabilities;
  detail: AdminOrderDetail;
}) {
  const afterSales = detail.afterSales;
  const orderId = detail.order?.orderId;
  const caseId = String(recordField(afterSales, ["caseId"]) ?? "");

  return (
    <>
      <dl className="adminDefinitionList">
        <div><dt>Caso</dt><dd>{valueText(caseId)}</dd></div>
        <div><dt>Estado</dt><dd>{valueText(recordField(afterSales, ["status"]))}</dd></div>
        <div><dt>Tipo</dt><dd>{valueText(recordField(afterSales, ["caseType", "type"]))}</dd></div>
        <div><dt>Responsable</dt><dd>{valueText(recordField(afterSales, ["assignedEmployeeId"]))}</dd></div>
      </dl>
      <div className="adminButtonRow">
        {caseId ? (
          <Link className="adminButton adminButtonTiny" href={`/admin/postventa?caseId=${encodeURIComponent(caseId)}`}>
            Atender caso
          </Link>
        ) : orderId ? (
          <Link className="adminButton adminButtonTiny" href={`/admin/postventa?orderId=${encodeURIComponent(orderId)}`}>
            Buscar casos del pedido
          </Link>
        ) : null}
      </div>
      {capabilities.canManageAfterSales && caseId ? (
        <form action={assignAfterSalesCaseAction} className="pricingDenseForm">
          <input name="caseId" type="hidden" value={caseId} />
          <input name="orderId" type="hidden" value={orderId ?? ""} />
          <label className="adminField">
            <span>Responsable</span>
            <input name="assignedEmployeeId" placeholder="employeeId" required />
          </label>
          <button className="adminButton" type="submit">Asignar caso</button>
        </form>
      ) : null}
    </>
  );
}

function OrderAuditTimelinePanel({ events }: { events: OrdersAdminAuditEvent[] }) {
  if (!events.length) {
    return <div className="adminEmptyState">Sin eventos administrativos para este pedido.</div>;
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
                <div className="adminMuted">{event.eventType} / {event.source}</div>
              </td>
              <td><span className={statusBadgeClass(event.status)}>{valueText(event.status)}</span></td>
              <td>{valueText(event.actor)}</td>
              <td>
                <strong>{valueText(event.referenceId)}</strong>
                <div className="adminMuted">{valueText(event.detail)}</div>
              </td>
              <td>{dateText(event.occurredAt ?? undefined)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderDrawerTabs({ current, filters }: { current: OrdersAdminDrawerTab; filters: OrdersAdminFilters }) {
  return (
    <nav className="adminTabs pricingTabs ordersDrawerTabs" aria-label="Secciones del pedido">
      {orderDrawerTabs.map((tab) => (
        <Link
          aria-current={tab.id === current ? "page" : undefined}
          className={`productEditorTab ${tab.id === current ? "productEditorTabActive" : ""}`}
          href={ordersHref(filters, { orderTab: tab.id })}
          key={tab.id}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function OrderDrawerSummary({ detail }: { detail: AdminOrderDetail }) {
  const operation = detail.operation;
  const paymentStatus = recordField(detail.payment, ["status", "transactionStatus", "paymentStatus"]) ?? detail.order?.paymentStatus;
  const shippingStatus = recordField(detail.shipping, ["status", "fulfillmentStatus"]) ?? detail.order?.fulfillmentStatus;
  const nextAction = operation?.primaryAction?.label ?? operationStatusLabel(operation?.status);
  const blockersCount = operation?.blockers?.length ?? 0;
  const warningsCount = detail.warnings.length;
  const healthLabel = blockersCount ? "Bloqueado" : warningsCount ? "Con avisos" : "Operable";
  const healthBadgeClass = blockersCount ? "adminBadge adminBadgeError" : warningsCount ? "adminBadge adminBadgeWarn" : "adminBadge adminBadgeOk";

  return (
    <section className="ordersFulfillmentSummary ordersDrawerSummary" aria-label="Resumen operativo del pedido">
      <div className="ordersFulfillmentSummaryHeader">
        <div>
          <span>Resumen operativo</span>
          <strong>{healthLabel}</strong>
        </div>
        <span className={healthBadgeClass}>{operationStatusLabel(operation?.status)}</span>
      </div>
      <dl className="ordersFulfillmentSummaryMeta">
        <div>
          <dt>Referencia</dt>
          <dd>{orderShortReference(detail.order?.orderId)}</dd>
        </div>
        <div>
          <dt>Siguiente accion</dt>
          <dd>{valueText(nextAction)}</dd>
        </div>
        <div>
          <dt>Pago</dt>
          <dd>{valueText(paymentStatus)}</dd>
        </div>
        <div>
          <dt>Envio</dt>
          <dd>{valueText(shippingStatus)}</dd>
        </div>
        <div>
          <dt>Bloqueos</dt>
          <dd>{blockersCount}</dd>
        </div>
        <div>
          <dt>Avisos</dt>
          <dd>{warningsCount}</dd>
        </div>
      </dl>
    </section>
  );
}

function OrderDetailPanel({ capabilities, data, filters }: Pick<Props, "capabilities" | "data" | "filters">) {
  if (!data.selectedOrder.ok) {
    return <ResultBanner result={data.selectedOrder} />;
  }
  if (!data.selectedOrder.data) {
    return <div className="adminEmptyState">Selecciona un pedido para ver pago, shipping, factura y postventa.</div>;
  }

  const detail = data.selectedOrder.data;
  const auditEvents = buildOrderAuditTimeline(detail);
  const currentTab = activeOrderDrawerTab(filters);

  return (
    <>
      <OrderDrawerSummary detail={detail} />
      <OrderDrawerTabs current={currentTab} filters={filters} />
      {currentTab === "operacion" ? (
        <>
          <OrderOperationWorkspace canManageShipping={capabilities.canManageShipping} detail={detail} />
          <section className="adminGrid">
            <DetailSection icon={<Boxes aria-hidden="true" size={18} />} title="Pedido">
              <OrderCoreDetail order={detail.order} />
            </DetailSection>
            <DetailSection icon={<Truck aria-hidden="true" size={18} />} title="Envio">
              <ShippingDetail detail={detail} />
            </DetailSection>
          </section>
        </>
      ) : null}
      {currentTab === "datos" ? (
        <section className="adminGrid">
          <DetailSection icon={<Boxes aria-hidden="true" size={18} />} title="Pedido">
            <OrderCoreDetail order={detail.order} />
          </DetailSection>
          <DetailSection icon={<CreditCard aria-hidden="true" size={18} />} title="Pago">
            <PaymentDetail capabilities={capabilities} detail={detail} />
          </DetailSection>
          <DetailSection icon={<Truck aria-hidden="true" size={18} />} title="Envio">
            <ShippingDetail detail={detail} />
          </DetailSection>
        </section>
      ) : null}
      {currentTab === "documentos" ? (
        <section className="adminGrid">
          <DetailSection icon={<FileText aria-hidden="true" size={18} />} title="Factura">
            <InvoiceDetail capabilities={capabilities} detail={detail} />
          </DetailSection>
        </section>
      ) : null}
      {currentTab === "soporte" ? (
        <section className="adminGrid">
          <DetailSection icon={<LifeBuoy aria-hidden="true" size={18} />} title="Postventa">
            <AfterSalesDetail capabilities={capabilities} detail={detail} />
          </DetailSection>
        </section>
      ) : null}
      {currentTab === "auditoria" ? (
        <section className="adminGrid">
          {detail.warnings.length ? (
            <DetailSection icon={<Search aria-hidden="true" size={18} />} title="Warnings">
              {detail.warnings.map((warning) => (
                <div className="adminBanner adminBannerWarning" key={warning.section}>
                  <p><strong>{warning.section}</strong>: {warning.message ?? "Seccion degradada"}</p>
                </div>
              ))}
            </DetailSection>
          ) : null}
          <DetailSection icon={<Search aria-hidden="true" size={18} />} title="Auditoria del pedido">
            <OrderAuditTimelinePanel events={auditEvents} />
          </DetailSection>
        </section>
      ) : null}
    </>
  );
}

function OrderDetailDrawer({
  capabilities,
  data,
  filters,
}: Pick<Props, "capabilities" | "data" | "filters">) {
  if (!filters.orderId) {
    return null;
  }

  const selectedOrder = data.selectedOrder.ok ? data.selectedOrder.data?.order : null;
  const title = `Operar pedido ${orderShortReference(selectedOrder?.orderId ?? filters.orderId)}`;
  const closeHref = ordersHref(filters, { orderId: undefined, orderTab: undefined });

  return (
    <div className="adminDrawerBackdrop ordersDrawerBackdrop">
      <Link className="ordersDrawerBackdropLink" href={closeHref} aria-label="Cerrar panel de pedido" />
      <aside className="adminSideDrawer ordersSideDrawer" aria-label={title} aria-modal="true" role="dialog">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>{title}</h2>
            <p>{valueText(selectedOrder?.customerId)} - {moneyText(selectedOrder?.totalAmountMinor, selectedOrder?.currency)}</p>
          </div>
          <Link className="adminIconButton" href={closeHref} title="Cerrar">
            <X aria-hidden="true" size={16} />
            <span className="adminVisuallyHidden">Cerrar</span>
          </Link>
        </div>
        <div className="ordersSideDrawerBody">
          <OrderDetailPanel capabilities={capabilities} data={data} filters={filters} />
        </div>
      </aside>
    </div>
  );
}

function InvoiceTemplatePanel({
  capabilities,
  preview,
}: {
  capabilities: OrdersAdminCapabilities;
  preview: { ok: boolean; data?: InvoiceTemplatePreview | null; error?: string };
}) {
  if (!capabilities.canManageInvoices) {
    return null;
  }

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Preview plantilla factura</h2>
          <p>Inspecciona la plantilla fiscal sin emitir documento ni consumir numeracion.</p>
        </div>
        <span className="adminBadge">invoices.manage</span>
      </div>
      {!preview.ok ? <div className="adminBanner adminBannerError">{preview.error}</div> : null}
      {preview.ok && preview.data ? (
        <div className="adminCodePreview">
          {preview.data.html ? preview.data.html.slice(0, 700) : JSON.stringify(preview.data.json ?? {}, null, 2).slice(0, 700)}
        </div>
      ) : null}
    </section>
  );
}

function AfterSalesQueue({
  capabilities,
  cases,
}: {
  capabilities: OrdersAdminCapabilities;
  cases: { ok: boolean; data?: { items: AfterSalesCase[]; total: number }; error?: string };
}) {
  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Bandeja postventa</h2>
          <p>Casos relacionados por pedido/cliente para saber quien atiende cada soporte.</p>
        </div>
        <span className="adminBadge">{cases.ok ? `${cases.data?.total ?? 0} casos` : "degradado"}</span>
      </div>
      {!cases.ok ? <div className="adminBanner adminBannerError">{cases.error}</div> : null}
      {cases.ok && cases.data?.items.length ? (
        <div className="adminTableScroller">
          <table className="adminTable adminTableCompact">
            <thead>
              <tr>
                <th>Caso</th>
                <th>Pedido</th>
                <th>Estado</th>
                <th>Responsable</th>
                {capabilities.canManageAfterSales ? <th>Asignar</th> : null}
              </tr>
            </thead>
            <tbody>
              {cases.data.items.map((caseItem) => (
                <tr key={caseItem.caseId}>
                  <td>
                    <Link className="adminButton adminButtonTiny" href={`/admin/postventa?caseId=${encodeURIComponent(caseItem.caseId)}`}>
                      {caseItem.caseId}
                    </Link>
                  </td>
                  <td>{valueText(caseItem.orderId)}</td>
                  <td><span className={statusBadgeClass(caseItem.status)}>{valueText(caseItem.status)}</span></td>
                  <td>{valueText(caseItem.assignedEmployeeId)}</td>
                  {capabilities.canManageAfterSales ? (
                    <td>
                      <form action={assignAfterSalesCaseAction} className="adminButtonRow">
                        <input name="caseId" type="hidden" value={caseItem.caseId} />
                        <input name="orderId" type="hidden" value={caseItem.orderId ?? ""} />
                        <input name="assignedEmployeeId" placeholder="employeeId" required />
                        <button className="adminButton adminButtonTiny" type="submit">Asignar</button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : cases.ok ? (
        <div className="adminEmptyState">No hay casos postventa para el filtro actual.</div>
      ) : null}
    </section>
  );
}

export function OrdersAdminPage({ capabilities, data, filters }: Props) {
  const total = data.orders.ok ? data.orders.data.total : 0;
  const selectedOrderId = filters.orderId;

  return (
    <main className="adminPage">
      <div className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / Pedidos</div>
          <h1 className="adminPageTitle">Pedidos</h1>
          <p className="adminPageIntro">Centro operativo para pedido, pago, shipping, facturas y postventa.</p>
        </div>
        <div className="adminButtonRow">
          <Link className="adminButton" href="/admin/clientes">Customer 360</Link>
        </div>
      </div>

      {filters.notice ? <div className={noticeBannerClass(filters.noticeKind)}>{filters.notice}</div> : null}

      <section className="adminKpiGrid">
        <article className="adminKpi">
          <span>Pedidos</span>
          <strong>{total}</strong>
          <div className="adminMuted">Filtro actual</div>
        </article>
        <article className="adminKpi">
          <span>Detalle</span>
          <strong>{selectedOrderId ?? "Sin seleccionar"}</strong>
          <div className="adminMuted">Pago + shipping + invoice + postventa</div>
        </article>
        <article className="adminKpi">
          <span>Invoice preview</span>
          <strong>{capabilities.canManageInvoices ? "Disponible" : "Sin permiso"}</strong>
          <div className="adminMuted">Plantilla documental</div>
        </article>
        <article className="adminKpi">
          <span>Postventa</span>
          <strong>{data.afterSalesCases.ok ? data.afterSalesCases.data.total : "-"}</strong>
          <div className="adminMuted">Casos asociados</div>
        </article>
      </section>

      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Buscar pedidos</h2>
            <p>Filtra por orderId o customerId y abre el detalle operativo.</p>
          </div>
        </div>
        <form action={applyOrdersFiltersAction} className="adminToolbar ordersSearchToolbar">
          <label className="adminField">
            <span>Order ID</span>
            <input name="orderId" defaultValue={filters.orderId ?? ""} />
          </label>
          <label className="adminField">
            <span>Customer ID</span>
            <input name="customerId" defaultValue={filters.customerId ?? ""} />
          </label>
          <label className="adminField">
            <span>Estado postventa</span>
            <input name="status" defaultValue={filters.status ?? ""} placeholder="OPEN" />
          </label>
          <label className="adminField">
            <span>Limite</span>
            <select name="limit" defaultValue={filters.limit ?? "25"}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">
            <Search aria-hidden="true" size={16} />
            Aplicar
          </button>
          <Link className="adminButton" href="/admin/pedidos">Limpiar</Link>
        </form>
        <OrdersTable capabilities={capabilities} data={data} filters={filters} />
      </section>

      <OrderDetailDrawer capabilities={capabilities} data={data} filters={filters} />
      <section className="adminGrid">
        <InvoiceTemplatePanel capabilities={capabilities} preview={data.invoicePreview} />
        <AfterSalesQueue capabilities={capabilities} cases={data.afterSalesCases} />
      </section>
    </main>
  );
}
