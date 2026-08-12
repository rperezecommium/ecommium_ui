import { requestStorefrontBff } from "../../../../src/shared/bff/storefront-client";
import { getStorefrontContext } from "../../../../src/modules/storefront/storefront-context";
import { getStorefrontCustomerAuthorizationHeader } from "../../../../src/modules/storefront/storefront-customer-session";

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
    : { orderform: payload, storefrontContext };
}

function appendGuestParams(params: URLSearchParams, requestUrl: URL) {
  const guestSessionId = requestUrl.searchParams.get("guestSessionId")?.trim();
  const forceNewCart = requestUrl.searchParams.get("forceNewCart")?.trim();

  if (guestSessionId) {
    params.set("guestSessionId", guestSessionId);
  }
  if (forceNewCart) {
    params.set("forceNewCart", forceNewCart);
  }
}

function passthroughHeaders(authorization: string | null, guestSessionId?: string | null) {
  const headers: Record<string, string> = {};
  if (authorization) {
    headers.authorization = authorization;
  }
  if (guestSessionId?.trim()) {
    headers["x-guest-session-id"] = guestSessionId.trim();
  }
  return headers;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const params = await cartContextParams();
  appendGuestParams(params, requestUrl);

  const authorization = await getStorefrontCustomerAuthorizationHeader();
  if (!authorization && !params.get("guestSessionId")) {
    return errorResponse("Carrito guest requiere guestSessionId.", 400);
  }

  const result = await requestStorefrontBff<unknown>(`/orderforms/current?${params.toString()}`, {
    context: {
      locale: params.get("locale") ?? undefined,
    },
    init: {
      headers: passthroughHeaders(authorization, params.get("guestSessionId")),
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
