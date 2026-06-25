"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminContext } from "../shared/config/admin-context";
import type { OrganizationShopDirectory } from "../modules/configuracion/organization-shop";

type AdminContextSelectorProps = {
  context: AdminContext;
  directory: OrganizationShopDirectory;
  updateAction: (formData: FormData) => void | Promise<void>;
};

export function AdminContextSelector({
  context,
  directory,
  updateAction,
}: AdminContextSelectorProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasDirectory = directory.source === "bff" && directory.organizations.length > 0;
  const redirectTo = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);
  const currentOrganizationId =
    context.organizationId ||
    directory.organizations.find((organization) =>
      organization.shops.some((shop) =>
        shop.id === context.shopId ||
        (!context.shopId && Boolean(shop.shopAlias) && shop.shopAlias === context.shopAlias),
      ),
    )?.id ||
    "";
  const [organizationId, setOrganizationId] = useState(currentOrganizationId);
  const [shopId, setShopId] = useState(context.shopId);
  const [shopAlias, setShopAlias] = useState(context.shopAlias);
  const selectedOrganization = directory.organizations.find(
    (organization) => organization.id === organizationId,
  );
  const shops = useMemo(() => selectedOrganization?.shops ?? [], [selectedOrganization]);
  const selectedShop = shops.find((shop) => shop.id === shopId);
  const isCurrent = (shop: { id: string; shopAlias?: string }) =>
    shop.id === context.shopId ||
    (!context.shopId && Boolean(shop.shopAlias) && shop.shopAlias === context.shopAlias);

  return (
    <form
      action={updateAction}
      className="adminContextForm"
      aria-label="Selector de contexto Admin"
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {hasDirectory ? (
        <>
          <select
            aria-label="Organization"
            name="organizationId"
            value={organizationId}
            onChange={(event) => {
              setOrganizationId(event.target.value);
              setShopId("");
              setShopAlias("");
            }}
          >
            <option value="">Organization</option>
            {directory.organizations.map((organization) => (
              <option value={organization.id} key={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Shop"
            name="shopId"
            value={shopId}
            onChange={(event) => {
              const nextShopId = event.target.value;
              const nextShop = shops.find((shop) => shop.id === nextShopId);
              setShopId(nextShopId);
              setShopAlias(nextShop?.shopAlias ?? "");
            }}
          >
            <option value="">Shop</option>
            {shops.map((shop) => (
              <option value={shop.id} key={`${shop.organizationId}:${shop.id}`}>
                {isCurrent(shop) ? "Activa - " : ""}
                {shop.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Shop alias"
            name="shopAlias"
            placeholder="shopAlias"
            value={shopAlias}
            onChange={(event) => setShopAlias(event.target.value)}
          />
          <input type="hidden" name="shopName" value={selectedShop?.name ?? context.shopName} />
          <input type="hidden" name="primaryDomain" value={selectedShop?.primaryDomain ?? context.primaryDomain} />
          <input type="hidden" name="shopStatus" value={selectedShop?.status ?? context.shopStatus} />
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
            aria-label="Shop alias"
            name="shopAlias"
            placeholder="shopAlias"
            defaultValue={context.shopAlias}
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
