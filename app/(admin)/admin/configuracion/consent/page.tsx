import { getAdminSession } from "../../../../../src/shared/auth/session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { can } from "../../../../../src/shared/permissions/permissions";
import { getConsentConfigurationAdminData, getConsentIntegrationCatalogAdminData, type ConsentScopeType } from "../../../../../src/modules/configuracion/consent-configuration-admin";
import { ConsentConfigurationAdminPage } from "../../../../../src/modules/configuracion/consent-configuration-admin-page";

const scopeTypes = new Set<ConsentScopeType>(["ORGANIZATION", "SHOP"]);
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function ConsentConfigurationPage({ searchParams }: { searchParams?: Promise<{ notice?: string | string[]; scopeType?: string | string[]; tab?: string | string[] }> }) {
  const session = await getAdminSession();
  if (!session || session.scope !== "admin" || !can(session, "admin:consent:view")) return <main className="adminPage"><div className="adminBreadcrumb">Admin / Configuracion / Consentimiento</div><section className="adminBanner adminBannerError"><strong>No tienes acceso a Consentimiento.</strong><p>Esta operación requiere <code>consent.configuration.read</code>.</p></section></main>;
  const params = await searchParams;
  const selected = first(params?.scopeType);
  const scopeType = selected && scopeTypes.has(selected as ConsentScopeType) ? selected as ConsentScopeType : "SHOP";
  const tab = first(params?.tab) === "HISTORY" ? "HISTORY" : undefined;
  const context = await getAdminContext();
  const [result, catalogResult, historyResults] = await Promise.all([
    getConsentConfigurationAdminData(context, scopeType),
    getConsentIntegrationCatalogAdminData(context),
    tab === "HISTORY"
      ? Promise.all((["SHOP", "ORGANIZATION"] as ConsentScopeType[]).map(async (historyScope) => ({ scopeType: historyScope, result: await getConsentConfigurationAdminData(context, historyScope) })))
      : Promise.resolve(undefined),
  ]);
  return <ConsentConfigurationAdminPage canPublish={can(session, "admin:consent:publish")} canWrite={can(session, "admin:consent:write")} context={context} historyResults={historyResults} integrationCatalog={catalogResult.ok ? catalogResult.data : []} integrationCatalogError={catalogResult.ok ? undefined : catalogResult.error} notice={first(params?.notice)} result={result} scopeType={scopeType} tab={tab} />;
}
