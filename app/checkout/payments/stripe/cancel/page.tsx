import Link from "next/link";
import { StorefrontPaymentReturnClient } from "../../../../../src/modules/storefront/payment-return-client";
import { StorefrontHeader } from "../../../../../src/modules/storefront/plp-page";

export default function StripePaymentCancelPage() {
  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontShell">
        <nav className="storefrontBreadcrumb">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <Link href="/checkout">Checkout</Link>
          <span>/</span>
          <span>Stripe cancelado</span>
        </nav>
        <StorefrontPaymentReturnClient mode="cancel" provider="stripe" />
      </div>
    </main>
  );
}
