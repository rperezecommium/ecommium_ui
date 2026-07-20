"use client";

import Link from "next/link";

export default function PublicPageError({ reset }: { reset: () => void }) {
  return (
    <main className="storefrontPage">
      <div className="storefrontShell">
        <section className="storefrontUnavailable storefrontPublicState">
          <span>Página pública</span>
          <h1>No pudimos abrir esta página</h1>
          <p>Vuelve a intentarlo o regresa a la tienda.</p>
          <div className="storefrontPublicActions">
            <button className="storefrontCmsAction" onClick={reset} type="button">Reintentar</button>
            <Link href="/">Volver a la tienda</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
