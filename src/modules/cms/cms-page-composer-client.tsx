"use client";
import {cmsPagePublicationIssues} from './cms-page-composition';
import {CmsLayoutAreaEditorClient} from './cms-layout-area-editor-client';
import {renderCmsShellModulePreview} from './cms-shell-module-preview';
import {CmsDesignSettingsEditor,useCmsDesignDefaults} from './cms-design-settings-editor';
import { CmsSaveTemplateClient } from "./cms-save-template-client";
import type { CmsTemplateReceipt } from "./cms-composition-template-types";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {resolveCmsDesignSettings} from '../../../packages/cms-blocks/src/design-settings';
import {CmsPageSectionEditor} from './cms-page-section-editor';
import {CmsPageVisualModuleEditor} from './cms-page-visual-module-editor';
import type {CmsSectionDocument} from './cms-independent-section-types';
import { CmsPageCompositionView } from "../../../packages/cms-blocks/src/react";
import { CmsBlockStyleSheetEditor } from "./cms-block-style-sheet-editor";
import {
  commandPageCompositionAction,
  previewPageCompositionAction,
  loadPageSectionsAction,
} from "./cms-page-composition-actions";
import { unpublishCmsPageAction } from "./cms-admin-actions";
import {
  assertPageBudget,
  type CmsPageComposition,
  type CmsPageMetadata,
} from "./cms-page-composition";
import { remapSection } from "./cms-section-tree";
import type { CmsPageDetail } from "./cms-admin";
import type {
  CmsSectionContext,
  CmsSectionList,
} from "./cms-independent-section-types";
import styles from "./cms-module-builder.module.css";
type Attempt = { operation: "create" | "update" | "publish"; body: unknown };
const metadata = (page: CmsPageDetail | null): CmsPageMetadata => ({
  title: page?.latestVersion?.title ?? "",
  path: page?.path ?? "",
  seo: page?.latestVersion?.seo ?? { title: "", description: "" },
});
export function CmsPageComposerClient({
  initialPage,
  initialDocument,
  templateReceipt,
  initialSections,
  context,
  canWrite,
  canPublish,
  initialPreview = false,
  unavailable,
}: {
  initialPage: CmsPageDetail | null;
  initialDocument?: CmsPageComposition;
  templateReceipt?: CmsTemplateReceipt;
  initialSections: CmsSectionList;
  context: CmsSectionContext;
  canWrite: boolean;
  canPublish: boolean;
  initialPreview?: boolean;
  unavailable?: string;
}) {
  const designDefaults=useCmsDesignDefaults(context);
  const [page, setPage] = useState(initialPage),
    [document, setDocument] = useState<CmsPageComposition>(
      initialPage?.composition?.document ?? initialDocument ?? {
        compositionSchemaVersion: 1,
        sections: [],
      },
    );
  const [fields, setFields] = useState(metadata(initialPage)),
    [pageType, setPageType] = useState(initialPage?.pageType ?? "CONTENT");
  const [tab, setTab] = useState<"page" | "composition" | "preview">(
    initialPreview ? "preview" : templateReceipt ? "composition" : "page",
  );
  const [library, setLibrary] = useState(initialSections),
    [selected, setSelected] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const [sectionPending,setSectionPending]=useState(false);
  const [visualPending,setVisualPending]=useState(false);
  const [editingSectionId,setEditingSectionId]=useState<string|null>(null);
  const [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Attempt | null>(
      initialPage?.pendingOperation?.command.operation === "PUBLISH"
        ? { operation: "publish", body: initialPage.pendingOperation.command }
        : null,
    ),
    [message, setMessage] = useState(
      unavailable ??
        (initialPage?.pendingOperation
          ? "Hay una operación pendiente. Una respuesta incierta de Routing requiere revisión antes de liberar la página."
          : ""),
    );
  const [baseline, setBaseline] = useState(
    JSON.stringify({
      document: initialPage?.composition?.document ?? initialDocument ?? {
        compositionSchemaVersion: 1,
        sections: [],
      },
      fields: metadata(initialPage),
    }),
  );
  const [previewResult, setPreviewResult] = useState<{
    source: CmsPageComposition;
    context: CmsSectionContext;
    document?: CmsPageComposition;
    error?: string;
  } | null>(null);
  const activePreview =
    previewResult?.source === document && previewResult?.context === context
      ? previewResult
      : null;
  const preview = activePreview?.document,
    previewError = activePreview?.error;
  useEffect(() => {
    if (tab !== "preview") return;
    let current = true;
    previewPageCompositionAction(document, context)
      .then((result) => {
        if (current)
          setPreviewResult({
            source: document,
            context,
            ...(result.ok
              ? { document: result.document }
              : { error: result.message }),
          });
      })
      .catch(() => {
        if (current)
          setPreviewResult({
            source: document,
            context,
            error: "No se pudo cargar la previsualización.",
          });
      });
    return () => {
      current = false;
    };
  }, [tab, document, context]);
  const form = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify({ document, fields }) !== baseline;
  const [templatePending,setTemplatePending]=useState(false);
  const updateSection=useCallback((section:CmsSectionDocument)=>{
    setDocument(current=>{
      const next={...current,sections:current.sections.map(existing=>existing.sectionId===section.sectionId?{...existing,...section}:existing)};
      if(JSON.stringify(next)===JSON.stringify(current))return current;
      try{assertPageBudget(next);return next;}catch(error){setMessage((error as Error).message);return current;}
    });
  },[]);

  const disabled =
    !canWrite || templatePending || templateReceipt?.status === "ARCHIVED" || busy || !!pending || !!page?.pendingOperation || !!unavailable;
  useEffect(() => {
    if (!dirty && !pending && !sectionPending && !visualPending) return;
    const before = (event: BeforeUnloadEvent) => event.preventDefault();
    const click = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a[href]");
      if (
        link &&
        !window.confirm("Hay cambios sin guardar. ¿Quieres salir de la página?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", before);
    window.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.removeEventListener("click", click, true);
    };
  }, [dirty, pending,sectionPending,visualPending]);
  const mutate = (next: CmsPageComposition) => {
    try {
      assertPageBudget(next);
      setDocument(next);
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message);
    }
  };
  const move = (index: number, direction: number) => {
    const next = structuredClone(document);
    const [item] = next.sections.splice(index, 1);
    next.sections.splice(index + direction, 0, item);
    mutate(next);
  };
  const save = async (operation: "save" | "publish") => {
    if(visualPending){setMessage('Aplica o cancela el diseño del módulo antes de guardar o publicar.');return;}
    if(sectionPending){setMessage('Aplica o corrige la edición de la sección antes de guardar o publicar.');return;}
    if (busy) return;
    if(operation==='publish'&&cmsPagePublicationIssues(document).length){setMessage(cmsPagePublicationIssues(document).join(' '));return;}
    if (
      form.current?.querySelector(
        '[aria-invalid="true"],[data-cms-editor-error="true"]',
      )
    ) {
      setMessage("Corrige el CSS antes de guardar o publicar.");
      return;
    }
    let attempt = pending;
    if (!attempt) {
      try {
        assertPageBudget(document);
      } catch (error) {
        setMessage((error as Error).message);
        return;
      }
      if (operation === "publish") {
        if (dirty || !page?.revisionToken || !page.latestVersion) {
          setMessage("Guarda el borrador antes de publicar.");
          return;
        }
        attempt = {
          operation: "publish",
          body: {
            contractVersion: 1,
            operation: "PUBLISH",
            operationId: crypto.randomUUID(),
            expectedRevision: page.revisionToken,
            versionId: page.latestVersion.versionId,
          },
        };
      } else {
        if (
          !fields.title.trim() ||
          !fields.path.trim() ||
          !fields.seo.title.trim() ||
          !fields.seo.description.trim()
        ) {
          setMessage("Completa título, ruta y SEO.");
          return;
        }
        attempt = {
          operation: page ? "update" : "create",
          body: {
            ...fields,
            ...(!page ? { pageType } : {}),
            composition: {
              contractVersion: 1,
              ...(page
                ? { expectedRevision: page.revisionToken }
                : { operationId: crypto.randomUUID() }),
              document,
            },
          },
        };
      }
    }
    setBusy(true);
    setPending(attempt);
    setMessage("");
    try {
      const result = await commandPageCompositionAction(
        attempt.operation,
        page?.pageId,
        attempt.body,
        context,
      );
      if (result.ok) {
        const next = result.page,
          nextDocument = next.composition!.document,
          nextFields = metadata(next);
        setPage(next);
        setDocument(nextDocument);
        setFields(nextFields);
        setBaseline(
          JSON.stringify({ document: nextDocument, fields: nextFields }),
        );
        setPending(null);
        setMessage(
          !result.readReady
            ? "Guardado confirmado. La biblioteca sigue sincronizando la revisión; conserva el editor abierto antes de reabrir."
            : attempt.operation === "publish"
            ? "Página publicada."
            : "Borrador guardado.",
        );
        window.history.replaceState(
          null,
          "",
          `/admin/cms?mode=editor&pageId=${encodeURIComponent(next.pageId)}&locale=${encodeURIComponent(context.locale)}`,
        );
      } else {
        if (result.status && result.status < 500) setPending(null);
        setMessage(
          result.status === 409
            ? "La página ha cambiado. Tu borrador sigue aquí; vuelve a abrirla para recuperar la revisión actual."
            : result.message,
        );
      }
    } catch {
      setMessage(
        "No se ha confirmado el resultado. Reintenta la misma operación antes de seguir editando.",
      );
    } finally {
      setBusy(false);
    }
  };
  const load = async (offset: number) => {
    setBusy(true);
    try {
      const result = await loadPageSectionsAction(context, offset);
      if (result.ok) {
        setLibrary(result.data);
        setSelected("");
      } else setMessage(result.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="adminPage" ref={form}>
      <header className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / CMS / Páginas</div>
          <h1 className="adminPageTitle">
            {templateReceipt ? templateReceipt.document.name : page ? fields.title : "Crear página"}
          </h1>
          <p className="adminContextHint">
            {context.organizationId} · {context.shopId} · {context.locale}
          </p>
        </div>
        <Link className="adminButton" href={templateReceipt ? "/admin/cms/plantillas" : "/admin/cms"}>
          Volver al listado
        </Link>
      </header>
      <div
        className="adminTabs"
        role="tablist"
        aria-label="Edición de página"
      >
        {(
          [
            ["page", "Página"],
            ["composition", "Composición"],
            ["preview", "Previsualizar"],
          ] as const
        ).filter(([id]) => !templateReceipt || id !== "page").map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={
              tab === id ? "adminTab adminTabActive" : "adminTab"
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {cmsPagePublicationIssues(document).length?<div className="adminBanner adminBannerWarning" role="status"><p>El borrador conserva contenido pendiente de ubicar. Puedes guardarlo; la publicación queda bloqueada.</p><ul>{cmsPagePublicationIssues(document).map((issue,index)=><li key={index}>{issue}</li>)}</ul></div>:null}
      {message ? (
        <p role="status" className="adminBanner adminBannerInfo">
          {message}
        </p>
      ) : null}
      {pending && !busy ? (
        <p>
          El resultado no está confirmado. Reintentar conserva la misma
          operación.
        </p>
      ) : null}
      <div hidden={tab !== "page"} style={tab !== "page" ? {display:"none"} : undefined} className="pricingPanel">
        <fieldset disabled={disabled} className="pricingDenseForm">
          <label className="adminField">
            <span>Título</span>
            <input
              value={fields.title}
              onChange={(e) => setFields({ ...fields, title: e.target.value })}
            />
          </label>
          <label className="adminField">
            <span>Ruta</span>
            <input
              value={fields.path}
              disabled={disabled || !!page?.routeId}
              placeholder="/mi-pagina"
              onChange={(e) => setFields({ ...fields, path: e.target.value })}
            />
          </label>
          {!page ? (
            <label className="adminField">
              <span>Tipo</span>
              <select
                value={pageType}
                onChange={(e) => setPageType(e.target.value)}
              >
                <option value="CONTENT">Contenido</option>
                <option value="HOME">Home</option>
                <option value="LANDING">Landing</option>
              </select>
            </label>
          ) : null}
          <label className="adminField">
            <span>Título SEO</span>
            <input
              maxLength={160}
              value={fields.seo.title}
              onChange={(e) =>
                setFields({
                  ...fields,
                  seo: { ...fields.seo, title: e.target.value },
                })
              }
            />
          </label>
          <label className="adminField">
            <span>Descripción SEO</span>
            <textarea
              maxLength={320}
              value={fields.seo.description}
              onChange={(e) =>
                setFields({
                  ...fields,
                  seo: { ...fields.seo, description: e.target.value },
                })
              }
            />
          </label>
        </fieldset>
        {page?.status === "PUBLISHED" && canPublish ? (
          <>
            <Link
              className="adminButton"
              href={`/admin/cms?mode=editor&pageId=${encodeURIComponent(page.pageId)}&locale=${encodeURIComponent(context.locale)}&drawer=path`}
            >
              Cambiar path publicado
            </Link>
            <form
              action={async (formData) => {
                const command =
                  page.pendingOperation?.command.operation === "UNPUBLISH"
                    ? page.pendingOperation.command
                    : {
                        contractVersion: 1,
                        operation: "UNPUBLISH",
                        operationId: crypto.randomUUID(),
                        expectedRevision: page.revisionToken,
                      };
                formData.set("pageLifecycleCommand", JSON.stringify(command));
                await unpublishCmsPageAction(formData);
              }}
              className="pricingDenseForm"
            >
              <input type="hidden" name="pageId" value={page.pageId} />
              <input type="hidden" name="locale" value={context.locale} />
              <input type="hidden" name="mode" value="editor" />
              <label className="adminField">
                <span>Confirmación de despublicación</span>
                <input
                  name="confirmUnpublish"
                  placeholder="DESPUBLICAR"
                  disabled={
                    busy ||
                    dirty ||
                    !!pending ||
                    (!!page.pendingOperation &&
                      page.pendingOperation.command.operation !== "UNPUBLISH")
                  }
                />
              </label>
              <button
                className="adminButton adminButtonDanger"
                disabled={
                  busy ||
                  dirty ||
                  !!pending ||
                  (!!page.pendingOperation &&
                    page.pendingOperation.command.operation !== "UNPUBLISH")
                }
              >
                Despublicar
              </button>
            </form>
          </>
        ) : null}
      </div>
      <div hidden={tab !== "composition"} style={tab !== "composition" ? {display:"none"} : undefined} className="pricingPanel">
        <fieldset disabled={disabled}>
          {designDefaults.message?<p role="status">{designDefaults.message}</p>:null}
          <CmsDesignSettingsEditor value={document.designSettings} inherited={designDefaults.values} onChange={designSettings=>mutate({...document,designSettings})} disabled={disabled}/>
          <details className="pricingPanel"><summary>Áreas y columnas de la página</summary>
           {document.layout?<><CmsLayoutAreaEditorClient preserveEmptyRegions initialLayout={document.layout} maxWidth={designDefaults.values.desktop.maxWidth??'1280px'} onChange={layout=>mutate({...document,layout})}/>
            {document.sections.map(section=><label className="adminField" key={section.sectionId}><span>Ubicación · {section.name}</span><select value={section.placement?`${section.placement.region}:${section.placement.areaId}:${section.placement.columnIndex}`:''} onChange={event=>{
             const [region,areaId,column]=event.target.value.split(':');const placement=event.target.value?{region:region as 'header'|'main'|'footer',areaId,columnIndex:Number(column),order:section.placement?.order??document.sections.indexOf(section)+1,align:'stretch' as const,spacing:{},visibility:{desktop:true,tablet:true,mobile:true},containerMode:'inherit' as const}:undefined;
             mutate({...document,sections:document.sections.map(current=>current.sectionId===section.sectionId?{...current,placement}:current)});
            }}><option value="">Sin área · al final del contenido</option>{section.placement&&!document.layout!.regions[section.placement.region]?.areas.some(area=>area.areaId===section.placement!.areaId&&(area.columnSlots?.length?area.columnSlots.some(column=>column.columnIndex===section.placement!.columnIndex):section.placement!.columnIndex<=area.columns.length))?<option value={`${section.placement.region}:${section.placement.areaId}:${section.placement.columnIndex}`}>Ubicación no disponible · {section.placement.areaId}</option>:null}{Object.entries(document.layout!.regions).flatMap(([region,value])=>(value?.areas??[]).flatMap(area=>(area.columnSlots?.length?area.columnSlots:area.columns.map((_,index)=>({columnIndex:index+1}))).map(column=><option key={`${region}:${area.areaId}:${column.columnIndex}`} value={`${region}:${area.areaId}:${column.columnIndex}`}>{region} · {area.name??area.areaId} · Columna {column.columnIndex}</option>)))}</select></label>)}
           </>:<button type="button" className="adminButton" onClick={()=>mutate({...document,layout:{regions:{main:{areas:[]}}}})}>Configurar áreas</button>}
          </details>
          <label className="adminField">
            <span>Sección de biblioteca</span>
            <select
              aria-label="Sección de biblioteca"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Selecciona una sección</option>
              {library.items.map((item) => (
                <option key={item.resourceId} value={item.resourceId}>
                  {item.document.name}
                </option>
              ))}
            </select>
          </label>
          <div className="adminButtonRow">
            <button
              className="adminButton"
              type="button"
              disabled={disabled || !selected}
              onClick={() => {
                const source = library.items.find(
                  (item) => item.resourceId === selected,
                );
                if (source)
                  mutate({
                    ...document,
                    sections: [
                      ...document.sections,
                      remapSection(source.document),
                    ],
                  });
              }}
            >
              Insertar copia
            </button>
            <button
              className="adminButton"
              type="button"
              disabled={disabled || library.offset === 0}
              onClick={() => load(Math.max(0, library.offset - library.limit))}
            >
              Anterior
            </button>
            <button
              className="adminButton"
              type="button"
              disabled={
                disabled || library.offset + library.limit >= library.total
              }
              onClick={() => load(library.offset + library.limit)}
            >
              Siguiente
            </button>
          </div>
          <ol aria-label="Secciones de la página">
            {document.sections.map((section, index) => (
              <li key={section.sectionId}>
                <span>{section.name}</span>
                <CmsPageSectionEditor section={section} context={context} disabled={disabled||visualPending} inheritedDesign={resolveCmsDesignSettings(designDefaults.values,document.designSettings)} onChange={updateSection} onPendingChange={setSectionPending} open={editingSectionId===section.sectionId} onToggle={()=>{if(sectionPending||form.current?.querySelector('[aria-invalid="true"],[data-cms-editor-error="true"]')){setMessage('Aplica o corrige la edición de la sección antes de cambiar.');return;}setEditingSectionId(editingSectionId===section.sectionId?null:section.sectionId);}}/>
                <div className="adminButtonRow">
                  <button
                    className="adminButton"
                    type="button"
                    disabled={disabled || index === 0}
                    aria-label={`Subir ${section.name}`}
                    onClick={() => move(index, -1)}
                  >
                    Subir
                  </button>
                  <button
                    className="adminButton"
                    type="button"
                    disabled={
                      disabled || index === document.sections.length - 1
                    }
                    aria-label={`Bajar ${section.name}`}
                    onClick={() => move(index, 1)}
                  >
                    Bajar
                  </button>
                  <button
                    className="adminButton"
                    type="button"
                    onClick={() => {
                      if (window.confirm("¿Retirar esta sección de la página?"))
                        mutate({
                          ...document,
                          sections: document.sections.filter(
                            (_, i) => i !== index,
                          ),
                        });
                    }}
                  >
                    Retirar
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {!document.sections.length ? (
            <p>Añade una sección para comenzar la composición.</p>
          ) : null}
          <CmsPageVisualModuleEditor document={document} disabled={disabled||sectionPending} onChange={mutate} onPendingChange={setVisualPending} onStartEditing={()=>{if(sectionPending||form.current?.querySelector('[aria-invalid="true"],[data-cms-editor-error="true"]'))return false;setEditingSectionId(null);return true;}}/>
          <CmsBlockStyleSheetEditor
            value={document.styleSheet}
            resource="página"
            onChange={(styleSheet) => mutate({ ...document, styleSheet })}
          />
        </fieldset>
      </div>
      <section
        hidden={tab !== "preview"} style={tab !== "preview" ? {display:"none"} : undefined}
        aria-label="Previsualización de página"
        className="pricingPanel"
      >
        <div className="adminButtonRow">
          {(["desktop", "tablet", "mobile"] as const).map((v) => (
            <button
              type="button"
              className={viewport === v ? "adminTab adminTabActive" : "adminTab"}
              key={v}
              aria-pressed={viewport === v}
              onClick={() => setViewport(v)}
            >
              {v === "desktop"
                ? "Escritorio"
                : v === "tablet"
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
                  : "100%",
            overflow: "auto",
          }}
        >
          {pageType!=='HOME'&&fields.title.trim() ? <h1>{fields.title}</h1> : null}
          {previewError ? (
            <p role="alert">{previewError}</p>
          ) : !preview ? (
            <p role="status">Cargando previsualización…</p>
          ) : (
            <CmsPageCompositionView
              document={preview}
              renderRegistered={renderCmsShellModulePreview}
              inheritedDesign={designDefaults.values}
              identity={page?.pageId ?? "draft"}
              visualViewport={viewport}
            />
          )}
        </div>
      </section>
      <footer className={styles.actions}>
        <div className="adminButtonRow">
          {canWrite ? <CmsSaveTemplateClient content={{kind:"PAGE",value:document}} context={context} initialReceipt={templateReceipt} onPendingChange={setTemplatePending} validate={()=>!form.current?.querySelector('[aria-invalid="true"],[data-cms-editor-error="true"]')} onSaved={templateReceipt ? saved=>{if(saved.document.content.kind==="PAGE"){setDocument(saved.document.content.value);setBaseline(JSON.stringify({document:saved.document.content.value,fields}));}} : undefined} disabled={disabled} /> : null}
          {canWrite && !templateReceipt ? (
            <button
              type="button"
              className="adminButton adminButtonPrimary"
              disabled={
                busy ||
                !!page?.pendingOperation ||
                !!unavailable ||
                (!!pending && pending.operation === "publish")
              }
              onClick={() => save("save")}
            >
              {pending && pending.operation !== "publish"
                ? "Reintentar guardar"
                : "Guardar"}
            </button>
          ) : null}
          {canPublish && !templateReceipt ? (
            <button
              type="button"
              className="adminButton"
              disabled={
                busy ||
                !!unavailable ||
                !page ||
                (!!page.pendingOperation &&
                  page.pendingOperation.command.operation !== "PUBLISH") ||
                dirty ||
                (!!pending && pending.operation !== "publish")
              }
              onClick={() => save("publish")}
            >
              {pending?.operation === "publish"
                ? "Reintentar publicación"
                : "Publicar"}
            </button>
          ) : null}
        </div>
      </footer>
    </main>
  );
}
