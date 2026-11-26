import dynamic from "next/dynamic";
import { getCurrentAdminSession } from "../../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  getIndependentModule,
  listIndependentModules,
} from "../../../../../src/modules/cms/cms-independent-modules";
const Builder = dynamic(() =>
  import("../../../../../src/modules/cms/cms-module-builder-client").then(
    (module) => module.CmsModuleBuilderClient,
  ),
);
export default async function CmsModulesPage({
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
          No tienes acceso a los módulos CMS.
        </p>
      </main>
    );
  const context = await getAdminContext(),
    params = await searchParams;
  const status = params?.status === "ARCHIVED" ? "ARCHIVED" : "DRAFT";
  const offset = Math.max(0, Number.parseInt(params?.offset ?? "0", 10) || 0);
  const [list, detail] = await Promise.all([
    listIndependentModules(context, status, offset),
    params?.id
      ? getIndependentModule(context, params.id)
      : Promise.resolve(null),
  ]);
  return (
    <Builder
      listStatus={status}
      key={params?.id ?? `${status}:${offset}`}
      context={{
        organizationId: context.organizationId,
        shopId: context.shopId,
      }}
      canWrite={permissions.some((p) =>
        ["*", "admin:*", "system.admin", "cms.pages.write"].includes(p),
      )}
      initialList={
        list.ok ? list.data : { items: [], total: 0, limit: 50, offset }
      }
      initialReceipt={detail?.ok ? detail.data : null}
      unavailable={
        !list.ok ? list.error : detail && !detail.ok ? detail.error : undefined
      }
    />
  );
}
