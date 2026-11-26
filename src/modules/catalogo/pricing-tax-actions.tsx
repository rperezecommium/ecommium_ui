"use client";
import {PricingReviewedRemoval} from "./pricing-reviewed-removal";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { Ban, Trash2 } from "lucide-react";
import { deleteTaxDefinitionAction } from "./pricing-admin-actions";
import styles from "./pricing-tax-actions.module.css";

function ConfirmationButtons({ removing, close }: { removing: boolean; close: () => void }) {
  const { pending } = useFormStatus();
  return <div className={styles.actions} aria-busy={pending}>
    <button className="adminButton" type="button" onClick={close} disabled={pending}>Cancelar</button>
    <button className={`adminButton ${removing ? "adminButtonDanger" : "employeesActionWarning"}`} type="submit" disabled={pending}>
      {pending ? "Aplicando…" : removing ? "Eliminar impuesto" : "Desactivar impuesto"}
    </button>
  </div>;
}

export function PricingTaxActions({ taxCode, name, active }: { taxCode: string; name: string; active: boolean }) {
  const [operation, setOperation] = useState<"deactivate" | "remove" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const deactivate = useRef<HTMLButtonElement>(null), remove = useRef<HTMLButtonElement>(null);
  const title = useId(), description = useId();
  const removing = operation === "remove";
  useEffect(() => { if (operation) dialog.current?.showModal(); }, [operation]);
  function close() {
    dialog.current?.close();
    setOperation(null);
    (removing ? remove : deactivate).current?.focus();
  }
  return <div className="productListActions">
    <button ref={deactivate} className="adminButton employeesActionWarning" type="button" disabled={!taxCode || !active} onClick={() => setOperation("deactivate")} aria-label={`Desactivar ${name}`}>
      <Ban aria-hidden="true" size={16} />Desactivar
    </button>
    <button ref={remove} className="adminButton adminButtonDanger" type="button" disabled={!taxCode} onClick={() => setOperation("remove")} aria-label={`Eliminar ${name}`}>
      <Trash2 aria-hidden="true" size={16} />Eliminar
    </button>
    {operation ? createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={title} aria-describedby={description}
      onCancel={event => { event.preventDefault(); if (!dialog.current?.querySelector('[aria-busy="true"]')) close(); }}>
      <h2 id={title}>{removing ? "Eliminar impuesto" : "Desactivar impuesto"}</h2>
      <div id={description}>
        <p>Impuesto: <strong>{name}</strong> ({taxCode}).</p>
        {removing ? <p>Antes de eliminar se revisarán las asignaciones y el impuesto sustituto. La operación se bloqueará si la fiscalidad no queda resuelta.</p> : <p>El impuesto dejará de estar disponible para nuevas asignaciones. Los precios que ya lo tienen asignado conservan su impuesto. No se eliminará el impuesto.</p>}
      </div>
{removing ? <PricingReviewedRemoval kind="taxes" code={taxCode} close={close}/> : (      <form action={deleteTaxDefinitionAction}>
        <input type="hidden" name="taxCode" value={taxCode} />
        <input type="hidden" name="confirmDelete" value="DELETE" />
        {removing ? <input type="hidden" name="detachPrices" value="true" /> : null}
        <ConfirmationButtons removing={removing} close={close} />
      </form>)}
    </dialog>, document.body) : null}
  </div>;
}
