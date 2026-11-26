import { getCurrentAdminSession } from "../../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { getCmsSitePart, listCmsSiteParts } from "../../../../../src/modules/cms/cms-admin";
import { CmsSitePartsPage } from "../../../../../src/modules/cms/cms-site-parts-page";

export default async function CmsFootersPage({ searchParams }: { searchParams?: Promise<{ locale?: string; tab?: string; sitePartId?: string; cmsSitePartMessage?: string }> }) {
  const context = await getAdminContext(); const params = await searchParams; const locale = params?.locale ?? context.locale;
  const session = await getCurrentAdminSession();
  const canManage = Boolean(session?.permissions.some(permission => ["*", "admin:*", "system.admin", "cms.settings.write"].includes(permission)));
  const needsDetail = params?.tab === "design" || (!params?.tab && !!params?.sitePartId);
  const [current, requestedDetail] = await Promise.all([
    listCmsSiteParts(context, "FOOTER", locale),
    needsDetail && params?.sitePartId ? getCmsSitePart(context, params.sitePartId, locale) : Promise.resolve(null),
  ]);
  const firstId = current.ok ? current.data.items[0]?.sitePartId : undefined;
  const detail = needsDetail && !params?.sitePartId && firstId
    ? await getCmsSitePart(context, firstId, locale) : requestedDetail;
  return <CmsSitePartsPage canPublish={Boolean(session?.scope==='admin'&&session.permissions.some(permission=>['*','admin:*','system.admin','cms.pages.publish'].includes(permission)))} canManage={canManage} context={context} kind="FOOTER" locale={locale} data={current.ok ? current.data : { items: [], total: 0, limit: 100, offset: 0 }} detail={detail?.ok ? detail.data : null} selectedId={params?.sitePartId} tab={params?.tab} message={params?.cmsSitePartMessage} unavailable={!current.ok ? current.error : detail && !detail.ok ? detail.error : undefined} />;
}
