import { getAdminSession } from "../../../../src/shared/auth/session";
import { getAdminContext } from "../../../../src/shared/config/admin-context";
import { can } from "../../../../src/shared/permissions/permissions";
import { AnalyticsAdminPage } from "../../../../src/modules/analitica/analytics-admin-page";
import { getAnalyticsAdminData, resolveAnalyticsAdminFilters } from "../../../../src/modules/analitica/analytics-admin";

type AnaliticaPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function AnaliticaPage({ searchParams }: AnaliticaPageProps) {
  const session = await getAdminSession();

  if (!session || session.scope !== "admin" || !can(session, "admin:analytics:view")) {
    return (
      <main className="adminPage">
        <div className="adminBreadcrumb">Admin / Analitica</div>
        <section className="adminBanner adminBannerError">
          <strong>No tienes acceso a Analitica.</strong>
          <p>Esta consulta requiere el permiso <code>analytics.reports.read</code>.</p>
        </section>
      </main>
    );
  }

  const [context, params] = await Promise.all([getAdminContext(), searchParams]);
  const filters = resolveAnalyticsAdminFilters(params ?? {});
  const data = await getAnalyticsAdminData(context, filters);

  return <AnalyticsAdminPage context={context} data={data} filters={filters} />;
}
