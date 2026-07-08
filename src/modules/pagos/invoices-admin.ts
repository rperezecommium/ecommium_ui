import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminSession } from "../../shared/auth/session";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";

export type InvoiceAdminFilters = {
  invoiceId?: string;
  orderId?: string;
  status?: string;
  limit?: string;
  offset?: string;
  notice?: string;
};

export type InvoiceAdminCapabilities = {
  canManageInvoices: boolean;
};

export type InvoiceAdminHealth = {
  service?: string;
  status?: string;
  databaseReachable?: boolean;
  documentDriver?: string;
  eventsEnabled?: boolean;
};

export type InvoiceAdminLine = {
  lineId: string;
  name?: string;
  quantity?: number;
  unitPriceMinor?: number;
  taxRateBps?: number;
  taxMinor?: number;
  lineTotalMinor?: number;
};

export type InvoiceAdminInvoice = {
  invoiceId: string;
  orderId: string;
  customerId?: string | null;
  status?: string;
  series?: string;
  fiscalPeriod?: string;
  invoiceNumberFormatted?: string | null;
  currency?: string;
  subtotalMinor?: number;
  discountMinor?: number;
  taxMinor?: number;
  shippingMinor?: number;
  totalMinor?: number;
  issuedAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  createdAt?: string;
  lines: InvoiceAdminLine[];
};

export type InvoiceAdminList = {
  items: InvoiceAdminInvoice[];
  total: number;
  limit: number;
  offset: number;
};

export type InvoiceAdminDocument = {
  documentId?: string;
  invoiceId?: string;
  documentType?: string;
  format?: string;
  storageDriver?: string;
  contentHash?: string;
  html?: string;
  json?: Record<string, unknown>;
  createdAt?: string;
};

export type InvoiceAdminData = {
  context: AdminContext;
  health: BffResult<InvoiceAdminHealth | null>;
  invoices: BffResult<InvoiceAdminList>;
  selectedInvoice: BffResult<InvoiceAdminInvoice | null>;
  selectedDocument: BffResult<InvoiceAdminDocument | null>;
  templatePreview: BffResult<InvoiceAdminDocument | null>;
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
    correlationId: "invoices-admin-unavailable",
  };
}

function normalizeLine(value: unknown): InvoiceAdminLine {
  const record = asRecord(value);

  return {
    lineId: asString(record.lineId) ?? asString(record.id) ?? "",
    name: asString(record.name),
    quantity: asNumber(record.quantity),
    unitPriceMinor: asNumber(record.unitPriceMinor),
    taxRateBps: asNumber(record.taxRateBps),
    taxMinor: asNumber(record.taxMinor),
    lineTotalMinor: asNumber(record.lineTotalMinor),
  };
}

export function normalizeInvoice(value: unknown): InvoiceAdminInvoice {
  const record = asRecord(value);

  return {
    invoiceId: asString(record.invoiceId) ?? asString(record.id) ?? "",
    orderId: asString(record.orderId) ?? "",
    customerId: asNullableString(record.customerId),
    status: asString(record.status),
    series: asString(record.series),
    fiscalPeriod: asString(record.fiscalPeriod),
    invoiceNumberFormatted: asNullableString(record.invoiceNumberFormatted ?? record.invoiceNumber),
    currency: asString(record.currency),
    subtotalMinor: asNumber(record.subtotalMinor),
    discountMinor: asNumber(record.discountMinor),
    taxMinor: asNumber(record.taxMinor),
    shippingMinor: asNumber(record.shippingMinor),
    totalMinor: asNumber(record.totalMinor ?? record.totalAmountMinor),
    issuedAt: asNullableString(record.issuedAt),
    failedAt: asNullableString(record.failedAt),
    failureReason: asNullableString(record.failureReason),
    createdAt: asString(record.createdAt),
    lines: asArray(record.lines).map(normalizeLine),
  };
}

function normalizeInvoiceList(value: unknown): InvoiceAdminList {
  const record = asRecord(value);
  const items = asArray(record.items ?? record.data ?? value).map(normalizeInvoice);

  return {
    items,
    total: asNumber(record.total) ?? items.length,
    limit: asNumber(record.limit) ?? items.length,
    offset: asNumber(record.offset) ?? 0,
  };
}

function normalizeDocument(value: unknown): InvoiceAdminDocument {
  const record = asRecord(value);
  const contentJson = asRecord(record.contentJson);

  return {
    documentId: asString(record.documentId),
    invoiceId: asString(record.invoiceId),
    documentType: asString(record.documentType),
    format: asString(record.format),
    storageDriver: asString(record.storageDriver),
    contentHash: asString(record.contentHash),
    html: asString(record.html) ?? asString(contentJson.html),
    json: record.contentJson ? contentJson : asRecord(record.json),
    createdAt: asString(record.createdAt),
  };
}

function normalizeHealth(value: unknown): InvoiceAdminHealth {
  const record = asRecord(value);
  const persistence = asRecord(record.persistence);
  const documents = asRecord(record.documents);
  const events = asRecord(record.events);

  return {
    service: asString(record.service),
    status: asString(record.status),
    databaseReachable: typeof persistence.reachable === "boolean" ? persistence.reachable : undefined,
    documentDriver: asString(documents.driver),
    eventsEnabled: typeof events.consumerEnabled === "boolean" ? events.consumerEnabled : undefined,
  };
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

export function getInvoiceAdminCapabilities(
  session: Pick<AdminSession, "permissions" | "scope"> | null | undefined,
): InvoiceAdminCapabilities {
  return {
    canManageInvoices: hasPermission(session, ["invoices.manage", "invoice.manage", "admin:payments:view"]),
  };
}

export async function getInvoiceAdminData(
  context: AdminContext,
  filters: InvoiceAdminFilters = {},
  capabilities: InvoiceAdminCapabilities,
): Promise<InvoiceAdminData> {
  if (!hasRequiredAdminContext(context)) {
    const skipped = unavailable<null>("Selecciona organization y shop para operar facturacion fiscal.");
    return {
      context,
      health: skipped,
      invoices: unavailable("Selecciona organization y shop para operar facturacion fiscal."),
      selectedInvoice: skipped,
      selectedDocument: skipped,
      templatePreview: skipped,
    };
  }

  if (!capabilities.canManageInvoices) {
    const skipped = unavailable<null>("Falta permiso invoices.manage.");
    return {
      context,
      health: skipped,
      invoices: unavailable("Falta permiso invoices.manage."),
      selectedInvoice: skipped,
      selectedDocument: skipped,
      templatePreview: skipped,
    };
  }

  const limit = filters.limit?.trim() || "25";
  const offset = filters.offset?.trim() || "0";
  const listPath = scopedPath("/admin/invoices", context, {
    orderId: filters.orderId,
    status: filters.status,
    limit,
    offset,
  });
  const selectedPath = filters.invoiceId
    ? scopedPath(`/admin/invoices/${encodeURIComponent(filters.invoiceId)}`, context)
    : null;
  const documentPath = filters.invoiceId
    ? scopedPath(`/admin/invoices/${encodeURIComponent(filters.invoiceId)}/document`, context)
    : null;

  const [health, invoices, selectedInvoice, selectedDocument, templatePreview] = await Promise.all([
    requestBff<InvoiceAdminHealth>("/admin/invoices/health", {
      context,
      parse: normalizeHealth,
    }),
    requestBff<InvoiceAdminList>(listPath, {
      context,
      parse: normalizeInvoiceList,
    }),
    selectedPath
      ? requestBff<InvoiceAdminInvoice>(selectedPath, {
          context,
          parse: normalizeInvoice,
        })
      : Promise.resolve({ ok: true as const, data: null, status: 200, correlationId: "invoices-admin-no-selection" }),
    documentPath
      ? requestBff<InvoiceAdminDocument>(documentPath, {
          context,
          parse: normalizeDocument,
        })
      : Promise.resolve({ ok: true as const, data: null, status: 200, correlationId: "invoices-admin-no-document" }),
    requestBff<InvoiceAdminDocument>(scopedPath("/admin/invoices/document-template/preview", context, { currency: context.currency }), {
      context,
      parse: normalizeDocument,
    }),
  ]);

  return {
    context,
    health,
    invoices,
    selectedInvoice,
    selectedDocument,
    templatePreview,
  };
}
