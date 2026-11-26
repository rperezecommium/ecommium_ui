import type { CmsIndependentModule } from "./cms-independent-module-types";

// Section editing may change declared instance values only. All module design
// metadata and undeclared values are retained from the existing snapshot.
export function updateModuleInstanceContent(module: CmsIndependentModule, values: Record<string, unknown>): CmsIndependentModule {
  if (module.body.kind === "registered") {
    const props={...module.body.props};
    for(const key of module.editableFields??[])if(Object.hasOwn(values,key))props[key]=structuredClone(values[key]);
    return {...module,body:{...module.body,props}};
  }
  const current = module.body.value;
  const contentValues = { ...current.contentValues };
  for (const key of Object.keys(current.contentSchema ?? {})) {
    if (Object.hasOwn(values, key)) contentValues[key] = values[key];
  }
  return { ...module, body: { ...module.body, value: { ...current, contentValues } } };
}
