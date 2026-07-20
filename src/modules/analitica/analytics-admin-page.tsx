import Link from "next/link";
import Image from "next/image";
import type { AdminContext } from "../../shared/config/admin-context";
import type { AnalyticsAdminData, AnalyticsAdminFilters, AnalyticsEvent, AnalyticsEventGroup, AnalyticsEventProduct } from "./analytics-admin";

type Props = {
  context: AdminContext;
  data: AnalyticsAdminData;
  filters: AnalyticsAdminFilters;
};

function analyticsHref(filters: AnalyticsAdminFilters, overrides: Partial<AnalyticsAdminFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  const entries: Array<[keyof AnalyticsAdminFilters, string | number | undefined]> = [
    ["from", next.from],
    ["to", next.to],
    ["eventType", next.eventType],
    ["limit", next.limit],
    ["offset", next.offset],
    ["drawer", next.drawer],
    ["eventId", next.eventId],
  ];

  for (const [key, value] of entries) {
    if (typeof value !== "undefined" && value !== "" && !(key === "offset" && value === 0)) {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `/admin/analitica?${query}` : "/admin/analitica";
}

function numberText(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
}

function moneyText(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function moneyMinorText(value: number, currency: string) {
  return moneyText(value / 100, currency);
}

function percentageText(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(value > 1 ? value / 100 : value);
}

function dateText(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function contextText(event: AnalyticsEvent) {
  return [event.context.locale, event.context.country, event.context.channel]
    .filter((value): value is string => Boolean(value))
    .join(" · ") || "-";
}

function eventTypes(data: AnalyticsAdminData, filters: AnalyticsAdminFilters) {
  const fromSummary = data.summary.ok ? Object.keys(data.summary.data.eventsByType) : [];
  const fromGroups = data.eventGroups.data.map((group) => group.eventType);
  return Array.from(new Set([...fromSummary, ...fromGroups, filters.eventType].filter(Boolean))).sort();
}

function normalizedEventType(eventType: string) {
  return eventType.trim().toLowerCase().replaceAll("_", "-");
}

function groupCopy(eventType: string) {
  switch (normalizedEventType(eventType)) {
    case "add-to-cart":
      return { title: "Añadidos al carrito", description: "Productos añadidos desde la tienda.", kind: "cart" as const };
    case "purchase-complete":
    case "purchase":
      return { title: "Compras completadas", description: "Pedidos confirmados en el periodo.", kind: "purchase" as const };
    case "detail-page-view":
      return { title: "Vistas de producto", description: "Interés registrado en fichas de producto.", kind: "product" as const };
    default:
      return { title: eventType, description: "Actividad registrada para este evento.", kind: "generic" as const };
  }
}

function productName(product: AnalyticsEventProduct) {
  return product.name ?? product.reference ?? product.productId ?? product.variantId ?? "Producto";
}

function productPriceText(product: AnalyticsEventProduct, event: AnalyticsEvent, fallbackCurrency: string) {
  const currency = product.currency ?? event.currency ?? fallbackCurrency;
  if (typeof product.unitPriceMinor === "number") return moneyMinorText(product.unitPriceMinor, currency);
  if (typeof product.unitPrice === "number") return moneyText(product.unitPrice, currency);
  if (typeof product.lineTotalMinor === "number") return moneyMinorText(product.lineTotalMinor, currency);
  if (typeof product.lineTotal === "number") return moneyText(product.lineTotal, currency);
  return "-";
}

function eventAmountText(event: AnalyticsEvent, fallbackCurrency: string) {
  const currency = event.currency ?? fallbackCurrency;
  if (typeof event.totalAmountMinor === "number") return moneyMinorText(event.totalAmountMinor, currency);
  if (typeof event.totalAmount === "number") return moneyText(event.totalAmount, currency);
  return "-";
}

function ProductPreview({ product, compact = false }: { product: AnalyticsEventProduct; compact?: boolean }) {
  return (
    <div className={`analyticsProductPreview${compact ? " analyticsProductPreviewCompact" : ""}`}>
      {product.imageUrl ? (
        <span className="analyticsProductImage">
          <Image alt={product.imageAlt ?? productName(product)} fill sizes="48px" src={product.imageUrl} unoptimized />
        </span>
      ) : <span aria-hidden="true" className="analyticsProductImage analyticsProductImageFallback">—</span>}
      <span>
        <strong>{productName(product)}</strong>
        {product.reference && product.reference !== product.name ? <small>{product.reference}</small> : null}
      </span>
    </div>
  );
}

function AnalyticsFilters({ data, filters }: Pick<Props, "data" | "filters">) {
  const types = eventTypes(data, filters);
  const clearHref = analyticsHref(filters, { eventType: undefined, offset: 0, drawer: undefined, eventId: undefined });

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Periodo y eventos</h2>
          <p>Consulta la actividad de la tienda activa.</p>
        </div>
        <Link className="adminButton adminButtonTiny" href={clearHref}>Limpiar</Link>
      </div>
      <form action="/admin/analitica" className="analyticsFilterForm" method="get">
        <label className="adminField">
          <span>Desde</span>
          <input defaultValue={filters.from} name="from" type="date" />
        </label>
        <label className="adminField">
          <span>Hasta</span>
          <input defaultValue={filters.to} name="to" type="date" />
        </label>
        <label className="adminField">
          <span>Tipo de evento</span>
          <select defaultValue={filters.eventType ?? ""} name="eventType">
            <option value="">Todos los eventos</option>
            {types.map((eventType) => <option key={eventType} value={eventType}>{eventType}</option>)}
          </select>
        </label>
        <input name="limit" type="hidden" value={filters.limit} />
        <button className="adminButton adminButtonPrimary" type="submit">Aplicar filtros</button>
      </form>
    </section>
  );
}

function AnalyticsSummary({ context, data }: Pick<Props, "context" | "data">) {
  const { health, summary } = data;

  if (!summary.ok) {
    return <section className="adminBanner adminBannerError">No se pudo cargar el resumen: {summary.message}</section>;
  }

  const entries = Object.entries(summary.data.eventsByType).sort(([left], [right]) => left.localeCompare(right));

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Resumen</h2>
          <p>{summary.data.totalEvents} eventos en el periodo seleccionado.</p>
        </div>
        <span className={`adminBadge${health.ok ? " adminBadgeOk" : " adminBadgeWarn"}`}>
          {health.ok ? "Analytics disponible" : "Analytics no disponible"}
        </span>
      </div>
      {!health.ok ? <div className="adminBanner adminBannerWarning">{health.message}</div> : null}
      <div className="adminKpiGrid">
        <article className="adminKpi"><span>Ingresos</span><strong>{moneyText(summary.data.revenue, context.currency)}</strong><small>Compras confirmadas</small></article>
        <article className="adminKpi"><span>Compras</span><strong>{numberText(summary.data.purchases)}</strong><small>purchase / purchase-complete</small></article>
        <article className="adminKpi"><span>Conversión</span><strong>{percentageText(summary.data.conversionRate)}</strong><small>Sobre visitantes únicos</small></article>
        <article className="adminKpi"><span>Visitantes únicos</span><strong>{numberText(summary.data.uniqueVisitors)}</strong><small>En el periodo seleccionado</small></article>
      </div>
      {entries.length ? (
        <div className="analyticsEventBreakdown">
          <strong>Eventos registrados</strong>
          <ul>
            {entries.map(([eventType, count]) => <li key={eventType}><span>{eventType}</span><strong>{numberText(count)}</strong></li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function EventRows({ group, filters, currency }: { group: AnalyticsEventGroup; filters: AnalyticsAdminFilters; currency: string }) {
  const copy = groupCopy(group.eventType);
  if (copy.kind === "cart") {
    return <table className="adminTable"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Fecha</th><th aria-label="Acción" /></tr></thead><tbody>{group.page.events.map((event) => {
      const product = event.products[0];
      return <tr key={event.eventId}><td>{product ? <ProductPreview product={product} /> : "Producto no disponible"}</td><td>{product?.quantity ?? "-"}</td><td>{product ? productPriceText(product, event, currency) : eventAmountText(event, currency)}</td><td>{dateText(event.occurredAt)}</td><td><Link className="adminButton adminButtonTiny" href={analyticsHref(filters, { drawer: "event", eventId: event.eventId })}>Ver detalle</Link></td></tr>;
    })}</tbody></table>;
  }
  if (copy.kind === "purchase") {
    return <table className="adminTable"><thead><tr><th>Compra</th><th>Productos</th><th>Importe</th><th>Fecha</th><th aria-label="Acción" /></tr></thead><tbody>{group.page.events.map((event) => (
      <tr key={event.eventId}><td><strong>{event.orderReference ?? "Compra confirmada"}</strong></td><td>{event.products.length ? <div className="analyticsProductStack">{event.products.slice(0, 3).map((product, index) => <ProductPreview compact key={`${product.variantId ?? product.productId ?? productName(product)}-${index}`} product={product} />)}{event.products.length > 3 ? <small>+{event.products.length - 3} productos</small> : null}</div> : "Productos no disponibles"}</td><td>{eventAmountText(event, currency)}</td><td>{dateText(event.occurredAt)}</td><td><Link className="adminButton adminButtonTiny" href={analyticsHref(filters, { drawer: "event", eventId: event.eventId })}>Ver detalle</Link></td></tr>
    ))}</tbody></table>;
  }
  return <table className="adminTable"><thead><tr><th>Detalle</th><th>Precio</th><th>Fecha</th><th aria-label="Acción" /></tr></thead><tbody>{group.page.events.map((event) => {
    const product = event.products[0];
    return <tr key={event.eventId}><td>{product ? <ProductPreview product={product} /> : event.orderReference ?? "Evento registrado"}</td><td>{product ? productPriceText(product, event, currency) : eventAmountText(event, currency)}</td><td>{dateText(event.occurredAt)}</td><td><Link className="adminButton adminButtonTiny" href={analyticsHref(filters, { drawer: "event", eventId: event.eventId })}>Ver detalle</Link></td></tr>;
  })}</tbody></table>;
}

function EventGroups({ context, data, filters }: Pick<Props, "context" | "data" | "filters">) {
  if (!data.eventGroups.ok) return <section className="adminBanner adminBannerError">No se pudieron cargar los eventos: {data.eventGroups.message}</section>;
  if (!data.eventGroups.data.length) return <section className="adminCard"><div className="adminEmptyState">No hay eventos para los filtros seleccionados.</div></section>;
  return <div className="analyticsEventGroups">{data.eventGroups.data.map((group) => {
    const copy = groupCopy(group.eventType);
    return <details className="adminCard analyticsEventGroup" key={group.eventType}>
      <summary className="analyticsEventGroupSummary"><div><h2>{copy.title}</h2><p>{copy.description}</p></div><span>{numberText(group.page.total)} registrados</span></summary>
      <div className="analyticsEventGroupContent">{group.page.events.length ? <div className="adminTableScroller"><EventRows currency={context.currency} filters={filters} group={group} /></div> : <div className="adminEmptyState">No hay registros de este evento en la página actual.</div>}</div>
    </details>;
  })}</div>;
}

function EventDrawer({ event, filters }: { event: AnalyticsEvent; filters: AnalyticsAdminFilters }) {
  const closeHref = analyticsHref(filters, { drawer: undefined, eventId: undefined });
  const technicalPayload = JSON.stringify(event.payload, null, 2);

  return (
    <div className="adminDrawerBackdrop analyticsDrawerBackdrop">
      <Link aria-label="Cerrar detalle del evento" className="analyticsDrawerBackdropLink" href={closeHref} />
      <aside aria-label={`Detalle de ${event.eventType}`} aria-modal="true" className="adminSideDrawer analyticsSideDrawer" role="dialog">
        <div className="adminSideDrawerHeader">
          <div><h2>{event.eventType}</h2><p>Detalle del evento registrado.</p></div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
        </div>
        <table className="analyticsDetailTable">
          <tbody>
            <tr><th>Origen</th><td>{event.source}</td><th>Ocurrió</th><td>{dateText(event.occurredAt)}</td></tr>
            <tr><th>Recibido</th><td>{dateText(event.receivedAt)}</td><th>Contexto</th><td>{contextText(event)}</td></tr>
          </tbody>
        </table>
        {event.products.length ? <section className="analyticsDrawerProducts"><h3>Productos</h3><div className="analyticsProductStack">{event.products.map((product, index) => <ProductPreview key={`${product.variantId ?? product.productId ?? productName(product)}-${index}`} product={product} />)}</div></section> : null}
        <details className="analyticsTechnicalDetails">
          <summary>Datos técnicos</summary>
          <table className="analyticsDetailTable analyticsTechnicalTable">
            <tbody>
              <tr><th>Evento</th><td>{event.eventId}</td></tr>
              <tr><th>Correlación</th><td>{event.correlationId ?? "-"}</td></tr>
            </tbody>
          </table>
          <pre className="analyticsPayload">{technicalPayload}</pre>
        </details>
      </aside>
    </div>
  );
}

export function AnalyticsAdminPage({ context, data, filters }: Props) {
  const selectedEvent = data.eventGroups.ok && filters.drawer === "event"
    ? data.eventGroups.data.flatMap((group) => group.page.events).find((event) => event.eventId === filters.eventId)
    : undefined;

  return (
    <main className="adminPage analyticsAdminPage">
      <div>
        <div className="adminBreadcrumb">Admin / Analitica</div>
        <h1>Analitica</h1>
        <p className="adminPageLead">Rendimiento comercial y eventos de {context.shopName || context.shopAlias || context.shopId || "la tienda activa"}.</p>
      </div>
      <AnalyticsFilters data={data} filters={filters} />
      <AnalyticsSummary context={context} data={data} />
      <EventGroups context={context} data={data} filters={filters} />
      {selectedEvent ? <EventDrawer event={selectedEvent} filters={filters} /> : null}
    </main>
  );
}
