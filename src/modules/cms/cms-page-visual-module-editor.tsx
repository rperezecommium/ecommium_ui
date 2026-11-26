"use client";
import dynamic from 'next/dynamic';
import {useEffect,useRef,useState} from 'react';
import {migrateCmsVisualModuleV1ToV2ForRenderer} from './cms-blocks';
import {CmsBlockStyleSheetEditor} from './cms-block-style-sheet-editor';
import {assertPageBudget,type CmsPageComposition} from './cms-page-composition';
import type {CmsIndependentModule} from './cms-independent-module-types';
import type {CmsSpaceNode} from './cms-independent-section-types';
const VisualEditor=dynamic(()=>import('./cms-visual-editing-panel').then(module=>module.CmsVisualEditingPanel),{loading:()=> <p role="status">Cargando inspector del módulo…</p>});
export function CmsPageVisualModuleEditor({document,disabled,onChange,onPendingChange,onStartEditing}:{document:CmsPageComposition;disabled:boolean;onChange:(document:CmsPageComposition)=>void;onPendingChange:(pending:boolean)=>void;onStartEditing:()=>boolean}){
 const [selected,setSelected]=useState(''),[draft,setDraft]=useState<CmsIndependentModule|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const host=useRef<HTMLElement>(null),modules:CmsIndependentModule[]=[];
 const collect=(node:CmsSpaceNode)=>{if(node.kind==='module'){if(node.module.body.kind==='visual')modules.push(node.module);}else node.children.forEach(collect);};
 document.sections.forEach(section=>collect(section.root));
 useEffect(()=>{onPendingChange(!!draft||busy);},[draft,busy,onPendingChange]);
 if(!modules.length)return null;
 return <section ref={host} aria-label="Diseño de las copias visuales de la página">
  <h3>Diseño de las copias visuales</h3><p>Usa el inspector de Módulos para modificar esta copia de la página. Los módulos de biblioteca y otras páginas conservan su contenido y diseño.</p>
  <label className="adminField">Módulo visual<select aria-label="Módulo visual de la página" disabled={disabled||!!draft||busy} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Selecciona una copia</option>{modules.map(module=><option key={module.instanceId} value={module.instanceId}>{module.name}</option>)}</select></label>
  {!draft?<button className="adminButton" type="button" disabled={disabled||!selected} onClick={()=>{const piece=modules.find(item=>item.instanceId===selected);if(piece&&onStartEditing()){setDraft(structuredClone(piece));setMessage('');}}}>Editar diseño de esta copia</button>:<fieldset disabled={disabled||busy}>
   {draft.body.kind==='visual'?<VisualEditor key={draft.instanceId} block={{blockId:draft.instanceId,type:'visual.module',props:draft.body.value}} onBusyChange={setBusy} onChange={block=>setDraft({...draft,body:{kind:'visual',value:migrateCmsVisualModuleV1ToV2ForRenderer(block.props)}})}/>:null}
   <CmsBlockStyleSheetEditor value={draft.styleSheet} resource="bloque" onChange={styleSheet=>setDraft({...draft,styleSheet})}/>
   <div className="adminButtonRow"><button className="adminButton adminButtonPrimary" type="button" onClick={()=>{
    if(host.current?.querySelector('[aria-invalid="true"],[data-cms-editor-error="true"]')){setMessage('Corrige el CSS o JSON antes de aplicar el diseño.');return;}
    const next=structuredClone(document),replace=(node:CmsSpaceNode)=>{if(node.kind==='module'){if(node.module.instanceId===draft.instanceId)node.module=draft;}else node.children.forEach(replace);};
    next.sections.forEach(section=>replace(section.root));
    try{assertPageBudget(next);onChange(next);setDraft(null);setMessage('Diseño aplicado a esta copia. Guarda la página para conservarlo.');}catch(error){setMessage((error as Error).message);}
   }}>Aplicar diseño a la página</button><button className="adminButton" type="button" onClick={()=>{setDraft(null);setMessage('Edición de diseño cancelada.');}}>Cancelar diseño de la copia</button></div>
  </fieldset>}{message?<p role="status">{message}</p>:null}
 </section>;
}
