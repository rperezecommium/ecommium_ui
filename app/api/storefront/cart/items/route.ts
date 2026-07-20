import { requestBff } from "../../../../../src/shared/bff/client";
import { getStorefrontContext } from "../../../../../src/modules/storefront/storefront-context";
import { getStorefrontCustomerAuthorizationHeader } from "../../../../../src/modules/storefront/storefront-customer-session";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
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

function cartContextParams() {
  const context = getStorefrontContext();
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

async function parseMutationInput(request: Request) {
  const payload = asRecord(await request.json().catch(() => null));
  const orderFormId = asString(payload.orderFormId);
  const guestSessionId = asString(payload.guestSessionId);
  const items = Array.isArray(payload.items) ? payload.items : [];

  return {
    guestSessionId,
    items,
    orderFormId,
  };
}

async function mutateItems(request: Request, method: "POST" | "PATCH") {
  const input = await parseMutationInput(request);
  if (!input.orderFormId) {
    return errorResponse("La mutacion del carrito requiere orderFormId.", 400);
  }
  if (!input.items.length) {
    return errorResponse("La mutacion del carrito requiere items.", 400);
  }

  const params = cartContextParams();
  if (input.guestSessionId) {
    params.set("guestSessionId", input.guestSessionId);
  }

  const authorization = await getStorefrontCustomerAuthorizationHeader();
  if (!authorization && !input.guestSessionId) {
    return errorResponse("Carrito guest requiere guestSessionId.", 400);
  }

  const result = await requestBff<unknown>(`/orderforms/${encodeURIComponent(input.orderFormId)}/items?${params.toString()}`, {
    context: {
      locale: params.get("locale") ?? undefined,
    },
    init: {
      method,
      headers: passthroughHeaders(authorization, input.guestSessionId),
      body: JSON.stringify({ items: input.items }),
    },
    withAuth: false,
  });

  if (!result.ok) {
    return errorResponse(result.error, result.status ?? 502);
  }

  return Response.json(responsePayload(result.data, params), {
    status: result.status ?? (method === "POST" ? 201 : 200),
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export async function POST(request: Request) {
  return mutateItems(request, "POST");
}

export async function PATCH(request: Request) {
  return mutateItems(request, "PATCH");
}

export async function DELETE(request: Request) {
  const input = await parseMutationInput(request);
  if (!input.orderFormId) {
    return errorResponse("Vaciar carrito requiere orderFormId.", 400);
  }

  const params = cartContextParams();
  if (input.guestSessionId) {
    params.set("guestSessionId", input.guestSessionId);
  }

  const authorization = await getStorefrontCustomerAuthorizationHeader();
  if (!authorization && !input.guestSessionId) {
    return errorResponse("Carrito guest requiere guestSessionId.", 400);
  }

  const result = await requestBff<unknown>(`/orderforms/${encodeURIComponent(input.orderFormId)}/items/remove-all?${params.toString()}`, {
    context: {
      locale: params.get("locale") ?? undefined,
    },
    init: {
      method: "POST",
      headers: passthroughHeaders(authorization, input.guestSessionId),
      body: JSON.stringify({}),
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
