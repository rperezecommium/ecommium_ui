import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminSession } from "../../shared/auth/session";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";

export type PaymentsAdminTab = "facturas" | "metodos" | "afiliaciones" | "reglas" | "diagnostico";

export type PaymentsAdminFilters = {
  tab?: PaymentsAdminTab;
  includeInactive?: string;
  cardBin?: string;
  notice?: string;
};

export type PaymentsAdminCapabilities = {
  canManagePayments: boolean;
  canViewPayments: boolean;
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

export type PaymentsAdminData = {
  affiliations: BffResult<PaymentAffiliationAdminRecord[]>;
  cardLookup: BffResult<PaymentsCardLookupResult | null>;
  context: AdminContext;
  paymentSystems: BffResult<PaymentSystemAdminRecord[]>;
  rules: BffResult<PaymentRuleAdminRecord[]>;
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
  return {
    canManagePayments,
    canViewPayments: canManagePayments || hasPermission(session, ["payments.read", "admin:payments:view"]),
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
    };
  }

  const includeInactive = filters.includeInactive === "true" ? "true" : "false";
  const cardBin = filters.cardBin?.trim();
  const [paymentSystems, affiliations, rules, cardLookup] = await Promise.all([
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
  ]);

  return {
    affiliations,
    cardLookup,
    context,
    paymentSystems,
    rules,
  };
}
