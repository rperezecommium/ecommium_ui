import Link from "next/link";
import { ExternalLink, ImageIcon, Trash2, Upload } from "lucide-react";
import type { AdminContext } from "../../shared/config/admin-context";
import { safeMediaInputAccept } from "../../shared/security/media-upload";
import type { MediaAdminCollection, MediaAdminListResult } from "./media-admin";

type Action = (formData: FormData) => Promise<void>;

export type MediaAdminFilters = {
  q?: string;
  status?: "active" | "all";
  collectionId?: string;
  mediaMessage?: string;
  limit?: number;
  offset?: number;
};

type Props = {
  context: AdminContext;
  filters: MediaAdminFilters;
  collections: MediaAdminListResult;
  selectedCollection?: MediaAdminCollection;
  selectedError?: string;
  addItemsAction: Action;
  createCollectionAction: Action;
  softDeleteAssetAction: Action;
  softDeleteAction: Action;
  updateAssetAction: Action;
  updateCollectionAction: Action;
};

function mediaHref(filters: MediaAdminFilters, overrides: Partial<MediaAdminFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status && next.status !== "active") params.set("status", next.status);
  if (next.collectionId) params.set("collectionId", next.collectionId);
  if (next.limit && next.limit !== 50) params.set("limit", String(next.limit));
  if (next.offset) params.set("offset", String(next.offset));
  const query = params.toString();
  return query ? `/admin/catalogo/media?${query}` : "/admin/catalogo/media";
}

function valueText(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  return typeof value === "string" && value.trim() ? value : "-";
}

function fileSize(value: number | undefined) {
  if (!value) {
    return "-";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function assetContentUrl(mediaAssetId: string, variant = "small_default") {
  return `/api/admin/media-assets/${encodeURIComponent(mediaAssetId)}/content?variant=${encodeURIComponent(variant)}`;
}

function detailReturnPath(closeHref: string, mediaCollectionId: string) {
  return closeHref.includes("?")
    ? `${closeHref}&collectionId=${encodeURIComponent(mediaCollectionId)}`
    : `${closeHref}?collectionId=${encodeURIComponent(mediaCollectionId)}`;
}

function localizedValue(value: Record<string, string>, locale: string) {
  return value[locale] ?? value["es-ES"] ?? value.es ?? Object.values(value)[0] ?? "";
}

function ResultBanner({ result }: { result: MediaAdminListResult }) {
  if (result.source !== "unavailable") {
    return null;
  }

  return (
    <div className="adminBanner adminBannerError">
      <p>{result.message ?? "Media no esta disponible."}</p>
      {result.failedEndpoint ? <p className="adminContextHint">{result.failedEndpoint}</p> : null}
      {result.correlationId ? <p className="adminContextHint">Correlation: {result.correlationId}</p> : null}
    </div>
  );
}

function CollectionSummary({
  collection,
  context,
}: {
  collection: MediaAdminCollection;
  context: AdminContext;
}) {
  return (
    <section className="adminSummaryGrid" aria-label="Resumen de coleccion media">
      <div>
        <span>Coleccion</span>
        <strong>{collection.mediaCollectionId}</strong>
      </div>
      <div>
        <span>Producto</span>
        <strong>{collection.productId ?? "Sin producto asociado"}</strong>
      </div>
      <div>
        <span>Locale</span>
        <strong>{collection.defaultLocale ?? context.locale}</strong>
      </div>
      <div>
        <span>Assets</span>
        <strong>{collection.itemCount}</strong>
      </div>
    </section>
  );
}

function CollectionPreview({
  collection,
  context,
}: {
  collection: MediaAdminCollection;
  context: AdminContext;
}) {
  const visibleAssets = collection.items.slice(0, 3);

  if (visibleAssets.length === 0) {
    return (
      <div className="mediaAdminCollectionPreview mediaAdminCollectionPreviewEmpty" aria-label="Sin imagenes en la lista">
        <ImageIcon aria-hidden="true" size={20} />
      </div>
    );
  }

  return (
    <div className="mediaAdminCollectionPreview" aria-label={`Imagenes de ${collection.title}`}>
      {visibleAssets.map((asset) => {
        const alt = localizedValue(asset.alt, context.locale) || asset.fileName;

        return (
          <div className="mediaAdminCollectionThumb" key={asset.mediaAssetId}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetContentUrl(asset.mediaAssetId)} alt={alt} />
          </div>
        );
      })}
      {collection.itemCount > visibleAssets.length ? (
        <span className="mediaAdminCollectionMore">+{collection.itemCount - visibleAssets.length}</span>
      ) : null}
    </div>
  );
}

function AssetGrid({
  collection,
  context,
  returnPath,
  softDeleteAssetAction,
  updateAssetAction,
}: {
  collection: MediaAdminCollection;
  context: AdminContext;
  returnPath: string;
  softDeleteAssetAction: Action;
  updateAssetAction: Action;
}) {
  if (collection.items.length === 0) {
    return <div className="adminEmptyState">Esta coleccion no incluye assets en el detalle recibido.</div>;
  }

  return (
    <div className="mediaAdminAssetGrid">
      {collection.items.map((asset) => {
        const alt = localizedValue(asset.alt, context.locale) || asset.fileName;
        const title = localizedValue(asset.title, context.locale) || asset.fileName;

        return (
          <article className="mediaAdminAssetCard" key={asset.mediaAssetId}>
            <div className="mediaAdminAssetPreview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetContentUrl(asset.mediaAssetId)} alt={alt} />
            </div>
            <div className="mediaAdminAssetBody">
              <h3>{asset.fileName}</h3>
              <dl className="productPreviewMetaGrid">
                <div><dt>Asset ID</dt><dd>{asset.mediaAssetId}</dd></div>
                <div><dt>MIME</dt><dd>{asset.mimeType}</dd></div>
                <div><dt>Tamano</dt><dd>{fileSize(asset.fileSize)}</dd></div>
                <div><dt>Principal</dt><dd>{valueText(asset.isMain)}</dd></div>
                <div><dt>Activo</dt><dd>{valueText(asset.active)}</dd></div>
                <div><dt>Posicion</dt><dd>{asset.position ?? "-"}</dd></div>
              </dl>
              <div className="mediaAdminAssetText">
                <span>Alt</span>
                <strong>{alt || "-"}</strong>
              </div>
              <div className="mediaAdminAssetText">
                <span>Title</span>
                <strong>{title || "-"}</strong>
              </div>
              <Link className="adminButton adminButtonTiny" href={assetContentUrl(asset.mediaAssetId, "original")} target="_blank">
                <ExternalLink aria-hidden="true" size={14} />
                Original
              </Link>
              <form action={updateAssetAction} className="mediaAdminAssetEditForm">
                <input name="mediaCollectionId" type="hidden" value={collection.mediaCollectionId} />
                <input name="mediaAssetId" type="hidden" value={asset.mediaAssetId} />
                <input name="returnPath" type="hidden" value={returnPath} />
                <input name="locale" type="hidden" value={context.locale} />
                <label className="adminField">
                  <span>Alt</span>
                  <input name="alt" defaultValue={alt} />
                </label>
                <label className="adminField">
                  <span>Title</span>
                  <input name="title" defaultValue={title} />
                </label>
                <label className="adminField">
                  <span>Posicion</span>
                  <input min="0" name="position" type="number" defaultValue={asset.position ?? 0} />
                </label>
                <div className="mediaAdminAssetSwitches">
                  <label>
                    <input name="isMain" type="hidden" value="false" />
                    <input name="isMain" type="checkbox" value="true" defaultChecked={asset.isMain} />
                    Principal
                  </label>
                  <label>
                    <input name="isActive" type="hidden" value="false" />
                    <input name="isActive" type="checkbox" value="true" defaultChecked={asset.active} />
                    Activo
                  </label>
                </div>
                <button className="adminButton adminButtonPrimary adminButtonTiny" type="submit">
                  Guardar asset
                </button>
              </form>
              <form action={softDeleteAssetAction} className="mediaAdminAssetDeleteForm">
                <input name="mediaCollectionId" type="hidden" value={collection.mediaCollectionId} />
                <input name="mediaAssetId" type="hidden" value={asset.mediaAssetId} />
                <input name="returnPath" type="hidden" value={returnPath} />
                <label>
                  <input name="confirmSoftDeleteAsset" type="checkbox" value="yes" />
                  Confirmo baja del asset
                </label>
                <button className="adminButton adminButtonDanger adminButtonTiny" type="submit">
                  <Trash2 aria-hidden="true" size={14} />
                  Desactivar asset
                </button>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CollectionDetailDrawer({
  collection,
  context,
  selectedError,
  addItemsAction,
  softDeleteAssetAction,
  softDeleteAction,
  updateAssetAction,
  updateCollectionAction,
  closeHref,
}: {
  collection?: MediaAdminCollection;
  context: AdminContext;
  selectedError?: string;
  addItemsAction: Action;
  softDeleteAssetAction: Action;
  softDeleteAction: Action;
  updateAssetAction: Action;
  updateCollectionAction: Action;
  closeHref: string;
}) {
  if (selectedError) {
    return (
      <div className="adminDrawerBackdrop mediaAdminDrawerBackdrop">
        <Link aria-label="Cerrar detalle media" className="mediaAdminDrawerBackdropLink" href={closeHref} />
        <aside aria-label="Detalle de coleccion media" aria-modal="true" className="adminSideDrawer mediaAdminSideDrawer" role="dialog">
          <div className="adminSideDrawerHeader">
            <div>
              <h2>No se pudo cargar la coleccion</h2>
              <p>El detalle solicitado no esta disponible en este momento.</p>
            </div>
            <Link className="adminButton" href={closeHref}>Cerrar</Link>
          </div>
          <div className="mediaAdminDrawerBody">
            <div className="adminBanner adminBannerError"><p>{selectedError}</p></div>
          </div>
        </aside>
      </div>
    );
  }
  if (!collection) {
    return null;
  }
  const returnPath = detailReturnPath(closeHref, collection.mediaCollectionId);

  return (
    <div className="adminDrawerBackdrop mediaAdminDrawerBackdrop">
      <Link aria-label="Cerrar detalle media" className="mediaAdminDrawerBackdropLink" href={closeHref} />
      <aside aria-label="Detalle de coleccion media" aria-modal="true" className="adminSideDrawer mediaAdminSideDrawer" role="dialog">
      <div className="adminSideDrawerHeader">
        <div>
          <h2>{collection.title}</h2>
          <p>{collection.mediaCollectionId}</p>
        </div>
        <div className="mediaAdminDrawerHeaderActions">
          <span className={`adminBadge ${collection.active ? "adminBadgeOk" : "adminBadgeWarn"}`}>
            {collection.active ? "Activa" : "Inactiva"}
          </span>
          <Link className="adminButton" href={closeHref}>Cerrar</Link>
        </div>
      </div>

      <div className="mediaAdminDrawerBody">
        <form action={updateCollectionAction} className="mediaAdminCollectionEditForm">
          <input name="mediaCollectionId" type="hidden" value={collection.mediaCollectionId} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <label className="adminField">
            <span>Titulo de coleccion</span>
            <input name="title" defaultValue={collection.title} />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">
            Guardar coleccion
          </button>
        </form>
        <CollectionSummary collection={collection} context={context} />
        <form action={addItemsAction} className="mediaAdminUploadForm" encType="multipart/form-data">
          <input name="mediaCollectionId" type="hidden" value={collection.mediaCollectionId} />
          <input name="returnPath" type="hidden" value={returnPath} />
          <input name="defaultLocale" type="hidden" value={collection.defaultLocale ?? context.locale} />
          <div className="mediaAdminUploadHeader">
            <div>
              <strong>Anadir assets</strong>
              <p>Sube archivos a esta coleccion existente.</p>
            </div>
            <button className="adminButton adminButtonPrimary" type="submit">
              <Upload aria-hidden="true" size={16} />
              Subir
            </button>
          </div>
          <label className="adminField adminFieldFull">
            <span>Archivos</span>
            <input multiple name="files" type="file" accept={safeMediaInputAccept} />
          </label>
          <div className="mediaAdminUploadMeta">
            <label className="adminField">
              <span>Alt comun</span>
              <input name="alt" placeholder="Texto accesible opcional" />
            </label>
            <label className="adminField">
              <span>Title comun</span>
              <input name="assetTitle" placeholder="Titulo opcional" />
            </label>
          </div>
        </form>
        <AssetGrid
          collection={collection}
          context={context}
          returnPath={returnPath}
          softDeleteAssetAction={softDeleteAssetAction}
          updateAssetAction={updateAssetAction}
        />

        <form action={softDeleteAction} className="mediaAdminDangerPanel">
          <input name="mediaCollectionId" type="hidden" value={collection.mediaCollectionId} />
          <input name="returnPath" type="hidden" value={closeHref} />
          <div>
            <strong>Baja segura</strong>
            <p>Desactiva la coleccion con `mode=soft`. No se expone borrado hard desde Admin Media.</p>
          </div>
          <label>
            <input name="confirmSoftDelete" type="checkbox" value="yes" />
            Confirmo la baja segura
          </label>
          <button className="adminButton adminButtonDanger" type="submit">
            <Trash2 aria-hidden="true" size={16} />
            Desactivar coleccion
          </button>
        </form>
      </div>
      </aside>
    </div>
  );
}

export function MediaAdminPage({
  context,
  filters,
  collections,
  selectedCollection,
  selectedError,
  addItemsAction,
  createCollectionAction,
  softDeleteAssetAction,
  softDeleteAction,
  updateAssetAction,
  updateCollectionAction,
}: Props) {
  const limit = filters.limit ?? collections.limit ?? 50;
  const offset = filters.offset ?? collections.offset ?? 0;
  const nextOffset = offset + limit;
  const previousOffset = Math.max(0, offset - limit);
  const closeDetailHref = mediaHref(filters, { collectionId: undefined });
  const listReturnHref = mediaHref(filters, { collectionId: undefined, mediaMessage: undefined });

  return (
    <main className="adminPage mediaAdminPage">
      <div className="adminBreadcrumb">Admin / Catalogo / Media</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Media / Archivos</h1>
          <p className="adminPageIntro">Biblioteca de colecciones y assets usados por productos y combinaciones.</p>
        </div>
        <Link className="adminButton" href="/admin/catalogo/media">
          Refrescar
        </Link>
      </div>

      {filters.mediaMessage ? (
        <div className="adminBanner">
          <p>{filters.mediaMessage}</p>
        </div>
      ) : null}

      <form aria-label="Filtros media" className="pricingFilterBar" method="get">
        <label className="adminField">
          <span>Buscar</span>
          <input name="q" defaultValue={filters.q ?? ""} placeholder="Producto o coleccion" />
        </label>
        <label className="adminField">
          <span>Estado</span>
          <select name="status" defaultValue={filters.status ?? "active"}>
            <option value="active">Activas</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <label className="adminField">
          <span>Limite</span>
          <select name="limit" defaultValue={String(limit)}>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <button className="adminButton adminButtonPrimary" type="submit">Aplicar</button>
        <Link className="adminButton" href="/admin/catalogo/media">Limpiar</Link>
      </form>

      <ResultBanner result={collections} />

      <div className="mediaAdminLayout">
        <section className="pricingPanel">
          <div className="pricingPanelHeader">
            <div>
              <h2>Colecciones</h2>
              <p>{collections.total} registros</p>
            </div>
            <span className="adminBadge">{context.organizationId || "Sin organization"} / {context.shopId || "Sin shop"}</span>
          </div>

          <form action={createCollectionAction} className="mediaAdminCreateForm" encType="multipart/form-data">
            <input name="returnPath" type="hidden" value={listReturnHref} />
            <input name="defaultLocale" type="hidden" value={context.locale} />
            <label className="adminField">
              <span>Producto</span>
              <input name="productId" placeholder="UUID del producto" />
            </label>
            <label className="adminField">
              <span>Titulo</span>
              <input name="title" placeholder="Nombre de la galeria" />
            </label>
            <label className="adminField">
              <span>Archivos</span>
              <input multiple name="files" type="file" accept={safeMediaInputAccept} />
            </label>
            <label className="adminField">
              <span>Alt comun</span>
              <input name="alt" placeholder="Opcional" />
            </label>
            <label className="adminField">
              <span>Title comun</span>
              <input name="assetTitle" placeholder="Opcional" />
            </label>
            <button className="adminButton adminButtonPrimary" type="submit">
              <Upload aria-hidden="true" size={16} />
              Crear coleccion
            </button>
          </form>

          {collections.items.length === 0 ? (
            <div className="adminEmptyState">
              <ImageIcon aria-hidden="true" size={28} />
              <p>No hay colecciones media para el filtro actual.</p>
            </div>
          ) : (
            <div className="adminTableScroller">
              <table className="adminTable pricingTable mediaAdminTable">
                <thead>
                  <tr>
                    <th scope="col">Vista</th>
                    <th scope="col">Coleccion</th>
                    <th scope="col">Producto</th>
                    <th scope="col">Assets</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Actualizada</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.items.map((collection) => (
                    <tr
                      className={filters.collectionId === collection.mediaCollectionId ? "mediaAdminSelectedRow" : undefined}
                      key={collection.mediaCollectionId}
                    >
                      <td>
                        <CollectionPreview collection={collection} context={context} />
                      </td>
                      <td>
                        <strong>{collection.title}</strong>
                        <div className="adminContextHint">{collection.mediaCollectionId}</div>
                      </td>
                      <td>{valueText(collection.productId)}</td>
                      <td>{collection.itemCount}</td>
                      <td>
                        <span className={`adminBadge ${collection.active ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                          {collection.active ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td>{valueText(collection.updatedAt)}</td>
                      <td>
                        <Link
                          className="adminButton adminButtonTiny"
                          href={mediaHref(filters, { collectionId: collection.mediaCollectionId })}
                        >
                          Revisar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="productListPagination">
            <Link
              aria-disabled={offset === 0}
              className={`adminButton ${offset === 0 ? "adminButtonDisabled" : ""}`}
              href={mediaHref(filters, { offset: previousOffset })}
            >
              Anterior
            </Link>
            <span>{offset + 1}-{Math.min(nextOffset, collections.total || nextOffset)}</span>
            <Link
              aria-disabled={nextOffset >= collections.total}
              className={`adminButton ${nextOffset >= collections.total ? "adminButtonDisabled" : ""}`}
              href={mediaHref(filters, { offset: nextOffset })}
            >
              Siguiente
            </Link>
          </div>
        </section>

        <CollectionDetailDrawer
          collection={selectedCollection}
          context={context}
          closeHref={closeDetailHref}
          selectedError={selectedError}
          addItemsAction={addItemsAction}
          softDeleteAssetAction={softDeleteAssetAction}
          softDeleteAction={softDeleteAction}
          updateAssetAction={updateAssetAction}
          updateCollectionAction={updateCollectionAction}
        />
      </div>
    </main>
  );
}
