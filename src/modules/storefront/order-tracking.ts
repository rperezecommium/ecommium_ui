import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import { getStorefrontCustomerAuthorizationHeader } from "./storefront-customer-session";
import { getStorefrontContext } from "./storefront-context";

export type StorefrontOrderTracking = {
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

export type StorefrontTrackingAccessRecoveryInput = {
  orderReference: string;
  email: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalidTrackingRequest<T>(error: string, status = 400): BffResult<T> {
  return {
    ok: false,
    error,
    status,
    correlationId: "storefront-tracking-input",
  };
}

function normalizeOrderReference(value: string) {
  return value.trim();
}

function trackingParams() {
  const context = getStorefrontContext();
  return {
    context,
    params: new URLSearchParams({
      organizationId: context.organizationId,
      shopId: context.shopId,
    }),
  };
}

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

  const { context, params } = trackingParams();

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

export async function requestStorefrontTrackingAccessRecovery(
  input: StorefrontTrackingAccessRecoveryInput,
): Promise<BffResult<{ accepted: true }>> {
  const orderReference = normalizeOrderReference(input.orderReference);
  const email = input.email.trim().toLowerCase();

  if (!orderReference || !emailPattern.test(email)) {
    return invalidTrackingRequest("Indica una referencia y un email validos.");
  }

  const { context, params } = trackingParams();
  return requestBff<{ accepted: true }>(
    `/storefront/order-tracking/access-recovery?${params.toString()}`,
    {
      withAuth: false,
      context: { locale: context.locale },
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderReference, email }),
      },
    },
  );
}
