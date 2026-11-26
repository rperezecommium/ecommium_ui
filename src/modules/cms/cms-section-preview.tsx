"use client";
import {cmsDesignPresentation,emptyCmsDesign} from '../../../packages/cms-blocks/src/design-settings';
import {renderCmsShellModulePreview} from "./cms-shell-module-preview";
import { useEffect, useMemo, useRef, useState } from "react";
import { CmsSectionView, CmsPresentationView } from "../../../packages/cms-blocks/src/react";
import type { CmsSectionDocument } from "./cms-independent-section-types";
import type { CmsVisualBreakpoint } from "./cms-blocks";
import { sectionAreaReferences } from "./cms-section-area-reference";
import styles from "./cms-section-preview.module.css";

export function CmsSectionPreview({document:doc,viewport,selected,disabled,onSelect,inheritedDesign}:{
  inheritedDesign?:import('../../../packages/cms-blocks/src/design-settings').CmsResolvedDesign;
  document:CmsSectionDocument;viewport:CmsVisualBreakpoint;selected:string;disabled:boolean;onSelect:(id:string)=>void;
}) {
  const [picking,setPicking]=useState(false),[limits,setLimits]=useState(false),[hovered,setHovered]=useState<string|null>(null);
  const host=useRef<HTMLDivElement>(null);
  const areas=useMemo(()=>sectionAreaReferences(doc.root),[doc.root]);
  const byId=useMemo(()=>new Map(areas.map(area=>[area.nodeId,area])),[areas]);
  useEffect(()=>{
    const nodes=host.current?.querySelectorAll<HTMLElement>('[data-cms-space-owner][data-cms-node-id]');
    nodes?.forEach(node=>{
      const id=node.dataset.cmsNodeId!;
      if(!byId.has(id))return;
      node.toggleAttribute('data-preview-selected',id===selected);
      node.toggleAttribute('data-preview-boundary',limits);
      node.toggleAttribute('data-preview-pickable',picking && !disabled);
      node.toggleAttribute('data-preview-hover',picking && !disabled && id===hovered);
    });
    return ()=>nodes?.forEach(node=>{node.removeAttribute('data-preview-selected');node.removeAttribute('data-preview-boundary');node.removeAttribute('data-preview-hover');node.removeAttribute('data-preview-pickable');});
  },[byId,selected,limits,picking,disabled,hovered,viewport]);
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setPicking(false);setHovered(null);}};
    window.addEventListener('keydown',escape);return ()=>window.removeEventListener('keydown',escape);
  },[]);
  function areaAt(target:EventTarget|null) {
    let element=target instanceof Element?target:null;
    while(element && element!==host.current){
      if(element.hasAttribute('data-cms-space-owner')){
        const id=element.getAttribute('data-cms-node-id');
        if(id && byId.has(id))return id;
      }
      element=element.parentElement;
    }
    return null;
  }
  const active=byId.get(selected),hover=hovered?byId.get(hovered):null;
  return <>
    <div className={styles.toolbar}>
      <button type="button" className={`adminButton ${picking?'adminButtonPrimary':''}`} aria-pressed={picking} disabled={disabled} onClick={()=>{setPicking(!picking);setHovered(null);}}>Seleccionar área</button>
      <label className="adminCheckbox"><input type="checkbox" checked={limits} onChange={event=>setLimits(event.target.checked)} />Mostrar límites</label>
    </div>
    <p className={styles.reference} role="status">{picking ? `Selecciona un área en la vista previa${hover?`: ${hover.label}`:''}. Escape cancela.` : active?`Área seleccionada: ${active.label}`:'Selecciona un área en el árbol.'}</p>
    <div ref={host} className={styles.canvas} data-admin-section-preview data-picking={picking && !disabled}
      onPointerMove={event=>{if(picking && !disabled)setHovered(areaAt(event.target));}}
      onPointerLeave={()=>setHovered(null)}
      onClickCapture={event=>{
        // Preview never follows links or invokes actions inside a module.
        event.preventDefault();event.stopPropagation();
        if(!picking || disabled)return;
        const id=areaAt(event.target);
        if(id){onSelect(id);setPicking(false);setHovered(null);}
      }} onSubmitCapture={event=>{event.preventDefault();event.stopPropagation();}}
      style={{width:'100%',maxWidth:viewport==='mobile'?390:viewport==='tablet'?768:undefined}}>
      <CmsPresentationView presentation={{styles:cmsDesignPresentation(inheritedDesign??emptyCmsDesign)}} visualViewport={viewport}><CmsSectionView document={doc} inheritedDesign={inheritedDesign} visualViewport={viewport} renderRegistered={renderCmsShellModulePreview} /></CmsPresentationView>
    </div>
  </>;
}
