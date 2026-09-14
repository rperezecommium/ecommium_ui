import Link from "next/link";
import { StorefrontAuthEntry } from "./storefront-auth-drawer";
import { StorefrontCartStatus } from "./cart-client";
import { getStorefrontCustomerSession } from "./storefront-customer-session";
import { getStorefrontContext } from "./storefront-context";
import { StorefrontConsentBanner } from "./storefront-consent-banner";
import { StorefrontConsentDataCleanupRegistry } from "./storefront-consent-cleanup";
import { StorefrontConsentIntegrationRegistry } from "./storefront-consent-gates";
import { StorefrontConsentProvider } from "./storefront-consent-runtime";
import { storefrontConsentIntegrations } from "./storefront-google-analytics-adapter";
import { StorefrontConsentAnalyticsLifecycle } from "./search-events-client";

export async function StorefrontHeader({
  initialQuery,
  openCustomerLogin = false,
}: {
  initialQuery?: string;
  openCustomerLogin?: boolean;
}) {
  const customerSession = await getStorefrontCustomerSession();
  const context = await getStorefrontContext();

  return (
    <StorefrontConsentProvider
      locale={context.locale}
      organizationId={context.organizationId}
      shopId={context.shopId}
    >
      <StorefrontHeaderContent
        customerEmail={customerSession?.email}
        initialQuery={initialQuery}
        openCustomerLogin={openCustomerLogin}
      />
      <StorefrontConsentBanner />
      <StorefrontConsentDataCleanupRegistry />
      <StorefrontConsentIntegrationRegistry integrations={storefrontConsentIntegrations} />
      <StorefrontConsentAnalyticsLifecycle />
    </StorefrontConsentProvider>
  );
}

export async function StorefrontPageShell({
  children,
  initialQuery,
  openCustomerLogin = false,
}: {
  children: React.ReactNode;
  initialQuery?: string;
  openCustomerLogin?: boolean;
}) {
  const [customerSession, context] = await Promise.all([
    getStorefrontCustomerSession(),
    getStorefrontContext(),
  ]);

  return (
    <StorefrontConsentProvider
      locale={context.locale}
      organizationId={context.organizationId}
      shopId={context.shopId}
    >
      <StorefrontHeaderContent
        customerEmail={customerSession?.email}
        initialQuery={initialQuery}
        openCustomerLogin={openCustomerLogin}
      />
      {children}
      <StorefrontConsentBanner />
      <StorefrontConsentDataCleanupRegistry />
      <StorefrontConsentIntegrationRegistry integrations={storefrontConsentIntegrations} />
      <StorefrontConsentAnalyticsLifecycle />
    </StorefrontConsentProvider>
  );
}

function StorefrontHeaderContent({
  customerEmail,
  initialQuery,
  openCustomerLogin,
}: {
  customerEmail?: string;
  initialQuery?: string;
  openCustomerLogin: boolean;
}) {
  return (
    <header className="storefrontHeader">
      <div className="storefrontHeaderTop">
        <span>Contactenos</span>
        <StorefrontAuthEntry
          customerEmail={customerEmail}
          initialMode={openCustomerLogin && !customerEmail ? "login" : undefined}
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
