import {
  createCatalogOfferingAction,
  deactivateCatalogOfferingAction,
  updateCatalogOfferingAction,
} from "../../../../../src/modules/catalogo/catalog-offerings-actions";
import { CatalogOfferingsPage } from "../../../../../src/modules/catalogo/catalog-offerings-page";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { makeProductGateway } from "../../../../../src/modules/catalogo/products";

type OfferingsPageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: string;
    status?: string;
    panel?: string;
    offeringId?: string;
  }>;
};

export default async function OfferingsPage({ searchParams }: OfferingsPageProps) {
  const params = await searchParams;
  const context = await getAdminContext();
  const filters = {
    q: params?.q ?? "",
    type: params?.type ?? "",
    status: params?.status ?? "active",
    panel: params?.panel === "create" || params?.panel === "edit" ? params.panel : "",
    offeringId: params?.offeringId ?? "",
  } as const;
  const result = await makeProductGateway(context).listOfferings({
    q: filters.q,
    type: filters.type,
    includeInactive: filters.status === "all",
  });

  return (
    <CatalogOfferingsPage
      createAction={createCatalogOfferingAction}
      deactivateAction={deactivateCatalogOfferingAction}
      filters={filters}
      offerings={result.ok ? result.data : []}
      updateAction={updateCatalogOfferingAction}
    />
  );
}
