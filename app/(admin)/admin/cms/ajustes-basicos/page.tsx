import { getAdminSession } from "../../../../../src/shared/auth/session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { can } from "../../../../../src/shared/permissions/permissions";
import {
  getCmsFontOptions,
  getCmsGlobalSettings,
  listCmsTemplates,
  type CmsPageType,
  type CmsTemplateStatus,
} from "../../../../../src/modules/cms/cms-admin";
import { CmsBasicSettingsPageView } from "../../../../../src/modules/cms/cms-basic-settings-page";

type CmsBasicSettingsPageProps = {
  searchParams?: Promise<{
    locale?: string;
    cmsSettingsMessage?: string;
    tab?: string;
    pageType?: string;
    status?: string;
    templateId?: string;
    drawer?: string;
  }>;
};

function tabParam(value: string | undefined) {
  return value === "templates" ? "templates" as const : "global" as const;
}

function pageTypeParam(value: string | undefined): CmsPageType | "all" {
  if (value === "CONTENT" || value === "HOME" || value === "LANDING") {
    return value;
  }
  return "all";
}

function templateStatusParam(value: string | undefined): CmsTemplateStatus | "all" {
  if (value === "DRAFT" || value === "ACTIVE" || value === "ARCHIVED") {
    return value;
  }
  return "all";
}

function drawerParam(value: string | undefined) {
  return value === "create" ? "create" as const : undefined;
}

export default async function CmsBasicSettingsPage({ searchParams }: CmsBasicSettingsPageProps) {
  const session = await getAdminSession();

  if (!session || session.scope !== "admin" || !can(session, "admin:cms-settings:view")) {
    return (
      <main className="adminPage">
        <div className="adminBreadcrumb">Admin / CMS / Ajustes basicos</div>
        <section className="adminBanner adminBannerError">
          <strong>No tienes acceso a Ajustes basicos CMS.</strong>
          <p>Esta pantalla requiere el permiso <code>cms.settings.read</code>.</p>
        </section>
      </main>
    );
  }

  const params = await searchParams;
  const context = await getAdminContext();
  const locale = params?.locale ?? context.locale;
  const activeTab = tabParam(params?.tab);
  const templateFilters = {
    pageType: pageTypeParam(params?.pageType),
    status: templateStatusParam(params?.status),
    limit: 50,
    offset: 0,
  };
  const [result, templatesResult, fontOptionsResult] = await Promise.all([
    getCmsGlobalSettings(context, locale),
    listCmsTemplates(context, templateFilters, locale),
    getCmsFontOptions(context, locale),
  ]);

  return (
    <CmsBasicSettingsPageView
      activeTab={activeTab}
      context={context}
      drawer={drawerParam(params?.drawer)}
      fontOptionsResult={fontOptionsResult}
      locale={locale}
      message={params?.cmsSettingsMessage}
      result={result}
      selectedTemplateId={params?.templateId}
      templateFilters={templateFilters}
      templatesResult={templatesResult}
    />
  );
}
