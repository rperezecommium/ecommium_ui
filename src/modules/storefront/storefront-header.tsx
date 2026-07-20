import Link from "next/link";
import { StorefrontAuthEntry } from "./storefront-auth-drawer";
import { StorefrontCartStatus } from "./cart-client";
import { getStorefrontCustomerSession } from "./storefront-customer-session";

export async function StorefrontHeader({
  initialQuery,
  openCustomerLogin = false,
}: {
  initialQuery?: string;
  openCustomerLogin?: boolean;
}) {
  const customerSession = await getStorefrontCustomerSession();

  return (
    <header className="storefrontHeader">
      <div className="storefrontHeaderTop">
        <span>Contactenos</span>
        <StorefrontAuthEntry
          customerEmail={customerSession?.email}
          initialMode={openCustomerLogin && !customerSession ? "login" : undefined}
        />
      </div>
      <div className="storefrontHeaderMain">
        <Link className="storefrontLogo" href="/">Ecommium</Link>
        <form className="storefrontSearch" action="/search" method="get" role="search">
          <span>Buscar</span>
          <input name="q" defaultValue={initialQuery ?? ""} placeholder="Buscar en nuestra tienda" />
          <button type="submit">Buscar</button>
        </form>
        <div className="storefrontHeaderActions">
          <nav>
            <Link href="/plp/bike-drivetrain">Catalogo</Link>
            <Link href="/plp/clothes">Clothes</Link>
            <Link href="/plp/accessories">Accessories</Link>
          </nav>
          <StorefrontCartStatus />
        </div>
      </div>
    </header>
  );
}
