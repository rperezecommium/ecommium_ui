import type { AdminContext } from "../../shared/config/admin-context";
import type {
  InheritanceStatus,
  OrganizationShopDirectory,
  ShopOption,
  ShopSettingsInheritance,
} from "./organization-shop";
import { isCurrentShop, withCurrentShopState } from "./organization-shop";

type ContextSettingsPageProps = {
  context: AdminContext;
  createShopAction: (formData: FormData) => Promise<void>;
  directory: OrganizationShopDirectory;
  error?: string;
  inheritance: ShopSettingsInheritance;
  notice?: string;
  updateAction: (formData: FormData) => Promise<void>;
  updateShopAction: (formData: FormData) => Promise<void>;
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

function findCurrentShop(directory: OrganizationShopDirectory, context: AdminContext) {
  for (const organization of directory.organizations) {
    const shop = organization.shops.find((item) => isCurrentShop(item, context));

    if (shop) {
      return {
        ...shop,
        organizationName: organization.name,
      };
    }
  }

  return null;
}

function allShops(directory: OrganizationShopDirectory, context: AdminContext) {
  return directory.organizations.flatMap((organization) =>
    withCurrentShopState(organization.shops, context).map((shop) => ({
      ...shop,
      organizationName: organization.name,
    })),
  );
}

function shopOptionLabel(shop: ShopOption & { organizationName: string; isCurrent?: boolean }) {
  return [
    shop.isCurrent ? "Activa - " : "",
    `${shop.organizationName} / ${shop.name}`,
    shop.shopAlias ? ` (${shop.shopAlias})` : "",
    shop.primaryDomain ? ` - ${shop.primaryDomain}` : "",
    shop.status ? ` - ${shop.status}` : "",
  ].join("");
}

export function ContextSettingsPage({
  context,
  createShopAction,
  directory,
  error,
  inheritance,
  notice,
  updateAction,
  updateShopAction,
}: ContextSettingsPageProps) {
  const shops = allShops(directory, context);
  const currentShop = findCurrentShop(directory, context);
  const hasDirectory = directory.source === "bff" && directory.organizations.length > 0;
  const isBffUnavailable = directory.source === "unavailable";
  const isUnauthorized = directory.message?.includes("401") ?? false;
  const hasNoOrganizations = directory.source === "bff" && directory.organizations.length === 0;
  const hasActiveContext = Boolean(context.organizationId && (context.shopId || context.shopAlias));
  const selectedOrganization =
    directory.organizations.find((organization) => organization.id === context.organizationId) ??
    directory.organizations[0];
  const selectedOrganizationShops = selectedOrganization
    ? withCurrentShopState(selectedOrganization.shops, context).map((shop) => ({
        ...shop,
        organizationName: selectedOrganization.name,
      }))
    : [];
  const selectedOrganizationHasNoShops =
    directory.source === "bff" && Boolean(selectedOrganization) && selectedOrganizationShops.length === 0;
  const editShop = currentShop ?? shops[0];
  const activeOrganizationName = currentShop?.organizationName ?? context.organizationId;
  const activeShopName = currentShop?.name ?? context.shopName;
  const activeShopAlias = currentShop?.shopAlias ?? context.shopAlias;
  const activeShopStatus = currentShop?.status ?? context.shopStatus;
  const activePrimaryDomain = currentShop?.primaryDomain ?? context.primaryDomain;

  return (
    <main className="adminPage">
      <div className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / Configuracion / Contexto</div>
          <h1 className="adminPageTitle">Organization, Shop y herencia</h1>
          <p className="adminPageIntro">
            Trabaja con tiendas por nombre y shopAlias. El shopId queda como
            identidad tecnica interna generada por backend.
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

      {error ? <div className="adminBanner adminBannerError">{error}</div> : null}
      {notice ? <div className="adminBanner">{notice}</div> : null}

      {isBffUnavailable ? (
        <div className="adminBanner adminBannerError">
          <strong>
            {isUnauthorized
              ? "El BFF de Ecommium requiere Authorization."
              : "No se pudo conectar con el BFF de Ecommium."}
          </strong>
          {isUnauthorized ? (
            <p>
              Configura <code>ECOMMIUM_ADMIN_BFF_TOKEN</code> en el servidor de
              Next.js para enviar <code>Authorization: Bearer &lt;token&gt;</code>.
            </p>
          ) : (
            <p>
              Para listar Organizations y Shops, levanta el backend canonico.
            </p>
          )}
          <p>
            Endpoint fallido: <code>{directory.failedEndpoint}</code>
          </p>
          {!isUnauthorized ? (
            <p>
              Comando orientativo: <code>./scripts/postman-services.sh up</code>
            </p>
          ) : null}
          <p>{directory.message}</p>
        </div>
      ) : null}

      {directory.loadWarnings?.length ? (
        <div className="adminBanner">
          <strong>El BFF respondio parcialmente.</strong>
          <p>Algunos listados secundarios no pudieron cargarse.</p>
          <ul className="adminPlainList">
            {directory.loadWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasNoOrganizations ? (
        <div className="adminEmptyState adminSection">
          <h2>No hay Organizations creadas.</h2>
          <p>
            El BFF respondio correctamente, pero no devolvio Organizations para
            listar en el selector.
          </p>
          <div className="adminButtonRow">
            <button className="adminButton adminButtonPrimary" type="button">
              Crear Organization
            </button>
            <a className="adminButton" href="#create-shop-form">
              Crear tienda despues de seleccionar o crear una Organization
            </a>
          </div>
        </div>
      ) : null}

      {!hasActiveContext ? (
        <div className="adminEmptyState adminSection">
          No hay contexto activo. Selecciona una tienda existente por nombre o
          shopAlias, o crea una nueva tienda. No necesitas escribir un UUID.
        </div>
      ) : null}

      <section className="adminKpiGrid" aria-label="Resumen de contexto activo">
        <article className="adminKpi">
          <span>Organization activa</span>
          <strong>{activeOrganizationName || "Pendiente"}</strong>
          <div className="adminMuted">{context.organizationId || "Sin organizationId"}</div>
        </article>
        <article className="adminKpi">
          <span>Shop activa</span>
          <strong>{activeShopName || "Pendiente"}</strong>
          <div className="adminMuted">{activeShopAlias || "Sin shopAlias"}</div>
        </article>
        <article className="adminKpi">
          <span>Contexto activo</span>
          <strong>{hasActiveContext ? "Activa" : "Pendiente"}</strong>
          <div className="adminMuted">{context.locale} / {context.currency} / {context.country}</div>
        </article>
        <article className="adminKpi">
          <span>Estado operativo</span>
          <strong>{activeShopStatus || "N/D"}</strong>
          <div className="adminMuted">{activePrimaryDomain || "Sin dominio"}</div>
        </article>
      </section>

      <section className="adminGrid">
        <article className="adminCard">
          <div className="adminCardHeader">
            <div>
              <h2>Selector multistore</h2>
              <p>El contexto activo se guarda en cookie httpOnly por sesion Admin.</p>
            </div>
            <span className="adminBadge">
              {hasDirectory ? "BFF" : hasNoOrganizations ? "Sin Organizations" : "Manual"}
            </span>
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

            {hasDirectory ? (
              <label className="adminField">
                <span>Shop</span>
                <select name="shopId" defaultValue={currentShop?.id ?? context.shopId}>
                  <option value="">Selecciona tienda</option>
                  {selectedOrganizationShops.map((shop) => (
                    <option value={shop.id} key={`${shop.organizationId}:${shop.id}`}>
                      {shopOptionLabel(shop)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selectedOrganizationHasNoShops ? (
              <div className="adminEmptyState">
                <strong>Esta Organization no tiene tiendas.</strong>
                <p>Crea una tienda con nombre y shopAlias. El backend generara el shopId.</p>
                <a className="adminButton adminButtonPrimary" href="#create-shop-form">
                  Crear tienda
                </a>
              </div>
            ) : null}

            {isBffUnavailable ? (
              <div className="adminEmptyState">
                <strong>Modo manual limitado</strong>
                <p>
                  Puedes indicar organizationId + shopAlias y la UI intentara
                  resolver el shopId cuando el BFF este disponible.
                </p>
              </div>
            ) : null}

            <label className="adminField">
              <span>Resolver por shopAlias</span>
              <input
                name="shopAlias"
                defaultValue={context.shopAlias}
                placeholder="tienda-barcelona"
              />
              <small>
                Si no seleccionas una tienda, se resolvera por
                organizationId + shopAlias y se guardara el shopId canonico.
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
          <h2>Resumen activo</h2>
          <table className="adminTable">
            <tbody>
              <tr>
                <th scope="row">Organization activa</th>
                <td>{activeOrganizationName || "Pendiente"}</td>
              </tr>
              <tr>
                <th scope="row">Shop activa</th>
                <td>{activeShopName || "Pendiente"}</td>
              </tr>
              <tr>
                <th scope="row">shopAlias</th>
                <td>{activeShopAlias || "Pendiente"}</td>
              </tr>
              <tr>
                <th scope="row">Contexto activo</th>
                <td>{hasActiveContext ? "Activa" : "Pendiente"}</td>
              </tr>
              <tr>
                <th scope="row">Estado operativo</th>
                <td>{activeShopStatus || "N/D"}</td>
              </tr>
              <tr>
                <th scope="row">Dominio</th>
                <td>{activePrimaryDomain || "Pendiente"}</td>
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

      <section className="adminGrid adminSection">
        <article className="adminCard">
          <div className="adminCardHeader">
            <div>
              <h2>Crear tienda</h2>
              <p>No se pide shopId. Backend genera la identidad canonica.</p>
            </div>
          </div>
          <form action={createShopAction} className="adminForm" id="create-shop-form">
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
            <div className="adminFormGrid">
              <label className="adminField">
                <span>Nombre</span>
                <input name="name" placeholder="Tienda Barcelona" />
              </label>
              <label className="adminField">
                <span>shopAlias</span>
                <input name="shopAlias" placeholder="tienda-barcelona" />
              </label>
              <label className="adminField">
                <span>Dominio principal</span>
                <input name="primaryDomain" placeholder="barcelona.example.com" />
              </label>
              <label className="adminField">
                <span>Shop group</span>
                <select name="shopGroupId" defaultValue="">
                  <option value="">Sin grupo</option>
                  {directory.organizations.flatMap((organization) =>
                    organization.shopGroups.map((group) => (
                      <option value={group.id} key={`${organization.id}:${group.id}`}>
                        {organization.name} / {group.name}
                      </option>
                    )),
                  )}
                </select>
              </label>
            </div>
            <div className="adminFormGrid">
              <label className="adminField">
                <span>Estado operativo</span>
                <select name="status" defaultValue="DRAFT">
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </label>
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
            </div>
            <label className="adminCheckbox">
              <input name="setActive" type="checkbox" defaultChecked />
              <span>Dejar esta tienda como contexto activo</span>
            </label>
            <button className="adminButton adminButtonPrimary" type="submit">
              Crear tienda
            </button>
          </form>
        </article>

        <article className="adminCard">
          <div className="adminCardHeader">
            <div>
              <h2>Editar tienda</h2>
              <p>Usa shopId internamente; el usuario edita nombre, alias, dominio y estado.</p>
            </div>
          </div>
          {editShop ? (
            <form action={updateShopAction} className="adminForm">
              <input type="hidden" name="organizationId" value={editShop.organizationId} />
              <input type="hidden" name="shopId" value={editShop.id} />
              <div className="adminFormGrid">
                <label className="adminField">
                  <span>Nombre</span>
                  <input name="name" defaultValue={editShop.name} />
                </label>
                <label className="adminField">
                  <span>shopAlias</span>
                  <input name="shopAlias" defaultValue={editShop.shopAlias} />
                </label>
                <label className="adminField">
                  <span>Dominio principal</span>
                  <input name="primaryDomain" defaultValue={editShop.primaryDomain} />
                </label>
                <label className="adminField">
                  <span>Estado operativo</span>
                  <select name="status" defaultValue={editShop.status ?? "DRAFT"}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </label>
              </div>
              <div className="adminFormGrid">
                <label className="adminField">
                  <span>Locale</span>
                  <select name="locale" defaultValue={editShop.locale ?? context.locale}>
                    <option value="es-ES">es-ES</option>
                    <option value="en-US">en-US</option>
                    <option value="pt-PT">pt-PT</option>
                  </select>
                </label>
                <label className="adminField">
                  <span>Currency</span>
                  <select name="currency" defaultValue={editShop.currency ?? context.currency}>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </label>
                <label className="adminField">
                  <span>Country</span>
                  <select name="country" defaultValue={editShop.country ?? context.country}>
                    <option value="ES">ES</option>
                    <option value="US">US</option>
                    <option value="PT">PT</option>
                  </select>
                </label>
              </div>
              <button className="adminButton" type="submit">
                Guardar cambios de tienda
              </button>
            </form>
          ) : (
            <div className="adminEmptyState">
              Selecciona una tienda existente para editar sus datos humanos.
            </div>
          )}
        </article>
      </section>

      {inheritance.source === "fallback" ? (
        <div className="adminBanner adminSection">
          Settings heredables en modo fallback. Contrato esperado: GET
          /api/v1/admin/organizations-shops/shops/context/resolve?organizationId=:org&amp;shopId=:shop
          o &amp;shopAlias=:alias.
          {inheritance.message ? ` ${inheritance.message}` : ""}
        </div>
      ) : null}

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
