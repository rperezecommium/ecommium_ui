import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StorefrontPdpPage } from "./pdp-page";
import { StorefrontPlpPage } from "./plp-page";
import { categoryPublicPageToPlpResult, productPublicPageToPdpResult } from "./public-commerce-page";
import { classifyStorefrontPublicPageError, type StorefrontPublicPageResponse } from "./public-page-contract";
import { isSafeStorefrontTarget } from "./public-path";
import { StorefrontCmsPage } from "./storefront-cms-page";
import { StorefrontHeader } from "./storefront-header";

type StorefrontResolvedPublicPageProps = {
  correlationId: string;
  data: StorefrontPublicPageResponse;
  page?: string;
  status: number;
  visitorId: string;
};

export async function StorefrontResolvedPublicPage({
  correlationId,
  data,
  page,
  status,
  visitorId,
}: StorefrontResolvedPublicPageProps) {
  if (data.kind === "REDIRECT") {
    if (!isSafeStorefrontTarget(data.toPath)) notFound();
    redirect(data.toPath);
  }

  if (data.kind === "PRODUCT") {
    const result = productPublicPageToPdpResult(data, { correlationId, status, visitorId });
    return <StorefrontPdpPage result={result} productSlug={result.data?.slug ?? data.route.requestedPath} />;
  }

  if (data.kind === "CATEGORY") {
    const result = await categoryPublicPageToPlpResult(data, {
      correlationId,
      page,
      status,
      visitorId,
    });
    return <StorefrontPlpPage result={result} categorySlug={result.data?.categorySlug ?? data.route.requestedPath} />;
  }

  return <StorefrontCmsPage page={data.page} />;
}

export function StorefrontPublicFailure({ status }: { status?: number }) {
  const error = classifyStorefrontPublicPageError(status);
  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontShell">
        <section className="storefrontUnavailable">
          <span>Página pública</span>
          <h1>{error.title}</h1>
          <p>{error.message}</p>
          <Link className="storefrontCmsAction" href="/">Volver a la tienda</Link>
        </section>
      </div>
    </main>
  );
}

export function StorefrontPublicNotFound() {
  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontShell">
        <section className="storefrontUnavailable storefrontPublicState">
          <span>Error 404</span>
          <h1>No encontramos esta página</h1>
          <p>Puede que haya cambiado de dirección o ya no esté publicada.</p>
          <Link className="storefrontCmsAction" href="/">Volver a la tienda</Link>
        </section>
      </div>
    </main>
  );
}
