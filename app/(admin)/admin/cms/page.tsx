import { getAdminContext } from "../../../../src/shared/config/admin-context";
import {
  getCmsAdminData,
  type CmsAdminFilters,
  type CmsPageStatus,
  type CmsPageType,
} from "../../../../src/modules/cms/cms-admin";
import { CmsAdminPage } from "../../../../src/modules/cms/cms-admin-page";

type CmsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    pageType?: string;
    locale?: string;
    pageId?: string;
    mode?: string;
    tab?: string;
    drawer?: string;
    cmsMessage?: string;
  }>;
};

function statusParam(value: string | undefined): CmsPageStatus | "all" {
  if (value === "DRAFT" || value === "PUBLISHED" || value === "UNPUBLISHED") {
    return value;
  }
  return "all";
}

function pageTypeParam(value: string | undefined): CmsPageType | "all" {
  if (value === "CONTENT" || value === "HOME" || value === "LANDING") {
    return value;
  }
  return "all";
}

function modeParam(value: string | undefined) {
  return value === "editor" ? "editor" as const : "list" as const;
}

function tabParam(value: string | undefined) {
  if (value === "page" || value === "blocks" || value === "plp" || value === "seo" || value === "preview") {
    return value;
  }
  return "blocks";
}

function drawerParam(value: string | undefined) {
  if (value === "create" || value === "path") {
    return value;
  }
  return undefined;
}

export default async function CmsPage({ searchParams }: CmsPageProps) {
  const context = await getAdminContext();
  const params = await searchParams;
  const filters: CmsAdminFilters = {
    q: params?.q,
    status: statusParam(params?.status),
    pageType: pageTypeParam(params?.pageType),
    locale: params?.locale,
    pageId: params?.pageId,
    mode: modeParam(params?.mode),
    tab: tabParam(params?.tab),
    drawer: drawerParam(params?.drawer),
    cmsMessage: params?.cmsMessage,
  };
  const data = await getCmsAdminData(context, filters);

  return <CmsAdminPage context={context} data={data} filters={filters} />;
}
