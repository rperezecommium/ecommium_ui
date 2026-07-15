import type { Metadata } from "next";
import { StorefrontOrderTrackingPage } from "../../../../src/modules/storefront/order-tracking-page";
import { getStorefrontOrderTracking } from "../../../../src/modules/storefront/order-tracking";
import { StorefrontHeader } from "../../../../src/modules/storefront/plp-page";

type PageProps = {
  params: Promise<{ orderReference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function OrderTrackingPage({ params, searchParams }: PageProps) {
  const [{ orderReference }, query] = await Promise.all([params, searchParams]);
  const access = first(query.access) ?? first(query.trackingAccessToken);
  const result = await getStorefrontOrderTracking(orderReference, access);

  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontOrderTrackingPage">
        <StorefrontOrderTrackingPage
          tracking={result.ok ? result.data : undefined}
          error={result.ok ? undefined : result.error}
          errorStatus={result.ok ? undefined : result.status}
        />
      </div>
    </main>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
