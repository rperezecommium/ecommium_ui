import Link from "next/link";
import type { AdminSession } from "../shared/auth/session";
import type { AdminContext } from "../shared/config/admin-context";
import type { OrganizationShopDirectory } from "../modules/configuracion/organization-shop";
import { updateAdminContext } from "../modules/configuracion/context-actions";
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

type AdminShellProps = {
  children: React.ReactNode;
  context: AdminContext;
  directory: OrganizationShopDirectory;
  session: AdminSession;
};

export function AdminShell({ children, context, directory, session }: AdminShellProps) {
  const allowedNavItems = filterAllowedNavigation(session, navItems);

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
          {allowedNavItems.map((item) => (
            <Link href={item.href} key={item.href}>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </Link>
          ))}
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
          </div>
        </header>

        {children}
      </section>
    </div>
  );
}
