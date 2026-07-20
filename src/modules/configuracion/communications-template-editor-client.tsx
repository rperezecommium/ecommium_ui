"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ImageUp,
  Italic,
  List,
  ListOrdered,
  Link2,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Unlink,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  CommunicationsAdminFilters,
  EmailTemplatePreview,
  EmailTemplateRecord,
  EmailTemplateImageUpload,
} from "./communications-admin";
import {
  createEmailTemplateAction,
  deleteEmailTemplateImageAction,
  listEmailTemplateImagesAction,
  patchEmailTemplateAction,
  previewEmailTemplateAction,
  transitionEmailTemplateAction,
  uploadEmailTemplateImageAction,
} from "./communications-admin-actions";

const variablePattern = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/;
const commonVariables = [
  "customer.name",
  "customer.email",
  "order.reference",
  "fulfillment.trackingUrl",
  "emitter.name",
];

type EditableField = "subject" | "html" | "text";

type Props = {
  contextLocale: string;
  filters: CommunicationsAdminFilters;
  template?: EmailTemplateRecord;
  closeHref: string;
};

function variablesFrom(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => variablePattern.test(item)),
    ),
  ];
}

function previewDataText(template: EmailTemplateRecord | undefined) {
  return JSON.stringify(template?.previewData ?? {}, null, 2);
}

function EmailHtmlEditor({
  value,
  onChange,
  onFocus,
  pendingToken,
  onTokenInserted,
  onImageDeleted,
  template,
}: {
  value: string;
  onChange(value: string): void;
  onFocus(): void;
  pendingToken?: string;
  onTokenInserted(): void;
  onImageDeleted(): void;
  template?: EmailTemplateRecord;
}) {
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string>();
  const [uploadFeedback, setUploadFeedback] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();
  const [isUploading, setIsUploading] = useState(false);
  const [templateImages, setTemplateImages] = useState<EmailTemplateImageUpload[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(Boolean(template));
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        openOnClick: false,
        protocols: ["mailto"],
        isAllowedUri: (url) => /^(https?:\/\/|mailto:)/i.test(url),
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ allowBase64: false }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Contenido HTML de la plantilla",
        class: "richTextEditable",
        role: "textbox",
      },
      handleDOMEvents: {
        focus: () => {
          onFocus();
          return false;
        },
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused || editor.getHTML() === value) {
      return;
    }
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor || !pendingToken) {
      return;
    }
    editor.chain().focus().insertContent(pendingToken).run();
    onTokenInserted();
  }, [editor, onTokenInserted, pendingToken]);

  useEffect(() => {
    if (!template) {
      return;
    }
    let active = true;
    const formData = new FormData();
    formData.set("templateId", template.templateId);
    void listEmailTemplateImagesAction(formData).then((result) => {
      if (!active) {
        return;
      }
      setIsLoadingImages(false);
      if (result.ok) {
        setTemplateImages(result.data);
      } else {
        setUploadError(result.error);
      }
    });
    return () => {
      active = false;
    };
  }, [template]);

  function openLinkEditor() {
    setLinkError(undefined);
    setLinkUrl(editor?.getAttributes("link").href ?? "");
    setLinkEditorOpen(true);
  }

  function applyLink() {
    const href = linkUrl.trim();
    if (!editor) {
      return;
    }
    if (!/^(https?:\/\/|mailto:)/i.test(href)) {
      setLinkError("Usa una URL https/http o un enlace mailto:.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkEditorOpen(false);
    setLinkError(undefined);
  }

  async function uploadImage(file: File | undefined) {
    if (!file || !template) {
      return;
    }
    onFocus();
    setUploadFeedback("Subiendo imagen…");
    setUploadError(undefined);
    setIsUploading(true);
    const formData = new FormData();
    formData.set("templateId", template.templateId);
    formData.set("templateKey", template.templateKey);
    formData.set("locale", template.locale);
    formData.set("file", file);
    const result = await uploadEmailTemplateImageAction(formData);
    setIsUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      setUploadFeedback(undefined);
      return;
    }
    const inserted = editor
      ?.chain()
      .focus()
      .setImage({ alt: result.data.alt, src: result.data.url })
      .run();
    if (!inserted || !editor) {
      setUploadFeedback(undefined);
      setUploadError("No se pudo insertar la imagen en el contenido HTML.");
      return;
    }
    onChange(editor.getHTML());
    setTemplateImages((current) => [
      ...current.filter((image) => image.mediaAssetId !== result.data.mediaAssetId),
      result.data,
    ]);
    setUploadFeedback("Imagen insertada. Guarda la plantilla para conservarla.");
  }

  async function deleteImage(image: EmailTemplateImageUpload) {
    if (!window.confirm("Esta acción quitará la imagen del email y la eliminará definitivamente de Media y Google Cloud Storage. ¿Continuar?")) {
      return;
    }

    const document = new DOMParser().parseFromString(value, "text/html");
    document.querySelectorAll("img").forEach((element) => {
      if (element.getAttribute("src") === image.url) {
        element.remove();
      }
    });
    const nextHtml = document.body.innerHTML;
    setUploadError(undefined);
    setUploadFeedback("Eliminando imagen de la plantilla y de Media…");
    const formData = new FormData();
    formData.set("templateId", template?.templateId ?? "");
    formData.set("mediaCollectionId", image.mediaCollectionId);
    formData.set("mediaAssetId", image.mediaAssetId);
    formData.set("htmlTemplate", nextHtml);
    const result = await deleteEmailTemplateImageAction(formData);
    if (!result.ok) {
      setUploadFeedback(undefined);
      setUploadError(result.error);
      return;
    }

    editor?.commands.setContent(nextHtml, { emitUpdate: false });
    onChange(nextHtml);
    setTemplateImages((current) => current.filter((item) => item.mediaAssetId !== image.mediaAssetId));
    setUploadFeedback("Imagen eliminada definitivamente de Media y Google Cloud Storage. La plantilla ha quedado en borrador.");
    onImageDeleted();
  }

  return (
    <div className="richTextEditor emailTemplateHtmlEditor">
      <div
          className="richTextToolbar"
          aria-label="Herramientas de HTML"
          role="toolbar"
      >
        <select
          aria-label="Formato de bloque"
          value={
            editor?.isActive("heading", { level: 2 })
              ? "h2"
              : editor?.isActive("heading", { level: 3 })
                ? "h3"
                : editor?.isActive("blockquote")
                  ? "blockquote"
                  : editor?.isActive("codeBlock")
                    ? "codeBlock"
                    : "paragraph"
          }
          onChange={(event) => {
            const chain = editor?.chain().focus();
            if (!chain) {
              return;
            }
            if (event.target.value === "h2") {
              chain.toggleHeading({ level: 2 }).run();
            } else if (event.target.value === "h3") {
              chain.toggleHeading({ level: 3 }).run();
            } else if (event.target.value === "blockquote") {
              chain.toggleBlockquote().run();
            } else if (event.target.value === "codeBlock") {
              chain.toggleCodeBlock().run();
            } else {
              chain.setParagraph().run();
            }
          }}
        >
          <option value="paragraph">Parrafo</option>
          <option value="h2">Titulo H2</option>
          <option value="h3">Titulo H3</option>
          <option value="blockquote">Cita</option>
          <option value="codeBlock">Codigo</option>
        </select>
        <button
          aria-label="Negrita"
          className={`richTextToolbarButton ${editor?.isActive("bold") ? "isActive" : ""}`}
          disabled={!editor}
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Cursiva"
          className={`richTextToolbarButton ${editor?.isActive("italic") ? "isActive" : ""}`}
          disabled={!editor}
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Tachado"
          className={`richTextToolbarButton ${editor?.isActive("strike") ? "isActive" : ""}`}
          disabled={!editor}
          type="button"
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Lista con vinetas"
          className={`richTextToolbarButton ${editor?.isActive("bulletList") ? "isActive" : ""}`}
          disabled={!editor}
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Lista numerada"
          className={`richTextToolbarButton ${editor?.isActive("orderedList") ? "isActive" : ""}`}
          disabled={!editor}
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Añadir enlace"
          className={`richTextToolbarButton ${editor?.isActive("link") ? "isActive" : ""}`}
          disabled={!editor}
          type="button"
          onClick={openLinkEditor}
        >
          <Link2 aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Quitar enlace"
          className="richTextToolbarButton"
          disabled={!editor?.isActive("link")}
          type="button"
          onClick={() => editor?.chain().focus().unsetLink().run()}
        >
          <Unlink aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Alinear a la izquierda"
          className={`richTextToolbarButton ${editor?.isActive({ textAlign: "left" }) ? "isActive" : ""}`}
          disabled={!editor}
          type="button"
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Centrar texto"
          className={`richTextToolbarButton ${editor?.isActive({ textAlign: "center" }) ? "isActive" : ""}`}
          disabled={!editor}
          type="button"
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Alinear a la derecha"
          className={`richTextToolbarButton ${editor?.isActive({ textAlign: "right" }) ? "isActive" : ""}`}
          disabled={!editor}
          type="button"
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Justificar texto"
          className={`richTextToolbarButton ${editor?.isActive({ textAlign: "justify" }) ? "isActive" : ""}`}
          disabled={!editor}
          type="button"
          onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <input
          ref={imageInputRef}
          accept="image/*"
          aria-label="Archivo de imagen de la plantilla"
          className="visuallyHidden"
          type="file"
          onChange={(event) => {
            void uploadImage(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          aria-label="Subir imagen"
          className="richTextToolbarButton"
          disabled={!editor || !template || isUploading}
          title={template ? "Subir e insertar imagen" : "Guarda la plantilla antes de subir una imagen"}
          type="button"
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageUp aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Limpiar formato"
          className="richTextToolbarButton"
          disabled={!editor}
          type="button"
          onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <RemoveFormatting aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Deshacer"
          className="richTextToolbarButton"
          disabled={!editor?.can().undo()}
          type="button"
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
        <button
          aria-label="Rehacer"
          className="richTextToolbarButton"
          disabled={!editor?.can().redo()}
          type="button"
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden="true" size={16} strokeWidth={2.4} />
        </button>
      </div>
      {uploadFeedback ? (
        <p aria-live="polite" className="emailTemplateUploadFeedback">
          {uploadFeedback}
        </p>
      ) : null}
      {uploadError ? (
        <p aria-live="assertive" className="emailTemplateUploadError">
          {uploadError}
        </p>
      ) : null}
      {template ? (
        <section className="emailTemplateMediaLibrary" aria-label="Imágenes de la plantilla">
          <div>
            <strong>Imágenes adjuntas</strong>
            <p>Eliminar definitivamente también borra el archivo y sus variantes de Google Cloud Storage.</p>
          </div>
          {isLoadingImages ? <span className="adminMuted">Cargando imágenes…</span> : null}
          {!isLoadingImages && templateImages.length === 0 ? (
            <span className="adminMuted">Aún no hay imágenes adjuntas.</span>
          ) : null}
          <div className="emailTemplateMediaGrid">
            {templateImages.map((image) => (
              <article className="emailTemplateMediaItem" key={image.mediaAssetId}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={image.alt} src={image.url} />
                <span title={image.alt}>{image.alt}</span>
                <button
                  className="adminButton adminButtonDanger adminButtonTiny"
                  type="button"
                  onClick={() => void deleteImage(image)}
                >
                  Eliminar definitivamente
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {linkEditorOpen ? (
        <div className="emailTemplateLinkEditor" role="group" aria-label="Configurar enlace">
          <input
            aria-label="URL del enlace"
            autoFocus
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://example.com o mailto:soporte@example.com"
            value={linkUrl}
          />
          <button className="adminButton adminButtonTiny" type="button" onClick={applyLink}>
            Aplicar enlace
          </button>
          <button className="adminButton adminButtonTiny" type="button" onClick={() => setLinkEditorOpen(false)}>
            Cancelar
          </button>
          {linkError ? <small className="adminFieldError">{linkError}</small> : null}
        </div>
      ) : null}
      <EditorContent editor={editor} style={{ minHeight: 220 }} />
      <textarea
        aria-label="HTML fuente de la plantilla"
        className="richTextSource"
        name="htmlTemplate"
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        rows={7}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}

function TemplateLifecycleActions({
  template,
}: {
  template: EmailTemplateRecord;
}) {
  if (template.status === "ARCHIVED") {
    return (
      <p className="adminMuted">
        Una plantilla archivada conserva su auditoría y no puede volver a
        activarse.
      </p>
    );
  }

  const transition = template.status === "ACTIVE" ? "deactivate" : "activate";
  return (
    <div className="adminButtonRow adminSection">
      <form action={transitionEmailTemplateAction}>
        <input name="templateId" type="hidden" value={template.templateId} />
        <input name="transition" type="hidden" value={transition} />
        <button className="adminButton adminButtonPrimary" type="submit">
          {transition === "activate" ? "Activar plantilla" : "Pausar plantilla"}
        </button>
      </form>
      <form action={transitionEmailTemplateAction}>
        <input name="templateId" type="hidden" value={template.templateId} />
        <input name="transition" type="hidden" value="archive" />
        <button className="adminButton adminButtonDanger" type="submit">
          Archivar
        </button>
      </form>
    </div>
  );
}

export function CommunicationsTemplateEditor({
  contextLocale,
  filters,
  template,
  closeHref,
}: Props) {
  const router = useRouter();
  const isCreate = !filters.templateId;
  const [subjectTemplate, setSubjectTemplate] = useState(
    template?.subjectTemplate ?? "",
  );
  const [htmlTemplate, setHtmlTemplate] = useState(
    template?.htmlTemplate ?? "",
  );
  const [textTemplate, setTextTemplate] = useState(
    template?.textTemplate ?? "",
  );
  const [requiredVariables, setRequiredVariables] = useState(
    template?.requiredVariables.join("\n") ?? "",
  );
  const [previewData, setPreviewData] = useState(previewDataText(template));
  const [activeField, setActiveField] = useState<EditableField>("html");
  const [pendingHtmlToken, setPendingHtmlToken] = useState<string>();
  const [preview, setPreview] = useState<EmailTemplatePreview>();
  const [previewError, setPreviewError] = useState<string>();
  const [isPreviewing, startPreview] = useTransition();
  const subjectRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const suggestedVariables = useMemo(
    () => [
      ...new Set([...variablesFrom(requiredVariables), ...commonVariables]),
    ],
    [requiredVariables],
  );

  function insertIntoField(
    value: string,
    setValue: (next: string) => void,
    control: HTMLInputElement | HTMLTextAreaElement | null,
    token: string,
  ) {
    const start = control?.selectionStart ?? value.length;
    const end = control?.selectionEnd ?? start;
    setValue(`${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => {
      control?.focus();
      control?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function insertVariable(variable: string) {
    const token = `{{${variable}}}`;
    if (!variablesFrom(requiredVariables).includes(variable)) {
      setRequiredVariables((current) =>
        current.trim() ? `${current.trim()}\n${variable}` : variable,
      );
    }

    if (activeField === "subject") {
      insertIntoField(
        subjectTemplate,
        setSubjectTemplate,
        subjectRef.current,
        token,
      );
      return;
    }
    if (activeField === "text") {
      insertIntoField(textTemplate, setTextTemplate, textRef.current, token);
      return;
    }
    setPendingHtmlToken(token);
  }

  function requestPreview() {
    if (!template) {
      setPreviewError("Guarda la plantilla antes de previsualizarla.");
      return;
    }
    setPreviewError(undefined);
    startPreview(async () => {
      const formData = new FormData();
      formData.set("templateId", template.templateId);
      formData.set("previewData", previewData);
      const result = await previewEmailTemplateAction(formData);
      if (result.ok) {
        setPreview(result.data);
      } else {
        setPreview(undefined);
        setPreviewError(result.error);
      }
    });
  }

  const title = isCreate ? "Crear plantilla email" : "Editar plantilla email";
  return (
    <div className="adminDrawerBackdrop">
      <aside
        className="adminSideDrawer communicationsProviderDrawer emailTemplateDrawer"
        aria-label={title}
        aria-modal="true"
        role="dialog"
      >
        <div className="adminSideDrawerHeader">
          <div>
            <h2>{title}</h2>
            <p>
              {isCreate
                ? "Crea primero un borrador; el contenido se activará de forma explícita."
                : "Guardar una plantilla activa la devuelve a borrador para revisar el cambio."}
            </p>
          </div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>
            Cerrar
          </Link>
        </div>
        {!isCreate && !template ? (
          <div className="adminBanner adminBannerError">
            La plantilla seleccionada no está disponible en la lista actual.
          </div>
        ) : null}
        {isCreate || template ? (
          <>
            <form
              action={
                isCreate ? createEmailTemplateAction : patchEmailTemplateAction
              }
              className="pricingDenseForm"
            >
              {!isCreate ? (
                <input
                  name="templateId"
                  type="hidden"
                  value={template?.templateId}
                />
              ) : null}
              <div className="adminFormGrid">
                <label className="adminField">
                  <span>Clave de plantilla</span>
                  {isCreate ? (
                    <input
                      name="templateKey"
                      placeholder="shipping.delivered"
                      required
                    />
                  ) : (
                    <input readOnly value={template?.templateKey ?? ""} />
                  )}
                </label>
                <label className="adminField">
                  <span>Locale</span>
                  {isCreate ? (
                    <input
                      name="locale"
                      defaultValue={contextLocale}
                      required
                    />
                  ) : (
                    <input readOnly value={template?.locale ?? ""} />
                  )}
                </label>
              </div>
              {!isCreate && template ? (
                <span
                  className={
                    template.status === "ACTIVE"
                      ? "adminBadge adminBadgeOk"
                      : template.status === "DRAFT"
                        ? "adminBadge adminBadgeWarn"
                        : "adminBadge"
                  }
                >
                  {template.status}
                </span>
              ) : null}
              <section
                className="emailTemplateVariableLibrary"
                aria-label="Variables disponibles"
              >
                <div>
                  <strong>Variables</strong>
                  <p>
                    Inserta únicamente tokens declarativos.{" "}
                    <code>{"{{emitter.name}}"}</code> es válido si existe en los
                    datos; <code>{"{% emitter.name %}"}</code> no está
                    soportado.
                  </p>
                </div>
                <div className="emailTemplateVariableChips">
                  {suggestedVariables.map((variable) => (
                    <button
                      key={variable}
                      className="adminButton adminButtonTiny"
                      type="button"
                      onClick={() => insertVariable(variable)}
                    >{`{{${variable}}}`}</button>
                  ))}
                </div>
              </section>
              <label className="adminField">
                <span>Asunto</span>
                <input
                  ref={subjectRef}
                  name="subjectTemplate"
                  onChange={(event) => setSubjectTemplate(event.target.value)}
                  onFocus={() => setActiveField("subject")}
                  placeholder="Pedido {{order.reference}} entregado"
                  value={subjectTemplate}
                />
              </label>
              <div className="adminField richTextField">
                <span>HTML</span>
                <EmailHtmlEditor
                  onChange={setHtmlTemplate}
                  onFocus={() => setActiveField("html")}
                  onImageDeleted={() => router.refresh()}
                  onTokenInserted={() => setPendingHtmlToken(undefined)}
                  pendingToken={pendingHtmlToken}
                  template={template}
                  value={htmlTemplate}
                />
                <small className="adminMuted">
                  Para layouts completos de email (tablas o estilos), usa el
                  panel HTML fuente; el preview final siempre lo procesa
                  Communications.
                </small>
              </div>
              <label className="adminField">
                <span>Texto plano</span>
                <textarea
                  ref={textRef}
                  name="textTemplate"
                  onChange={(event) => setTextTemplate(event.target.value)}
                  onFocus={() => setActiveField("text")}
                  placeholder="Hola {{customer.name}}"
                  rows={6}
                  value={textTemplate}
                />
              </label>
              <label className="adminField">
                <span>Variables requeridas</span>
                <textarea
                  name="requiredVariables"
                  onChange={(event) => setRequiredVariables(event.target.value)}
                  placeholder={"customer.name\norder.reference"}
                  rows={4}
                  value={requiredVariables}
                />
              </label>
              <label className="adminField">
                <span>Datos de preview (JSON)</span>
                <textarea
                  name="previewData"
                  onChange={(event) => setPreviewData(event.target.value)}
                  rows={8}
                  spellCheck={false}
                  value={previewData}
                />
              </label>
              <button className="adminButton adminButtonPrimary" type="submit">
                {isCreate ? "Crear borrador" : "Guardar borrador"}
              </button>
            </form>
            {template ? (
              <section className="emailTemplatePreview adminSection">
                <div className="adminCardHeader">
                  <div>
                    <h3>Preview desde Communications</h3>
                    <p>
                      Se renderiza con los datos JSON indicados y en un iframe
                      aislado.
                    </p>
                  </div>
                  <button
                    className="adminButton"
                    disabled={isPreviewing}
                    type="button"
                    onClick={requestPreview}
                  >
                    {isPreviewing ? "Renderizando…" : "Actualizar preview"}
                  </button>
                </div>
                {previewError ? (
                  <div className="adminBanner adminBannerError">
                    {previewError}
                  </div>
                ) : null}
                {preview ? (
                  <div className="emailTemplatePreviewResult">
                    <p>
                      <strong>Asunto:</strong>{" "}
                      {preview.rendered.subject || "Sin asunto"}
                    </p>
                    <iframe
                      sandbox=""
                      srcDoc={preview.rendered.html}
                      title={`Preview de ${preview.templateKey}`}
                    />
                    <pre>{preview.rendered.text}</pre>
                  </div>
                ) : (
                  <p className="adminMuted">
                    Aún no se ha generado un preview para estos datos.
                  </p>
                )}
              </section>
            ) : null}
            {template ? <TemplateLifecycleActions template={template} /> : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}
