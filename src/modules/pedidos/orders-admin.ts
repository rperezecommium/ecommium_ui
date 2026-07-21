import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminSession } from "../../shared/auth/session";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";

export type OrdersAdminDrawerTab = "operacion" | "pedido" | "pagos" | "documentos" | "postventa" | "auditoria";

export type OrdersAdminFilters = {
  orderId?: string;
  customerId?: string;
  limit?: string;
  offset?: string;
  orderTab?: OrdersAdminDrawerTab;
  notice?: string;
  noticeKind?: "success" | "error" | "info";
};

export type OrdersAdminCapabilities = {
  canReadOrders: boolean;
  canManageInvoices: boolean;
  canManageAfterSales: boolean;
  canManageShipping: boolean;
};

export type AdminOrderSummary = {
  orderId: string;
  customerId?: string | null;
  customer?: {
    kind?: "REGISTERED" | "GUEST" | "UNAVAILABLE" | string;
    reference?: string | null;
  };
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  currency?: string;
  totalAmountMinor?: number;
  createdAt?: string;
};

export type AdminOrdersList = {
  items: AdminOrderSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminOrderDetail = {
  order: AdminOrderSummary | null;
  payment: Record<string, unknown> | null;
  shipping: Record<string, unknown> | null;
  operation: AdminOrderOperation | null;
  invoice: Record<string, unknown> | null;
  afterSales: Record<string, unknown> | null;
  warnings: { section: string; message?: string }[];
  generatedAt?: string;
};

export type AdminOrderOperationAction = {
  type?: string;
  label?: string;
  enabled?: boolean;
  targetFulfillmentStatus?: string | null;
  requiresTracking?: boolean;
  requiresCarrier?: boolean;
  reason?: string | null;
};

export type AdminOrderOperationSection = {
  code?: string;
  label?: string;
  status?: string;
  message?: string;
  count?: number | null;
};

export type AdminOrderOperationTimelineStep = {
  code?: string;
  label?: string;
  state?: "pending" | "current" | "completed" | "blocked" | string;
};

export type AdminOrderOperation = {
  status?: string;
  paymentState?: string;
  fulfillmentStatus?: string | null;
  primaryAction?: AdminOrderOperationAction | null;
  blockers?: Array<{ code?: string; message?: string }>;
  sections?: AdminOrderOperationSection[];
  timeline?: AdminOrderOperationTimelineStep[];
};

export type OrdersAdminData = {
  context: AdminContext;
  orders: BffResult<AdminOrdersList>;
  selectedOrder: BffResult<AdminOrderDetail | null>;
};

export type OrdersAdminAuditEvent = {
  eventId: string;
  eventType: string;
  label: string;
  status?: string;
  actor?: string | null;
  referenceId?: string;
  occurredAt?: string | null;
  source: "order" | "payment" | "shipping" | "invoice" | "adjustment" | "after-sales" | "composition";
  detail?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  return value === null ? null : asString(value);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  const record = asRecord(value);
  const nested = record[key];
  return typeof nested === "object" && nested !== null ? asRecord(nested) : null;
}

function firstListRecord(value: unknown): Record<string, unknown> | null {
  const first = asArray(asRecord(value).items)[0];
  return typeof first === "object" && first !== null ? asRecord(first) : null;
}

function recordField(value: unknown, keys: string[]): string | undefined {
  const record = asRecord(value);
  for (const key of keys) {
    const field = record[key];
    if (typeof field === "string" && field.trim()) {
      return field.trim();
    }
    if (typeof field === "number" && Number.isFinite(field)) {
      return String(field);
    }
    if (typeof field === "boolean") {
      return field ? "true" : "false";
    }
  }

  return undefined;
}

function recordStatus(value: unknown) {
  return recordField(value, ["status", "transactionStatus", "paymentStatus", "fulfillmentStatus", "adjustmentType", "documentType"]);
}

function recordDate(value: unknown) {
  return recordField(value, ["occurredAt", "issuedAt", "paidAt", "settledAt", "capturedAt", "authorizedAt", "deliveredAt", "estimatedDeliveryAt", "createdAt", "updatedAt"]);
}

function orderAuditEvent(event: OrdersAdminAuditEvent): OrdersAdminAuditEvent {
  return event;
}

function parsePositiveInteger(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function parseOffset(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function scopedPath(path: string, context: AdminContext, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });

  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  });

  return `${path}?${params.toString()}`;
}

function unavailable<T>(error: string): BffResult<T> {
  return {
    ok: false,
    error,
    status: 428,
    correlationId: "orders-admin-context-missing",
  };
}

function normalizeOrderSummary(value: unknown): AdminOrderSummary {
  const record = asRecord(value);
  const customer = asRecord(record.customer);

  return {
    orderId: asString(record.orderId) ?? asString(record.id) ?? "",
    customerId: asNullableString(record.customerId),
    customer: Object.keys(customer).length
      ? {
          kind: asString(customer.kind),
          reference: asNullableString(customer.reference),
        }
      : undefined,
    status: asString(record.status),
    paymentStatus: asString(record.paymentStatus),
    fulfillmentStatus: asString(record.fulfillmentStatus),
    currency: asString(record.currency),
    totalAmountMinor: asNumber(record.totalAmountMinor),
    createdAt: asString(record.createdAt),
  };
}

function normalizeOrdersList(value: unknown): AdminOrdersList {
  const record = asRecord(value);
  const items = asArray(record.items ?? record.data ?? value).map(normalizeOrderSummary);

  return {
    items,
    total: asNumber(record.total) ?? items.length,
    limit: asNumber(record.limit) ?? items.length,
    offset: asNumber(record.offset) ?? 0,
  };
}

function normalizeOrderOperation(value: unknown): AdminOrderOperation | null {
  const record = asRecord(value);
  if (!Object.keys(record).length) {
    return null;
  }
  const primaryAction = asRecord(record.primaryAction);

  return {
    status: asString(record.status),
    paymentState: asString(record.paymentState),
    fulfillmentStatus: asNullableString(record.fulfillmentStatus),
    primaryAction: Object.keys(primaryAction).length
      ? {
          type: asString(primaryAction.type),
          label: asString(primaryAction.label),
          enabled: typeof primaryAction.enabled === "boolean" ? primaryAction.enabled : undefined,
          targetFulfillmentStatus: asNullableString(primaryAction.targetFulfillmentStatus),
          requiresTracking: typeof primaryAction.requiresTracking === "boolean" ? primaryAction.requiresTracking : undefined,
          requiresCarrier: typeof primaryAction.requiresCarrier === "boolean" ? primaryAction.requiresCarrier : undefined,
          reason: asNullableString(primaryAction.reason),
        }
      : null,
    blockers: asArray(record.blockers).map((blocker) => {
      const item = asRecord(blocker);
      return {
        code: asString(item.code),
        message: asString(item.message),
      };
    }),
    sections: asArray(record.sections).map((section) => {
      const item = asRecord(section);
      return {
        code: asString(item.code),
        label: asString(item.label),
        status: asString(item.status),
        message: asString(item.message),
        count: item.count === null ? null : asNumber(item.count),
      };
    }),
    timeline: asArray(record.timeline).map((step) => {
      const item = asRecord(step);
      return {
        code: asString(item.code),
        label: asString(item.label),
        state: asString(item.state),
      };
    }),
  };
}

function normalizeOrderDetail(value: unknown): AdminOrderDetail {
  const record = asRecord(value);
  const payment = record.payment ? asRecord(record.payment) : null;
  const paymentTransaction = nestedRecord(record.payment, "transaction");
  const shipping = record.shipping ? asRecord(record.shipping) : null;
  const fulfillment = nestedRecord(record.shipping, "fulfillment");
  const invoice = record.invoice ? asRecord(record.invoice) : null;
  const firstInvoice = firstListRecord(record.invoice);
  const afterSales = record.afterSales ? asRecord(record.afterSales) : null;
  const firstAfterSalesCase = firstListRecord(record.afterSales);

  return {
    order: record.order ? normalizeOrderSummary(record.order) : normalizeOrderSummary(record),
    payment: payment ? { ...(paymentTransaction ?? {}), ...payment } : null,
    shipping: fulfillment ? { ...fulfillment, fulfillment } : shipping,
    operation: normalizeOrderOperation(record.operation),
    invoice: firstInvoice ?? invoice,
    afterSales: firstAfterSalesCase ?? afterSales,
    warnings: asArray(record.warnings).map((warning) => {
      const item = asRecord(warning);
      return {
        section: asString(item.section) ?? "",
        message: asString(item.message),
      };
    }),
    generatedAt: asString(record.generatedAt),
  };
}

function adjustmentAuditEvents(invoice: Record<string, unknown> | null): OrdersAdminAuditEvent[] {
  return asArray(invoice?.adjustments ?? invoice?.fiscalAdjustments ?? invoice?.creditNotes).map((item, index) => {
    const referenceId = recordField(item, ["adjustmentId", "creditNoteId", "documentAdjustmentId", "id", "externalReference"]) ?? `adjustment-${index + 1}`;
    return orderAuditEvent({
      eventId: `adjustment:${referenceId}`,
      eventType: "INVOICE_ADJUSTMENT",
      label: "Nota o ajuste fiscal",
      status: recordStatus(item),
      actor: recordField(item, ["createdBy", "issuedBy", "employeeId", "actorId"]),
      referenceId,
      occurredAt: recordDate(item),
      source: "adjustment",
      detail: recordField(item, ["reason", "adjustmentNumberFormatted", "externalReference", "invoiceId"]),
    });
  });
}

export function buildOrderAuditTimeline(detail: AdminOrderDetail | null): OrdersAdminAuditEvent[] {
  if (!detail) {
    return [];
  }

  const orderId = detail.order?.orderId ?? "selected-order";
  const paymentReference = recordField(detail.payment, ["transactionId", "paymentId", "authorizationId"]);
  const shippingReference = recordField(detail.shipping, ["trackingNumber", "fulfillmentId", "shipmentId", "carrierName"]);
  const invoiceReference = recordField(detail.invoice, ["invoiceId", "invoiceNumber", "id"]);
  const afterSalesReference = recordField(detail.afterSales, ["caseId", "id"]);

  const events: OrdersAdminAuditEvent[] = [
    orderAuditEvent({
      eventId: `order:${orderId}:created`,
      eventType: "ORDER_CREATED",
      label: "Pedido creado",
      status: detail.order?.status,
      actor: detail.order?.customerId,
      referenceId: detail.order?.orderId,
      occurredAt: detail.order?.createdAt,
      source: "order",
      detail: detail.order?.currency && typeof detail.order.totalAmountMinor === "number"
        ? `${detail.order.totalAmountMinor} ${detail.order.currency}`
        : undefined,
    }),
    orderAuditEvent({
      eventId: `payment:${paymentReference ?? orderId}`,
      eventType: "PAYMENT_STATUS",
      label: "Estado de pago",
      status: recordStatus(detail.payment),
      actor: recordField(detail.payment, ["createdBy", "updatedBy", "actorId", "employeeId"]),
      referenceId: paymentReference,
      occurredAt: recordDate(detail.payment),
      source: "payment",
      detail: recordField(detail.payment, ["provider", "psp", "gateway", "refundsCount", "refundCount"]),
    }),
    orderAuditEvent({
      eventId: `shipping:${shippingReference ?? orderId}`,
      eventType: "SHIPPING_STATUS",
      label: "Estado de shipping",
      status: recordStatus(detail.shipping),
      actor: recordField(detail.shipping, ["createdBy", "updatedBy", "actorId", "employeeId"]),
      referenceId: shippingReference,
      occurredAt: recordDate(detail.shipping),
      source: "shipping",
      detail: recordField(detail.shipping, ["carrierName", "carrier", "selectedCarrier", "trackingUrl"]),
    }),
    orderAuditEvent({
      eventId: `invoice:${invoiceReference ?? orderId}`,
      eventType: "INVOICE_STATUS",
      label: "Estado de factura",
      status: recordStatus(detail.invoice),
      actor: recordField(detail.invoice, ["createdBy", "issuedBy", "actorId", "employeeId"]),
      referenceId: invoiceReference,
      occurredAt: recordDate(detail.invoice),
      source: "invoice",
      detail: recordField(detail.invoice, ["invoiceNumberFormatted", "invoiceNumber", "totalAmountMinor", "amountMinor"]),
    }),
    orderAuditEvent({
      eventId: `after-sales:${afterSalesReference ?? orderId}`,
      eventType: "AFTER_SALES_CASE",
      label: "Caso postventa",
      status: recordStatus(detail.afterSales),
      actor: recordField(detail.afterSales, ["assignedEmployeeId", "assignedBy", "createdBy", "actorId"]),
      referenceId: afterSalesReference,
      occurredAt: recordDate(detail.afterSales),
      source: "after-sales",
      detail: recordField(detail.afterSales, ["caseType", "type", "reasonCode"]),
    }),
    ...adjustmentAuditEvents(detail.invoice),
    ...detail.warnings.map((warning, index) => orderAuditEvent({
      eventId: `composition-warning:${warning.section || index + 1}`,
      eventType: "COMPOSITION_WARNING",
      label: "Warning de composicion",
      status: "WARNING",
      referenceId: warning.section,
      occurredAt: detail.generatedAt,
      source: "composition",
      detail: warning.message,
    })),
  ];

  return events
    .filter((event) => event.occurredAt || event.referenceId || event.detail || event.status)
    .sort((left, right) => {
      const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
      const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
      return rightTime - leftTime;
    });
}

function hasPermission(session: Pick<AdminSession, "permissions" | "scope"> | null | undefined, aliases: string[]) {
  if (!session || session.scope !== "admin") {
    return false;
  }

  const current = new Set(session.permissions.map((item) => item.trim().toLowerCase()));
  return (
    current.has("*") ||
    current.has("system.admin") ||
    current.has("admin:*") ||
    aliases.some((alias) => current.has(alias.toLowerCase()))
  );
}

export function getOrdersAdminCapabilities(
  session: Pick<AdminSession, "permissions" | "scope"> | null | undefined,
): OrdersAdminCapabilities {
  return {
    canReadOrders: hasPermission(session, ["orders.read", "admin:orders:view"]),
    canManageInvoices: hasPermission(session, ["invoices.manage", "invoice.manage"]),
    canManageAfterSales: hasPermission(session, ["after-sales.manage", "after_sales.manage"]),
    canManageShipping: hasPermission(session, ["shipping.logistics.write", "shipping.admin.write"]),
  };
}

export async function getOrdersAdminData(
  context: AdminContext,
  filters: OrdersAdminFilters = {},
  capabilities: OrdersAdminCapabilities,
): Promise<OrdersAdminData> {
  if (!hasRequiredAdminContext(context)) {
    const skipped = unavailable<null>("Selecciona organization y shop para operar pedidos.");
    const emptyOrders = unavailable<AdminOrdersList>("Selecciona organization y shop para operar pedidos.");

    return {
      context,
      orders: emptyOrders,
      selectedOrder: skipped,
    };
  }

  const limit = String(parsePositiveInteger(filters.limit, 25, 100));
  const offset = String(parseOffset(filters.offset));
  const orderId = filters.orderId?.trim();
  const customerId = filters.customerId?.trim();

  const [orders, selectedOrder] = await Promise.all([
    capabilities.canReadOrders
      ? requestBff<AdminOrdersList>(
          scopedPath("/admin/orders", context, { customerId, limit, offset }),
          { context, parse: normalizeOrdersList },
        )
      : unavailable<AdminOrdersList>("Falta permiso orders.read."),
    orderId && capabilities.canReadOrders
      ? requestBff<AdminOrderDetail | null>(
          scopedPath(`/admin/orders/${encodeURIComponent(orderId)}`, context),
          { context, parse: normalizeOrderDetail },
        )
      : Promise.resolve({ ok: true as const, data: null, status: 200, correlationId: "orders-admin-no-selection" }),
  ]);

  return {
    context,
    orders,
    selectedOrder,
  };
}
