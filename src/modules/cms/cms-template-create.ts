import type { CmsTemplateCommand, CmsTemplateContent } from "./cms-composition-template-types";
export function newCompositionTemplateCommand(kind: "SECTION"|"PAGE", name: string): CmsTemplateCommand {
  const title=name.trim();
  if(!title || title.length>256 || /[\r\n]/.test(title))throw Error("Escribe un nombre de plantilla de entre 1 y 256 caracteres, en una línea.");
  if(kind!=="SECTION" && kind!=="PAGE")throw Error("Selecciona una plantilla de sección o de página.");
  const content:CmsTemplateContent=kind==="SECTION" ? {kind:"SECTION",value:{sectionId:`cms-${crypto.randomUUID()}`,name:title,root:{nodeId:`cms-${crypto.randomUUID()}`,kind:"container",layout:"stack",presentation:{},children:[]}}} : {kind:"PAGE",value:{compositionSchemaVersion:1,sections:[]}};
  return {contractVersion:1,resourceKind:"TEMPLATE",operationId:crypto.randomUUID(),document:{name:title,content}};
}
