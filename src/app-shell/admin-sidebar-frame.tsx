"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AdminDrawerResizeProvider } from "../shared/ui/admin-drawer-resize-provider";

export function AdminSidebarFrame({ sidebar, children, initiallyCollapsed = false }: { sidebar: ReactNode; children: ReactNode; initiallyCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const label = collapsed ? "Mostrar navegación" : "Ocultar navegación";

  function toggleSidebar() {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    // Visual preference only; contains no session or business data.
    document.cookie = `ecommium_admin_sidebar=${nextCollapsed ? "collapsed" : "expanded"}; Path=/admin; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
  }

  return (
    <AdminDrawerResizeProvider>
    <div className="adminShell adminCollapsibleShell" data-sidebar-collapsed={collapsed}>
      <div id="admin-sidebar-panel" className="adminSidebarPanel" inert={collapsed} aria-hidden={collapsed}>
        {sidebar}
      </div>
      <button
        className="adminSidebarToggle"
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={!collapsed}
        aria-controls="admin-sidebar-panel"
        onClick={toggleSidebar}
      >
        {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronLeft size={14} aria-hidden="true" />}
      </button>
      {children}
    </div>
    </AdminDrawerResizeProvider>
  );
}
