import Link from "next/link";
import { StorefrontCartPageClient } from "../../src/modules/storefront/cart-client";
import { StorefrontPageShell } from "../../src/modules/storefront/storefront-header";

export default function StorefrontCartPage() {
  return (
    <main className="storefrontPage">
      <StorefrontPageShell surface="CART">
      <div className="storefrontShell">
        <nav className="storefrontBreadcrumb">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <span>Carrito</span>
        </nav>
        <StorefrontCartPageClient />
      </div>
      </StorefrontPageShell>
    </main>
  );
}
