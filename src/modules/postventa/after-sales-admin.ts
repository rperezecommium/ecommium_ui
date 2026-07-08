import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminSession } from "../../shared/auth/session";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";

export type AfterSalesAdminFilters = {
  caseId?: string;
  status?: string;
  customerId?: string;
  orderId?: string;
  assignedEmployeeId?: string;
  limit?: string;
  offset?: string;
  notice?: string;
};

export type AfterSalesAdminCapabilities = {
  canManageAfterSales: boolean;
};

export type AfterSalesAdminHealth = {
  service?: string;
  status?: string;
  databaseReachable?: boolean;
  publisherEnabled?: boolean;
  consumerEnabled?: boolean;
};

export type AfterSalesAdminCaseItem = {
  caseItemId: string;
  name?: string;
  productId?: string | null;
  variantId?: string | null;
  quantityRequested?: number;
  quantityApproved?: number | null;
  status?: string;
};

export type AfterSalesAdminCase = {
  caseId: string;
  orderId: string;
  customerId?: string | null;
  caseType?: string;
  status?: string;
  assignedEmployeeId?: string | null;
  assignedBy?: string | null;
  assignedAt?: string | null;
  reasonCode?: string | null;
  customerMessage?: string | null;
  adminNotes?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items: AfterSalesAdminCaseItem[];
  evidences: unknown[];
  resolutions: unknown[];
  returnAuthorizations: unknown[];
  refundRequests: unknown[];
  inventoryDispositions: unknown[];
  documentAdjustments: unknown[];
};

export type AfterSalesAdminCaseList = {
  items: AfterSalesAdminCase[];
  total: number;
  limit: number;
  offset: number;
};

export type AfterSalesAdminData = {
  context: AdminContext;
  health: BffResult<AfterSalesAdminHealth | null>;
  cases: BffResult<AfterSalesAdminCaseList>;
  selectedCase: BffResult<AfterSalesAdminCase | null>;
};

export type AfterSalesAdminAuditEvent = {
  eventId: string;
  eventType: string;
  label: string;
  status?: string;
  actor?: string | null;
  referenceId?: string;
  occurredAt?: string | null;
  source: "case" | "assignment" | "return" | "resolution" | "refund" | "inventory" | "document" | "evidence";
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

function asNullableNumber(value: unknown): number | null | undefined {
  return value === null ? null : asNumber(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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
  }

  return undefined;
}

function recordStatus(value: unknown) {
  return recordField(value, ["status", "resolutionType", "adjustmentType", "dispositionType", "evidenceType"]);
}

function recordDate(value: unknown) {
  return recordField(value, ["occurredAt", "issuedAt", "requestedAt", "authorizedAt", "receivedAt", "createdAt", "updatedAt"]);
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
    correlationId: "after-sales-admin-unavailable",
  };
}

function normalizeItem(value: unknown): AfterSalesAdminCaseItem {
  const record = asRecord(value);

  return {
    caseItemId: asString(record.caseItemId) ?? asString(record.id) ?? "",
    name: asString(record.name),
    productId: asNullableString(record.productId),
    variantId: asNullableString(record.variantId),
    quantityRequested: asNumber(record.quantityRequested),
    quantityApproved: asNullableNumber(record.quantityApproved),
    status: asString(record.status),
  };
}

export function normalizeAfterSalesCase(value: unknown): AfterSalesAdminCase {
  const record = asRecord(value);

  return {
    caseId: asString(record.caseId) ?? asString(record.id) ?? "",
    orderId: asString(record.orderId) ?? "",
    customerId: asNullableString(record.customerId),
    caseType: asString(record.caseType),
    status: asString(record.status),
    assignedEmployeeId: asNullableString(record.assignedEmployeeId),
    assignedBy: asNullableString(record.assignedBy),
    assignedAt: asNullableString(record.assignedAt),
    reasonCode: asNullableString(record.reasonCode),
    customerMessage: asNullableString(record.customerMessage),
    adminNotes: asNullableString(record.adminNotes),
    submittedAt: asNullableString(record.submittedAt),
    reviewedAt: asNullableString(record.reviewedAt),
    resolvedAt: asNullableString(record.resolvedAt),
    closedAt: asNullableString(record.closedAt),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
    items: asArray(record.items).map(normalizeItem),
    evidences: asArray(record.evidences),
    resolutions: asArray(record.resolutions),
    returnAuthorizations: asArray(record.returnAuthorizations),
    refundRequests: asArray(record.refundRequests),
    inventoryDispositions: asArray(record.inventoryDispositions),
    documentAdjustments: asArray(record.documentAdjustments),
  };
}

function auditEvent(
  event: AfterSalesAdminAuditEvent,
): AfterSalesAdminAuditEvent {
  return event;
}

function collectionAuditEvents(
  items: unknown[],
  source: AfterSalesAdminAuditEvent["source"],
  label: string,
  idKeys: string[],
): AfterSalesAdminAuditEvent[] {
  return items.map((item, index) => {
    const referenceId = recordField(item, idKeys) ?? `${source}-${index + 1}`;
    return auditEvent({
      eventId: `${source}:${referenceId}`,
      eventType: source.toUpperCase(),
      label,
      status: recordStatus(item),
      actor: recordField(item, ["createdBy", "requestedBy", "actorId", "employeeId"]),
      referenceId,
      occurredAt: recordDate(item),
      source,
      detail: recordField(item, ["reason", "note", "externalReference", "transactionId", "invoiceId", "warehouseId"]),
    });
  });
}

export function buildAfterSalesAuditTimeline(selectedCase: AfterSalesAdminCase | null): AfterSalesAdminAuditEvent[] {
  if (!selectedCase) {
    return [];
  }

  const events: AfterSalesAdminAuditEvent[] = [
    auditEvent({
      eventId: `case:${selectedCase.caseId}:created`,
      eventType: "CASE_CREATED",
      label: "Caso creado",
      status: selectedCase.status,
      actor: selectedCase.customerId,
      referenceId: selectedCase.caseId,
      occurredAt: selectedCase.createdAt,
      source: "case",
      detail: selectedCase.reasonCode ?? selectedCase.caseType,
    }),
    auditEvent({
      eventId: `case:${selectedCase.caseId}:submitted`,
      eventType: "CASE_SUBMITTED",
      label: "Caso enviado",
      status: selectedCase.status,
      actor: selectedCase.customerId,
      referenceId: selectedCase.orderId,
      occurredAt: selectedCase.submittedAt,
      source: "case",
      detail: selectedCase.customerMessage ?? undefined,
    }),
    auditEvent({
      eventId: `assignment:${selectedCase.caseId}`,
      eventType: "CASE_ASSIGNED",
      label: "Responsable asignado",
      status: selectedCase.status,
      actor: selectedCase.assignedBy,
      referenceId: selectedCase.assignedEmployeeId ?? undefined,
      occurredAt: selectedCase.assignedAt,
      source: "assignment",
      detail: selectedCase.assignedEmployeeId ?? undefined,
    }),
    auditEvent({
      eventId: `case:${selectedCase.caseId}:reviewed`,
      eventType: "CASE_REVIEWED",
      label: "Revision iniciada",
      status: "UNDER_REVIEW",
      referenceId: selectedCase.caseId,
      occurredAt: selectedCase.reviewedAt,
      source: "case",
    }),
    auditEvent({
      eventId: `case:${selectedCase.caseId}:resolved`,
      eventType: "CASE_RESOLVED",
      label: "Caso resuelto",
      status: "RESOLVED",
      referenceId: selectedCase.caseId,
      occurredAt: selectedCase.resolvedAt,
      source: "case",
    }),
    auditEvent({
      eventId: `case:${selectedCase.caseId}:closed`,
      eventType: "CASE_CLOSED",
      label: "Caso cerrado",
      status: "CLOSED",
      referenceId: selectedCase.caseId,
      occurredAt: selectedCase.closedAt,
      source: "case",
    }),
    ...collectionAuditEvents(selectedCase.evidences, "evidence", "Evidencia registrada", ["evidenceId", "caseEvidenceId", "id"]),
    ...collectionAuditEvents(selectedCase.resolutions, "resolution", "Resolucion registrada", ["resolutionId", "caseResolutionId", "id"]),
    ...collectionAuditEvents(selectedCase.returnAuthorizations, "return", "Retorno autorizado", ["returnAuthorizationId", "authorizationId", "id"]),
    ...collectionAuditEvents(selectedCase.refundRequests, "refund", "Refund solicitado", ["refundRequestId", "requestId", "id"]),
    ...collectionAuditEvents(selectedCase.inventoryDispositions, "inventory", "Disposicion de inventario", ["inventoryDispositionId", "dispositionId", "id"]),
    ...collectionAuditEvents(selectedCase.documentAdjustments, "document", "Ajuste documental", ["documentAdjustmentId", "adjustmentId", "id"]),
  ];

  return events
    .filter((event) => event.occurredAt || event.referenceId || event.detail)
    .sort((left, right) => {
      const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
      const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
      return rightTime - leftTime;
    });
}

function normalizeCaseList(value: unknown): AfterSalesAdminCaseList {
  const record = asRecord(value);
  const items = asArray(record.items ?? record.data ?? value).map(normalizeAfterSalesCase);

  return {
    items,
    total: asNumber(record.total) ?? items.length,
    limit: asNumber(record.limit) ?? items.length,
    offset: asNumber(record.offset) ?? 0,
  };
}

function normalizeHealth(value: unknown): AfterSalesAdminHealth {
  const record = asRecord(value);
  const persistence = asRecord(record.persistence);
  const events = asRecord(record.events);

  return {
    service: asString(record.service),
    status: asString(record.status),
    databaseReachable: typeof persistence.reachable === "boolean" ? persistence.reachable : undefined,
    publisherEnabled: typeof events.publisherEnabled === "boolean" ? events.publisherEnabled : undefined,
    consumerEnabled: typeof events.consumerEnabled === "boolean" ? events.consumerEnabled : undefined,
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

export function getAfterSalesAdminCapabilities(
  session: Pick<AdminSession, "permissions" | "scope"> | null | undefined,
): AfterSalesAdminCapabilities {
  return {
    canManageAfterSales: hasPermission(session, ["after-sales.manage", "after_sales.manage", "admin:after-sales:view"]),
  };
}

export async function getAfterSalesAdminData(
  context: AdminContext,
  filters: AfterSalesAdminFilters = {},
  capabilities: AfterSalesAdminCapabilities,
): Promise<AfterSalesAdminData> {
  if (!hasRequiredAdminContext(context)) {
    const skipped = unavailable<null>("Selecciona organization y shop para operar postventa.");
    return {
      context,
      health: skipped,
      cases: unavailable("Selecciona organization y shop para operar postventa."),
      selectedCase: skipped,
    };
  }

  if (!capabilities.canManageAfterSales) {
    const skipped = unavailable<null>("Falta permiso after-sales.manage.");
    return {
      context,
      health: skipped,
      cases: unavailable("Falta permiso after-sales.manage."),
      selectedCase: skipped,
    };
  }

  const limit = filters.limit?.trim() || "25";
  const offset = filters.offset?.trim() || "0";
  const listPath = scopedPath("/admin/after-sales/cases", context, {
    status: filters.status,
    customerId: filters.customerId,
    orderId: filters.orderId,
    assignedEmployeeId: filters.assignedEmployeeId,
    limit,
    offset,
  });
  const selectedPath = filters.caseId
    ? scopedPath(`/admin/after-sales/cases/${encodeURIComponent(filters.caseId)}`, context)
    : null;

  const [health, cases, selectedCase] = await Promise.all([
    requestBff<AfterSalesAdminHealth>("/admin/after-sales/health", {
      context,
      parse: normalizeHealth,
    }),
    requestBff<AfterSalesAdminCaseList>(listPath, {
      context,
      parse: normalizeCaseList,
    }),
    selectedPath
      ? requestBff<AfterSalesAdminCase>(selectedPath, {
          context,
          parse: normalizeAfterSalesCase,
        })
      : Promise.resolve({ ok: true as const, data: null, status: 200, correlationId: "after-sales-admin-no-selection" }),
  ]);

  return {
    context,
    health,
    cases,
    selectedCase,
  };
}
