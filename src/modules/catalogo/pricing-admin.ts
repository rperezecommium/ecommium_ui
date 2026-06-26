import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";
import type { ProductLookupOption, ProductTaxLookupOption } from "./product-editor-types";

export type PricingAdminTab =
  | "summary"
  | "taxes"
  | "tables"
  | "references"
  | "rules"
  | "fixed"
  | "computed"
  | "computed-auto"
  | "pipeline";

export type PricingRecord = Record<string, string | number | boolean | null | undefined>;

export type PricingAdminResult<T> = {
  source: "bff" | "unavailable";
  data: T;
  message?: string;
  failedEndpoint?: string;
  status?: number;
  permission?: "pricing.admin.read" | "pricing.admin.write";
};

export type PricingGovernanceData = {
  tab: PricingAdminTab;
  config: PricingAdminResult<PricingRecord>;
  migration: PricingAdminResult<PricingRecord>;
  taxes: PricingAdminResult<PricingRecord[]>;
  priceTables: PricingAdminResult<PricingRecord[]>;
  customerGroups: PricingAdminResult<PricingRecord[]>;
  channels: PricingAdminResult<PricingRecord[]>;
  tradePolicies: PricingAdminResult<PricingRecord[]>;
  countries: PricingAdminResult<PricingRecord[]>;
  selectedPriceTable: PricingAdminResult<PricingRecord>;
  rules: PricingAdminResult<PricingRecord[]>;
  fixedPrices: PricingAdminResult<PricingRecord[]>;
  computed: PricingAdminResult<PricingRecord>;
  computedBatch: PricingAdminResult<PricingRecord[]>;
  computedAuto: PricingAdminResult<PricingRecord>;
  computedAutoBatch: PricingAdminResult<PricingRecord[]>;
  pipeline: PricingAdminResult<PricingRecord[]>;
  pipelineTable: PricingAdminResult<PricingRecord>;
};

export type PricingGovernanceFilters = {
  tab: PricingAdminTab;
  priceTableId?: string;
  itemId?: string;
  q?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function scalar(value: unknown): string | number | boolean | null | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    typeof value === "undefined"
  ) {
    return value;
  }

  return undefined;
}

function listItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const items = record.items ?? record.data ?? record.results ?? record.taxes ?? record.priceTables ?? record.rules ?? record.prices ?? record.pipeline ?? value;
  return Array.isArray(items) ? items : [];
}

function normalizeRecord(value: unknown): PricingRecord {
  const record = asRecord(value);
  const normalized: PricingRecord = {};

  for (const [key, item] of Object.entries(record)) {
    normalized[key] = scalar(item) ?? (Array.isArray(item) ? `array(${item.length})` : undefined);
  }

  return normalized;
}

function normalizeList(value: unknown): PricingRecord[] {
  return listItems(value).map(normalizeRecord);
}

function optionalString(value: PricingRecord[string]) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: PricingRecord[string]) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: PricingRecord[string]) {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeCalculationType(value: PricingRecord[string]) {
  const calculationType = optionalString(value)?.toUpperCase();
  return calculationType === "PERCENTAGE" || calculationType === "FIXED" ? calculationType : undefined;
}

function inferCalculationType(record: PricingRecord) {
  return (
    normalizeCalculationType(record.calculationType) ??
    (typeof optionalNumber(record.rate) === "number" ? "PERCENTAGE" : undefined) ??
    (typeof optionalNumber(record.amountMinor) === "number" ? "FIXED" : undefined)
  );
}

function taxSignature(tax: ProductTaxLookupOption) {
  return [
    tax.taxCode,
    tax.calculationType,
    tax.rate ?? "",
    tax.amountMinor ?? "",
    tax.isCompound ?? false,
  ].join(":");
}

function uniqueTaxes(taxes: ProductTaxLookupOption[]) {
  const bySignature = new Map<string, ProductTaxLookupOption>();

  for (const tax of taxes) {
    const signature = taxSignature(tax);
    if (!bySignature.has(signature)) {
      bySignature.set(signature, tax);
    }
  }

  return Array.from(bySignature.values());
}

function makeScopedParams(context: AdminContext, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  if (context.organizationId) {
    params.set("organizationId", context.organizationId);
  }
  if (context.shopId) {
    params.set("shopId", context.shopId);
  }
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value?.trim()) {
      params.set(key, value.trim());
    }
  }

  return params;
}

function unavailable<T>(
  endpoint: string,
  fallback: T,
  result: Extract<BffResult<T>, { ok: false }>,
  permission: "pricing.admin.read" | "pricing.admin.write" = "pricing.admin.read",
): PricingAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: result.status === 403
      ? `Falta permiso ${permission}.`
      : result.error,
    failedEndpoint: endpoint,
    status: result.status,
    permission: result.status === 403 ? permission : undefined,
  };
}

async function getPricing<T>(
  context: AdminContext,
  path: string,
  fallback: T,
  parse: (value: unknown) => T,
): Promise<PricingAdminResult<T>> {
  const result = await requestBff(path, { context, parse });

  if (!result.ok) {
    return unavailable(path, fallback, result);
  }

  return { source: "bff", data: result.data };
}

async function postPricing<T>(
  context: AdminContext,
  path: string,
  fallback: T,
  body: Record<string, unknown>,
  parse: (value: unknown) => T,
): Promise<PricingAdminResult<T>> {
  const result = await requestBff(path, {
    context,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    parse,
  });

  if (!result.ok) {
    return unavailable(path, fallback, result);
  }

  return { source: "bff", data: result.data };
}

export async function getPricingTaxes(context: AdminContext): Promise<PricingAdminResult<PricingRecord[]>> {
  const endpoint = `/admin/pricing/taxes?${makeScopedParams(context).toString()}`;
  return getPricing(context, endpoint, [], normalizeList);
}

export async function getPricingPriceTables(context: AdminContext): Promise<PricingAdminResult<PricingRecord[]>> {
  const endpoint = `/admin/pricing/price-tables?${makeScopedParams(context).toString()}`;
  return getPricing(context, endpoint, [], normalizeList);
}

export async function getPricingReferenceData(
  context: AdminContext,
  kind: "customer-groups" | "channels" | "trade-policies" | "countries",
): Promise<PricingAdminResult<PricingRecord[]>> {
  const endpoint = `/admin/pricing/${kind}?${makeScopedParams(context).toString()}`;
  return getPricing(context, endpoint, [], normalizeList);
}

export async function getPricingEditorLookups(context: AdminContext) {
  const [taxes, priceTables, customerGroups, channels, tradePolicies, countries] = await Promise.all([
    getPricingTaxes(context),
    getPricingPriceTables(context),
    getPricingReferenceData(context, "customer-groups"),
    getPricingReferenceData(context, "channels"),
    getPricingReferenceData(context, "trade-policies"),
    getPricingReferenceData(context, "countries"),
  ]);
  const warnings: string[] = [];

  if (taxes.source === "unavailable") {
    warnings.push(`Pricing taxes: ${taxes.message}`);
  }
  if (priceTables.source === "unavailable") {
    warnings.push(`Pricing price tables: ${priceTables.message}`);
  }
  if (customerGroups.source === "unavailable") {
    warnings.push(`Pricing customer groups: ${customerGroups.message}`);
  }
  if (channels.source === "unavailable") {
    warnings.push(`Pricing channels: ${channels.message}`);
  }
  if (tradePolicies.source === "unavailable") {
    warnings.push(`Pricing trade policies: ${tradePolicies.message}`);
  }
  if (countries.source === "unavailable") {
    warnings.push(`Pricing countries: ${countries.message}`);
  }

  return {
    taxes: uniqueTaxes(taxes.data.map(toTaxLookupOption).filter((option): option is ProductTaxLookupOption => Boolean(option))),
    priceTables: priceTables.data.map(toLookupOption).filter((option): option is ProductLookupOption => Boolean(option)),
    customerGroups: customerGroups.data.map(toLookupOption).filter((option): option is ProductLookupOption => Boolean(option)),
    channels: channels.data.map(toLookupOption).filter((option): option is ProductLookupOption => Boolean(option)),
    tradePolicies: tradePolicies.data.map(toLookupOption).filter((option): option is ProductLookupOption => Boolean(option)),
    countries: countries.data.map(toLookupOption).filter((option): option is ProductLookupOption => Boolean(option)),
    warnings,
  };
}

function toTaxLookupOption(record: PricingRecord): ProductTaxLookupOption | null {
  const taxCode = optionalString(record.taxCode ?? record.code);
  const calculationType = inferCalculationType(record);
  if (!taxCode || !calculationType) {
    return null;
  }

  const taxId = optionalString(record.taxId ?? record.id);
  const rate = optionalNumber(record.rate);
  const amountMinor = optionalNumber(record.amountMinor);
  const rateLabel = calculationType === "PERCENTAGE" && typeof rate === "number"
    ? ` (${Math.round(rate * 10000) / 100}%)`
    : "";
  const amountLabel = calculationType === "FIXED" && typeof amountMinor === "number"
    ? ` (${amountMinor})`
    : "";
  const label = `${optionalString(record.name ?? record.label ?? record.title) ?? taxCode}${rateLabel}${amountLabel}`;

  return {
    id: taxId ?? [taxCode, calculationType, rate ?? "", amountMinor ?? ""].join(":"),
    taxId,
    taxCode,
    name: optionalString(record.name) ?? null,
    label,
    calculationType,
    rate: rate ?? null,
    amountMinor: amountMinor ?? null,
    isCompound: optionalBoolean(record.isCompound) ?? false,
    isActive: optionalBoolean(record.isActive) ?? true,
    validFrom: optionalString(record.validFrom) ?? null,
    validUntil: optionalString(record.validUntil) ?? null,
  };
}

function toLookupOption(record: PricingRecord): ProductLookupOption | null {
  const id = String(record.taxCode ?? record.code ?? record.taxId ?? record.priceTableId ?? record.id ?? "");
  const label = String(record.name ?? record.label ?? record.title ?? record.taxCode ?? record.code ?? record.priceTableId ?? id);

  return id ? { id, label } : null;
}

export async function getPricingGovernanceData(
  context: AdminContext,
  filters: PricingGovernanceFilters,
): Promise<PricingGovernanceData> {
  const scoped = (extra?: Record<string, string | undefined>) => makeScopedParams(context, extra).toString();
  const priceTableId = filters.priceTableId ?? "";
  const itemId = filters.itemId ?? "";

  const emptyRecord = { source: "bff" as const, data: {} };
  const emptyList = { source: "bff" as const, data: [] };

  const [
    config,
    migration,
    taxes,
    priceTables,
    customerGroups,
    channels,
    tradePolicies,
    countries,
    selectedPriceTable,
    rules,
    fixedPrices,
    computed,
    computedBatch,
    computedAuto,
    computedAutoBatch,
    pipeline,
    pipelineTable,
  ] = await Promise.all([
    getPricing(context, `/admin/pricing/config?${scoped()}`, {}, normalizeRecord),
    getPricing(context, `/admin/pricing/migration?${scoped()}`, {}, normalizeRecord),
    getPricingTaxes(context),
    getPricingPriceTables(context),
    getPricingReferenceData(context, "customer-groups"),
    getPricingReferenceData(context, "channels"),
    getPricingReferenceData(context, "trade-policies"),
    getPricingReferenceData(context, "countries"),
    priceTableId
      ? getPricing(context, `/admin/pricing/price-tables/${encodeURIComponent(priceTableId)}?${scoped()}`, {}, normalizeRecord)
      : Promise.resolve(emptyRecord),
    priceTableId
      ? getPricing(context, `/admin/pricing/price-tables/${encodeURIComponent(priceTableId)}/rules?${scoped()}`, [], normalizeList)
      : Promise.resolve(emptyList),
    itemId
      ? getPricing(context, `/admin/pricing/prices/${encodeURIComponent(itemId)}/fixed?${scoped()}`, [], normalizeList)
      : Promise.resolve(emptyList),
    itemId && priceTableId
      ? getPricing(context, `/admin/pricing/prices/${encodeURIComponent(itemId)}/computed/${encodeURIComponent(priceTableId)}?${scoped()}`, {}, normalizeRecord)
      : Promise.resolve(emptyRecord),
    priceTableId && itemId
      ? postPricing(context, `/admin/pricing/prices/computed/${encodeURIComponent(priceTableId)}/resolve-batch?${scoped()}`, [], { itemIds: [itemId] }, normalizeList)
      : Promise.resolve(emptyList),
    itemId
      ? getPricing(context, `/admin/pricing/prices/${encodeURIComponent(itemId)}/computed-auto?${scoped()}`, {}, normalizeRecord)
      : Promise.resolve(emptyRecord),
    itemId
      ? postPricing(context, `/admin/pricing/prices/computed-auto/resolve-batch?${scoped()}`, [], { itemIds: [itemId] }, normalizeList)
      : Promise.resolve(emptyList),
    getPricing(context, `/admin/pricing/pipeline/catalog?${scoped()}`, [], normalizeList),
    priceTableId
      ? getPricing(context, `/admin/pricing/pipeline/catalog/${encodeURIComponent(priceTableId)}?${scoped()}`, {}, normalizeRecord)
      : Promise.resolve(emptyRecord),
  ]);

  return {
    tab: filters.tab,
    config,
    migration,
    taxes,
    priceTables,
    customerGroups,
    channels,
    tradePolicies,
    countries,
    selectedPriceTable,
    rules,
    fixedPrices,
    computed,
    computedBatch,
    computedAuto,
    computedAutoBatch,
    pipeline,
    pipelineTable,
  };
}

export async function mutatePricing(
  context: AdminContext,
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  payload?: Record<string, unknown>,
) {
  const result = await requestBff(path, {
    context,
    init: {
      method,
      headers: payload ? { "content-type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    },
    parse: normalizeRecord,
  });

  return result;
}
