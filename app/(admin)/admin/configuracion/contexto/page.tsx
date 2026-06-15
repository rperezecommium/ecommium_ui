import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  createShopAction,
  updateAdminContext,
  updateShopAction,
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
  }>;
};

export default async function ContextoPage({ searchParams }: ContextoPageProps) {
  const params = await searchParams;
  const context = await getAdminContext();
  const directory = await getOrganizationShopDirectory();
  const inheritance = await getShopSettingsInheritance(context);

  return (
    <ContextSettingsPage
      context={context}
      createShopAction={createShopAction}
      directory={directory}
      error={params?.contextError}
      inheritance={inheritance}
      notice={params?.contextNotice}
      updateAction={updateAdminContext}
      updateShopAction={updateShopAction}
    />
  );
}
