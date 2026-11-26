"use client";
import {PricingReviewedRemoval} from "./pricing-reviewed-removal";

import {useEffect, useId, useRef, useState} from "react";
import {createPortal, useFormStatus} from "react-dom";
import {Ban, Check, Trash2} from "lucide-react";
import {updatePriceTableActivationAction} from "./pricing-admin-actions";
import styles from "./pricing-tax-actions.module.css";

function Buttons({active, removing, close}: {active:boolean;removing:boolean;close:()=>void}) {
  const {pending}=useFormStatus();
  return <div className={styles.actions} aria-busy={pending}>
    <button className="adminButton" type="button" disabled={pending} onClick={close}>Cancelar</button>
    <button className={`adminButton ${removing ? "adminButtonDanger" : "adminButtonPrimary"}`} type="submit" disabled={pending}>{pending ? "Aplicando…" : removing ? "Eliminar tabla" : active ? "Desactivar tabla" : "Activar tabla"}</button>
  </div>;
}
export function PricingPriceTableActions({id,name,active}: {id:string;name:string;active:boolean}) {
  const [operation,setOperation]=useState<"activation"|"remove"|null>(null);
  const open=operation!==null, removing=operation==="remove";
  const removeTrigger=useRef<HTMLButtonElement>(null);
  const trigger=useRef<HTMLButtonElement>(null), dialog=useRef<HTMLDialogElement>(null);
  const title=useId(),description=useId();
  useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
  function close(){dialog.current?.close();setOperation(null);(removing ? removeTrigger : trigger).current?.focus();}
  return <>
    <button ref={trigger} className={`adminButton ${active ? "employeesActionWarning" : "employeesActionPositive"}`} type="button" disabled={!id} onClick={()=>setOperation("activation")} aria-label={`${active ? "Desactivar" : "Activar"} ${name}`}>
      {active ? <Ban aria-hidden="true" size={16}/> : <Check aria-hidden="true" size={16}/>} {active ? "Desactivar" : "Activar"}
    </button>
    <button ref={removeTrigger} className="adminButton adminButtonDanger" type="button" disabled={!id} onClick={()=>setOperation("remove")} aria-label={`Eliminar ${name}`}>
      <Trash2 aria-hidden="true" size={16}/> Eliminar
    </button>
    {open ? createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={title} aria-describedby={description} onCancel={event=>{event.preventDefault();if(!dialog.current?.querySelector('[aria-busy="true"]'))close();}}>
      <h2 id={title}>{removing ? "Eliminar Price table" : active ? "Desactivar Price table" : "Activar Price table"}</h2>
      <div id={description}>
        <p>Tabla: <strong>{name}</strong> ({id}).</p>
        <p>{removing ? "Con una tabla sustituta, sus precios y reglas se trasladarán conservando importes, impuestos, estado y condiciones. Sin sustituta, se desactivarán únicamente si existe cobertura de precios verificada. También se comprueba que las consultas que conserven el código anterior dispongan de un precio válido." : active ? "Todos los precios y reglas asociados a esta tabla en la tienda dejarán de aplicarse. La tabla y sus asignaciones se conservarán." : "Se activarán todos los precios y reglas asociados a esta tabla en la tienda, incluidos los que estaban inactivos. Revisa el impacto antes de confirmar."}</p>
        {removing ? <p>Esta acción es definitiva. No se podrá recrear esta tabla ni reasignar su código. Los pedidos y facturas existentes no cambian.</p> : null}
      </div>
{removing ? <PricingReviewedRemoval kind="price-tables" code={id} close={close}/> : (      <form action={updatePriceTableActivationAction}>
        <input type="hidden" name="priceTableId" value={id}/>
        <input type="hidden" name="active" value={String(!active)}/>
        <input type="hidden" name="confirmActivation" value="yes"/>
        {removing ? <><input type="hidden" name="confirmDelete" value="DELETE"/><input type="hidden" name="deactivatePrices" value="true"/></> : null}
        <Buttons active={active} removing={removing} close={close}/>
      </form>)}
    </dialog>,document.body) : null}
  </>;
}
