import { getAdminSession } from "../../../../../src/shared/auth/session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { can } from "../../../../../src/shared/permissions/permissions";
import { getCmsAdminData } from "../../../../../src/modules/cms/cms-admin";
import { CmsBlockBuilderPage } from "../../../../../src/modules/cms/cms-block-builder-page";

type CmsBlockBuilderRouteProps = {
  searchParams?: Promise<{
    cmsBuilderMessage?: string;
    cmsBuilderMessageSeverity?: string;
    locale?: string;
    pageId?: string;
  }>;
};

export default async function CmsBlockBuilderRoute({ searchParams }: CmsBlockBuilderRouteProps) {
  const session = await getAdminSession();

  if (!session || session.scope !== "admin" || !can(session, "admin:cms-builder:view")) {
    return (
      <main className="adminPage cmsAdminPage cmsBlockBuilderPage">
        <div className="adminBreadcrumb">Admin / CMS / Builder</div>
        <section className="adminBanner adminBannerError">
          <strong>No tienes acceso al CMS Block Builder.</strong>
          <p>Esta pantalla requiere permisos de lectura CMS para empleados Admin.</p>
        </section>
      </main>
    );
  }

  const context = await getAdminContext();
  const params = await searchParams;

  return (
    <CmsBlockBuilderPage
      context={context}
      data={await getCmsAdminData(context, {
        locale: params?.locale ?? context.locale,
        mode: "editor",
        pageId: params?.pageId,
        pageType: "all",
        status: "all",
        tab: "blocks",
      })}
      message={params?.cmsBuilderMessage}
      messageSeverity={params?.cmsBuilderMessageSeverity === "error" ? "error" : "success"}
      locale={params?.locale ?? context.locale}
      pageId={params?.pageId}
    />
  );
}
