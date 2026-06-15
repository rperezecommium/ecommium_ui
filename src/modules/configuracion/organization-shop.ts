import type { AdminContext } from "../../shared/config/admin-context";
import { requestBff } from "../../shared/bff/client";

export type OrganizationOption = {
  id: string;
  name: string;
  shopGroups: ShopGroupOption[];
  shops: ShopOption[];
};

export type ShopGroupOption = {
  id: string;
  name: string;
  organizationId: string;
};

export type ShopOption = {
  id: string;
  name: string;
  organizationId: string;
  shopGroupId?: string;
  locale?: string;
  currency?: string;
  country?: string;
  timezone?: string;
};

export type OrganizationShopDirectory = {
  organizations: OrganizationOption[];
  source: "bff" | "unavailable";
  message?: string;
  correlationId?: string;
};

export type InheritanceStatus = "inherited" | "customized" | "not_configured";

export type InheritableSetting = {
  key: string;
  label: string;
  effectiveValue: string;
  inheritedValue?: string;
  overrideValue?: string;
  status: InheritanceStatus;
  owner: "Organization" | "ShopGroup" | "Shop" | "Unknown";
};

export type ShopSettingsInheritance = {
  settings: InheritableSetting[];
  source: "bff" | "fallback";
  message?: string;
  correlationId?: string;
};

type RawOrganization = {
  id?: unknown;
  organizationId?: unknown;
  name?: unknown;
  displayName?: unknown;
  shopGroups?: unknown;
  groups?: unknown;
  shops?: unknown;
};

type RawShopGroup = {
  id?: unknown;
  shopGroupId?: unknown;
  organizationId?: unknown;
  name?: unknown;
  displayName?: unknown;
};

type RawShop = {
  id?: unknown;
  shopId?: unknown;
  organizationId?: unknown;
  shopGroupId?: unknown;
  groupId?: unknown;
  name?: unknown;
  displayName?: unknown;
  locale?: unknown;
  defaultLocale?: unknown;
  currency?: unknown;
  defaultCurrency?: unknown;
  country?: unknown;
  defaultCountry?: unknown;
  timezone?: unknown;
};

const settingsLabels = [
  { key: "defaultLocale", label: "Idioma por defecto" },
  { key: "defaultCurrency", label: "Moneda por defecto" },
  { key: "defaultCountry", label: "Pais por defecto" },
  { key: "timezone", label: "Zona horaria" },
  { key: "taxDisplayMode", label: "Modo de impuestos" },
  { key: "units.weight", label: "Unidad de peso" },
  { key: "units.dimension", label: "Unidad de dimension" },
  { key: "publicBaseUrl", label: "Dominio publico" },
  { key: "fiscalProfile.legalName", label: "Razon social" },
  { key: "fiscalProfile.taxId", label: "Identificacion fiscal" },
  { key: "fiscalProfile.country", label: "Pais fiscal" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeShop(raw: unknown, organizationId: string): ShopOption | null {
  const shop = raw as RawShop;
  const id = asString(shop.id) ?? asString(shop.shopId);

  if (!id) {
    return null;
  }

  return {
    id,
    name: asString(shop.name) ?? asString(shop.displayName) ?? id,
    organizationId: asString(shop.organizationId) ?? organizationId,
    shopGroupId: asString(shop.shopGroupId) ?? asString(shop.groupId),
    locale: asString(shop.locale) ?? asString(shop.defaultLocale),
    currency: asString(shop.currency) ?? asString(shop.defaultCurrency),
    country: asString(shop.country) ?? asString(shop.defaultCountry),
    timezone: asString(shop.timezone),
  };
}

function normalizeShopGroup(raw: unknown, organizationId: string): ShopGroupOption | null {
  const group = raw as RawShopGroup;
  const id = asString(group.id) ?? asString(group.shopGroupId);

  if (!id) {
    return null;
  }

  return {
    id,
    name: asString(group.name) ?? asString(group.displayName) ?? id,
    organizationId: asString(group.organizationId) ?? organizationId,
  };
}

function normalizeOrganization(raw: unknown): OrganizationOption | null {
  const organization = raw as RawOrganization;
  const id = asString(organization.id) ?? asString(organization.organizationId);

  if (!id) {
    return null;
  }

  const shopGroups = asArray(organization.shopGroups ?? organization.groups)
    .map((group) => normalizeShopGroup(group, id))
    .filter((group): group is ShopGroupOption => Boolean(group));

  const shops = asArray(organization.shops)
    .map((shop) => normalizeShop(shop, id))
    .filter((shop): shop is ShopOption => Boolean(shop));

  return {
    id,
    name: asString(organization.name) ?? asString(organization.displayName) ?? id,
    shopGroups,
    shops,
  };
}

function parseDirectory(value: unknown): OrganizationShopDirectory {
  const record = asRecord(value);
  const organizationsSource = record.organizations ?? record.items ?? value;
  const organizations = asArray(organizationsSource)
    .map(normalizeOrganization)
    .filter((organization): organization is OrganizationOption => Boolean(organization));

  return {
    organizations,
    source: "bff",
  };
}

function readPath(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, record);
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value || "Sin configurar";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "Sin configurar";
}

function parseSetting(key: string, label: string, value: unknown): InheritableSetting {
  const record = asRecord(value);
  const effective = record.effectiveValue ?? record.effective ?? record.value ?? value;
  const inherited = record.inheritedValue ?? record.inherited;
  const override = record.overrideValue ?? record.override;
  const owner = asString(record.owner) ?? asString(record.source) ?? "Unknown";
  const status = asString(record.status) ?? asString(record.mode);

  return {
    key,
    label,
    effectiveValue: formatValue(effective),
    inheritedValue: inherited === undefined ? undefined : formatValue(inherited),
    overrideValue: override === undefined ? undefined : formatValue(override),
    status: status === "customized" ? "customized" : status === "inherited" ? "inherited" : "not_configured",
    owner: owner === "Organization" || owner === "ShopGroup" || owner === "Shop" ? owner : "Unknown",
  };
}

function parseSettingsInheritance(value: unknown): ShopSettingsInheritance {
  const record = asRecord(value);
  const settingsRecord = asRecord(record.settings ?? record.inheritance ?? value);
  const settings = settingsLabels.map((setting) => {
    const raw = readPath(settingsRecord, setting.key);
    return parseSetting(setting.key, setting.label, raw);
  });

  return {
    settings,
    source: "bff",
  };
}

function fallbackSettings(context: AdminContext, message?: string, correlationId?: string): ShopSettingsInheritance {
  return {
    source: "fallback",
    message,
    correlationId,
    settings: [
      {
        key: "defaultLocale",
        label: "Idioma por defecto",
        effectiveValue: context.locale,
        status: context.locale ? "customized" : "not_configured",
        owner: "Shop",
      },
      {
        key: "defaultCurrency",
        label: "Moneda por defecto",
        effectiveValue: context.currency,
        status: context.currency ? "customized" : "not_configured",
        owner: "Shop",
      },
      {
        key: "defaultCountry",
        label: "Pais por defecto",
        effectiveValue: context.country,
        status: context.country ? "customized" : "not_configured",
        owner: "Shop",
      },
      ...settingsLabels.slice(3).map((setting) => ({
        key: setting.key,
        label: setting.label,
        effectiveValue: "Sin configurar",
        status: "not_configured" as const,
        owner: "Unknown" as const,
      })),
    ],
  };
}

export async function getOrganizationShopDirectory(): Promise<OrganizationShopDirectory> {
  const result = await requestBff("/admin/organizations-shops/context", {
    parse: parseDirectory,
  });

  if (!result.ok) {
    return {
      organizations: [],
      source: "unavailable",
      message: result.error,
      correlationId: result.correlationId,
    };
  }

  return {
    ...result.data,
    correlationId: result.correlationId,
  };
}

export async function getShopSettingsInheritance(
  context: AdminContext,
): Promise<ShopSettingsInheritance> {
  if (!context.organizationId || !context.shopId) {
    return fallbackSettings(context, "Define organizationId y shopId para consultar herencia.");
  }

  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });

  const result = await requestBff(`/admin/organizations-shops/settings?${params.toString()}`, {
    context,
    parse: parseSettingsInheritance,
  });

  if (!result.ok) {
    return fallbackSettings(context, result.error, result.correlationId);
  }

  return {
    ...result.data,
    correlationId: result.correlationId,
  };
}
