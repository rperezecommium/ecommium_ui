import {randomUUID} from "node:crypto";
 import { AdminResizableDrawer } from "../../shared/ui/admin-resizable-drawer";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import {
  changeCmsPublishedPathAction,
  createCmsPageAction,
  deleteCmsPageAction,
  publishCmsPageAction,
  saveCmsDraftAction,
  saveCmsPageSettingsAction,
  saveCmsVisualModuleDefinitionAction,
  unpublishCmsPageAction,
} from "./cms-admin-actions";
import {
  blocksToJson,
  createCmsBlockFromPreset,
  getCmsBlockSurface,
  summarizePlacements,
  type CmsAdminData,
  type CmsAdminFilters,
  type CmsBlock,
  type CmsLayout,
  type CmsModulePlacement,
  type CmsModuleSlot,
  type CmsPage,
  type CmsPageDetail,
  type CmsPageSettingsResponse,
  type CmsPageVersion,
  type CmsRegionCode,
  type CmsResolvedPageSettings,
} from "./cms-admin";
import { CmsBlockEditorClient } from "./cms-block-editor-client";
import { CmsLayoutPreview } from "./cms-layout-preview";
import { CmsLayoutAreaEditorClient } from "./cms-layout-area-editor-client";

type CmsAdminPageProps = {
  context: AdminContext;
  data: CmsAdminData;
  filters: CmsAdminFilters;
};

const tabs = [
  { id: "page", label: "Pagina" },
  { id: "settings", label: "Configuracion" },
  { id: "blocks", label: "Bloques" },
  { id: "seo", label: "SEO" },
  { id: "preview", label: "Preview" },
] as const;

function cmsHref(filters: CmsAdminFilters, overrides: Partial<CmsAdminFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.status && next.status !== "all") params.set("status", next.status);
  if (next.pageType && next.pageType !== "all") params.set("pageType", next.pageType);
  if (next.locale) params.set("locale", next.locale);
  if (next.pageId) params.set("pageId", next.pageId);
  if (next.mode) params.set("mode", next.mode);
  if (next.tab) params.set("tab", next.tab);
  if (next.drawer) params.set("drawer", next.drawer);
  if (next.cmsMessage) params.set("cmsMessage", next.cmsMessage);

  const query = params.toString();
  return query ? `/admin/cms?${query}` : "/admin/cms";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusBadgeClass(status: CmsPage["status"]) {
  if (status === "PUBLISHED") return "adminBadge adminBadgeSuccess";
  if (status === "UNPUBLISHED") return "adminBadge adminBadgeWarning";
  return "adminBadge";
}

function pageTypeLabel(value: string) {
  if (value === "HOME") return "Home";
  if (value === "CONTENT") return "Contenido";
  return "Landing";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function overrideMaxWidth(overrides: Record<string, unknown>, fallback: string) {
  const tokens = asRecord(overrides.tokens);
  if (typeof overrides.maxWidth === "string" && overrides.maxWidth.trim()) return overrides.maxWidth;
  if (typeof tokens.maxWidth === "string" && tokens.maxWidth.trim()) return tokens.maxWidth;
  return fallback;
}

function overrideLayout(overrides: Record<string, unknown>, fallback: CmsLayout) {
  return typeof overrides.layout === "object" && overrides.layout !== null && !Array.isArray(overrides.layout)
    ? overrides.layout as CmsLayout
    : fallback;
}

function hasPageOverrides(settings: CmsPageSettingsResponse | null) {
  return Object.keys(settings?.settings.overrides ?? {}).length > 0;
}

function resultMessage(result: CmsAdminData[keyof CmsAdminData] | undefined) {
  if (!result || result.source === "bff") return null;
  return result.message ?? "CMS no esta disponible.";
}

type CmsReadinessStatus = "ok" | "warning";

type CmsReadinessItem = {
  label: string;
  status: CmsReadinessStatus;
  detail: string;
  tab: CmsAdminFilters["tab"];
};

function layoutAreaCount(resolved: CmsResolvedPageSettings | null) {
  if (!resolved) return 0;
  return previewRegionOrder.reduce((total, region) => total + (resolved.layout.regions[region.code]?.areas.length ?? 0), 0);
}

function moduleSlotKey(slot: Pick<CmsModuleSlot, "region" | "areaId" | "columnIndex">) {
  return `${slot.region}|${slot.areaId}|${slot.columnIndex}`;
}

function moduleSlotsFromResolvedLayout(resolved: CmsResolvedPageSettings | null): CmsModuleSlot[] {
  if (!resolved) return [];
  return previewRegionOrder.flatMap((region) =>
    (resolved.layout.regions[region.code]?.areas ?? []).flatMap((area) => {
      const columnSlots = area.columnSlots.length > 0
        ? area.columnSlots
        : area.columns.map((width, index) => ({
          columnIndex: index + 1,
          percentage: Number.parseFloat(width) || 0,
          width,
        }));

      return columnSlots.map((slot) => ({
        ...slot,
        areaId: area.areaId,
        region: region.code,
      }));
    }),
  );
}

function moduleSlotsForResolvedSettings(resolved: CmsResolvedPageSettings | null): CmsModuleSlot[] {
  const slots = new Map<string, CmsModuleSlot>();
  for (const slot of resolved?.moduleSlots ?? []) {
    slots.set(moduleSlotKey(slot), slot);
  }
  for (const slot of moduleSlotsFromResolvedLayout(resolved)) {
    if (!slots.has(moduleSlotKey(slot))) {
      slots.set(moduleSlotKey(slot), slot);
    }
  }
  return Array.from(slots.values());
}

function pageBlockCount(blocks: CmsBlock[]) {
  return blocks.filter((block) => getCmsBlockSurface(block) !== "plp").length;
}

function placedPageBlockCount(blocks: CmsBlock[], resolved: CmsResolvedPageSettings | null) {
  return blocks.filter((block, index) => (
    getCmsBlockSurface(block) !== "plp"
    && Boolean(modulePlacementForBlock(block, resolved, index + 1))
  )).length;
}

function cmsReadinessItems(
  data: CmsAdminData,
  blocks: CmsBlock[],
  version: CmsPageVersion | null,
): CmsReadinessItem[] {
  const resolved = data.resolvedPageSettings.data;
  const areas = layoutAreaCount(resolved);
  const pageBlocks = pageBlockCount(blocks);
  const placedBlocks = placedPageBlockCount(blocks, resolved);
  const hasSeo = Boolean(version?.seo.title && version.seo.description);

  return [
    {
      label: "Settings",
      status: resolved && resolved.globalSettingsState === "PERSISTED" ? "ok" : "warning",
      detail: resolved
        ? `${resolved.resolvedFrom.join(" > ")} - max ${resolved.tokens.maxWidth}`
        : resultMessage(data.resolvedPageSettings) ?? "Sin settings resueltos",
      tab: "settings",
    },
    {
      label: "Layout",
      status: resolved && areas > 0 && resolved.moduleSlots.length > 0 ? "ok" : "warning",
      detail: resolved ? `${areas} areas / ${resolved.moduleSlots.length} slots` : "Layout pendiente",
      tab: "settings",
    },
    {
      label: "Modulos",
      status: pageBlocks === placedBlocks ? "ok" : "warning",
      detail: `${placedBlocks}/${pageBlocks} modulos de pagina colocados`,
      tab: "blocks",
    },
    {
      label: "SEO",
      status: hasSeo ? "ok" : "warning",
      detail: hasSeo ? "Titulo y descripcion listos" : "Completa title y description",
      tab: "seo",
    },
  ];
}

function CmsReadinessPanel({
  data,
  filters,
  blocks,
  version,
}: {
  data: CmsAdminData;
  filters: CmsAdminFilters;
  blocks: CmsBlock[];
  version: CmsPageVersion | null;
}) {
  const items = cmsReadinessItems(data, blocks, version);
  const warningCount = items.filter((item) => item.status === "warning").length;

  return (
    <section className={`cmsReadinessPanel ${warningCount > 0 ? "cmsReadinessPanelWarning" : "cmsReadinessPanelOk"}`} aria-label="Preparacion CMS MVP">
      <div className="cmsReadinessHeader">
        <div>
          <h3>Preparacion MVP</h3>
          <p>{warningCount > 0 ? `${warningCount} puntos por revisar antes de publicar.` : "Pagina lista para revisar en preview y publicar."}</p>
        </div>
        <Link className="adminButton adminButtonTiny" href={cmsHref(filters, { tab: "preview" })}>Ver preview</Link>
      </div>
      <div className="cmsReadinessGrid">
        {items.map((item) => (
          <Link className={`cmsReadinessItem cmsReadinessItem${item.status === "ok" ? "Ok" : "Warning"}`} href={cmsHref(filters, { tab: item.tab })} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.status === "ok" ? "OK" : "Revisar"}</strong>
            <small>{item.detail}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ResultBanner({ data }: { data: CmsAdminData }) {
  const result = data.pages.source === "unavailable" ? data.pages : data.selectedPage;
  if (result.source === "bff") {
    return null;
  }
  return (
    <div className="adminBanner adminBannerError">
      <p>{result.message ?? "CMS no esta disponible."}</p>
      {result.failedEndpoint ? <p className="adminContextHint">{result.failedEndpoint}</p> : null}
      {result.correlationId ? <p className="adminContextHint">Correlation: {result.correlationId}</p> : null}
    </div>
  );
}

function PageFilters({ filters, context }: { filters: CmsAdminFilters; context: AdminContext }) {
  return (
    <form aria-label="Buscar paginas CMS" className="productListSearchPanel cmsPagesSearchPanel" action="/admin/cms">
      <input type="hidden" name="mode" value="list" />
      <label className="adminField">
        <span>Buscar</span>
        <input name="q" type="search" defaultValue={filters.q ?? ""} placeholder="Titulo, path o pageId" />
      </label>
      <label className="adminField">
        <span>Estado</span>
        <select name="status" defaultValue={filters.status ?? "all"}>
          <option value="all">Todos</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="UNPUBLISHED">Despublicado</option>
        </select>
      </label>
      <label className="adminField">
        <span>Tipo</span>
        <select name="pageType" defaultValue={filters.pageType ?? "all"}>
          <option value="all">Todos</option>
          <option value="LANDING">Landing</option>
          <option value="CONTENT">Contenido</option>
          <option value="HOME">Home</option>
        </select>
      </label>
      <label className="adminField">
        <span>Locale</span>
        <input name="locale" defaultValue={filters.locale ?? context.locale} placeholder="es-ES" />
      </label>
      <button className="adminButton adminButtonPrimary" type="submit"><Search aria-hidden="true" size={16} />Buscar</button>
      <Link className="employeesTextAction" href={cmsHref({ locale: filters.locale ?? context.locale, mode: "list" })}>Limpiar filtros</Link>
    </form>
  );
}

function PagesTable({
  pages,
  filters,
}: {
  pages: CmsPage[];
  filters: CmsAdminFilters;
}) {
  if (pages.length === 0) {
    return <div className="adminEmptyState">No hay paginas CMS para el filtro actual.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable productListTable cmsPagesTable">
        <colgroup>
          <col className="cmsPagesTitleColumn" />
          <col className="cmsPagesPathColumn" />
          <col className="cmsPagesTypeColumn" />
          <col className="cmsPagesStatusColumn" />
          <col className="cmsPagesUpdatedColumn" />
          <col className="cmsPagesActionsColumn" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Pagina</th>
            <th scope="col">Path</th>
            <th scope="col">Tipo</th>
            <th scope="col">Estado</th>
            <th scope="col">Actualizada</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.pageId}>
              <td>
                <strong>{page.title}</strong>
                <div className="adminContextHint">{page.pageId}</div>
              </td>
              <td>{page.path}</td>
              <td>{pageTypeLabel(page.pageType)}</td>
              <td><span className={statusBadgeClass(page.status)}>{page.status}</span></td>
              <td>{formatDate(page.updatedAt)}</td>
              <td>
                <div className="adminInlineActions">
                  <Link className="adminButton adminButtonTiny" href={cmsHref(filters,{mode:"editor",pageId:page.pageId,tab:"page"})}>
                    Editar
                  </Link>
                  <Link className="adminButton adminButtonTiny" href={cmsHref(filters, { mode: "editor", pageId: page.pageId, tab: "preview" })}>
                    Preview
                  </Link>
                  {page.status === "PUBLISHED" ? (
                    <button
                      aria-label={`Eliminar ${page.title}`}
                      className="adminIconButton adminIconButtonDanger"
                      disabled
                      title="Despublica la pagina antes de eliminarla"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  ) : (
                    <Link
                      aria-label={`Eliminar ${page.title}`}
                      className="adminIconButton adminIconButtonDanger"
                      href={cmsHref(filters, { drawer: "delete", mode: "list", pageId: page.pageId })}
                      title="Eliminar pagina"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreatePageDrawer({ context, filters }: { context: AdminContext; filters: CmsAdminFilters }) {
  if (filters.drawer !== "create") return null;
  const initialBlocks = [createCmsBlockFromPreset("banner.hero")];

  return (
    <div className="adminDrawerBackdrop">
      <AdminResizableDrawer drawerId="cms-admin-page-crear-pagina-cms-1" className="adminSideDrawer" aria-label="Crear pagina CMS">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>Crear pagina CMS</h2>
            <p>Draft editorial con ruta y bloques iniciales.</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={cmsHref(filters, { drawer: undefined })}>Cerrar</Link>
        </div>
        <form action={createCmsPageAction} className="pricingDenseForm">
          <input type="hidden" name="locale" value={filters.locale ?? context.locale} />
          <input type="hidden" name="blocksJson" value={blocksToJson(initialBlocks)} />
          <label className="adminField">
            <span>Tipo</span>
            <select name="pageType" defaultValue="LANDING">
              <option value="LANDING">Landing</option>
              <option value="CONTENT">Contenido</option>
              <option value="HOME">Home</option>
            </select>
          </label>
          <label className="adminField">
            <span>Titulo</span>
            <input name="title" placeholder="Nueva landing" required />
          </label>
          <label className="adminField">
            <span>Path</span>
            <input name="path" placeholder="/landing-campana" required />
          </label>
          <label className="adminField">
            <span>SEO title</span>
            <input name="seoTitle" placeholder="Titulo SEO" required />
          </label>
          <label className="adminField">
            <span>SEO description</span>
            <textarea name="seoDescription" placeholder="Descripcion corta para buscadores" required />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Crear draft</button>
        </form>
      </AdminResizableDrawer>
    </div>
  );
}

function PageLifecycleFields({page,operation}:{page:CmsPageDetail;operation:'DELETE'|'CHANGE_PATH'}){
 if(page.contractVersion!==1)return null;
 const command=page.pendingOperation?.command.operation===operation?page.pendingOperation.command:{contractVersion:1,operation,operationId:randomUUID(),expectedRevision:page.revisionToken};
 return <><input type="hidden" name="pageLifecycleCommand" value={JSON.stringify(command)}/>{page.pendingOperation?<p role="status">Hay una operación pendiente. Reintentar conserva su identidad; no se repetirá una petición a Routing con resultado incierto.</p>:null}</>;
}
function DeletePageDrawer({
  context,
  filters,
  page,
}: {
  context: AdminContext;
  filters: CmsAdminFilters;
  page: CmsPageDetail | null;
}) {
  if (filters.drawer !== "delete" || !page) return null;

  const closeHref = cmsHref(filters, {
    drawer: undefined,
    mode: "list",
    pageId: undefined,
  });
  const isPublished = page.status === "PUBLISHED";

  return (
    <div className="adminDrawerBackdrop">
      <AdminResizableDrawer drawerId="cms-admin-page-eliminar-pagina-cms-2" aria-label="Eliminar pagina CMS" aria-modal="true" className="adminSideDrawer" role="dialog">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>Eliminar pagina</h2>
            <p>{page.title}</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
        </div>

        <div className="adminBanner adminBannerWarning">
          <strong>Esta accion es irreversible.</strong>
          <p>Se eliminaran la pagina, sus versiones y su configuracion. Si tuvo una ruta publica, CMS la desactivara antes del borrado.</p>
        </div>

        <dl className="pricingDefinitionGrid">
          <div><dt>Path</dt><dd>{page.path}</dd></div>
          <div><dt>Estado</dt><dd>{page.status}</dd></div>
          <div><dt>Page ID</dt><dd>{page.pageId}</dd></div>
        </dl>

        {isPublished ? (
          <div className="adminBanner adminBannerError">
            <strong>Pagina publicada.</strong>
            <p>Despublicala antes de eliminarla para retirar su estado publico de forma explicita.</p>
          </div>
        ) : (
          <form action={deleteCmsPageAction} className="pricingDenseForm">
            <PageLifecycleFields page={page} operation="DELETE"/>
            <input type="hidden" name="pageId" value={page.pageId} />
            <input type="hidden" name="locale" value={filters.locale ?? context.locale} />
            <input type="hidden" name="q" value={filters.q ?? ""} />
            <input type="hidden" name="status" value={filters.status ?? "all"} />
            <input type="hidden" name="pageType" value={filters.pageType ?? "all"} />
            <label className="adminField">
              <span>Confirmacion</span>
              <input name="confirmDeletePage" placeholder="ELIMINAR" />
              <small>Escribe ELIMINAR para borrar definitivamente esta pagina.</small>
            </label>
            <button className="adminButton adminButtonDanger" type="submit">
              <Trash2 aria-hidden="true" size={16} />
              Eliminar definitivamente
            </button>
          </form>
        )}
      </AdminResizableDrawer>
    </div>
  );
}

function pageVersion(page: CmsPageDetail | null) {
  return page?.latestVersion ?? page?.publishedVersion ?? null;
}

function PageEditor({
  data,
  page,
  context,
  filters,
}: {
  data: CmsAdminData;
  page: CmsPageDetail | null;
  context: AdminContext;
  filters: CmsAdminFilters;
}) {
  if (!page) {
    return (
      <section className="pricingPanel">
        <div className="adminEmptyState">Selecciona una pagina para editar.</div>
      </section>
    );
  }

  const version = pageVersion(page);
  const tab = filters.tab ?? "blocks";
  const blocks = version?.blocks ?? [];
  const resolved = data.resolvedPageSettings.data;
  const moduleSlots = moduleSlotsForResolvedSettings(data.resolvedPageSettings.data);
  const placementSummary = summarizePlacements(blocks);
  const canEditDraft = page.status !== "PUBLISHED";

  return (
    <section className="cmsEditor">
      <div className="pricingPanel cmsEditorHeader">
        <div>
          <div className="adminBreadcrumb">Admin / CMS / {page.title}</div>
          <h2>{page.title}</h2>
          <p>{page.path} - {pageTypeLabel(page.pageType)} - version {version?.version ?? "-"}</p>
        </div>
        <div className="adminButtonRow">
          <Link className="adminButton" href={cmsHref(filters, { mode: "list", pageId: undefined, tab: undefined })}>Volver al listado</Link>
          <Link className="adminButton" href={cmsHref(filters, { drawer: "path" })}>Cambiar path publicado</Link>
          <form action={publishCmsPageAction}>
            <input type="hidden" name="pageId" value={page.pageId} />
            <input type="hidden" name="locale" value={filters.locale ?? context.locale} />
            <input type="hidden" name="tab" value={tab} />
            <button className="adminButton adminButtonPrimary" type="submit">Publicar</button>
          </form>
          <details className="cmsDangerMenu">
            <summary className="adminButton adminButtonSecondary">Despublicar</summary>
            <form action={unpublishCmsPageAction} className="cmsDangerPanel">
              <input type="hidden" name="pageId" value={page.pageId} />
              <input type="hidden" name="locale" value={filters.locale ?? context.locale} />
              <input type="hidden" name="tab" value={tab} />
              <p>Escribe DESPUBLICAR para quitar esta pagina del Storefront.</p>
              <input name="confirmUnpublish" placeholder="DESPUBLICAR" />
              <button className="adminButton adminButtonDanger" type="submit">Confirmar</button>
            </form>
          </details>
        </div>
      </div>

      <CmsReadinessPanel data={data} filters={filters} blocks={blocks} version={version} />

      <nav className="productEditorTabs pricingTabs" aria-label="Secciones CMS">
        {tabs.map((item) => (
          <Link
            className={`productEditorTab${tab === item.id ? " productEditorTabActive" : ""}`}
            href={cmsHref(filters, { tab: item.id })}
            key={item.id}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "settings" ? (
        <PageSettingsPanel data={data} page={page} context={context} filters={filters} />
      ) : (
        <form action={saveCmsDraftAction} autoComplete="off" className="cmsEditorForm">
          <input type="hidden" name="pageId" value={page.pageId} />
          <input type="hidden" name="locale" value={filters.locale ?? context.locale} />
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="pageType" value={page.pageType} />
          {tab !== "page" && tab !== "seo" ? (
            <>
              <input type="hidden" name="title" value={version?.title ?? page.title} />
              <input type="hidden" name="path" value={page.path} />
              <input type="hidden" name="seoTitle" value={version?.seo.title ?? page.title} />
              <input type="hidden" name="seoDescription" value={version?.seo.description ?? ""} />
            </>
          ) : null}

          {tab === "page" ? <PageMetadataFields page={page} version={version} /> : null}
          {tab === "blocks" ? (
            <CmsBlockEditorClient
              disabled={!canEditDraft}
              initialBlocks={blocks}
              locale={filters.locale ?? context.locale}
              moduleSlots={moduleSlots}
              pageId={page.pageId}
              publishVisualModuleAction={saveCmsVisualModuleDefinitionAction}
              resolvedLayout={resolved?.layout ?? null}
              resolvedModules={resolved?.modules ?? []}
              tokens={resolved?.tokens ?? null}
              visualModules={data.visualModules.data}
            />
          ) : null}
          {tab === "seo" ? <SeoFields page={page} version={version} /> : null}
          {tab === "preview" ? <PreviewPanel resolved={data.resolvedPageSettings.data} version={version} /> : null}

          {tab !== "blocks" && tab !== "preview" ? (
            <input type="hidden" name="blocksJson" value={blocksToJson(blocks)} />
          ) : null}
          {!canEditDraft ? (
            <div className="adminBanner adminBannerWarning">
              Esta pagina esta publicada. Despublicala para editar un nuevo draft y vuelve a publicarla cuando este lista.
            </div>
          ) : null}
          <div className="cmsEditorFooter">
            <div className="adminContextHint">
              Bloques: {blocks.length} - Main {placementSummary.main} - Antes PLP {placementSummary.beforeList} - Despues PLP {placementSummary.afterList}
            </div>
            <button className="adminButton adminButtonPrimary" disabled={!canEditDraft} type="submit">Guardar draft</button>
          </div>
        </form>
      )}

      <PathDrawer page={page} context={context} filters={filters} />
    </section>
  );
}

function PageSettingsPanel({
  data,
  page,
  context,
  filters,
}: {
  data: CmsAdminData;
  page: CmsPageDetail;
  context: AdminContext;
  filters: CmsAdminFilters;
}) {
  const pageSettingsResponse = data.pageSettings.data;
  const resolved = data.resolvedPageSettings.data;
  const pageSettings = pageSettingsResponse?.settings;
  const pageSettingsError = resultMessage(data.pageSettings);
  const resolvedError = resultMessage(data.resolvedPageSettings);

  if (!pageSettingsResponse || !pageSettings || !resolved) {
    return (
      <section className="pricingPanel cmsEditorPanel">
        <div className="pricingPanelHeader"><div><h2>Configuracion</h2><p>Settings por pagina.</p></div></div>
        {pageSettingsError ? <div className="adminBanner adminBannerError"><p>{pageSettingsError}</p></div> : null}
        {resolvedError ? <div className="adminBanner adminBannerError"><p>{resolvedError}</p></div> : null}
        {!pageSettingsError && !resolvedError ? <div className="adminEmptyState">No hay settings disponibles para esta pagina.</div> : null}
      </section>
    );
  }

  const overrides = pageSettings.overrides;
  const settingsMode = pageSettings.inheritGlobalSettings && !hasPageOverrides(pageSettingsResponse) ? "inherit" : "custom";
  const pageMaxWidth = overrideMaxWidth(overrides, resolved.tokens.maxWidth);
  const editableLayout = overrideLayout(overrides, resolved.layout);

  return (
    <form action={saveCmsPageSettingsAction} className="cmsEditorForm cmsPageSettingsForm">
      <input type="hidden" name="pageId" value={page.pageId} />
      <input type="hidden" name="locale" value={filters.locale ?? context.locale} />

      <section className="adminSummaryGrid" aria-label="Resumen de configuracion de pagina CMS">
        <div><span>Global</span><strong>{resolved.globalSettingsState}</strong></div>
        <div><span>Pagina</span><strong>{resolved.pageSettingsState}</strong></div>
        <div><span>Capas</span><strong>{resolved.resolvedFrom.join(" > ")}</strong></div>
        <div><span>Slots</span><strong>{resolved.moduleSlots.length}</strong></div>
      </section>

      {settingsMode === "custom" ? (
        <section className="adminBanner adminBannerWarning">
          <strong>Esta pagina usa configuracion propia.</strong>
          <p>Los valores propios de esta página tienen prioridad sobre los valores heredados.</p>
        </section>
      ) : (
        <section className="adminBanner adminBannerInfo">
          <strong>Esta pagina hereda configuracion.</strong>
          <p>Los valores heredados se reflejan en la configuración resuelta de esta página.</p>
        </section>
      )}

      <section className="pricingPanel cmsEditorPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Configuración de página</h2>
            <p>La página conserva sus ajustes propios.</p>
          </div>
          <span className="adminBadge">{pageTypeLabel(page.pageType)}</span>
        </div>
        <div className="cmsFieldGrid">
          <label className="adminField">
            <span>Modo</span>
            <select name="settingsMode" defaultValue={settingsMode}>
              <option value="inherit">Heredar configuracion global</option>
              <option value="custom">Personalizar esta pagina</option>
            </select>
          </label>
          <label className="adminField">
            <span>Override max width</span>
            <input name="pageMaxWidth" defaultValue={pageMaxWidth} placeholder={resolved.tokens.maxWidth} />
            <small>Se ignora si el modo queda en heredar.</small>
          </label>
          <label className="adminField">
            <span>Overrides actuales</span>
            <output>{Object.keys(overrides).length ? Object.keys(overrides).join(", ") : "Sin overrides"}</output>
          </label>
        </div>
      </section>

      <section className="pricingPanel cmsEditorPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Layout particular</h2>
            <p>Solo se persiste si el modo es personalizar esta pagina.</p>
          </div>
        </div>
        <CmsLayoutAreaEditorClient initialLayout={editableLayout} maxWidth={pageMaxWidth} />
      </section>

      <section className="pricingPanel cmsEditorPanel">
        <div className="pricingPanelHeader">
          <div><h2>Resolucion final</h2><p>Vista leida desde el BFF despues de aplicar global, plantilla, pagina y modulos.</p></div>
        </div>
        <dl className="pricingDefinitionGrid cmsPageSettingsDefinitionGrid">
          <div><dt>Template</dt><dd>{resolved.templateId ?? "Sin plantilla"}</dd></div>
          <div><dt>Max width</dt><dd>{resolved.tokens.maxWidth}</dd></div>
          <div><dt>Modulos colocados</dt><dd>{resolved.modules.length}</dd></div>
          <div><dt>Areas main</dt><dd>{resolved.layout.regions.main?.areas.length ?? 0}</dd></div>
        </dl>
      </section>

      <div className="cmsEditorFooter">
        <div className="adminContextHint">Pagina {page.pageId} - {filters.locale ?? context.locale}</div>
        <button className="adminButton adminButtonPrimary" type="submit">Guardar configuracion de pagina</button>
      </div>
    </form>
  );
}

function PageMetadataFields({ page, version }: { page: CmsPageDetail; version: CmsPageVersion | null }) {
  return (
    <section className="pricingPanel cmsEditorPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Pagina</h2>
          <p>Datos editoriales del draft.</p>
        </div>
      </div>
      <div className="cmsFieldGrid">
        <label className="adminField">
          <span>Titulo</span>
          <input name="title" defaultValue={version?.title ?? page.title} />
        </label>
        <label className="adminField">
          <span>Path draft</span>
          <input name="path" defaultValue={page.path} />
        </label>
        <label className="adminField">
          <span>Tipo</span>
          <output>{pageTypeLabel(page.pageType)}</output>
        </label>
        <label className="adminField">
          <span>Estado</span>
          <output>{page.status}</output>
        </label>
        <input type="hidden" name="seoTitle" value={version?.seo.title ?? page.title} />
        <input type="hidden" name="seoDescription" value={version?.seo.description ?? ""} />
      </div>
    </section>
  );
}

function SeoFields({ page, version }: { page: CmsPageDetail; version: CmsPageVersion | null }) {
  return (
    <section className="pricingPanel cmsEditorPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>SEO y Routing</h2>
          <p>CMS publica rutas CMS_PAGE en Routing/SEO y Storefront lee via storefront/page.</p>
        </div>
      </div>
      <div className="cmsFieldGrid">
        <label className="adminField">
          <span>SEO title</span>
          <input name="seoTitle" defaultValue={version?.seo.title ?? page.title} />
        </label>
        <label className="adminField">
          <span>SEO description</span>
          <textarea name="seoDescription" defaultValue={version?.seo.description ?? ""} />
        </label>
        <label className="adminField">
          <span>Canonical path</span>
          <output>{page.path}</output>
        </label>
        <label className="adminField">
          <span>Route ID</span>
          <output>{page.routeId ?? "Pendiente de publicar"}</output>
        </label>
        <input type="hidden" name="title" value={version?.title ?? page.title} />
        <input type="hidden" name="path" value={page.path} />
      </div>
      <div className="adminBanner adminBannerInfo">
        <p>El cambio de path publicado usa la accion dedicada para que CMS solicite redirect 301 a Routing/SEO.</p>
      </div>
    </section>
  );
}

const previewRegionOrder: Array<{ code: CmsRegionCode; label: string }> = [
  { code: "header", label: "Header" },
  { code: "main", label: "Main" },
  { code: "footer", label: "Footer" },
];

function modulePlacementForBlock(
  block: CmsBlock,
  resolved: CmsResolvedPageSettings | null,
  fallbackOrder: number,
): CmsModulePlacement | null {
  if (block.placement) {
    return {
      ...block.placement,
      align: block.placement.align ?? "stretch",
      containerMode: block.placement.containerMode ?? "inherit",
      spacing: block.placement.spacing ?? {},
      visibility: block.placement.visibility ?? { mobile: true, tablet: true, desktop: true },
      width: block.placement.width ?? null,
      order: block.placement.order ?? fallbackOrder,
    };
  }

  return resolved?.modules.find((module) => module.blockId === block.blockId)?.placement ?? null;
}

function PreviewPanel({ resolved, version }: { resolved: CmsResolvedPageSettings | null; version: CmsPageVersion | null }) {
  const blocks = version?.blocks ?? [];

  return (
    <section className="pricingPanel cmsEditorPanel cmsResolvedPreview">
      <div className="pricingPanelHeader">
        <div>
          <h2>Preview resuelto</h2>
          <p>Visualiza el draft con layout final desde global, plantilla, pagina y modulo.</p>
        </div>
        <span className="adminBadge">storefront/page</span>
      </div>

      {resolved ? (
        <section className="adminSummaryGrid" aria-label="Resumen de preview CMS resuelto">
          <div><span>Capas</span><strong>{resolved.resolvedFrom.join(" > ")}</strong></div>
          <div><span>Max width</span><strong>{resolved.tokens.maxWidth}</strong></div>
          <div><span>Slots</span><strong>{resolved.moduleSlots.length}</strong></div>
          <div><span>Modulos</span><strong>{resolved.modules.length}</strong></div>
        </section>
      ) : (
        <div className="adminBanner adminBannerWarning">
          <p>No hay resolucion de layout disponible. El preview usa solo el orden del draft.</p>
        </div>
      )}

      <div className="cmsResolvedFrame">
        <CmsLayoutPreview
          blocks={blocks}
          emptyLabel="La version actual no tiene bloques de pagina."
          layout={resolved?.layout ?? null}
          moduleSlots={resolved?.moduleSlots ?? []}
          resolvedModules={resolved?.modules ?? []}
          tokens={resolved?.tokens ?? null}
        />
      </div>
    </section>
  );
}

export function PathDrawer({
  page,
  context,
  filters,
}: {
  page: CmsPageDetail;
  context: AdminContext;
  filters: CmsAdminFilters;
}) {
  if (filters.drawer !== "path") return null;
  return (
    <div className="adminDrawerBackdrop">
      <AdminResizableDrawer drawerId="cms-admin-page-cambiar-path-publicado-3" className="adminSideDrawer" aria-label="Cambiar path publicado">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>Cambiar path publicado</h2>
            <p>CMS pedira redirect 301 desde el path anterior.</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={cmsHref(filters, { drawer: undefined })}>Cerrar</Link>
        </div>
        <form action={changeCmsPublishedPathAction} className="pricingDenseForm">
          <PageLifecycleFields page={page} operation="CHANGE_PATH"/>
          <input type="hidden" name="pageId" value={page.pageId} />
          <input type="hidden" name="locale" value={filters.locale ?? context.locale} />
          <input type="hidden" name="tab" value={filters.tab ?? "seo"} />
          <label className="adminField">
            <span>Path actual</span>
            <output>{page.path}</output>
          </label>
          <label className="adminField">
            <span>Nuevo path</span>
            <input name="nextPath" defaultValue={page.pendingOperation?.command.nextPath??page.path} readOnly={!!page.pendingOperation} />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Cambiar path</button>
        </form>
      </AdminResizableDrawer>
    </div>
  );
}

export function CmsAdminPage({ context, data, filters }: CmsAdminPageProps) {
  const hasContext = hasRequiredAdminContext(context);
  const selectedPage = data.selectedPage.data;

  return (
    <main className={`adminPage cmsAdminPage${filters.mode === "editor" ? "" : " productListPage cmsPagesListPage"}`}>
      <header className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / CMS</div>
          <h1 className="adminPageTitle">CMS</h1>
          <p className="adminPageIntro">
            Gestiona paginas y bloques editoriales por tienda, con publicacion enlazada a Routing/SEO y base para layouts PLP.
          </p>
        </div>
        <div className="adminButtonRow">
          <Link className="employeesTextAction" href={cmsHref(filters, { drawer: "create", mode: "list" })}>
            Crear pagina
          </Link>
        </div>
      </header>

      {!hasContext ? (
        <div className="adminBanner adminBannerWarning">
          <p>Selecciona Organization y Shop para gestionar CMS.</p>
        </div>
      ) : null}
      {filters.cmsMessage ? (
        <div className="adminBanner adminBannerInfo"><p>{filters.cmsMessage}</p></div>
      ) : null}
      <ResultBanner data={data} />

      <div className="pricingAdminPage">
        {filters.mode === "editor" ? (
          <PageEditor data={data} page={selectedPage} context={context} filters={filters} />
        ) : (
          <>
            <PageFilters filters={filters} context={context} />
            <section className="productListGrid" aria-label="Listado de paginas CMS">
              <div className="adminCardHeader productListGridHeader">
                <div><h2>Paginas ({data.pages.data.total})</h2></div>
                <span className="adminContextHint">{context.shopName || context.shopAlias || "Tienda sin contexto"} · {filters.locale ?? context.locale}</span>
              </div>
              <PagesTable pages={data.pages.data.items} filters={filters} />
            </section>
          </>
        )}
      </div>

      <CreatePageDrawer context={context} filters={filters} />
      <DeletePageDrawer context={context} filters={filters} page={selectedPage} />
    </main>
  );
}
