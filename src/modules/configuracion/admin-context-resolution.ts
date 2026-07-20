import { requestBff } from "../../shared/bff/client";
import {
  clearAdminContext,
  getAdminContext,
  pendingAdminContextShopId,
  saveAdminContext,
  type AdminContext,
} from "../../shared/config/admin-context";
import { defaultAdminContext } from "../../shared/config/env";

export type AvailableAdminContext = {
  organizationId: string;
  organizationName: string;
  shopId: string;
  shopName: string;
  shopAlias?: string;
  primaryDomain?: string;
  status?: string;
  locale?: string;
  currency?: string;
  country?: string;
};

export type ContextResolutionDecision =
  | {
      kind: "resolved";
      context: AvailableAdminContext;
      redirectTo: string;
    }
  | {
      kind: "select";
      contexts: AvailableAdminContext[];
      redirectTo: string;
    }
  | {
      kind: "empty";
      redirectTo: string;
    }
  | {
      kind: "unavailable";
      error: string;
      redirectTo: string;
    };

type RawOrganization = {
  id?: unknown;
  organizationId?: unknown;
  name?: unknown;
  displayName?: unknown;
};

type RawShop = {
  id?: unknown;
  shopId?: unknown;
  name?: unknown;
  displayName?: unknown;
  shopAlias?: unknown;
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
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function parseListItems(value: unknown): unknown[] {
  const record = asRecord(value);
  return asArray(record.items ?? record.data ?? value);
}

function authHeader(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

function normalizeOrganization(raw: unknown) {
  const organization = raw as RawOrganization;
  const organizationId = asString(organization.organizationId) ?? asString(organization.id);

  if (!organizationId) {
    return null;
  }

  return {
    organizationId,
    organizationName: asString(organization.name) ?? asString(organization.displayName) ?? organizationId,
  };
}

function normalizeShop(raw: unknown, organization: { organizationId: string; organizationName: string }): AvailableAdminContext | null {
  const shop = raw as RawShop;
  const effectiveSettings = asRecord(shop.effectiveSettings);
  const settingsOverride = asRecord(shop.settingsOverride);
  const shopId = asString(shop.shopId) ?? asString(shop.id);

  if (!shopId || shopId === pendingAdminContextShopId) {
    return null;
  }

  return {
    organizationId: organization.organizationId,
    organizationName: organization.organizationName,
    shopId,
    shopName: asString(shop.name) ?? asString(shop.displayName) ?? shopId,
    shopAlias: asString(shop.shopAlias),
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
  };
}

function toAdminContext(context: AvailableAdminContext, current: AdminContext): AdminContext {
  return {
    organizationId: context.organizationId,
    shopId: context.shopId,
    shopAlias: context.shopAlias ?? "",
    shopName: context.shopName,
    primaryDomain: context.primaryDomain ?? "",
    shopStatus: context.status ?? "",
    locale: context.locale ?? current.locale ?? defaultAdminContext.locale,
    currency: context.currency ?? current.currency ?? defaultAdminContext.currency,
    country: context.country ?? current.country ?? defaultAdminContext.country,
    channel: current.channel ?? defaultAdminContext.channel,
  };
}

export function findCachedAvailableContext(
  cached: AdminContext,
  contexts: AvailableAdminContext[],
) {
  if (!cached.organizationId || !cached.shopId || cached.shopId === pendingAdminContextShopId) {
    return null;
  }

  return (
    contexts.find(
      (context) =>
        context.organizationId === cached.organizationId &&
        context.shopId === cached.shopId,
    ) ?? null
  );
}

export function decideAdminContextResolution(
  cached: AdminContext,
  contexts: AvailableAdminContext[],
): ContextResolutionDecision {
  const cachedContext = findCachedAvailableContext(cached, contexts);

  if (cachedContext) {
    return {
      kind: "resolved",
      context: cachedContext,
      redirectTo: "/admin/configuracion",
    };
  }

  if (contexts.length === 1) {
    return {
      kind: "resolved",
      context: contexts[0],
      redirectTo: "/admin/configuracion",
    };
  }

  if (contexts.length > 1) {
    return {
      kind: "select",
      contexts,
      redirectTo: "/admin/configuracion/contexto?contextNotice=Selecciona%20la%20tienda%20con%20la%20que%20quieres%20operar.",
    };
  }

  return {
    kind: "empty",
    redirectTo: "/admin/configuracion/contexto?contextError=No%20hay%20tiendas%20disponibles%20para%20este%20Admin.",
  };
}

export async function loadAvailableAdminContexts(accessToken: string): Promise<AvailableAdminContext[]> {
  const organizationsResult = await requestBff("/admin/organizations-shops/organizations?limit=100&offset=0", {
    withAuth: false,
    init: {
      headers: authHeader(accessToken),
    },
    parse: (value) => parseListItems(value).map(normalizeOrganization).filter(Boolean) as Array<{
      organizationId: string;
      organizationName: string;
    }>,
  });

  if (!organizationsResult.ok) {
    throw new Error(organizationsResult.error);
  }

  const groups = await Promise.all(
    organizationsResult.data.map(async (organization) => {
      const params = new URLSearchParams({
        organizationId: organization.organizationId,
        status: "ACTIVE",
        limit: "100",
        offset: "0",
      });
      const result = await requestBff(`/admin/organizations-shops/shops?${params.toString()}`, {
        withAuth: false,
        init: {
          headers: authHeader(accessToken),
        },
        parse: (value) =>
          parseListItems(value)
            .map((shop) => normalizeShop(shop, organization))
            .filter(Boolean) as AvailableAdminContext[],
      });

      return result.ok ? result.data : [];
    }),
  );

  return groups.flat();
}

export async function resolveAdminContextAfterLogin(accessToken: string): Promise<ContextResolutionDecision> {
  const cached = await getAdminContext();

  try {
    const availableContexts = await loadAvailableAdminContexts(accessToken);
    const decision = decideAdminContextResolution(cached, availableContexts);

    if (decision.kind === "resolved") {
      await saveAdminContext(toAdminContext(decision.context, cached));
    } else if (cached.organizationId || cached.shopId) {
      await clearAdminContext();
    }

    return decision;
  } catch (error) {
    return {
      kind: "unavailable",
      error: error instanceof Error ? error.message : "No se pudo resolver contexto Admin.",
      redirectTo: "/admin/configuracion/contexto?contextError=No%20se%20pudo%20resolver%20el%20contexto%20Admin.",
    };
  }
}
