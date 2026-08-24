import Link from "next/link";
import { StorefrontAccountClient } from "../../src/modules/storefront/storefront-account-client";
import { logoutStorefrontCustomer } from "../../src/modules/storefront/storefront-account-actions";
import { getStorefrontAccountData } from "../../src/modules/storefront/storefront-account";
import { getStorefrontCustomerSession } from "../../src/modules/storefront/storefront-customer-session";
import { StorefrontHeader } from "../../src/modules/storefront/plp-page";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const [result, customerSession] = await Promise.all([
    getStorefrontAccountData({
      invoicesLimit: first(query?.invoicesLimit) ?? "5",
      invoicesOffset: first(query?.invoicesOffset) ?? "0",
      purchasesLimit: first(query?.purchasesLimit) ?? "5",
      purchasesOffset: first(query?.purchasesOffset) ?? "0",
      afterSalesCaseId: first(query?.caseId),
      afterSalesLimit: first(query?.afterSalesLimit) ?? "10",
      afterSalesOffset: first(query?.afterSalesOffset) ?? "0",
    }),
    getStorefrontCustomerSession(),
  ]);

  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontAuthPage">
        {result.ok && result.data ? (
          <StorefrontAccountClient
            data={result.data}
            initialDrawer={
              accountSection(first(query?.section))
            }
            initialAfterSalesView={afterSalesView(first(query?.afterSalesView))}
          />
        ) : (
          <section className="storefrontAuthPanel">
            <Link className="storefrontAuthBackLink" href="/">
              Ecommium
            </Link>
            <h1>Inicia sesion</h1>
            <p>Necesitas una cuenta activa para gestionar tus datos, credenciales y avatar.</p>
            {customerSession ? (
              <form action={logoutStorefrontCustomer} className="storefrontAuthPanelLogoutForm">
                <button className="storefrontAuthPanelLogout" type="submit">
                  Cerrar sesion
                </button>
              </form>
            ) : null}
            <Link className="storefrontAuthPanelLink" href="/">
              Volver a tienda
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function accountSection(value: string | undefined) {
  return value === "invoices" || value === "sessions" || value === "afterSales" ? value : undefined;
}

function afterSalesView(value: string | undefined) {
  return value === "cases" || value === "new" ? value : undefined;
}
