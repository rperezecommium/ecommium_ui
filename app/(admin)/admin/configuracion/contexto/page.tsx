import { getCurrentAdminSession as getAdminSession } from "../../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  createOrganizationAction,
  createShopAction,
  updateAdminContext,
  updateShopAction,
  updateOrganizationTimezoneAction,
} from "../../../../../src/modules/configuracion/context-actions";
import {
  getOrganizationShopDirectory,
  getShopSettingsInheritance,
} from "../../../../../src/modules/configuracion/organization-shop";
import { ContextSettingsPage } from "../../../../../src/modules/configuracion/context-settings-page";

type ContextoPageProps = {
  searchParams?: Promise<{
    contextError?: string;
    contextNotice?: string;
    tab?: string;
    preparationOrganizationId?: string;
    preparationShopId?: string;
  }>;
};

export default async function ContextoPage({ searchParams }: ContextoPageProps) {
  const params = await searchParams;
  const context = await getAdminContext();
  const session = await getAdminSession();
  const canManageReadPreparation = Boolean(session?.permissions.some(p=>["*","system.admin","admin:*","organizations-shops.manage"].includes(p)));
  const directory = await getOrganizationShopDirectory();
  const inheritance = await getShopSettingsInheritance(context);

  return (
    <ContextSettingsPage
      canManageReadPreparation={canManageReadPreparation}
      activeTab={params?.tab}
      preparationTarget={params?.preparationOrganizationId && params?.preparationShopId ? { organizationId: params.preparationOrganizationId, shopId: params.preparationShopId } : undefined}
      context={context}
      createOrganizationAction={createOrganizationAction}
      createShopAction={createShopAction}
      directory={directory}
      error={params?.contextError}
      inheritance={inheritance}
      notice={params?.contextNotice}
      updateAction={updateAdminContext}
      updateShopAction={updateShopAction}
      updateOrganizationTimezoneAction={updateOrganizationTimezoneAction}
    />
  );
}
