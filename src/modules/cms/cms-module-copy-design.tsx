"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { migrateCmsVisualModuleV1ToV2ForRenderer } from "./cms-blocks";
import { CmsBlockStyleSheetEditor } from "./cms-block-style-sheet-editor";
import { CmsModuleEditableFields } from "./cms-module-builder-client";
import type { CmsIndependentModule } from "./cms-independent-module-types";

const VisualEditor = dynamic(() => import("./cms-visual-editing-panel").then(module => module.CmsVisualEditingPanel), {loading: () => <p role="status">Cargando inspector del módulo…</p>});

// Uses the same authoring tools as the library. The parent owns the local draft,
// validation, cancellation and persistence; no library resource is mutated here.
export function CmsModuleCopyDesign({module,onChange,onBusyChange}:{
  module:CmsIndependentModule;onChange:(module:CmsIndependentModule)=>void;onBusyChange?:(busy:boolean)=>void;
}) {
  const [opened,setOpened]=useState(false);
  return <details onToggle={event=>setOpened(event.currentTarget.open)}><summary>Diseño y campos de esta copia</summary><p>Estos cambios afectan solo a esta copia. Aplica y guarda la composición para conservarlos.</p>
    {opened ? <>{module.body.kind === "visual" ? <VisualEditor block={{blockId:module.instanceId,type:"visual.module",props:module.body.value}} onBusyChange={onBusyChange} onChange={block=>onChange({...module,body:{kind:"visual",value:migrateCmsVisualModuleV1ToV2ForRenderer(block.props)}})}/> : <CmsModuleEditableFields module={module} onChange={onChange}/>}
    <CmsBlockStyleSheetEditor value={module.styleSheet} resource="bloque" onChange={styleSheet=>onChange({...module,styleSheet})}/>
    </> : null}
  </details>;
}
