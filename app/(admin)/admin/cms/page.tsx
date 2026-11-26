import dynamic from "next/dynamic";
import {getCurrentAdminSession} from "../../../../src/modules/auth/current-admin-session";
import {listIndependentSections} from "../../../../src/modules/cms/cms-independent-sections";
import {PathDrawer} from "../../../../src/modules/cms/cms-admin-page";
const Composer=dynamic(()=>import("../../../../src/modules/cms/cms-page-composer-client").then(m=>m.CmsPageComposerClient));
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
  if (value === "page" || value === "settings" || value === "blocks" || value === "seo" || value === "preview") {
    return value;
  }
  return "blocks";
}

function drawerParam(value: string | undefined) {
  if (value === "create" || value === "path" || value === "delete") {
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

  if(filters.drawer==='create'||(filters.mode==='editor'&&data.selectedPage.data?.contractVersion===1)){
    const session=await getCurrentAdminSession(),permissions=session?.permissions??[];
    const permitted=(permission:string)=>session?.scope==='admin'&&permissions.some(p=>['*','admin:*','system.admin',permission].includes(p));
    if(!permitted('cms.pages.read')&&!permitted('cms.pages.write'))return <p className="adminBanner adminBannerError">No tienes permiso para leer páginas.</p>;
    const scoped={...context,locale:filters.locale??context.locale};
    const sections=await listIndependentSections(scoped);
    const page=filters.drawer==='create'?null:data.selectedPage.data;
    return <><Composer key={`${scoped.organizationId}:${scoped.shopId}:${scoped.locale}:${page?.pageId??'new'}:${page?.revisionToken??'initial'}`} initialPage={page} initialSections={sections.ok?sections.data:{items:[],total:0,limit:50,offset:0}} context={scoped} canWrite={permitted('cms.pages.write')} canPublish={permitted('cms.pages.publish')} initialPreview={filters.tab==='preview'} unavailable={sections.ok?undefined:sections.error}/>{page&&permitted('cms.pages.publish')?<PathDrawer context={scoped} filters={filters} page={page}/>:null}</>;
  }
  return <CmsAdminPage context={context} data={data} filters={filters} />;
}
