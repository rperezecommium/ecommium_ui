"use client";
import dynamic from "next/dynamic";
import {CmsCategoryTilesEditor} from "./cms-category-tiles-editor";
const SliderFields=dynamic(()=>import("./cms-block-editor-client").then(module=>module.SliderFields));
import {CmsDesignSettingsEditor,useCmsDesignDefaults} from './cms-design-settings-editor';
import {renderCmsShellModulePreview} from "./cms-shell-module-preview";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./cms-module-builder.module.css";
import {
  CmsVisualEditingPanel,
  CmsPresentationEditor,
} from "./cms-visual-editing-panel";
import { CmsBlockStyleSheetEditor } from "./cms-block-style-sheet-editor";
import { CmsIndependentModuleView } from "../../../packages/cms-blocks/src/react";
import {
  getCmsBlockDefinition,
  getCmsBlockDefinitions,
  migrateCmsVisualModuleV1ToV2ForRenderer,
  type CmsBlock,
  type CmsBlockEditorField,
  type CmsPresentation,
} from "./cms-blocks";
import {
  checkpointHistory,
  undoHistory,
  redoHistory,
  type CmsEditorHistory,
} from "./cms-editor-history";
import { saveIndependentModuleAction } from "./cms-independent-module-actions";
import type {
  CmsIndependentModule,
  CmsModuleCommand,
  CmsModuleList,
  CmsModuleReceipt,
} from "./cms-independent-module-types";
import schema from "../../../docs/contracts/cms-composition-boundary.schema.json";
import { cmsShellModuleDefinitions, cmsShellModuleDefinition } from "./cms-shell-modules";
const definitionFor = (type:string) => cmsShellModuleDefinition(type) ?? getCmsBlockDefinition(type);
const registered = schema.definitions.module.properties.body.oneOf.slice(1);
const allowed = (type: string) =>
  Object.keys(
    registered.find(
      (item) =>
        "type" in item.properties && item.properties.type?.const === type,
    )?.properties.props?.properties ?? {},
  );
const types = [...getCmsBlockDefinitions(), ...cmsShellModuleDefinitions].filter(
  (item) => allowed(item.type).length > 0,
);
function blank(type: string): CmsIndependentModule {
  const instanceId = `cms-${crypto.randomUUID()}`;
  if (type === "visual.module")
    return {
      instanceId,
      name: "Nuevo módulo",
      body: {
        kind: "visual",
        value: {
          schemaVersion: 2,
          moduleId: `cms-${crypto.randomUUID()}`,
          type: "container",
          panels: [{ panelId: `cms-${crypto.randomUUID()}`, elements: [] }],
          contentSchema: {},
        },
      },
    };
  const preset = definitionFor(type)!.create();
  const keys = allowed(type);
  return {
    instanceId,
    name: definitionFor(type)!.label,
    body: {
      kind: "registered",
      type,
      props: Object.fromEntries(
        Object.entries(preset.props).filter(([key]) => keys.includes(key)),
      ),
    },
  };
}
type Attempt = {
  operation: "create" | "update" | "archive";
  id?: string;
  body: CmsModuleCommand;
};
export function CmsModuleBuilderClient({
  initialList,
  initialReceipt,
  canWrite,
  context,
  unavailable,
  listStatus = "DRAFT",
}: {
  initialList: CmsModuleList;
  initialReceipt: CmsModuleReceipt | null;
  canWrite: boolean;
  context: { organizationId: string; shopId: string };
  unavailable?: string;
  listStatus?: "DRAFT" | "ARCHIVED";
}) {
  const designDefaults=useCmsDesignDefaults(context);
  const [items, setItems] = useState(initialList.items),
    [receipt, setReceipt] = useState(initialReceipt),
    [document, setDocument] = useState<CmsIndependentModule | null>(
      initialReceipt?.document ?? null,
    );
  const [view, setView] = useState<"library" | "design">(
      initialReceipt ? "design" : "library",
    ),
    [type, setType] = useState("visual.module");
  const [history, setHistory] = useState<
    CmsEditorHistory<CmsIndependentModule>
  >({ past: [], future: [] });
  const [busy, setBusy] = useState(false),
    [mediaBusy, setMediaBusy] = useState(false),
    [message, setMessage] = useState(""),
    [rawDirty, setRawDirty] = useState(false),
    [ambiguous, setAmbiguous] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const attempt = useRef<Attempt | null>(null),
    form = useRef<HTMLFormElement>(null);
  const dirty =
    !!document &&
    (rawDirty ||
      JSON.stringify(document) !== JSON.stringify(receipt?.document));
  const editable =
    canWrite && receipt?.status !== "ARCHIVED" && !busy && !ambiguous;
  useEffect(() => {
    if (!dirty && !mediaBusy && !ambiguous) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.("a[href]");
      if (
        anchor &&
        !window.confirm("Hay cambios sin guardar. ¿Quieres salir?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    window.document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.document.removeEventListener("click", click, true);
    };
  }, [dirty, mediaBusy, ambiguous]);
  function leave() {
    return (
      !mediaBusy &&
      !ambiguous &&
      (!dirty || window.confirm("Descartar los cambios sin guardar?"))
    );
  }
  function open(
    item: CmsModuleReceipt | null,
    next: CmsIndependentModule | null,
  ) {
    if (!leave()) return;
    setReceipt(item);
    setDocument(next);
    setHistory({ past: [], future: [] });
    setRawDirty(false);
    setMessage("");
    attempt.current = null;
    setView("design");
  }
  function change(next: CmsIndependentModule) {
    if (!document) return;
    setHistory((current) => checkpointHistory(current, document, 50));
    setDocument(next);
    attempt.current = null;
  }
  function travel(direction: "undo" | "redo") {
    if (!document) return;
    if (form.current?.querySelector('[data-cms-editor-error="true"]')) {
      setMessage("Corrige el JSON o CSS pendiente antes de deshacer.");
      return;
    }
    const next = (direction === "undo" ? undoHistory : redoHistory)(
      history,
      document,
      50,
    );
    if (next) {
      setDocument(next.value);
      setHistory(next.history);
      setEditorEpoch((value) => value + 1);
      setRawDirty(false);
      attempt.current = null;
    }
  }
  async function save(archive = false) {
    if (!document || busy || mediaBusy || !canWrite) return;
    if (
      !ambiguous &&
      (form.current?.querySelector('[data-cms-editor-error="true"]') ||
        !form.current?.reportValidity())
    ) {
      setMessage("Corrige los campos, JSON o CSS antes de guardar.");
      return;
    }
    if (
      archive &&
      !window.confirm(
        `¿Archivar «${document.name}»? Las copias existentes se conservarán.`,
      )
    )
      return;
    const request =
      attempt.current ??
      ({
        operation: archive ? "archive" : receipt ? "update" : "create",
        id: receipt?.resourceId,
        body: receipt
          ? {
              contractVersion: 1,
              resourceKind: "MODULE",
              expectedRevision: receipt.revisionToken,
              ...(archive ? {} : { document }),
            }
          : {
              contractVersion: 1,
              resourceKind: "MODULE",
              operationId: crypto.randomUUID(),
              document,
            },
      } as Attempt);
    attempt.current = request;
    setBusy(true);
    setMessage("");
    try {
      const result = await saveIndependentModuleAction(
        request.operation,
        request.id,
        request.body,
        context,
      );
      if (!result.ok) {
        const uncertain = result.status === undefined || result.status >= 500;
        setAmbiguous(uncertain);
        if (!uncertain) attempt.current = null;
        setMessage(
          result.status === 409
            ? "El módulo ha cambiado. Tus cambios siguen aquí; vuelve a abrirlo para revisar el conflicto."
            : uncertain
              ? "No se pudo confirmar el resultado. Reintenta la misma operación antes de seguir editando."
              : result.message,
        );
        return;
      }
      setReceipt(result.receipt);
      setDocument(result.receipt.document);
      setItems((current) => [
        result.receipt,
        ...current.filter(
          (item) => item.resourceId !== result.receipt.resourceId,
        ),
      ]);
      setHistory({ past: [], future: [] });
      setRawDirty(false);
      setAmbiguous(false);
      attempt.current = null;
      setMessage(
        !result.readReady
          ? "Guardado confirmado. La biblioteca sigue sincronizando esta revisión; conserva el editor abierto antes de reabrir."
          : request.operation === "archive"
          ? "Módulo archivado."
          : "Módulo guardado.",
      );
      window.history.replaceState(
        null,
        "",
        `/admin/cms/modulos?id=${encodeURIComponent(result.receipt.resourceId)}`,
      );
    } catch {
      setAmbiguous(true);
      setMessage("Resultado sin confirmar. Reintenta la misma operación.");
    } finally {
      setBusy(false);
    }
  }
  const block: CmsBlock | null =
    document?.body.kind === "visual"
      ? {
          blockId: document.instanceId,
          type: "visual.module",
          props: document.body.value as unknown as Record<string, unknown>,
        }
      : null;
  return (
    <main className="adminPage cmsAdminPage">
      <div className="adminBreadcrumb">Admin / CMS / Módulos</div>
      <nav className={`adminTabs ${styles.builderTabs}`} aria-label="Módulos">
        <button
          className={`adminTab ${view === "library" ? "adminTabActive" : ""}`}
          type="button"
          aria-current={view === "library" ? "page" : undefined}
          onClick={() => {
            if (leave()) {
              setView("library");
              setDocument(null);
              setReceipt(null);
              setRawDirty(false);
            }
          }}
        >
          Biblioteca
        </button>
        <button
          className={`adminTab ${view === "design" ? "adminTabActive" : ""}`}
          type="button"
          disabled={!document}
          aria-current={view === "design" ? "page" : undefined}
          onClick={() => setView("design")}
        >
          Diseño
        </button>
      </nav>
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
          {canWrite ? (
            <div className={`${styles.containerActionRow} ${styles.moduleCreateRow}`}>
              <label className="adminField">
                <span>Tipo de módulo</span>
                <select
                  aria-label="Tipo de módulo"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                >
                  <option value="visual.module">
                    Módulo visual · CTA, card y composición libre
                  </option>
                  {types.map((item) => (
                    <option key={item.type} value={item.type}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="adminButton adminButtonPrimary"
                type="button"
                onClick={() => open(null, blank(type))}
              >
                Crear módulo
              </button>
            </div>
          ) : null}
          {!unavailable ? (
            <section
              className={`productListPage productListGrid ${styles.library}`}
              aria-label="Biblioteca de módulos"
            >
              <div className="adminTableScroller productListTableScroller">
                <table className="adminTable productListTable">
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.resourceId}>
                        <td className="productListNameCell">
                          <Link
                            href={`/admin/cms/modulos?id=${encodeURIComponent(item.resourceId)}`}
                            onClick={event=>{if(receipt?.resourceId===item.resourceId){event.preventDefault();open(item,item.document);}}}
                          >
                            {item.document.name}
                          </Link>
                        </td>
                        <td>
                          {item.document.body.kind === "visual"
                            ? "Visual"
                            : definitionFor(item.document.body.type)
                                ?.label}
                        </td>
                        <td>
                          <span
                            className={`adminBadge ${item.status === "ARCHIVED" ? "adminBadgeWarn" : "adminBadgeOk"}`}
                          >
                            {item.status === "ARCHIVED"
                              ? "Archivado"
                              : "Disponible"}
                          </span>
                        </td>
                        <td>
                          <div className="productListActions">
                            <Link
                              className="adminButton employeesActionInfo"
                              href={`/admin/cms/modulos?id=${encodeURIComponent(item.resourceId)}`}
                              onClick={event=>{if(receipt?.resourceId===item.resourceId){event.preventDefault();open(item,item.document);}}}
                            >
                              Abrir
                            </Link>
                            {canWrite ? (
                              <button
                                className="adminButton employeesActionInfo"
                                type="button"
                                onClick={() =>
                                  open(null, {
                                    ...structuredClone(item.document),
                                    name: `${item.document.name.slice(0, 248)} (copia)`,
                                  })
                                }
                              >
                                Duplicar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!items.length ? (
                      <tr>
                        <td colSpan={4}>No hay módulos en este listado.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="adminButtonRow">
                <Link href="/admin/cms/modulos">Disponibles</Link>
                <Link href="/admin/cms/modulos?status=ARCHIVED">
                  Archivados
                </Link>
                {initialList.offset > 0 ? (
                  <Link
                    href={`?status=${listStatus}&offset=${Math.max(0, initialList.offset - initialList.limit)}`}
                  >
                    Anterior
                  </Link>
                ) : null}
                {initialList.offset + initialList.limit < initialList.total ? (
                  <Link
                    href={`?status=${listStatus}&offset=${initialList.offset + initialList.limit}`}
                  >
                    Siguiente
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      ) : document ? (
        <div className={styles.workspace}>
          <form
            className={styles.fields}
            id="cms-independent-module-form"
            ref={form}
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            onChange={() => setRawDirty(true)}
          >
            <fieldset disabled={!editable}>
              <legend>Diseño del módulo</legend>
              {designDefaults.message?<p role="status">{designDefaults.message}</p>:null}
              <CmsDesignSettingsEditor value={document.designSettings} inherited={designDefaults.values} onChange={designSettings=>change({...document,designSettings})} disabled={!editable}/>
              <label className="adminField">
                <span>Nombre</span>
                <input
                  required
                  maxLength={256}
                  value={document.name}
                  onChange={(event) =>
                    change({ ...document, name: event.target.value })
                  }
                />
              </label>
              <div className="adminButtonRow">
                <button
                  className="adminButton"
                  type="button"
                  disabled={!history.past.length}
                  onClick={() => travel("undo")}
                >
                  Deshacer
                </button>
                <button
                  className="adminButton"
                  type="button"
                  disabled={!history.future.length}
                  onClick={() => travel("redo")}
                >
                  Rehacer
                </button>
              </div>
              {block ? (
                <CmsVisualEditingPanel
                  key={`${receipt?.revisionToken ?? "new"}:${document.instanceId}:${editorEpoch}`}
                  block={block}
                  onBusyChange={setMediaBusy}
                  onChange={(next) =>
                    change({
                      ...document,
                      body: {
                        kind: "visual",
                        value: migrateCmsVisualModuleV1ToV2ForRenderer(
                          next.props,
                        ),
                      },
                    })
                  }
                />
              ) : document.body.kind === "registered" ? (
                <>
                  <CmsModuleEditableFields module={document} onChange={change}/>
                  <RegisteredFields
                    key={`${receipt?.revisionToken ?? "new"}:${document.instanceId}:${editorEpoch}`}
                    type={document.body.type}
                    props={document.body.props}
                    onChange={(props) =>
                      change({
                        ...document,
                        body: {
                          ...(document.body as Extract<
                            CmsIndependentModule["body"],
                            { kind: "registered" }
                          >),
                          props,
                        },
                      })
                    }
                  />
                  <CmsPresentationEditor
                    value={
                      document.body.props.presentation as
                        | CmsPresentation
                        | undefined
                    }
                    onBusyChange={setMediaBusy}
                    onChange={(presentation) => {
                      if (document.body.kind === "registered")
                        change({
                          ...document,
                          body: {
                            ...document.body,
                            props: { ...document.body.props, presentation },
                          },
                        });
                    }}
                  />
                </>
              ) : null}
              <CmsBlockStyleSheetEditor
                key={`css:${receipt?.revisionToken ?? "new"}:${document.instanceId}:${editorEpoch}`}
                value={document.styleSheet}
                onChange={(styleSheet) => change({ ...document, styleSheet })}
              />
            </fieldset>
          </form>
          <section
            className={styles.preview}
            aria-label="Vista previa del módulo"
          >
            <div className="adminButtonRow">
              {(["desktop", "tablet", "mobile"] as const).map((item) => (
                <button
                  className={viewport === item ? "adminTab adminTabActive" : "adminTab"}
                  type="button"
                  key={item}
                  aria-pressed={viewport === item}
                  onClick={() => setViewport(item)}
                >
                  {item === "desktop"
                    ? "Escritorio"
                    : item === "tablet"
                      ? "Tablet"
                      : "Móvil"}
                </button>
              ))}
            </div>
            <div
              style={{
                maxWidth:
                  viewport === "mobile"
                    ? 390
                    : viewport === "tablet"
                      ? 768
                      : 1440,
                width: "100%",
                overflow: "auto",
              }}
              onClickCapture={(event) => {
                if ((event.target as Element).closest("a"))
                  event.preventDefault();
              }}
              onSubmitCapture={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <CmsIndependentModuleView inheritedDesign={designDefaults.values} renderRegistered={renderCmsShellModulePreview}
                document={document}
                visualViewport={viewport}
              />
            </div>
          </section>
          {canWrite ? (
            <div className={`adminButtonRow ${styles.actions}`}>
              <button
                className="adminButton adminButtonPrimary"
                form="cms-independent-module-form"
                type="submit"
                disabled={busy || mediaBusy || receipt?.status === "ARCHIVED"}
              >
                {busy
                  ? "Guardando…"
                  : ambiguous
                    ? "Reintentar operación"
                    : "Guardar"}
              </button>
              {receipt && receipt.status === "DRAFT" ? (
                <button
                  className="adminButton"
                  type="button"
                  disabled={busy || mediaBusy || ambiguous || dirty}
                  onClick={() => void save(true)}
                >
                  Archivar
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
export function CmsModuleEditableFields({module,onChange}:{module:CmsIndependentModule;onChange:(module:CmsIndependentModule)=>void}) {
  if(module.body.kind!=="registered")return null;
  const type=module.body.type;
  return <details className="pricingPanel"><summary>Campos editables en las copias</summary><p>Habilita los campos que se podrán personalizar en esta copia. Las otras composiciones se conservan.</p>
    {allowed(type).filter(key=>key!=="presentation").map(key=><label key={key} className="adminCheckbox"><input type="checkbox" checked={module.editableFields?.includes(key)??false} onChange={event=>onChange({...module,editableFields:event.target.checked?[...(module.editableFields??[]),key]:(module.editableFields??[]).filter(value=>value!==key)})}/>{definitionFor(type)?.editorFields.find(field=>field.key===key)?.label??key}</label>)}
  </details>;
}

export function RegisteredFields({
  type,
  props,
  onChange,
  editableFields,
}: {
  type: string;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
  editableFields?: string[];
}) {
  const declaredFields=definitionFor(type)?.editorFields??[];
  const fieldKeys=new Set(declaredFields.map(field=>field.key));
  const propertySchema=registered.find(item=>'type' in item.properties&&item.properties.type?.const===type)?.properties.props?.properties as Record<string,{type?:string}>|undefined;
  const aliases:Record<string,string>={title:'Título',description:'Descripción'};
  const extraFields=allowed(type).filter(key=>!fieldKeys.has(key)&&!['presentation','source'].includes(key)&&(Object.hasOwn(props,key)||editableFields?.includes(key))).map((key):CmsBlockEditorField=>({key,label:aliases[key]??key,type:['array','object'].includes(propertySchema?.[key]?.type??'')?'json':propertySchema?.[key]?.type==='boolean'?'boolean':propertySchema?.[key]?.type==='number'?'number':key==='description'?'textarea':'text'}));
  const fields =
    [...declaredFields,...extraFields].filter((field) =>
      allowed(type).includes(field.key) && (editableFields===undefined||editableFields.includes(field.key)),
    );
  const structuredSlider=type==="slider.fullWidth" && (editableFields===undefined || declaredFields.every(field=>editableFields.includes(field.key)));
  const structuredTiles=type==="category.imageTiles" && (editableFields===undefined || editableFields.includes("items"));
  return (
    <div className="cmsBlockFields">
      {structuredSlider?<SliderFields block={{blockId:"copy",type,props}} onPropChange={(key,value)=>onChange({...props,[key]:value})}/>:null}
      {structuredTiles?<CmsCategoryTilesEditor items={Array.isArray(props.items)?props.items:[]} onChange={items=>onChange({...props,items})}/>:null}
      {type === "commerce.productGrid" && (editableFields===undefined||editableFields.includes('source')) ? (
        <label className="adminField">
          <span>Categoría de productos</span>
          <input
            required
            value={String(
              (props.source as { categorySlug?: string })?.categorySlug ?? "",
            )}
            onChange={(event) =>
              onChange({
                ...props,
                source: { kind: "CATEGORY", categorySlug: event.target.value },
              })
            }
          />
        </label>
      ) : null}
      {fields.filter(field=>!structuredSlider && !(structuredTiles && field.key==="items")).map((field) => (
        <ModuleField
          key={field.key}
          field={field}
          value={props[field.key]}
          onChange={(value) => onChange({ ...props, [field.key]: value })}
        />
      ))}
    </div>
  );
}
function ModuleField({
  field,
  value,
  onChange,
}: {
  field: CmsBlockEditorField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState(JSON.stringify(value ?? [], null, 2)),
    [invalid, setInvalid] = useState(false);
  if (field.type === "json")
    return (
      <label className="adminField">
        <span>{field.label}</span>
        <textarea
          rows={6}
          value={draft}
          aria-invalid={invalid}
          data-cms-editor-error={invalid ? "true" : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            try {
              onChange(JSON.parse(event.target.value));
              setInvalid(false);
            } catch {
              setInvalid(true);
            }
          }}
        />
        {invalid ? (
          <small role="alert">
            JSON no válido. Corrígelo antes de guardar.
          </small>
        ) : null}
      </label>
    );
  if (field.type === "boolean")
    return (
      <label className="adminCheckbox">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label}
      </label>
    );
  return (
    <label className="adminField">
      <span>{field.label}</span>
      {field.type === "textarea" ? (
        <textarea
          value={String(value ?? "")}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={field.type === "number" ? "number" : "text"}
          value={String(value ?? "")}
          required={field.required}
          onChange={(event) =>
            onChange(
              field.type === "number"
                ? Number(event.target.value)
                : event.target.value,
            )
          }
        />
      )}
    </label>
  );
}
