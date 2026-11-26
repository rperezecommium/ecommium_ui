"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Strikethrough, List, ListOrdered, RemoveFormatting, Undo2, Redo2, Quote, Code, FileCode, Link as LinkIcon, Unlink, IndentIncrease, IndentDecrease } from "lucide-react";
import { sanitizeRichTextHref } from "../../../packages/cms-blocks/src/rich-text";

export function CmsRichTextEditor({ label, html, text, onChange }: {
  label: string;
  html?: string;
  text: string;
  onChange: (html: string) => void;
}) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, horizontalRule: false, underline: false,
      link: { openOnClick: false, autolink: false, isAllowedUri: url => !!sanitizeRichTextHref(url) } })],
    content: html ?? { type: "doc", content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] },
    immediatelyRender: false,
    editorProps: { attributes: { "aria-label": label, role: "textbox", "aria-multiline": "true", class: "richTextEditable" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  const state = useEditorState({ editor, selector: ({ editor }) => ({
    bold: editor?.isActive("bold"), italic: editor?.isActive("italic"),
    strike: editor?.isActive("strike"), code: editor?.isActive("code"),
    blockquote: editor?.isActive("blockquote"), codeBlock: editor?.isActive("codeBlock"), link: editor?.isActive("link"),
    canUndo: editor?.can().undo(), canRedo: editor?.can().redo(),
    canIndent: editor?.can().sinkListItem("listItem"), canOutdent: editor?.can().liftListItem("listItem"),
    bulletList: editor?.isActive("bulletList"), orderedList: editor?.isActive("orderedList"),
    heading: editor?.isActive("heading", { level: 2 }) ? "h2" : editor?.isActive("heading", { level: 3 }) ? "h3" : "paragraph",
  }) });
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if (html !== undefined) {
      if (editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false });
    } else {
      editor.commands.setContent({ type: "doc", content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] }, { emitUpdate: false });
    }
  }, [editor, html, text]);
  return <div className="adminField cmsJsonField richTextField">
    <span>{label}</span>
    <div className="richTextEditor">
      <div className="richTextToolbar" role="toolbar" aria-label={`Herramientas de ${label}`}>
        <select aria-label="Formato de bloque" value={state?.heading ?? "paragraph"} disabled={!editor} onChange={event => {
          if (event.target.value === "h2") editor?.chain().focus().setHeading({ level: 2 }).run();
          else if (event.target.value === "h3") editor?.chain().focus().setHeading({ level: 3 }).run();
          else editor?.chain().focus().setParagraph().run();
        }}><option value="paragraph">Párrafo</option><option value="h2">Título H2</option><option value="h3">Título H3</option></select>
        {[
          { label: "Negrita", icon: Bold, active: state?.bold, run: () => editor?.chain().focus().toggleBold().run() },
          { label: "Cursiva", icon: Italic, active: state?.italic, run: () => editor?.chain().focus().toggleItalic().run() },
          { label: "Tachado", icon: Strikethrough, active: state?.strike, run: () => editor?.chain().focus().toggleStrike().run() },
          { label: "Lista con viñetas", icon: List, active: state?.bulletList, run: () => editor?.chain().focus().toggleBulletList().run() },
          { label: "Lista numerada", icon: ListOrdered, active: state?.orderedList, run: () => editor?.chain().focus().toggleOrderedList().run() },
          { label: "Aumentar sangría de lista", icon: IndentIncrease, disabled: !state?.canIndent, run: () => editor?.chain().focus().sinkListItem("listItem").run() },
          { label: "Reducir sangría de lista", icon: IndentDecrease, disabled: !state?.canOutdent, run: () => editor?.chain().focus().liftListItem("listItem").run() },
          { label: "Cita", icon: Quote, active: state?.blockquote, run: () => editor?.chain().focus().toggleBlockquote().run() },
          { label: "Código en línea", icon: Code, active: state?.code, run: () => editor?.chain().focus().toggleCode().run() },
          { label: "Bloque de código", icon: FileCode, active: state?.codeBlock, run: () => editor?.chain().focus().toggleCodeBlock().run() },
          { label: "Editar enlace", icon: LinkIcon, active: state?.link, run: () => { setLinkUrl(editor?.getAttributes("link").href ?? ""); setLinkError(""); setLinkOpen(true); } },
          { label: "Quitar enlace", icon: Unlink, disabled: !state?.link, run: () => editor?.chain().focus().extendMarkRange("link").unsetLink().run() },
          { label: "Limpiar formato", icon: RemoveFormatting, run: () => editor?.chain().focus().unsetAllMarks().clearNodes().run() },
          { label: "Deshacer", icon: Undo2, disabled: !state?.canUndo, run: () => editor?.chain().focus().undo().run() },
          { label: "Rehacer", icon: Redo2, disabled: !state?.canRedo, run: () => editor?.chain().focus().redo().run() },
        ].map(({ label: toolLabel, icon: Icon, active, disabled, run }) => <button key={toolLabel}
          className={`richTextToolbarButton${active ? " isActive" : ""}`} type="button"
          aria-label={toolLabel} title={toolLabel} aria-pressed={active === undefined ? undefined : !!active}
          disabled={!editor || disabled} onClick={run}><Icon size={16} aria-hidden="true" /></button>)}
      </div>
      {linkOpen ? <div className="richTextToolbar" role="group" aria-label="Configurar enlace">
        <label className="adminField"><span>Destino del enlace</span><input aria-invalid={!!linkError} value={linkUrl} placeholder="https://… o /ruta" onChange={event => { setLinkUrl(event.target.value); setLinkError(""); }} /></label>
        <button className="adminButton adminButtonTiny" type="button" onClick={() => {
          const href = sanitizeRichTextHref(linkUrl);
          if (!href) { setLinkError("Usa una ruta local, ancla o URL https, mailto o tel válida."); return; }
          const chain = editor?.chain().focus().extendMarkRange("link");
          if (editor?.state.selection.empty && !editor.isActive("link")) chain?.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
          else chain?.setLink({ href }).run();
          setLinkOpen(false);
        }}>Aplicar enlace</button>
        <button className="adminButton adminButtonTiny" type="button" onClick={() => { setLinkOpen(false); setLinkError(""); }}>Cancelar</button>
        {linkError ? <small role="alert">{linkError}</small> : null}
      </div> : null}
      <EditorContent editor={editor} style={{ minHeight: 180 }} />
      <button className="adminButton adminButtonTiny richTextSourceToggle" type="button" aria-expanded={sourceOpen} onClick={() => setSourceOpen(!sourceOpen)}>{sourceOpen ? "Ocultar código HTML" : "Mostrar código HTML"}</button>
      {sourceOpen ? <textarea className="richTextSource" aria-label={`${label} HTML`} value={html ?? editor?.getHTML() ?? ""} onChange={event => onChange(event.target.value)} rows={5} /> : null}
    </div>
  </div>;
}
