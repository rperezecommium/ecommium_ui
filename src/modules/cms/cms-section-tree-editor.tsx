"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import type { CmsSectionDocument, CmsSpaceNode } from "./cms-independent-section-types";
import { addSectionContainer, dropSectionSpace, moveSectionStep, removeSectionSpace, sectionDropDestination, sectionSpaceCount, sectionStepDestination, type SectionDrop, type SectionMove } from "./cms-section-tree-controls";
import styles from "./cms-section-tree-editor.module.css";

type Drop = {id:string; position:SectionDrop};
const moves = [ ["up", "Subir", ArrowUp], ["down", "Bajar", ArrowDown], ["in", "Entrar en el contenedor anterior", ArrowRight], ["out", "Sacar del contenedor", ArrowLeft] ] as const;
const name = (node: CmsSpaceNode) => node.kind === "module" ? node.module.name : `Contenedor ${node.layout}`;
export function CmsSectionTreeEditor({ document: doc, selected, disabled, onSelect, onChange, onMessage }: {
  document:CmsSectionDocument; selected:string; disabled:boolean; onSelect:(id:string)=>void;
  onChange:(doc:CmsSectionDocument)=>void; onMessage:(message:string)=>void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const gesture = useRef<{id:string;pointer:number;x:number;y:number;active:boolean;handle:HTMLButtonElement;drop:Drop|null}|null>(null);
  const [dragId, setDragId] = useState<string|null>(null);
  const [drop, setDrop] = useState<Drop|null>(null);
  function cancel() {
    const current = gesture.current;
    gesture.current = null;
    if (current?.handle.hasPointerCapture(current.pointer)) current.handle.releasePointerCapture(current.pointer);
    setDragId(null); setDrop(null);
  }
  useEffect(() => {
    const escape = (event:KeyboardEvent) => {
      if (event.key !== "Escape" || !gesture.current) return;
      event.preventDefault();
      const current = gesture.current;
      gesture.current = null;
      if (current.handle.hasPointerCapture(current.pointer)) current.handle.releasePointerCapture(current.pointer);
      setDragId(null); setDrop(null);
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      const current = gesture.current;
      if (current?.handle.hasPointerCapture(current.pointer)) current.handle.releasePointerCapture(current.pointer);
      gesture.current = null;
    };
  }, []);
  function apply(action:()=>CmsSectionDocument, message:string) {
    if (disabled) return;
    try { onChange(action()); onMessage(message); }
    catch (error) { onMessage(error instanceof Error ? error.message : "No se pudo mover la pieza."); }
  }
  function pointerMove(event:PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointer) return;
    if (!current.active && Math.hypot(event.clientX-current.x, event.clientY-current.y) < 6) return;
    current.active = true;
    setDragId(current.id);
    const row = window.document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-section-node]");
    let next:Drop|null = null;
    if (row && host.current?.contains(row)) {
      const bounds = row.getBoundingClientRect(), fraction = (event.clientY-bounds.top)/bounds.height;
      const position:SectionDrop = row.dataset.sectionRoot === "true" ? "inside" : row.dataset.sectionKind === "container" && fraction >= .25 && fraction <= .75 ? "inside" : fraction < .5 ? "before" : "after";
      const id = row.dataset.sectionNode!;
      if (sectionDropDestination(doc.root,current.id,id,position)) next = {id,position};
    }
    current.drop = next;
    setDrop(previous => previous?.id === next?.id && previous?.position === next?.position ? previous : next);
    if (event.clientY < 70) window.scrollBy(0,-18);
    else if (event.clientY > window.innerHeight-70) window.scrollBy(0,18);
  }
  function step(node:CmsSpaceNode, direction:SectionMove) {
    apply(()=>moveSectionStep(doc,node.nodeId,direction),`${name(node)} movido. Cambios pendientes de guardar.`);
  }
  function remove(node:CmsSpaceNode) {
    if (disabled) return;
    const count = sectionSpaceCount(node)-1;
    if (!window.confirm(`¿Eliminar «${name(node)}» de esta sección?${node.kind === "container" ? ` También se retirarán sus ${count} ${count === 1 ? "elemento interior" : "elementos interiores"}.` : ""} El módulo de biblioteca se conserva. El cambio se hará efectivo al guardar la sección.`)) return;
    apply(()=>removeSectionSpace(doc,node.nodeId),"Pieza retirada del borrador. Cambios pendientes de guardar.");
    onSelect(doc.root.nodeId);
  }
  function render(node:CmsSpaceNode,depth=0):React.ReactNode {
    const root = node.nodeId === doc.root.nodeId;
    const label = root ? "Contenedor principal" : name(node);
    return <li key={node.nodeId}>
      <div className={styles.row} data-section-node={node.nodeId} data-section-kind={node.kind} data-section-root={root} data-dragging={dragId===node.nodeId || undefined} data-drop={drop?.id===node.nodeId ? drop.position : undefined}>
        {!root ? <button className={styles.grip} type="button" aria-label={`Arrastrar ${name(node)}`} title="Arrastra para mover; usa las flechas para mover con teclado" disabled={disabled}
          onPointerDown={event=>{
            if (disabled || event.button!==0) return;
            event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
            gesture.current={id:node.nodeId,pointer:event.pointerId,x:event.clientX,y:event.clientY,active:false,handle:event.currentTarget,drop:null};
          }} onPointerMove={pointerMove} onPointerCancel={cancel} onLostPointerCapture={cancel}
          onPointerUp={event=>{
            const current=gesture.current;
            if (!current || current.pointer!==event.pointerId) return;
            const target=current.drop;
            cancel();
            if(current.active && target) apply(()=>dropSectionSpace(doc,current.id,target.id,target.position),`${name(node)} movido. Cambios pendientes de guardar.`);
          }}><GripVertical size={16} aria-hidden="true" /></button> : null}
        <button className={`adminButton ${styles.label}`} type="button" aria-pressed={selected===node.nodeId} onClick={()=>onSelect(node.nodeId)}>{label} · {depth+1}</button>
        {node.kind === "container" ? <button type="button" className={`${styles.control} ${styles.add}`} aria-label={`Añadir contenedor dentro de ${label}`} title={`Añadir contenedor dentro de ${label}`} disabled={disabled} onClick={()=>apply(()=>{
          const result=addSectionContainer(doc,node.nodeId);
          onSelect(result.nodeId);
          return result.document;
        },`Contenedor añadido dentro de ${label}. Cambios pendientes de guardar.`)}><Plus size={16} aria-hidden="true" /></button> : null}
        {!root ? <div className={styles.actions} role="group" aria-label={`Acciones ${name(node)}`}>
          {moves.map(([direction,label,Icon])=><button type="button" className={styles.control} key={direction} title={label} aria-label={`${label}: ${name(node)}`} disabled={disabled || !sectionStepDestination(doc.root,node.nodeId,direction)} onClick={()=>step(node,direction)}><Icon size={16} aria-hidden="true" /></button>)}
          <button type="button" className={`${styles.control} ${styles.danger}`} title="Eliminar de la sección" aria-label={`Eliminar ${name(node)}`} disabled={disabled} onClick={()=>remove(node)}><Trash2 size={16} aria-hidden="true" /></button>
        </div> : null}
      </div>
      {node.kind==="container" && node.children.length ? <ul>{node.children.map(child=>render(child,depth+1))}</ul> : null}
    </li>;
  }
  return <div ref={host} className={styles.tree} data-active-drag={!!dragId}>
    <p className={styles.help}>Flechas: reordenar, entrar en el contenedor anterior o salir. Arrastra por el tirador: borde superior/inferior para ordenar; centro de un contenedor para insertar. Escape cancela.</p>
    <p role="status" className={`${styles.help} ${styles.status}`}>{drop ? `${drop.position==="inside"?"Dentro del contenedor":drop.position==="before"?"Antes de la pieza":"Después de la pieza"}. Suelta para mover.` : dragId ? "Busca un destino válido." : disabled ? "Aplica o cancela la edición actual para organizar las piezas." : ""}</p>
    <ul>{render(doc.root)}</ul>
  </div>;
}
