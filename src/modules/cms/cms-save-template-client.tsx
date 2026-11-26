"use client";
import { useEffect, useRef, useState } from "react";
import { AdminResourceDrawer } from "../../shared/ui/admin-resource-drawer";
import { saveCompositionTemplateAction } from "./cms-composition-template-actions";
import type {
  CmsTemplateCommand,
  CmsTemplateContent,
  CmsTemplateReceipt,
} from "./cms-composition-template-types";
import type { CmsSectionContext } from "./cms-independent-section-types";
export function CmsSaveTemplateClient({
  content,
  context,
  disabled,
  initialReceipt,
  onSaved,
  validate,
  onPendingChange,
}: {
  content: CmsTemplateContent;
  context: CmsSectionContext;
  disabled: boolean;
  onPendingChange?: (pending: boolean) => void;
  validate?: () => boolean;
  initialReceipt?: CmsTemplateReceipt;
  onSaved?: (receipt: CmsTemplateReceipt) => void;
}) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(initialReceipt?.document.name ?? ""),
    [receipt, setReceipt] = useState(initialReceipt),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [pending, setPending] = useState<CmsTemplateCommand | null>(null);
  const active = useRef(false);
  useEffect(() => {
    onPendingChange?.(!!pending);
  }, [pending, onPendingChange]);
  useEffect(() => {
    if (!pending) return;
    const before = (e: BeforeUnloadEvent) => e.preventDefault();
    const click = (e: MouseEvent) => {
      if ((e.target as Element).closest?.("a[href]")) {
        e.preventDefault();
        setMessage("Confirma el guardado pendiente antes de salir.");
      }
    };
    window.addEventListener("beforeunload", before);
    window.document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.document.removeEventListener("click", click, true);
    };
  }, [pending]);
  async function save() {
    if (active.current || (!pending && !name.trim())) return;
    active.current = true;
    setBusy(true);
    const body = pending ?? {
      contractVersion: 1 as const,
      resourceKind: "TEMPLATE" as const,
      document: { name: name.trim(), content: structuredClone(content) },
      ...(receipt
        ? { expectedRevision: receipt.revisionToken }
        : { operationId: crypto.randomUUID() }),
    };
    setPending(body);
    try {
      const result = await saveCompositionTemplateAction(
        receipt ? "update" : "create",
        receipt?.resourceId,
        body,
        context,
      );
      if (result.ok) {
        setPending(null);
        setReceipt(result.receipt);
        setMessage(result.readReady ? "Plantilla guardada." : "Plantilla guardada. La biblioteca sigue sincronizando la revisión; conserva el editor abierto antes de reabrir.");
        onSaved?.(result.receipt);
        setOpen(false);
      } else {
        if (result.status && result.status < 500 && result.status !== 408)
          setPending(null);
        setMessage(
          result.status === 409
            ? "La plantilla ha cambiado. Conserva tu contenido y vuelve a abrirla para recuperar la revisión actual."
            : result.message,
        );
      }
    } catch {
      setMessage(
        "No se pudo confirmar el guardado. Reintenta la misma operación.",
      );
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="adminButton"
        disabled={disabled || busy || receipt?.status === "ARCHIVED"}
        onClick={() => {
          if (!pending && validate && !validate()) return;
          if (!initialReceipt && !pending) {
            setReceipt(undefined);
            setName(content.kind === "SECTION" ? content.value.name : "");
          }
          setOpen(true);
        }}
      >
        {initialReceipt ? "Guardar plantilla" : "Guardar como plantilla"}
      </button>
      {message ? <p role="status">{message}</p> : null}
      {open ? (
        <AdminResourceDrawer
          drawerId="cms-save-composition-template"
          title={
            initialReceipt ? "Guardar plantilla" : "Guardar como plantilla"
          }
          description="El contenido se guarda como una pieza independiente. Las copias existentes no se modifican."
          onClose={() => {
            if (!busy && !pending) setOpen(false);
          }}
        >
          <div className="pricingDenseForm">
            <label className="adminField">
              Nombre
              <input
                value={name}
                maxLength={200}
                disabled={busy || !!pending}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="adminButton adminButtonPrimary"
              disabled={busy || (!pending && !name.trim())}
              onClick={() => void save()}
            >
              {busy
                ? "Guardando…"
                : pending
                  ? "Reintentar el mismo guardado"
                  : "Guardar"}
            </button>
            {message ? <p role="status">{message}</p> : null}
          </div>
        </AdminResourceDrawer>
      ) : null}
    </>
  );
}
