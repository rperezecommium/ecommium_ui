import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import { nextShippingFulfillmentStatuses, shippingFulfillmentStatuses } from "./shipping-admin";
import type {
  ShippingAdminData,
  ShippingAdminResult,
  ShippingAdminTab,
  ShippingFulfillment,
  ShippingFulfillmentStatus,
  ShippingRecord,
  ShippingScalar,
} from "./shipping-admin";
import {
  upsertShippingCarrierAction,
  upsertShippingCarrierServiceAction,
  upsertShippingRateRuleAction,
  upsertShippingZoneAction,
  setShippingResourceActiveAction,
  transitionShippingFulfillmentAction,
} from "./shipping-admin-actions";

type ShippingAdminPageProps = {
  context: AdminContext;
  data: ShippingAdminData;
  filters: {
    tab: ShippingAdminTab;
    includeInactive?: boolean;
    shippingMessage?: string;
    quoteRequested?: boolean;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
    variantId?: string;
    quantity?: string;
    priceMinor?: string;
    weightGrams?: string;
    widthMm?: string;
    heightMm?: string;
    depthMm?: string;
    itemsSubtotalMinor?: string;
    customerGroupId?: string;
    drawer?: "create" | "edit";
    recordId?: string;
    fulfillmentStatus?: string;
    fulfillmentsLimit?: number;
    fulfillmentsOffset?: number;
    fulfillmentId?: string;
  };
};

const tabs: Array<{ id: ShippingAdminTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "zones", label: "Zonas" },
  { id: "carriers", label: "Transportistas" },
  { id: "services", label: "Servicios" },
  { id: "rules", label: "Reglas de tarifa" },
  { id: "quote", label: "Simulador" },
  { id: "fulfillments", label: "Fulfillments" },
];

function tabHref(tab: ShippingAdminTab, filters: ShippingAdminPageProps["filters"]) {
  const params = new URLSearchParams({ tab });
  if (filters.includeInactive) {
    params.set("includeInactive", "true");
  }

  return `/admin/configuracion/transporte?${params.toString()}`;
}

function drawerHref(tab: ShippingAdminTab, filters: ShippingAdminPageProps["filters"], drawer: "create" | "edit", id?: string) {
  const params = new URLSearchParams({ tab, drawer });
  if (filters.includeInactive) {
    params.set("includeInactive", "true");
  }
  if (id) {
    params.set("recordId", id);
  }

  return `/admin/configuracion/transporte?${params.toString()}`;
}

function fulfillmentHref(
  filters: ShippingAdminPageProps["filters"],
  overrides: Partial<Pick<ShippingAdminPageProps["filters"], "fulfillmentStatus" | "fulfillmentsLimit" | "fulfillmentsOffset" | "fulfillmentId">>,
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams({ tab: "fulfillments" });

  if (next.fulfillmentStatus) {
    params.set("fulfillmentStatus", next.fulfillmentStatus);
  }
  if (typeof next.fulfillmentsLimit === "number") {
    params.set("fulfillmentsLimit", String(next.fulfillmentsLimit));
  }
  if (typeof next.fulfillmentsOffset === "number") {
    params.set("fulfillmentsOffset", String(next.fulfillmentsOffset));
  }
  if (next.fulfillmentId) {
    params.set("fulfillmentId", next.fulfillmentId);
  }

  return `/admin/configuracion/transporte?${params.toString()}`;
}

function valueText(value: ShippingScalar) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "-";
  }
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }
  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }

  return String(value);
}

function stringValue(record: ShippingRecord, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.join(", ") : valueText(value) === "-" ? "" : String(value);
}

function boolValue(record: ShippingRecord, key: string, fallback = true) {
  return typeof record[key] === "boolean" ? String(record[key]) : String(fallback);
}

function DrawerField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="adminField">
      <span>{label}</span>
      {children}
    </label>
  );
}

function recordId(record: ShippingRecord, index: number) {
  return String(
    record.zoneId ??
      record.carrierId ??
      record.carrierServiceId ??
      record.shippingRateRuleId ??
      record.id ??
      index,
  );
}

function recordActive(record: ShippingRecord) {
  return record.active !== false;
}

function ResourceActions({
  tab,
  resource,
  record,
  index,
  filters,
}: {
  tab: ShippingAdminTab;
  resource: "zones" | "carriers" | "carrier-services" | "rate-rules";
  record: ShippingRecord;
  index: number;
  filters: ShippingAdminPageProps["filters"];
}) {
  const id = recordId(record, index);
  const active = recordActive(record);

  return (
    <div className="adminButtonRow">
      <Link className="adminButton adminButtonTiny" href={drawerHref(tab, filters, "edit", id)}>Editar</Link>
      <form action={setShippingResourceActiveAction}>
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="resource" value={resource} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
        <input type="hidden" name="includeInactive" value={filters.includeInactive ? "true" : "false"} />
        <button className={`adminButton adminButtonTiny ${active ? "adminButtonDanger" : ""}`} type="submit">
          {active ? "Desactivar" : "Reactivar"}
        </button>
      </form>
    </div>
  );
}

function ResultBanner<T>({ result }: { result: ShippingAdminResult<T> }) {
  if (result.source === "bff") {
    return null;
  }

  return (
    <div className="adminBanner adminBannerError">
      <p>{result.message}</p>
      {result.failedEndpoint ? <p className="adminContextHint">{result.failedEndpoint}</p> : null}
    </div>
  );
}

function fulfillmentStatusBadge(status: string) {
  if (status === "SHIPPED" || status === "DELIVERED") {
    return "adminBadge adminBadgeOk";
  }
  if (status === "FAILED" || status === "UNKNOWN") {
    return "adminBadge adminBadgeError";
  }
  return "adminBadge adminBadgeWarn";
}

function fulfillmentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_FULFILLMENT: "Pendiente de preparar",
    READY_TO_PICK: "Listo para recoger",
    PICKING: "En preparación",
    PACKED: "Empaquetado",
    SHIPPED: "Enviado",
    DELIVERED: "Entregado",
    FAILED: "Fallido",
    UNKNOWN: "Estado no reconocido",
  };

  return labels[status] ?? status;
}

function dateTimeText(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function fulfillmentCarrierText(fulfillment: ShippingFulfillment) {
  return fulfillment.carrier?.label ?? fulfillment.carrierId ?? "-";
}

function fulfillmentOrderText(fulfillment: ShippingFulfillment) {
  return fulfillment.orderReference ?? fulfillment.orderId ?? "-";
}

const fulfillmentPageSizeOptions = [25, 50, 100] as const;

function FulfillmentFilters({ filters }: { filters: ShippingAdminPageProps["filters"] }) {
  const clearHref = fulfillmentHref(filters, {
    fulfillmentStatus: undefined,
    fulfillmentsOffset: 0,
    fulfillmentId: undefined,
  });

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Filtrar fulfillments</h2>
          <p>El BFF permite filtrar por un estado logístico exacto dentro de la tienda activa.</p>
        </div>
        <Link className="adminButton adminButtonTiny" href={clearHref}>Limpiar</Link>
      </div>
      <form className="pricingDenseForm" method="get">
        <input name="tab" type="hidden" value="fulfillments" />
        <input name="fulfillmentsLimit" type="hidden" value={filters.fulfillmentsLimit ?? 25} />
        <input name="fulfillmentsOffset" type="hidden" value="0" />
        <DrawerField label="Estado">
          <select name="fulfillmentStatus" defaultValue={filters.fulfillmentStatus ?? ""}>
            <option value="">Todos los estados</option>
            {shippingFulfillmentStatuses.map((status: ShippingFulfillmentStatus) => (
              <option key={status} value={status}>{fulfillmentStatusLabel(status)}</option>
            ))}
          </select>
        </DrawerField>
        <button className="adminButton adminButtonPrimary" type="submit">Aplicar filtro</button>
      </form>
    </section>
  );
}

function FulfillmentPagination({
  count,
  filters,
  limit,
  offset,
  total,
}: {
  count: number;
  filters: ShippingAdminPageProps["filters"];
  limit: number;
  offset: number;
  total: number;
}) {
  const currentLimit = Number.isInteger(limit) && limit > 0 ? limit : count || 25;
  const currentOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  const firstItem = total > 0 ? currentOffset + 1 : 0;
  const lastItem = Math.min(currentOffset + count, total);
  const hasPrevious = currentOffset > 0;
  const nextOffset = currentOffset + currentLimit;
  const hasNext = nextOffset < total;
  const pageHref = (nextLimit: number, nextOffsetValue: number) => fulfillmentHref(filters, {
    fulfillmentId: undefined,
    fulfillmentsLimit: nextLimit,
    fulfillmentsOffset: nextOffsetValue,
  });

  return (
    <nav className="productListPagination" aria-label="Paginacion de fulfillments">
      <p>Mostrando {firstItem}-{lastItem} de {total} envíos</p>
      <div className="productListPaginationControls">
        <Link aria-disabled={!hasPrevious} className={`adminButton adminButtonTiny${hasPrevious ? "" : " adminButtonDisabled"}`} href={pageHref(currentLimit, hasPrevious ? Math.max(0, currentOffset - currentLimit) : currentOffset)}>Anterior</Link>
        <Link aria-disabled={!hasNext} className={`adminButton adminButtonTiny${hasNext ? "" : " adminButtonDisabled"}`} href={pageHref(currentLimit, hasNext ? nextOffset : currentOffset)}>Siguiente</Link>
      </div>
      <div className="productListPaginationControls" aria-label="Tamano de pagina de fulfillments">
        {fulfillmentPageSizeOptions.map((pageSize) => (
          <Link className={`adminButton adminButtonTiny${currentLimit === pageSize ? " adminButtonDisabled" : ""}`} href={pageHref(pageSize, 0)} key={pageSize}>{pageSize} por página</Link>
        ))}
      </div>
    </nav>
  );
}

function orderHref(orderId: string) {
  const params = new URLSearchParams({ orderId, orderTab: "operacion" });
  return `/admin/pedidos?${params.toString()}`;
}

function FulfillmentsQueue({ data, filters }: Pick<ShippingAdminPageProps, "data" | "filters">) {
  const fulfillments = data.fulfillments;

  if (!fulfillments) {
    return null;
  }

  return (
    <>
      <FulfillmentFilters filters={filters} />
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Cola global de fulfillments</h2>
            <p>{fulfillments.data.total} envíos registrados para la tienda activa.</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={fulfillmentHref(filters, { fulfillmentStatus: "FAILED", fulfillmentsOffset: 0, fulfillmentId: undefined })}>Ver fallidos</Link>
        </div>
        <ResultBanner result={fulfillments} />
        {fulfillments.data.items.length ? (
          <div className="adminTableScroller">
            <table className="adminTable pricingTable shippingTable">
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Transportista</th>
                  <th scope="col">Tracking</th>
                  <th scope="col">Almacén / muelle</th>
                  <th scope="col">Artículos</th>
                  <th scope="col">Actualizado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {fulfillments.data.items.map((fulfillment) => {
                  const totalQuantity = fulfillment.items.reduce((total, item) => total + item.quantity, 0);

                  return (
                    <tr key={fulfillment.fulfillmentId}>
                      <td>
                        <strong>{fulfillmentOrderText(fulfillment)}</strong>
                        <div className="adminMuted">{fulfillment.orderId}</div>
                      </td>
                      <td><span className={fulfillmentStatusBadge(fulfillment.status)}>{fulfillmentStatusLabel(fulfillment.status)}</span></td>
                      <td>
                        <strong>{fulfillmentCarrierText(fulfillment)}</strong>
                        <div className="adminMuted">{fulfillment.carrierId || "Sin transportista"}</div>
                      </td>
                      <td>{fulfillment.trackingNumber ?? "Sin tracking"}</td>
                      <td>{fulfillment.warehouseId || "-"}<div className="adminMuted">{fulfillment.dockId || "-"}</div></td>
                      <td>{fulfillment.items.length} líneas<div className="adminMuted">{totalQuantity} unidades</div></td>
                      <td>{dateTimeText(fulfillment.updatedAt)}<div className="adminMuted">Creado {dateTimeText(fulfillment.createdAt)}</div></td>
                      <td>
                        <div className="adminButtonRow">
                          <Link className="adminButton adminButtonTiny" href={fulfillmentHref(filters, { fulfillmentId: fulfillment.fulfillmentId })}>Ver envío</Link>
                          <Link className="adminButton adminButtonTiny" href={orderHref(fulfillment.orderId)}>Abrir pedido</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="adminEmptyState">No hay envíos para el filtro seleccionado.</div>
        )}
        <FulfillmentPagination
          count={fulfillments.data.items.length}
          filters={filters}
          limit={fulfillments.data.limit}
          offset={fulfillments.data.offset}
          total={fulfillments.data.total}
        />
      </section>
    </>
  );
}

function RecordTable({
  title,
  result,
  rows,
  columns,
  empty,
  actions,
  headerAction,
}: {
  title: string;
  result: ShippingAdminResult<unknown>;
  rows: ShippingRecord[];
  columns: string[];
  empty: string;
  actions?: (record: ShippingRecord, index: number) => ReactNode;
  headerAction?: ReactNode;
}) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>{title}</h2>
          <p>{rows.length} registros</p>
        </div>
        {headerAction}
      </div>
      <ResultBanner result={result} />
      {rows.length === 0 ? (
        <p className="adminContextHint">{empty}</p>
      ) : (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable shippingTable">
            <thead>
              <tr>
                {columns.map((column) => <th scope="col" key={column}>{column}</th>)}
                {actions ? <th scope="col">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((record, index) => (
                <tr key={recordId(record, index)}>
                  {columns.map((column) => <td key={column}>{valueText(record[column])}</td>)}
                  {actions ? <td>{actions(record, index)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function findRecord(rows: ShippingRecord[], id?: string) {
  if (!id) {
    return undefined;
  }

  return rows.find((record, index) => recordId(record, index) === id);
}

function ShippingDrawer({
  title,
  description,
  closeHref,
  children,
}: {
  title: string;
  description: string;
  closeHref: string;
  children: ReactNode;
}) {
  return (
    <div className="adminDrawerBackdrop">
      <aside className="adminSideDrawer" aria-label={title}>
        <div className="adminSideDrawerHeader">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
        </div>
        {children}
      </aside>
    </div>
  );
}

function safeTrackingUrl(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function deliveryAddressLines(fulfillment: ShippingFulfillment) {
  const address = fulfillment.deliveryAddress;
  if (!address) {
    return [];
  }

  return [
    address.receiverName,
    [address.street, address.number].filter(Boolean).join(" "),
    address.complement,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    [address.state, address.country].filter(Boolean).join(", "),
    address.reference ? `Referencia: ${address.reference}` : null,
  ].filter((line): line is string => Boolean(line));
}

function FulfillmentDetailDrawer({ data, filters }: Pick<ShippingAdminPageProps, "data" | "filters">) {
  if (filters.tab !== "fulfillments" || !filters.fulfillmentId) {
    return null;
  }

  const closeHref = fulfillmentHref(filters, { fulfillmentId: undefined });
  const result = data.selectedFulfillment;

  return (
    <ShippingDrawer
      closeHref={closeHref}
      description="Inspección logística interna del envío seleccionado. No modifica su estado."
      title="Detalle de fulfillment"
    >
      {!result ? <div className="adminBanner adminBannerError"><p>No se pudo preparar el detalle del envío.</p></div> : null}
      {result?.source === "unavailable" ? <ResultBanner result={result} /> : null}
      {result?.source === "bff" && !result.data ? <div className="adminBanner adminBannerError"><p>No se encontró el envío seleccionado.</p></div> : null}
      {result?.source === "bff" && result.data ? <FulfillmentDetail fulfillment={result.data} filters={filters} /> : null}
    </ShippingDrawer>
  );
}

function FulfillmentDetail({
  fulfillment,
  filters,
}: {
  fulfillment: ShippingFulfillment;
  filters: ShippingAdminPageProps["filters"];
}) {
  const trackingUrl = safeTrackingUrl(fulfillment.trackingUrl);
  const addressLines = deliveryAddressLines(fulfillment);
  const timeline = [
    { label: "Creado", occurredAt: fulfillment.createdAt },
    ...(fulfillment.shippedAt ? [{ label: "Enviado", occurredAt: fulfillment.shippedAt }] : []),
    ...(fulfillment.deliveredAt ? [{ label: "Entregado", occurredAt: fulfillment.deliveredAt }] : []),
    ...(fulfillment.updatedAt !== fulfillment.createdAt ? [{ label: "Última actualización", occurredAt: fulfillment.updatedAt }] : []),
  ];

  return (
    <div className="pricingDenseForm">
      <section className="adminSection">
        <div className="adminCardHeader">
          <div>
            <h3>{fulfillmentOrderText(fulfillment)}</h3>
            <p>{fulfillment.fulfillmentId}</p>
          </div>
          <span className={fulfillmentStatusBadge(fulfillment.status)}>{fulfillmentStatusLabel(fulfillment.status)}</span>
        </div>
        <dl className="adminDefinitionList">
          <div><dt>Pedido</dt><dd><Link href={orderHref(fulfillment.orderId)}>{fulfillment.orderId}</Link></dd></div>
          <div><dt>Versión</dt><dd>{fulfillment.version}</dd></div>
          <div><dt>Almacén</dt><dd>{fulfillment.warehouseId || "-"}</dd></div>
          <div><dt>Muelle</dt><dd>{fulfillment.dockId || "-"}</dd></div>
        </dl>
      </section>

      <section className="adminSection">
        <h3>Transporte y tracking</h3>
        <dl className="adminDefinitionList">
          <div><dt>Transportista</dt><dd>{fulfillmentCarrierText(fulfillment)}</dd></div>
          <div><dt>Tracking</dt><dd>{fulfillment.trackingNumber ?? "Sin tracking"}</dd></div>
          <div><dt>Seguimiento externo</dt><dd>{trackingUrl ? <a href={trackingUrl} rel="noreferrer" target="_blank">Abrir seguimiento</a> : "No disponible"}</dd></div>
        </dl>
      </section>

      <section className="adminSection">
        <h3>Entrega</h3>
        {addressLines.length ? <address className="adminMuted">{addressLines.map((line) => <div key={line}>{line}</div>)}</address> : <p className="adminMuted">Shipping no devolvió una dirección de entrega para este envío.</p>}
      </section>

      <section className="adminSection">
        <h3>Artículos</h3>
        {fulfillment.items.length ? (
          <div className="adminTableScroller">
            <table className="adminTable adminTableCompact">
              <thead><tr><th>Artículo</th><th>Variante</th><th>Cantidad</th></tr></thead>
              <tbody>
                {fulfillment.items.map((item, index) => (
                  <tr key={item.lineId ?? `${item.variantId}-${index}`}>
                    <td>{item.name ?? item.productId ?? "Sin nombre"}</td>
                    <td>{item.variantId || "-"}</td>
                    <td>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="adminMuted">Shipping no devolvió artículos para este envío.</p>}
      </section>

      <section className="adminSection">
        <h3>Timeline</h3>
        <div className="adminStatusList">
          {timeline.map((event) => <div className="adminStatusRow" key={`${event.label}-${event.occurredAt}`}><strong>{event.label}</strong><span>{dateTimeText(event.occurredAt)}</span></div>)}
        </div>
      </section>

      <FulfillmentTransitionActions fulfillment={fulfillment} filters={filters} />
    </div>
  );
}

function FulfillmentTransitionFields({
  fulfillment,
  filters,
  target,
}: {
  fulfillment: ShippingFulfillment;
  filters: ShippingAdminPageProps["filters"];
  target: ShippingFulfillmentStatus;
}) {
  return (
    <>
      <input name="fulfillmentId" type="hidden" value={fulfillment.fulfillmentId} />
      <input name="status" type="hidden" value={target} />
      <input name="fulfillmentStatus" type="hidden" value={filters.fulfillmentStatus ?? ""} />
      <input name="fulfillmentsLimit" type="hidden" value={filters.fulfillmentsLimit ?? 25} />
      <input name="fulfillmentsOffset" type="hidden" value={filters.fulfillmentsOffset ?? 0} />
    </>
  );
}

function FulfillmentTransitionActions({
  fulfillment,
  filters,
}: {
  fulfillment: ShippingFulfillment;
  filters: ShippingAdminPageProps["filters"];
}) {
  const targets = nextShippingFulfillmentStatuses(fulfillment.status);

  if (!targets.length) {
    return (
      <section className="adminSection">
        <h3>Actualizar estado</h3>
        <p className="adminMuted">Este fulfillment está en un estado terminal y no admite más transiciones.</p>
      </section>
    );
  }

  return (
    <section className="adminSection">
      <h3>Actualizar estado</h3>
      <p className="adminMuted">Solo se muestran las transiciones admitidas por Shipping para el estado actual.</p>
      <div className="adminButtonRow">
        {targets.map((target) => {
          if (target === "FAILED") {
            return (
              <details className="productDangerMenu" key={target}>
                <summary className="adminButton adminButtonDanger adminButtonTiny">Marcar fallido</summary>
                <div className="productDangerPanel">
                  <p>Esta acción deja el fulfillment en estado terminal. Confirma únicamente si el envío no puede continuar.</p>
                  <form action={transitionShippingFulfillmentAction}>
                    <FulfillmentTransitionFields fulfillment={fulfillment} filters={filters} target={target} />
                    <button className="adminButton adminButtonDanger adminButtonTiny" type="submit">Confirmar envío fallido</button>
                  </form>
                </div>
              </details>
            );
          }

          if (target === "SHIPPED") {
            return (
              <form action={transitionShippingFulfillmentAction} className="pricingDenseForm" key={target}>
                <FulfillmentTransitionFields fulfillment={fulfillment} filters={filters} target={target} />
                <DrawerField label="Número de tracking">
                  <input name="trackingNumber" required placeholder="TRACK-001" />
                </DrawerField>
                <DrawerField label="Transportista (opcional)">
                  <input name="carrierId" defaultValue={fulfillment.carrierId} placeholder="carrier-standard" />
                </DrawerField>
                <button className="adminButton adminButtonPrimary adminButtonTiny" type="submit">Marcar como enviado</button>
              </form>
            );
          }

          return (
            <form action={transitionShippingFulfillmentAction} key={target}>
              <FulfillmentTransitionFields fulfillment={fulfillment} filters={filters} target={target} />
              <button className="adminButton adminButtonPrimary adminButtonTiny" type="submit">Marcar como {fulfillmentStatusLabel(target).toLowerCase()}</button>
            </form>
          );
        })}
      </div>
    </section>
  );
}

function ShippingResourceDrawer({
  context,
  filters,
  configuration,
}: {
  context: AdminContext;
  filters: ShippingAdminPageProps["filters"];
  configuration: ShippingAdminData["configuration"]["data"];
}) {
  const drawer = filters.drawer;
  const activeTab = filters.tab;

  if (!drawer || activeTab === "summary" || activeTab === "quote") {
    return null;
  }

  const closeHref = tabHref(activeTab, filters);
  const isEditing = drawer === "edit";

  if (activeTab === "zones") {
    const record = isEditing ? findRecord(configuration.zones, filters.recordId) : undefined;
    return (
      <ShippingDrawer
        closeHref={closeHref}
        description="Define paises, provincias y prefijos postales usados por las reglas de tarifa."
        title={isEditing ? "Editar zona" : "Crear zona"}
      >
        {isEditing && !record ? <div className="adminBanner adminBannerError"><p>No se encontro la zona seleccionada.</p></div> : <ZoneForm record={record} />}
      </ShippingDrawer>
    );
  }

  if (activeTab === "carriers") {
    const record = isEditing ? findRecord(configuration.carriers, filters.recordId) : undefined;
    return (
      <ShippingDrawer
        closeHref={closeHref}
        description="Gestiona transportistas y plantillas de tracking visibles para Shipping/Logistics."
        title={isEditing ? "Editar transportista" : "Crear transportista"}
      >
        {isEditing && !record ? <div className="adminBanner adminBannerError"><p>No se encontro el transportista seleccionado.</p></div> : <CarrierForm record={record} />}
      </ShippingDrawer>
    );
  }

  if (activeTab === "services") {
    const record = isEditing ? findRecord(configuration.carrierServices, filters.recordId) : undefined;
    return (
      <ShippingDrawer
        closeHref={closeHref}
        description="Configura servicios, canales, limites logisticos y base de calculo."
        title={isEditing ? "Editar servicio" : "Crear servicio"}
      >
        {isEditing && !record ? (
          <div className="adminBanner adminBannerError"><p>No se encontro el servicio seleccionado.</p></div>
        ) : (
          <ServiceForm record={record} carriers={configuration.carriers} />
        )}
      </ShippingDrawer>
    );
  }

  if (activeTab === "rules") {
    const record = isEditing ? findRecord(configuration.rateRules, filters.recordId) : undefined;
    return (
      <ShippingDrawer
        closeHref={closeHref}
        description="Relaciona zona y servicio con rangos, precio, impuestos y comportamiento fuera de rango."
        title={isEditing ? "Editar regla tarifaria" : "Crear regla tarifaria"}
      >
        {isEditing && !record ? (
          <div className="adminBanner adminBannerError"><p>No se encontro la regla seleccionada.</p></div>
        ) : (
          <RateRuleForm record={record} zones={configuration.zones} services={configuration.carrierServices} currency={context.currency} />
        )}
      </ShippingDrawer>
    );
  }

  return null;
}

function ShippingFilters({ filters }: { filters: ShippingAdminPageProps["filters"] }) {
  if (filters.tab === "quote" || filters.tab === "fulfillments") {
    return null;
  }

  return (
    <form className="pricingFilterBar" action="/admin/configuracion/transporte">
      <input type="hidden" name="tab" value={filters.tab} />
      <label className="productListFilterCheckbox">
        <input name="includeInactive" type="checkbox" value="true" defaultChecked={Boolean(filters.includeInactive)} />
        Incluir inactivos
      </label>
      <button className="adminButton adminButtonPrimary" type="submit">Aplicar</button>
    </form>
  );
}

function QuoteSimulatorForm({
  filters,
  context,
}: {
  filters: ShippingAdminPageProps["filters"];
  context: AdminContext;
}) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Simular cotizacion</h2>
        <p>POST /shipping/options/resolve</p>
      </div>
      <form className="pricingDenseForm" action="/admin/configuracion/transporte">
        <input type="hidden" name="tab" value="quote" />
        <input type="hidden" name="quote" value="1" />
        <DrawerField label="Codigo postal">
          <input name="postalCode" defaultValue={filters.postalCode ?? "28001"} placeholder="28001" title="Codigo postal de destino" />
        </DrawerField>
        <DrawerField label="Ciudad">
          <input name="city" defaultValue={filters.city ?? "Madrid"} placeholder="Madrid" title="Ciudad de destino" />
        </DrawerField>
        <DrawerField label="Estado/provincia">
          <input name="state" defaultValue={filters.state ?? context.country} placeholder="ES" title="Estado o provincia de destino" />
        </DrawerField>
        <DrawerField label="Pais">
          <input name="country" defaultValue={filters.country ?? context.country} placeholder="ES" title="Pais de destino" />
        </DrawerField>
        <DrawerField label="Variant ID">
          <input name="variantId" defaultValue={filters.variantId ?? "simulated-variant"} placeholder="simulated-variant" title="Variant ID usado para simular el item" />
        </DrawerField>
        <DrawerField label="Cantidad">
          <input name="quantity" defaultValue={filters.quantity ?? "1"} type="number" min={1} placeholder="1" title="Cantidad del item" />
        </DrawerField>
        <DrawerField label="Precio item minor">
          <input name="priceMinor" defaultValue={filters.priceMinor ?? "4000"} type="number" min={0} placeholder="4000" title="Precio unitario en minor units" />
        </DrawerField>
        <DrawerField label="Subtotal minor">
          <input name="itemsSubtotalMinor" defaultValue={filters.itemsSubtotalMinor ?? ""} type="number" min={0} placeholder="Calculado si se deja vacio" title="Subtotal del carrito en minor units" />
        </DrawerField>
        <DrawerField label="Peso g">
          <input name="weightGrams" defaultValue={filters.weightGrams ?? "1500"} type="number" min={0} placeholder="1500" title="Peso del item en gramos" />
        </DrawerField>
        <DrawerField label="Ancho mm">
          <input name="widthMm" defaultValue={filters.widthMm ?? ""} type="number" min={0} placeholder="10" title="Ancho del paquete en milimetros" />
        </DrawerField>
        <DrawerField label="Alto mm">
          <input name="heightMm" defaultValue={filters.heightMm ?? ""} type="number" min={0} placeholder="20" title="Alto del paquete en milimetros" />
        </DrawerField>
        <DrawerField label="Profundidad mm">
          <input name="depthMm" defaultValue={filters.depthMm ?? ""} type="number" min={0} placeholder="10" title="Profundidad del paquete en milimetros" />
        </DrawerField>
        <DrawerField label="Customer group">
          <input name="customerGroupId" defaultValue={filters.customerGroupId ?? ""} placeholder="b2c" title="Grupo de cliente usado por reglas de Shipping" />
        </DrawerField>
        <button className="adminButton adminButtonPrimary" type="submit">Calcular opciones</button>
      </form>
    </section>
  );
}

function QuoteResult({ data }: { data: ShippingAdminData }) {
  const quote = data.quote;

  if (!quote) {
    return (
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <h2>Resultado</h2>
        </div>
        <p className="adminContextHint">Completa el formulario y calcula para ver SLAs aplicables.</p>
      </section>
    );
  }

  if (quote.source === "unavailable") {
    return (
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <h2>Resultado</h2>
        </div>
        <ResultBanner result={quote} />
      </section>
    );
  }

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Resultado</h2>
        <p>{quote.data.calculatedAt ?? "calculado"}</p>
      </div>
      <div className="pricingEditorContext">
        <span><strong>Destino:</strong> {valueText(quote.data.selectedAddress.postalCode)} / {valueText(quote.data.selectedAddress.country)}</span>
        <span><strong>Moneda:</strong> {quote.data.currency}</span>
        <span><strong>Items:</strong> {quote.data.logisticsInfo.length}</span>
      </div>
      {quote.data.logisticsInfo.flatMap((info) => info.slas.map((sla) => ({ info, sla }))).length === 0 ? (
        <p className="adminContextHint">Shipping no devolvio opciones para el contexto simulado.</p>
      ) : (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">SLA</th>
                <th scope="col">Carrier</th>
                <th scope="col">Servicio</th>
                <th scope="col">Canal</th>
                <th scope="col">Estimacion</th>
                <th scope="col">Precio</th>
                <th scope="col">Tax</th>
                <th scope="col">Total</th>
                <th scope="col">Warehouse</th>
              </tr>
            </thead>
            <tbody>
              {quote.data.logisticsInfo.flatMap((info) =>
                info.slas.map((sla, index) => (
                  <tr key={`${info.itemIndex}-${String(sla.id ?? index)}`}>
                    <td>{info.itemId || info.itemIndex}</td>
                    <td>{valueText(sla.name ?? sla.id)}</td>
                    <td>{valueText(sla.carrierId)}</td>
                    <td>{valueText(sla.carrierServiceId)}</td>
                    <td>{valueText(sla.deliveryChannel)}</td>
                    <td>{valueText(sla.shippingEstimate ?? sla.transitTime)}</td>
                    <td>{valueText(sla.priceMinor)}</td>
                    <td>{valueText(sla.taxMinor)}</td>
                    <td>{valueText(sla.totalMinor)}</td>
                    <td>{valueText(sla.warehouseId)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ZoneForm({ record }: { record?: ShippingRecord }) {
  return (
    <form action={upsertShippingZoneAction} className="pricingDenseForm">
      <DrawerField label="ID de zona">
        <input name="zoneId" defaultValue={stringValue(record ?? {}, "zoneId")} placeholder="es-peninsula" />
      </DrawerField>
      <DrawerField label="Nombre">
        <input name="name" defaultValue={stringValue(record ?? {}, "name")} placeholder="Espana peninsular" />
      </DrawerField>
      <DrawerField label="Paises">
        <input name="countries" defaultValue={stringValue(record ?? {}, "countries")} placeholder="ES, FR" />
      </DrawerField>
      <DrawerField label="Estados o provincias">
        <input name="states" defaultValue={stringValue(record ?? {}, "states")} placeholder="Madrid, Murcia" />
      </DrawerField>
      <DrawerField label="Prefijos postales">
        <input name="postalCodePrefixes" defaultValue={stringValue(record ?? {}, "postalCodePrefixes")} placeholder="28, 30" />
      </DrawerField>
      <DrawerField label="Estado">
        <select name="active" defaultValue={boolValue(record ?? {}, "active")}>
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </select>
      </DrawerField>
      <button className="adminButton adminButtonPrimary" type="submit">Guardar zona</button>
    </form>
  );
}

function CarrierForm({ record }: { record?: ShippingRecord }) {
  return (
    <form action={upsertShippingCarrierAction} className="pricingDenseForm">
      <DrawerField label="ID de transportista">
        <input name="carrierId" defaultValue={stringValue(record ?? {}, "carrierId")} placeholder="carrier-standard" />
      </DrawerField>
      <DrawerField label="Nombre">
        <input name="name" defaultValue={stringValue(record ?? {}, "name")} placeholder="Transportista estandar" />
      </DrawerField>
      <DrawerField label="Plantilla de tracking">
        <input name="trackingUrlTemplate" defaultValue={stringValue(record ?? {}, "trackingUrlTemplate")} placeholder="https://tracking.example/{trackingNumber}" />
      </DrawerField>
      <DrawerField label="Logo">
        <input name="logoUrl" defaultValue={stringValue(record ?? {}, "logoUrl")} placeholder="https://..." />
      </DrawerField>
      <DrawerField label="Estado">
        <select name="active" defaultValue={boolValue(record ?? {}, "active")}>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </DrawerField>
      <button className="adminButton adminButtonPrimary" type="submit">Guardar transportista</button>
    </form>
  );
}

function ServiceForm({
  record,
  carriers,
}: {
  record?: ShippingRecord;
  carriers: ShippingRecord[];
}) {
  const carrierId = stringValue(record ?? {}, "carrierId");

  return (
    <form action={upsertShippingCarrierServiceAction} className="pricingDenseForm">
      <DrawerField label="ID de servicio">
        <input name="carrierServiceId" defaultValue={stringValue(record ?? {}, "carrierServiceId")} placeholder="standard-weight" />
      </DrawerField>
      <DrawerField label="Transportista">
        <select name="carrierId" defaultValue={carrierId}>
          <option value="">Transportista</option>
          {carriers.map((carrier, index) => {
            const id = String(carrier.carrierId ?? "");
            return id ? <option value={id} key={id}>{String(carrier.name ?? id)}</option> : <option disabled key={`carrier-${index}`}>Sin carrierId</option>;
          })}
        </select>
      </DrawerField>
      <DrawerField label="Nombre">
        <input name="name" defaultValue={stringValue(record ?? {}, "name")} placeholder="Entrega estandar" />
      </DrawerField>
      <DrawerField label="Canal">
        <select name="deliveryChannel" defaultValue={stringValue(record ?? {}, "deliveryChannel") || "delivery"}>
          <option value="delivery">delivery</option>
          <option value="pickup-in-point">pickup-in-point</option>
        </select>
      </DrawerField>
      <DrawerField label="Base de tarifa">
        <select name="ratingBasis" defaultValue={stringValue(record ?? {}, "ratingBasis") || "WEIGHT"}>
          <option value="WEIGHT">WEIGHT</option>
          <option value="PRICE">PRICE</option>
        </select>
      </DrawerField>
      <DrawerField label="Tiempo de transito">
        <input name="transitTimeLabel" defaultValue={stringValue(record ?? {}, "transitTimeLabel") || "3-5bd"} placeholder="3-5bd" />
      </DrawerField>
      <DrawerField label="Dias estimados">
        <input name="estimateBusinessDays" defaultValue={stringValue(record ?? {}, "estimateBusinessDays") || "3"} type="number" min={0} placeholder="3" />
      </DrawerField>
      <DrawerField label="Manipulacion (handlingFeeMinor)">
        <input name="handlingFeeMinor" defaultValue={stringValue(record ?? {}, "handlingFeeMinor") || "0"} type="number" min={0} placeholder="0" />
      </DrawerField>
      <DrawerField label="Peso maximo">
        <input name="maxWeightGrams" defaultValue={stringValue(record ?? {}, "maxWeightGrams")} type="number" min={0} placeholder="30000" />
      </DrawerField>
      <DrawerField label="Ancho maximo">
        <input name="maxWidthMm" defaultValue={stringValue(record ?? {}, "maxWidthMm")} type="number" min={0} placeholder="600" />
      </DrawerField>
      <DrawerField label="Alto maximo">
        <input name="maxHeightMm" defaultValue={stringValue(record ?? {}, "maxHeightMm")} type="number" min={0} placeholder="400" />
      </DrawerField>
      <DrawerField label="Profundidad maxima">
        <input name="maxDepthMm" defaultValue={stringValue(record ?? {}, "maxDepthMm")} type="number" min={0} placeholder="800" />
      </DrawerField>
      <DrawerField label="Grupos de cliente">
        <input name="customerGroupIds" defaultValue={stringValue(record ?? {}, "customerGroupIds")} placeholder="vip, b2b" />
      </DrawerField>
      <DrawerField label="Estado">
        <select name="active" defaultValue={boolValue(record ?? {}, "active")}>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </DrawerField>
      <button className="adminButton adminButtonPrimary" type="submit">Guardar servicio</button>
    </form>
  );
}

function RateRuleForm({
  record,
  zones,
  services,
  currency,
}: {
  record?: ShippingRecord;
  zones: ShippingRecord[];
  services: ShippingRecord[];
  currency: string;
}) {
  return (
    <form action={upsertShippingRateRuleAction} className="pricingDenseForm">
      <DrawerField label="ID de regla">
        <input name="shippingRateRuleId" defaultValue={stringValue(record ?? {}, "shippingRateRuleId")} placeholder="standard-0-2kg" />
      </DrawerField>
      <DrawerField label="Servicio">
        <select name="carrierServiceId" defaultValue={stringValue(record ?? {}, "carrierServiceId")}>
          <option value="">Servicio</option>
          {services.map((service, index) => {
            const id = String(service.carrierServiceId ?? "");
            return id ? <option value={id} key={id}>{String(service.name ?? id)}</option> : <option disabled key={`service-${index}`}>Sin serviceId</option>;
          })}
        </select>
      </DrawerField>
      <DrawerField label="Zona">
        <select name="zoneId" defaultValue={stringValue(record ?? {}, "zoneId")}>
          <option value="">Zona</option>
          {zones.map((zone, index) => {
            const id = String(zone.zoneId ?? "");
            return id ? <option value={id} key={id}>{String(zone.name ?? id)}</option> : <option disabled key={`zone-${index}`}>Sin zoneId</option>;
          })}
        </select>
      </DrawerField>
      <DrawerField label="Base de tarifa">
        <select name="ratingBasis" defaultValue={stringValue(record ?? {}, "ratingBasis") || "WEIGHT"}>
          <option value="WEIGHT">WEIGHT</option>
          <option value="PRICE">PRICE</option>
        </select>
      </DrawerField>
      <DrawerField label="Peso minimo">
        <input name="minWeightGrams" defaultValue={stringValue(record ?? {}, "minWeightGrams")} type="number" min={0} placeholder="0" />
      </DrawerField>
      <DrawerField label="Peso maximo">
        <input name="maxWeightGrams" defaultValue={stringValue(record ?? {}, "maxWeightGrams")} type="number" min={0} placeholder="2000" />
      </DrawerField>
      <DrawerField label="Pedido minimo">
        <input name="minOrderAmountMinor" defaultValue={stringValue(record ?? {}, "minOrderAmountMinor")} type="number" min={0} placeholder="0" />
      </DrawerField>
      <DrawerField label="Pedido maximo">
        <input name="maxOrderAmountMinor" defaultValue={stringValue(record ?? {}, "maxOrderAmountMinor")} type="number" min={0} placeholder="10000" />
      </DrawerField>
      <DrawerField label="Precio">
        <input name="priceMinor" defaultValue={stringValue(record ?? {}, "priceMinor") || "0"} type="number" min={0} placeholder="499" />
      </DrawerField>
      <DrawerField label="Moneda">
        <input name="currency" defaultValue={stringValue(record ?? {}, "currency") || currency} placeholder="EUR" />
      </DrawerField>
      <DrawerField label="Impuesto bps">
        <input name="taxRateBasisPoints" defaultValue={stringValue(record ?? {}, "taxRateBasisPoints") || "0"} type="number" min={0} placeholder="2100" />
      </DrawerField>
      <DrawerField label="Gratis desde">
        <input name="freeShippingThresholdMinor" defaultValue={stringValue(record ?? {}, "freeShippingThresholdMinor")} type="number" min={0} placeholder="5000" />
      </DrawerField>
      <DrawerField label="Fuera de rango">
        <select name="outOfRangeBehavior" defaultValue={stringValue(record ?? {}, "outOfRangeBehavior") || "DISABLE_CARRIER"}>
          <option value="DISABLE_CARRIER">DISABLE_CARRIER</option>
          <option value="HIGHEST_RATE">HIGHEST_RATE</option>
        </select>
      </DrawerField>
      <DrawerField label="Prioridad">
        <input name="priority" defaultValue={stringValue(record ?? {}, "priority") || "10"} type="number" min={0} placeholder="10" />
      </DrawerField>
      <DrawerField label="Estado">
        <select name="active" defaultValue={boolValue(record ?? {}, "active")}>
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </select>
      </DrawerField>
      <button className="adminButton adminButtonPrimary" type="submit">Guardar regla</button>
    </form>
  );
}

export function ShippingAdminPage({ context, data, filters }: ShippingAdminPageProps) {
  const configuration = data.configuration.data;
  const activeTab = filters.tab;

  if (!hasRequiredAdminContext(context)) {
    return (
      <main className="adminPage shippingAdminPage">
        <div className="adminBreadcrumb">Admin / Configuracion / Transporte</div>
        <div className="adminBanner adminBannerError">
          <p>Selecciona Organization y Shop antes de configurar transporte.</p>
          <Link className="adminButton" href="/admin/configuracion/contexto">Ir a contexto</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="adminPage pricingAdminPage shippingAdminPage">
      <div className="adminBreadcrumb">Admin / Configuracion / Transporte</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Transporte</h1>
          <p className="adminPageIntro">Configuracion global de transportistas, zonas, servicios y reglas tarifarias para Shipping/Logistics.</p>
        </div>
        <Link className="adminButton" href="/admin/products">Volver a productos</Link>
      </div>
      <div className="adminContextHint">
        {context.organizationId} / {context.shopId} / {context.currency} / {context.country} / {context.channel}
      </div>
      {filters.shippingMessage ? <div className="adminBanner"><p>{filters.shippingMessage}</p></div> : null}

      <nav className="adminTabs pricingTabs" aria-label="Transporte">
        {tabs.map((tab) => (
          <Link
            className={`productEditorTab ${tab.id === activeTab ? "productEditorTabActive" : ""}`}
            href={tabHref(tab.id, filters)}
            key={tab.id}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <ShippingFilters filters={filters} />

      {activeTab === "summary" ? (
        <div className="pricingGridTwo">
          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <h2>Resumen</h2>
              <p>{data.configuration.source === "bff" ? "BFF conectado" : "BFF no disponible"}</p>
            </div>
            <ResultBanner result={data.configuration} />
            <div className="productPriceSummary productPriceSummaryWide">
              <strong>{configuration.zones.length}</strong>
              <span>Zonas</span>
              <strong>{configuration.carriers.length}</strong>
              <span>Transportistas</span>
              <strong>{configuration.carrierServices.length}</strong>
              <span>Servicios</span>
              <strong>{configuration.rateRules.length}</strong>
              <span>Reglas</span>
              <strong>{filters.includeInactive ? "Si" : "No"}</strong>
              <span>Incluye inactivos</span>
            </div>
          </section>
          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <h2>Crear rapido</h2>
            </div>
            <p className="adminContextHint">Usa las pestanas para crear o editar recursos. Los cambios se guardan por recurso en Shipping/Logistics.</p>
          </section>
        </div>
      ) : null}

      {activeTab === "zones" ? (
        <RecordTable
          title="Zonas"
          result={data.configuration}
          rows={configuration.zones}
          columns={["zoneId", "name", "countries", "states", "postalCodePrefixes", "active"]}
          empty="No hay zonas configuradas."
          headerAction={<Link className="adminButton adminButtonPrimary" href={drawerHref("zones", filters, "create")}>Crear zona</Link>}
          actions={(record, index) => <ResourceActions tab="zones" resource="zones" record={record} index={index} filters={filters} />}
        />
      ) : null}

      {activeTab === "carriers" ? (
        <RecordTable
          title="Transportistas"
          result={data.configuration}
          rows={configuration.carriers}
          columns={["carrierId", "name", "trackingUrlTemplate", "logoUrl", "active"]}
          empty="No hay transportistas configurados."
          headerAction={<Link className="adminButton adminButtonPrimary" href={drawerHref("carriers", filters, "create")}>Crear transportista</Link>}
          actions={(record, index) => <ResourceActions tab="carriers" resource="carriers" record={record} index={index} filters={filters} />}
        />
      ) : null}

      {activeTab === "services" ? (
        <RecordTable
          title="Servicios de transportista"
          result={data.configuration}
          rows={configuration.carrierServices}
          columns={["carrierServiceId", "carrierId", "name", "deliveryChannel", "ratingBasis", "transitTimeLabel", "estimateBusinessDays", "handlingFeeMinor", "active"]}
          empty="No hay servicios configurados."
          headerAction={<Link className="adminButton adminButtonPrimary" href={drawerHref("services", filters, "create")}>Crear servicio</Link>}
          actions={(record, index) => <ResourceActions tab="services" resource="carrier-services" record={record} index={index} filters={filters} />}
        />
      ) : null}

      {activeTab === "rules" ? (
        <RecordTable
          title="Reglas tarifarias"
          result={data.configuration}
          rows={configuration.rateRules}
          columns={["shippingRateRuleId", "carrierServiceId", "zoneId", "ratingBasis", "minWeightGrams", "maxWeightGrams", "minOrderAmountMinor", "maxOrderAmountMinor", "priceMinor", "currency", "taxRateBasisPoints", "freeShippingThresholdMinor", "outOfRangeBehavior", "priority", "active"]}
          empty="No hay reglas tarifarias configuradas."
          headerAction={<Link className="adminButton adminButtonPrimary" href={drawerHref("rules", filters, "create")}>Crear regla</Link>}
          actions={(record, index) => <ResourceActions tab="rules" resource="rate-rules" record={record} index={index} filters={filters} />}
        />
      ) : null}

      {activeTab === "quote" ? (
        <>
          <QuoteSimulatorForm filters={filters} context={context} />
          <QuoteResult data={data} />
        </>
      ) : null}

      {activeTab === "fulfillments" ? <FulfillmentsQueue data={data} filters={filters} /> : null}

      <ShippingResourceDrawer context={context} filters={filters} configuration={configuration} />
      <FulfillmentDetailDrawer data={data} filters={filters} />
    </main>
  );
}
