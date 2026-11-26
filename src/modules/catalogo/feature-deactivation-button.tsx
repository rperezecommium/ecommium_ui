"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, LoaderCircle } from "lucide-react";
import {
  loadFeatureDeactivationImpact,
  confirmFeatureDeactivation,
  checkFeatureDeactivationProjection,
} from "./feature-deactivation-actions";
import type { FeatureImpact } from "./feature-deactivation-contract";
import styles from "./feature-deactivation.module.css";

type Props = {
  groupId: string;
  fieldId: string;
  name: string;
  organizationId: string;
  shopId: string;
  locale: string;
  shopName: string;
  compact?: boolean;
};
type Phase =
  | "loading"
  | "review"
  | "saving"
  | "syncing"
  | "waiting"
  | "complete"
  | "error"
  | "uncertain";
export function FeatureDeactivationButton(props: Props) {
  const [open, setOpen] = useState(false),
    [phase, setPhase] = useState<Phase>("loading"),
    [impact, setImpact] = useState<FeatureImpact>(),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    busy = useRef(false),
    autoChecked = useRef(false),
    generation = useRef(0),
    router = useRouter(),
    title = useId(),
    description = useId();
  const input = {
    groupId: props.groupId,
    fieldId: props.fieldId,
    organizationId: props.organizationId,
    shopId: props.shopId,
    locale: props.locale,
  };
  const isPending =
    phase === "loading" || phase === "saving" || phase === "syncing";
  function close() {
    if (busy.current) return;
    generation.current++;
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
    if (["complete", "waiting"].includes(phase)) router.refresh();
  }
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [open]);
  useEffect(() => {
    const pending = generation;
    return () => {
      pending.current++;
    };
  }, []);
  async function review() {
    const run = ++generation.current;
    setPhase("loading");
    setImpact(undefined);
    setError("");
    try {
      const result = await loadFeatureDeactivationImpact(input);
      if (run !== generation.current) return;
      if (result.ok) {
        setImpact(result.impact);
        setPhase(result.impact.isActive ? "review" : "waiting");
      } else {
        setError(
          result.error +
            ("reference" in result && result.reference
              ? ` Referencia: ${result.reference}`
              : ""),
        );
        setPhase("error");
      }
    } catch {
      if (run === generation.current) {
        setError("No se pudo consultar el impacto. Vuelve a intentarlo.");
        setPhase("error");
      }
    }
  }
  // Modal opens before the query; no mutation occurs until explicit confirmation.
  async function start() {
    autoChecked.current = false;
    setOpen(true);
    void review();
  }
  async function check() {
    if (busy.current) return;
    busy.current = true;
    setPhase("syncing");
    const run = generation.current;
    try {
      const result = await checkFeatureDeactivationProjection(input);
      if (run !== generation.current) return;
      if (result.ok) {
        setPhase(result.complete ? "complete" : "waiting");
        setError("");
      } else {
        setError(result.error);
        setPhase("waiting");
      }
    } catch {
      if (run === generation.current) {
        setError("No se pudo comprobar la sincronización.");
        setPhase("waiting");
      }
    } finally {
      busy.current = false;
    }
  }
  async function confirm() {
    if (busy.current || phase !== "review" || !impact) return;
    busy.current = true;
    setPhase("saving");
    setError("");
    try {
      const result = await confirmFeatureDeactivation({
        ...input,
        expectedVersion: impact.version,
      });
      if (!result.ok) {
        setImpact(undefined);
        setError(
          result.error +
            ("reference" in result && result.reference
              ? ` Referencia: ${result.reference}`
              : ""),
        );
        setPhase(
          "status" in result && result.status && result.status < 500
            ? "error"
            : "uncertain",
        );
        return;
      }
      setImpact(result.impact);
      setPhase("waiting");
    } catch {
      setImpact(undefined);
      setError(
        "Se perdió la respuesta. Comprueba el estado antes de volver a intentar.",
      );
      setPhase("uncertain");
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    if (phase !== "waiting" || !open || autoChecked.current) return;
    autoChecked.current = true;
    const timer = setTimeout(() => void check(), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={props.compact ? "adminIconButton" : "adminButton"}
        aria-label={`Desactivar ${props.name}`}
        title="Desactivar característica"
        onClick={start}
      >
        {props.compact ? (
          <Ban aria-hidden size={16} />
        ) : (
          "Desactivar característica"
        )}
      </button>
      {open ? (
        <dialog
          className={styles.dialog}
          ref={dialog}
          aria-labelledby={title}
          aria-describedby={description}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <h2 id={title}>Desactivar «{props.name}»</h2>
          <p id={description}>
            Cambiarás una definición compartida del catálogo. Revisa el alcance
            antes de confirmar.
          </p>
          <p className="adminContextHint">
            Tienda actual: {props.shopName} · Idioma: {props.locale}
          </p>
          <div aria-live="polite" aria-busy={isPending}>
            {isPending ? (
              <p role="status" className={styles.progress}>
                <LoaderCircle
                  className={styles.spinner}
                  size={18}
                  aria-hidden
                />
                {phase === "loading"
                  ? "Calculando impacto…"
                  : phase === "saving"
                    ? "Desactivando…"
                    : "Cambio guardado. Comprobando la actualización del catálogo…"}
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
                    <dt>Productos que la utilizan</dt>
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
                <p>
                  Se conservarán los valores asignados a los productos. La
                  característica dejará de estar disponible como opción activa;
                  su visibilidad pública dependerá de la actualización del
                  catálogo.
                </p>
                <p>
                  Puedes volver a activarla desde el filtro Inactivos. No se
                  eliminará definitivamente.
                </p>
              </>
            ) : null}
            {phase === "waiting" ? (
              <p role="status">
                Cambio guardado. El listado todavía no confirma el estado
                actualizado. No repitas la desactivación.
              </p>
            ) : null}
            {phase === "complete" ? (
              <p role="status" className="adminBanner adminBannerSuccess">
                Completado: el listado ya refleja la característica inactiva.
              </p>
            ) : null}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className="adminButton"
              disabled={phase === "saving" || phase === "syncing"}
              onClick={close}
            >
              {phase === "review" || phase === "loading" || phase === "error"
                ? "Cancelar"
                : "Cerrar"}
            </button>
            {phase === "review" ? (
              <button
                type="button"
                className="adminButton"
                onClick={confirm}
              >
                Confirmar desactivación
              </button>
            ) : null}
            {phase === "error" || phase === "uncertain" ? (
              <button type="button" className="adminButton" onClick={review}>
                {phase === "uncertain"
                  ? "Comprobar estado"
                  : "Volver a calcular impacto"}
              </button>
            ) : null}
            {phase === "waiting" ? (
              <button type="button" className="adminButton" onClick={check}>
                Comprobar estado
              </button>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
