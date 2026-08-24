import {
  Boxes,
  ChartColumn,
  CreditCard,
  FileText,
  Home,
  LifeBuoy,
  Megaphone,
  Settings,
  ShoppingBasket,
  UsersRound,
} from "lucide-react";
import type { AdminSession } from "../shared/auth/session";
import type { AdminContext } from "../shared/config/admin-context";
import type { OrganizationShopDirectory } from "../modules/configuracion/organization-shop";
import { updateAdminContext } from "../modules/configuracion/context-actions";
import { logoutAdminEmployee } from "../modules/auth/admin-session-actions";
import { filterAllowedNavigation } from "../shared/permissions/permissions";
import { AdminContextSelector } from "./admin-context-selector";
import { AdminNavigation, type AdminNavigationItem } from "./admin-navigation";
import { getAfterSalesAdminCapabilities, getAfterSalesTaskSummary } from "../modules/postventa/after-sales-admin";

const navItems = [
  { href: "/admin", label: "Inicio", description: "Health y contexto", permission: "admin:view" as const, icon: Home },
  { href: "/admin/configuracion", label: "Configuracion", description: "Tenant, tiendas y equipo", permission: "admin:configuration:view" as const, icon: Settings },
  { href: "/admin/catalogo", label: "Catalogo", description: "Productos y contenido comercial", permission: "admin:catalog:view" as const, icon: ShoppingBasket },
  { href: "/admin/cms", label: "CMS", description: "Paginas y bloques", permission: "admin:cms:view" as const, icon: FileText },
  { href: "/admin/promociones", label: "Promociones", description: "Cupones y reglas de carrito", permission: "admin:promotions:view" as const, icon: Megaphone },
  { href: "/admin/analitica", label: "Analitica", description: "Eventos y rendimiento comercial", permission: "admin:analytics:view" as const, icon: ChartColumn },
  { href: "/admin/pedidos", label: "Pedidos", description: "Operacion y fulfillment", permission: "admin:orders:view" as const, icon: Boxes },
  { href: "/admin/postventa", label: "Postventa", description: "Soporte, retornos y refunds", permission: "admin:after-sales:view" as const, icon: LifeBuoy },
  { href: "/admin/clientes", label: "Clientes", description: "Customer 360", permission: "admin:customers:view" as const, icon: UsersRound },
  { href: "/admin/pagos", label: "Pagos", description: "PSP y routing", permission: "admin:payments:view" as const, icon: CreditCard },
];

const configurationNavItems = [
  { href: "/admin/configuracion/contexto", label: "Contexto", description: "Organization y Shop", permission: "admin:configuration:view" as const },
  { href: "/admin/configuracion/equipo", label: "Equipo", description: "Empleados y permisos", permission: "admin:employees:view" as const },
  { href: "/admin/configuracion/precios", label: "Precios", description: "Impuestos, tablas y reglas", permission: "admin:catalog:view" as const },
  { href: "/admin/configuracion/transporte", label: "Transporte", description: "Carriers, zonas y SLA", permission: "admin:shipping:view" as const },
  { href: "/admin/configuracion/seo", label: "SEO", description: "Rutas, redirects y sitemap", permission: "admin:catalog:view" as const },
  { href: "/admin/configuracion/automatizacion", label: "Automatizacion", description: "Reglas, ejecuciones y reintentos", permission: "admin:automation:view" as const },
  { href: "/admin/configuracion/comunicaciones", label: "Comunicaciones", description: "Email, SMTP y plantillas", permission: "admin:communications:view" as const },
  { href: "/admin/configuracion/checkout", label: "Checkout", description: "OrderForm y reglas de compra", permission: "admin:checkout:view" as const },
  { href: "/admin/configuracion/seguridad", label: "Seguridad", description: "Sesiones y confirmación de identidad", permission: "admin:configuration:view" as const },
];

const cmsNavItems = [
  { href: "/admin/cms", label: "Paginas", description: "Paginas, bloques y publicacion", permission: "admin:cms:view" as const },
  { href: "/admin/cms/builder", label: "Builder", description: "Canvas visual de bloques", permission: "admin:cms-builder:view" as const },
  { href: "/admin/cms/ajustes-basicos", label: "Ajustes basicos", description: "Configuracion global, plantillas y layout", permission: "admin:cms-settings:view" as const },
];

const catalogNavItems = [
  { href: "/admin/products", label: "Productos", description: "Ficha, variantes y media", permission: "admin:catalog:view" as const },
  { href: "/admin/catalogo/categorias", label: "Categorias", description: "Arbol, familias y rutas", permission: "admin:catalog:view" as const },
  { href: "/admin/catalogo/atributos-caracteristicas", label: "Caracteristicas", description: "Ficha tecnica y filtros", permission: "admin:catalog:view" as const },
  { href: "/admin/catalogo/search", label: "Busqueda", description: "Relevancia, sinonimos e indexacion", permission: "admin:search:view" as const },
  { href: "/admin/catalogo/marcas", label: "Marcas / Proveedores", description: "Fabricantes y colecciones", permission: "admin:catalog:view" as const },
  { href: "/admin/catalogo/media", label: "Media / Archivos", description: "Imagenes y documentos", permission: "admin:catalog:view" as const },
  { href: "/admin/catalogo/offerings", label: "Offerings / Servicios adicionales", description: "Servicios vendibles asociados", permission: "admin:catalog:view" as const },
  { href: "/admin/catalogo/stock", label: "Stock", description: "Existencias por variante", permission: "admin:catalog:view" as const },
];

type AdminShellProps = {
  children: React.ReactNode;
  context: AdminContext;
  directory: OrganizationShopDirectory;
  session: AdminSession;
};

function toNavigationItems<T extends AdminNavigationItem>(items: T[]): AdminNavigationItem[] {
  return items.map(({ description, href, label }) => ({ description, href, label }));
}

export async function AdminShell({ children, context, directory, session }: AdminShellProps) {
  const allowedNavItems = filterAllowedNavigation(session, navItems);
  const allowedConfigurationNavItems = filterAllowedNavigation(session, configurationNavItems);
  const allowedCatalogNavItems = filterAllowedNavigation(session, catalogNavItems);
  const allowedCmsNavItems = filterAllowedNavigation(session, cmsNavItems);
  const afterSalesCapabilities = getAfterSalesAdminCapabilities(session);
  const afterSalesTaskSummary = await getAfterSalesTaskSummary(context, afterSalesCapabilities);
  const pendingAfterSalesTasks = afterSalesTaskSummary.ok
    ? afterSalesTaskSummary.data?.pendingCount
    : undefined;

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

        <AdminNavigation
          catalogItems={toNavigationItems(allowedCatalogNavItems)}
          cmsItems={toNavigationItems(allowedCmsNavItems)}
          configurationItems={toNavigationItems(allowedConfigurationNavItems)}
          items={toNavigationItems(allowedNavItems)}
          pendingAfterSalesTasks={pendingAfterSalesTasks}
        />

        <div className="adminSidebarMeta">
          <strong>Perfil</strong>
          <p>{session.profile}</p>
          <strong>Contexto</strong>
          <p>{context.organizationId || "organization pendiente"} / {context.shopId || "shop pendiente"}</p>
        </div>
      </aside>

      <section className="adminMain">
        <header className="adminTopbar">
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
