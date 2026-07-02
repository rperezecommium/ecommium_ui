import { redirect } from "next/navigation";
import { StorefrontPdpPage } from "../../../src/modules/storefront/pdp-page";
import { getStorefrontPdp } from "../../../src/modules/storefront/pdp";

type PageProps = {
  params: Promise<{
    productSlug: string;
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
  "categorySlug",
  "productId",
]);

export default async function PdpRoute({ params, searchParams }: PageProps) {
  const { productSlug } = await params;
  const query = await searchParams;
  if (hasHiddenStorefrontParams(query)) {
    redirect(`/pdp/${encodeURIComponent(productSlug)}`);
  }

  const result = await getStorefrontPdp(productSlug);

  return <StorefrontPdpPage result={result} productSlug={productSlug} />;
}

function hasHiddenStorefrontParams(query: Record<string, string | string[] | undefined> | undefined) {
  return Object.keys(query ?? {}).some((key) => hiddenStorefrontParams.has(key));
}
