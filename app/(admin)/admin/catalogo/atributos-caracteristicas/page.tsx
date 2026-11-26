import { featureDeletionAvailable } from "../../../../../src/modules/catalogo/feature-deletion-actions";
import { getCurrentAdminSession } from "../../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  addAttributeFeatureValueAction,
  createAttributeFeatureAction,
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
    createdFieldId?: string;
    fieldDeleteOperation?: string;
    mutationError?: string;
    updatedFieldId?: string;
    expectedActive?: string;
  }>;
};

export default async function AtributosCaracteristicasPage({
  searchParams,
}: AtributosCaracteristicasPageProps) {
  const context = await getAdminContext();
  const session = await getCurrentAdminSession();
  const hasDeletePermission = session?.permissions.some((p) =>
    ["*", "admin:*", "system.admin", "catalog.specifications.delete"].includes(
      p,
    ),
  );
  const canDelete = hasDeletePermission && (await featureDeletionAvailable());
  const canDeactivate = session?.permissions.some((p) =>
    ["*", "admin:*", "system.admin", "catalog.specifications.write"].includes(
      p,
    ),
  );
  const params = await searchParams;
  const filters: CatalogAttributeFeatureFilters = {
    tab: params?.tab === "attributes" ? "attributes" : "features",
    id: params?.id ?? "",
    q: params?.q ?? "",
    group: params?.group ?? "",
    status: params?.status ?? "active",
    panel:
      params?.panel === "create" || params?.panel === "edit"
        ? params.panel
        : "",
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
      deletionEnabled={Boolean(canDelete)}
      deletionContext={
        hasDeletePermission
          ? {
              organizationId: context.organizationId,
              shopId: context.shopId,
              locale: context.locale,
              shopName: context.shopName || context.shopAlias,
            }
          : undefined
      }
      deletionOperationId={params?.fieldDeleteOperation}
      updatedFieldId={params?.updatedFieldId}
      expectedActive={params?.expectedActive}
      mutationError={params?.mutationError}
      addValueAction={addAttributeFeatureValueAction}
      categories={categories}
      createdFieldId={params?.createdFieldId}
      createAction={createAttributeFeatureAction}
      data={data}
      deactivationContext={
        canDeactivate
          ? {
              organizationId: context.organizationId,
              shopId: context.shopId,
              locale: context.locale,
              shopName: context.shopName || context.shopAlias,
            }
          : undefined
      }
      filters={filters}
      removeValueAction={removeAttributeFeatureValueAction}
      updateAction={updateAttributeFeatureAction}
    />
  );
}
