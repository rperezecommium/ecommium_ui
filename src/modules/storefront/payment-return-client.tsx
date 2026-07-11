"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  clearStorefrontPaymentAttempt,
  completeStorefrontPaymentReturn,
  hasProcessedStorefrontPaymentReturn,
  makeStorefrontPaymentReturnOnceKey,
  markStorefrontPaymentReturnProcessed,
  readStorefrontPaymentAttempt,
  sanitizePspReturnSearchParams,
  updateStorefrontPaymentAttemptStatus,
  type StorefrontPaymentProvider,
} from "./payments";

type PaymentReturnMode = "return" | "cancel";
type SupportedPaymentProvider = Exclude<StorefrontPaymentProvider, "unknown">;
type PaymentReturnStatus = "loading" | "completed" | "pending" | "cancelled" | "error";

type PaymentReturnClientProps = {
  mode: PaymentReturnMode;
  provider: SupportedPaymentProvider;
};

type PaymentReturnState = {
  correlationId?: string;
  message: string;
  status: PaymentReturnStatus;
  transactionId?: string;
};

export function StorefrontPaymentReturnClient({ mode, provider }: PaymentReturnClientProps) {
  const [state, setState] = useState<PaymentReturnState>({
    message: mode === "cancel" ? "Cancelando intento de pago..." : "Sincronizando pago con el proveedor...",
    status: "loading",
  });
  const title = mode === "cancel" ? "Pago cancelado" : "Estamos confirmando tu pago";
  const sanitizedParams = useMemo(() => {
    if (typeof window === "undefined") {
      return {};
    }
    return sanitizePspReturnSearchParams(new URLSearchParams(window.location.search));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const setSafeState = (nextState: PaymentReturnState) => {
      if (!cancelled) {
        setState(nextState);
      }
    };
    const timeoutId = window.setTimeout(() => {
      const attempt = readStorefrontPaymentAttempt();

      if (!attempt || attempt.provider !== provider) {
        setSafeState({
          message: "No encontramos un intento de pago activo para esta devolución.",
          status: "error",
        });
        return;
      }

      if (mode === "cancel") {
        updateStorefrontPaymentAttemptStatus("CANCELLED");
        setSafeState({
          correlationId: attempt.correlationId,
          message: "El proveedor canceló el pago. Puedes volver al checkout y seleccionar un método de pago.",
          status: "cancelled",
          transactionId: attempt.transactionId,
        });
        return;
      }

      const pspReference = pspReturnReference(provider, sanitizedParams);
      const returnOnceKey = makeStorefrontPaymentReturnOnceKey({
        provider,
        pspReference,
        transactionId: attempt.transactionId,
      });

      if (hasProcessedStorefrontPaymentReturn(returnOnceKey)) {
        setSafeState({
          correlationId: attempt.correlationId,
          message: "Este retorno de pago ya fue procesado en esta sesión.",
          status: "completed",
          transactionId: attempt.transactionId,
        });
        return;
      }

      completeStorefrontPaymentReturn(provider, {
        body: buildCompleteReturnPayload(provider, sanitizedParams, attempt.orderFormId, attempt.guestSessionId),
        correlationId: attempt.correlationId,
        guestSessionId: attempt.guestSessionId,
        transactionId: attempt.transactionId,
      })
        .then((transaction) => {
          if (cancelled) {
            return;
          }
          markStorefrontPaymentReturnProcessed(returnOnceKey);
          const completed = isCompletedPaymentStatus(transaction.status);
          updateStorefrontPaymentAttemptStatus(completed ? "SETTLED" : "RETURNED");
          setSafeState({
            correlationId: attempt.correlationId,
            message: completed
              ? "Pago confirmado. Estamos preparando la confirmación operativa del pedido."
              : "Pago recibido por el proveedor. Seguimos esperando la confirmación final.",
            status: completed ? "completed" : "pending",
            transactionId: transaction.transactionId || attempt.transactionId,
          });
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          updateStorefrontPaymentAttemptStatus("FAILED");
          setSafeState({
            correlationId: attempt.correlationId,
            message: error instanceof Error ? error.message : "No se pudo confirmar el retorno de pago.",
            status: "error",
            transactionId: attempt.transactionId,
          });
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [mode, provider, sanitizedParams]);

  return (
    <section className="storefrontCheckoutEmpty">
      <span>{provider === "paypal" ? "PayPal" : "Stripe"}</span>
      <h1>{title}</h1>
      <p>{state.message}</p>
      {state.transactionId || state.correlationId ? (
        <dl className="storefrontCheckoutMiniSummary">
          {state.transactionId ? (
            <div>
              <dt>Transacción</dt>
              <dd>{state.transactionId}</dd>
            </div>
          ) : null}
          {state.correlationId ? (
            <div>
              <dt>Correlation</dt>
              <dd>{state.correlationId}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <div className="storefrontCheckoutActions">
        {state.status === "completed" ? (
          <Link href={`/checkout/confirmation?transactionId=${encodeURIComponent(state.transactionId ?? "")}`}>
            Ver confirmación
          </Link>
        ) : null}
        {state.status === "cancelled" || state.status === "error" || state.status === "pending" ? (
          <Link href="/checkout">Volver al checkout</Link>
        ) : null}
        {state.status === "completed" ? (
          <button type="button" onClick={clearStorefrontPaymentAttempt}>Cerrar intento local</button>
        ) : null}
      </div>
    </section>
  );
}

function buildCompleteReturnPayload(
  provider: SupportedPaymentProvider,
  params: Record<string, string>,
  orderFormId: string,
  guestSessionId?: string,
) {
  if (provider === "paypal") {
    return {
      authorizationId: params.authorizationId,
      guestSessionId,
      orderFormId,
      payerId: params.PayerID ?? params.payerId,
      paymentId: params.paymentId,
      rawReturnData: params,
      token: params.token,
    };
  }

  return {
    guestSessionId,
    orderFormId,
    rawReturnData: params,
    sessionId: params.session_id ?? params.sessionId,
  };
}

function pspReturnReference(provider: SupportedPaymentProvider, params: Record<string, string>) {
  if (provider === "paypal") {
    return [
      params.token,
      params.PayerID ?? params.payerId,
      params.paymentId,
      params.authorizationId,
    ].filter(Boolean).join(":");
  }

  return params.session_id ?? params.sessionId ?? "";
}

function isCompletedPaymentStatus(status: string | undefined) {
  const normalized = status?.toUpperCase();
  return normalized === "SETTLED" ||
    normalized === "AUTHORIZED" ||
    normalized === "SUCCEEDED" ||
    normalized === "APPROVED" ||
    normalized === "COMPLETED";
}
