import { StorefrontHeader } from "../../src/modules/storefront/storefront-header";

export default function PublicPageLoading() {
  return (
    <main className="storefrontPage" aria-busy="true" aria-label="Cargando página">
      <StorefrontHeader />
      <div className="storefrontShell storefrontPublicLoading">
        <div />
        <div />
        <div />
      </div>
    </main>
  );
}
