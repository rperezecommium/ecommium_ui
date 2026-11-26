import {listIndependentModules} from '../../../../../src/modules/cms/cms-independent-modules';
import dynamic from "next/dynamic";
import { getCurrentAdminSession } from "../../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  getIndependentSection,
  listIndependentSections,
} from "../../../../../src/modules/cms/cms-independent-sections";
const Builder = dynamic(() =>
  import("../../../../../src/modules/cms/cms-section-builder-client").then(
    (module) => module.CmsSectionBuilderClient,
  ),
);
export default async function CmsSectionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; status?: string; offset?: string }>;
}) {
  const session = await getCurrentAdminSession();
  const permissions = session?.permissions ?? [];
  const canRead =
    session?.scope === "admin" &&
    permissions.some((p) =>
      [
        "*",
        "admin:*",
        "system.admin",
        "cms.pages.read",
        "cms.pages.write",
      ].includes(p),
    );
  if (!canRead)
    return (
      <main className="adminPage">
        <p className="adminBanner adminBannerError">
          No tienes acceso a los secciones CMS.
        </p>
      </main>
    );
  const context = await getAdminContext(),
    params = await searchParams;
  const offset = Math.max(0, Number.parseInt(params?.offset ?? "0", 10) || 0);
  const [list, detail, modules] = await Promise.all([
    listIndependentSections(context, offset),
    params?.id
      ? getIndependentSection(context, params.id)
      : Promise.resolve(null),
    listIndependentModules(context),
  ]);
  return (
    <Builder
      key={params?.id ?? `${context.organizationId}:${context.shopId}:${context.locale}:${offset}`}
      initialModules={modules.ok?modules.data:{items:[],total:0,limit:50,offset:0}}
      context={{
        organizationId: context.organizationId,
        shopId: context.shopId,
        locale: context.locale,
      }}
      canWrite={permissions.some((p) =>
        ["*", "admin:*", "system.admin", "cms.pages.write"].includes(p),
      )}
      initialList={
        list.ok ? list.data : { items: [], total: 0, limit: 50, offset }
      }
      initialReceipt={detail?.ok ? detail.data : null}
      unavailable={
        !list.ok ? list.error : !modules.ok?modules.error:detail && !detail.ok ? detail.error : undefined
      }
    />
  );
}
