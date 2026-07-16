import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { StorefrontPlpPage } from "../src/modules/storefront/plp-page";
import { getStorefrontPlp } from "../src/modules/storefront/plp";
import { getStorefrontPublicPage } from "../src/modules/storefront/public-page";
import { buildStorefrontPublicMetadata } from "../src/modules/storefront/public-page-metadata";
import { StorefrontResolvedPublicPage } from "../src/modules/storefront/public-page-view";
import { normalizeStorefrontVisitorId, storefrontVisitorCookieName } from "../src/modules/storefront/visitor";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const homeCategorySlug = "bike-brakes";
const hiddenStorefrontParams = new Set([
  "organizationId",
  "shopId",
  "shopAlias",
  "locale",
  "currency",
  "country",
  "channel",
  "routePath",
]);

const loadPublicHome = cache((page?: string, limit?: string, visitorId?: string) =>
  getStorefrontPublicPage("/", { page, limit, visitorId }),
);

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [query, cookieStore] = await Promise.all([searchParams, cookies()]);
  const result = await loadPublicHome(
    first(query?.page),
    first(query?.limit),
    normalizeStorefrontVisitorId(cookieStore.get(storefrontVisitorCookieName)?.value),
  );
  if (result.ok) return buildStorefrontPublicMetadata(result.data);
  return {
    title: "Ecommium",
    description: "Compra online de forma sencilla y segura.",
    alternates: { canonical: "/" },
  };
}

export default async function Home({ searchParams }: PageProps) {
  const [query, cookieStore] = await Promise.all([searchParams, cookies()]);
  if (hasHiddenStorefrontParams(query)) {
    redirect(cleanHref("/", query));
  }

  const visitorId = normalizeStorefrontVisitorId(cookieStore.get(storefrontVisitorCookieName)?.value);
  const publicResult = await loadPublicHome(first(query?.page), first(query?.limit), visitorId);
  if (publicResult.ok) {
    return (
      <StorefrontResolvedPublicPage
        correlationId={publicResult.correlationId}
        data={publicResult.data}
        page={first(query?.page)}
        status={publicResult.status}
        visitorId={visitorId}
      />
    );
  }

  const result = await getStorefrontPlp(homeCategorySlug, {
    routePath: "/",
    page: first(query?.page),
    limit: first(query?.limit),
  });

  return <StorefrontPlpPage result={result} categorySlug={homeCategorySlug} />;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function hasHiddenStorefrontParams(query: Record<string, string | string[] | undefined> | undefined) {
  return Object.keys(query ?? {}).some((key) => hiddenStorefrontParams.has(key));
}

function cleanHref(pathname: string, query: Record<string, string | string[] | undefined> | undefined) {
  const params = new URLSearchParams();
  const page = first(query?.page);
  const limit = first(query?.limit);

  if (page && page !== "1") {
    params.set("page", page);
  }

  if (limit && limit !== "16") {
    params.set("limit", limit);
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}
