import Link from "next/link";
import type { AdminSession } from "../shared/auth/session";
import type { AdminContext } from "../shared/config/admin-context";
import type { OrganizationShopDirectory } from "../modules/configuracion/organization-shop";
import { updateAdminContext } from "../modules/configuracion/context-actions";
import { logoutAdminEmployee } from "../modules/auth/admin-session-actions";
import { filterAllowedNavigation } from "../shared/permissions/permissions";
import { AdminContextSelector } from "./admin-context-selector";

const navItems = [
  { href: "/admin", label: "Inicio", description: "Health y contexto", permission: "admin:view" as const },
  { href: "/admin/configuracion", label: "Configuracion", description: "Tenant, tiendas y equipo", permission: "admin:configuration:view" as const },
  { href: "/admin/catalogo", label: "Catalogo", description: "Productos y contenido comercial", permission: "admin:catalog:view" as const },
  { href: "/admin/pedidos", label: "Pedidos", description: "Operacion y fulfillment", permission: "admin:orders:view" as const },
  { href: "/admin/clientes", label: "Clientes", description: "Customer 360", permission: "admin:customers:view" as const },
  { href: "/admin/transporte", label: "Transporte", description: "Carriers, zonas y SLA", permission: "admin:shipping:view" as const },
  { href: "/admin/pagos", label: "Pagos", description: "PSP y routing", permission: "admin:payments:view" as const },
];

const configurationNavItems = [
  { href: "/admin/configuracion/contexto", label: "Contexto", description: "Organization y Shop", permission: "admin:configuration:view" as const },
  { href: "/admin/configuracion/equipo", label: "Equipo", description: "Empleados y permisos", permission: "admin:employees:view" as const },
];

type AdminShellProps = {
  children: React.ReactNode;
  context: AdminContext;
  directory: OrganizationShopDirectory;
  session: AdminSession;
};

export function AdminShell({ children, context, directory, session }: AdminShellProps) {
  const allowedNavItems = filterAllowedNavigation(session, navItems);
  const allowedConfigurationNavItems = filterAllowedNavigation(session, configurationNavItems);

  return (
    <div className="adminShell">
      <aside className="adminSidebar" aria-label="Navegacion Admin">
        <div className="adminBrand">
          <span className="adminBrandMark">E</span>
          <div>
            <strong>Ecommium</strong>
            <span>Admin backoffice</span>
          </div>
        </div>

        <nav className="adminNav">
          {allowedNavItems.map((item) =>
            item.href === "/admin/configuracion" ? (
              <div className="adminNavGroup" key={item.href}>
                <Link className="adminNavParent" href={item.href}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="adminNavChevron" aria-hidden="true">v</span>
                </Link>
                {allowedConfigurationNavItems.length > 0 ? (
                  <div className="adminNavSubmenu">
                    {allowedConfigurationNavItems.map((child) => (
                      <Link href={child.href} key={child.href}>
                        <strong>{child.label}</strong>
                        <small>{child.description}</small>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <Link href={item.href} key={item.href}>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </Link>
            ),
          )}
        </nav>

        <div className="adminSidebarMeta">
          <strong>Perfil</strong>
          <p>{session.profile}</p>
          <strong>Contexto</strong>
          <p>{context.organizationId || "organization pendiente"} / {context.shopId || "shop pendiente"}</p>
        </div>
      </aside>

      <section className="adminMain">
        <header className="adminTopbar">
          <input className="adminSearch" type="search" placeholder="Buscar en el backoffice" />
          <AdminContextSelector
            context={context}
            directory={directory}
            updateAction={updateAdminContext}
          />
          <div className="adminUserMenu">
            <span className="adminAvatar" aria-hidden="true">
              {session.name.slice(0, 1)}
            </span>
            <div>
              <strong>{session.name}</strong>
              <div className="adminContextHint">{session.email}</div>
            </div>
            <form action={logoutAdminEmployee}>
              <button className="adminButton" type="submit">
                Salir
              </button>
            </form>
          </div>
        </header>

        {children}
      </section>
    </div>
  );
}
