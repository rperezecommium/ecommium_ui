"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { deleteCmsSitePartAction } from "./cms-site-parts-actions";
import type { CmsSitePartKind } from "./cms-admin";
import styles from "./cms-site-part-delete.module.css";

export function CmsSitePartDeleteButton({ id, name, kind, locale, usageCount, showIcon = true }: { id: string; name: string; kind: CmsSitePartKind; locale: string; usageCount: number; showIcon?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  function close() { dialog.current?.close(); setOpen(false); trigger.current?.focus(); }
  return <>
    <button ref={trigger} type="button" className="adminButton adminButtonDanger" disabled={usageCount > 0} title={usageCount > 0 ? "En uso: reemplaza o retira sus asignaciones antes de eliminar" : `Eliminar ${name}`} onClick={() => setOpen(true)}>{showIcon ? <Trash2 size={16} aria-hidden="true" /> : null} Eliminar</button>
    {open ? createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!dialog.current?.querySelector('[aria-busy="true"]')) close(); }}>
      <h2 id={heading}>Eliminar {kind === "HEADER" ? "cabecera" : "pie de pagina"}</h2>
      <p>Se eliminarán definitivamente <strong>{name}</strong> y todas sus revisiones. Si tiene asignaciones, la eliminación se bloqueará.</p>
      <DeleteForm id={id} name={name} kind={kind} locale={locale} close={close} />
    </dialog>, document.body) : null}
  </>;
}

function DeleteForm({ id, name, kind, locale, close }: { id: string; name: string; kind: CmsSitePartKind; locale: string; close: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState<{ error: string | null }, FormData>(async (_previous, data) => deleteCmsSitePartAction(data), { error: null });
  return <form action={action} aria-busy={pending}>
    <input type="hidden" name="sitePartId" value={id} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="locale" value={locale} />
    <label className="adminField"><span>Escribe «{name}» para confirmar</span><input name="confirmName" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" disabled={pending} required /></label>
    {state.error ? <p className="adminBanner adminBannerError" role="alert">{state.error}</p> : null}
    <div className="adminButtonRow"><button type="button" className="adminButton adminButtonSecondary" disabled={pending} onClick={close}>Cancelar</button><button type="submit" className="adminButton adminButtonDanger" disabled={pending || confirmation.trim() !== name}>{pending ? "Eliminando…" : "Eliminar definitivamente"}</button></div>
  </form>;
}
