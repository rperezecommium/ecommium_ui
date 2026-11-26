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
import { getStorefrontCmsShell, type StorefrontSurface } from "./storefront-cms-shell";
import { StorefrontSitePartView } from "./storefront-site-part";
import { getStorefrontCategories } from "./plp";

export async function StorefrontHeader({
  initialQuery,
  openCustomerLogin = false,
}: {
  initialQuery?: string;
  openCustomerLogin?: boolean;
}) {
  const context = await getStorefrontContext();
  const [customerSession, cmsShell, categories] = await Promise.all([getStorefrontCustomerSession(), getStorefrontCmsShell("CMS"), getStorefrontCategories(context, "")]);

  return (
    <StorefrontConsentProvider
      locale={context.locale}
      organizationId={context.organizationId}
      shopId={context.shopId}
    >
      {cmsShell?.header ? <StorefrontSitePartView categories={categories} country={context.country} currency={context.currency} locale={context.locale} part={cmsShell.header} customerEmail={customerSession?.email} initialQuery={initialQuery} marketLabel={`${context.locale} · ${context.currency}`} openCustomerLogin={openCustomerLogin} /> : <StorefrontHeaderContent
        customerEmail={customerSession?.email}
        initialQuery={initialQuery}
        openCustomerLogin={openCustomerLogin}
      />}
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
  pageId,
  surface = "CMS",
}: {
  children: React.ReactNode;
  initialQuery?: string;
  openCustomerLogin?: boolean;
  pageId?: string;
  surface?: StorefrontSurface;
}) {
  const context = await getStorefrontContext();
  const [customerSession, cmsShell, categories] = await Promise.all([
    getStorefrontCustomerSession(),
    getStorefrontCmsShell(surface, pageId),
    getStorefrontCategories(context, ""),
  ]);

  return (
    <StorefrontConsentProvider
      locale={context.locale}
      organizationId={context.organizationId}
      shopId={context.shopId}
    >
      {cmsShell?.header ? <StorefrontSitePartView categories={categories} country={context.country} currency={context.currency} locale={context.locale} part={cmsShell.header} customerEmail={customerSession?.email} initialQuery={initialQuery} marketLabel={`${context.locale} · ${context.currency}`} openCustomerLogin={openCustomerLogin} /> : <StorefrontHeaderContent
        customerEmail={customerSession?.email}
        initialQuery={initialQuery}
        openCustomerLogin={openCustomerLogin}
      />}
      <div className="storefrontShellContent" data-cms-breadcrumb-mode={cmsShell?.breadcrumbMode ?? "AUTO"}>{children}</div>
      {cmsShell?.footer ? <StorefrontSitePartView part={cmsShell.footer} customerEmail={customerSession?.email} marketLabel={`${context.locale} · ${context.currency}`} /> : null}
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
