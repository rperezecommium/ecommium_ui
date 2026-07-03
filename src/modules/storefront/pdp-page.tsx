import Link from "next/link";
import { StorefrontPdpContentClient } from "./pdp-content-client";
import type { StorefrontPdpData, StorefrontPdpResult } from "./pdp";

type Props = {
  result: StorefrontPdpResult;
  productSlug: string;
};

export function StorefrontPdpPage({ result, productSlug }: Props) {
  return (
    <main className="storefrontPage">
      <header className="storefrontHeader">
        <div className="storefrontHeaderTop">
          <span>Contactenos</span>
          <span>Iniciar sesion</span>
        </div>
        <div className="storefrontHeaderMain">
          <Link className="storefrontLogo" href="/">Ecommium</Link>
          <label className="storefrontSearch">
            <span>Buscar</span>
            <input placeholder="Buscar en nuestra tienda" />
          </label>
          <nav>
            <Link href="/plp/bike-drivetrain">Catalogo</Link>
            <Link href="/plp/clothes">Clothes</Link>
            <Link href="/plp/accessories">Accessories</Link>
          </nav>
        </div>
      </header>
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
