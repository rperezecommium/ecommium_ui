import type { CmsSectionDocument, CmsSpaceNode } from "./cms-independent-section-types";
import { assertSpaceBudget, findSpace, freshSectionId, moveSpace } from "./cms-section-tree";
export type SectionMove = "up" | "down" | "in" | "out";
export type SectionDrop = "before" | "inside" | "after";
export function spaceParent(root: CmsSpaceNode, id: string): Extract<CmsSpaceNode, {kind:"container"}> | undefined {
  if (root.kind !== "container") return;
  if (root.children.some(child => child.nodeId === id)) return root;
  for (const child of root.children) { const found = spaceParent(child, id); if (found) return found; }
}
export function sectionStepDestination(root: CmsSpaceNode, id: string, direction: SectionMove) {
  const parent = spaceParent(root, id);
  if (!parent) return null;
  const at = parent.children.findIndex(child => child.nodeId === id);
  if (direction === "up" || direction === "down") {
    const index = at + (direction === "up" ? -1 : 1);
    return index < 0 || index >= parent.children.length ? null : { parentId: parent.nodeId, index };
  }
  if (direction === "in") {
    const previous = parent.children[at - 1];
    return previous?.kind === "container" ? {parentId: previous.nodeId, index: previous.children.length} : null;
  }
  const grandparent = spaceParent(root, parent.nodeId);
  return grandparent ? {parentId: grandparent.nodeId, index: grandparent.children.findIndex(child => child.nodeId === parent.nodeId) + 1} : null;
}
export function sectionDropDestination(root: CmsSpaceNode, sourceId: string, targetId: string, position: SectionDrop) {
  const source = findSpace(root, sourceId), target = findSpace(root, targetId);
  if (!source || !target || sourceId === root.nodeId || findSpace(source, targetId)) return null;
  if (position === "inside") return target.kind === "container" ? {parentId: targetId, index: target.children.filter(child => child.nodeId !== sourceId).length} : null;
  const parent = spaceParent(root, targetId);
  if (!parent) return null;
  const index = parent.children.filter(child => child.nodeId !== sourceId).findIndex(child => child.nodeId === targetId);
  return {parentId: parent.nodeId, index: index + (position === "after" ? 1 : 0)};
}
export function moveSectionStep(doc: CmsSectionDocument, id: string, direction: SectionMove) {
  const destination = sectionStepDestination(doc.root, id, direction);
  if (!destination) throw Error("Ese movimiento no está disponible.");
  return moveSpace(doc, id, destination.parentId, destination.index);
}
export function dropSectionSpace(doc: CmsSectionDocument, id: string, targetId: string, position: SectionDrop) {
  const destination = sectionDropDestination(doc.root, id, targetId, position);
  if (!destination) throw Error("Destino no permitido: no puedes mover una pieza dentro de sí misma o de sus descendientes.");
  return moveSpace(doc, id, destination.parentId, destination.index);
}
export function removeSectionSpace(doc: CmsSectionDocument, id: string) {
  if (id === doc.root.nodeId) throw Error("El contenedor raíz no se puede eliminar.");
  const copy = structuredClone(doc), parent = spaceParent(copy.root, id);
  if (!parent) throw Error("La pieza ya no está disponible.");
  parent.children = parent.children.filter(child => child.nodeId !== id);
  assertSpaceBudget(copy.root);
  return copy;
}
export function sectionSpaceCount(node: CmsSpaceNode): number {
  return 1 + (node.kind === "container" ? node.children.reduce((sum, child) => sum + sectionSpaceCount(child), 0) : 0);
}

export function addSectionContainer(doc: CmsSectionDocument, parentId: string, nextId = freshSectionId) {
  const copy = structuredClone(doc), parent = findSpace(copy.root, parentId);
  if (parent?.kind !== "container") throw Error("Selecciona un contenedor para añadir un hijo.");
  const child: CmsSpaceNode = {nodeId: nextId(), kind:"container",layout:"stack",presentation:{},children:[]};
  parent.children.push(child);
  assertSpaceBudget(copy.root);
  return {document:copy, nodeId:child.nodeId};
}
