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
  shopAlias?: string;
  shopGroupId?: string;
  primaryDomain?: string;
  status?: string;
  locale?: string;
  currency?: string;
  country?: string;
  timezone?: string;
};

export type CurrentShopOption = ShopOption & {
  isCurrent: boolean;
};

export type OrganizationShopDirectory = {
  organizations: OrganizationOption[];
  source: "bff" | "unavailable";
  failedEndpoint?: string;
  loadWarnings?: string[];
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
  shopAlias?: unknown;
  shopGroupId?: unknown;
  groupId?: unknown;
  name?: unknown;
  displayName?: unknown;
  primaryDomain?: unknown;
  status?: unknown;
  effectiveSettings?: unknown;
  settingsOverride?: unknown;
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

function parseListItems(value: unknown): unknown[] {
  const record = asRecord(value);
  return asArray(record.items ?? value);
}

function normalizeShop(raw: unknown, organizationId: string): ShopOption | null {
  const shop = raw as RawShop;
  const id = asString(shop.id) ?? asString(shop.shopId);
  const effectiveSettings = asRecord(shop.effectiveSettings);
  const settingsOverride = asRecord(shop.settingsOverride);

  if (!id) {
    return null;
  }

  return {
    id,
    name: asString(shop.name) ?? asString(shop.displayName) ?? id,
    organizationId: asString(shop.organizationId) ?? organizationId,
    shopAlias: asString(shop.shopAlias),
    shopGroupId: asString(shop.shopGroupId) ?? asString(shop.groupId),
    primaryDomain: asString(shop.primaryDomain),
    status: asString(shop.status),
    locale:
      asString(shop.locale) ??
      asString(shop.defaultLocale) ??
      asString(effectiveSettings.defaultLocale) ??
      asString(settingsOverride.defaultLocale),
    currency:
      asString(shop.currency) ??
      asString(shop.defaultCurrency) ??
      asString(effectiveSettings.defaultCurrency) ??
      asString(settingsOverride.defaultCurrency),
    country:
      asString(shop.country) ??
      asString(shop.defaultCountry) ??
      asString(effectiveSettings.defaultCountry) ??
      asString(settingsOverride.defaultCountry),
    timezone:
      asString(shop.timezone) ??
      asString(effectiveSettings.timezone) ??
      asString(settingsOverride.timezone),
  };
}

export function isCurrentShop(shop: ShopOption, context: AdminContext) {
  return (
    shop.id === context.shopId ||
    (!context.shopId && Boolean(shop.shopAlias) && shop.shopAlias === context.shopAlias)
  );
}

export function withCurrentShopState(shops: ShopOption[], context: AdminContext): CurrentShopOption[] {
  return shops.map((shop) => ({
    ...shop,
    isCurrent: isCurrentShop(shop, context),
  }));
}

export function shopToContext(
  shop: ShopOption,
  context: AdminContext,
): AdminContext {
  return {
    organizationId: shop.organizationId || context.organizationId,
    shopId: shop.id,
    shopAlias: shop.shopAlias ?? context.shopAlias,
    shopName: shop.name,
    primaryDomain: shop.primaryDomain ?? "",
    shopStatus: shop.status ?? "",
    locale: shop.locale ?? context.locale,
    currency: shop.currency ?? context.currency,
    country: shop.country ?? context.country,
    channel: context.channel,
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

function parseOrganizationList(value: unknown): OrganizationOption[] {
  return parseListItems(value)
    .map(normalizeOrganization)
    .filter((organization): organization is OrganizationOption => Boolean(organization));
}

function parseShopGroupList(value: unknown, organizationId: string): ShopGroupOption[] {
  return parseListItems(value)
    .map((group) => normalizeShopGroup(group, organizationId))
    .filter((group): group is ShopGroupOption => Boolean(group));
}

function parseShopList(value: unknown, organizationId: string): ShopOption[] {
  return parseListItems(value)
    .map((shop) => normalizeShop(shop, organizationId))
    .filter((shop): shop is ShopOption => Boolean(shop));
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
  const customized = typeof record.customized === "boolean" ? record.customized : undefined;
  const normalizedOwner =
    owner === "ORGANIZATION"
      ? "Organization"
      : owner === "SHOP_GROUP"
        ? "ShopGroup"
        : owner === "SHOP"
          ? "Shop"
          : owner;

  return {
    key,
    label,
    effectiveValue: formatValue(effective),
    inheritedValue: inherited === undefined ? undefined : formatValue(inherited),
    overrideValue: override === undefined ? undefined : formatValue(override),
    status:
      customized === true
        ? "customized"
        : status === "customized"
          ? "customized"
          : status === "inherited" || normalizedOwner === "Organization" || normalizedOwner === "ShopGroup"
            ? "inherited"
            : "not_configured",
    owner:
      normalizedOwner === "Organization" ||
      normalizedOwner === "ShopGroup" ||
      normalizedOwner === "Shop"
        ? normalizedOwner
        : "Unknown",
  };
}

function parseSettingsInheritance(value: unknown): ShopSettingsInheritance {
  const record = asRecord(value);
  const settingsRecord = asRecord(record.settings ?? record.settingsInheritance ?? record.inheritance ?? value);
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
  const organizationsEndpoint = "/admin/organizations-shops/organizations?limit=100&offset=0";
  const organizationsResult = await requestBff(organizationsEndpoint, {
    parse: parseOrganizationList,
  });

  if (!organizationsResult.ok) {
    return {
      organizations: [],
      failedEndpoint: organizationsEndpoint,
      source: "unavailable",
      message: organizationsResult.error,
      correlationId: organizationsResult.correlationId,
    };
  }

  const loadWarnings: string[] = [];
  const organizations = await Promise.all(
    organizationsResult.data.map(async (organization) => {
      const params = new URLSearchParams({
        organizationId: organization.id,
        limit: "100",
        offset: "0",
      });
      const shopGroupsEndpoint = `/admin/organizations-shops/shop-groups?${params.toString()}`;
      const shopsEndpoint = `/admin/organizations-shops/shops?${params.toString()}`;
      const [shopGroupsResult, shopsResult] = await Promise.all([
        requestBff(shopGroupsEndpoint, {
          parse: (value) => parseShopGroupList(value, organization.id),
        }),
        requestBff(shopsEndpoint, {
          parse: (value) => parseShopList(value, organization.id),
        }),
      ]);

      if (!shopGroupsResult.ok) {
        loadWarnings.push(`${shopGroupsEndpoint}: ${shopGroupsResult.error}`);
      }

      if (!shopsResult.ok) {
        loadWarnings.push(`${shopsEndpoint}: ${shopsResult.error}`);
      }

      return {
        ...organization,
        shopGroups: shopGroupsResult.ok ? shopGroupsResult.data : [],
        shops: shopsResult.ok ? shopsResult.data : [],
      };
    }),
  );

  return {
    organizations,
    loadWarnings,
    source: "bff",
    correlationId: organizationsResult.correlationId,
  };
}

export async function resolveShopContext(
  organizationId: string,
  shopAlias: string,
): Promise<{ ok: true; shop: ShopOption; correlationId: string } | { ok: false; error: string; correlationId?: string }> {
  const params = new URLSearchParams({
    organizationId,
    shopAlias,
  });
  const result = await requestBff(`/admin/organizations-shops/shops/context/resolve?${params.toString()}`, {
    parse: (value) => normalizeShop(value, organizationId),
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      correlationId: result.correlationId,
    };
  }

  if (!result.data) {
    return {
      ok: false,
      error: "Tienda no encontrada para esa Organization.",
      correlationId: result.correlationId,
    };
  }

  return {
    ok: true,
    shop: result.data,
    correlationId: result.correlationId,
  };
}

export async function resolveShopContextById(
  organizationId: string,
  shopId: string,
): Promise<{ ok: true; shop: ShopOption; correlationId: string } | { ok: false; error: string; correlationId?: string }> {
  const params = new URLSearchParams({
    organizationId,
    shopId,
  });
  const result = await requestBff(`/admin/organizations-shops/shops/context/resolve?${params.toString()}`, {
    parse: (value) => normalizeShop(value, organizationId),
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      correlationId: result.correlationId,
    };
  }

  if (!result.data) {
    return {
      ok: false,
      error: "Tienda no encontrada para esa Organization.",
      correlationId: result.correlationId,
    };
  }

  return {
    ok: true,
    shop: result.data,
    correlationId: result.correlationId,
  };
}

export async function getShopSettingsInheritance(
  context: AdminContext,
): Promise<ShopSettingsInheritance> {
  if (!context.organizationId || (!context.shopId && !context.shopAlias)) {
    return fallbackSettings(context, "Define organizationId y shopId o shopAlias para consultar herencia.");
  }

  const params = new URLSearchParams({
    organizationId: context.organizationId,
  });
  if (context.shopId) {
    params.set("shopId", context.shopId);
  } else {
    params.set("shopAlias", context.shopAlias);
  }

  const result = await requestBff(`/admin/organizations-shops/shops/context/resolve?${params.toString()}`, {
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
