import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { EmployeesAdminPage } from "../../../../../src/modules/configuracion/employees-admin-page";
import { getEmployeesModuleData } from "../../../../../src/modules/configuracion/employees";
import {
  createEmployeeAction,
  createProfileAction,
  updateEmployeeAction,
  updateEmployeeStatusAction,
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
  if (value === "profiles" || value === "permissions") {
    return value;
  }

  return "employees";
}

export default async function EquipoPage({ searchParams }: EquipoPageProps) {
  const params = await searchParams;
  const context = await getAdminContext();
  const data = await getEmployeesModuleData(context);

  return (
    <EmployeesAdminPage
      context={context}
      createEmployeeAction={createEmployeeAction}
      createProfileAction={createProfileAction}
      data={data}
      error={params?.error}
      initialTab={normalizeTab(params?.tab)}
      notice={params?.notice}
      updateEmployeeAction={updateEmployeeAction}
      updateEmployeeStatusAction={updateEmployeeStatusAction}
      updateProfileAction={updateProfileAction}
      updateProfilePermissionsAction={updateProfilePermissionsAction}
    />
  );
}
