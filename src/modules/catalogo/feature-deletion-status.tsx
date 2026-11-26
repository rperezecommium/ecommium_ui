"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkFeatureDeletion,
  retryFeatureDeletionSynchronization,
  type FeatureDeletionContext,
} from "./feature-deletion-actions";
import type { FeatureDeletionStatus } from "./feature-deletion-contract";
export function FeatureDeletionStatusPanel({
  operationId,
  ...context
}: FeatureDeletionContext & { operationId: string }) {
  const [status, setStatus] = useState<FeatureDeletionStatus>(),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const busy = useRef(false),
    alive = useRef(true);
  const { organizationId, shopId, locale } = context;
  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const r = await checkFeatureDeletion({
        operationId,
        organizationId,
        shopId,
        locale,
      });
      if (!alive.current) return;
      if (r.ok) {
        setStatus(r.status);
        setError("");
      } else setError(r.error);
    } catch {
      if (alive.current)
        setError(
          "No se pudo comprobar la operación. No vuelvas a enviar la eliminación.",
        );
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }, [operationId, organizationId, shopId, locale]);
  useEffect(() => {
    alive.current = true;
    const timer = setTimeout(() => void check(), 0);
    return () => {
      clearTimeout(timer);
      alive.current = false;
    };
  }, [check]);
  async function retry() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const r = await retryFeatureDeletionSynchronization({
        operationId,
        ...context,
      });
      if (!r.ok) setError(r.error);
    } catch {
      setError("No se pudo reintentar la sincronización.");
    } finally {
      busy.current = false;
      setPending(false);
    }
    await check();
  }
  return (
    <section
      className={`adminBanner ${status?.complete ? "adminBannerSuccess" : "adminBannerWarning"}`}
      aria-label="Seguimiento de eliminación"
      aria-busy={pending}
    >
      <h2>
        {status?.complete
          ? "Eliminación completada en ReadIndex"
          : "Seguimiento de eliminación definitiva"}
      </h2>
      {pending ? <p role="status">Comprobando catálogo y ReadIndex…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {status ? (
        <>
          <p>
            «{status.name}» se eliminó del catálogo y de{" "}
            {status.affectedProducts.toLocaleString("es-ES")} productos. Las
            demás características se conservan.
          </p>
          <p>
            Tiendas verificadas sin la característica: {status.completedShops}{" "}
            de {status.totalShops}. Productos pendientes detectados en
            ReadIndex: {status.remainingProducts}. Definiciones pendientes:{" "}
            {status.remainingDefinitions}.
          </p>
          {status.unavailableShops > 0 ? (
            <p>
              Hay {status.unavailableShops} tiendas cuya sincronización no se ha
              podido verificar. No se dará la operación por completada hasta
              comprobarlas.
            </p>
          ) : null}
          {status.cacheInvalidationPending ? (
            <p>La solicitud de invalidación de caché sigue pendiente.</p>
          ) : null}
        </>
      ) : (
        <p>
          Este identificador permite recuperar el resultado aunque se haya
          perdido la respuesta. No se repetirá el borrado.
        </p>
      )}
      <p className="adminContextHint">Referencia de operación: {operationId}</p>
      <div className="adminButtonRow">
        <button
          className="adminButton"
          type="button"
          disabled={pending}
          onClick={check}
        >
          Comprobar estado
        </button>
        {status && !status.complete ? (
          <button
            className="adminButton"
            type="button"
            disabled={pending}
            onClick={retry}
          >
            Reintentar sincronización
          </button>
        ) : null}
      </div>
    </section>
  );
}
