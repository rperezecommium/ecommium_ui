"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { createCmsSitePartAction } from "./cms-site-parts-actions";

export function CmsSitePartCreateInline({ kind, locale }: { kind: "HEADER" | "FOOTER"; locale: string }) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const label = kind === "HEADER" ? "header" : "footer";
  return <>
    <button type="button" className={`productEditorTab${open ? " productEditorTabActive" : ""}`} aria-label={`Crear nuevo ${label}`} aria-expanded={open} aria-controls={formId} onClick={() => setOpen(value => !value)}><Plus size={16} aria-hidden="true" /></button>
    {open ? <form id={formId} action={createCmsSitePartAction} className="cmsSitePartCreateInline">
      <input name="kind" type="hidden" value={kind} /><input name="locale" type="hidden" value={locale} />
      <input autoFocus aria-label={`Nombre del nuevo ${label}`} name="name" placeholder={`${kind === "HEADER" ? "Header" : "Footer"} principal`} required />
      <button className="adminButton adminButtonPrimary" type="submit">Crear</button>
    </form> : null}
  </>;
}
