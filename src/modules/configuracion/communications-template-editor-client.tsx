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
import { safeMediaInputAccept } from "../../shared/security/media-upload";
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
  testSendEmailTemplateAction,
  transitionEmailTemplateAction,
  uploadEmailTemplateImageAction,
} from "./communications-admin-actions";

const commonVariables = [
  "customer.name",
  "customer.email",
  "order.reference",
  "fulfillment.trackingUrl",
  "emitter.name",
];

const afterSalesStatusTemplateKeys = [
  "after-sales.case.submitted",
  "after-sales.case.under-review",
  "after-sales.case.approved",
  "after-sales.case.rejected",
  "after-sales.return-authorized",
  "after-sales.return-received",
  "after-sales.refund-requested",
  "after-sales.refund-completed",
  "after-sales.refund-failed",
  "after-sales.case.resolved",
  "after-sales.case.closed",
] as const;

const afterSalesStatusTemplateVariables: Record<
  string,
  { required: string[]; available: string[] }
> = Object.fromEntries(
  afterSalesStatusTemplateKeys.map((templateKey) => [
    templateKey,
    {
      required: ["caseId", "afterSalesAreaUrl"],
      available: [
        "caseId",
        "afterSalesAreaUrl",
        "customerName",
        "orderId",
        "caseType",
        "status",
        "reasonCode",
        "notificationTitle",
      ],
    },
  ]),
);

type TemplateVariableProfile = {
  required: string[];
  requiredAlternatives?: string[][];
  available: string[];
};

const templateVariables: Record<string, TemplateVariableProfile> = {
  "customer.account.activation": {
    required: ["activationUrl", "expiresAt"],
    available: ["activationUrl", "customerName", "expiresAt", "supportEmail"],
  },
  "customer.account.activation.reminder": {
    required: ["activationUrl", "expiresAt"],
    available: ["activationUrl", "customerName", "expiresAt", "supportEmail"],
  },
  "customer.account.activation.expiring": {
    required: ["activationUrl", "expiresAt"],
    available: ["activationUrl", "customerName", "expiresAt", "supportEmail"],
  },
  "customer.account.password-reset": {
    required: ["passwordResetUrl", "expiresAt"],
    available: ["passwordResetUrl", "customerName", "expiresAt", "supportEmail"],
  },
  "customer.account.password-changed": {
    required: [],
    available: ["customerName", "supportEmail"],
  },
  "employee.account.password-recovery": {
    required: ["passwordRecoveryUrl", "expiresAt"],
    available: ["passwordRecoveryUrl", "expiresAt", "supportEmail"],
  },
  "employee.account.credential-invitation": {
    required: ["credentialInvitationUrl", "expiresAt"],
    available: ["credentialInvitationUrl", "expiresAt", "supportEmail"],
  },
  "order.tracking.access": {
    required: ["orderReference", "trackingUrl"],
    available: ["orderReference", "trackingUrl"],
  },
  "order.confirmed": {
    required: ["orderReference"],
    available: ["customerName", "orderId", "orderReference"],
  },
  "shipping.preparing": {
    required: ["orderReference"],
    available: ["customerName", "orderId", "orderReference"],
  },
  "shipping.dispatched": {
    required: ["orderReference"],
    available: ["customerName", "orderId", "orderReference"],
  },
  "shipping.shipped": {
    required: ["orderReference", "trackingNumber"],
    available: ["customerName", "orderId", "orderReference", "trackingNumber"],
  },
  "shipping.delivered": {
    required: ["orderReference"],
    available: ["customerName", "orderId", "orderReference"],
  },
  "invoice.available": {
    required: ["invoiceNumberFormatted", "invoiceAreaUrl"],
    available: ["customerName", "orderId", "invoiceNumberFormatted", "totalMinor", "currency", "invoiceAreaUrl"],
  },
  "customer.created": {
    required: [],
    available: ["firstName", "lastName", "email", "customerId"],
  },
  "payment.success": {
    required: [],
    requiredAlternatives: [["orderId", "order.id"]],
    available: ["customerName", "orderId", "order.id", "total", "totalMinor", "amountMinor", "currency"],
  },
  "shipping.failed": {
    required: ["orderReference"],
    available: ["customerName", "orderId", "orderReference", "fulfillmentId", "failureReason"],
  },
  "after-sales.case.customer-facing-message-posted": {
    required: ["caseId", "messageBody", "afterSalesAreaUrl"],
    available: ["caseId", "messageBody", "afterSalesAreaUrl", "customerName", "orderId"],
  },
  ...afterSalesStatusTemplateVariables,
};

type EditableField = "subject" | "html" | "text";

type Props = {
  contextLocale: string;
  filters: CommunicationsAdminFilters;
  template?: EmailTemplateRecord;
  closeHref: string;
};

function variablesUsedInContent(...fields: string[]) {
  const matches = fields.flatMap((field) =>
    [...field.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)\s*\}\}/g)].map(
      (match) => match[1],
    ),
  );
  return [...new Set(matches)];
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
          accept={safeMediaInputAccept}
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
          {transition === "activate" ? "Activar plantilla" : "Desactivar plantilla"}
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
  const [templateKey, setTemplateKey] = useState(template?.templateKey ?? "");
  const [activeField, setActiveField] = useState<EditableField>("html");
  const [pendingHtmlToken, setPendingHtmlToken] = useState<string>();
  const [preview, setPreview] = useState<EmailTemplatePreview>();
  const [previewError, setPreviewError] = useState<string>();
  const [isPreviewing, startPreview] = useTransition();
  const [testRecipientEmail, setTestRecipientEmail] = useState("");
  const [testFeedback, setTestFeedback] = useState<string>();
  const [testError, setTestError] = useState<string>();
  const [isTesting, startTest] = useTransition();
  const subjectRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const templateVariableProfile = templateVariables[templateKey];
  const contentVariables = useMemo(
    () => variablesUsedInContent(subjectTemplate, htmlTemplate, textTemplate),
    [htmlTemplate, subjectTemplate, textTemplate],
  );
  const requiredVariables = templateVariableProfile?.required ?? [];
  const requiredVariableAlternatives =
    templateVariableProfile?.requiredAlternatives ?? [];
  const missingRequiredVariables = requiredVariables.filter(
    (variable) => !contentVariables.includes(variable),
  );
  const missingRequiredAlternatives = requiredVariableAlternatives.filter(
    (alternatives) =>
      !alternatives.some((variable) => contentVariables.includes(variable)),
  );
  const missingCriticalVariables = [
    ...missingRequiredVariables.map((variable) => `{{${variable}}}`),
    ...missingRequiredAlternatives.map((alternatives) =>
      alternatives.map((variable) => `{{${variable}}}`).join(" o "),
    ),
  ];
  const suggestedVariables = useMemo(
    () =>
      templateVariableProfile?.available ??
      [...new Set([...contentVariables, ...commonVariables])],
    [contentVariables, templateVariableProfile],
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
      try {
        const formData = new FormData();
        formData.set("templateId", template.templateId);
        formData.set("previewData", previewDataText(template));
        const result = await previewEmailTemplateAction(formData);
        if (result.ok) {
          setPreview(result.data);
          return;
        }
        setPreview(undefined);
        setPreviewError(result.error);
      } catch {
        setPreview(undefined);
        setPreviewError("No se pudo generar el preview. Inténtalo de nuevo.");
      }
    });
  }

  function requestTemplateTest() {
    if (!template) {
      setTestError("Guarda la plantilla antes de probarla.");
      return;
    }
    setTestError(undefined);
    setTestFeedback(undefined);
    startTest(async () => {
      const formData = new FormData();
      formData.set("templateId", template.templateId);
      formData.set("recipientEmail", testRecipientEmail);
      formData.set("previewData", previewDataText(template));
      const result = await testSendEmailTemplateAction(formData);
      if (!result.ok) {
        setTestError(result.error);
        return;
      }
      if (result.data.status !== "SENT") {
        setTestError(result.data.errorMessage || "La prueba no pudo entregarse.");
        return;
      }
      setTestFeedback(`Prueba enviada a ${testRecipientEmail}.`);
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
                      value={templateKey}
                      onChange={(event) => setTemplateKey(event.target.value)}
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
              <section
                className="emailTemplateVariableLibrary"
                aria-label="Variables disponibles"
              >
                <div>
                  <strong>Variables</strong>
                  <p>Selecciona una para añadirla al contenido. Las marcadas como obligatorias deben aparecer en el email.</p>
                </div>
                {missingCriticalVariables.length ? (
                  <div className="adminBanner adminBannerError" role="alert">
                    Añade {missingCriticalVariables.join(" y ")} al asunto, HTML o texto plano para poder guardar esta plantilla.
                  </div>
                ) : null}
                <div className="emailTemplateVariableChips">
                  {suggestedVariables.map((variable) => (
                    <button
                      key={variable}
                      className={`adminButton adminButtonTiny${requiredVariables.includes(variable) || requiredVariableAlternatives.some((alternatives) => alternatives.includes(variable)) ? " emailTemplateVariableRequired" : ""}`}
                      type="button"
                      onClick={() => insertVariable(variable)}
                    >
                      {`{{${variable}}}`}
                      {requiredVariables.includes(variable)
                        ? " · Obligatoria"
                        : requiredVariableAlternatives.some((alternatives) => alternatives.includes(variable))
                          ? " · Obligatoria (una de estas)"
                          : ""}
                    </button>
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
              <input name="requiredVariables" type="hidden" value={contentVariables.join(",")} />
              <input name="previewData" type="hidden" value={previewDataText(template)} />
              <button className="adminButton adminButtonPrimary" disabled={missingCriticalVariables.length > 0} type="submit">
                {isCreate ? "Crear borrador" : "Guardar borrador"}
              </button>
            </form>
            {template ? (
              <section className="emailTemplatePreview adminSection">
                <div className="adminCardHeader">
                  <div>
                    <h3>Preview desde Communications</h3>
                    <p>
                      Comprueba los datos antes de usar la plantilla y muestra
                      el email en un espacio aislado.
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
                    <div
                      className={
                        preview.readiness.previewStatus === "READY"
                          ? "adminBanner adminBannerSuccess"
                          : "adminBanner adminBannerError"
                      }
                      role="status"
                    >
                      <strong>
                        {preview.readiness.previewStatus === "READY"
                          ? "La plantilla está lista para estos datos."
                          : preview.readiness.previewStatus === "DEGRADED"
                            ? "La plantilla tiene datos opcionales pendientes."
                            : "La plantilla no se puede enviar con estos datos."}
                      </strong>
                      {preview.readiness.issues.length ? (
                        <ul>
                          {preview.readiness.issues.map((issue) => (
                            <li key={`${issue.code}-${issue.variable ?? ""}`}>
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <ul>
                        {preview.readiness.variables.map((variable) => (
                          <li key={variable.name}>
                            {variable.critical ? "Necesaria: " : "Opcional: "}
                            {`{{${variable.name}}}`} — {variable.status === "RESOLVED" ? "disponible" : variable.status === "MISSING" ? "no disponible" : "no válida"}
                          </li>
                        ))}
                      </ul>
                    </div>
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
                    <div className="communicationsTestForm">
                      <label className="adminField">
                        <span>Enviar prueba a</span>
                        <input
                          type="email"
                          value={testRecipientEmail}
                          onChange={(event) => setTestRecipientEmail(event.target.value)}
                          placeholder="tu-email@empresa.com"
                        />
                      </label>
                      <button
                        className="adminButton"
                        disabled={isTesting}
                        type="button"
                        onClick={requestTemplateTest}
                      >
                        {isTesting ? "Enviando…" : "Probar plantilla"}
                      </button>
                    </div>
                    {testFeedback ? (
                      <div className="adminBanner adminBannerSuccess" role="status">
                        {testFeedback}
                      </div>
                    ) : null}
                    {testError ? (
                      <div className="adminBanner adminBannerError" role="alert">
                        {testError}
                      </div>
                    ) : null}
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
