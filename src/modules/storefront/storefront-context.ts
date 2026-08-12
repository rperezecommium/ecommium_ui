import { headers } from "next/headers";
import { requestStorefrontBff } from "../../shared/bff/storefront-client";
import {
  getStorefrontRuntimeContextHints,
  StorefrontConfigurationError,
  type StorefrontRuntimeContext,
} from "../../shared/config/storefront-env";

export type StorefrontContext = StorefrontRuntimeContext;

const storefrontContextHeader = "x-ecommium-storefront-context";

type ResolveStorefrontContextInput = {
  host?: string | null;
  organizationId?: string | null;
  shopAlias?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseResolvedContext(value: unknown): StorefrontContext {
  const record = asRecord(value);
  const settings = asRecord(record.effectiveSettings);
  const context = {
    organizationId: asString(record.organizationId),
    shopId: asString(record.shopId),
    shopAlias: asString(record.shopAlias),
    locale: asString(record.locale) || asString(settings.defaultLocale) || "es-ES",
    currency: asString(record.currency) || asString(settings.defaultCurrency) || "EUR",
    country: asString(record.country) || asString(settings.defaultCountry) || "ES",
    channel: asString(record.channel) || asString(settings.defaultChannel) || "web",
  };

  if (!context.organizationId || !context.shopId) {
    throw new StorefrontConfigurationError(
      "El BFF devolvió un contexto Storefront incompleto.",
    );
  }

  return context;
}

export function serializeStorefrontContext(context: StorefrontContext) {
  return encodeURIComponent(JSON.stringify(context));
}

function parseSerializedStorefrontContext(value: string | null): StorefrontContext | null {
  if (!value || value.length > 4096) return null;

  try {
    return parseResolvedContext(JSON.parse(decodeURIComponent(value)));
  } catch {
    return null;
  }
}

export async function resolveStorefrontContext(
  input: ResolveStorefrontContextInput = {},
): Promise<StorefrontContext> {
  const hints = getStorefrontRuntimeContextHints();
  const params = new URLSearchParams();
  const host = input.host?.trim();
  const organizationId = input.organizationId?.trim() || hints.organizationId;
  const shopAlias = input.shopAlias?.trim() || hints.shopAlias;

  if (host) params.set("host", host);
  if (organizationId) params.set("organizationId", organizationId);
  if (shopAlias) params.set("shopAlias", shopAlias);

  const result = await requestStorefrontBff<unknown>(
    `/storefront/context/resolve?${params.toString()}`,
    { withAuth: false },
  );
  if (!result.ok) {
    throw new StorefrontConfigurationError(
      "No se pudo resolver una tienda pública para esta dirección.",
    );
  }

  return parseResolvedContext(result.data);
}

export async function getStorefrontContext(): Promise<StorefrontContext> {
  const requestHeaders = await headers();
  const injected = parseSerializedStorefrontContext(
    requestHeaders.get(storefrontContextHeader),
  );
  if (injected) return injected;

  return resolveStorefrontContext({
    host: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  });
}
