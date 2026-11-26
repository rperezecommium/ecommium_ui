"use client";
import { useState } from "react";
import { loadCmsShellAssignmentPagesAction, saveCmsShellAssignmentAction } from "./cms-site-parts-actions";
import type { CmsPage, CmsShellScope, CmsSitePart, CmsSitePartKind } from "./cms-admin";
import type { CmsSectionContext } from "./cms-independent-section-types";

const surfaces=["HOME","CMS","PLP","PDP","SEARCH","CART","CHECKOUT","ACCOUNT","ERROR"];
export function CmsShellAssignmentForm({kind,context,items,canWrite}:{kind:CmsSitePartKind;context:CmsSectionContext;items:CmsSitePart[];canWrite:boolean}) {
  const [scope,setScope]=useState<CmsShellScope>("DEFAULT"),[surface,setSurface]=useState("CMS"),[pageId,setPageId]=useState("");
  const [pages,setPages]=useState<{items:CmsPage[];offset:number;limit:number;total:number}>({items:[],offset:0,limit:50,total:0}),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function load(offset:number){setBusy(true);setMessage("");try{const result=await loadCmsShellAssignmentPagesAction(context,offset);if(result.ok){setPages(result.data);setPageId("");}else setMessage(result.message);}catch{setMessage("No se pudieron cargar las páginas.");}finally{setBusy(false);}}
  return <form action={saveCmsShellAssignmentAction} className="cmsSitePartAssignmentForm">
    <input name="kind" type="hidden" value={kind}/><input name="locale" type="hidden" value={context.locale}/><input name="scopeKey" type="hidden" value={scope==="PAGE"?pageId:scope==="SURFACE"?surface:""}/>
    <fieldset disabled={!canWrite||busy}>
      <label className="adminField">Alcance<select name="scope" value={scope} onChange={event=>{const next=event.target.value as CmsShellScope;setScope(next);if(next==="PAGE"&&!pages.items.length)void load(0);}}><option value="DEFAULT">Default tienda</option><option value="SURFACE">Superficie</option><option value="PAGE">Página concreta</option></select></label>
      {scope==="SURFACE"?<label className="adminField">Superficie<select value={surface} onChange={event=>setSurface(event.target.value)}>{surfaces.map(value=><option key={value}>{value}</option>)}</select></label>:null}
      {scope==="PAGE"?<><label className="adminField">Página<select aria-label="Página de la asignación" value={pageId} onChange={event=>setPageId(event.target.value)} required><option value="">Selecciona una página</option>{pages.items.map(page=><option key={page.pageId} value={page.pageId}>{page.title} · {page.path}</option>)}</select></label><div className="adminButtonRow"><button className="adminButton" type="button" disabled={!pages.offset} onClick={()=>void load(Math.max(0,pages.offset-pages.limit))}>Páginas anteriores</button><button className="adminButton" type="button" disabled={pages.offset+pages.limit>=pages.total} onClick={()=>void load(pages.offset+pages.limit)}>Más páginas</button></div></>:null}
      <label className="adminField">{kind==="HEADER"?"Header":"Footer"}<select name="selectedId" required><option value="">Seleccionar</option><option value="__none__">Retirar asignación (heredar)</option>{items.filter(item=>item.status==="ACTIVE").map(item=><option key={item.sitePartId} value={item.sitePartId}>{item.name}</option>)}</select></label>
      <label className="adminField">Breadcrumb<select name="breadcrumbMode"><option value="AUTO">Automático</option><option value="HIDDEN">Oculto</option></select></label>
      <button className="adminButton adminButtonPrimary" type="submit" disabled={scope==="PAGE"&&!pageId}>Guardar</button>
    </fieldset>
    {busy?<p role="status">Cargando páginas…</p>:null}{message?<p role="alert">{message}<button className="adminButton" type="button" disabled={busy||!canWrite} onClick={()=>void load(pages.offset)}>Reintentar carga de páginas</button></p>:null}
  </form>;
}
