import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  addAttributeFeatureValueAction,
  createAttributeFeatureAction,
  deactivateAttributeFeatureAction,
  removeAttributeFeatureValueAction,
  updateAttributeFeatureAction,
} from "../../../../../src/modules/catalogo/catalog-attributes-features-actions";
import {
  listCatalogAttributeFeatureData,
  type CatalogAttributeFeatureFilters,
} from "../../../../../src/modules/catalogo/catalog-attributes-features";
import { CatalogAttributesFeaturesPage } from "../../../../../src/modules/catalogo/catalog-attributes-features-page";
import { listCatalogEntities } from "../../../../../src/modules/catalogo/catalog-taxonomy";

type AtributosCaracteristicasPageProps = {
  searchParams?: Promise<{
    tab?: string;
    id?: string;
    q?: string;
    group?: string;
    status?: string;
    panel?: string;
    fieldId?: string;
  }>;
};

export default async function AtributosCaracteristicasPage({
  searchParams,
}: AtributosCaracteristicasPageProps) {
  const context = await getAdminContext();
  const params = await searchParams;
  const filters: CatalogAttributeFeatureFilters = {
    tab: "features" as const,
    id: params?.id ?? "",
    q: params?.q ?? "",
    group: params?.group ?? "",
    status: params?.status ?? "active",
    panel: params?.panel === "create" || params?.panel === "edit" ? params.panel : "",
    fieldId: params?.fieldId ?? "",
  };
  const [data, categories] = await Promise.all([
    listCatalogAttributeFeatureData(context),
    listCatalogEntities(context, "categories", {
      limit: 100,
      offset: 0,
      isActive: true,
    }),
  ]);

  return (
    <CatalogAttributesFeaturesPage
      addValueAction={addAttributeFeatureValueAction}
      categories={categories}
      createAction={createAttributeFeatureAction}
      data={data}
      deactivateAction={deactivateAttributeFeatureAction}
      filters={filters}
      removeValueAction={removeAttributeFeatureValueAction}
      updateAction={updateAttributeFeatureAction}
    />
  );
}
