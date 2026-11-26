"use client";

import { normalizeCmsVisualModuleProps } from "./cms-blocks";
import type { CmsIndependentModule } from "./cms-independent-module-types";
import { updateModuleInstanceContent } from "./cms-module-instance-content";
import { VisualContentValuesEditor, visualInstanceContentValues } from "./cms-visual-editor";
import {RegisteredFields} from './cms-module-builder-client';
import {CmsModuleMediaFields} from './cms-module-media-fields';
import {CmsModuleCopyDesign} from './cms-module-copy-design';

export function CmsModuleInstanceFields({ module, onChange, onBusyChange }: {
  module: CmsIndependentModule;
  onChange: (module: CmsIndependentModule) => void;
  onBusyChange?: (busy:boolean)=>void;
}) {
  const design = <CmsModuleCopyDesign module={module} onChange={onChange} onBusyChange={onBusyChange}/>;
  if(module.body.kind==='registered')return <section aria-label="Contenido de la copia del módulo"><h3>Campos editables</h3><p>Los cambios afectan solo a esta copia.</p>{design}<RegisteredFields type={module.body.type} props={module.body.props} editableFields={module.editableFields??[]} onChange={values=>onChange(updateModuleInstanceContent(module,values))}/></section>;
  if (module.body.kind !== "visual" || !Object.keys(module.body.value.contentSchema ?? {}).length) {
    return <section aria-label="Contenido de la copia del módulo">{design}<CmsModuleMediaFields module={module} onChange={onChange} onBusyChange={onBusyChange}/><p>El creador no ha habilitado campos editables para este módulo. Puedes habilitarlos en el inspector de esta copia.</p></section>;
  }
  const props = normalizeCmsVisualModuleProps(module.body.value);
  const schema = props.contentSchema ?? {};
  return <section aria-label="Contenido de la copia del módulo">
    {design}
    <CmsModuleMediaFields module={module} onChange={onChange} onBusyChange={onBusyChange}/>
    <h3>Campos editables</h3>
    <p>Personaliza los campos habilitados por el creador. Los cambios afectan solo a esta copia; su diseño se conserva.</p>
    <VisualContentValuesEditor
      schema={schema}
      values={visualInstanceContentValues(props.tree, schema, props.contentValues ?? {})}
      onChange={values => onChange(updateModuleInstanceContent(module, values))}
    />
  </section>;
}
