import {
  mapStorefrontPdpPayload,
  type StorefrontPdpResult,
} from "./pdp";
import {
  mapStorefrontPlpPayload,
  type StorefrontPlpResult,
} from "./plp";
import type {
  StorefrontCategoryPublicPage,
  StorefrontProductPublicPage,
} from "./public-page-contract";
import { getStorefrontContext } from "./storefront-context";

type PublicCommerceResultContext = {
  correlationId: string;
  status: number;
  visitorId: string;
};

export function productPublicPageToPdpResult(
  publicPage: StorefrontProductPublicPage,
  request: PublicCommerceResultContext,
): StorefrontPdpResult {
  const context = getStorefrontContext();
  const data = mapStorefrontPdpPayload(publicPage.page, {
    ...context,
    organizationId: publicPage.route.organizationId,
    shopId: publicPage.route.shopId,
    locale: publicPage.route.locale,
    fallbackSlug: lastPathSegment(publicPage.route.canonicalPath, "producto"),
    visitorId: request.visitorId,
  });

  return {
    ok: true,
    requestedPath: publicPage.route.requestedPath,
    status: request.status,
    correlationId: request.correlationId,
    data,
  };
}

export async function categoryPublicPageToPlpResult(
  publicPage: StorefrontCategoryPublicPage,
  request: PublicCommerceResultContext & { page?: string },
): Promise<StorefrontPlpResult> {
  const context = getStorefrontContext();
  const categorySlug = lastPathSegment(publicPage.route.canonicalPath, "categoria");
  const data = await mapStorefrontPlpPayload(publicPage.page, {
    ...context,
    organizationId: publicPage.route.organizationId,
    shopId: publicPage.route.shopId,
    locale: publicPage.route.locale,
    categorySlug,
    page: request.page,
    publicPath: publicPage.route.canonicalPath,
  });

  return {
    ok: true,
    requestedPath: publicPage.route.requestedPath,
    status: request.status,
    correlationId: request.correlationId,
    data,
  };
}

function lastPathSegment(path: string, fallback: string) {
  const segment = path.split("/").filter(Boolean).at(-1);
  if (!segment) return fallback;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
