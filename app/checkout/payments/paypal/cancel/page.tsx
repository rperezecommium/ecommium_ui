import Link from "next/link";
import { StorefrontPaymentReturnClient } from "../../../../../src/modules/storefront/payment-return-client";
import { StorefrontHeader } from "../../../../../src/modules/storefront/plp-page";

export default function PayPalPaymentCancelPage() {
  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontShell">
        <nav className="storefrontBreadcrumb">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <Link href="/checkout">Checkout</Link>
          <span>/</span>
          <span>PayPal cancelado</span>
        </nav>
        <StorefrontPaymentReturnClient mode="cancel" provider="paypal" />
      </div>
    </main>
  );
}
