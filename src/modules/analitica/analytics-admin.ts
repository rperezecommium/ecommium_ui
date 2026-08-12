import { requestAdminBff } from "../../shared/bff/admin-client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";

export type AnalyticsEventSource = "storefront" | "admin" | "service" | "system";

export type AnalyticsEventContext = {
  locale?: string | null;
  currency?: string | null;
  country?: string | null;
  channel?: string | null;
};

export type AnalyticsEventProduct = {
  productId?: string;
  variantId?: string;
  name?: string;
  reference?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  quantity?: number;
  unitPriceMinor?: number;
  unitPrice?: number;
  lineTotalMinor?: number;
  lineTotal?: number;
  currency?: string;
};

export type AnalyticsEvent = {
  eventId: string;
  eventType: string;
  source: AnalyticsEventSource;
  correlationId?: string | null;
  context: AnalyticsEventContext;
  payload: Record<string, unknown>;
  products: AnalyticsEventProduct[];
  orderReference?: string;
  totalAmountMinor?: number;
  totalAmount?: number;
  currency?: string;
  occurredAt: string;
  receivedAt: string;
};

export type AnalyticsSummary = {
  totalEvents: number;
  uniqueVisitors: number;
  eventsByType: Record<string, number>;
  revenue: number;
  purchases: number;
  addToCart: number;
  conversionRate: number;
};

export type AnalyticsHealth = {
  status?: string;
  service?: string;
  persistenceDriver?: string;
  databaseConfigured?: boolean;
};

export type AnalyticsEventPage = {
  total: number;
  limit: number;
  offset: number;
  events: AnalyticsEvent[];
};

export type AnalyticsEventGroup = {
  eventType: string;
  page: AnalyticsEventPage;
};

export type AnalyticsAdminResult<T> = {
  ok: boolean;
  data: T;
  message?: string;
  status?: number;
};

export type AnalyticsAdminFilters = {
  from: string;
  to: string;
  eventType?: string;
  limit: number;
  offset: number;
  drawer?: "event";
  eventId?: string;
};

export type AnalyticsAdminData = {
  health: AnalyticsAdminResult<AnalyticsHealth>;
  summary: AnalyticsAdminResult<AnalyticsSummary>;
  eventGroups: AnalyticsAdminResult<AnalyticsEventGroup[]>;
};

const defaultLimit = 25;
const maxLimit = 200;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function asNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isDateInput(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function parsePositiveInteger(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function parseOffset(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function rangeDefault(now: Date) {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: toDateInputValue(start), to: toDateInputValue(end) };
}

export function resolveAnalyticsAdminFilters(
  input: Partial<Record<string, string | undefined>>,
  now = new Date(),
): AnalyticsAdminFilters {
  const defaults = rangeDefault(now);
  const candidateFrom = isDateInput(input.from) ? input.from : defaults.from;
  const candidateTo = isDateInput(input.to) ? input.to : defaults.to;
  const validRange = candidateFrom <= candidateTo;

  return {
    from: validRange ? candidateFrom : defaults.from,
    to: validRange ? candidateTo : defaults.to,
    eventType: asOptionalString(input.eventType),
    limit: parsePositiveInteger(input.limit, defaultLimit, maxLimit),
    offset: parseOffset(input.offset),
    drawer: input.drawer === "event" ? "event" : undefined,
    eventId: asOptionalString(input.eventId),
  };
}

function toStartOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function toEndOfDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

function scopedParams(context: AdminContext, extra?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (typeof value !== "undefined" && value !== "") {
      params.set(key, String(value));
    }
  }

  return params;
}

function normalizeHealth(value: unknown): AnalyticsHealth {
  const source = asRecord(value);
  return {
    status: asOptionalString(source.status),
    service: asOptionalString(source.service),
    persistenceDriver: asOptionalString(source.persistenceDriver),
    databaseConfigured: asBoolean(source.databaseConfigured),
  };
}

function normalizedImageUrl(value: unknown) {
  const url = asOptionalString(value);
  return url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) ? url : null;
}

function productEntries(payload: Record<string, unknown>): AnalyticsEventProduct[] {
  const candidates = [payload.items, payload.productDetails, payload.products]
    .flatMap(asArray);
  const entries = candidates.length > 0
    ? candidates
    : (asOptionalString(payload.productId) || asOptionalString(payload.variantId) ? [payload] : []);

  return entries.map(asRecord).map((item) => ({
    productId: asOptionalString(item.productId) ?? asOptionalString(item.id),
    variantId: asOptionalString(item.variantId),
    name: asOptionalString(item.name) ?? asOptionalString(item.productName) ?? asOptionalString(item.title),
    reference: asOptionalString(item.refId) ?? asOptionalString(item.reference) ?? asOptionalString(item.sku),
    imageUrl: normalizedImageUrl(item.imageUrl ?? item.image ?? item.thumbnailUrl),
    imageAlt: asOptionalString(item.imageAlt) ?? asOptionalString(item.name) ?? asOptionalString(item.productName),
    quantity: asNullableNumber(item.quantity),
    unitPriceMinor: asNullableNumber(item.unitPriceMinor) ?? asNullableNumber(item.priceMinor),
    unitPrice: asNullableNumber(item.unitPrice) ?? asNullableNumber(item.price),
    lineTotalMinor: asNullableNumber(item.lineTotalMinor) ?? asNullableNumber(item.totalMinor),
    lineTotal: asNullableNumber(item.lineTotal) ?? asNullableNumber(item.total),
    currency: asOptionalString(item.currency),
  })).filter((item) => item.productId || item.variantId || item.name);
}

function normalizeEvent(value: unknown): AnalyticsEvent {
  const source = asRecord(value);
  const context = asRecord(source.context);
  const payload = asRecord(source.payload);
  const eventSource = asString(source.source, "storefront");

  return {
    eventId: asString(source.eventId),
    eventType: asString(source.eventType, "Evento sin tipo"),
    source: ["storefront", "admin", "service", "system"].includes(eventSource)
      ? eventSource as AnalyticsEventSource
      : "service",
    correlationId: asOptionalString(source.correlationId) ?? null,
    context: {
      locale: asOptionalString(context.locale) ?? null,
      currency: asOptionalString(context.currency) ?? null,
      country: asOptionalString(context.country) ?? null,
      channel: asOptionalString(context.channel) ?? null,
    },
    payload,
    products: productEntries(payload),
    orderReference: asOptionalString(payload.orderReference) ?? asOptionalString(payload.orderId) ?? asOptionalString(payload.transactionId),
    totalAmountMinor: asNullableNumber(payload.totalAmountMinor) ?? asNullableNumber(payload.valueMinor),
    totalAmount: asNullableNumber(payload.value) ?? asNullableNumber(payload.revenue),
    currency: asOptionalString(payload.currency) ?? asOptionalString(context.currency),
    occurredAt: asString(source.occurredAt),
    receivedAt: asString(source.receivedAt),
  };
}

type CatalogProductPresentation = {
  name?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  variants: Record<string, { name?: string; reference?: string; imageUrl?: string | null; imageAlt?: string | null }>;
};

function mediaUrl(value: unknown) {
  const record = asRecord(value);
  return normalizedImageUrl(record.previewUrl ?? record.publicUrl ?? record.url ?? record.thumbnailUrl);
}

function mediaItems(value: unknown) {
  const record = asRecord(value);
  const collection = asRecord(record.mediaCollection);
  const collectionItems = asArray(collection.items);
  return (collectionItems.length ? collectionItems : asArray(record.mediaItems)).map((item) => ({
    record: asRecord(item),
    id: asOptionalString(asRecord(item).mediaAssetId) ?? asOptionalString(asRecord(item).id),
    url: mediaUrl(item),
  }));
}

function normalizeCatalogPresentation(value: unknown): CatalogProductPresentation {
  const source = asRecord(value);
  const product = asRecord(source.product);
  const media = mediaItems(source);
  const productImage = normalizedImageUrl(product.thumbnailUrl) ?? media.find((item) => item.record.isMain === true)?.url ?? media[0]?.url ?? null;
  const variantMedia = asRecord(source.variantMedia);
  const variants: CatalogProductPresentation["variants"] = {};

  for (const rawVariant of asArray(source.variants)) {
    const variant = asRecord(rawVariant);
    const variantId = asOptionalString(variant.variantId) ?? asOptionalString(variant.id);
    if (!variantId) continue;

    const assigned = asRecord(variantMedia[variantId]);
    const assignedItems = asArray(assigned.items).length ? asArray(assigned.items) : asArray(variantMedia[variantId]);
    const assignedImage = assignedItems.map(mediaUrl).find(Boolean) ?? null;
    variants[variantId] = {
      name: asOptionalString(variant.name),
      reference: asOptionalString(variant.refId) ?? asOptionalString(variant.reference),
      imageUrl: assignedImage ?? productImage,
      imageAlt: asOptionalString(variant.name) ?? asOptionalString(product.name),
    };
  }

  return {
    name: asOptionalString(product.name),
    imageUrl: productImage,
    imageAlt: asOptionalString(product.thumbnailAlt) ?? asOptionalString(product.name),
    variants,
  };
}

async function mapConcurrent<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>) {
  const results: R[] = [];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

async function enrichEventsWithCatalog(context: AdminContext, events: AnalyticsEvent[]) {
  const productIds = Array.from(new Set(events.flatMap((event) => event.products.map((product) => product.productId)).filter((value): value is string => Boolean(value))));
  const presentations = new Map<string, CatalogProductPresentation>();
  await mapConcurrent(productIds, 4, async (productId) => {
    const params = scopedParams(context, { locale: context.locale, currency: context.currency });
    const result = await requestAdminBff(`/admin/products/${encodeURIComponent(productId)}/editor-state?${params.toString()}`, {
      context,
      parse: normalizeCatalogPresentation,
    });
    if (result.ok) presentations.set(productId, result.data);
  });

  return events.map((event) => ({
    ...event,
    products: event.products.map((product) => {
      const catalog = product.productId ? presentations.get(product.productId) : undefined;
      const variant = product.variantId ? catalog?.variants[product.variantId] : undefined;
      return {
        ...product,
        name: product.name ?? variant?.name ?? catalog?.name,
        reference: product.reference ?? variant?.reference,
        imageUrl: product.imageUrl ?? variant?.imageUrl ?? catalog?.imageUrl ?? null,
        imageAlt: product.imageAlt ?? variant?.imageAlt ?? catalog?.imageAlt ?? null,
        currency: product.currency ?? event.currency ?? event.context.currency ?? context.currency,
      };
    }),
  }));
}

function normalizeEvents(value: unknown): AnalyticsEventPage {
  const source = asRecord(value);
  const rawEvents = Array.isArray(source.events) ? source.events : [];

  return {
    total: asNumber(source.total),
    limit: parsePositiveInteger(String(source.limit ?? ""), defaultLimit, maxLimit),
    offset: parseOffset(String(source.offset ?? "")),
    events: rawEvents.map(normalizeEvent).filter((event) => Boolean(event.eventId)),
  };
}

function normalizeSummary(value: unknown): AnalyticsSummary {
  const source = asRecord(value);
  const eventCounts = asRecord(source.eventsByType);
  const eventsByType = Object.fromEntries(
    Object.entries(eventCounts)
      .filter(([, count]) => typeof count === "number" && Number.isFinite(count))
      .map(([eventType, count]) => [eventType, count as number]),
  );

  return {
    totalEvents: asNumber(source.totalEvents),
    uniqueVisitors: asNumber(source.uniqueVisitors),
    eventsByType,
    revenue: asNumber(source.revenue),
    purchases: asNumber(source.purchases),
    addToCart: asNumber(source.addToCart),
    conversionRate: asNumber(source.conversionRate),
  };
}

function unavailable<T>(fallback: T, result: Extract<BffResult<T>, { ok: false }>): AnalyticsAdminResult<T> {
  return {
    ok: false,
    data: fallback,
    message: result.status === 403 ? "Falta permiso analytics.reports.read." : result.error,
    status: result.status,
  };
}

function unavailableContext<T>(fallback: T): AnalyticsAdminResult<T> {
  return {
    ok: false,
    data: fallback,
    message: "Selecciona organization y shop para consultar Analitica.",
  };
}

async function getAnalytics<T>(
  context: AdminContext,
  endpoint: string,
  fallback: T,
  parse: (value: unknown) => T,
): Promise<AnalyticsAdminResult<T>> {
  const result = await requestAdminBff(endpoint, { context, parse });
  return result.ok ? { ok: true, data: result.data } : unavailable(fallback, result);
}

export async function getAnalyticsAdminData(
  context: AdminContext,
  filters: AnalyticsAdminFilters,
): Promise<AnalyticsAdminData> {
  const emptySummary: AnalyticsSummary = {
    totalEvents: 0,
    uniqueVisitors: 0,
    eventsByType: {},
    revenue: 0,
    purchases: 0,
    addToCart: 0,
    conversionRate: 0,
  };
  const emptyEvents: AnalyticsEventPage = { total: 0, limit: filters.limit, offset: filters.offset, events: [] };

  if (!hasRequiredAdminContext(context)) {
    return {
      health: unavailableContext({}),
      summary: unavailableContext(emptySummary),
      eventGroups: unavailableContext([]),
    };
  }

  const summaryParams = scopedParams(context, {
    from: toStartOfDay(filters.from),
    to: toEndOfDay(filters.to),
  });
  const [health, summary] = await Promise.all([
    getAnalytics(context, "/admin/analytics/health", {}, normalizeHealth),
    getAnalytics(context, `/admin/analytics/reports/summary?${summaryParams.toString()}`, emptySummary, normalizeSummary),
  ]);

  const types = filters.eventType
    ? [filters.eventType]
    : summary.ok ? Object.keys(summary.data.eventsByType).sort() : [];
  const groups = await Promise.all(types.map(async (eventType) => {
    const eventParams = scopedParams(context, {
      eventType,
      from: toStartOfDay(filters.from),
      to: toEndOfDay(filters.to),
      limit: filters.limit,
      offset: filters.offset,
    });
    const page = await getAnalytics(context, `/admin/analytics/events?${eventParams.toString()}`, emptyEvents, normalizeEvents);
    if (!page.ok) return { eventType, page };
    return {
      eventType,
      page: { ...page, data: { ...page.data, events: await enrichEventsWithCatalog(context, page.data.events) } },
    };
  }));

  const failedGroup = groups.find((group) => !group.page.ok);
  const eventGroups: AnalyticsAdminResult<AnalyticsEventGroup[]> = failedGroup
    ? { ok: false, data: groups.map((group) => ({ eventType: group.eventType, page: group.page.data })), message: failedGroup.page.message }
    : { ok: true, data: groups.map((group) => ({ eventType: group.eventType, page: group.page.data })) };

  return { health, summary, eventGroups };
}
