import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { getAdminSession } from "../../../../../src/shared/auth/session";
import { can } from "../../../../../src/shared/permissions/permissions";
import { getCheckoutConfigurationAdminData } from "../../../../../src/modules/configuracion/checkout-configuration-admin";
import { CheckoutConfigurationAdminPage } from "../../../../../src/modules/configuracion/checkout-configuration-admin-page";

type CheckoutConfigurationPageProps = {
  searchParams?: Promise<{ drawer?: string | string[]; notice?: string | string[] }>;
};

function isEditDrawer(value: string | string[] | undefined) {
  return value === "edit";
}

export default async function CheckoutConfigurationPage({ searchParams }: CheckoutConfigurationPageProps) {
  const session = await getAdminSession();

  if (!session || session.scope !== "admin" || !can(session, "admin:checkout:view")) {
    return (
      <main className="adminPage">
        <div className="adminBreadcrumb">Admin / Configuracion / Checkout</div>
        <section className="adminBanner adminBannerError">
          <strong>No tienes acceso a la configuración de Checkout.</strong>
          <p>Esta operación requiere el permiso <code>checkout.configuration.write</code>.</p>
        </section>
      </main>
    );
  }

  const context = await getAdminContext();
  const params = await searchParams;
  const result = await getCheckoutConfigurationAdminData(context);

  return (
    <CheckoutConfigurationAdminPage
      context={context}
      drawerOpen={isEditDrawer(params?.drawer)}
      notice={typeof params?.notice === "string" ? params.notice : undefined}
      result={result}
    />
  );
}
