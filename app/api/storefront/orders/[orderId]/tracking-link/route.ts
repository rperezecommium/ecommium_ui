import { requestStorefrontBff } from "../../../../../../src/shared/bff/storefront-client";
import { getStorefrontContext } from "../../../../../../src/modules/storefront/storefront-context";
import { getStorefrontCustomerAuthorizationHeader } from "../../../../../../src/modules/storefront/storefront-customer-session";

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const [{ orderId }, requestUrl] = await Promise.all([context.params, Promise.resolve(new URL(request.url))]);
  const storefront = getStorefrontContext();
  const guestSessionId = requestUrl.searchParams.get("guestSessionId")?.trim();
  const authorization = await getStorefrontCustomerAuthorizationHeader();
  const params = new URLSearchParams({ organizationId: storefront.organizationId, shopId: storefront.shopId });

  if (guestSessionId) params.set("guestSessionId", guestSessionId);

  const result = await requestStorefrontBff<{ orderReference: string; trackingPath: string; expiresAt: string | null }>(
    `/orders/${encodeURIComponent(orderId)}/tracking-link?${params.toString()}`,
    {
      withAuth: false,
      context: { locale: storefront.locale },
      init: {
        method: "POST",
        headers: {
          ...(authorization ? { authorization } : {}),
          ...(guestSessionId ? { "x-guest-session-id": guestSessionId } : {}),
        },
      },
    },
  );

  if (!result.ok) return Response.json({ message: result.error }, { status: result.status ?? 502 });

  return Response.json(result.data, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
