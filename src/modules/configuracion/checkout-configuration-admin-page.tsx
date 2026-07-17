import type { AdminContext } from "../../shared/config/admin-context";
import Link from "next/link";
import type {
  CheckoutConfigurationResponse,
  CheckoutConfigurationState,
  CheckoutOrderformConfiguration,
} from "./checkout-configuration-admin";
import type { BffResult } from "../../shared/bff/types";
import { CheckoutConfigurationForm } from "./checkout-configuration-form-client";

type CheckoutConfigurationAdminPageProps = {
  context: AdminContext;
  drawerOpen: boolean;
  notice?: string;
  result: BffResult<CheckoutConfigurationResponse>;
};

function booleanLabel(value: boolean) {
  return value ? "Activa" : "Desactivada";
}

function dateLabel(value: string) {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function checkoutHref(drawer?: "edit") {
  return drawer ? `/admin/configuracion/checkout?drawer=${drawer}` : "/admin/configuracion/checkout";
}

function methodsLabel(methods: string[]) {
  return methods.length > 0 ? methods.join(", ") : "Sin control específico";
}

function CheckoutConfigurationDrawer({
  configuration,
  open,
  state,
}: {
  configuration: CheckoutOrderformConfiguration;
  open: boolean;
  state: CheckoutConfigurationState;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="adminDrawerBackdrop">
      <aside aria-label="Editar configuración de Checkout" className="adminSideDrawer checkoutConfigurationDrawer">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>Editar configuración</h2>
            <p>{state === "INITIAL" ? "Primer guardado de esta tienda" : `Versión ${configuration.version}`}</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={checkoutHref()}>Cerrar</Link>
        </div>
        <CheckoutConfigurationForm configuration={configuration} inDrawer state={state} />
      </aside>
    </div>
  );
}

export function CheckoutConfigurationAdminPage({ context, drawerOpen, notice, result }: CheckoutConfigurationAdminPageProps) {
  const response = result.ok ? result.data : undefined;
  const configuration = response?.configuration;
  const state = response?.configurationState;

  return (
    <main className="adminPage">
      <div className="adminBreadcrumb">Admin / Configuracion / Checkout</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Configuración de Checkout</h1>
          <p className="adminPageIntro">
            Reglas que aplica Checkout a la tienda activa. El contexto se toma del selector superior.
          </p>
        </div>
        {configuration && state ? (
          <Link className="adminButton adminButtonPrimary" href={checkoutHref("edit")}>Editar configuración</Link>
        ) : null}
      </div>

      {notice ? <div className="adminBanner">{notice}</div> : null}

      {!result.ok ? (
        <section className="adminBanner adminBannerError">
          <strong>No se pudo consultar la configuración de Checkout.</strong>
          <p>{result.error}</p>
          <p>
            Contexto solicitado: <code>{context.organizationId || "Organization pendiente"}</code> / {" "}
            <code>{context.shopName || context.shopAlias || "Shop pendiente"}</code>
          </p>
          {result.status ? <p>Estado BFF: {result.status}</p> : null}
        </section>
      ) : null}

      {response && configuration && state ? (
        <>
          {state === "INITIAL" ? (
            <div className="adminBanner">
              Aún no hay configuración guardada para esta tienda. Guarda una vez para fijar estas reglas.
            </div>
          ) : null}

          <section className="adminSummaryGrid" aria-label="Resumen de configuración Checkout">
            <div>
              <span>Checkout</span>
              <strong>{booleanLabel(configuration.isActive)}</strong>
            </div>
            <div>
              <span>ReCAPTCHA</span>
              <strong>{booleanLabel(configuration.orderFormConfiguration.recaptchaValidation)}</strong>
            </div>
            <div>
              <span>Consentimiento</span>
              <strong>{booleanLabel(configuration.orderFormConfiguration.savePersonalDataAsOptIn)}</strong>
            </div>
            <div>
              <span>Precio manual</span>
              <strong>{booleanLabel(configuration.orderFormConfiguration.allowManualPrice)}</strong>
            </div>
          </section>

          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <div>
                <h2>Reglas activas</h2>
                <p>Solo ajustes editables desde Checkout. Idioma, moneda y país vienen del contexto activo.</p>
              </div>
            </div>
            <dl className="pricingDefinitionGrid checkoutConfigurationDefinitionGrid">
              <div><dt>Score mínimo</dt><dd>{configuration.orderFormConfiguration.recaptchaMinScore}</dd></div>
              <div><dt>Métodos de primera cuota</dt><dd>{methodsLabel(configuration.orderFormConfiguration.paymentSystemToCheckFirstInstallment)}</dd></div>
              <div><dt>Última actualización</dt><dd>{dateLabel(configuration.updatedAt)}</dd></div>
            </dl>
          </section>

          <CheckoutConfigurationDrawer configuration={configuration} open={drawerOpen} state={state} />
        </>
      ) : null}
    </main>
  );
}
