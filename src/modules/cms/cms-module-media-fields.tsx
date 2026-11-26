"use client";
import {useState} from 'react';
import {uploadCmsBuilderMediaAction} from './cms-admin-actions';
import type {CmsIndependentModule} from './cms-independent-module-types';
export function CmsModuleMediaFields({module,onChange,onBusyChange}:{module:CmsIndependentModule;onChange:(module:CmsIndependentModule)=>void;onBusyChange?:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(module.body.kind!=='visual')return null;
 const value=module.body.value,assets=(value.assetRefs??[]).filter(asset=>asset.assetKey.startsWith('migration-'));
 if(!assets.length)return null;
 return <section aria-label="Fondos recuperados de Media"><h3>Fondos recuperados de Media</h3>{assets.map(asset=><label className="adminField" key={asset.assetKey}><span>Reemplazar fondo · {asset.assetKey}</span><input type="file" accept="image/*" disabled={busy} onChange={async event=>{
  const file=event.target.files?.[0];if(!file||busy)return;
  setBusy(true);onBusyChange?.(true);setMessage('Subiendo fondo…');
  try{
   const form=new FormData();form.set('file',file);form.set('assetKey',asset.assetKey);
   const result=await uploadCmsBuilderMediaAction(form);
   if(!result.ok||!result.mediaAssetId||!result.publicUrl){setMessage(result.message);return;}
   onChange({...module,body:{kind:'visual',value:{...value,assetRefs:value.assetRefs?.map(item=>item.assetKey===asset.assetKey?{...item,mediaAssetId:result.mediaAssetId!,src:result.publicUrl!}:item)}}});
   setMessage('Fondo reemplazado en esta copia. Aplica los cambios y guarda la página o sección.');
  }catch{setMessage('No se pudo confirmar la subida. El fondo anterior se conserva.');}finally{setBusy(false);onBusyChange?.(false);}
 }}/></label>)}{message?<p role="status">{message}</p>:null}</section>;
}
