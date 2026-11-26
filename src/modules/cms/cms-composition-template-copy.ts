import {remapIndependentModule} from './cms-independent-module-comparison';
import {
  remapSection,
  sectionReceiptMatches,
  freshSectionId,
} from "./cms-section-tree";
import {
  pageCompositionMatches,
  assertPageBudget,
} from "./cms-page-composition";
import type {
  CmsTemplateContent,
  CmsTemplateDocument,
} from "./cms-composition-template-types";
import type { CmsSpaceNode } from "./cms-independent-section-types";
export function templateReceiptMatches(
  expected: CmsTemplateDocument,
  actual: CmsTemplateDocument,
) {
  if (
    expected.name !== actual.name ||
    expected.content.kind !== actual.content.kind
  )
    return false;
  return expected.content.kind === "SECTION" &&
    actual.content.kind === "SECTION"
    ? sectionReceiptMatches(expected.content.value, actual.content.value)
    : expected.content.kind === "PAGE" &&
        actual.content.kind === "PAGE" &&
        pageCompositionMatches(
          expected.content.value,
          actual.content.value,
          true,
        );
}
export function copyTemplateContent(
  source: CmsTemplateContent,
  nextId = freshSectionId,
): CmsTemplateContent {
  if (source.kind === "SECTION")
    return { kind: "SECTION", value: remapSection(source.value, nextId) };
  const copy = structuredClone(source.value);
  const ids = new Map<string, string>();
  const pair = (old: CmsSpaceNode, next: CmsSpaceNode) => {
    ids.set(old.nodeId, next.nodeId);
    if (old.kind === "container" && next.kind === "container")
      old.children.forEach((child, index) => pair(child, next.children[index]));
  };
  copy.sections = source.value.sections.map((section) => {
    const next = remapSection(section, nextId);
    ids.set(section.sectionId, next.sectionId);
    pair(section.root, next.root);
    return next;
  });
  if(copy.plpModules)copy.plpModules=copy.plpModules.map(item=>({...item,module:remapIndependentModule(item.module,nextId)}));
  for (const rules of Object.values(copy.styleSheet ?? {}))
    for (const rule of rules ?? []) {
      rule.selector = rule.selector.replace(/\[[^\]]+\]|#[\w-]+/g, (token) =>
        token.startsWith("#")
          ? "#" + (ids.get(token.slice(1)) ?? token.slice(1))
          : token.replace(
              /^(\[(?:data-cms-node-id|id)=)(["']?)([\w.:-]+)\2\]$/,
              (_, start, quote, id) =>
                `${start}${quote}${ids.get(id) ?? id}${quote}]`,
            ),
      );
    }
  assertPageBudget(copy);
  return { kind: "PAGE", value: copy };
}
