import { requestStorefrontBff } from "../../../../src/shared/bff/storefront-client";
import { getStorefrontContext } from "../../../../src/modules/storefront/storefront-context";
import { getStorefrontCustomerAuthorizationHeader } from "../../../../src/modules/storefront/storefront-customer-session";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(message: string, status: number) {
  return Response.json(
    { message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}

async function cartContextParams() {
  const context = await getStorefrontContext();
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    locale: context.locale,
    currency: context.currency,
    country: context.country,
    channel: context.channel,
  });

  if (context.shopId) {
    params.set("shopId", context.shopId);
  } else if (context.shopAlias) {
    params.set("shopAlias", context.shopAlias);
  }

  return params;
}

function responsePayload(payload: unknown, params: URLSearchParams) {
  const storefrontContext = {
    currency: params.get("currency") ?? "EUR",
    locale: params.get("locale") ?? "es-ES",
  };

  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? { ...payload as Record<string, unknown>, storefrontContext }
    : { payload, storefrontContext };
}

function passthroughHeaders(authorization: string | null, guestSessionId?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (authorization) {
    headers.authorization = authorization;
  }
  if (guestSessionId?.trim()) {
    headers["x-guest-session-id"] = guestSessionId.trim();
  }
  return headers;
}

function endpointForAction(action: string, orderFormId: string, params: URLSearchParams) {
  switch (action) {
    case "client-profile-data":
      return {
        method: "POST",
        path: `/orderforms/${encodeURIComponent(orderFormId)}/attachments/client-profile-data?${params.toString()}`,
        status: 201,
      };
    case "profile":
      return {
        method: "PATCH",
        path: `/orderforms/${encodeURIComponent(orderFormId)}/profile?${params.toString()}`,
        status: 200,
      };
    case "shipping-data":
      return {
        method: "POST",
        path: `/orderforms/${encodeURIComponent(orderFormId)}/attachments/shipping-data?${params.toString()}`,
        status: 201,
      };
    case "payment-data":
      return {
        method: "POST",
        path: `/orderforms/${encodeURIComponent(orderFormId)}/attachments/payment-data?${params.toString()}`,
        status: 201,
      };
    case "coupon":
      return {
        method: "POST",
        path: `/orderforms/${encodeURIComponent(orderFormId)}/coupons?${params.toString()}`,
        status: 201,
      };
    case "remove-coupon":
      return {
        method: "DELETE",
        path: `/orderforms/${encodeURIComponent(orderFormId)}/coupons?${params.toString()}`,
        status: 200,
        withoutBody: true,
      };
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const input = asRecord(await request.json().catch(() => null));
  const action = asString(input.action);
  const guestSessionId = asString(input.guestSessionId);
  const orderFormId = asString(input.orderFormId);
  const payload = asRecord(input.payload);
  const params = await cartContextParams();

  if (guestSessionId) {
    params.set("guestSessionId", guestSessionId);
  }

  const authorization = await getStorefrontCustomerAuthorizationHeader();
  if (!authorization && !guestSessionId) {
    return errorResponse("Checkout guest requiere guestSessionId.", 400);
  }

  if (action === "resolve-shipping-options") {
    const result = await requestStorefrontBff<unknown>(`/shipping/options/resolve?${params.toString()}`, {
      context: {
        locale: params.get("locale") ?? undefined,
      },
      init: {
        method: "POST",
        headers: passthroughHeaders(authorization, guestSessionId),
        body: JSON.stringify(payload),
      },
      withAuth: false,
    });

    if (!result.ok) {
      return errorResponse(result.error, result.status ?? 502);
    }

    return Response.json(responsePayload(result.data, params), {
      status: result.status ?? 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  }

  if (action === "create-order") {
    const result = await requestStorefrontBff<unknown>(`/orders?${params.toString()}`, {
      context: {
        locale: params.get("locale") ?? undefined,
      },
      init: {
        method: "POST",
        headers: passthroughHeaders(authorization, guestSessionId),
        body: JSON.stringify(payload),
      },
      withAuth: false,
    });

    if (!result.ok) {
      return errorResponse(result.error, result.status ?? 502);
    }

    return Response.json(responsePayload(result.data, params), {
      status: result.status ?? 201,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  }

  if (!orderFormId) {
    return errorResponse("Checkout requiere orderFormId.", 400);
  }

  const endpoint = endpointForAction(action, orderFormId, params);
  if (!endpoint) {
    return errorResponse("Accion de checkout no soportada.", 400);
  }

  const result = await requestStorefrontBff<unknown>(endpoint.path, {
    context: {
      locale: params.get("locale") ?? undefined,
    },
    init: {
      method: endpoint.method,
      headers: passthroughHeaders(authorization, guestSessionId),
      body: "withoutBody" in endpoint && endpoint.withoutBody ? undefined : JSON.stringify(payload),
    },
    withAuth: false,
  });

  if (!result.ok) {
    return errorResponse(result.error, result.status ?? 502);
  }

  return Response.json(responsePayload(result.data, params), {
    status: result.status ?? endpoint.status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
