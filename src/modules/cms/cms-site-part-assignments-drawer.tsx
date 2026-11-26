"use client";

import { useState, type ReactNode } from "react";
import { AdminResourceDrawer } from "../../shared/ui/admin-resource-drawer";

export function CmsSitePartAssignmentsDrawer({ kind, initialOpen, children }: { kind: "HEADER" | "FOOTER"; initialOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen);
  return <>
    <button type="button" className="cmsSitePartAssignmentsLink" onClick={() => setOpen(true)}>Asignaciones</button>
    {open ? <AdminResourceDrawer drawerId={`cms-${kind.toLowerCase()}-assignments`} title="Asignaciones" description="Configura la asignación por defecto, por superficie o por página." onClose={() => setOpen(false)}>{children}</AdminResourceDrawer> : null}
  </>;
}
