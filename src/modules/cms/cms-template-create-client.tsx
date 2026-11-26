"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {saveCompositionTemplateAction} from "./cms-composition-template-actions";
import {newCompositionTemplateCommand} from "./cms-template-create";
import type {CmsTemplateCommand,CmsTemplateReceipt} from "./cms-composition-template-types";
import type {CmsSectionContext} from "./cms-independent-section-types";
import styles from "./cms-module-builder.module.css";
export function CmsTemplateCreateClient({context,disabled,onCreated}:{context:CmsSectionContext;disabled:boolean;onCreated:(receipt:CmsTemplateReceipt)=>void}) {
  const [open,setOpen]=useState(false),[kind,setKind]=useState<"SECTION"|"PAGE">("SECTION"),[name,setName]=useState("");
  const [busy,setBusy]=useState(false),[pending,setPending]=useState<CmsTemplateCommand|null>(null),[message,setMessage]=useState("");
  const [saved,setSaved]=useState<CmsTemplateReceipt|null>(null);
  const active=useRef(false);
  useEffect(()=>{
    if(!pending)return;
    const warn=(event:BeforeUnloadEvent)=>event.preventDefault();
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[pending]);
  async function create(){
    if(disabled || active.current || saved)return;
    let command:CmsTemplateCommand;
    try{command=pending??newCompositionTemplateCommand(kind,name);}catch(error){setMessage(error instanceof Error?error.message:"Revisa los datos.");return;}
    active.current=true;setBusy(true);setPending(command);setMessage("");
    try{
      const result=await saveCompositionTemplateAction('create',undefined,command,context);
      if(result.ok){setPending(null);setSaved(result.receipt);setMessage('Plantilla creada.');onCreated(result.receipt);}
      else{
        if(result.status && result.status<500 && result.status!==408)setPending(null);
        setMessage(!result.status || result.status>=500 || result.status===408 ? 'No se pudo confirmar la creación. Reintenta la misma operación.' : result.message);
      }
    }catch{setMessage('No se pudo confirmar la creación. Reintenta la misma operación.');}
    finally{active.current=false;setBusy(false);}
  }
  return <>
    <button className={styles.templateCreateLink} type="button" aria-expanded={open} aria-controls="cms-template-create-form" disabled={disabled || busy || !!pending} onClick={()=>setOpen(!open)}>Crear nueva plantilla</button>
    {open ? <section id="cms-template-create-form" className={`${styles.sectionBox} ${styles.templateCreateForm}`} aria-label="Crear plantilla">
    <h2>Crear nueva plantilla</h2>
    <p>Empieza con una sección vacía o una composición de página. Se guardará como plantilla y se abrirá su editor.</p>
    <form onSubmit={event=>{event.preventDefault();void create();}} aria-busy={busy}>
      <fieldset disabled={disabled || busy || !!pending || !!saved}>
        <label className="adminField"><span>Nombre de plantilla</span><input required maxLength={256} value={name} onChange={event=>setName(event.target.value)} /></label>
        <label className="adminField"><span>Tipo de plantilla</span><select aria-label="Tipo de plantilla" value={kind} onChange={event=>setKind(event.target.value as "SECTION"|"PAGE")}><option value="SECTION">Sección</option><option value="PAGE">Página</option></select></label>
      </fieldset>
      <div className="adminButtonRow">
        {!saved ? <button className="adminButton adminButtonPrimary" type="submit" disabled={disabled || busy}>{busy?'Creando…':pending?'Reintentar la misma creación':'Crear y abrir diseño'}</button> : <Link className="adminButton adminButtonPrimary" href={`/admin/cms/plantillas?id=${encodeURIComponent(saved.resourceId)}`}>Abrir diseño de la plantilla</Link>}
        <button className="adminButton" type="button" disabled={busy || !!pending} onClick={()=>{setOpen(false);setMessage('');}}>Cancelar</button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </form>
  </section> : null}
  </>;
}
