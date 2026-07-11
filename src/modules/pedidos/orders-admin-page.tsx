import Link from "next/link";
import { Boxes, CreditCard, FileText, LifeBuoy, Search, Truck } from "lucide-react";
import type { ReactNode } from "react";
import type {
  AdminOrderDetail,
  AdminOrderSummary,
  AfterSalesCase,
  InvoiceTemplatePreview,
  OrdersAdminAuditEvent,
  OrdersAdminCapabilities,
  OrdersAdminData,
  OrdersAdminFilters,
} from "./orders-admin";
import { buildOrderAuditTimeline } from "./orders-admin";
import {
  applyOrdersFiltersAction,
  assignAfterSalesCaseAction,
  createInvoiceAdjustmentAction,
  issueOrderInvoiceAction,
  requestOrderRefundAction,
} from "./orders-admin-actions";

type Props = {
  capabilities: OrdersAdminCapabilities;
  data: OrdersAdminData;
  filters: OrdersAdminFilters;
};

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

function statusBadgeClass(status: string | undefined) {
  const value = status?.toUpperCase();
  if (value === "PAID" || value === "SETTLED" || value === "ISSUED" || value === "DELIVERED" || value === "APPROVED") {
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
              <th>Fulfillment</th>
              <th>Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.items.map((order) => (
              <tr key={order.orderId}>
                <td>
                  <strong>{order.orderId}</strong>
                  <div className="adminMuted">{dateText(order.createdAt)}</div>
                </td>
                <td>{valueText(order.customerId)}</td>
                <td><span className={statusBadgeClass(order.status)}>{valueText(order.status)}</span></td>
                <td><span className={statusBadgeClass(order.paymentStatus)}>{valueText(order.paymentStatus)}</span></td>
                <td><span className={statusBadgeClass(order.fulfillmentStatus)}>{valueText(order.fulfillmentStatus)}</span></td>
                <td>{moneyText(order.totalAmountMinor, order.currency)}</td>
                <td>
                  <Link className="adminButton adminButtonTiny" href={ordersHref(filters, { orderId: order.orderId })}>
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
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
      <div><dt>Pedido</dt><dd>{valueText(order?.orderId)}</dd></div>
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

function ShippingDetail({ detail }: { detail: AdminOrderDetail }) {
  const shipping = detail.shipping;

  return (
    <dl className="adminDefinitionList">
      <div><dt>Estado</dt><dd>{valueText(recordField(shipping, ["status", "fulfillmentStatus"]))}</dd></div>
      <div><dt>Carrier</dt><dd>{valueText(recordField(shipping, ["carrierName", "carrier", "selectedCarrier"]))}</dd></div>
      <div><dt>Tracking</dt><dd>{valueText(recordField(shipping, ["trackingNumber", "trackingUrl"]))}</dd></div>
      <div><dt>Entrega</dt><dd>{valueText(recordField(shipping, ["estimatedDeliveryAt", "deliveredAt"]))}</dd></div>
    </dl>
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

function OrderDetailPanel({ capabilities, data }: Pick<Props, "capabilities" | "data">) {
  if (!data.selectedOrder.ok) {
    return <ResultBanner result={data.selectedOrder} />;
  }
  if (!data.selectedOrder.data) {
    return <div className="adminEmptyState">Selecciona un pedido para ver pago, shipping, factura y postventa.</div>;
  }

  const detail = data.selectedOrder.data;
  const auditEvents = buildOrderAuditTimeline(detail);

  return (
    <section className="adminGrid">
      <DetailSection icon={<Boxes aria-hidden="true" size={18} />} title="Pedido">
        <OrderCoreDetail order={detail.order} />
      </DetailSection>
      <DetailSection icon={<CreditCard aria-hidden="true" size={18} />} title="Pago">
        <PaymentDetail capabilities={capabilities} detail={detail} />
      </DetailSection>
      <DetailSection icon={<Truck aria-hidden="true" size={18} />} title="Shipping">
        <ShippingDetail detail={detail} />
      </DetailSection>
      <DetailSection icon={<FileText aria-hidden="true" size={18} />} title="Factura">
        <InvoiceDetail capabilities={capabilities} detail={detail} />
      </DetailSection>
      <DetailSection icon={<LifeBuoy aria-hidden="true" size={18} />} title="Postventa">
        <AfterSalesDetail capabilities={capabilities} detail={detail} />
      </DetailSection>
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

      {filters.notice ? <div className="adminBanner adminBannerInfo">{filters.notice}</div> : null}

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

      <OrderDetailPanel capabilities={capabilities} data={data} />
      <section className="adminGrid">
        <InvoiceTemplatePanel capabilities={capabilities} preview={data.invoicePreview} />
        <AfterSalesQueue capabilities={capabilities} cases={data.afterSalesCases} />
      </section>
    </main>
  );
}
