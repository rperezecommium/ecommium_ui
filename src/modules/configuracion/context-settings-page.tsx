import type { AdminContext } from "../../shared/config/admin-context";
import type {
  InheritanceStatus,
  OrganizationShopDirectory,
  ShopSettingsInheritance,
} from "./organization-shop";

type ContextSettingsPageProps = {
  context: AdminContext;
  directory: OrganizationShopDirectory;
  inheritance: ShopSettingsInheritance;
  updateAction: (formData: FormData) => Promise<void>;
};

const statusLabels: Record<InheritanceStatus, string> = {
  inherited: "Heredado",
  customized: "Customizado",
  not_configured: "Sin configurar",
};

const statusClasses: Record<InheritanceStatus, string> = {
  inherited: "adminBadge adminBadgeOk",
  customized: "adminBadge",
  not_configured: "adminBadge adminBadgeWarn",
};

export function ContextSettingsPage({
  context,
  directory,
  inheritance,
  updateAction,
}: ContextSettingsPageProps) {
  const shops = directory.organizations.flatMap((organization) =>
    organization.shops.map((shop) => ({
      ...shop,
      organizationName: organization.name,
    })),
  );
  const hasDirectory = directory.source === "bff" && directory.organizations.length > 0;

  return (
    <main className="adminPage">
      <div className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / Configuracion / Contexto</div>
          <h1 className="adminPageTitle">Organization, Shop y herencia</h1>
          <p className="adminPageIntro">
            Selecciona el alcance operativo del backoffice y revisa que settings
            vienen heredados desde Organization, ShopGroup o Shop.
          </p>
        </div>
        <div className="adminButtonRow">
          <button className="adminButton" type="button">
            Restaurar herencia
          </button>
          <button className="adminButton adminButtonPrimary" form="context-settings-form" type="submit">
            Guardar contexto
          </button>
        </div>
      </div>

      {directory.source === "unavailable" ? (
        <div className="adminBanner adminBannerError">
          Endpoint pendiente o BFF no disponible: GET
          /api/v1/admin/organizations-shops/organizations. {directory.message}
        </div>
      ) : null}

      {inheritance.source === "fallback" ? (
        <div className="adminBanner">
          Settings heredables en modo fallback. Contrato esperado: GET
          /api/v1/admin/organizations-shops/shops/context/resolve?organizationId=:org&amp;shopId=:shop
          o &amp;shopAlias=:alias.
          {inheritance.message ? ` ${inheritance.message}` : ""}
        </div>
      ) : null}

      <section className="adminGrid">
        <article className="adminCard">
          <div className="adminCardHeader">
            <div>
              <h2>Selector multistore</h2>
              <p>El contexto se guarda en cookie httpOnly y viaja hacia las pantallas Admin.</p>
            </div>
            <span className="adminBadge">{hasDirectory ? "BFF" : "Manual"}</span>
          </div>

          <form action={updateAction} className="adminForm" id="context-settings-form">
            <input type="hidden" name="redirectTo" value="/admin/configuracion/contexto" />
            <label className="adminField">
              <span>Organization</span>
              {hasDirectory ? (
                <select name="organizationId" defaultValue={context.organizationId}>
                  <option value="">Selecciona organization</option>
                  {directory.organizations.map((organization) => (
                    <option value={organization.id} key={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input name="organizationId" defaultValue={context.organizationId} placeholder="org-id" />
              )}
            </label>

            <label className="adminField">
              <span>Shop</span>
              {hasDirectory ? (
                <select name="shopId" defaultValue={context.shopId}>
                  <option value="">Selecciona shop</option>
                  {shops.map((shop) => (
                    <option value={shop.id} key={`${shop.organizationId}:${shop.id}`}>
                      {shop.organizationName} / {shop.name}
                      {shop.shopAlias ? ` (${shop.shopAlias})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input name="shopId" defaultValue={context.shopId} placeholder="shop-id" />
              )}
            </label>

            <label className="adminField">
              <span>Shop alias</span>
              <input
                name="shopAlias"
                defaultValue={context.shopAlias}
                placeholder="tienda-barcelona"
              />
              <small>
                Puedes resolver contexto por alias si aun no conoces el shopId.
                El sistema usara shopId como identidad canonica cuando exista.
              </small>
            </label>

            <div className="adminFormGrid">
              <label className="adminField">
                <span>Locale</span>
                <select name="locale" defaultValue={context.locale}>
                  <option value="es-ES">es-ES</option>
                  <option value="en-US">en-US</option>
                  <option value="pt-PT">pt-PT</option>
                </select>
              </label>
              <label className="adminField">
                <span>Currency</span>
                <select name="currency" defaultValue={context.currency}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
              <label className="adminField">
                <span>Country</span>
                <select name="country" defaultValue={context.country}>
                  <option value="ES">ES</option>
                  <option value="US">US</option>
                  <option value="PT">PT</option>
                </select>
              </label>
              <label className="adminField">
                <span>Channel</span>
                <select name="channel" defaultValue={context.channel}>
                  <option value="admin">admin</option>
                  <option value="web">web</option>
                  <option value="mobile">mobile</option>
                </select>
              </label>
            </div>
          </form>
        </article>

        <aside className="adminCard">
          <h2>Jerarquia activa</h2>
          <table className="adminTable">
            <tbody>
              <tr>
                <th scope="row">Organization</th>
                <td>{context.organizationId || "Pendiente"}</td>
              </tr>
              <tr>
                <th scope="row">Shop</th>
                <td>{context.shopId || "Pendiente"}</td>
              </tr>
              <tr>
                <th scope="row">Shop alias</th>
                <td>{context.shopAlias || "Pendiente"}</td>
              </tr>
              <tr>
                <th scope="row">Locale</th>
                <td>{context.locale}</td>
              </tr>
              <tr>
                <th scope="row">Currency</th>
                <td>{context.currency}</td>
              </tr>
              <tr>
                <th scope="row">Country</th>
                <td>{context.country}</td>
              </tr>
            </tbody>
          </table>
        </aside>
      </section>

      <section className="adminCard adminSection">
        <div className="adminCardHeader">
          <div>
            <h2>Settings heredables</h2>
            <p>Metadata por campo: valor efectivo, origen y override local.</p>
          </div>
          <span className="adminBadge">{inheritance.source === "bff" ? "Contrato activo" : "Contrato pendiente"}</span>
        </div>

        <div className="adminTableScroller">
          <table className="adminTable">
            <thead>
              <tr>
                <th>Campo</th>
                <th>Estado</th>
                <th>Valor efectivo</th>
                <th>Heredado</th>
                <th>Override</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {inheritance.settings.map((setting) => (
                <tr key={setting.key}>
                  <td>
                    <strong>{setting.label}</strong>
                    <div className="adminContextHint">{setting.key}</div>
                  </td>
                  <td>
                    <span className={statusClasses[setting.status]}>
                      {statusLabels[setting.status]}
                    </span>
                  </td>
                  <td>{setting.effectiveValue}</td>
                  <td>{setting.inheritedValue ?? "-"}</td>
                  <td>{setting.overrideValue ?? "-"}</td>
                  <td>{setting.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
