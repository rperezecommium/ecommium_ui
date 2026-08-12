import { requestStorefrontBff } from "../../shared/bff/storefront-client";
import type { BffResult } from "../../shared/bff/types";
import {
  isStorefrontPublicPathResolution,
  type StorefrontPublicPathResolution,
} from "./public-page-contract";
import { normalizeStorefrontPublicPath } from "./public-page";
import { getStorefrontContext } from "./storefront-context";
import type { StorefrontContext } from "./storefront-context";

export async function resolveStorefrontPublicPath(
  path: string,
  resolvedContext?: StorefrontContext,
): Promise<BffResult<StorefrontPublicPathResolution>> {
  const publicPath = normalizeStorefrontPublicPath(path);
  if (!publicPath) {
    return {
      ok: false,
      status: 400,
      error: "La dirección pública no es válida.",
      correlationId: "storefront-public-path-local",
    };
  }

  const context = resolvedContext ?? await getStorefrontContext();
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    shopAlias: context.shopAlias,
    locale: context.locale,
    path: publicPath,
  });
  const result = await requestStorefrontBff<unknown>(`/storefront/resolve-path?${params.toString()}`, {
    withAuth: false,
    context: { locale: context.locale },
  });

  if (!result.ok) return result;
  if (!isStorefrontPublicPathResolution(result.data)) {
    return {
      ok: false,
      status: 502,
      error: "El BFF devolvió una resolución pública incompleta.",
      correlationId: result.correlationId,
    };
  }

  return { ...result, data: result.data };
}

export function isSafeStorefrontTarget(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}
