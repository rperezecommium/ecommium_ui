import { updateAdminContext, getAdminContext } from "../../../../../src/shared/config/admin-context";
import {
  getOrganizationShopDirectory,
  getShopSettingsInheritance,
} from "../../../../../src/modules/configuracion/organization-shop";
import { ContextSettingsPage } from "../../../../../src/modules/configuracion/context-settings-page";

export default async function ContextoPage() {
  const context = await getAdminContext();
  const directory = await getOrganizationShopDirectory();
  const inheritance = await getShopSettingsInheritance(context);

  return (
    <ContextSettingsPage
      context={context}
      directory={directory}
      inheritance={inheritance}
      updateAction={updateAdminContext}
    />
  );
}
