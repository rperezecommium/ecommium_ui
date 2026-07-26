import {
  addMediaCollectionItemsAction,
  createMediaCollectionAction,
  softDeleteMediaAssetAction,
  softDeleteMediaCollectionAction,
  updateMediaAssetAction,
  updateMediaCollectionAction,
} from "../../../../../src/modules/catalogo/media-admin-actions";
import { MediaAdminPage } from "../../../../../src/modules/catalogo/media-admin-page";
import { getMediaCollection, listMediaCollections } from "../../../../../src/modules/catalogo/media-admin";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";

type CatalogoMediaPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    collectionId?: string;
    mediaMessage?: string;
    limit?: string;
    offset?: string;
  }>;
};

function numberParam(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

export default async function CatalogoMediaPage({ searchParams }: CatalogoMediaPageProps) {
  const params = await searchParams;
  const context = await getAdminContext();
  const filters = {
    q: params?.q ?? "",
    status: params?.status === "all" ? "all" as const : "active" as const,
    collectionId: params?.collectionId ?? "",
    mediaMessage: params?.mediaMessage ?? "",
    limit: numberParam(params?.limit, 50),
    offset: numberParam(params?.offset, 0),
  };
  const collections = await listMediaCollections(context, {
    q: filters.q,
    status: filters.status,
    limit: filters.limit,
    offset: filters.offset,
  });
  const selectedResult = filters.collectionId
    ? await getMediaCollection(context, filters.collectionId)
    : undefined;

  return (
    <MediaAdminPage
      collections={collections}
      context={context}
      filters={filters}
      selectedCollection={selectedResult?.ok ? selectedResult.data : undefined}
      selectedError={selectedResult && !selectedResult.ok ? selectedResult.error : undefined}
      addItemsAction={addMediaCollectionItemsAction}
      createCollectionAction={createMediaCollectionAction}
      softDeleteAssetAction={softDeleteMediaAssetAction}
      softDeleteAction={softDeleteMediaCollectionAction}
      updateAssetAction={updateMediaAssetAction}
      updateCollectionAction={updateMediaCollectionAction}
    />
  );
}
