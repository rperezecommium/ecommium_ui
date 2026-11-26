import type { CmsSpaceNode } from "./cms-independent-section-types";
export type CmsSectionAreaReference = { nodeId:string; label:string; kind:"container"|"module"; selector:string };
export function sectionAreaReferences(root:CmsSpaceNode):CmsSectionAreaReference[] {
  const result:CmsSectionAreaReference[]=[];
  function visit(node:CmsSpaceNode,path:string) {
    // Existing section IDs fit the selector grammar. Never interpolate arbitrary
    // names or a raw imported value into CSS.
    if (/^[\w.:-]+$/.test(node.nodeId) && node.nodeId.length <= 180) result.push({
      nodeId:node.nodeId, kind:node.kind,
      label:node.kind==="module"?node.module.name:path?`Contenedor ${path}`:"Contenedor principal",
      selector:`[data-cms-node-id="${node.nodeId}"]`,
    });
    if(node.kind==="container")node.children.forEach((child,index)=>visit(child,path?`${path}.${index+1}`:String(index+1)));
  }
  visit(root,"");return result;
}
