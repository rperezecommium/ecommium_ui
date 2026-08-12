export type StorefrontRuntimeContext = {
  organizationId: string;
  shopId: string;
  shopAlias: string;
  locale: string;
  currency: string;
  country: string;
  channel: string;
};

export type StorefrontRuntimeContextHints = Partial<
  Pick<StorefrontRuntimeContext, "organizationId" | "shopId" | "shopAlias">
> &
  Pick<StorefrontRuntimeContext, "locale" | "currency" | "country" | "channel">;

type Environment = Record<string, string | undefined>;

const fixtureContext: StorefrontRuntimeContext = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  shopId: "22222222-2222-4222-8222-222222222222",
  shopAlias: "tienda-barcelona",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

export class StorefrontConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorefrontConfigurationError";
  }
}

function value(environment: Environment, name: string) {
  return environment[name]?.trim() ?? "";
}

function fixtureMode(environment: Environment) {
  return environment.NODE_ENV === "development" && value(environment, "ECOMMIUM_UI_ALLOW_STOREFRONT_FIXTURES") === "true";
}

function isProduction(environment: Environment) {
  return environment.NODE_ENV === "production";
}

export function getStorefrontRuntimeContextHints(
  environment: Environment = process.env,
): StorefrontRuntimeContextHints {
  if (fixtureMode(environment)) {
    return fixtureContext;
  }

  const organizationId = value(environment, "ECOMMIUM_STOREFRONT_ORGANIZATION_ID");
  const shopId = value(environment, "ECOMMIUM_STOREFRONT_SHOP_ID");

  return {
    ...(organizationId ? { organizationId } : {}),
    ...(shopId ? { shopId } : {}),
    shopAlias: value(environment, "ECOMMIUM_STOREFRONT_SHOP_ALIAS"),
    locale: value(environment, "ECOMMIUM_STOREFRONT_LOCALE") || "es-ES",
    currency: value(environment, "ECOMMIUM_STOREFRONT_CURRENCY") || "EUR",
    country: value(environment, "ECOMMIUM_STOREFRONT_COUNTRY") || "ES",
    channel: value(environment, "ECOMMIUM_STOREFRONT_CHANNEL") || "web",
  };
}

export function getStorefrontRuntimeContext(
  environment: Environment = process.env,
): StorefrontRuntimeContext {
  const hints = getStorefrontRuntimeContextHints(environment);
  if (!hints.organizationId || !hints.shopId) {
    throw new StorefrontConfigurationError(
      "El contexto Storefront todavía no ha sido resuelto por el BFF.",
    );
  }

  return {
    ...hints,
    organizationId: hints.organizationId,
    shopId: hints.shopId,
    shopAlias: hints.shopAlias ?? "",
  };
}

export function getStorefrontBffBaseUrl(environment: Environment = process.env) {
  const configuredUrl = value(environment, "ECOMMIUM_STOREFRONT_BFF_BASE_URL") ||
    (!isProduction(environment) ? "http://localhost:3025/api/v1" : "");

  if (!configuredUrl) {
    throw new StorefrontConfigurationError(
      "Configuración Storefront incompleta: falta ECOMMIUM_STOREFRONT_BFF_BASE_URL.",
    );
  }

  try {
    const url = new URL(configuredUrl);
    if (url.username || url.password || (isProduction(environment) && url.protocol !== "https:")) {
      throw new Error("unsafe URL");
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new StorefrontConfigurationError(
      "ECOMMIUM_STOREFRONT_BFF_BASE_URL debe ser una URL válida y HTTPS fuera de desarrollo.",
    );
  }
}
