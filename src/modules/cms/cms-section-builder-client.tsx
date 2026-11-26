"use client";
import {CmsDesignSettingsEditor,useCmsDesignDefaults} from './cms-design-settings-editor';
import { CmsSaveTemplateClient } from "./cms-save-template-client";
import type { CmsTemplateReceipt } from "./cms-composition-template-types";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./cms-module-builder.module.css";
import {
  CmsPresentationEditor,
} from "./cms-visual-editing-panel";
import { CmsBlockStyleSheetEditor } from "./cms-block-style-sheet-editor";
import { CmsSectionTreeEditor } from "./cms-section-tree-editor";
import { CmsModuleInstanceFields } from "./cms-module-instance-fields";
import { CmsSectionPreview } from "./cms-section-preview";
import { sectionAreaReferences } from "./cms-section-area-reference";
import type {
  CmsIndependentModule,
  CmsModuleList,
} from "./cms-independent-module-types";
import type {
  CmsSectionCommand,
  CmsSectionContext,
  CmsSectionDocument,
  CmsSectionList,
  CmsSectionReceipt,
  CmsSpaceNode,
} from "./cms-independent-section-types";
import {
  saveIndependentSectionAction,
  loadSectionModulesAction,
} from "./cms-independent-section-actions";
import {
  assertSpaceBudget,
  findSpace,
  freshSectionId,
  remapSection,
} from "./cms-section-tree";
import { remapIndependentModule } from "./cms-independent-module-comparison";

type Attempt = {
  operation: "create" | "update";
  id?: string;
  body: CmsSectionCommand;
};
const blank = (): CmsSectionDocument => ({
  sectionId: freshSectionId(),
  name: "Nueva sección",
  root: {
    nodeId: freshSectionId(),
    kind: "container",
    layout: "stack",
    presentation: {},
    children: [],
  },
});
export function CmsSectionBuilderClient({
  initialList,
  initialReceipt,
  initialModules,
  initialDocument,
  templateReceipt,
  embedded,
  inheritedDesign,
  context,
  canWrite,
  unavailable,
}: {
  inheritedDesign?: import('../../../packages/cms-blocks/src/design-settings').CmsResolvedDesign;
  initialList: CmsSectionList;
  initialReceipt: CmsSectionReceipt | null;
  initialModules: CmsModuleList;
  initialDocument?: CmsSectionDocument;
  templateReceipt?: CmsTemplateReceipt;
  embedded?: {onChange:(document:CmsSectionDocument)=>void; disabled?:boolean;onReadyChange?:(ready:boolean)=>void;onPendingChange?:(pending:boolean)=>void};
  context: CmsSectionContext;
  canWrite: boolean;
  unavailable?: string;
}) {
  const globalDesign=useCmsDesignDefaults(context,inheritedDesign===undefined);
  const designDefaults={...globalDesign,values:inheritedDesign??globalDesign.values};
  const [items, setItems] = useState(initialList.items),
    [receipt, setReceipt] = useState(initialReceipt),
    [document, setDocument] = useState<CmsSectionDocument | null>(
      initialReceipt?.document ?? initialDocument ?? null,
    ),
    [view, setView] = useState<"library" | "design">(
      initialReceipt || initialDocument ? "design" : "library",
    );
  const [selected, setSelected] = useState(
      (initialReceipt?.document ?? initialDocument)?.root.nodeId ?? "",
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [modulesLoading, setModulesLoading] = useState(Boolean(embedded && initialModules.total===0)),
    [modulesMessage, setModulesMessage] = useState(""),
    [mediaBusy, setMediaBusy] = useState(false),
    [ambiguous, setAmbiguous] = useState(false),
    [rawDirty, setRawDirty] = useState(false);
  const [moduleDraft, setModuleDraft] = useState<CmsIndependentModule | null>(
      null,
    ),
    [modules, setModules] = useState(initialModules),
    [moduleId, setModuleId] = useState(""),
    [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">(
      "desktop",
    );
  const form = useRef<HTMLFormElement>(null),
    attempt = useRef<Attempt | null>(null);
  const [stylesExpandedFor,setStylesExpandedFor] = useState<string|null>(null);
  const [templatePending,setTemplatePending]=useState(false);
  const [templateBaseline,setTemplateBaseline]=useState(templateReceipt?.document.content.value);
  const dirty =
    !!document &&
    (rawDirty ||
      !!moduleDraft ||
      JSON.stringify(document) !== JSON.stringify(templateReceipt ? templateBaseline : receipt?.document));
  const embeddedMode=Boolean(embedded);
  const contextOrganizationId=context.organizationId,contextShopId=context.shopId,contextLocale=context.locale;
  useEffect(()=>{
    if(!embeddedMode || initialModules.total>0)return;
    let active=true;
    loadSectionModulesAction({organizationId:contextOrganizationId,shopId:contextShopId,locale:contextLocale},0).then(result=>{
      if(!active)return;
      if(result.ok)setModules(result.data);else setModulesMessage(result.message);
    }).catch(()=>{if(active)setModulesMessage("No se pudieron cargar los módulos. Puedes reintentar con los controles de biblioteca.");}).finally(()=>{if(active)setModulesLoading(false);});
    return()=>{active=false;};
  },[embeddedMode,initialModules.total,contextOrganizationId,contextShopId,contextLocale]);
  const onEmbeddedReady=embedded?.onReadyChange;
  const onEmbeddedPending=embedded?.onPendingChange;
  useEffect(()=>{onEmbeddedPending?.(rawDirty||!!moduleDraft||mediaBusy);},[rawDirty,moduleDraft,mediaBusy,onEmbeddedPending]);
  const onEmbeddedChange=embedded?.onChange;
  useEffect(()=>{onEmbeddedReady?.(!moduleDraft&&!mediaBusy);},[moduleDraft,mediaBusy,onEmbeddedReady]);
  useEffect(()=>{if(document) onEmbeddedChange?.(document);},[document,onEmbeddedChange]);
  const editable = canWrite && !embedded?.disabled && !templatePending && !unavailable && templateReceipt?.status !== "ARCHIVED" && !busy && !ambiguous && !mediaBusy;
  useEffect(() => {
    if (embeddedMode || (!dirty && !mediaBusy && !ambiguous)) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const click = (e: MouseEvent) => {
      if (
        (e.target as Element).closest?.("a[href]") &&
        !(e.target as Element).closest?.("[data-admin-section-preview]") &&
        !window.confirm("Hay cambios sin guardar. ¿Quieres salir?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    window.document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.document.removeEventListener("click", click, true);
    };
  }, [dirty, mediaBusy, ambiguous, embeddedMode]);
  const leave = () =>
    !mediaBusy &&
    !busy &&
    !ambiguous &&
    (!dirty ||
      window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos?"));
  const invalid = () =>
    !!form.current?.querySelector(
      '[aria-invalid="true"],[data-cms-editor-error="true"]',
    ) || !form.current?.reportValidity();
  function open(next: CmsSectionDocument, saved: CmsSectionReceipt | null) {
    if (!leave()) return;
    setDocument(next);
    setReceipt(saved);
    setSelected(next.root.nodeId);
    setModuleDraft(null);
    setRawDirty(false);
    setView("design");
    setMessage("");
    attempt.current = null;
  }
  function change(next: CmsSectionDocument) {
    try {
      assertSpaceBudget(next.root);
      setDocument(next);
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function updateNode(next: CmsSpaceNode) {
    if (!document) return;
    const copy = structuredClone(document);
    const old = findSpace(copy.root, next.nodeId);
    if (!old) return;
    Object.assign(old, next);
    change(copy);
  }
  const node = document ? findSpace(document.root, selected) : undefined;
  const choose = (id: string) => {
    if (mediaBusy || moduleDraft || invalid()) {
      setMessage(
        "Aplica o cancela la edición actual antes de cambiar de nodo.",
      );
      return;
    }
    setSelected(id);
    setStylesExpandedFor(id);
  };
  async function save() {
    if (!document || !canWrite || busy || mediaBusy || moduleDraft) return;
    if (!ambiguous && invalid()) {
      setMessage("Corrige los campos o CSS inválidos.");
      return;
    }
    if (!ambiguous)
      attempt.current = {
        operation: receipt ? "update" : "create",
        id: receipt?.resourceId,
        body: {
          contractVersion: 1,
          resourceKind: "SECTION",
          document: structuredClone(document),
          ...(receipt
            ? { expectedRevision: receipt.revisionToken }
            : { operationId: crypto.randomUUID() }),
        },
      };
    const current = attempt.current;
    if (!current) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await saveIndependentSectionAction(
        current.operation,
        current.id,
        current.body,
        context,
      );
      if (!result.ok) {
        const uncertain =
          !result.status || result.status >= 500 || result.status === 408;
        setAmbiguous(uncertain);
        setMessage(
          result.status === 409
            ? "La sección ha cambiado. Tus cambios siguen aquí; vuelve a abrirla para recuperar la revisión actual."
            : result.message,
        );
        if (!uncertain) attempt.current = null;
        return;
      }
      setReceipt(result.receipt);
      setDocument(result.receipt.document);
      setSelected(result.receipt.document.root.nodeId);
      setItems((old) => [
        result.receipt,
        ...old.filter((x) => x.resourceId !== result.receipt.resourceId),
      ]);
      setRawDirty(false);
      setAmbiguous(false);
      attempt.current = null;
      setMessage(result.readReady ? "Sección guardada." : "Guardado confirmado. La biblioteca sigue sincronizando esta revisión; conserva el editor abierto antes de reabrir.");
      window.history.replaceState(
        null,
        "",
        `/admin/cms/secciones?id=${encodeURIComponent(result.receipt.resourceId)}`,
      );
    } catch {
      setAmbiguous(true);
      setMessage(
        "No se pudo confirmar el guardado. Reintenta la misma operación.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function modulePage(offset: number) {
    if (modulesLoading) return;
    setModulesLoading(true);
    setModulesMessage("");
    try {
      const result = await loadSectionModulesAction(context, offset);
      if (result.ok) {
        setModules(result.data);
        setModuleId("");
      } else setModulesMessage(result.message);
    } catch {
      setModulesMessage("No se pudieron cargar los módulos. Puedes reintentar; tu borrador se conserva.");
    } finally {
      setModulesLoading(false);
    }
  }
  const Root = embedded ? "div" : "main";
  return (
    <Root className={embedded ? "cmsEmbeddedSectionEditor" : "adminPage cmsAdminPage"}>
      {!embedded ? <div className="adminBreadcrumb">Admin / CMS / {templateReceipt ? "Plantillas / Sección" : "Secciones"}</div> : null}
      {!embedded ? <p>Idioma: {context.locale}</p> : null}
      <div className="adminTabsToolbar" style={templateReceipt || embedded ? {display:"none"} : undefined}>
      <nav className={`adminTabs ${styles.builderTabs}`} aria-label="Secciones">
        <button
          className={`adminTab ${view === "library" ? "adminTabActive" : ""}`}
          type="button"
          aria-current={view === "library" ? "page" : undefined}
          onClick={() => {
            if (leave()) {
              setView("library");
              setModuleDraft(null);
              setRawDirty(false);
              setDocument(receipt?.document ?? null);
            }
          }}
        >
          Biblioteca
        </button>
        <button
          className={`adminTab ${view === "design" ? "adminTabActive" : ""}`}
          type="button"
          aria-current={view === "design" ? "page" : undefined}
          disabled={!document}
          onClick={() => setView("design")}
        >
          Diseño
        </button>
      </nav>
      {view === "library" && canWrite ? (
        <button
          className="employeesTextAction"
          type="button"
          disabled={!!unavailable}
          onClick={() => open(blank(), null)}
        >
          Crear sección
        </button>
      ) : null}
      </div>
      {unavailable ? (
        <p role="alert" className="adminBanner adminBannerError">
          {unavailable}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="adminBanner">
          {message}
        </p>
      ) : null}
      {view === "library" ? (
        <>
          <section
            className={`productListPage productListGrid ${styles.library}`}
            aria-label="Biblioteca de secciones"
          >
            <div className="adminTableScroller productListTableScroller">
              <table className="adminTable productListTable">
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Idioma</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.resourceId}>
                      <td className="productListNameCell">
                        <Link
                          href={`/admin/cms/secciones?id=${encodeURIComponent(item.resourceId)}`}
                          onClick={event=>{if(receipt?.resourceId===item.resourceId){event.preventDefault();open(item.document,item);}}}
                        >
                          {item.document.name}
                        </Link>
                      </td>
                      <td>{item.context.locale}</td>
                      <td>
                        <div className="productListActions">
                          {canWrite ? (
                            <button
                              type="button"
                              className="adminButton"
                              onClick={() =>
                                open(
                                  {
                                    ...remapSection(item.document),
                                    name: `${item.document.name} (copia)`,
                                  },
                                  null,
                                )
                              }
                            >
                              Duplicar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length ? <p>No hay secciones disponibles.</p> : null}
            </div>
            <div className="adminButtonRow">
              {initialList.offset > 0 ? (
                <Link
                  className="adminButton"
                  href={`/admin/cms/secciones?offset=${Math.max(0, initialList.offset - initialList.limit)}`}
                >
                  Anterior
                </Link>
              ) : null}
              {initialList.offset + initialList.limit < initialList.total ? (
                <Link
                  className="adminButton"
                  href={`/admin/cms/secciones?offset=${initialList.offset + initialList.limit}`}
                >
                  Siguiente
                </Link>
              ) : null}
            </div>
          </section>
        </>
      ) : document ? (
        <div className={styles.workspace}>
          <form
            ref={form}
            aria-busy={busy || templatePending || mediaBusy}
            className={styles.fields}
            onChange={() => setRawDirty(true)}
            onSubmit={(event) => {
              event.preventDefault();
              if (!embedded) void save();
            }}
          >
            <fieldset disabled={!editable} className={styles.sectionEditorFieldset}>
              {designDefaults.message?<p role="status">{designDefaults.message}</p>:null}
              <CmsDesignSettingsEditor value={document.designSettings} inherited={designDefaults.values} onChange={designSettings=>change({...document,designSettings})} disabled={!editable}/>
              <section className={styles.sectionBox} aria-label="Composición de sección">
              <label className="adminField">
                <span>Nombre de sección</span>
                <input
                  required
                  maxLength={256}
                  value={document.name}
                  onChange={(e) =>
                    change({ ...document, name: e.target.value })
                  }
                />
              </label>
              <section className={styles.sectionTreePanel} aria-label="Árbol de sección">
                <h2>Espacios y módulos</h2>
                <CmsSectionTreeEditor document={document} selected={selected}
                  disabled={!editable || !!moduleDraft} onSelect={choose} onChange={change} onMessage={setMessage} />
              </section>
              {node?.kind === "container" ? (
                <section key={node.nodeId}>
                  <h2>Contenedor</h2>
                  <div className={styles.containerControls}>
                  <div className={styles.containerActionRow}>
                  <label className="adminField">
                    <span>Distribución</span>
                    <select
                      aria-label="Distribución"
                      value={node.layout}
                      onChange={(e) =>
                        updateNode({
                          ...node,
                          layout: e.target.value as "stack" | "flex" | "grid",
                        })
                      }
                    >
                      <option value="stack">Vertical</option>
                      <option value="flex">Horizontal</option>
                      <option value="grid">Cuadrícula</option>
                    </select>
                  </label>
                  <button
                    className="adminButton adminButtonPrimary"
                    type="button"
                    onClick={() =>
                      updateNode({
                        ...node,
                        children: [
                          ...node.children,
                          {
                            nodeId: freshSectionId(),
                            kind: "container",
                            layout: "stack",
                            presentation: {},
                            children: [],
                          },
                        ],
                      })
                    }
                  >
                    Añadir contenedor
                  </button>
                  </div>
                  <div className={styles.containerActionRow}>
                  <label className="adminField">
                    <span>Módulo de biblioteca</span>
                    <select
                      disabled={modulesLoading}
                      aria-busy={modulesLoading}
                      aria-label="Módulo de biblioteca"
                      value={moduleId}
                      onChange={(e) => setModuleId(e.target.value)}
                    >
                      <option value="">Seleccionar módulo</option>
                      {modules.items.map((m) => (
                        <option key={m.resourceId} value={m.resourceId}>
                          {m.document.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="adminButton adminButtonPrimary"
                    type="button"
                    disabled={modulesLoading || !moduleId}
                    onClick={() => {
                      const source = modules.items.find(
                        (m) => m.resourceId === moduleId,
                      );
                      if (source)
                        updateNode({
                          ...node,
                          children: [
                            ...node.children,
                            {
                              nodeId: freshSectionId(),
                              kind: "module",
                              module: remapIndependentModule(
                                source.document,
                                freshSectionId,
                              ),
                            },
                          ],
                        });
                    }}
                  >
                    Insertar copia
                  </button>
                  </div>
                  </div>
                  <div className="adminButtonRow">
                    <button
                      className="adminButton"
                      type="button"
                      disabled={modulesLoading || !modules.offset}
                      onClick={() =>
                        void modulePage(
                          Math.max(0, modules.offset - modules.limit),
                        )
                      }
                    >
                      Módulos anteriores
                    </button>
                    <button
                      className="adminButton"
                      type="button"
                      disabled={modulesLoading || modules.offset + modules.limit >= modules.total}
                      onClick={() =>
                        void modulePage(modules.offset + modules.limit)
                      }
                    >
                      Más módulos
                    </button>
                  </div>
                  {modulesLoading ? <p role="status">Cargando módulos…</p> : null}
                  {modulesMessage ? <div><p role="alert">{modulesMessage}</p><button className="adminButton" type="button" disabled={modulesLoading} onClick={()=>void modulePage(modules.offset)}>Reintentar carga de módulos</button></div> : null}

                </section>
              ) : node?.kind === "module" ? (
                <section>
                  <h2>{node.module.name}</h2>
                  {!moduleDraft ? (
                    <button
                      className="adminButton"
                      type="button"
                      onClick={() =>
                        setModuleDraft(structuredClone(node.module))
                      }
                    >
                      Editar copia del módulo
                    </button>
                  ) : (
                    <section key={node.nodeId}>
                      <CmsModuleInstanceFields
                        module={moduleDraft}
                        onChange={setModuleDraft}
                        onBusyChange={setMediaBusy}
                      />
                      <div className="adminButtonRow">
                        <button
                          className="adminButton adminButtonPrimary"
                          type="button"
                          onClick={() => {
                            if (invalid()) return;
                            updateNode({ ...node, module: moduleDraft });
                            setModuleDraft(null);
                            setMessage("Cambios aplicados a la sección. Pendientes de guardar.");
                          }}
                        >
                          Aplicar a la sección
                        </button>
                        <button
                          className="adminButton"
                          type="button"
                          onClick={() => {
                            if (invalid()) return;
                            updateNode({ ...node, module: moduleDraft });
                            setMessage("Cambios aplicados a la sección. Puedes seguir editando; están pendientes de guardar.");
                          }}
                        >
                          Aplicar y seguir editando
                        </button>
                        <button
                          className="adminButton"
                          type="button"
                          onClick={() => setModuleDraft(null)}
                        >
                          Cancelar edición del módulo
                        </button>
                      </div>
                    </section>
                  )}
                </section>
              ) : null}
              </section>
              {node?.kind === "container" ? (
                  <details key={node.nodeId} open={stylesExpandedFor === node.nodeId} onToggle={event=>{const opened=event.currentTarget.open;setStylesExpandedFor(current=>opened?node.nodeId:current===node.nodeId?null:current);}} className={`${styles.sectionBox} ${styles.containerStyleDetails}`}>
                    <summary>Estilos del contenedor</summary>
                  <CmsPresentationEditor
                    sectionContainerOnly
                    value={node.presentation}
                    onBusyChange={setMediaBusy}
                    onChange={(presentation) =>
                      updateNode({ ...node, presentation })
                    }
                  />
                  </details>
              ) : null}
              {!moduleDraft ? (
                <section className={`${styles.sectionBox} ${styles.sectionCssBox}`} aria-label="CSS de la sección">
                  <p>
                    El CSS de sección solo selecciona contenedores y envoltorios
                    de módulos. Usa :scope para la sección completa.
                  </p>
                  <CmsBlockStyleSheetEditor
                    key={document.sectionId}
                    resource="sección"
                    selection={sectionAreaReferences(document.root).find(area=>area.nodeId===selected)}
                    value={document.styleSheet}
                    onChange={(styleSheet) =>
                      change({ ...document, styleSheet })
                    }
                  />
                </section>
              ) : null}
            </fieldset>
          </form>
          <section
            className={styles.preview}
            aria-label="Vista previa de sección"
          >
            <div className="adminButtonRow">
              {(["desktop", "tablet", "mobile"] as const).map((v) => (
                <button
                  className={viewport === v ? "adminTab adminTabActive" : "adminTab"}
                  key={v}
                  aria-pressed={viewport === v}
                  onClick={() => setViewport(v)}
                >
                  {v === "desktop"
                    ? "Escritorio"
                    : v === "tablet"
                      ? "Tableta"
                      : "Móvil"}
                </button>
              ))}
            </div>
            <CmsSectionPreview document={document} inheritedDesign={designDefaults.values} viewport={viewport} selected={selected}
              disabled={!!moduleDraft || busy || mediaBusy || ambiguous} onSelect={choose} />
          </section>
          <div className={styles.actions}>
            {receipt && dirty && !embedded && !busy && !mediaBusy ? <button className="adminButton" type="button" onClick={()=>{
              setDocument(structuredClone(receipt.document));setSelected(receipt.document.root.nodeId);setModuleDraft(null);setRawDirty(false);setMessage("Cambios sin guardar descartados. La sección guardada se conserva.");
            }}>Descartar cambios sin guardar</button> : null}
            {busy ? <p role="status">Guardando sección…</p> : mediaBusy ? <p role="status">Subiendo archivo…</p> : null}
            {canWrite && document && !embedded ? <CmsSaveTemplateClient content={{kind:"SECTION",value:document}} context={context} initialReceipt={templateReceipt} onPendingChange={setTemplatePending} validate={()=>!invalid()} onSaved={templateReceipt ? saved=>{if(saved.document.content.kind==="SECTION"){setDocument(saved.document.content.value);setTemplateBaseline(saved.document.content.value);setRawDirty(false);}} : undefined} disabled={!editable || !!moduleDraft} /> : null}
            {canWrite && !templateReceipt && !embedded ? (
              <button
                className="adminButton adminButtonPrimary"
                disabled={busy || mediaBusy || !!moduleDraft}
                onClick={() => void save()}
              >
                {busy
                  ? "Guardando…"
                  : ambiguous
                    ? "Reintentar el mismo guardado"
                    : "Guardar"}
              </button>
            ) : null}
            {receipt ? (
              <a
                className="adminButton"
                href={`/admin/cms/secciones?id=${encodeURIComponent(receipt.resourceId)}`}
              >
                Reabrir sección
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </Root>
  );
}
