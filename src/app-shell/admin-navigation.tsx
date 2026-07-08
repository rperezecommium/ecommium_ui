"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CreditCard,
  FileText,
  Home,
  LifeBuoy,
  Megaphone,
  Settings,
  ShoppingBasket,
  UsersRound,
} from "lucide-react";

export type AdminNavigationItem = {
  href: string;
  label: string;
  description: string;
};

type AdminNavigationProps = {
  items: AdminNavigationItem[];
  configurationItems: AdminNavigationItem[];
  catalogItems: AdminNavigationItem[];
};

const iconsByHref = {
  "/admin": Home,
  "/admin/configuracion": Settings,
  "/admin/catalogo": ShoppingBasket,
  "/admin/cms": FileText,
  "/admin/promociones": Megaphone,
  "/admin/pedidos": Boxes,
  "/admin/postventa": LifeBuoy,
  "/admin/clientes": UsersRound,
  "/admin/pagos": CreditCard,
} as const;

function isRouteActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ item }: { item: AdminNavigationItem }) {
  const pathname = usePathname();
  const active = isRouteActive(pathname, item.href);
  const Icon = iconsByHref[item.href as keyof typeof iconsByHref];

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={active ? "adminNavActive" : undefined}
      href={item.href}
    >
      {Icon ? <Icon className="adminNavIcon" aria-hidden="true" size={18} /> : null}
      <span className="adminNavLabel">
        <strong>{item.label}</strong>
      </span>
    </Link>
  );
}

function NavigationGroup({
  childItems,
  item,
}: {
  childItems: AdminNavigationItem[];
  item: AdminNavigationItem;
}) {
  const pathname = usePathname();
  const active = isRouteActive(pathname, item.href) || childItems.some((child) => isRouteActive(pathname, child.href));
  const Icon = iconsByHref[item.href as keyof typeof iconsByHref];

  return (
    <details className={`adminNavGroup ${active ? "adminNavGroupActive" : ""}`} open={active && pathname !== "/admin"}>
      <summary className={`adminNavParent ${active ? "adminNavParentActive" : ""}`}>
        {Icon ? <Icon className="adminNavIcon" aria-hidden="true" size={18} /> : null}
        <span className="adminNavLabel">
          <strong>{item.label}</strong>
        </span>
        <span className="adminNavChevron" aria-hidden="true">⌄</span>
      </summary>
      {childItems.length > 0 ? (
        <div className="adminNavSubmenu">
          <NavigationSubLink exact item={{ ...item, label: "Resumen" }} />
          {childItems.map((child) => (
            <NavigationSubLink item={child} key={child.href} />
          ))}
        </div>
      ) : null}
    </details>
  );
}

function NavigationSubLink({ exact = false, item }: { exact?: boolean; item: AdminNavigationItem }) {
  const pathname = usePathname();
  const active = exact ? pathname === item.href : isRouteActive(pathname, item.href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={active ? "adminNavActive" : undefined}
      href={item.href}
    >
      <span className="adminNavLabel">{item.label}</span>
    </Link>
  );
}

export function AdminNavigation({ catalogItems, configurationItems, items }: AdminNavigationProps) {
  return (
    <nav className="adminNav">
      <div className="adminNavSectionLabel">Vender</div>
      {items.map((item) => {
        if (item.href === "/admin/configuracion") {
          return <NavigationGroup childItems={configurationItems} item={item} key={item.href} />;
        }
        if (item.href === "/admin/catalogo") {
          return <NavigationGroup childItems={catalogItems} item={item} key={item.href} />;
        }

        return <NavigationLink item={item} key={item.href} />;
      })}
    </nav>
  );
}
