export const storefrontVisitorCookieName = "ecommium_storefront_visitor_id";
export const fallbackStorefrontVisitorId = "storefront-anonymous";

export function normalizeStorefrontVisitorId(value: string | undefined | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallbackStorefrontVisitorId;
  }

  return /^[a-zA-Z0-9._:-]{8,96}$/.test(trimmed)
    ? trimmed
    : fallbackStorefrontVisitorId;
}

export function visitorIdFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return fallbackStorefrontVisitorId;
  }

  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const encoded = cookies
    .find((item) => item.startsWith(`${storefrontVisitorCookieName}=`))
    ?.slice(storefrontVisitorCookieName.length + 1);

  if (!encoded) {
    return fallbackStorefrontVisitorId;
  }

  try {
    return normalizeStorefrontVisitorId(decodeURIComponent(encoded));
  } catch {
    return fallbackStorefrontVisitorId;
  }
}
