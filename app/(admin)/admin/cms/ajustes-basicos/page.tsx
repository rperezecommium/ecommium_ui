import { getCurrentAdminSession as getAdminSession } from "../../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { can } from "../../../../../src/shared/permissions/permissions";
import {getCmsFontOptions,getCmsGlobalSettings} from "../../../../../src/modules/cms/cms-admin";
import { CmsBasicSettingsPageView } from "../../../../../src/modules/cms/cms-basic-settings-page";
import {redirect} from 'next/navigation';

type CmsBasicSettingsPageProps = {
  searchParams?: Promise<{
    locale?: string;
    cmsSettingsMessage?: string;
    tab?: string;
  }>;
};

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
  if(params?.tab==='templates')redirect('/admin/cms/plantillas');
  const context=await getAdminContext(),locale=params?.locale??context.locale;
  const [result,fontOptionsResult]=await Promise.all([getCmsGlobalSettings(context,locale),getCmsFontOptions(context,locale)]);
  const canWrite=session.permissions.some(permission=>['*','admin:*','system.admin','cms.settings.write'].includes(permission));
  return <CmsBasicSettingsPageView context={context} canWrite={canWrite} locale={locale} message={params?.cmsSettingsMessage} result={result} fontOptionsResult={fontOptionsResult}/>;
}
