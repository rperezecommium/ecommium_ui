import dynamic from "next/dynamic";
import {redirect} from 'next/navigation';
import { getCurrentAdminSession } from "../../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  getCompositionTemplate,
  listCompositionTemplates,
} from "../../../../../src/modules/cms/cms-composition-templates";
import { listIndependentModules } from "../../../../../src/modules/cms/cms-independent-modules";
import { listIndependentSections } from "../../../../../src/modules/cms/cms-independent-sections";
import { copyTemplateContent } from "../../../../../src/modules/cms/cms-composition-template-copy";
const Library = dynamic(() =>
  import("../../../../../src/modules/cms/cms-template-library-client").then(
    (m) => m.CmsTemplateLibraryClient,
  ),
);
const Section = dynamic(() =>
  import("../../../../../src/modules/cms/cms-section-builder-client").then(
    (m) => m.CmsSectionBuilderClient,
  ),
);
const Page = dynamic(() =>
  import("../../../../../src/modules/cms/cms-page-composer-client").then(
    (m) => m.CmsPageComposerClient,
  ),
);
const empty = { items: [], total: 0, limit: 50, offset: 0 };
export default async function Templates({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    apply?: string;
    status?: string;
    offset?: string;
    kind?:string;
  }>;
}) {
  const session = await getCurrentAdminSession(),
    params = await searchParams;
  const allowed = (permission: string) =>
    session?.scope === "admin" &&
    session.permissions.some((p) =>
      ["*", "admin:*", "system.admin", permission].includes(p),
    );
  if(params.kind==='layout')redirect('/admin/cms/plantillas');
  if (!allowed("cms.pages.read") && !allowed("cms.pages.write"))
    return (
      <main className="adminPage">
        <p role="alert">No tienes acceso a las plantillas CMS.</p>
      </main>
    );
  const context = await getAdminContext(),
    canWrite = !!allowed("cms.pages.write");
  if (params.id) {
    const result = await getCompositionTemplate(context, params.id);
    if (!result.ok)
      return (
        <main className="adminPage">
          <p role="alert">{result.error}</p>
        </main>
      );
    const receipt = result.data,
      apply = params.apply === "1";
    if (apply && (!canWrite || receipt.status !== "DRAFT"))
      return (
        <main className="adminPage">
          <p role="alert">Esta plantilla no se puede aplicar.</p>
        </main>
      );
    const content = apply
      ? copyTemplateContent(receipt.document.content)
      : receipt.document.content;
    const key = `${context.organizationId}:${context.shopId}:${context.locale}:${receipt.resourceId}:${receipt.revisionToken}:${apply}`;
    if (content.kind === "SECTION") {
      const modules = await listIndependentModules(context);
      return (
        <Section
          key={key}
          initialReceipt={null}
          initialDocument={content.value}
          templateReceipt={apply ? undefined : receipt}
          initialList={empty}
          initialModules={modules.ok ? modules.data : empty}
          context={context}
          canWrite={canWrite && receipt.status === "DRAFT"}
          unavailable={modules.ok ? undefined : modules.error}
        />
      );
    }
    const sections = await listIndependentSections(context);
    return (
      <Page
        key={key}
        initialPage={null}
        initialDocument={content.value}
        templateReceipt={apply ? undefined : receipt}
        initialSections={sections.ok ? sections.data : empty}
        context={context}
        canWrite={canWrite && receipt.status === "DRAFT"}
        canPublish={apply && !!allowed("cms.pages.publish")}
        unavailable={sections.ok ? undefined : sections.error}
      />
    );
  }
  const status = params.status === "ARCHIVED" ? "ARCHIVED" : "DRAFT",
    offset = Math.max(0, Number.parseInt(params.offset ?? "0", 10) || 0);
  const list = await listCompositionTemplates(context, offset, status);
  return <Library
    key={`${context.organizationId}:${context.shopId}:${context.locale}:${status}:${offset}`}
    context={context}
    list={list.ok ? list.data : { ...empty, offset }}
    canWrite={canWrite}
    status={status}
    unavailable={list.ok ? undefined : list.error}
  />;
}
