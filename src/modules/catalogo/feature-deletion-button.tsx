"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, LoaderCircle } from "lucide-react";
import {
  loadFeatureDeletionImpact,
  confirmFeatureDeletion,
} from "./feature-deletion-actions";
import type { FeatureDeletionImpact } from "./feature-deletion-contract";
import styles from "./feature-deactivation.module.css";
type Props = {
  organizationId: string;
  shopId: string;
  locale: string;
  shopName: string;
  groupId: string;
  fieldId: string;
  name: string;
  compact?: boolean;
};
export function FeatureDeletionButton(props: Props) {
  const [open, setOpen] = useState(false),
    [phase, setPhase] = useState<"loading" | "review" | "saving" | "error">(
      "loading",
    ),
    [impact, setImpact] = useState<FeatureDeletionImpact>(),
    [error, setError] = useState(""),
    [confirmationName, setConfirmationName] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    busy = useRef(false),
    generation = useRef(0),
    title = useId(),
    description = useId(),
    inputId = useId(),
    router = useRouter();
  const input = {
    organizationId: props.organizationId,
    shopId: props.shopId,
    locale: props.locale,
    groupId: props.groupId,
    fieldId: props.fieldId,
  };
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [open]);
  useEffect(() => {
    const g = generation;
    return () => {
      g.current++;
    };
  }, []);
  function close() {
    if (busy.current) return;
    generation.current++;
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }
  async function review() {
    const run = ++generation.current;
    setOpen(true);
    setPhase("loading");
    setError("");
    setImpact(undefined);
    setConfirmationName("");
    try {
      const r = await loadFeatureDeletionImpact(input);
      if (run !== generation.current) return;
      if (r.ok) {
        setImpact(r.impact);
        setPhase("review");
      } else {
        setError(
          r.error +
            ("reference" in r && r.reference
              ? ` Referencia: ${r.reference}`
              : ""),
        );
        setPhase("error");
      }
    } catch {
      if (run === generation.current) {
        setError(
          "No se pudo calcular el impacto. No se ha enviado ninguna eliminación.",
        );
        setPhase("error");
      }
    }
  }
  async function confirm() {
    if (
      busy.current ||
      phase !== "review" ||
      !impact ||
      (impact.affectedProducts > 0 && confirmationName !== impact.name)
    )
      return;
    busy.current = true;
    setPhase("saving");
    setError("");
    const operationId = crypto.randomUUID();
    const url = new URL(window.location.href);
    url.searchParams.set("fieldDeleteOperation", operationId);
    window.history.replaceState(null, "", url.pathname + url.search);
    try {
      const r = await confirmFeatureDeletion({
        ...input,
        operationId,
        expectedVersion: impact.version,
        confirmationName,
      });
      if (!r.ok && r.status && r.status < 500) {
        url.searchParams.delete("fieldDeleteOperation");
        window.history.replaceState(null, "", url.pathname + url.search);
        setImpact(undefined);
        setError(r.error);
        setPhase("error");
        return;
      }
    } catch {
      /* The operation ID recovers an uncertain result without repeating the deletion. */
    } finally {
      busy.current = false;
    }
    url.searchParams.delete("panel");
    url.searchParams.delete("fieldId");
    router.replace(url.pathname + url.search);
    close();
  }
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className={
          props.compact
            ? "adminIconButton adminIconButtonDanger"
            : "adminButton"
        }
        aria-label={`Eliminar definitivamente ${props.name}`}
        title="Eliminar definitivamente"
        onClick={review}
      >
        {props.compact ? (
          <Trash2 size={16} aria-hidden />
        ) : (
          "Eliminar definitivamente"
        )}
      </button>
      {open ? (
        <dialog
          ref={dialog}
          className={styles.dialog}
          aria-labelledby={title}
          aria-describedby={description}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <h2 id={title}>Eliminar definitivamente «{props.name}»</h2>
          <p id={description}>
            Esta acción no se puede deshacer. Se eliminarán esta característica,
            sus valores y sus asignaciones; se conservarán los productos y las
            demás características.
          </p>
          <p>
            Tienda actual: {props.shopName} · Idioma: {props.locale}
          </p>
          {phase === "loading" ? (
            <p role="status" className={styles.progress}>
              <LoaderCircle className={styles.spinner} aria-hidden size={18} />
              Calculando impacto de eliminación…
            </p>
          ) : null}
          {phase === "saving" ? (
            <p role="status" aria-busy="true" className={styles.progress}>
              <LoaderCircle className={styles.spinner} aria-hidden size={18} />
              Eliminando en catálogo… La actualización de ReadIndex se
              verificará después.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="adminBanner adminBannerError">
              {error}
            </p>
          ) : null}
          {phase === "review" && impact ? (
            <>
              <dl className={styles.impact}>
                <div>
                  <dt>Productos de los que se retirará</dt>
                  <dd>{impact.affectedProducts.toLocaleString("es-ES")}</dd>
                </div>
                <div>
                  <dt>Categorías afectadas</dt>
                  <dd>{impact.affectedCategories}</dd>
                </div>
                <div>
                  <dt>Tiendas donde se comparte</dt>
                  <dd>{impact.affectedShops}</dd>
                </div>
              </dl>
              {impact.affectedProducts > 0 ? (
                <label className="adminField" htmlFor={inputId}>
                  <span>Escribe «{impact.name}» para confirmar</span>
                  <input
                    id={inputId}
                    value={confirmationName}
                    onChange={(e) => setConfirmationName(e.target.value)}
                    maxLength={200}
                    autoComplete="off"
                  />
                </label>
              ) : (
                <p>
                  No hay productos asignados. Puedes eliminar esta definición
                  creada por error.
                </p>
              )}
            </>
          ) : null}
          <div className={styles.actions}>
            <button
              type="button"
              className="adminButton"
              disabled={phase === "saving"}
              onClick={close}
            >
              Cancelar
            </button>
            {phase === "review" && impact ? (
              <button
                type="button"
                className={`adminButton adminButtonDanger ${styles.permanent}`}
                disabled={
                  impact.affectedProducts > 0 &&
                  confirmationName !== impact.name
                }
                onClick={confirm}
              >
                Eliminar definitivamente
              </button>
            ) : null}
            {phase === "error" ? (
              <button type="button" className="adminButton" onClick={review}>
                Volver a calcular impacto
              </button>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
