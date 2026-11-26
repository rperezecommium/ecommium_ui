import {remapIndependentModule} from './cms-independent-module-comparison';
import {isCmsShellModule} from './cms-shell-modules';
import type { CmsScopedStyleSheet } from "./cms-blocks";
import type {
  CmsSectionContext,
  CmsSectionDocument,
  CmsSpaceNode,
} from "./cms-independent-section-types";
import { remapSection } from "./cms-section-tree";
export type CmsPageComposition = {
  layout?: import('./cms-admin').CmsLayout;
  designSettings?: import('../../../packages/cms-blocks/src/design-settings').CmsDesignSettings;
  plpModules?: Array<{placement:'beforeList'|'afterList';target:{listingKind?:'CATEGORY'|'SEARCH'|'COLLECTION';routePath?:string;categorySlug?:string};module:import('./cms-independent-module-types').CmsIndependentModule}>;
  compositionSchemaVersion: 1;
  sections: CmsSectionDocument[];
  styleSheet?: CmsScopedStyleSheet;
};
export type CmsPageCompositionReceipt = {
  contractVersion: 1;
  resourceId: string;
  revisionToken: string;
  context: CmsSectionContext;
  state: "DRAFT" | "PUBLISHED";
  document: CmsPageComposition;
};
export type CmsPageMetadata = {
  title: string;
  path: string;
  seo: { title: string; description: string };
};
export function cmsPagePublicationIssues(document:CmsPageComposition):string[] {
 const issues:string[]=[];
 if(document.layout)for(const section of document.sections){const p=section.placement;if(p&&!document.layout.regions[p.region]?.areas.some(area=>area.areaId===p.areaId&&(area.columnSlots?.length?area.columnSlots.some(slot=>slot.columnIndex===p.columnIndex):p.columnIndex<=area.columns.length)))issues.push(`«${section.name}» conserva una ubicación que ya no existe. Selecciona un destino antes de publicar.`);}
 for(const item of document.plpModules??[])if(!item.target.categorySlug&&!item.target.routePath)issues.push(`«${item.module.name}» no tiene destino PLP. Configúralo antes de publicar.`);
 return issues;
}
export function assertPageBudget(document: CmsPageComposition) {
  if (
    document.compositionSchemaVersion !== 1 ||
    !Array.isArray(document.sections) ||
    document.sections.length+(document.plpModules?.length??0) > 24
  )
    throw Error("Composición no válida.");
  if (new TextEncoder().encode(JSON.stringify(document)).length > 1048576)
    throw Error("La página supera 1 MiB.");
  const ids = new Set<string>();
  let count = 0;
  const identity = (id: string) => {
    if (ids.has(id)) throw Error("La página contiene identidades repetidas.");
    ids.add(id);
  };
  const visit = (node: CmsSpaceNode, depth: number) => {
    if (depth > 8 || ++count > 120)
      throw Error("Máximo 120 nodos y 8 niveles por página.");
    identity(node.nodeId);
    if (node.kind === "container")
      node.children.forEach((child) => visit(child, depth + 1));
    else {
      identity(node.module.instanceId);
      if(node.module.body.kind==='registered'&&isCmsShellModule(node.module.body.type)) throw Error('Este módulo pertenece a Header/Footer.');
      if (
        node.module.body.kind === "registered" &&
        node.module.body.type.startsWith("plp.")
      )
        throw Error("Este módulo solo se puede utilizar en PLP.");
    }
  };
  for (const section of document.sections) {
    identity(section.sectionId);
    visit(section.root, 1);
  }
  for(const item of document.plpModules??[]) {
    identity(item.module.instanceId);
    if(++count>120)throw Error('Máximo 120 nodos por página.');
    if(item.module.body.kind==='registered'&&!['plp.categoryIntro','plp.subcategoryTiles','carousel','accordion','banner.hero','slider.fullWidth'].includes(item.module.body.type))throw Error('Este módulo no pertenece a la superficie PLP.');
  }
}
export function pageCompositionMatches(
  expected: CmsPageComposition,
  actual: CmsPageComposition,
  allowRemap = false,
) {
  const canonical = (document: CmsPageComposition) => {
    let i = 0;
    const ids = new Map<string, string>();
    const pair = (old: CmsSpaceNode, next: CmsSpaceNode) => {
      ids.set(old.nodeId, next.nodeId);
      if (old.kind === "container" && next.kind === "container")
        old.children.forEach((child, index) =>
          pair(child, next.children[index]),
        );
    };
    const copy = structuredClone(document);
    if (allowRemap) {
      copy.sections = document.sections.map((section) => {
        const next = remapSection(section, () => `cms-${i++}`);
        ids.set(section.sectionId, next.sectionId);
        pair(section.root, next.root);
        return next;
      });
      if(copy.plpModules)copy.plpModules=copy.plpModules.map(item=>({...item,module:remapIndependentModule(item.module,()=>`cms-${i++}`)}));
      for (const rules of Object.values(copy.styleSheet ?? {}))
        for (const rule of rules ?? [])
          rule.selector = rule.selector.replace(
            /\[[^\]]+\]|#[\w-]+/g,
            (token) =>
              token.startsWith("#")
                ? "#" + (ids.get(token.slice(1)) ?? token.slice(1))
                : token.replace(
                    /^(\[(?:data-cms-node-id|id)=)(["']?)([\w.:-]+)\2\]$/,
                    (_, prefix, quote, id) =>
                      `${prefix}${quote}${ids.get(id) ?? id}${quote}]`,
                  ),
          );
    }
    return sorted(copy);
  };
  try {
    return canonical(expected) === canonical(actual);
  } catch {
    return false;
  }
}
function sorted(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(sorted).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ":" + sorted(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function pageCompositionWithoutHydration(
  value: unknown,
): CmsPageComposition {
  const copy = structuredClone(value) as CmsPageComposition;
  const visit = (node: CmsSpaceNode) => {
    if (node.kind === "container") node.children.forEach(visit);
    else if (
      node.module.body.kind === "registered" &&
      node.module.body.type === "commerce.productGrid"
    ) {
      delete node.module.body.props.hydratedProducts;
      delete node.module.body.props.hydration;
    }
  };
  copy.sections.forEach((section) => visit(section.root));
  assertPageBudget(copy);
  return copy;
}

export function isPublicPageComposition(
  value: unknown,
): value is CmsPageComposition {
  try {
    pageCompositionWithoutHydration(value);
    return true;
  } catch {
    return false;
  }
}
