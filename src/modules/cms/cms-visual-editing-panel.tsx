"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { uploadCmsBuilderMediaAction } from "./cms-admin-actions";
import { normalizeCmsVisualModuleProps, normalizeCmsVisualNode, type CmsBlock, type CmsPresentation, type CmsVisualNode, type CmsVisualNodeStyle } from "./cms-blocks";
import {
  assertVisualNodeHierarchy, canContainVisualNodes, remapVisualNodeIds, VisualNodeInspector, VisualNodeLibrary, VisualNodeTreeEditor, VisualContentValuesEditor,
  addVisualNodeToParent, createVisualBuilderNode, duplicateVisualNodeInBlock, findVisualNode,
  inferredVisualContentSchema, moveVisualNodeInBlock, moveVisualNodeOutInBlock, moveVisualNodeToParentInBlock,
  removeVisualNodeFromBlock, updateVisualNodeInBlock, visualNodeMoveTargets, canMoveVisualNodeOut,
  type CmsVisualStyleScope, type CmsBlockBuilderMediaUploadState, type CmsVisualMediaUploadTarget,
} from "./cms-visual-editor";

export function CmsVisualEditingPanel({ block, onChange, presentationOnly = false, initialNodeId, libraryHost, onBusyChange, hideDesign = false, sectionContainerOnly = false }: { block: CmsBlock; onChange: (block: CmsBlock) => void; sectionContainerOnly?: boolean; presentationOnly?: boolean; hideDesign?: boolean; initialNodeId?: string; libraryHost?: HTMLElement | null; onBusyChange?: (busy: boolean) => void }) {
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const latest = useRef({ block, onChange });
  useEffect(() => { latest.current = { block, onChange }; }, [block, onChange]);
  const props = normalizeCmsVisualModuleProps(block.props);
  const [nodeId, setNodeId] = useState(initialNodeId ?? props.tree.nodeId);
  const [scope, setScope] = useState<CmsVisualStyleScope>("base");
  const [imports, setImports] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [uploads, setUploads] = useState<CmsBlockBuilderMediaUploadState[]>([]);
  const busy = uploads.some(upload => upload.status === "uploading");
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const node = findVisualNode(props.tree, nodeId) ?? props.tree;
  const assets = props.assetRefs ?? [];
  function update(updater: (node: CmsVisualNode) => CmsVisualNode) { onChange(updateVisualNodeInBlock(block, node.nodeId, updater)); }
  function styles(styleScope: CmsVisualStyleScope, value: CmsVisualNodeStyle) {
    const clean = Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== ""));
    update(current => styleScope === "base" ? { ...current, styles: clean } : { ...current, responsiveStyles: { ...current.responsiveStyles, [styleScope]: clean } });
  }
  async function upload(target: CmsVisualMediaUploadTarget, file: File, requestedKey?: string) {
    const assetKey = requestedKey || `cms-${crypto.randomUUID()}`;
    setUploads(current => [...current.filter(item => item.assetKey !== assetKey), { assetKey, status: "uploading" }]);
    const data = new FormData(); data.set("file", file); data.set("assetKey", assetKey); data.set("alt", node.props?.alt ?? node.label ?? node.type);
    let result: Awaited<ReturnType<typeof uploadCmsBuilderMediaAction>>;
    try { result = await uploadCmsBuilderMediaAction(data); }
    catch { setUploads(current => [...current.filter(item => item.assetKey !== assetKey), { assetKey, status: "failed", message: "No se pudo completar la subida. Inténtalo de nuevo." }]); return; }
    if (!alive.current) return;
    if (!result.ok || !result.mediaAssetId) { setUploads(current => [...current.filter(item => item.assetKey !== assetKey), { assetKey, status: "failed", message: result.message }]); return; }
    const asset = { assetKey, mediaAssetId: result.mediaAssetId, role: target.role, src: result.publicUrl ?? result.previewUrl, alt: node.props?.alt ?? node.label ?? node.type };
    const currentBlock = latest.current.block;
    const currentProps = normalizeCmsVisualModuleProps(currentBlock.props);
    if (!findVisualNode(currentProps.tree, node.nodeId)) return;
    const withAsset = { ...currentBlock, props: { ...currentBlock.props, ...currentProps, assetRefs: [...(currentProps.assetRefs ?? []).filter(item => item.assetKey !== assetKey), asset] } };
    latest.current.onChange(updateVisualNodeInBlock(withAsset, node.nodeId, current => target.kind === "prop"
      ? { ...current, props: { ...current.props, [target.key]: `asset:${assetKey}` } }
      : scope === "base" ? { ...current, styles: { ...current.styles, [target.key]: `asset:${assetKey}` } }
        : { ...current, responsiveStyles: { ...current.responsiveStyles, [scope]: { ...current.responsiveStyles?.[scope], [target.key]: `asset:${assetKey}` } } }));
    setUploads(current => [...current.filter(item => item.assetKey !== assetKey), { assetKey, status: "uploaded", mediaAssetId: result.mediaAssetId, previewUrl: asset.src }]);
  }
  const reference = !presentationOnly && typeof block.props.definitionId === "string";
  if (reference && !block.props.tree && !Array.isArray(block.props.panels)) return <p role="status">La definición compartida no está disponible. Su referencia se conserva; ábrela desde el Builder para revisarla.</p>;
  if (reference) return <section>
    <p>Este módulo utiliza una definición compartida. El contenido se edita para esta instancia.</p>
    <VisualContentValuesEditor schema={props.contentSchema ?? {}} values={props.contentValues ?? {}} onChange={values => onChange({ ...block, props: { ...block.props, contentValues: values } })} />
    <button className="adminButton" type="button" onClick={() => { const next: Record<string, unknown> = { ...block.props, ...props }; delete next.definitionId; delete next.visualDefinitionReference; onChange({ ...block, props: next }); }}>Desvincular y editar una copia</button>
  </section>;
  return <fieldset disabled={uploads.some(upload => upload.status === "uploading")} className="cmsSharedVisualEditingPanel">
    {uploads.filter(upload => upload.status === "failed").map(upload => <p key={upload.assetKey} role="alert" className="adminBanner adminBannerError">{upload.message ?? "No se pudo completar la subida."}</p>)}
    {!presentationOnly ? <>
      {(() => { const library = <VisualNodeLibrary selectedBlock={block} selectedNode={node} onAddNode={type => { if (!canContainVisualNodes(node)) return; const child = createVisualBuilderNode(type); onChange(addVisualNodeToParent(block, node.nodeId, child)); setNodeId(child.nodeId); }} />; return libraryHost === undefined ? library : libraryHost ? createPortal(library, libraryHost) : null; })()}
      <VisualNodeTreeEditor tree={props.tree} selectedNodeId={node.nodeId} onSelectNode={setNodeId}
        onDuplicateNode={id => { const result = duplicateVisualNodeInBlock(block, id); onChange(result.block); if (result.copyId) setNodeId(result.copyId); }}
        onMoveNode={(id, direction) => onChange(moveVisualNodeInBlock(block, id, direction))}
        onRemoveNode={id => { onChange(removeVisualNodeFromBlock(block, id)); setNodeId(props.tree.nodeId); }} />
    </> : null}
    <VisualNodeInspector sectionContainerOnly={sectionContainerOnly} contentBindingEditor={<>
      <small>La clave vincula este nodo con un único campo. Para contenidos independientes usa claves distintas; repetir una clave comparte su valor.</small>
      <button className="adminButton" type="button" disabled={!node.contentBinding?.trim()} onClick={() => onChange({ ...block, props: { ...block.props, contentSchema: inferredVisualContentSchema(node, props.contentSchema ?? {}) } })}>Actualizar campo de contenido</button>
      {node.contentBinding && props.contentSchema?.[node.contentBinding] ? <VisualContentValuesEditor
        schema={{ [node.contentBinding]: props.contentSchema[node.contentBinding] }}
        values={props.contentValues ?? {}}
        onChange={values => onChange({ ...block, props: { ...block.props, contentValues: values } })} /> : null}
    </>} hideDesign={hideDesign} presentationOnly={presentationOnly} node={node} assetRefs={assets} mediaUploads={uploads} styleScope={scope} onStyleScopeChange={setScope}
      canMoveOut={canMoveVisualNodeOut(props.tree, node.nodeId)} moveTargets={visualNodeMoveTargets(props.tree, node.nodeId)}
      onMoveOut={() => onChange(moveVisualNodeOutInBlock(block, node.nodeId))} onMoveToParent={id => onChange(moveVisualNodeToParentInBlock(block, node.nodeId, id))}
      onLabelChange={label => update(current => ({ ...current, label }))}
      onContentBindingChange={contentBinding => update(current => ({ ...current, contentBinding }))}
      onVisibilityChange={(device, visible) => update(current => ({ ...current, visibility: { ...current.visibility, [device]: visible } }))}
      onPropChange={(key, value) => update(current => ({ ...current, props: { ...current.props, [key]: value } }))}
      onStyleChange={(key, value) => styles("base", { ...node.styles, [key]: value })}
      onResponsiveStyleChange={(device, key, value) => styles(device, { ...node.responsiveStyles?.[device], [key]: value })}
      onReplaceStyleScope={styles}
      onAnimationChange={(key, value) => update(current => ({ ...current, animation: { preset: "fadeIn", ...current.animation, [key]: key === "durationMs" || key === "delayMs" ? Math.max(0, Math.min(2000, Number(value) || 0)) : value } as CmsVisualNode["animation"] }))}
      onHoverStylesChange={value => update(current => ({ ...current, interactions: { ...current.interactions, hover: { ...current.interactions?.hover, styles: value } } }))}
      onHoverTransitionChange={(key, value) => update(current => ({ ...current, interactions: { hover: { ...current.interactions?.hover, transition: { ...current.interactions?.hover?.transition, [key]: key === "easing" ? value : Math.max(0, Math.min(2000, Number(value) || 0)) } } } }))}
      onClearHover={() => update(current => ({ ...current, interactions: undefined }))}
      onMediaUpload={upload} onMediaRemove={(target, key) => {
        const next = updateVisualNodeInBlock(block, node.nodeId, current => target.kind === "prop"
          ? { ...current, props: { ...current.props, [target.key]: "" } }
          : scope === "base" ? { ...current, styles: Object.fromEntries(Object.entries(current.styles ?? {}).filter(([field]) => field !== target.key)) }
            : { ...current, responsiveStyles: { ...current.responsiveStyles, [scope]: Object.fromEntries(Object.entries(current.responsiveStyles?.[scope] ?? {}).filter(([field]) => field !== target.key)) } });
        onChange({ ...next, props: { ...next.props, assetRefs: assets.filter(asset => asset.assetKey !== key) } });
      }}
      visualImportDraft={imports} visualPortabilityMessage={message} onVisualImportDraftChange={setImports}
      onCopySelectedVisualNodeJson={() => navigator.clipboard.writeText(JSON.stringify(node, null, 2))}
      onCopyVisualTreeJson={() => navigator.clipboard.writeText(JSON.stringify(props.tree, null, 2))}
      onLoadSelectedVisualNodeIntoImport={() => setImports(JSON.stringify(node, null, 2))}
      onLoadVisualTreeIntoImport={() => setImports(JSON.stringify(props.tree, null, 2))}
      onApplyVisualImportAsChild={() => { if (!canContainVisualNodes(node)) { setMessage("Selecciona un nodo estructural para importar hijos."); return; } try { const imported = remapVisualNodeIds(normalizeCmsVisualNode(JSON.parse(imports))); assertVisualNodeHierarchy(imported); onChange(addVisualNodeToParent(block, node.nodeId, imported)); } catch (error) { setMessage(error instanceof Error ? error.message : "JSON no válido."); } }}
      onReplaceSelectedVisualNodeFromImport={() => { try { const replacement = remapVisualNodeIds(normalizeCmsVisualNode(JSON.parse(imports))); assertVisualNodeHierarchy(replacement); update(() => replacement); setNodeId(replacement.nodeId); } catch (error) { setMessage(error instanceof Error ? error.message : "JSON no válido."); } }} />

  </fieldset>;
}

export function CmsPresentationEditor({ value = {}, onChange, onBusyChange, sectionContainerOnly = false }: { sectionContainerOnly?: boolean; value?: CmsPresentation; onChange: (value: CmsPresentation) => void; onBusyChange?: (busy: boolean) => void }) {
  const { base, ...responsive } = value.styles ?? {};
  const block: CmsBlock = { blockId: "presentation", type: "visual.module", props: { schemaVersion: 1, assetRefs: value.assetRefs,
    tree: { nodeId: "root", type: "container", styles: base, responsiveStyles: responsive, visibility: value.visibility, animation: value.animation, interactions: value.interactions } } };
  return <CmsVisualEditingPanel block={block} sectionContainerOnly={sectionContainerOnly} presentationOnly onBusyChange={onBusyChange} onChange={next => {
    const props = normalizeCmsVisualModuleProps(next.props), tree = props.tree;
    onChange({ styles: { base: tree.styles ?? {}, ...tree.responsiveStyles }, visibility: tree.visibility, animation: tree.animation, interactions: tree.interactions, assetRefs: props.assetRefs });
  }} />;
}
