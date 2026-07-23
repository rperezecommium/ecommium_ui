import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminSession } from "../../shared/auth/session";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";

export type PaymentsAdminTab =
  | "resumen"
  | "operaciones"
  | "reembolsos"
  | "facturas"
  | "metodos"
  | "proveedores"
  | "routing"
  | "diagnostico";

export type LegacyPaymentsAdminTab = "afiliaciones" | "reglas";
export type PaymentsAdminDrawer = "refund-evidence" | "create-payment-system" | "create-affiliation" | "create-payment-rule";

export type PaymentsAdminFilters = {
  tab?: PaymentsAdminTab | LegacyPaymentsAdminTab;
  includeInactive?: string;
  cardBin?: string;
  transactionStatus?: string;
  transactionReference?: string;
  transactionLimit?: string;
  transactionOffset?: string;
  notice?: string;
  transactionId?: string;
  drawer?: PaymentsAdminDrawer;
};

export type PaymentsAdminCapabilities = {
  canManagePayments: boolean;
  canViewPayments: boolean;
  canViewOperations: boolean;
  canProcessTransactions: boolean;
  canRefundPayments: boolean;
};

export type PaymentSystemAdminRecord = {
  paymentSystemId: string;
  name: string;
  groupName?: string;
  methodType?: string;
  provider?: string;
  active: boolean;
  supportsInstallments?: boolean;
  maxInstallments?: number;
};

export type PaymentAffiliationAdminRecord = {
  affiliationId: string;
  name: string;
  provider?: string;
  merchantId?: string;
  active: boolean;
};

export type PaymentRuleAdminRecord = {
  ruleId: string;
  name: string;
  paymentSystemId?: string;
  affiliationId?: string;
  priority?: number;
  country?: string;
  currency?: string;
  minValueMinor?: number;
  maxValueMinor?: number;
  active: boolean;
};

export type PaymentsCardLookupResult = {
  brand?: string;
  bin?: string;
  paymentSystems: PaymentSystemAdminRecord[];
};

export type PaymentOperationMethod = {
  name: string;
  methodType?: string;
  status?: string;
};

export type PaymentOperationAdminRecord = {
  transactionId: string;
  paymentReference?: string;
  referenceId?: string;
  status: string;
  valueMinor: number;
  currency: string;
  paymentMethods: PaymentOperationMethod[];
  settledMinor: number;
  refundedMinor: number;
  cancelledMinor: number;
  refundableMinor: number;
  cancellableMinor: number;
  refundsCount: number;
  cancellationsCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type PaymentOperationsSummary = {
  capturedMinor: number;
  pendingCount: number;
  failedCount: number;
  refundedMinor: number;
};

export type PaymentOperationsAdminPage = {
  items: PaymentOperationAdminRecord[];
  total: number;
  limit: number;
  offset: number;
  summary: PaymentOperationsSummary;
};

export type PaymentRefundEvidence = {
  refundId: string;
  transactionId: string;
  valueMinor: number;
  freightMinor?: number;
  taxMinor?: number;
  currency: string;
  status: string;
  providerName?: string;
  providerStatus?: string;
  providerRefundId?: string;
  failureCode?: string;
  failureMessage?: string;
  requestedAt?: string;
  submittedAt?: string;
  providerAcceptedAt?: string;
  succeededAt?: string;
  failedAt?: string;
  updatedAt?: string;
};

export type PaymentTransactionEvidence = {
  transactionId: string;
  paymentReference?: string;
  referenceId?: string;
  status: string;
  valueMinor: number;
  currency: string;
  settledMinor: number;
  refundedMinor: number;
  refundableMinor: number;
  refunds: PaymentRefundEvidence[];
};

export type PaymentsAdminData = {
  affiliations: BffResult<PaymentAffiliationAdminRecord[]>;
  cardLookup: BffResult<PaymentsCardLookupResult | null>;
  context: AdminContext;
  paymentSystems: BffResult<PaymentSystemAdminRecord[]>;
  rules: BffResult<PaymentRuleAdminRecord[]>;
  transactions: BffResult<PaymentOperationsAdminPage>;
  transactionEvidence: BffResult<PaymentTransactionEvidence | null>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nullableNumber(value: unknown): number | undefined {
  const parsed = asNumber(value);
  return typeof parsed === "number" && parsed >= 0 ? parsed : undefined;
}

function nonNegativeNumber(value: unknown) {
  const parsed = asNumber(value);
  return typeof parsed === "number" && parsed >= 0 ? parsed : 0;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const record = asRecord(value);
  const data = asRecord(record.data);
  const result = asRecord(record.result);
  return Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.paymentSystems)
      ? record.paymentSystems
      : Array.isArray(record.affiliations)
        ? record.affiliations
        : Array.isArray(record.rules)
          ? record.rules
          : Array.isArray(data.items)
            ? data.items
            : Array.isArray(result.items)
              ? result.items
              : [];
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
    correlationId: "payments-admin-unavailable",
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

export function getPaymentsAdminCapabilities(
  session: Pick<AdminSession, "permissions" | "scope"> | null | undefined,
): PaymentsAdminCapabilities {
  const canManagePayments = hasPermission(session, ["payments.manage", "admin:payments:manage"]);
  const canViewOperations = hasPermission(session, ["payments.transactions.read"]);
  const canProcessTransactions = hasPermission(session, ["payments.transactions.process"]);
  const canRefundPayments = hasPermission(session, ["payments.refunds.write"]);
  return {
    canManagePayments,
    canViewPayments: canManagePayments || hasPermission(session, ["payments.read", "admin:payments:view"]),
    canViewOperations,
    canProcessTransactions,
    canRefundPayments,
  };
}

export function normalizePaymentSystem(value: unknown): PaymentSystemAdminRecord {
  const record = asRecord(value);
  const affiliation = asRecord(record.affiliation);
  const configuration = asRecord(record.configurationJson ?? record.configuration);

  return {
    paymentSystemId: asString(record.paymentSystemId) ?? asString(record.id) ?? "",
    name: asString(record.name) ?? asString(record.displayName) ?? "Metodo de pago",
    groupName: asString(record.groupName) ?? asString(record.group),
    methodType: asString(record.methodType) ?? asString(record.type),
    provider: asString(record.provider) ?? asString(affiliation.provider),
    active: record.active !== false && record.enabled !== false && record.status !== "INACTIVE",
    supportsInstallments: typeof record.supportsInstallments === "boolean" ? record.supportsInstallments : undefined,
    maxInstallments: asNumber(record.maxInstallments ?? configuration.maxInstallments),
  };
}

export function normalizeAffiliation(value: unknown): PaymentAffiliationAdminRecord {
  const record = asRecord(value);

  return {
    affiliationId: asString(record.affiliationId) ?? asString(record.id) ?? "",
    name: asString(record.name) ?? "Afiliacion",
    provider: asString(record.provider) ?? asString(record.providerName) ?? asString(record.driver),
    merchantId: asString(record.merchantId),
    active: record.active !== false && record.enabled !== false && record.status !== "INACTIVE",
  };
}

export function normalizePaymentRule(value: unknown): PaymentRuleAdminRecord {
  const record = asRecord(value);

  return {
    ruleId: asString(record.ruleId) ?? asString(record.id) ?? "",
    name: asString(record.name) ?? "Regla de pago",
    paymentSystemId: asString(record.paymentSystemId),
    affiliationId: asString(record.affiliationId),
    priority: asNumber(record.priority),
    country: asString(record.country),
    currency: asString(record.currency),
    minValueMinor: asNumber(record.minValueMinor),
    maxValueMinor: asNumber(record.maxValueMinor),
    active: record.active !== false && record.enabled !== false && record.status !== "INACTIVE",
  };
}

function normalizePaymentSystems(value: unknown): PaymentSystemAdminRecord[] {
  return asArray(value).map(normalizePaymentSystem).filter((item) => item.paymentSystemId);
}

function normalizeAffiliations(value: unknown): PaymentAffiliationAdminRecord[] {
  return asArray(value).map(normalizeAffiliation).filter((item) => item.affiliationId);
}

function normalizeRules(value: unknown): PaymentRuleAdminRecord[] {
  return asArray(value).map(normalizePaymentRule).filter((item) => item.ruleId);
}

function normalizeCardLookup(value: unknown): PaymentsCardLookupResult {
  const record = asRecord(value);
  return {
    brand: asString(record.brand) ?? asString(record.cardBrand),
    bin: asString(record.bin),
    paymentSystems: normalizePaymentSystems(record.paymentSystems ?? record.items ?? value),
  };
}

export function normalizePaymentOperation(value: unknown): PaymentOperationAdminRecord {
  const record = asRecord(value);
  const methods = asArray(record.paymentMethods).map((method) => {
    const item = asRecord(method);
    return {
      name: asString(item.name) ?? asString(item.methodType) ?? "Método no informado",
      methodType: asString(item.methodType),
      status: asString(item.status),
    };
  });

  return {
    transactionId: asString(record.transactionId) ?? asString(record.id) ?? "",
    paymentReference: asString(record.paymentReference),
    referenceId: asString(record.referenceId),
    status: asString(record.status) ?? "UNKNOWN",
    valueMinor: nonNegativeNumber(record.valueMinor),
    currency: asString(record.currency) ?? "EUR",
    paymentMethods: methods,
    settledMinor: nonNegativeNumber(record.settledMinor),
    refundedMinor: nonNegativeNumber(record.refundedMinor),
    cancelledMinor: nonNegativeNumber(record.cancelledMinor),
    refundableMinor: nonNegativeNumber(record.refundableMinor),
    cancellableMinor: nonNegativeNumber(record.cancellableMinor),
    refundsCount: nonNegativeNumber(record.refundsCount),
    cancellationsCount: nonNegativeNumber(record.cancellationsCount),
    createdAt: asString(record.createdAt),
    updatedAt: asString(record.updatedAt),
  };
}

export function normalizePaymentOperationsPage(value: unknown): PaymentOperationsAdminPage {
  const record = asRecord(value);
  const payload = Object.keys(asRecord(record.data)).length ? asRecord(record.data) : record;
  const summary = asRecord(payload.summary);

  return {
    items: asArray(payload.items).map(normalizePaymentOperation).filter((item) => item.transactionId),
    total: nonNegativeNumber(payload.total),
    limit: nonNegativeNumber(payload.limit) || 25,
    offset: nonNegativeNumber(payload.offset),
    summary: {
      capturedMinor: nonNegativeNumber(summary.capturedMinor),
      pendingCount: nonNegativeNumber(summary.pendingCount),
      failedCount: nonNegativeNumber(summary.failedCount),
      refundedMinor: nonNegativeNumber(summary.refundedMinor),
    },
  };
}

function normalizePaymentRefundEvidence(value: unknown): PaymentRefundEvidence {
  const record = asRecord(value);
  return {
    refundId: asString(record.refundId) ?? "",
    transactionId: asString(record.transactionId) ?? "",
    valueMinor: nonNegativeNumber(record.valueMinor),
    freightMinor: nullableNumber(record.freightMinor),
    taxMinor: nullableNumber(record.taxMinor),
    currency: asString(record.currency) ?? "EUR",
    status: asString(record.status) ?? "UNKNOWN",
    providerName: asString(record.providerName),
    providerStatus: asString(record.providerStatus),
    providerRefundId: asString(record.providerRefundId),
    failureCode: asString(record.failureCode),
    failureMessage: asString(record.failureMessage),
    requestedAt: asString(record.requestedAt),
    submittedAt: asString(record.submittedAt),
    providerAcceptedAt: asString(record.providerAcceptedAt),
    succeededAt: asString(record.succeededAt),
    failedAt: asString(record.failedAt),
    updatedAt: asString(record.updatedAt),
  };
}

function refundEvidenceDate(refund: PaymentRefundEvidence) {
  const value = refund.updatedAt
    ?? refund.succeededAt
    ?? refund.failedAt
    ?? refund.providerAcceptedAt
    ?? refund.submittedAt
    ?? refund.requestedAt;
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function normalizePaymentTransactionEvidence(value: unknown): PaymentTransactionEvidence {
  const envelope = asRecord(value);
  const transaction = asRecord(envelope.transaction ?? value);
  return {
    transactionId: asString(transaction.transactionId) ?? asString(transaction.id) ?? "",
    paymentReference: asString(transaction.paymentReference),
    referenceId: asString(transaction.referenceId),
    status: asString(transaction.status) ?? "UNKNOWN",
    valueMinor: nonNegativeNumber(transaction.valueMinor),
    currency: asString(transaction.currency) ?? "EUR",
    settledMinor: nonNegativeNumber(transaction.settledMinor),
    refundedMinor: nonNegativeNumber(transaction.refundedMinor),
    refundableMinor: nonNegativeNumber(transaction.refundableMinor),
    refunds: asArray(transaction.refunds)
      .map(normalizePaymentRefundEvidence)
      .filter((refund) => refund.refundId)
      .sort((left, right) => refundEvidenceDate(right) - refundEvidenceDate(left)),
  };
}

export async function getPaymentsAdminData(
  context: AdminContext,
  filters: PaymentsAdminFilters,
  capabilities: PaymentsAdminCapabilities,
): Promise<PaymentsAdminData> {
  if (!hasRequiredAdminContext(context)) {
    const skipped = unavailable<null>("Selecciona organization y shop para operar pagos.");
    return {
      affiliations: unavailable("Selecciona organization y shop para operar pagos."),
      cardLookup: skipped,
      context,
      paymentSystems: unavailable("Selecciona organization y shop para operar pagos."),
      rules: unavailable("Selecciona organization y shop para operar pagos."),
      transactions: unavailable("Selecciona organization y shop para consultar operaciones."),
      transactionEvidence: skipped,
    };
  }

  if (!capabilities.canViewPayments) {
    const skipped = unavailable<null>("Falta permiso admin:payments:view.");
    return {
      affiliations: unavailable("Falta permiso admin:payments:view."),
      cardLookup: skipped,
      context,
      paymentSystems: unavailable("Falta permiso admin:payments:view."),
      rules: unavailable("Falta permiso admin:payments:view."),
      transactions: unavailable("Falta permiso admin:payments:view."),
      transactionEvidence: skipped,
    };
  }

  const includeInactive = filters.includeInactive === "true" ? "true" : "false";
  const cardBin = filters.cardBin?.trim();
  const shouldLoadTransactions = filters.tab === "resumen" || filters.tab === "operaciones" || filters.tab === "reembolsos" || !filters.tab;
  const transactionLimit = Number(filters.transactionLimit);
  const transactionOffset = Number(filters.transactionOffset);
  const selectedTransactionId = filters.transactionId?.trim();
  const [paymentSystems, affiliations, rules, cardLookup, transactions, transactionEvidence] = await Promise.all([
    requestBff<PaymentSystemAdminRecord[]>(scopedPath("/admin/payments/payment-systems", context, { includeInactive }), {
      context,
      parse: normalizePaymentSystems,
    }),
    requestBff<PaymentAffiliationAdminRecord[]>(scopedPath("/admin/payments/affiliations", context, { includeInactive }), {
      context,
      parse: normalizeAffiliations,
    }),
    requestBff<PaymentRuleAdminRecord[]>(scopedPath("/admin/payments/rules", context, { includeInactive }), {
      context,
      parse: normalizeRules,
    }),
    cardBin
      ? requestBff<PaymentsCardLookupResult>(scopedPath("/admin/payments/card-lookup", context), {
          context,
          init: {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ bin: cardBin }),
          },
          parse: normalizeCardLookup,
        })
      : Promise.resolve({ ok: true as const, data: null, status: 200, correlationId: "payments-admin-no-card-lookup" }),
    shouldLoadTransactions && capabilities.canViewOperations
      ? requestBff<PaymentOperationsAdminPage>(scopedPath("/admin/payments/transactions", context, {
          status: filters.transactionStatus,
          referenceId: filters.transactionReference,
          limit: Number.isInteger(transactionLimit) && transactionLimit > 0 ? String(Math.min(transactionLimit, 100)) : "25",
          offset: Number.isInteger(transactionOffset) && transactionOffset >= 0 ? String(transactionOffset) : "0",
        }), {
          context,
          parse: normalizePaymentOperationsPage,
        })
      : Promise.resolve(unavailable<PaymentOperationsAdminPage>(
          shouldLoadTransactions
            ? "Falta permiso payments.transactions.read para consultar operaciones."
            : "La bandeja de operaciones no se ha solicitado.",
        )),
    selectedTransactionId && capabilities.canViewOperations
      ? requestBff<PaymentTransactionEvidence>(
          scopedPath(`/admin/payments/transactions/${encodeURIComponent(selectedTransactionId)}`, context),
          { context, parse: normalizePaymentTransactionEvidence },
        )
      : Promise.resolve({ ok: true as const, data: null, status: 200, correlationId: "payments-admin-no-transaction-evidence" }),
  ]);

  return {
    affiliations,
    cardLookup,
    context,
    paymentSystems,
    rules,
    transactions,
    transactionEvidence,
  };
}
