import Link from "next/link";
import { StorefrontCheckoutClient } from "../../src/modules/storefront/checkout-client";
import { StorefrontPageShell } from "../../src/modules/storefront/storefront-header";

export default function StorefrontCheckoutPage() {
  return (
    <main className="storefrontPage">
      <StorefrontPageShell surface="CHECKOUT">
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
      </StorefrontPageShell>
    </main>
  );
}
