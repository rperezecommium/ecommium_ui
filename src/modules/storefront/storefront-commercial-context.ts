import { getStorefrontCustomerAuthorizationHeader } from "./storefront-customer-session";
/** Customer credentials stay server-side and are never replaced by an Admin session. */
export async function getStorefrontCommercialReadOptions(): Promise<{ withAuth: false; init?: { cache: "no-store"; headers: Record<string, string> } }> {
  if (process.env.ECOMMIUM_UI_VERIFIED_COMMERCIAL_CONTEXT_ENABLED !== "true") return { withAuth: false };
  const authorization = await getStorefrontCustomerAuthorizationHeader();
  if (!authorization) return { withAuth: false };
  return { withAuth: false, init: { cache: "no-store", headers: { authorization, "x-commercial-context-required": "true" } } };
}
