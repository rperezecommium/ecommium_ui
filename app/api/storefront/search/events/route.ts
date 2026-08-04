import { requestStorefrontBff } from "../../../../../src/shared/bff/storefront-client";
import { normalizeStorefrontVisitorId, visitorIdFromCookieHeader } from "../../../../../src/modules/storefront/visitor";

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

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (Array.from(requestUrl.searchParams.keys()).length > 0) {
    return errorResponse("Storefront Search Events no acepta query params.", 400);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse("Storefront Search Events requiere application/json.", 415);
  }

  const payload = await request.json().catch(() => null) as unknown;
  const payloadVisitorId = typeof asRecord(payload).visitorId === "string"
    ? String(asRecord(payload).visitorId)
    : undefined;
  const visitorId = normalizeStorefrontVisitorId(payloadVisitorId) === "storefront-anonymous"
    ? visitorIdFromCookieHeader(request.headers.get("cookie"))
    : normalizeStorefrontVisitorId(payloadVisitorId);
  const result = await requestStorefrontBff<Record<string, unknown>>("/storefront/search/events", {
    context: {
      locale: typeof asRecord(payload).locale === "string" ? String(asRecord(payload).locale) : undefined,
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
