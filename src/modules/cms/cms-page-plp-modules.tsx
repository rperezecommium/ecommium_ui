"use client";
import {useState} from 'react';
import {loadSectionModulesAction} from './cms-independent-section-actions';
import {remapIndependentModule} from './cms-independent-module-comparison';
import {CmsModuleInstanceFields} from './cms-module-instance-fields';
import {CmsDesignSettingsEditor} from './cms-design-settings-editor';
import {CmsIndependentModuleView} from '../../../packages/cms-blocks/src/react';
import {renderCmsShellModulePreview} from './cms-shell-module-preview';
import type {CmsPageComposition} from './cms-page-composition';
import type {CmsSectionContext} from './cms-independent-section-types';
import type {CmsModuleList} from './cms-independent-module-types';
type Items=NonNullable<CmsPageComposition['plpModules']>;
export function CmsPagePlpModules({items,context,disabled,onChange,onPendingChange}:{items:Items;context:CmsSectionContext;disabled:boolean;onChange:(items:Items)=>void;onPendingChange:(value:boolean)=>void}) {
 const [library,setLibrary]=useState<CmsModuleList>({items:[],total:0,limit:50,offset:0}),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function load(offset=0) {
  setBusy(true);setMessage('');
  try {const result=await loadSectionModulesAction(context,offset);if(result.ok){setLibrary(result.data);setSelected('');}else setMessage(result.message);}catch{setMessage('No se pudieron consultar los módulos.');}finally{setBusy(false);}
 }
 const change=(next:Items)=>{onChange(next);onPendingChange(false);};
 return <section onChangeCapture={()=>onPendingChange(true)} aria-label="Contenido editorial de categorías">
  <p>Estos módulos se muestran en las categorías indicadas, antes o después del listado de productos. Son copias independientes y no forman parte del cuerpo de esta página.</p>
  <div className="adminButtonRow"><button type="button" className="adminButton" disabled={busy||disabled} onClick={()=>load()}>Consultar módulos</button>
   <label className="adminField"><span>Módulo de biblioteca</span><select value={selected} disabled={busy||disabled} onChange={event=>{setSelected(event.target.value);onPendingChange(false);}}><option value="">Selecciona un módulo</option>{library.items.filter(item=>item.document.body.kind==='visual'||['plp.categoryIntro','plp.subcategoryTiles','carousel','accordion','banner.hero','slider.fullWidth'].includes(item.document.body.type)).map(item=><option key={item.resourceId} value={item.resourceId}>{item.document.name}</option>)}</select></label>
   <button type="button" className="adminButton" disabled={disabled||!selected} onClick={()=>{const source=library.items.find(item=>item.resourceId===selected);if(source)change([...items,{placement:'beforeList',target:{},module:remapIndependentModule(source.document,()=>`cms-${crypto.randomUUID()}`)}]);}}>Insertar copia</button>
   {library.offset>0?<button type="button" className="adminButton" disabled={busy} onClick={()=>load(Math.max(0,library.offset-library.limit))}>Anteriores</button>:null}{library.offset+library.items.length<library.total?<button type="button" className="adminButton" disabled={busy} onClick={()=>load(library.offset+library.limit)}>Siguientes</button>:null}
  </div>
  {message?<p role="status">{message}</p>:null}
  {items.map((item,index)=><details className="pricingPanel" key={item.module.instanceId}><summary>{item.module.name} · {item.target.categorySlug||item.target.routePath||'Sin destino'}</summary>
   <fieldset disabled={disabled}><label className="adminField"><span>Tipo de listado</span><select value={item.target.listingKind??'CATEGORY'} onChange={event=>change(items.map((current,i)=>i===index?{...current,target:{...current.target,listingKind:event.target.value as 'CATEGORY'|'SEARCH'|'COLLECTION'}}:current))}><option value="CATEGORY">Categoría</option><option value="SEARCH">Búsqueda</option><option value="COLLECTION">Colección</option></select></label><label className="adminField"><span>Category slug</span><input value={item.target.categorySlug??''} maxLength={256} aria-invalid={!/^[a-zA-Z0-9._~%-]*$/.test(item.target.categorySlug??'')} onChange={event=>change(items.map((current,i)=>i===index?{...current,target:{...current.target,categorySlug:event.target.value}}:current))}/></label>
    <label className="adminField"><span>Ruta de categoría</span><input value={item.target.routePath??''} maxLength={2048} placeholder="/categoria" onChange={event=>change(items.map((current,i)=>i===index?{...current,target:{...current.target,routePath:event.target.value}}:current))}/></label>
    <label className="adminField"><span>Posición</span><select value={item.placement} onChange={event=>change(items.map((current,i)=>i===index?{...current,placement:event.target.value as Items[number]['placement']}:current))}><option value="beforeList">Antes del listado</option><option value="afterList">Después del listado</option></select></label>
    {!item.target.categorySlug&&!item.target.routePath?<p role="status">Sin destino: este módulo no aparecerá en ninguna categoría.</p>:null}
    <CmsModuleInstanceFields module={item.module} onChange={piece=>change(items.map((current,i)=>i===index?{...current,module:piece}:current))}/>
    <CmsDesignSettingsEditor value={item.module.designSettings} onChange={designSettings=>change(items.map((current,i)=>i===index?{...current,module:{...current.module,designSettings}}:current))}/>
    <div className="adminButtonRow"><button type="button" className="adminButton" disabled={index===0} onClick={()=>{const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];change(next);}}>Subir</button><button type="button" className="adminButton" disabled={index===items.length-1} onClick={()=>{const next=[...items];[next[index+1],next[index]]=[next[index],next[index+1]];change(next);}}>Bajar</button><button type="button" className="adminButton" onClick={()=>change([...items,{...structuredClone(item),module:remapIndependentModule(item.module,()=>`cms-${crypto.randomUUID()}`)}])}>Duplicar</button><button type="button" className="adminButton" onClick={()=>change(items.filter((_,i)=>i!==index))}>Quitar de esta página</button></div>
   </fieldset>
   <div data-admin-section-preview onClickCapture={event=>event.preventDefault()} onSubmitCapture={event=>event.preventDefault()}><CmsIndependentModuleView document={item.module} renderRegistered={renderCmsShellModulePreview}/></div>
  </details>)}
 </section>;
}
