import type {
  CmsSectionDocument,
  CmsSpaceNode,
} from "./cms-independent-section-types";
import { remapIndependentModule } from "./cms-independent-module-comparison";
export const freshSectionId = () => `cms-${crypto.randomUUID()}`;
export function findSpace(
  root: CmsSpaceNode,
  id: string,
): CmsSpaceNode | undefined {
  if (root.nodeId === id) return root;
  if (root.kind === "container")
    for (const child of root.children) {
      const found = findSpace(child, id);
      if (found) return found;
    }
}
export function assertSpaceBudget(root: CmsSpaceNode) {
  let count = 0;
  const ids = new Set<string>();
  const visit = (node: CmsSpaceNode, depth: number) => {
    if (depth > 8 || ++count > 120)
      throw Error("Máximo 8 niveles y 120 nodos por sección.");
    if (ids.has(node.nodeId))
      throw Error("El árbol contiene un ciclo o una identidad repetida.");
    ids.add(node.nodeId);
    if (node.kind === "container")
      node.children.forEach((child) => visit(child, depth + 1));
  };
  visit(root, 1);
}
export function moveSpace(
  document: CmsSectionDocument,
  id: string,
  parentId: string,
  index: number,
) {
  const copy = structuredClone(document),
    node = findSpace(copy.root, id),
    target = findSpace(copy.root, parentId);
  if (
    !node ||
    !target ||
    target.kind !== "container" ||
    id === copy.root.nodeId ||
    findSpace(node, parentId)
  )
    throw Error(
      "No se puede mover un nodo dentro de sí mismo o de sus descendientes.",
    );
  const remove = (parent: CmsSpaceNode): boolean => {
    if (parent.kind !== "container") return false;
    const at = parent.children.findIndex((child) => child.nodeId === id);
    if (at >= 0) {
      parent.children.splice(at, 1);
      return true;
    }
    return parent.children.some(remove);
  };
  remove(copy.root);
  target.children.splice(
    Math.max(0, Math.min(index, target.children.length)),
    0,
    node,
  );
  assertSpaceBudget(copy.root);
  return copy;
}
export function remapSection(
  source: CmsSectionDocument,
  nextId = freshSectionId,
) {
  const copy = structuredClone(source),
    ids = new Map<string, string>();
  const fresh = (id: string) => {
    const next = nextId();
    ids.set(id, next);
    return next;
  };
  copy.sectionId = fresh(copy.sectionId);
  const walk = (node: CmsSpaceNode) => {
    node.nodeId = fresh(node.nodeId);
    if (node.kind === "container") node.children.forEach(walk);
    else node.module = remapIndependentModule(node.module, nextId);
  };
  walk(copy.root);
  for (const rules of Object.values(copy.styleSheet ?? {}))
    for (const rule of rules ?? [])
      rule.selector = rule.selector.replace(/\[[^\]]+\]|#[\w-]+/g, (token) =>
        token.startsWith("#")
          ? "#" + (ids.get(token.slice(1)) ?? token.slice(1))
          : token.replace(
              /^(\[(?:data-cms-node-id|id)=)(["']?)([\w.:-]+)\2\]$/,
              (_, start, quote, id) =>
                `${start}${quote}${ids.get(id) ?? id}${quote}]`,
            ),
      );
  return copy;
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
export function sectionReceiptMatches(
  expected: CmsSectionDocument,
  actual: CmsSectionDocument,
) {
  const canonical = (doc: CmsSectionDocument) => {
    let i = 0;
    return sorted(remapSection(doc, () => `cms-${i++}`));
  };
  try {
    return canonical(expected) === canonical(actual);
  } catch {
    return false;
  }
}
