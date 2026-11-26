"use client";

import { createPortal } from "react-dom";
import styles from "./customer-commercial.module.css";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Group, Membership } from "./customer-commercial-fields";

export function CustomerCommercialEditor({ groups, current, readOnly }: { groups: Group[]; current: Membership; readOnly: boolean }) {
  const groupLabelId = useId();
  const confirmationTitle = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const secret = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const submitter = useRef<HTMLButtonElement | HTMLInputElement | null>(null);
  const confirmed = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [groupCode, setGroupCode] = useState(current.groupCode ?? "");
  const [buyerType, setBuyerType] = useState(current.buyerType);
  const approvalInput = useRef<HTMLInputElement>(null);
  const [approved, setApproved] = useState(current.b2bApproved);
  const changed = groupCode !== (current.groupCode ?? "") || approved !== current.b2bApproved || buyerType !== current.buyerType;
  const approvalError = approved && buyerType !== "BUSINESS_BUYER" ? "Para aprobar condiciones B2B, selecciona Empresa como tipo comprador." : "";
  useEffect(() => { approvalInput.current?.setCustomValidity(approvalError); }, [approvalError]);
  useEffect(() => {
    const form = secret.current?.form;
    if (!form || readOnly) return;
    const intercept = (event: SubmitEvent) => {
      if (confirmed.current) { confirmed.current = false; return; }
      if (!changed) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      submitter.current = event.submitter as HTMLButtonElement | HTMLInputElement | null;
      setConfirming(true);
    };
    form.addEventListener("submit", intercept, true);
    return () => form.removeEventListener("submit", intercept, true);
  }, [changed, readOnly]);
  useEffect(() => { if (confirming) dialog.current?.showModal(); }, [confirming]);
  const closeConfirmation = () => {
    if (password.current) password.current.value = "";
    if (secret.current) secret.current.value = "";
    dialog.current?.close();
    setConfirming(false);
  };
  const confirm = () => {
    const form = secret.current?.form;
    if (!form || !password.current?.reportValidity() || !secret.current) return;
    secret.current.value = password.current.value;
    password.current.value = "";
    confirmed.current = true;
    form.requestSubmit(submitter.current);
    confirmed.current = false;
    // FormData is captured synchronously by the form submit handler.
    secret.current.value = "";
    dialog.current?.close();
    setConfirming(false);
  };
  const label = (code: string) => code ? groups.find(group => group.code === code)?.name ?? `${code} (inactivo o no disponible)` : "Sin grupo específico";
  if (readOnly) return <>
    <p>Tipo comprador: {current.buyerType === "BUSINESS_BUYER" ? "Empresa" : "Particular"}</p>
    <p>Grupo comercial: <strong>{label(current.groupCode ?? "")}</strong></p>
    <p>Aprobación B2B: {current.b2bApproved ? "Aprobada" : "No aprobada"}</p>
  </>;
  return <>
    <label className="adminField"><span>Tipo comprador</span><select aria-label="Tipo comprador" name="buyerType" value={buyerType} onChange={event => setBuyerType(event.target.value as Membership["buyerType"])}><option value="PRIVATE_BUYER">Particular</option><option value="BUSINESS_BUYER">Empresa</option></select></label>
    <input type="hidden" name="commercialMembershipIncluded" value={changed ? "true" : "false"} />
    <input ref={secret} type="hidden" name="commercialCurrentPassword" defaultValue="" />
    <input type="hidden" name="commercialMembershipRevision" value={current.revision} />
    <label className="adminField"><span id={groupLabelId}>Grupo comercial</span>
      <select aria-labelledby={groupLabelId} name="commercialGroupCode" value={groupCode} onChange={event => setGroupCode(event.target.value)}>
        <option value="">Sin grupo específico</option>
        {current.groupCode && !groups.some(group => group.code === current.groupCode) ? <option value={current.groupCode}>{label(current.groupCode)}</option> : null}
        {groups.map(group => <option key={group.code} value={group.code}>{group.name}</option>)}
      </select>
    </label>
    {!groups.length ? <p>No hay grupos activos disponibles. Puedes conservar o retirar una asignación existente.</p> : null}
    <label className="adminField"><span>Aprobación de empresa</span><span className={styles.approvalControl}><input ref={approvalInput} aria-invalid={Boolean(approvalError)} type="checkbox" name="commercialB2bApproved" checked={approved} onChange={event => setApproved(event.target.checked)} /></span></label>
    {approvalError ? <p role="alert">{approvalError}</p> : null}
    {confirming ? createPortal(<dialog ref={dialog} className={styles.confirmation} aria-labelledby={confirmationTitle} onCancel={event => { event.preventDefault(); closeConfirmation(); }}>
      <h2 id={confirmationTitle}>Confirmar cambio comercial</h2>
      <p>Confirma tu identidad con la contraseña de tu cuenta de empleado.</p>
      <p>Tipo comprador: {current.buyerType === "BUSINESS_BUYER" ? "Empresa" : "Particular"} → {buyerType === "BUSINESS_BUYER" ? "Empresa" : "Particular"}</p>
      <p>Grupo: {label(current.groupCode ?? "")} → {label(groupCode)}</p>
      <p>Aprobación B2B: {current.b2bApproved ? "Aprobada" : "No aprobada"} → {approved ? "Aprobada" : "No aprobada"}</p>
      <label className="adminField"><span>Tu contraseña de administrador</span><input ref={password} type="password" autoComplete="current-password" maxLength={256} required onKeyDown={event => { if (event.key === "Enter") {event.preventDefault(); confirm();} }} /></label>
      <div className={styles.confirmationActions}><button type="button" className="adminButton" onClick={closeConfirmation}>Cancelar</button><button type="button" className="adminButton adminButtonPrimary" onClick={confirm}>Confirmar cambio comercial</button></div>
    </dialog>, document.body) : null}
  </>;
}


export function CustomerCommercialReloadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className="adminButton" disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())}>
    {pending ? "Consultando…" : "Volver a consultar condiciones comerciales"}
  </button>;
}
