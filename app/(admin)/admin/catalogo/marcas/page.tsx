import {getCurrentAdminSession as getAdminSession} from "../../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { CatalogEntityAdminPage } from "../../../../../src/modules/catalogo/catalog-entity-admin-page";
import {
  createBrandAction,
  hardDeleteBrandAction,
  softDeleteBrandAction,
  updateBrandAction,
} from "../../../../../src/modules/catalogo/catalog-taxonomy-actions";
import { listCatalogEntities } from "../../../../../src/modules/catalogo/catalog-taxonomy";

type MarcasPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    drawer?: string;
  }>;
};

function statusToIsActive(status: string) {
  if (status === "inactive") {
    return false;
  }
  if (status === "all") {
    return null;
  }

  return true;
}

export default async function MarcasPage({ searchParams }: MarcasPageProps) {
  const context = await getAdminContext();
  const session=await getAdminSession();
  const canCreate=!!session?.permissions.some(permission=>["*","admin:*","system.admin","catalog.brands.write"].includes(permission));
  const params = await searchParams;
  const q = params.q ?? "";
  const status = params.status ?? "active";
  const list = await listCatalogEntities(context, "brands", {
    q,
    isActive: statusToIsActive(status),
    limit: 100,
    offset: 0,
  });

  return (
    <CatalogEntityAdminPage
      kind="brands"
      createDrawerOpen={params.drawer === "create"}
      breadcrumb="Marcas / Proveedores"
      canCreate={canCreate}
      createAction={createBrandAction}
      description="Gestiona marcas, proveedores, fabricantes y colecciones asociadas al catalogo comercial."
      hardDeleteAction={hardDeleteBrandAction}
      list={list}
      q={q}
      softDeleteAction={softDeleteBrandAction}
      status={status}
      title="Marcas / Proveedores"
      updateAction={updateBrandAction}
    />
  );
}
