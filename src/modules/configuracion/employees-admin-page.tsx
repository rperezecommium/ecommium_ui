"use client";

import { useMemo, useState } from "react";
import type { AdminContext } from "../../shared/config/admin-context";
import type {
  EmployeePermissionRecord,
  EmployeeProfileRecord,
  EmployeeRecord,
  EmployeesModuleData,
} from "./employees";

type EmployeesAdminPageProps = {
  context: AdminContext;
  createEmployeeAction: (formData: FormData) => Promise<void>;
  createProfileAction: (formData: FormData) => Promise<void>;
  data: EmployeesModuleData;
  error?: string;
  initialTab?: EmployeesTab;
  notice?: string;
  updateEmployeeAction: (formData: FormData) => Promise<void>;
  updateEmployeeStatusAction: (formData: FormData) => Promise<void>;
  updateProfileAction: (formData: FormData) => Promise<void>;
  updateProfilePermissionsAction: (formData: FormData) => Promise<void>;
};

type EmployeesTab = "employees" | "create-employee" | "profiles" | "permissions";

const tabs: Array<{ id: EmployeesTab; label: string }> = [
  { id: "employees", label: "Empleados" },
  { id: "create-employee", label: "Crear empleado" },
  { id: "profiles", label: "Perfiles" },
  { id: "permissions", label: "Permisos" },
];

function employeeIdOf(employee: EmployeeRecord) {
  return employee.employeeId || employee.id || employee.principalId || "";
}

function profileIdOf(profile: EmployeeProfileRecord) {
  return profile.profileId || profile.id || "";
}

function employeeDisplayName(employee: EmployeeRecord) {
  return employee.name || employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(" ") || "-";
}

function statusLabel(value: { active?: boolean; status?: unknown }) {
  if (typeof value.status === "string" && value.status.trim()) {
    return value.status;
  }

  if (typeof value.active === "boolean") {
    return value.active ? "ACTIVE" : "INACTIVE";
  }

  return "-";
}

function employeeProfileIdsOf(employee: EmployeeRecord) {
  if (Array.isArray(employee.profileIds) && employee.profileIds.length > 0) {
    return employee.profileIds;
  }

  if (Array.isArray(employee.profiles)) {
    return employee.profiles.map(profileIdOf).filter(Boolean);
  }

  return [];
}

function permissionValueOf(permission: EmployeePermissionRecord) {
  return permission.permission || permission.value || permission.key || permission.name || "";
}

function profilePermissionsText(profile: EmployeeProfileRecord | undefined) {
  return (profile?.permissions ?? []).join("\n");
}

function activeBadgeClass(value: { active?: boolean; status?: unknown }) {
  const status = statusLabel(value).toUpperCase();
  if (status === "ACTIVE") {
    return "adminBadge adminBadgeOk";
  }
  if (status === "INACTIVE" || status === "ARCHIVED" || status === "SUSPENDED") {
    return "adminBadge adminBadgeWarn";
  }
  return "adminBadge";
}

export function EmployeesAdminPage({
  context,
  createEmployeeAction,
  createProfileAction,
  data,
  error,
  initialTab = "employees",
  notice,
  updateEmployeeAction,
  updateEmployeeStatusAction,
  updateProfileAction,
  updateProfilePermissionsAction,
}: EmployeesAdminPageProps) {
  const [tab, setTab] = useState<EmployeesTab>(initialTab);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeIdOf(data.employees[0] ?? {}));
  const [selectedProfileId, setSelectedProfileId] = useState(profileIdOf(data.profiles[0] ?? {}));
  const [permissionsText, setPermissionsText] = useState(profilePermissionsText(data.profiles[0]));
  const canUseTenant = Boolean(context.organizationId && context.shopId);
  const selectedEmployee = data.employees.find((employee) => employeeIdOf(employee) === selectedEmployeeId);
  const selectedProfile = data.profiles.find((profile) => profileIdOf(profile) === selectedProfileId);
  const profileLabelById = useMemo(() => {
    return new Map(data.profiles.map((profile) => [profileIdOf(profile), profile.name || profileIdOf(profile)]));
  }, [data.profiles]);

  function selectProfile(profileId: string) {
    setSelectedProfileId(profileId);
    setPermissionsText(profilePermissionsText(data.profiles.find((profile) => profileIdOf(profile) === profileId)));
  }

  return (
    <main className="adminPage">
      <div className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / Configuracion / Equipo</div>
          <h1 className="adminPageTitle">Equipo, perfiles y permisos</h1>
          <p className="adminPageIntro">
            Gestiona empleados de backoffice al estilo PrestaShop: cada persona
            tiene cuenta propia, perfiles asignados y permisos efectivos por
            Organization/Shop.
          </p>
        </div>
        <div className="adminButtonRow">
          <span className={data.health.ok ? "adminBadge adminBadgeOk" : "adminBadge adminBadgeError"}>
            Employees {data.health.status}
          </span>
        </div>
      </div>

      {!canUseTenant ? (
        <div className="adminBanner adminBannerError">
          Define organizationId y shopId en el selector superior antes de operar Employees.
        </div>
      ) : null}
      {notice ? <div className="adminBanner">{notice}</div> : null}
      {error ? <div className="adminBanner adminBannerError">{error}</div> : null}
      {!data.health.ok ? (
        <div className="adminBanner adminBannerError">
          <strong>Employees no disponible.</strong>
          <p>{data.health.message}</p>
          {data.health.correlationId ? <p>CorrelationId: {data.health.correlationId}</p> : null}
        </div>
      ) : null}
      {data.errors.length > 0 ? (
        <div className="adminBanner">
          <strong>El BFF respondio parcialmente.</strong>
          <ul className="adminPlainList">
            {data.errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="adminKpiGrid" aria-label="Resumen de equipo">
        <article className="adminKpi">
          <span>Empleados</span>
          <strong>{data.employees.length}</strong>
          <div className="adminMuted">Cuentas de backoffice</div>
        </article>
        <article className="adminKpi">
          <span>Perfiles</span>
          <strong>{data.profiles.length}</strong>
          <div className="adminMuted">Roles operativos</div>
        </article>
        <article className="adminKpi">
          <span>Permisos</span>
          <strong>{data.permissions.length}</strong>
          <div className="adminMuted">Catalogo BFF</div>
        </article>
        <article className="adminKpi">
          <span>Contexto</span>
          <strong>{canUseTenant ? "Listo" : "Pendiente"}</strong>
          <div className="adminMuted">{context.organizationId || "-"} / {context.shopId || "-"}</div>
        </article>
      </section>

      <section className="adminCard">
        <div className="adminTabs" role="tablist" aria-label="Equipo">
          {tabs.map((item) => (
            <button
              className={tab === item.id ? "adminTab adminTabActive" : "adminTab"}
              key={item.id}
              onClick={() => setTab(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "employees" ? (
          <div className="adminTabPanel">
            <section className="adminSplit">
              <article>
                <div className="adminCardHeader">
                  <div>
                    <h2>Empleados</h2>
                    <p>Listado operativo con estado, perfiles y permisos efectivos.</p>
                  </div>
                  <span className="adminBadge">GET /admin/employees</span>
                </div>
                <div className="adminTableScroller">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Nombre</th>
                        <th>Estado</th>
                        <th>Perfiles</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employees.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No hay empleados devueltos por el BFF.</td>
                        </tr>
                      ) : (
                        data.employees.map((employee) => {
                          const employeeId = employeeIdOf(employee);
                          const isActive = statusLabel(employee).toUpperCase() === "ACTIVE";
                          const profileLabels = employeeProfileIdsOf(employee)
                            .map((profileId) => profileLabelById.get(profileId) || profileId)
                            .join(", ");

                          return (
                            <tr key={employeeId || employee.email}>
                              <td>{employee.email || "-"}</td>
                              <td>{employeeDisplayName(employee)}</td>
                              <td><span className={activeBadgeClass(employee)}>{statusLabel(employee)}</span></td>
                              <td>{profileLabels || "-"}</td>
                              <td>
                                <div className="adminButtonRow">
                                  <button
                                    className="adminButton"
                                    onClick={() => setSelectedEmployeeId(employeeId)}
                                    type="button"
                                  >
                                    Editar
                                  </button>
                                  <form action={updateEmployeeStatusAction}>
                                    <input name="employeeId" type="hidden" value={employeeId} />
                                    <input name="active" type="hidden" value={isActive ? "false" : "true"} />
                                    <button className="adminButton" type="submit">
                                      {isActive ? "Desactivar" : "Activar"}
                                    </button>
                                  </form>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <aside className="adminPanelStack">
                <form action={updateEmployeeAction} className="adminForm" key={selectedEmployeeId || "empty"}>
                  <h3>Editar empleado</h3>
                  {selectedEmployee ? (
                    <>
                      <input name="employeeId" type="hidden" value={selectedEmployeeId} />
                      <label className="adminField">
                        <span>Email</span>
                        <input defaultValue={selectedEmployee.email} name="email" type="email" />
                      </label>
                      <label className="adminField">
                        <span>Nombre visible</span>
                        <input defaultValue={employeeDisplayName(selectedEmployee)} name="name" />
                      </label>
                      <label className="adminField">
                        <span>Estado</span>
                        <select defaultValue={statusLabel(selectedEmployee)} name="status">
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                          <option value="INVITED">INVITED</option>
                        </select>
                      </label>
                      <fieldset className="adminFieldset">
                        <legend>Perfiles asignados</legend>
                        {data.profiles.map((profile) => {
                          const profileId = profileIdOf(profile);
                          return (
                            <label className="adminCheckbox" key={profileId}>
                              <input
                                defaultChecked={employeeProfileIdsOf(selectedEmployee).includes(profileId)}
                                name="profileIds"
                                type="checkbox"
                                value={profileId}
                              />
                              {profile.name || profileId}
                            </label>
                          );
                        })}
                      </fieldset>
                      <button className="adminButton adminButtonPrimary" disabled={!canUseTenant} type="submit">
                        Guardar empleado
                      </button>
                    </>
                  ) : (
                    <div className="adminEmptyState">Selecciona un empleado de la tabla.</div>
                  )}
                </form>
              </aside>
            </section>
          </div>
        ) : null}

        {tab === "create-employee" ? (
          <div className="adminTabPanel">
            <section className="adminSplit adminSplitFormFirst">
              <article>
                <div className="adminCardHeader">
                  <div>
                    <h2>Crear empleado</h2>
                    <p>Alta de cuenta operativa de backoffice con perfiles iniciales.</p>
                  </div>
                  <span className="adminBadge">POST /admin/employees</span>
                </div>
                <form action={createEmployeeAction} className="adminForm adminFormWide">
                  <label className="adminField">
                    <span>Email</span>
                    <input name="email" required type="email" />
                  </label>
                  <div className="adminFormGrid adminFormGridTwo">
                    <label className="adminField">
                      <span>Nombre</span>
                      <input name="firstName" />
                    </label>
                    <label className="adminField">
                      <span>Apellido</span>
                      <input name="lastName" />
                    </label>
                  </div>
                  <label className="adminField">
                    <span>Password inicial</span>
                    <input minLength={8} name="temporaryPassword" required type="password" />
                    <small>Debe tener minimo 8 caracteres. No se muestra despues de guardar.</small>
                  </label>
                  <label className="adminCheckbox">
                    <input defaultChecked name="active" type="checkbox" />
                    Activo
                  </label>
                  <fieldset className="adminFieldset">
                    <legend>Perfiles iniciales</legend>
                    {data.profiles.length === 0 ? (
                      <p className="adminMuted">Crea un perfil antes de asignarlo.</p>
                    ) : (
                      data.profiles.map((profile) => {
                        const profileId = profileIdOf(profile);
                        return (
                          <label className="adminCheckbox" key={profileId}>
                            <input name="profileIds" type="checkbox" value={profileId} />
                            {profile.name || profileId}
                          </label>
                        );
                      })
                    )}
                  </fieldset>
                  <div className="adminButtonRow">
                    <button className="adminButton adminButtonPrimary" disabled={!canUseTenant} type="submit">
                      Crear empleado
                    </button>
                    <button className="adminButton" onClick={() => setTab("employees")} type="button">
                      Cancelar
                    </button>
                  </div>
                </form>
              </article>

              <aside className="adminEmptyState">
                <h2>Contexto</h2>
                <p>El empleado se crea para el contexto activo del Admin.</p>
                <p>{context.organizationId || "Organization pendiente"}</p>
                <p>{context.shopId || "Shop pendiente"}</p>
              </aside>
            </section>
          </div>
        ) : null}

        {tab === "profiles" ? (
          <div className="adminTabPanel">
            <section className="adminSplit">
              <article>
                <div className="adminCardHeader">
                  <div>
                    <h2>Perfiles</h2>
                    <p>Perfiles operativos que agrupan permisos del backoffice.</p>
                  </div>
                  <span className="adminBadge">GET /admin/employees/profiles</span>
                </div>
                <div className="adminTableScroller">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>Perfil</th>
                        <th>Descripcion</th>
                        <th>Estado</th>
                        <th>Permisos</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.profiles.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No hay perfiles devueltos por el BFF.</td>
                        </tr>
                      ) : (
                        data.profiles.map((profile) => {
                          const profileId = profileIdOf(profile);
                          return (
                            <tr key={profileId}>
                              <td>{profile.name || profileId}</td>
                              <td>{profile.description || "-"}</td>
                              <td><span className={activeBadgeClass(profile)}>{statusLabel(profile)}</span></td>
                              <td>{profile.permissions?.length ?? 0}</td>
                              <td>
                                <button
                                  className="adminButton"
                                  onClick={() => {
                                    setSelectedProfileId(profileId);
                                    setPermissionsText(profilePermissionsText(profile));
                                  }}
                                  type="button"
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <aside className="adminPanelStack">
                <form action={createProfileAction} className="adminForm">
                  <h3>Crear perfil</h3>
                  <label className="adminField">
                    <span>Nombre</span>
                    <input name="name" required />
                  </label>
                  <label className="adminField">
                    <span>Descripcion</span>
                    <input name="description" />
                  </label>
                  <label className="adminCheckbox">
                    <input defaultChecked name="active" type="checkbox" />
                    Activo
                  </label>
                  <button className="adminButton adminButtonPrimary" disabled={!canUseTenant} type="submit">
                    Crear perfil
                  </button>
                </form>

                <form action={updateProfileAction} className="adminForm" key={selectedProfileId || "empty-profile"}>
                  <h3>Editar perfil</h3>
                  {selectedProfile ? (
                    <>
                      <input name="profileId" type="hidden" value={selectedProfileId} />
                      <label className="adminField">
                        <span>Nombre</span>
                        <input defaultValue={selectedProfile.name} name="name" />
                      </label>
                      <label className="adminField">
                        <span>Descripcion</span>
                        <input defaultValue={selectedProfile.description ?? ""} name="description" />
                      </label>
                      <label className="adminField">
                        <span>Estado</span>
                        <select defaultValue={statusLabel(selectedProfile)} name="status">
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                          <option value="ARCHIVED">ARCHIVED</option>
                        </select>
                      </label>
                      <button className="adminButton adminButtonPrimary" disabled={!canUseTenant} type="submit">
                        Guardar perfil
                      </button>
                    </>
                  ) : (
                    <div className="adminEmptyState">Selecciona un perfil de la tabla.</div>
                  )}
                </form>
              </aside>
            </section>
          </div>
        ) : null}

        {tab === "permissions" ? (
          <div className="adminTabPanel">
            <section className="adminSplit">
              <article>
                <div className="adminCardHeader">
                  <div>
                    <h2>Catalogo de permisos</h2>
                    <p>Selecciona permisos y asignales al perfil activo.</p>
                  </div>
                  <span className="adminBadge">GET /admin/employees/permissions/catalog</span>
                </div>
                <div className="adminPermissionGrid">
                  {data.permissions.length === 0 ? (
                    <div className="adminEmptyState">El BFF no devolvio catalogo de permisos.</div>
                  ) : (
                    data.permissions.map((permission) => {
                      const value = permissionValueOf(permission);
                      return (
                        <button
                          className="adminPermissionItem"
                          key={value}
                          onClick={() => {
                            const current = new Set(permissionsText.split(/\n|,/).map((item) => item.trim()).filter(Boolean));
                            if (current.has(value)) {
                              current.delete(value);
                            } else {
                              current.add(value);
                            }
                            setPermissionsText(Array.from(current).join("\n"));
                          }}
                          type="button"
                        >
                          <strong>{value}</strong>
                          <span>{permission.description || permission.category || "Permiso BFF"}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </article>

              <aside>
                <form action={updateProfilePermissionsAction} className="adminForm">
                  <h3>Asignar permisos</h3>
                  <label className="adminField">
                    <span>Perfil</span>
                    <select
                      name="profileId"
                      onChange={(event) => selectProfile(event.target.value)}
                      value={selectedProfileId}
                    >
                      <option value="">Selecciona perfil</option>
                      {data.profiles.map((profile) => {
                        const profileId = profileIdOf(profile);
                        return (
                          <option key={profileId} value={profileId}>
                            {profile.name || profileId}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="adminField">
                    <span>Permisos</span>
                    <textarea
                      className="adminTextarea"
                      name="permissions"
                      onChange={(event) => setPermissionsText(event.target.value)}
                      rows={14}
                      value={permissionsText}
                    />
                    <small>Uno por linea o separados por coma. El BFF decide la seguridad real.</small>
                  </label>
                  <button className="adminButton adminButtonPrimary" disabled={!canUseTenant || !selectedProfileId} type="submit">
                    Guardar permisos
                  </button>
                </form>
              </aside>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
