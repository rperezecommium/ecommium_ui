import Link from "next/link";
import { StorefrontCartPageClient } from "../../src/modules/storefront/cart-client";
import { StorefrontHeader } from "../../src/modules/storefront/plp-page";

export default function StorefrontCartPage() {
  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontShell">
        <nav className="storefrontBreadcrumb">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <span>Carrito</span>
        </nav>
        <StorefrontCartPageClient />
      </div>
    </main>
  );
}
