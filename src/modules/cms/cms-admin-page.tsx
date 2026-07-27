import Link from "next/link";
import type { CSSProperties } from "react";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import {
  changeCmsPublishedPathAction,
  createCmsPageAction,
  publishCmsPageAction,
  saveCmsDraftAction,
  saveCmsPageSettingsAction,
  unpublishCmsPageAction,
} from "./cms-admin-actions";
import {
  blocksToJson,
  createCmsBlockFromPreset,
  getCmsBlockPresets,
  getCmsBlockSurface,
  summarizePlpComposition,
  summarizePlacements,
  type CmsAdminData,
  type CmsAdminFilters,
  type CmsArea,
  type CmsBlock,
  type CmsLayout,
  type CmsModulePlacement,
  type CmsPage,
  type CmsPageDetail,
  type CmsPageSettingsResponse,
  type CmsTemplateSettings,
  type CmsPageVersion,
  type CmsRegionCode,
  type CmsResolvedPageSettings,
} from "./cms-admin";
import { CmsBlockEditorClient } from "./cms-block-editor-client";
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
  { id: "plp", label: "PLP" },
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

function templateOptionLabel(template: CmsTemplateSettings) {
  return `${template.name} - ${template.status}`;
}

function selectableTemplates(templates: CmsTemplateSettings[], selectedTemplateId: string | null) {
  return templates.filter((template) => template.status === "ACTIVE" || template.templateId === selectedTemplateId);
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
    <form className="pricingFilterBar cmsFilterBar" action="/admin/cms">
      <input type="hidden" name="mode" value="list" />
      <label className="adminField">
        <span>Buscar</span>
        <input name="q" defaultValue={filters.q ?? ""} placeholder="Titulo, path o pageId" />
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
      <button className="adminButton adminButtonPrimary" type="submit">Aplicar</button>
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
      <table className="adminTable cmsPagesTable">
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
                  <Link className="adminButton adminButtonTiny" href={cmsHref(filters, { mode: "editor", pageId: page.pageId, tab: "blocks" })}>
                    Editar
                  </Link>
                  <Link className="adminButton adminButtonTiny" href={cmsHref(filters, { mode: "editor", pageId: page.pageId, tab: "preview" })}>
                    Preview
                  </Link>
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
      <aside className="adminSideDrawer" aria-label="Crear pagina CMS">
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
            <input name="title" placeholder="Nueva landing" />
          </label>
          <label className="adminField">
            <span>Path</span>
            <input name="path" placeholder="/landing-campana" />
          </label>
          <label className="adminField">
            <span>SEO title</span>
            <input name="seoTitle" placeholder="Titulo SEO" />
          </label>
          <label className="adminField">
            <span>SEO description</span>
            <textarea name="seoDescription" placeholder="Descripcion corta para buscadores" />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Crear draft</button>
        </form>
      </aside>
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
  const moduleSlots = data.resolvedPageSettings.data?.moduleSlots ?? [];
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
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "settings" ? (
        <PageSettingsPanel data={data} page={page} context={context} filters={filters} />
      ) : (
        <form action={saveCmsDraftAction} className="cmsEditorForm">
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
          {tab === "blocks" ? <CmsBlockEditorClient initialBlocks={blocks} moduleSlots={moduleSlots} /> : null}
          {tab === "plp" ? <PlpBasePanel version={version} /> : null}
          {tab === "seo" ? <SeoFields page={page} version={version} /> : null}
          {tab === "preview" ? <PreviewPanel resolved={data.resolvedPageSettings.data} version={version} /> : null}

          {tab !== "blocks" && tab !== "plp" && tab !== "preview" ? (
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
  const templates = data.templates.data.items;
  const pageSettingsError = resultMessage(data.pageSettings);
  const resolvedError = resultMessage(data.resolvedPageSettings);
  const templatesError = resultMessage(data.templates);

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
  const templateChoices = selectableTemplates(templates, pageSettings.templateId);
  const inactiveTemplates = templates.filter((template) => template.status !== "ACTIVE" && template.templateId !== pageSettings.templateId);
  const activeTemplateCount = templates.filter((template) => template.status === "ACTIVE").length;
  const templatesSettingsHref = `/admin/cms/ajustes-basicos?tab=templates&locale=${encodeURIComponent(filters.locale ?? context.locale)}&pageType=${encodeURIComponent(page.pageType)}&status=all`;

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

      <section className="pricingPanel cmsEditorPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Herencia y plantilla</h2>
            <p>La pagina guarda solo la plantilla elegida y los overrides propios.</p>
          </div>
          <span className="adminBadge">{pageTypeLabel(page.pageType)}</span>
        </div>
        {templatesError ? <div className="adminBanner adminBannerError"><p>{templatesError}</p></div> : null}
        {!templatesError && templates.length === 0 ? (
          <div className="adminBanner adminBannerWarning">
            <p>No hay plantillas {pageTypeLabel(page.pageType)} disponibles para este locale.</p>
            <Link className="adminButton adminButtonTiny" href={templatesSettingsHref}>Ir a plantillas</Link>
          </div>
        ) : null}
        {!templatesError && templates.length > 0 && activeTemplateCount === 0 ? (
          <div className="adminBanner adminBannerWarning">
            <p>Hay plantillas {pageTypeLabel(page.pageType)}, pero ninguna esta activa.</p>
            <Link className="adminButton adminButtonTiny" href={templatesSettingsHref}>Revisar estado</Link>
          </div>
        ) : null}
        <div className="cmsFieldGrid">
          <label className="adminField">
            <span>Modo</span>
            <select name="settingsMode" defaultValue={settingsMode}>
              <option value="inherit">Heredar configuracion global</option>
              <option value="custom">Personalizar esta pagina</option>
            </select>
          </label>
          <label className="adminField">
            <span>Plantilla</span>
            <select name="templateId" defaultValue={pageSettings.templateId ?? ""}>
              <option value="">Sin plantilla</option>
              {templateChoices.map((template) => (
                <option key={template.templateId} value={template.templateId}>{templateOptionLabel(template)}</option>
              ))}
              {inactiveTemplates.length > 0 ? (
                <optgroup label="No activas">
                  {inactiveTemplates.map((template) => (
                    <option disabled key={template.templateId} value={template.templateId}>{templateOptionLabel(template)}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            <small>{activeTemplateCount} activas / {templates.length} total</small>
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

function PlpBasePanel({ version }: { version: CmsPageVersion | null }) {
  const blocks = version?.blocks ?? [];
  const summary = summarizePlpComposition(blocks);
  const targets = summary.targets.length > 0 ? summary.targets.join(", ") : "Sin target PLP";

  return (
    <section className="pricingPanel cmsEditorPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Base PLP</h2>
          <p>Define zonas CMS para listing; el grid, filtros y cards se pintaran en una fase posterior.</p>
        </div>
        <span className="adminBadge">storefront/plp</span>
      </div>
      <div className="cmsPlpSummaryGrid">
        <article>
          <span>Total bloques PLP</span>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <span>Antes de lista</span>
          <strong>{summary.beforeList}</strong>
        </article>
        <article>
          <span>Despues de lista</span>
          <strong>{summary.afterList}</strong>
        </article>
      </div>
      <div className="adminBanner adminBannerInfo">
        <p>Targets declarados: {targets}. Añade bloques desde la biblioteca PLP, completa URL o slug de categoria y guarda el draft.</p>
      </div>
      <CmsBlockEditorClient initialBlocks={blocks} mode="plp" />
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

function previewModulesForColumn(
  blocks: CmsBlock[],
  resolved: CmsResolvedPageSettings | null,
  region: CmsRegionCode,
  areaId: string,
  columnIndex: number,
) {
  return blocks
    .map((block, index) => ({ block, placement: modulePlacementForBlock(block, resolved, index + 1) }))
    .filter((item): item is { block: CmsBlock; placement: CmsModulePlacement } => (
      item.placement?.region === region
      && item.placement.areaId === areaId
      && item.placement.columnIndex === columnIndex
    ))
    .sort((left, right) => left.placement.order - right.placement.order);
}

function areaGridStyle(area: CmsArea): CSSProperties {
  const columns = area.columns.length > 0 ? area.columns : ["100%"];
  return {
    columnGap: area.columnGap ?? undefined,
    gridTemplateColumns: columns.map((column) => `minmax(0, ${column})`).join(" "),
    rowGap: area.rowGap ?? undefined,
  };
}

function visibilityLabel(visibility: CmsModulePlacement["visibility"] | undefined) {
  const value = visibility ?? { mobile: true, tablet: true, desktop: true };
  return [
    value.mobile ? "M" : null,
    value.tablet ? "T" : null,
    value.desktop ? "D" : null,
  ].filter(Boolean).join("/") || "Oculto";
}

function previewBlockTitle(block: CmsBlock) {
  const props = block.props;
  const candidates = [props.title, props.heading, props.label, props.name];
  const title = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof title === "string" ? title : block.type;
}

function CmsResolvedModuleCard({ block, placement }: { block: CmsBlock; placement: CmsModulePlacement }) {
  return (
    <article className="cmsResolvedModuleCard">
      <div>
        <span>{block.type}</span>
        <strong>{previewBlockTitle(block)}</strong>
      </div>
      <dl>
        <div><dt>Orden</dt><dd>{placement.order}</dd></div>
        <div><dt>Ancho</dt><dd>{placement.width ?? "auto"}</dd></div>
        <div><dt>Align</dt><dd>{placement.align}</dd></div>
        <div><dt>Container</dt><dd>{placement.containerMode}</dd></div>
        <div><dt>Visible</dt><dd>{visibilityLabel(placement.visibility)}</dd></div>
      </dl>
    </article>
  );
}

function CmsResolvedAreaPreview({
  area,
  blocks,
  region,
  resolved,
}: {
  area: CmsArea;
  blocks: CmsBlock[];
  region: CmsRegionCode;
  resolved: CmsResolvedPageSettings | null;
}) {
  const columns = area.columnSlots.length > 0
    ? area.columnSlots
    : area.columns.map((width, index) => ({ columnIndex: index + 1, width, percentage: Number.parseFloat(width) || 0 }));

  return (
    <article className="cmsResolvedArea">
      <header className="cmsResolvedAreaHeader">
        <div>
          <strong>{area.name ?? area.areaId}</strong>
          <span>{area.containerMode} - {area.maxWidth ?? "max width heredado"}</span>
        </div>
        <span>{area.columns.join(" / ") || "100%"}</span>
      </header>
      <div className="cmsResolvedColumns" style={areaGridStyle(area)}>
        {columns.map((column) => {
          const modules = previewModulesForColumn(blocks, resolved, region, area.areaId, column.columnIndex);
          return (
            <section className="cmsResolvedColumn" key={`${area.areaId}-${column.columnIndex}`}>
              <div className="cmsResolvedColumnHeader">
                <span>Columna {column.columnIndex}</span>
                <strong>{column.width}</strong>
              </div>
              {modules.length > 0 ? modules.map((item) => (
                <CmsResolvedModuleCard block={item.block} key={item.block.blockId} placement={item.placement} />
              )) : <div className="cmsResolvedSlotEmpty">Lista para modulos</div>}
            </section>
          );
        })}
      </div>
    </article>
  );
}

function PreviewPanel({ resolved, version }: { resolved: CmsResolvedPageSettings | null; version: CmsPageVersion | null }) {
  const blocks = version?.blocks ?? [];
  const unresolvedBlocks = blocks.filter((block, index) => !modulePlacementForBlock(block, resolved, index + 1));

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
        {previewRegionOrder.map((item) => {
          const region = resolved?.layout.regions[item.code];
          const areas = region?.areas ?? [];
          return (
            <section className="cmsResolvedRegion" key={item.code}>
              <header>
                <div>
                  <span>{item.label}</span>
                  <strong>{areas.length} areas</strong>
                </div>
                <small>{region?.source ?? "sin layout"}</small>
              </header>
              {areas.length > 0 ? areas.map((area) => (
                <CmsResolvedAreaPreview area={area} blocks={blocks} key={area.areaId} region={item.code} resolved={resolved} />
              )) : <div className="cmsResolvedSlotEmpty">Region sin areas configuradas</div>}
            </section>
          );
        })}
      </div>

      {unresolvedBlocks.length > 0 ? (
        <section className="cmsResolvedUnplaced">
          <h3>Modulos sin area resuelta</h3>
          <div>
            {unresolvedBlocks.map((block) => (
              <article className="cmsResolvedModuleCard" key={block.blockId}>
                <div><span>{block.type}</span><strong>{previewBlockTitle(block)}</strong></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function PathDrawer({
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
      <aside className="adminSideDrawer" aria-label="Cambiar path publicado">
        <div className="adminSideDrawerHeader">
          <div>
            <h2>Cambiar path publicado</h2>
            <p>CMS pedira redirect 301 desde el path anterior.</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={cmsHref(filters, { drawer: undefined })}>Cerrar</Link>
        </div>
        <form action={changeCmsPublishedPathAction} className="pricingDenseForm">
          <input type="hidden" name="pageId" value={page.pageId} />
          <input type="hidden" name="locale" value={filters.locale ?? context.locale} />
          <input type="hidden" name="tab" value={filters.tab ?? "seo"} />
          <label className="adminField">
            <span>Path actual</span>
            <output>{page.path}</output>
          </label>
          <label className="adminField">
            <span>Nuevo path</span>
            <input name="nextPath" defaultValue={page.path} />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Cambiar path</button>
        </form>
      </aside>
    </div>
  );
}

export function CmsAdminPage({ context, data, filters }: CmsAdminPageProps) {
  const hasContext = hasRequiredAdminContext(context);
  const selectedPage = data.selectedPage.data;

  return (
    <main className="adminPage cmsAdminPage">
      <header className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / CMS</div>
          <h1 className="adminPageTitle">CMS</h1>
          <p className="adminPageIntro">
            Gestiona paginas y bloques editoriales por tienda, con publicacion enlazada a Routing/SEO y base para layouts PLP.
          </p>
        </div>
        <div className="adminButtonRow">
          <Link className="adminButton adminButtonPrimary" href={cmsHref(filters, { drawer: "create", mode: "list" })}>
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
            <section className="pricingPanel">
              <div className="pricingPanelHeader">
                <div>
                  <h2>Paginas</h2>
                  <p>Drafts, publicaciones y paths por locale.</p>
                </div>
                <span className="adminBadge">{data.pages.data.total} registros</span>
              </div>
              <PagesTable pages={data.pages.data.items} filters={filters} />
            </section>
            <section className="pricingPanel">
              <div className="pricingPanelHeader">
                <div>
                  <h2>Plantillas de bloques</h2>
                  <p>Patrones base para que otro desarrollador pueda crear nuevos bloques.</p>
                </div>
              </div>
              <div className="cmsPresetGrid">
                {getCmsBlockPresets().map((preset) => (
                  <article key={preset.type}>
                    <strong>{preset.label}</strong>
                    <p>{preset.description}</p>
                    <span>{preset.type} · {preset.placement}</span>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <CreatePageDrawer context={context} filters={filters} />
    </main>
  );
}
