import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "../../../../../src/shared/permissions/permissions";
import { getAdminSecurityData } from "../../../../../src/modules/configuracion/admin-security";
import { AdminSecurityPanel } from "../../../../../src/modules/configuracion/admin-security-panel";
import {getEmployeesCapabilities} from "../../../../../src/modules/configuracion/employees-capabilities";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { getCurrentAdminSession as getAdminSession } from "../../../../../src/modules/auth/current-admin-session";
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
    securityDrawer?: string;
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
  if (params?.tab === "security") {
    const securityData = await getAdminSecurityData();
    const drawer = params.securityDrawer === "password" || params.securityDrawer === "step-up" ? params.securityDrawer : undefined;
    const teamTabs = [
      {id:"employees",label:"Empleados"}, {id:"profiles",label:"Perfiles"},
      {id:"permissions",label:"Permisos"}, {id:"security",label:"Seguridad"},
    ].filter(item => item.id === "security" || (session && can(session,"admin:employees:view")));
    return <main className="adminPage employeesAdminPage">
      <div className="adminPageHeader"><div>
        <div className="adminBreadcrumb">Admin / Configuracion / Equipo / Seguridad</div>
        <h1 className="adminPageTitle">Equipo</h1>
        <p className="adminPageIntro">Seguridad de tu cuenta y dispositivos con acceso.</p>
      </div></div>
      {params.notice ? <div className="adminBanner">{params.notice}</div> : null}
      {params.error ? <div className="adminBanner adminBannerError" role="alert">{params.error}</div> : null}
      <div className="employeesToolbar"><div className="adminTabs" role="tablist" aria-label="Equipo">
        {teamTabs.map(item => <Link key={item.id} role="tab" aria-selected={item.id === "security"} className={item.id === "security" ? "adminTab adminTabActive" : "adminTab"} href={`/admin/configuracion/equipo?tab=${item.id}`}>{item.label}</Link>)}
      </div></div>
      <section className="employeesWorkspace"><AdminSecurityPanel data={securityData} drawer={drawer} /></section>
    </main>;
  }
  if (session && !can(session,"admin:employees:view")) redirect("/admin/configuracion/equipo?tab=security");
  const data = await getEmployeesModuleData(context);
  const capabilities=getEmployeesCapabilities(session);

  return (
    <EmployeesAdminPage
      key={JSON.stringify([params?.tab, params?.error, params?.notice, data.employees.length])}
      context={context}
      {...capabilities}
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
