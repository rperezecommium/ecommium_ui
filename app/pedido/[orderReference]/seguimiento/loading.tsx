import { StorefrontHeader } from "../../../../src/modules/storefront/plp-page";

export default function OrderTrackingLoading() {
  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontOrderTrackingPage">
        <section aria-busy="true" aria-label="Cargando seguimiento" className="storefrontOrderTrackingLoading">
          <span />
          <span />
          <span />
          <span />
        </section>
      </div>
    </main>
  );
}
