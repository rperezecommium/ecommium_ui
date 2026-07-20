import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  createCategoryAction,
  hardDeleteCategoryAction,
  softDeleteCategoryAction,
  updateCategoryAction,
} from "../../../../../src/modules/catalogo/catalog-taxonomy-actions";
import { CatalogEntityAdminPage } from "../../../../../src/modules/catalogo/catalog-entity-admin-page";
import { listCatalogEntities } from "../../../../../src/modules/catalogo/catalog-taxonomy";

type CategoriasPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
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

export default async function CategoriasPage({ searchParams }: CategoriasPageProps) {
  const context = await getAdminContext();
  const params = await searchParams;
  const q = params.q ?? "";
  const status = params.status ?? "active";
  const list = await listCatalogEntities(context, "categories", {
    q,
    isActive: statusToIsActive(status),
    limit: 100,
    offset: 0,
  });

  return (
    <CatalogEntityAdminPage
      breadcrumb="Categorias"
      createAction={createCategoryAction}
      description="Organiza el arbol comercial, breadcrumbs, categorias padre e hijas y visibilidad por tienda."
      hardDeleteAction={hardDeleteCategoryAction}
      list={list}
      q={q}
      softDeleteAction={softDeleteCategoryAction}
      status={status}
      title="Categorias"
      updateAction={updateCategoryAction}
    />
  );
}
