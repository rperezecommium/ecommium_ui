"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { getShopReadPreparationAction, prepareShopReadsAction } from "./shop-read-preparation-actions";
import { preparationLabels, type ShopReadPreparation } from "./shop-read-preparation";
import styles from "./shop-read-preparation.module.css";
const phases:Record<string,string>={VERIFY_IDENTITY:"Comprobando la tienda",BINDINGS:"Preparando sus conexiones",SNAPSHOT:"Preparando los datos iniciales",ACTIVATION:"Activando las lecturas",VERIFY:"Verificando el acceso a los datos"};
export function ShopReadPreparationPanel({scopeKey,canManage,target}:{scopeKey:string;canManage:boolean;target?:{organizationId:string;shopId:string}}){
 const [status,setStatus]=useState<ShopReadPreparation|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[pollVersion,setPollVersion]=useState(0);
 const current=useRef({epoch:0,alive:true});
 useEffect(()=>{let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;const life=current.current;life.alive=true;const epoch=++life.epoch;
  async function load(){try{const r=await getShopReadPreparationAction(target);if(stopped||!life.alive||epoch!==life.epoch)return;if(r.ok){setStatus(r.data);setError(null);if(["PENDING","RUNNING"].includes(r.data.state))timer=setTimeout(load,2000);else if(r.data.state==="READY")timer=setTimeout(load,15000);else if(["PREPARATION_CONTROL_UNAVAILABLE","PREPARATION_UNAVAILABLE"].includes(r.data.code??""))timer=setTimeout(load,5000);}else{setError(r.error);timer=setTimeout(load,5000);}}catch{if(!stopped){setError("No se pudo consultar la preparación. Vuelve a intentarlo.");timer=setTimeout(load,5000);}}}
  void load();return()=>{stopped=true;life.alive=false;life.epoch++;clearTimeout(timer);};
 },[scopeKey,pollVersion,target]);
 async function prepare(){if(busy)return;setBusy(true);setError(null);const life=current.current,epoch=life.epoch;try{const r=await prepareShopReadsAction(target);if(!life.alive||epoch!==life.epoch)return;if(r.ok){setStatus(r.data);setPollVersion(v=>v+1);}else setError(r.error);}catch{if(life.alive&&epoch===life.epoch)setError("No se pudo solicitar la preparación. La tienda sigue creada; puedes reintentarlo.");}finally{if(life.alive&&epoch===life.epoch)setBusy(false);}}
 const preparing=busy||status?.state==="PENDING"||status?.state==="RUNNING",ready=status?.state==="READY";
 return <section className={styles.panel} aria-label="Preparación de la tienda">
  <div className={styles.heading}><h2>Completar el alta de la tienda</h2><span className={`adminBadge ${ready?"adminBadgeOk":"adminBadgeWarn"}`}>{status?preparationLabels[status.state]:"Comprobando"}</span></div>
  <div className={styles.body} role="status" aria-live="polite">
   {ready?<CheckCircle2 size={18} aria-hidden="true"/>:preparing?<LoaderCircle className={styles.spinner} size={18} aria-hidden="true"/>:null}
   <p>{ready?"Las lecturas de esta tienda están preparadas.":preparing?`${phases[status?.phase??""]??"Preparando la tienda"}. Puedes permanecer aquí; el estado se actualizará automáticamente.`:status?.state==="FAILED"?"La tienda está creada, pero no se ha completado su preparación. Puedes reintentar sin volver a crearla.":"La tienda está creada. Sus pantallas de gestión estarán disponibles cuando finalice la preparación de lecturas."}</p>
  </div>
  {status?<p className={styles.context}>Contexto de lectura: {status.context.locale} · {status.context.currency} · {status.context.country} · {status.context.channel}</p>:null}
  {error?<p className={styles.error} role="alert">{error}</p>:null}
  {!ready&&!preparing&&canManage?<button className="adminButton adminButtonPrimary" type="button" onClick={()=>void prepare()} disabled={busy}><RefreshCw size={16} aria-hidden="true"/>{status?.state==="FAILED"?"Reintentar preparación":"Preparar lecturas"}</button>:null}
  {ready?<Link className="adminButton adminButtonPrimary" href="/admin/configuracion/contexto">Continuar</Link>:null}
  {status?.code?<details className={styles.details}><summary>Detalle de preparación</summary><p>{status.code}</p></details>:null}
 </section>;
}
