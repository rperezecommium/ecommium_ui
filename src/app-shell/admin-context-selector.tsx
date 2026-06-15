import type { AdminContext } from "../shared/config/admin-context";
import { updateAdminContext } from "../shared/config/admin-context";
import type { OrganizationShopDirectory } from "../modules/configuracion/organization-shop";

type AdminContextSelectorProps = {
  context: AdminContext;
  directory: OrganizationShopDirectory;
};

export function AdminContextSelector({ context, directory }: AdminContextSelectorProps) {
  const hasDirectory = directory.source === "bff" && directory.organizations.length > 0;
  const shops = directory.organizations.flatMap((organization) =>
    organization.shops.map((shop) => ({
      ...shop,
      organizationName: organization.name,
    })),
  );

  return (
    <form
      action={updateAdminContext}
      className="adminContextForm"
      aria-label="Selector de contexto Admin"
    >
      <input type="hidden" name="redirectTo" value="/admin" />
      {hasDirectory ? (
        <>
          <select aria-label="Organization" name="organizationId" defaultValue={context.organizationId}>
            <option value="">Organization</option>
            {directory.organizations.map((organization) => (
              <option value={organization.id} key={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <select aria-label="Shop" name="shopId" defaultValue={context.shopId}>
            <option value="">Shop</option>
            {shops.map((shop) => (
              <option value={shop.id} key={`${shop.organizationId}:${shop.id}`}>
                {shop.organizationName} / {shop.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <input
            aria-label="Organization ID"
            name="organizationId"
            placeholder="organizationId"
            defaultValue={context.organizationId}
          />
          <input
            aria-label="Shop ID"
            name="shopId"
            placeholder="shopId"
            defaultValue={context.shopId}
          />
        </>
      )}
      <select aria-label="Locale" name="locale" defaultValue={context.locale}>
        <option value="es-ES">es-ES</option>
        <option value="en-US">en-US</option>
        <option value="pt-PT">pt-PT</option>
      </select>
      <input type="hidden" name="currency" value={context.currency} />
      <input type="hidden" name="country" value={context.country} />
      <input type="hidden" name="channel" value={context.channel} />
      <button className="adminButton" type="submit">
        Aplicar
      </button>
    </form>
  );
}
