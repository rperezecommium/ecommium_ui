import { requestStorefrontBff } from "../../../../../src/shared/bff/storefront-client";
import { getStorefrontContext } from "../../../../../src/modules/storefront/storefront-context";
import { getStorefrontCustomerAuthorizationHeader } from "../../../../../src/modules/storefront/storefront-customer-session";

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

async function paymentsContextParams(requestUrl: URL) {
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

  const guestSessionId = requestUrl.searchParams.get("guestSessionId")?.trim();
  if (guestSessionId) {
    params.set("guestSessionId", guestSessionId);
  }

  return params;
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

function responsePayload(payload: unknown, params: URLSearchParams) {
  const storefrontContext = {
    currency: params.get("currency") ?? "EUR",
    locale: params.get("locale") ?? "es-ES",
  };

  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? { ...payload as Record<string, unknown>, storefrontContext }
    : { paymentSystems: payload, storefrontContext };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const params = await paymentsContextParams(requestUrl);
  const guestSessionId = asString(params.get("guestSessionId"));
  const authorization = await getStorefrontCustomerAuthorizationHeader();

  if (!authorization && !guestSessionId) {
    return errorResponse("Métodos de pago guest requieren guestSessionId.", 400);
  }

  const result = await requestStorefrontBff<unknown>(`/payments/payment-systems?${params.toString()}`, {
    context: {
      locale: params.get("locale") ?? undefined,
    },
    init: {
      headers: passthroughHeaders(authorization, guestSessionId),
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
