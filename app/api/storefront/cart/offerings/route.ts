import { requestStorefrontBff } from "../../../../../src/shared/bff/storefront-client";
import { getStorefrontContext } from "../../../../../src/modules/storefront/storefront-context";
import { getStorefrontCustomerAuthorizationHeader } from "../../../../../src/modules/storefront/storefront-customer-session";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
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

export async function POST(request: Request) {
  const input = asRecord(await request.json().catch(() => null));
  const guestSessionId = asString(input.guestSessionId);
  const offeringId = asString(input.offeringId);
  const orderFormId = asString(input.orderFormId);
  const itemIndex = asNumber(input.itemIndex);

  if (!orderFormId) {
    return errorResponse("Agregar servicio requiere orderFormId.", 400);
  }
  if (itemIndex === undefined || itemIndex < 0) {
    return errorResponse("Agregar servicio requiere itemIndex valido.", 400);
  }
  if (!offeringId) {
    return errorResponse("Agregar servicio requiere offeringId.", 400);
  }

  const params = cartContextParams();
  if (guestSessionId) {
    params.set("guestSessionId", guestSessionId);
  }

  const authorization = await getStorefrontCustomerAuthorizationHeader();
  if (!authorization && !guestSessionId) {
    return errorResponse("Carrito guest requiere guestSessionId.", 400);
  }

  const result = await requestStorefrontBff<unknown>(
    `/orderforms/${encodeURIComponent(orderFormId)}/items/${itemIndex}/offerings?${params.toString()}`,
    {
      context: {
        locale: params.get("locale") ?? undefined,
      },
      init: {
        method: "POST",
        headers: passthroughHeaders(authorization, guestSessionId),
        body: JSON.stringify({ offeringId }),
      },
      withAuth: false,
    },
  );

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

export async function DELETE(request: Request) {
  const input = asRecord(await request.json().catch(() => null));
  const guestSessionId = asString(input.guestSessionId);
  const offeringId = asString(input.offeringId);
  const orderFormId = asString(input.orderFormId);
  const itemIndex = asNumber(input.itemIndex);

  if (!orderFormId) {
    return errorResponse("Quitar servicio requiere orderFormId.", 400);
  }
  if (itemIndex === undefined || itemIndex < 0) {
    return errorResponse("Quitar servicio requiere itemIndex valido.", 400);
  }
  if (!offeringId) {
    return errorResponse("Quitar servicio requiere offeringId.", 400);
  }

  const params = cartContextParams();
  if (guestSessionId) {
    params.set("guestSessionId", guestSessionId);
  }

  const authorization = await getStorefrontCustomerAuthorizationHeader();
  if (!authorization && !guestSessionId) {
    return errorResponse("Carrito guest requiere guestSessionId.", 400);
  }

  const result = await requestStorefrontBff<unknown>(
    `/orderforms/${encodeURIComponent(orderFormId)}/items/${itemIndex}/offerings/${encodeURIComponent(offeringId)}?${params.toString()}`,
    {
      context: {
        locale: params.get("locale") ?? undefined,
      },
      init: {
        method: "DELETE",
        headers: passthroughHeaders(authorization, guestSessionId),
      },
      withAuth: false,
    },
  );

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
