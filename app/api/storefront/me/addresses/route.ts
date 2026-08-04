import { requestStorefrontBff } from "../../../../../src/shared/bff/storefront-client";
import { getStorefrontContext } from "../../../../../src/modules/storefront/storefront-context";
import { getStorefrontCustomerAuthorizationHeader } from "../../../../../src/modules/storefront/storefront-customer-session";

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

function storefrontParams() {
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

function passthroughHeaders(authorization: string) {
  return {
    authorization,
    "content-type": "application/json",
  };
}

function validateAddressPayload(payload: Record<string, unknown>) {
  const alias = asString(payload.alias);
  if (alias.length < 2 || alias.length > 40) {
    return "El alias debe tener entre 2 y 40 caracteres.";
  }

  for (const field of ["receiverName", "street", "number", "city", "state", "country", "postalCode"]) {
    if (!asString(payload[field])) {
      return "Completa los campos obligatorios de la dirección.";
    }
  }

  return null;
}

export async function POST(request: Request) {
  const payload = asRecord(await request.json().catch(() => null));
  const validationError = validateAddressPayload(payload);
  if (validationError) {
    return errorResponse(validationError, 400);
  }

  const authorization = await getStorefrontCustomerAuthorizationHeader();
  if (!authorization) {
    return errorResponse("Inicia sesión para guardar direcciones.", 401);
  }

  const params = storefrontParams();
  const result = await requestStorefrontBff<unknown>(`/storefront/me/addresses?${params.toString()}`, {
    context: {
      locale: params.get("locale") ?? undefined,
    },
    init: {
      method: "POST",
      headers: passthroughHeaders(authorization),
      body: JSON.stringify(payload),
    },
    withAuth: false,
  });

  if (!result.ok) {
    return errorResponse(result.error, result.status ?? 502);
  }

  return Response.json(result.data, {
    status: result.status ?? 201,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
