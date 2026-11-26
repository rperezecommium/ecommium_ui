"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";

export function MediaCollectionMenu({ title, reviewHref, canManage }: { title: string; reviewHref: string; canManage: boolean }) {
  const id=useId();
  const popup=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState({left:0,top:0});
  return <>
    <button className="adminButton adminButtonTiny" type="button" popoverTarget={id} aria-label={`Acciones de ${title}`} onClick={event=>{
      const rect=event.currentTarget.getBoundingClientRect();
      setPosition({left:Math.max(8,Math.min(rect.right-190,window.innerWidth-198)),top:Math.max(8,Math.min(rect.bottom+4,window.innerHeight-112))});
    }}>…</button>
    <div id={id} ref={popup} popover="auto" className="catalogEntityActionsPopover" style={position}>
      <Link className="adminButton" onClick={()=>popup.current?.hidePopover()} href={reviewHref}>Revisar</Link>
      {canManage ? <Link className="adminButton adminButtonDanger" onClick={()=>popup.current?.hidePopover()} href={`${reviewHref}#media-collection-delete`}>Desactivar colección</Link> : null}
    </div>
  </>;
}
