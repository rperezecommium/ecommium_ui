import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import { getStorefrontCustomerAuthorizationHeader } from "./storefront-customer-session";
import { getStorefrontContext } from "./storefront-context";

export type StorefrontOrderTracking = {
  orderId: string;
  orderReference: string;
  status: "PAYMENT_PENDING" | "PREPARING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "REFUNDED" | "ISSUE" | string;
  title: string;
  message: string;
  placedAt: string | null;
  timeline: Array<{
    code: string;
    label: string;
    completed: boolean;
    current: boolean;
    occurredAt: string | null;
  }>;
  shippingModule: {
    visible: boolean;
    reason: string;
    shipping: {
      trackingNumber: string | null;
      trackingUrl: string | null;
      carrier: {
        label: string | null;
        logoUrl: string | null;
      } | null;
      deliveryPromise: {
        minDate: string;
        maxDate: string;
      } | null;
    } | null;
  };
};

export async function getStorefrontOrderTracking(
  orderReference: string,
  accessToken: string | undefined,
): Promise<BffResult<StorefrontOrderTracking>> {
  const reference = orderReference.trim();
  const token = accessToken?.trim();

  if (!reference) {
    return {
      ok: false,
      status: 404,
      error: "No podemos abrir este seguimiento.",
      correlationId: "storefront-tracking-local",
    };
  }

  const context = getStorefrontContext();
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });

  if (token) {
    params.set("trackingAccessToken", token);
  }

  const authorization = token ? null : await getStorefrontCustomerAuthorizationHeader();
  if (!token && !authorization) {
    return {
      ok: false,
      status: 401,
      error: "Inicia sesión para consultar este pedido.",
      correlationId: "storefront-tracking-local",
    };
  }

  return requestBff<StorefrontOrderTracking>(
    `/storefront/order-tracking/${encodeURIComponent(reference)}?${params.toString()}`,
    {
      withAuth: false,
      context: { locale: context.locale },
      init: authorization ? { headers: { authorization } } : undefined,
    },
  );
}
