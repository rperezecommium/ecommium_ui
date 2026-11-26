"use client";
import {useEffect,useState} from 'react';
import {loadCmsDesignDefaultsAction} from './cms-design-settings-actions';
import {emptyCmsDesign,resolveCmsDesignSettings,type CmsDesignSettings,type CmsDesignValues,type CmsResolvedDesign} from '../../../packages/cms-blocks/src/design-settings';
export function useCmsDesignDefaults(expected?:{organizationId:string;shopId:string;locale?:string},enabled=true) {
 const organizationId=expected?.organizationId,shopId=expected?.shopId,locale=expected?.locale;
 const [state,setState]=useState<{values:CmsResolvedDesign;message?:string}>({values:emptyCmsDesign});
 useEffect(()=>{if(!enabled)return;let current=true;loadCmsDesignDefaultsAction(organizationId&&shopId?{organizationId,shopId,locale}:undefined).then(value=>{if(current)setState(value);}).catch(()=>{if(current)setState({values:emptyCmsDesign,message:'No se pudieron consultar los ajustes heredados.'});});return()=>{current=false;};},[enabled,organizationId,shopId,locale]);
 return state;
}
const fields:Array<[keyof CmsDesignValues,string,string]>=[['maxWidth','Ancho máximo','1280px'],['moduleGap','Gap módulos','24px'],['columnGap','Gap columnas','16px'],['color','Color del texto','#111111'],['backgroundColor','Color de fondo','transparent']];
export function CmsDesignSettingsEditor({value={},inherited=emptyCmsDesign,onChange,disabled=false}:{value?:CmsDesignSettings;inherited?:CmsResolvedDesign;onChange:(value:CmsDesignSettings)=>void;disabled?:boolean}) {
 const [scope,setScope]=useState<'base'|'desktop'|'tablet'|'mobile'>('base');
 const effective=resolveCmsDesignSettings(inherited,value)[scope==='base'?'desktop':scope];
 function change(key:keyof CmsDesignValues,next:string|undefined) {
  const values={...value[scope]};if(next===undefined)delete values[key];else values[key]=next;
  const updated={...value};if(Object.keys(values).length)updated[scope]=values;else delete updated[scope];onChange(updated);
 }
 return <details className="pricingPanel"><summary>Ajustes básicos heredados</summary>
  <p>Los campos sin personalizar heredan del nivel superior. Los estilos específicos y el CSS conservan su prioridad.</p>
  <label className="adminField"><span>Responsive</span><select value={scope} disabled={disabled} onChange={event=>setScope(event.target.value as typeof scope)}><option value="base">Todos los tamaños</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select></label>
  <div className="adminFormGrid">{fields.map(([key,label,fallback])=>{
   const custom=value[scope]?.[key];
   const pattern=(key==='color'||key==='backgroundColor'?/^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|transparent|currentColor)$/:key==='maxWidth'?/^(?:none|0|[0-9]{1,4}(?:\.[0-9]{1,2})?(?:px|rem|em|%|vw))$/:/^(?:0|[0-9]{1,4}(?:\.[0-9]{1,2})?(?:px|rem|em|%|vw))$/);
   const valid=custom===undefined||pattern.test(custom);
   return <div key={key}><label className="adminCheckbox"><input type="checkbox" checked={custom!==undefined} disabled={disabled} onChange={event=>change(key,event.target.checked?effective[key]??fallback:undefined)}/>Personalizar {label.toLocaleLowerCase('es')}</label>
    <label className="adminField"><span>{label}</span><input disabled={disabled||custom===undefined} value={custom??''} placeholder={effective[key]??'Sin valor heredado'} maxLength={24} required={custom!==undefined} pattern={pattern.source} aria-invalid={!valid} onChange={event=>change(key,event.target.value)}/><small>{custom===undefined?`Heredado: ${effective[key]??'sin valor'}`:'Personalizado · desmarca para restaurar herencia'}{!valid?' · Valor no válido. Usa una medida CSS o un color hexadecimal.':''}</small></label>
   </div>;
  })}</div>
 </details>;
}
