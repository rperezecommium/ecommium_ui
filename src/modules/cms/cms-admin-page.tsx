import Link from "next/link";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import {
  changeCmsPublishedPathAction,
  createCmsPageAction,
  publishCmsPageAction,
  saveCmsDraftAction,
  unpublishCmsPageAction,
} from "./cms-admin-actions";
import {
  blocksToJson,
  createCmsBlockFromPreset,
  getCmsBlockPresets,
  summarizePlpComposition,
  summarizePlacements,
  type CmsAdminData,
  type CmsAdminFilters,
  type CmsPage,
  type CmsPageDetail,
  type CmsPageVersion,
} from "./cms-admin";
import { CmsBlockEditorClient } from "./cms-block-editor-client";

type CmsAdminPageProps = {
  context: AdminContext;
  data: CmsAdminData;
  filters: CmsAdminFilters;
};

const tabs = [
  { id: "page", label: "Pagina" },
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
  page,
  context,
  filters,
}: {
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
  const placementSummary = summarizePlacements(blocks);

  return (
    <section className="cmsEditor">
      <div className="pricingPanel cmsEditorHeader">
        <div>
          <div className="adminBreadcrumb">Admin / CMS / {page.title}</div>
          <h2>{page.title}</h2>
          <p>{page.path} · {pageTypeLabel(page.pageType)} · version {version?.version ?? "-"}</p>
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
        {tab === "blocks" ? <CmsBlockEditorClient initialBlocks={blocks} /> : null}
        {tab === "plp" ? <PlpBasePanel version={version} /> : null}
        {tab === "seo" ? <SeoFields page={page} version={version} /> : null}
        {tab === "preview" ? <PreviewPanel version={version} /> : null}

        {tab !== "blocks" && tab !== "plp" && tab !== "preview" ? (
          <input type="hidden" name="blocksJson" value={blocksToJson(blocks)} />
        ) : null}
        <div className="cmsEditorFooter">
          <div className="adminContextHint">
            Bloques: {blocks.length} · Main {placementSummary.main} · Antes PLP {placementSummary.beforeList} · Despues PLP {placementSummary.afterList}
          </div>
          <button className="adminButton adminButtonPrimary" type="submit">Guardar draft</button>
        </div>
      </form>

      <PathDrawer page={page} context={context} filters={filters} />
    </section>
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

function PreviewPanel({ version }: { version: CmsPageVersion | null }) {
  const blocks = version?.blocks ?? [];
  return (
    <section className="pricingPanel cmsEditorPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Preview publicada y draft</h2>
          <p>El preview local usa el draft; la URL pública se resuelve por BFF Storefront.</p>
        </div>
        <span className="adminBadge">storefront/page</span>
      </div>
      <CmsBlockEditorClient initialBlocks={blocks} />
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
          <PageEditor page={selectedPage} context={context} filters={filters} />
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
