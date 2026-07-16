import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import {
  isStorefrontPublicPageResponse,
  type StorefrontPublicPageResponse,
} from "./public-page-contract";
import { getStorefrontContext, type StorefrontContext } from "./storefront-context";
import { normalizeStorefrontVisitorId } from "./visitor";

const defaultPageSize = 16;
const maximumPageSize = 100;
const maximumPathLength = 2048;

export type StorefrontPublicPageOptions = Partial<StorefrontContext> & {
  page?: string | number;
  limit?: string | number;
  visitorId?: string;
};

export async function getStorefrontPublicPage(
  path: string,
  options: StorefrontPublicPageOptions = {},
): Promise<BffResult<StorefrontPublicPageResponse>> {
  const publicPath = normalizeStorefrontPublicPath(path);
  if (!publicPath) {
    return {
      ok: false,
      status: 400,
      error: "La dirección pública no es válida.",
      correlationId: "storefront-public-page-local",
    };
  }

  const context = {
    ...getStorefrontContext(),
    ...compactContext(options),
  };
  const limit = boundedPositiveInt(options.limit, defaultPageSize, maximumPageSize);
  const page = boundedPositiveInt(options.page, 1, Math.floor(Number.MAX_SAFE_INTEGER / limit));
  const offset = (page - 1) * limit;
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    shopAlias: context.shopAlias,
    locale: context.locale,
    currency: context.currency,
    country: context.country,
    channel: context.channel,
    path: publicPath,
    limit: String(limit),
    offset: String(offset),
  });

  const result = await requestBff<unknown>(`/storefront/page?${params.toString()}`, {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      headers: {
        "x-visitor-id": normalizeStorefrontVisitorId(options.visitorId),
      },
    },
  });

  if (!result.ok) return result;

  if (!isStorefrontPublicPageResponse(result.data)) {
    return {
      ok: false,
      status: 502,
      error: "El BFF devolvió una página pública incompleta.",
      correlationId: result.correlationId,
    };
  }

  return {
    ...result,
    data: result.data,
  };
}

export function normalizeStorefrontPublicPath(value: string): string | null {
  const path = value.trim();
  if (
    !path ||
    path.length > maximumPathLength ||
    path.includes("://") ||
    path.includes("\\") ||
    path.includes("?") ||
    path.includes("#") ||
    path.includes("\0")
  ) {
    return null;
  }

  const segments = path
    .split("/")
    .filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  return segments.length ? `/${segments.join("/")}` : "/";
}

function compactContext(options: StorefrontPublicPageOptions): Partial<StorefrontContext> {
  return Object.fromEntries(
    Object.entries({
      organizationId: options.organizationId,
      shopId: options.shopId,
      shopAlias: options.shopAlias,
      locale: options.locale,
      currency: options.currency,
      country: options.country,
      channel: options.channel,
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0),
  );
}

function boundedPositiveInt(value: string | number | undefined, fallback: number, maximum: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}
