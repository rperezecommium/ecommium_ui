import { StorefrontPdpContentClient } from "./pdp-content-client";
import type { StorefrontPdpData, StorefrontPdpResult } from "./pdp";
import { StorefrontHeader } from "./plp-page";

type Props = {
  result: StorefrontPdpResult;
  productSlug: string;
};

export function StorefrontPdpPage({ result, productSlug }: Props) {
  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontShell">
        {result.ok && result.data ? (
          <PdpContent data={result.data} />
        ) : (
          <section className="storefrontUnavailable">
            <span>PDP</span>
            <h1>No se pudo cargar el producto</h1>
            <p>{result.error ?? "BFF no disponible para Storefront."}</p>
            <code>{`/pdp/${productSlug}`}</code>
          </section>
        )}
      </div>
    </main>
  );
}

function PdpContent({ data }: { data: StorefrontPdpData }) {
  return <StorefrontPdpContentClient data={data} />;
}
