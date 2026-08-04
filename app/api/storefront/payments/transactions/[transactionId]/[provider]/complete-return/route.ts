import { requestStorefrontBff } from "../../../../../../../../src/shared/bff/storefront-client";
import { getStorefrontContext } from "../../../../../../../../src/modules/storefront/storefront-context";
import { getStorefrontCustomerAuthorizationHeader } from "../../../../../../../../src/modules/storefront/storefront-customer-session";

type RouteContext = {
  params: Promise<{
    provider?: string;
    transactionId?: string;
  }>;
};

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

function paymentsContextParams(requestUrl: URL, input: Record<string, unknown>) {
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

  const guestSessionId = requestUrl.searchParams.get("guestSessionId")?.trim() || asString(input.guestSessionId);
  if (guestSessionId) {
    params.set("guestSessionId", guestSessionId);
  }

  return params;
}

function passthroughHeaders(request: Request, authorization: string | null, guestSessionId?: string | null) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const correlationId = request.headers.get("x-correlation-id")?.trim();

  if (authorization) {
    headers.authorization = authorization;
  }
  if (guestSessionId?.trim()) {
    headers["x-guest-session-id"] = guestSessionId.trim();
  }
  if (correlationId) {
    headers["x-correlation-id"] = correlationId;
  }

  return headers;
}

function stripUiOnlyFields(input: Record<string, unknown>) {
  const payload = { ...input };
  delete payload.guestSessionId;
  return payload;
}

export async function POST(request: Request, context: RouteContext) {
  const routeParams = await context.params;
  const transactionId = asString(routeParams.transactionId);
  const provider = asString(routeParams.provider);

  if (!transactionId) {
    return errorResponse("Retorno de pago requiere transactionId.", 400);
  }
  if (provider !== "paypal" && provider !== "stripe") {
    return errorResponse("Proveedor de pago no soportado.", 400);
  }

  const input = asRecord(await request.json().catch(() => null));
  const requestUrl = new URL(request.url);
  const params = paymentsContextParams(requestUrl, input);
  const guestSessionId = asString(params.get("guestSessionId"));
  const authorization = await getStorefrontCustomerAuthorizationHeader();

  if (!authorization && !guestSessionId) {
    return errorResponse("Retorno de pago guest requiere guestSessionId.", 400);
  }

  const result = await requestStorefrontBff<unknown>(
    `/payments/transactions/${encodeURIComponent(transactionId)}/${provider}/complete-return?${params.toString()}`,
    {
      context: {
        locale: params.get("locale") ?? undefined,
      },
      init: {
        method: "POST",
        headers: passthroughHeaders(request, authorization, guestSessionId),
        body: JSON.stringify(stripUiOnlyFields(input)),
      },
      withAuth: false,
    },
  );

  if (!result.ok) {
    return errorResponse(result.error, result.status ?? 502);
  }

  return Response.json(result.data, {
    status: result.status ?? 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
