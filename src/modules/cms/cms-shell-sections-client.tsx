"use client";
import {CmsDesignSettingsEditor,useCmsDesignDefaults} from './cms-design-settings-editor';
import {resolveCmsDesignSettings} from '../../../packages/cms-blocks/src/design-settings';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CmsSectionBuilderClient} from './cms-section-builder-client';
import {saveCmsShellSectionsAction,publishCmsShellSectionsAction} from './cms-shell-composition-actions';
import {shellSection,insertShellLibrarySection} from './cms-shell-composition';
import {loadPageSectionsAction} from './cms-page-composition-actions';
import type {CmsSitePart} from './cms-admin';
import type {CmsModuleList} from './cms-independent-module-types';
import type {CmsSectionContext,CmsSectionDocument,CmsSectionList} from './cms-independent-section-types';
import {CmsSitePartPreview} from './cms-site-part-preview';
import type {StorefrontSitePart} from '../storefront/storefront-cms-shell';

export function CmsShellSectionsClient({item,context,modules,initialSections,canWrite,canPublish=false}:{item:CmsSitePart;context:CmsSectionContext & {country?:string;currency?:string};modules:CmsModuleList;initialSections:CmsSectionList;canWrite:boolean;canPublish?:boolean}) {
 const designDefaults=useCmsDesignDefaults(context);
 const router=useRouter(),revision=item.latestRevision!;
 const [blocks,setBlocks]=useState(revision.blocks),[index,setIndex]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [designSettings,setDesignSettings]=useState(revision.layout.designSettings??{});
 const changed=JSON.stringify(blocks)!==JSON.stringify(revision.blocks)||JSON.stringify(designSettings)!==JSON.stringify(revision.layout.designSettings??{});
 const [ready,setReady]=useState(true),[preview,setPreview]=useState(false),[pending,setPending]=useState(false);
 const [sections,setSections]=useState(initialSections),[libraryId,setLibraryId]=useState(''),[libraryBusy,setLibraryBusy]=useState(false),[removeId,setRemoveId]=useState<string|null>(null);
 const [editorEpoch,setEditorEpoch]=useState(0);
 const region=item.kind==='HEADER'?'header':'footer',areas=revision.layout.regions?.[region]?.areas??[];
 const [areaId,setAreaId]=useState(areas[0]?.areaId??'');
 const host=useRef<HTMLElement>(null);
 const selected=blocks[index];
 const update=useCallback((document:CmsSectionDocument)=>setBlocks(current=>current.map((block,i)=>i===index?{...block,props:{...block.props,document}}:block)),[index]);
 const valid=()=>{if(host.current?.querySelector('[aria-invalid="true"],[data-cms-editor-error="true"]')){setMessage('Corrige el CSS o JSON pendiente antes de cambiar la composición.');return false;}return true;};
 async function libraryPage(offset:number){setLibraryBusy(true);try{const result=await loadPageSectionsAction(context,offset);if(result.ok){setSections(result.data);setLibraryId('');}else setMessage(result.message);}catch{setMessage('No se pudieron cargar las secciones. Puedes reintentar.');}finally{setLibraryBusy(false);}}
 function move(direction:-1|1){if(!selected||!valid())return;const target=index+direction;if(target<0||target>=blocks.length)return;const next=[...blocks];[next[index],next[target]]=[next[target],next[index]];setBlocks(next.map((block,i)=>({...block,placement:block.placement?{...block.placement,order:i+1}:block.placement})));setIndex(target);}
 useEffect(()=>{
  if(!changed&&!pending)return;
  const unload=(event:BeforeUnloadEvent)=>event.preventDefault();
  const click=(event:MouseEvent)=>{
   const target=event.target as Element;
   if(target.closest?.('a[href]')&&!target.closest?.('[data-admin-section-preview]')&&(!ready||busy||!window.confirm('Hay cambios sin guardar. ¿Quieres salir?'))){event.preventDefault();event.stopPropagation();}
  };
  window.addEventListener('beforeunload',unload);window.document.addEventListener('click',click,true);
  return()=>{window.removeEventListener('beforeunload',unload);window.document.removeEventListener('click',click,true);};
 },[changed,pending,ready,busy]);
 return <section ref={host} aria-label="Composición con secciones">
  <p>Esta pieza usa secciones y módulos independientes. Guardar conserva el borrador sin publicarlo. {item.usageCount?`Publicar actualizará sus ${item.usageCount} asignaciones.`:'No tiene asignaciones: publicarla no la asigna a ninguna página.'}</p>
  {designDefaults.message?<p role="status">{designDefaults.message}</p>:null}
  <CmsDesignSettingsEditor value={designSettings} inherited={designDefaults.values} onChange={setDesignSettings} disabled={!canWrite||busy}/>
  <fieldset disabled={!canWrite||busy||!ready||libraryBusy}><legend>Secciones de biblioteca</legend>
    <label className="adminField">Sección de biblioteca<select aria-label="Sección de biblioteca" value={libraryId} onChange={event=>setLibraryId(event.target.value)}><option value="">Selecciona una sección</option>{sections.items.map(section=><option key={section.resourceId} value={section.resourceId}>{section.document.name}</option>)}</select></label>
    <label className="adminField">Área de la pieza<select aria-label="Área de la pieza" value={areaId} onChange={event=>setAreaId(event.target.value)}>{areas.map(area=><option key={area.areaId} value={area.areaId}>{area.name??area.areaId}</option>)}</select></label>
    <div className="adminButtonRow"><button className="adminButton adminButtonPrimary" type="button" disabled={!libraryId||!areaId||blocks.length>=24} onClick={()=>{if(!valid())return;const source=sections.items.find(section=>section.resourceId===libraryId);if(!source)return;try{const block=insertShellLibrarySection(source.document,item.kind,areaId,blocks.length+1);setBlocks([...blocks,block]);setIndex(blocks.length);setMessage('Copia de sección insertada. Guarda la pieza para conservarla.');}catch(error){setMessage((error as Error).message);}}}>Insertar copia de sección</button>
    <button className="adminButton" type="button" disabled={!sections.offset} onClick={()=>void libraryPage(Math.max(0,sections.offset-sections.limit))}>Secciones anteriores</button><button className="adminButton" type="button" disabled={sections.offset+sections.limit>=sections.total} onClick={()=>void libraryPage(sections.offset+sections.limit)}>Más secciones</button></div>
  </fieldset>
  {!blocks.length?<p>Selecciona una sección de biblioteca para comenzar. Su contenido se insertará como una copia independiente.</p>:null}
  <label className="adminField"><span>Sección de la pieza</span><select aria-label="Sección de la pieza" value={index} disabled={busy||!ready} onChange={event=>{if(host.current?.querySelector('[aria-invalid="true"],[data-cms-editor-error="true"]')){setMessage("Corrige el CSS o JSON pendiente antes de cambiar de sección.");return;}setIndex(Number(event.target.value));}}>{blocks.map((block,i)=><option key={block.blockId} value={i}>{shellSection(block).name}</option>)}</select></label>
  {selected?<div className="adminButtonRow"><button className="adminButton" type="button" disabled={!canWrite||busy||!ready||!index||blocks[index-1]?.placement?.areaId!==selected.placement?.areaId||blocks[index-1]?.placement?.columnIndex!==selected.placement?.columnIndex} onClick={()=>move(-1)}>Subir sección</button><button className="adminButton" type="button" disabled={!canWrite||busy||!ready||index===blocks.length-1||blocks[index+1]?.placement?.areaId!==selected.placement?.areaId||blocks[index+1]?.placement?.columnIndex!==selected.placement?.columnIndex} onClick={()=>move(1)}>Bajar sección</button><button className="adminButton adminButtonDanger" type="button" disabled={!canWrite||busy||!ready} onClick={()=>{if(valid())setRemoveId(selected.blockId);}}>Retirar copia de sección</button></div>:null}
  {removeId?<div role="alert"><p>Se retirará esta copia del borrador. La sección de biblioteca y la publicación actual se conservan hasta guardar y publicar.</p><button className="adminButton" type="button" disabled={busy||!ready} onClick={()=>setRemoveId(null)}>Cancelar retirada</button><button className="adminButton adminButtonDanger" type="button" disabled={busy||!ready} onClick={()=>{if(!valid())return;setBlocks(blocks.filter(block=>block.blockId!==removeId));setIndex(0);setRemoveId(null);}}>Confirmar retirada de la copia</button></div>:null}
  {selected?<CmsSectionBuilderClient key={`${selected.blockId}:${editorEpoch}`} inheritedDesign={resolveCmsDesignSettings(designDefaults.values,designSettings)} initialDocument={shellSection(selected)} initialReceipt={null} initialList={{items:[],total:0,limit:50,offset:0}} initialModules={modules} context={context} canWrite={canWrite} embedded={{onChange:update,onReadyChange:setReady,onPendingChange:setPending,disabled:busy}}/>:null}
  {canWrite&&(changed||pending)?<button className="adminButton" type="button" disabled={busy||!ready} onClick={()=>{setBlocks(structuredClone(revision.blocks));setDesignSettings(revision.layout.designSettings??{});setIndex(0);setPending(false);setRemoveId(null);setEditorEpoch(value=>value+1);setMessage('Cambios sin guardar descartados. El borrador guardado se conserva.');}}>Descartar cambios sin guardar</button>:null}
  <div className="adminButtonRow"><button className="adminButton" type="button" disabled={!ready||busy} onClick={()=>{
    if(host.current?.querySelector('[aria-invalid="true"],[data-cms-editor-error="true"]')){setMessage('Corrige los campos, JSON o CSS antes de previsualizar.');return;}
    setPreview(true);
  }}>Preview de la pieza</button><button className="adminButton adminButtonPrimary" type="button" disabled={!canWrite||busy||(!changed&&!pending)||!ready} onClick={async()=>{
   if(host.current?.querySelector('[aria-invalid="true"],[data-cms-editor-error="true"]') || Array.from(host.current?.querySelectorAll('form')??[]).some(form=>!form.reportValidity())) {setMessage('Corrige los campos, JSON o CSS antes de guardar.');return;}
   setBusy(true);setMessage('');
   try {const result=await saveCmsShellSectionsAction(item.sitePartId,blocks,{revisionId:revision.revisionId,updatedAt:revision.updatedAt},context,designSettings);
    if(result.ok){setMessage('Borrador guardado.');router.refresh();}else setMessage(result.message);
   }catch{setMessage('No se pudo confirmar el guardado. Conserva tu edición.');}finally{setBusy(false);}
  }}>{busy?'Guardando…':'Guardar borrador'}</button>{canWrite&&canPublish?<button type="button" className="adminButton adminButtonPrimary" disabled={busy||!ready} onClick={async()=>{
   if(host.current?.querySelector('[aria-invalid="true"],[data-cms-editor-error="true"]')){setMessage('Corrige los campos pendientes antes de publicar.');return;}
   setBusy(true);setMessage('');
   try{const result=await publishCmsShellSectionsAction(item.sitePartId,blocks,{revisionId:revision.revisionId,updatedAt:revision.updatedAt},context,designSettings);if(result.ok){setMessage('Revisión publicada.');router.refresh();}else setMessage(result.message);}catch{setMessage('No se pudo confirmar la publicación. Conserva tu edición y revisa el historial.');}finally{setBusy(false);}
  }}>Guardar y publicar</button>:null}</div>
  {message?<p role="status">{message}</p>:null}
  {preview?<CmsSitePartPreview part={{...item,designDefaults:designDefaults.values,revision:{...revision,layout:{...revision.layout,designSettings},blocks}} as unknown as StorefrontSitePart} locale={context.locale} country={context.country} currency={context.currency} onClose={()=>setPreview(false)}/>:null}
 </section>;
}
