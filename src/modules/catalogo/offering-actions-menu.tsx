"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";

export function OfferingActionsMenu({ name, offeringId, editHref, returnPath, deactivateAction }: {
  name:string; offeringId:string; editHref:string; returnPath:string; deactivateAction:(data:FormData)=>Promise<void>;
}) {
  const id=useId(),popup=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState({left:0,top:0});
  return <>
    <button className="adminButton adminButtonTiny" type="button" popoverTarget={id} aria-label={`Acciones de ${name}`} onClick={event=>{
      const rect=event.currentTarget.getBoundingClientRect();
      setPosition({left:Math.max(8,Math.min(rect.right-190,window.innerWidth-198)),top:Math.max(8,Math.min(rect.bottom+4,window.innerHeight-112))});
    }}>…</button>
    <div id={id} ref={popup} popover="auto" className="catalogEntityActionsPopover" style={position}>
      <Link className="adminButton" onClick={()=>popup.current?.hidePopover()} href={editHref} aria-label={`Editar ${name}`}>Editar</Link>
      <form action={deactivateAction} onSubmit={event=>{
        if(!window.confirm(`Desactivar "${name}"? Dejará de estar disponible como servicio activo.`)) event.preventDefault();
        else popup.current?.hidePopover();
      }}>
        <input type="hidden" name="offeringId" value={offeringId} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <button className="adminButton adminButtonDanger" type="submit">Desactivar</button>
      </form>
    </div>
  </>;
}
