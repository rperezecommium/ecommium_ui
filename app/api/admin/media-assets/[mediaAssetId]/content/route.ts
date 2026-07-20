import { NextRequest } from "next/server";
import { getAdminAuthorizationToken } from "../../../../../../src/shared/auth/session";
import { getAdminContext, hasRequiredAdminContext } from "../../../../../../src/shared/config/admin-context";
import { adminBffToken, bffBaseUrl } from "../../../../../../src/shared/config/env";

const allowedVariants = new Set(["original", "small_default", "medium_default", "large_default"]);

function makeCorrelationId() {
  return "ui-media-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function normalizeBffBaseUrl() {
  return bffBaseUrl.endsWith("/") ? bffBaseUrl.slice(0, -1) : bffBaseUrl;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaAssetId: string }> },
) {
  const { mediaAssetId } = await params;
  const normalizedMediaAssetId = mediaAssetId?.trim();
  if (!normalizedMediaAssetId) {
    return new Response("mediaAssetId is required", { status: 400 });
  }

  const context = await getAdminContext();
  if (!hasRequiredAdminContext(context)) {
    return new Response("Admin context is required", { status: 400 });
  }

  const requestedVariant = request.nextUrl.searchParams.get("variant") ?? "medium_default";
  const variant = allowedVariants.has(requestedVariant) ? requestedVariant : "medium_default";
  const url = new URL(
    normalizeBffBaseUrl() + "/admin/media/assets/" + encodeURIComponent(normalizedMediaAssetId) + "/content",
  );
  url.searchParams.set("organizationId", context.organizationId);
  url.searchParams.set("shopId", context.shopId);
  url.searchParams.set("variant", variant);

  const headers = new Headers({
    accept: "*/*",
    "x-correlation-id": makeCorrelationId(),
    "x-locale": context.locale,
  });
  const token = await getAdminAuthorizationToken();
  const authorizationToken = token ?? adminBffToken;
  if (authorizationToken) {
    headers.set("authorization", "Bearer " + authorizationToken);
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return new Response(detail || "BFF media content failed with " + response.status, {
      status: response.status,
    });
  }

  const content = await response.arrayBuffer();
  const responseHeaders = new Headers();
  responseHeaders.set("cache-control", "private, no-store");
  responseHeaders.set("content-type", response.headers.get("content-type") ?? "application/octet-stream");
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    responseHeaders.set("content-length", contentLength);
  }

  return new Response(content, {
    status: 200,
    headers: responseHeaders,
  });
}
