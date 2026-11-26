"use client";
import dynamic from 'next/dynamic';
import {useEffect,useMemo,useState} from 'react';
import type {CmsPageComposition} from './cms-page-composition';
import type {CmsSectionContext,CmsSectionDocument} from './cms-independent-section-types';
import type {CmsResolvedDesign} from '../../../packages/cms-blocks/src/design-settings';
const SectionEditor=dynamic(()=>import('./cms-section-builder-client').then(module=>module.CmsSectionBuilderClient),{loading:()=> <p role="status">Cargando edición de sección…</p>});
const empty={items:[],total:0,limit:50,offset:0};
export function CmsPageSectionEditor({section,context,disabled,inheritedDesign,onChange,onPendingChange,open,onToggle}:{
 section:CmsPageComposition['sections'][number];context:CmsSectionContext;disabled:boolean;inheritedDesign:CmsResolvedDesign;
 open:boolean;onToggle:()=>void;
 onChange:(document:CmsSectionDocument)=>void;onPendingChange:(pending:boolean)=>void;
}){
 const [ready,setReady]=useState(true);
 const document=useMemo(()=>{const {placement,...value}=section;void placement;return value;},[section]);
 useEffect(()=>{if(open)onPendingChange(!ready);},[open,ready,onPendingChange]);
 return <section aria-label={`Editar sección ${section.name}`}>
  <button type="button" className="adminButton" disabled={disabled||!ready} onClick={onToggle}>{open?'Cerrar edición de sección':'Editar sección'}</button>
  {open?<SectionEditor initialDocument={document} initialReceipt={null} initialList={empty} initialModules={empty} inheritedDesign={inheritedDesign} context={context} canWrite={!disabled} embedded={{onChange,onReadyChange:setReady,disabled}}/>:null}
 </section>;
}
