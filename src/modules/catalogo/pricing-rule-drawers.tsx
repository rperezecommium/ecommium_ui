"use client";

import { useState, type ReactNode } from "react";
import { AdminResourceDrawer } from "../../shared/ui/admin-resource-drawer";
import styles from "./pricing-reference-lists.module.css";

export function PricingRuleDrawers({ editForm, deactivateForm }: { editForm: ReactNode; deactivateForm: ReactNode }) {
  const [panel, setPanel] = useState<"edit" | "deactivate" | null>(null);
  return <>
    <div className="adminActions">
      <button type="button" className="employeesTextAction" onClick={() => setPanel("edit")}>Editar grupo</button>
      <button type="button" className="employeesTextAction" onClick={() => setPanel("deactivate")}>Desactivar grupo</button>
    </div>
    {panel ? <AdminResourceDrawer drawerId={panel === "edit" ? "pricing-rule-edit" : "pricing-rule-deactivate"}
      title={panel === "edit" ? "Editar grupo de precios" : "Desactivar grupo de precios"}
      description={panel === "edit" ? "Modifica los precios existentes de esta fila. Los cambios se aplican a todos los precios del grupo; no se crea un precio nuevo." : "Se desactivarán todos los precios de este grupo. Confirma esta acción para continuar."}
      className={styles.drawer} onClose={() => setPanel(null)}>
      {panel === "edit" ? editForm : deactivateForm}
    </AdminResourceDrawer> : null}
  </>;
}
