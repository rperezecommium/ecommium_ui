import Link from "next/link";
import { StorefrontCheckoutClient } from "../../src/modules/storefront/checkout-client";
import { StorefrontHeader } from "../../src/modules/storefront/plp-page";

export default function StorefrontCheckoutPage() {
  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontShell">
        <nav className="storefrontBreadcrumb">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <Link href="/cart">Carrito</Link>
          <span>/</span>
          <span>Checkout</span>
        </nav>
        <StorefrontCheckoutClient />
      </div>
    </main>
  );
}
