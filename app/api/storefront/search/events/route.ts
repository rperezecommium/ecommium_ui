import { requestStorefrontBff } from "../../../../../src/shared/bff/storefront-client";
import { normalizeStorefrontVisitorId, visitorIdFromCookieHeader } from "../../../../../src/modules/storefront/visitor";
import { getStorefrontContext } from "../../../../../src/modules/storefront/storefront-context";
import { readJsonObject, validateSameOriginMutation } from "../../../../../src/shared/security/request-security";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
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

const maximumEventBytes = 32 * 1024;
const eventTypes = new Set(["search", "detail-page-view", "add-to-cart"]);
const eventKeys = new Set(["organizationId", "shopId", "eventType", "visitorId", "attributionToken", "query", "offset", "productDetails", "uri", "referrerUri", "occurredAt"]);

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length <= maximum ? value.trim() : undefined;
}

function normalizedEvent(payload: Record<string, unknown>) {
  if (Object.keys(payload).some((key) => !eventKeys.has(key))) return undefined;
  const eventType = boundedText(payload.eventType, 40);
  if (!eventType || !eventTypes.has(eventType)) return undefined;
  const productDetails = payload.productDetails;
  if (productDetails !== undefined && (!Array.isArray(productDetails) || productDetails.length > 24 || productDetails.some((item) => !asRecord(item).productId || !boundedText(asRecord(item).productId, 200)))) return undefined;
  const query = payload.query === undefined ? undefined : boundedText(payload.query, 200);
  if (payload.query !== undefined && !query) return undefined;
  return {
    organizationId: boundedText(payload.organizationId, 200),
    shopId: boundedText(payload.shopId, 200),
    visitorId: boundedText(payload.visitorId, 200),
    attributionToken: payload.attributionToken === null ? null : boundedText(payload.attributionToken, 500),
    eventType,
    query,
    productDetails: productDetails?.map((item) => ({ productId: boundedText(asRecord(item).productId, 200), variantId: boundedText(asRecord(item).variantId, 200) ?? null, quantity: Number.isInteger(asRecord(item).quantity) && Number(asRecord(item).quantity) > 0 && Number(asRecord(item).quantity) <= 99 ? Number(asRecord(item).quantity) : undefined })),
    uri: boundedText(payload.uri, 2048),
    referrerUri: boundedText(payload.referrerUri, 2048),
    occurredAt: boundedText(payload.occurredAt, 40),
  };
}

export async function POST(request: Request) {
  const sameOriginError = validateSameOriginMutation(request);
  if (sameOriginError && !sameOriginError.ok) return errorResponse(sameOriginError.message, sameOriginError.status);
  const requestUrl = new URL(request.url);
  if (Array.from(requestUrl.searchParams.keys()).length > 0) {
    return errorResponse("Storefront Search Events no acepta query params.", 400);
  }

  const body = await readJsonObject(request, maximumEventBytes);
  if (!body.ok) return errorResponse(body.message, body.status);
  const payload = normalizedEvent(body.value);
  if (!payload) return errorResponse("El evento no tiene un formato permitido.", 400);
  const context = await getStorefrontContext();
  if (payload.organizationId !== context.organizationId || payload.shopId !== context.shopId) {
    return errorResponse("El contexto del evento no coincide con la tienda activa.", 400);
  }
  const payloadVisitorId = typeof asRecord(payload).visitorId === "string"
    ? String(asRecord(payload).visitorId)
    : undefined;
  const visitorId = normalizeStorefrontVisitorId(payloadVisitorId) === "storefront-anonymous"
    ? visitorIdFromCookieHeader(request.headers.get("cookie"))
    : normalizeStorefrontVisitorId(payloadVisitorId);
  const result = await requestStorefrontBff<Record<string, unknown>>("/storefront/search/events", {
    context: {
      locale: context.locale,
    },
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-visitor-id": visitorId,
      },
      body: JSON.stringify(payload),
    },
    parse: asRecord,
    withAuth: false,
  });

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
