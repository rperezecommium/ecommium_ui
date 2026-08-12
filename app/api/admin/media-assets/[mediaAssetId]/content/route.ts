import { NextRequest } from "next/server";
import { requestAdminBffResponseAsEmployee } from "../../../../../../src/shared/bff/admin-client";
import { requireAdminRouteAccess } from "../../../../../../src/shared/auth/require-admin-route-access";
import { isSafeInlineMediaType, maximumMediaBytes } from "../../../../../../src/shared/security/media-upload";

const allowedVariants = new Set(["original", "small_default", "medium_default", "large_default"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaAssetId: string }> },
) {
  const { mediaAssetId } = await params;
  const normalizedMediaAssetId = mediaAssetId?.trim();
  if (!normalizedMediaAssetId) {
    return new Response("mediaAssetId is required", { status: 400 });
  }

  const access = await requireAdminRouteAccess("media.assets.write");
  if (!access.ok) {
    return access.response;
  }

  const { context } = access.data;

  const requestedVariant = request.nextUrl.searchParams.get("variant") ?? "medium_default";
  const variant = allowedVariants.has(requestedVariant) ? requestedVariant : "medium_default";
  const query = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    variant,
  });
  const result = await requestAdminBffResponseAsEmployee(
    `/admin/media/assets/${encodeURIComponent(normalizedMediaAssetId)}/content?${query.toString()}`,
    access.data.accessToken,
    {
      context,
      init: { headers: { accept: "*/*" } },
    },
  );

  if (!result.ok) {
    if (result.status === 401) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (result.status === 403 || result.status === 404) {
      return new Response("Not found", { status: 404 });
    }
    return new Response("Media content is temporarily unavailable", { status: result.status && result.status >= 500 ? result.status : 502 });
  }

  const response = result.data;
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumMediaBytes) {
    return new Response("Media content exceeds the allowed size", { status: 413 });
  }
  const content = await response.arrayBuffer();
  if (content.byteLength > maximumMediaBytes) {
    return new Response("Media content exceeds the allowed size", { status: 413 });
  }
  const responseHeaders = new Headers();
  responseHeaders.set("cache-control", "private, no-store");
  responseHeaders.set("x-content-type-options", "nosniff");
  const mediaType = isSafeInlineMediaType(response.headers.get("content-type"));
  responseHeaders.set("content-type", mediaType ?? "application/octet-stream");
  if (!mediaType) {
    responseHeaders.set("content-disposition", `attachment; filename="media-${encodeURIComponent(normalizedMediaAssetId)}"`);
  }
  responseHeaders.set("content-length", String(content.byteLength));

  return new Response(content, {
    status: 200,
    headers: responseHeaders,
  });
}
