import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { getStorefrontPublicPage } from "../../src/modules/storefront/public-page";
import { buildStorefrontPublicMetadata, hiddenMetadata } from "../../src/modules/storefront/public-page-metadata";
import { StorefrontPublicFailure, StorefrontResolvedPublicPage } from "../../src/modules/storefront/public-page-view";
import { normalizeStorefrontVisitorId, storefrontVisitorCookieName } from "../../src/modules/storefront/visitor";

type PublicCatchAllPageProps = {
  params: Promise<{ pathSegments: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const reservedFirstSegments = new Set([
  "_next",
  "account",
  "admin",
  "api",
  "assets",
  "auth",
  "cart",
  "checkout",
  "login",
  "logout",
  "pdp",
  "pedido",
  "plp",
  "public-system",
  "search",
  "static",
]);

const loadPublicPage = cache((path: string, page?: string, limit?: string, visitorId?: string) =>
  getStorefrontPublicPage(path, { page, limit, visitorId }),
);

export async function generateMetadata({ params, searchParams }: PublicCatchAllPageProps): Promise<Metadata> {
  const [{ pathSegments }, query, cookieStore] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({}),
    cookies(),
  ]);
  if (!isPublicPath(pathSegments)) return hiddenMetadata();

  const result = await loadPublicPage(
    `/${pathSegments.join("/")}`,
    first(query.page),
    first(query.limit),
    normalizeStorefrontVisitorId(cookieStore.get(storefrontVisitorCookieName)?.value),
  );
  return result.ok ? buildStorefrontPublicMetadata(result.data) : hiddenMetadata();
}

export default async function PublicCatchAllPage({ params, searchParams }: PublicCatchAllPageProps) {
  const [{ pathSegments }, query, cookieStore] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({}),
    cookies(),
  ]);

  if (!isPublicPath(pathSegments)) notFound();

  const publicPath = `/${pathSegments.join("/")}`;
  const visitorId = normalizeStorefrontVisitorId(
    cookieStore.get(storefrontVisitorCookieName)?.value,
  );
  const result = await loadPublicPage(publicPath, first(query.page), first(query.limit), visitorId);

  if (!result.ok) {
    if ([400, 401, 403, 404, 422].includes(result.status ?? 0)) notFound();
    return <StorefrontPublicFailure status={result.status} />;
  }

  return (
    <StorefrontResolvedPublicPage
      correlationId={result.correlationId}
      data={result.data}
      page={first(query.page)}
      status={result.status}
      visitorId={visitorId}
    />
  );
}

function isPublicPath(segments: string[]) {
  const firstSegment = segments[0]?.trim().toLowerCase();
  return Boolean(firstSegment) && !reservedFirstSegments.has(firstSegment);
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
