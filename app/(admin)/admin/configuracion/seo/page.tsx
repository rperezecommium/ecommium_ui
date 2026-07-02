import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { getSeoAdminData, type SeoAdminTab } from "../../../../../src/modules/configuracion/seo-admin";
import { SeoAdminPage } from "../../../../../src/modules/configuracion/seo-admin-page";

type SeoPageProps = {
  searchParams?: Promise<{
    tab?: string;
    locale?: string;
    status?: string;
    entityType?: string;
    entityId?: string;
    path?: string;
    limit?: string;
    offset?: string;
    resolve?: string;
    seoMessage?: string;
    drawer?: string;
    recordId?: string;
  }>;
};

const seoTabs = new Set<SeoAdminTab>([
  "summary",
  "routes",
  "redirects",
  "resolve",
  "sitemap",
]);

function tabParam(value: string | undefined): SeoAdminTab {
  return seoTabs.has(value as SeoAdminTab) ? value as SeoAdminTab : "summary";
}

function drawerParam(value: string | undefined): "create" | "edit" | undefined {
  return value === "create" || value === "edit" ? value : undefined;
}

export default async function SeoPage({ searchParams }: SeoPageProps) {
  const context = await getAdminContext();
  const params = await searchParams;
  const filters = {
    tab: tabParam(params?.tab),
    locale: params?.locale,
    status: params?.status,
    entityType: params?.entityType,
    entityId: params?.entityId,
    path: params?.path,
    limit: params?.limit,
    offset: params?.offset,
    resolveRequested: params?.resolve === "1",
    seoMessage: params?.seoMessage,
    drawer: drawerParam(params?.drawer),
    recordId: params?.recordId,
  };
  const data = await getSeoAdminData(context, filters);

  return <SeoAdminPage context={context} data={data} filters={filters} />;
}
