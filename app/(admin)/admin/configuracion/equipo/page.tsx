import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { getAdminSession } from "../../../../../src/shared/auth/session";
import { EmployeesAdminPage } from "../../../../../src/modules/configuracion/employees-admin-page";
import { getEmployeesModuleData } from "../../../../../src/modules/configuracion/employees";
import {
  createEmployeeAction,
  createProfileAction,
  updateEmployeeDefaultShopAction,
  updateEmployeeAction,
  updateEmployeeShopScopesAction,
  updateEmployeeStatusAction,
  resetEmployeeCredentialAction,
  updateProfileAction,
  updateProfilePermissionsAction,
} from "../../../../../src/modules/configuracion/employees-actions";

type EquipoPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
    tab?: string;
  }>;
};

function normalizeTab(value: string | undefined) {
  if (value === "create-employee" || value === "profiles" || value === "permissions") {
    return value;
  }

  return "employees";
}

export default async function EquipoPage({ searchParams }: EquipoPageProps) {
  const params = await searchParams;
  const [context, session] = await Promise.all([getAdminContext(), getAdminSession()]);
  const data = await getEmployeesModuleData(context);
  const roles = new Set(session?.roles.map((role) => role.toLowerCase()));
  const permissions = new Set(session?.permissions.map((permission) => permission.toLowerCase()));
  const canResetCredentials = roles.has("superadmin") && (
    permissions.has("system.admin") || permissions.has("*") || permissions.has("admin:*")
  );

  return (
    <EmployeesAdminPage
      context={context}
      canResetCredentials={canResetCredentials}
      createEmployeeAction={createEmployeeAction}
      createProfileAction={createProfileAction}
      data={data}
      error={params?.error}
      initialTab={normalizeTab(params?.tab)}
      notice={params?.notice}
      resetEmployeeCredentialAction={resetEmployeeCredentialAction}
      updateEmployeeAction={updateEmployeeAction}
      updateEmployeeDefaultShopAction={updateEmployeeDefaultShopAction}
      updateEmployeeShopScopesAction={updateEmployeeShopScopesAction}
      updateEmployeeStatusAction={updateEmployeeStatusAction}
      updateProfileAction={updateProfileAction}
      updateProfilePermissionsAction={updateProfilePermissionsAction}
    />
  );
}
