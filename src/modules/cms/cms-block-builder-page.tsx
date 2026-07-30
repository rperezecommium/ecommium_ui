import type { AdminContext } from "../../shared/config/admin-context";
import type { CmsAdminData, CmsPage, CmsPageDetail, CmsVisualModuleDefinitionsList } from "./cms-admin";
import { saveCmsBuilderDraftAction, saveCmsVisualModuleDefinitionAction } from "./cms-admin-actions";
import { CmsBlockBuilderClient } from "./cms-block-builder-client";
import type { CmsBlock } from "./cms-blocks";

type CmsBlockBuilderPageProps = {
  context: AdminContext;
  data: CmsAdminData;
  locale: string;
  message?: string;
  messageSeverity?: "success" | "error";
  pageId?: string;
};

type CmsBlockBuilderPageOption = Pick<CmsPage, "pageId" | "pageType" | "path" | "status" | "title">;

function pageVersionBlocks(page: CmsPageDetail | null): CmsBlock[] {
  return page?.latestVersion?.blocks ?? page?.publishedVersion?.blocks ?? [];
}

function pageVersion(page: CmsPageDetail | null) {
  return page?.latestVersion ?? page?.publishedVersion ?? null;
}

function pageVersionLabel(page: CmsPageDetail | null) {
  const version = pageVersion(page);
  return version ? `version ${version.version}` : "sin version";
}

function visualModuleStats(visualModules: CmsVisualModuleDefinitionsList) {
  const active = visualModules.items.filter((module) => module.status === "ACTIVE").length;
  const drafts = visualModules.items.filter((module) => module.status === "DRAFT").length;
  const archived = visualModules.items.filter((module) => module.status === "ARCHIVED").length;
  return { active, archived, drafts };
}

export function CmsBlockBuilderPage({ context, data, locale, message, messageSeverity = "success", pageId }: CmsBlockBuilderPageProps) {
  const selectedPage = data.selectedPage.data;
  const selectedVersion = pageVersion(selectedPage);
  const loadedBlocks = pageVersionBlocks(selectedPage);
  const pageOptions: CmsBlockBuilderPageOption[] = data.pages.data.items.map((page) => ({
    pageId: page.pageId,
    pageType: page.pageType,
    path: page.path,
    status: page.status,
    title: page.title,
  }));
  const resolved = data.resolvedPageSettings.data;
  const visualModules = data.visualModules.data;
  const visualStats = visualModuleStats(visualModules);

  return (
    <main className="adminPage cmsAdminPage cmsBlockBuilderPage">
      <section className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / CMS / Builder</div>
          <h1>CMS Block Builder</h1>
          <p>Canvas visual para montar bloques CMS con el registry compartido.</p>
        </div>
      </section>

      {data.pages.source === "unavailable" ? (
        <section className="adminBanner adminBannerWarning">
          <strong>No se pudo listar paginas CMS.</strong>
          <p>{data.pages.message}</p>
        </section>
      ) : null}

      {pageId && data.selectedPage.source === "unavailable" ? (
        <section className="adminBanner adminBannerError">
          <strong>No se pudo abrir la pagina CMS.</strong>
          <p>{data.selectedPage.message}</p>
        </section>
      ) : null}

      {message ? (
        <section className={`adminBanner ${messageSeverity === "error" ? "adminBannerError" : "adminBannerInfo"}`}>
          <p>{message}</p>
        </section>
      ) : null}

      {data.visualModules.source === "unavailable" ? (
        <section className="adminBanner adminBannerWarning">
          <strong>No se pudo cargar la biblioteca visual.</strong>
          <p>{data.visualModules.message}</p>
        </section>
      ) : null}

      <section className="pricingPanel cmsBlockBuilderVisualLibrary" aria-label="Biblioteca visual CMS">
        <div className="pricingPanelHeader">
          <div>
            <h2>Biblioteca visual</h2>
            <p>Modulos reutilizables independientes de paginas</p>
          </div>
          <dl className="pricingDefinitionGrid">
            <div>
              <dt>Total</dt>
              <dd>{visualModules.total}</dd>
            </div>
            <div>
              <dt>Activos</dt>
              <dd>{visualStats.active}</dd>
            </div>
            <div>
              <dt>Drafts</dt>
              <dd>{visualStats.drafts}</dd>
            </div>
            <div>
              <dt>Archivados</dt>
              <dd>{visualStats.archived}</dd>
            </div>
          </dl>
        </div>
        {visualModules.items.length > 0 ? (
          <div className="cmsBlockBuilderVisualModuleList">
            {visualModules.items.slice(0, 6).map((module) => (
              <article className="cmsBlockBuilderVisualModuleItem" key={module.definitionId}>
                <div>
                  <strong>{module.name}</strong>
                  <span>{module.status} - rev {module.revision}</span>
                </div>
                <small>{module.moduleId}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="adminContextHint">Aun no hay modulos visuales reutilizables en esta tienda.</p>
        )}
      </section>

      <CmsBlockBuilderClient
        initialBlocks={loadedBlocks}
        contextLabel={`${context.organizationId || "organization"} / ${context.shopId || "shop"} / ${locale}`}
        initialPageId={pageId}
        locale={locale}
        pageOptions={pageOptions}
        pageSummary={selectedPage ? {
          canSaveDraft: selectedPage.status !== "PUBLISHED",
          pageId: selectedPage.pageId,
          pageType: selectedPage.pageType,
          path: selectedPage.path,
          seoDescription: selectedVersion?.seo.description ?? "",
          seoTitle: selectedVersion?.seo.title ?? selectedPage.title,
          status: selectedPage.status,
          title: selectedPage.title,
          versionLabel: pageVersionLabel(selectedPage),
        } : null}
        resolvedCanvas={resolved ? {
          layout: resolved.layout,
          modules: resolved.modules,
          tokens: resolved.tokens,
        } : null}
        resolvedSummary={resolved ? {
          maxWidth: resolved.tokens.maxWidth,
          moduleSlots: resolved.moduleSlots.length,
          modules: resolved.modules.length,
          templateId: resolved.templateId,
        } : null}
        saveDraftAction={saveCmsBuilderDraftAction}
        saveVisualModuleDefinitionAction={saveCmsVisualModuleDefinitionAction}
        visualModules={visualModules}
      />
    </main>
  );
}
