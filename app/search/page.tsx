import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StorefrontPlpPage } from "../../src/modules/storefront/plp-page";
import { getStorefrontSearch } from "../../src/modules/storefront/plp";
import { normalizeStorefrontVisitorId, storefrontVisitorCookieName } from "../../src/modules/storefront/visitor";

type SearchPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

export default async function SearchRoute({ searchParams }: SearchPageProps) {
  const query = await searchParams;
  const cookieStore = await cookies();
  const visitorId = normalizeStorefrontVisitorId(cookieStore.get(storefrontVisitorCookieName)?.value);
  if (hasHiddenStorefrontParams(query)) {
    redirect(cleanHref(query));
  }

  const searchQuery = first(query?.q) ?? "";
  const result = await getStorefrontSearch(searchQuery, {
    page: first(query?.page),
    limit: first(query?.limit),
    visitorId,
  });

  return <StorefrontPlpPage result={result} categorySlug="search" searchQuery={searchQuery} />;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function hasHiddenStorefrontParams(query: Record<string, string | string[] | undefined> | undefined) {
  return Object.keys(query ?? {}).some((key) => hiddenStorefrontParams.has(key));
}

function cleanHref(query: Record<string, string | string[] | undefined> | undefined) {
  const params = new URLSearchParams();
  const searchQuery = first(query?.q);
  const page = first(query?.page);
  const limit = first(query?.limit);

  if (searchQuery) {
    params.set("q", searchQuery);
  }

  if (page && page !== "1") {
    params.set("page", page);
  }

  if (limit && limit !== "16") {
    params.set("limit", limit);
  }

  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}
