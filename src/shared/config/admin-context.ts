import { cookies } from "next/headers";
import { defaultAdminContext } from "./env";

export type AdminContext = {
  organizationId: string;
  shopId: string;
  shopAlias: string;
  shopName: string;
  primaryDomain: string;
  shopStatus: string;
  locale: string;
  currency: string;
  country: string;
  channel: string;
};

export const contextCookieName = "ecommium_admin_context";
export const pendingAdminContextShopId = "__admin_context_pending__";

function isRealShopId(value: string | undefined) {
  return Boolean(value && value !== pendingAdminContextShopId);
}

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
      shopName: typeof parsed.shopName === "string" ? parsed.shopName : undefined,
      primaryDomain: typeof parsed.primaryDomain === "string" ? parsed.primaryDomain : undefined,
      shopStatus: typeof parsed.shopStatus === "string" ? parsed.shopStatus : undefined,
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
    shopName: cookieContext.shopName ?? "",
    primaryDomain: cookieContext.primaryDomain ?? "",
    shopStatus: cookieContext.shopStatus ?? "",
    locale: cookieContext.locale ?? defaultAdminContext.locale,
    currency: cookieContext.currency ?? defaultAdminContext.currency,
    country: cookieContext.country ?? defaultAdminContext.country,
    channel: cookieContext.channel ?? defaultAdminContext.channel,
  };
}

export function hasRequiredAdminContext(context: AdminContext) {
  return Boolean(context.organizationId && isRealShopId(context.shopId));
}

export async function saveAdminContext(context: AdminContext) {
  const cookieStore = await cookies();
  cookieStore.set(contextCookieName, JSON.stringify(context), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearAdminContext() {
  const cookieStore = await cookies();
  cookieStore.delete(contextCookieName);
}
