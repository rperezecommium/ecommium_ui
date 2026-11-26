"use client";
import { useEffect, useState } from "react";
import { checkPricingRemovalStatus } from "./pricing-reviewed-removal-actions";
import type { RemovalReceiptRequest } from "./pricing-reviewed-removal-schema";

export function PricingRemovalStatus({
  operation,
}: {
  operation: RemovalReceiptRequest;
}) {
  const [result, setResult] = useState<{
      readStatus?: string;
      contexts?: number;
      error?: string;
    }>({}),
    [pending, setPending] = useState(false);
  async function check() {
    setPending(true);
    try {
      const response = await checkPricingRemovalStatus(operation);
      setResult(response.data ?? { error: response.error });
    } catch {
      setResult({
        error:
          "No se pudo verificar la actualización. Puedes volver a comprobarla sin repetir la eliminación.",
      });
    } finally {
      setPending(false);
    }
  }
  useEffect(() => {
    let active = true;
    checkPricingRemovalStatus(operation)
      .then((response) => {
        if (active) setResult(response.data ?? { error: response.error });
      })
      .catch(() => {
        if (active)
          setResult({
            error: "No se pudo verificar la actualización de las lecturas.",
          });
      });
    return () => {
      active = false;
    };
  }, [operation]);
  const complete = result.readStatus === "COMPLETE";
  return (
    <div className="adminBanner" role="status" aria-live="polite">
      <p>
        {complete
          ? `Eliminación completada y lecturas actualizadas en ${result.contexts} contextos.`
          : "Cambio guardado en Pricing. La actualización de las lecturas está pendiente de verificación."}
      </p>
      {result.error ? <p>{result.error}</p> : null}
      {!complete ? (
        <button
          className="adminButton"
          type="button"
          disabled={pending}
          onClick={check}
        >
          {pending ? "Verificando…" : "Verificar actualización"}
        </button>
      ) : null}
    </div>
  );
}
