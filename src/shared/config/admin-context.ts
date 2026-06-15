import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requestBff } from "../bff/client";
import { defaultAdminContext } from "./env";

export type AdminContext = {
  organizationId: string;
  shopId: string;
  shopAlias: string;
  locale: string;
  currency: string;
  country: string;
  channel: string;
};

const contextCookieName = "ecommium_admin_context";

function parseCookieContext(value: string | undefined): Partial<AdminContext> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Partial<AdminContext>;
    return {
      organizationId: typeof parsed.organizationId === "string" ? parsed.organizationId : undefined,
      shopId: typeof parsed.shopId === "string" ? parsed.shopId : undefined,
      shopAlias: typeof parsed.shopAlias === "string" ? parsed.shopAlias : undefined,
      locale: typeof parsed.locale === "string" ? parsed.locale : undefined,
      currency: typeof parsed.currency === "string" ? parsed.currency : undefined,
      country: typeof parsed.country === "string" ? parsed.country : undefined,
      channel: typeof parsed.channel === "string" ? parsed.channel : undefined,
    };
  } catch {
    return {};
  }
}

export async function getAdminContext(): Promise<AdminContext> {
  const cookieStore = await cookies();
  const cookieContext = parseCookieContext(cookieStore.get(contextCookieName)?.value);

  return {
    organizationId: cookieContext.organizationId ?? defaultAdminContext.organizationId,
    shopId: cookieContext.shopId ?? defaultAdminContext.shopId,
    shopAlias: cookieContext.shopAlias ?? defaultAdminContext.shopAlias,
    locale: cookieContext.locale ?? defaultAdminContext.locale,
    currency: cookieContext.currency ?? defaultAdminContext.currency,
    country: cookieContext.country ?? defaultAdminContext.country,
    channel: cookieContext.channel ?? defaultAdminContext.channel,
  };
}

export function hasRequiredAdminContext(context: AdminContext) {
  return Boolean(context.organizationId && context.shopId);
}

function readResolvedShop(value: unknown): Partial<Pick<AdminContext, "shopId" | "shopAlias" | "locale" | "currency" | "country" | "channel">> {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const effectiveSettings =
    typeof record.effectiveSettings === "object" && record.effectiveSettings !== null
      ? record.effectiveSettings as Record<string, unknown>
      : {};

  return {
    shopId: typeof record.shopId === "string" ? record.shopId : undefined,
    shopAlias: typeof record.shopAlias === "string" ? record.shopAlias : undefined,
    locale: typeof effectiveSettings.defaultLocale === "string" ? effectiveSettings.defaultLocale : undefined,
    currency: typeof effectiveSettings.defaultCurrency === "string" ? effectiveSettings.defaultCurrency : undefined,
    country: typeof effectiveSettings.defaultCountry === "string" ? effectiveSettings.defaultCountry : undefined,
    channel: typeof effectiveSettings.defaultChannel === "string" ? effectiveSettings.defaultChannel : undefined,
  };
}

async function resolveContextByAlias(context: AdminContext): Promise<AdminContext> {
  if (!context.organizationId || context.shopId || !context.shopAlias) {
    return context;
  }

  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopAlias: context.shopAlias,
  });
  const result = await requestBff(`/admin/organizations-shops/shops/context/resolve?${params.toString()}`, {
    parse: readResolvedShop,
  });

  if (!result.ok) {
    return context;
  }

  return {
    ...context,
    shopId: result.data.shopId ?? context.shopId,
    shopAlias: result.data.shopAlias ?? context.shopAlias,
    locale: result.data.locale ?? context.locale,
    currency: result.data.currency ?? context.currency,
    country: result.data.country ?? context.country,
    channel: result.data.channel ?? context.channel,
  };
}

export async function updateAdminContext(formData: FormData) {
  "use server";

  const nextContext = await resolveContextByAlias({
    organizationId: String(formData.get("organizationId") ?? "").trim(),
    shopId: String(formData.get("shopId") ?? "").trim(),
    shopAlias: String(formData.get("shopAlias") ?? "").trim(),
    locale: String(formData.get("locale") ?? defaultAdminContext.locale).trim(),
    currency: String(formData.get("currency") ?? defaultAdminContext.currency).trim(),
    country: String(formData.get("country") ?? defaultAdminContext.country).trim(),
    channel: String(formData.get("channel") ?? defaultAdminContext.channel).trim(),
  });

  const cookieStore = await cookies();
  cookieStore.set(contextCookieName, JSON.stringify(nextContext), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  const redirectTo = String(formData.get("redirectTo") ?? "/admin");
  redirect(redirectTo.startsWith("/admin") ? redirectTo : "/admin");
}
