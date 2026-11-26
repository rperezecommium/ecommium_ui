"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  reviewPricingRemoval,
  confirmPricingRemoval,
} from "./pricing-reviewed-removal-actions";
import {
  parseRemovalReview,
  type RemovalReview as Review,
  type RemovalAmount,
} from "./pricing-reviewed-removal-schema";
function Buttons({ ready, close }: { ready: boolean; close: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="adminButtonRow" aria-busy={pending}>
      <button
        className="adminButton"
        type="button"
        disabled={pending}
        onClick={close}
      >
        Cancelar
      </button>
      <button
        className="adminButton adminButtonDanger"
        type="submit"
        disabled={!ready || pending}
      >
        {pending ? "Aplicando…" : "Confirmar eliminación"}
      </button>
    </div>
  );
}
function money(
  value: RemovalAmount | null,
  currency: string,
  field: keyof RemovalAmount = "grossAmountMinor",
) {
  if (!value) return "Sin cobertura";
  const amount = value[field];
  if (typeof amount !== "number") return "Sin resultado";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
    amount /
      10 **
        (new Intl.NumberFormat("es-ES", {
          style: "currency",
          currency,
        }).resolvedOptions().maximumFractionDigits ?? 2),
  );
}
function blockerMessage(code: string) {
  const [reason, ...id] = code.split(":");
  const messages: Record<string, string> = {
    SOURCE_NOT_FOUND: "El recurso ya no existe.",
    SAME_REPLACEMENT: "Selecciona un recurso distinto como sustituto.",
    REPLACEMENT_UNAVAILABLE: "El sustituto no existe o está desactivado.",
    REPLACEMENT_TABLE_CURRENCY_MISMATCH: "La moneda de la tabla sustituta no admite todos los precios afectados.",
    TAX_REPLACEMENT_REQUIRED: "Selecciona un impuesto sustituto.",
    INVALID_REPLACEMENT_TAX:
      "El impuesto sustituto no tiene una configuración válida.",
    REPLACEMENT_TAX_COUNTRY_MISMATCH:
      "El país del impuesto sustituto no cubre todas las asignaciones.",
    REPLACEMENT_TAX_VALIDITY_GAP:
      "La vigencia del impuesto sustituto deja un intervalo sin cobertura.",
    PRICE_COVERAGE_REQUIRED:
      "Falta un precio de respaldo en alguna condición de venta.",
    TABLE_CONTEXT_REASSIGNMENT_REQUIRED:
      "Las consultas que conservan la tabla anterior quedarían sin precio.",
    FISCAL_COVERAGE_REQUIRED:
      "El precio de respaldo deja un intervalo sin impuesto válido.",
    COVERAGE_REVIEW_LIMIT:
      "El impacto excede el límite de revisión segura; la eliminación permanece bloqueada.",
  };
  return `${messages[reason] ?? "No se pudo demostrar una sustitución segura."}${id.length ? ` Precio: ${id.join(":")}.` : ""}`;
}
export function PricingReviewedRemoval({
  kind,
  code,
  close,
}: {
  kind: "taxes" | "price-tables";
  code: string;
  close: () => void;
}) {
  const [target, setTarget] = useState(""),
    [offset, setOffset] = useState(0),
    [options, setOptions] = useState<Review["options"]>([]),
    [review, setReview] = useState<Review>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    reviewPricingRemoval(kind, code, target, offset)
      .then((result) => {
        if (!current) return;
        if (!result.data) {
          setError(result.error ?? "La respuesta de revisión no es válida.");
          return;
        }
        const parsed = parseRemovalReview(result.data);
        setReview(parsed);
        setOptions(parsed.options);
      })
      .catch(() => {
        if (current) setError("No se pudo revisar el impacto.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [kind, code, target, offset]);
  function changePage(next: number) {
    setLoading(true);
    setError("");
    setReview(undefined);
    setOffset(next);
  }
  return (
    <form action={confirmPricingRemoval}>
      <p>
        El recurso solo se retirará si la revisión permite conservar una
        configuración válida. Los pedidos y facturas existentes no cambian.
      </p>
      <label className="adminField">
        <span>
          {kind === "taxes" ? "Impuesto sustituto" : "Tabla sustituta"}
        </span>
        <select
          value={target}
          onChange={(e) => {
            setLoading(true);
            setReview(undefined);
            setError("");
            setTarget(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">
            {kind === "taxes"
              ? "Selecciona un impuesto si tiene asignaciones"
              : "Comprobar respaldo sin otra tabla"}
          </option>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name} ({option.code})
            </option>
          ))}
        </select>
      </label>
      {loading ? <p role="status">Revisando impacto…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {review ? (
        <>
          <p>
            {review.affectedPrices} precios afectados. Se conservan sus importes
            almacenados y modalidad fiscal; revisa los totales resultantes.
          </p>
          {review.blockers.length ? (
            <div role="alert">
              <p>
                No se puede confirmar: falta una sustitución compatible o
                cobertura verificable.
              </p>
              <details>
                <summary>Detalle de los bloqueos</summary>
                <ul>
                  {review.blockers.map((b) => (
                    <li key={b}>{blockerMessage(b)}</li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}
          <details>
            <summary>
              Precios antes y después ({review.rows.length} de{" "}
              {review.affectedPrices}; desde {review.offset + 1})
            </summary>
            <div className="adminTableScroller">
              <table className="adminTable">
                <thead>
                  <tr>
                    <th>Precio</th>
                    <th>Neto anterior</th>
                    <th>Impuesto anterior</th>
                    <th>Total anterior</th>
                    <th>Neto posterior</th>
                    <th>Impuesto posterior</th>
                    <th>Total posterior</th>
                    {kind === "price-tables" && target ? (
                      <>
                        <th>Total previo en destino</th>
                        <th>Total consultando tabla anterior</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {review.rows.map((row) => (
                    <tr key={row.pricingId}>
                      <td>
                        {row.pricingId}
                        {row.context ? (
                          <details>
                            <summary>Condiciones del ejemplo</summary>
                            <p>
                              País: {row.context.country ?? "Todos"}; canal:{" "}
                              {row.context.channel ?? "Todos"}; política:{" "}
                              {row.context.tradePolicy ?? "Todas"}; grupo:{" "}
                              {row.context.customerGroup ?? "Todos"}; cantidad:{" "}
                              {row.context.quantity}; fecha:{" "}
                              {new Date(
                                row.context.atIsoDateTime,
                              ).toLocaleString("es-ES")}
                              .
                            </p>
                          </details>
                        ) : null}
                      </td>
                      <td>
                        {money(row.before, row.currency, "netAmountMinor")}
                      </td>
                      <td>
                        {money(row.before, row.currency, "taxAmountMinor")}
                      </td>
                      <td>{money(row.before, row.currency)}</td>
                      <td>
                        {money(row.after, row.currency, "netAmountMinor")}
                      </td>
                      <td>
                        {money(row.after, row.currency, "taxAmountMinor")}
                      </td>
                      <td>{money(row.after, row.currency)}</td>
                      {kind === "price-tables" && target ? (
                        <>
                          <td>{money(row.destinationBefore, row.currency)}</td>
                          <td>
                            {money(row.retainedContextAfter, row.currency)}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {review.affectedPrices > 50 ? (
              <nav className="adminButtonRow" aria-label="Páginas del impacto">
                <button
                  className="adminButton"
                  type="button"
                  disabled={loading || offset === 0}
                  onClick={() => changePage(Math.max(0, offset - 50))}
                >
                  Anterior
                </button>
                <button
                  className="adminButton"
                  type="button"
                  disabled={loading || offset + 50 >= review.affectedPrices}
                  onClick={() => changePage(offset + 50)}
                >
                  Siguiente
                </button>
              </nav>
            ) : null}
            <p>
              Los importes muestran un escenario de venta verificado por precio.
              La comprobación de cobertura incluye las condiciones y límites de
              cantidad y vigencia; los importes pueden variar entre escenarios.
            </p>
          </details>
        </>
      ) : null}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="replacementCode" value={target} />
      <input
        type="hidden"
        name="impactVersion"
        value={review?.impactVersion ?? ""}
      />
      <label className="adminCheckbox">
        <input
          key={review?.impactVersion ?? target}
          type="checkbox"
          name="confirm"
          value="yes"
          required
          disabled={loading || !!error || !review?.canConfirm}
        />
        Confirmo el impacto y la eliminación definitiva.
      </label>
      <Buttons
        ready={!loading && !error && review?.canConfirm === true}
        close={close}
      />
    </form>
  );
}
