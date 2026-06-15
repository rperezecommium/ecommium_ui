import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { defaultAdminContext } from "./env";

export type AdminContext = {
  organizationId: string;
  shopId: string;
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
    locale: cookieContext.locale ?? defaultAdminContext.locale,
    currency: cookieContext.currency ?? defaultAdminContext.currency,
    country: cookieContext.country ?? defaultAdminContext.country,
    channel: cookieContext.channel ?? defaultAdminContext.channel,
  };
}

export function hasRequiredAdminContext(context: AdminContext) {
  return Boolean(context.organizationId && context.shopId);
}

export async function updateAdminContext(formData: FormData) {
  "use server";

  const nextContext: AdminContext = {
    organizationId: String(formData.get("organizationId") ?? "").trim(),
    shopId: String(formData.get("shopId") ?? "").trim(),
    locale: String(formData.get("locale") ?? defaultAdminContext.locale).trim(),
    currency: String(formData.get("currency") ?? defaultAdminContext.currency).trim(),
    country: String(formData.get("country") ?? defaultAdminContext.country).trim(),
    channel: String(formData.get("channel") ?? defaultAdminContext.channel).trim(),
  };

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
