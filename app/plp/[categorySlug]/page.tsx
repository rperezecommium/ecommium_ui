import { redirect } from "next/navigation";
import { StorefrontPlpPage } from "../../../src/modules/storefront/plp-page";
import { getStorefrontPlp } from "../../../src/modules/storefront/plp";

type PageProps = {
  params: Promise<{
    categorySlug: string;
  }>;
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

export default async function PlpRoute({ params, searchParams }: PageProps) {
  const { categorySlug } = await params;
  const query = await searchParams;
  const pathname = `/plp/${encodeURIComponent(categorySlug)}`;
  if (hasHiddenStorefrontParams(query)) {
    redirect(cleanHref(pathname, query));
  }

  const result = await getStorefrontPlp(categorySlug, {
    page: first(query?.page),
    limit: first(query?.limit),
  });

  return <StorefrontPlpPage result={result} categorySlug={categorySlug} />;
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
