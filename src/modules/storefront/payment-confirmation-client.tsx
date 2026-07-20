"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearStorefrontPaymentAttempt,
  createStorefrontPaymentReceipt,
  getStorefrontPaymentTransaction,
  readStorefrontPaymentReceipt,
  readStorefrontPaymentAttempt,
  saveStorefrontPaymentReceipt,
  updateStorefrontPaymentAttemptStatus,
  type StorefrontPaymentReceipt,
  type StorefrontPaymentTransaction,
} from "./payments";

type PaymentConfirmationStatus = "idle" | "loading" | "completed" | "pending" | "error";

type PaymentConfirmationState = {
  message: string;
  receipt?: StorefrontPaymentReceipt;
  status: PaymentConfirmationStatus;
  trackingPath?: string;
  transaction?: StorefrontPaymentTransaction;
};

type StorefrontPaymentConfirmationClientProps = {
  guestSessionId?: string;
  orderId?: string;
  transactionId?: string;
};

export function StorefrontPaymentConfirmationClient({
  guestSessionId,
  orderId,
  transactionId,
}: StorefrontPaymentConfirmationClientProps) {
  const [state, setState] = useState<PaymentConfirmationState>({
    message: transactionId
      ? "Consultando estado de pago..."
      : "No recibimos una referencia de transacción para consultar.",
    status: transactionId ? "loading" : "idle",
  });

  useEffect(() => {
    if (!transactionId) {
      const timeoutId = window.setTimeout(() => {
        const receipt = readStorefrontPaymentReceipt();
        if (receipt) {
          setState({
            message: paymentConfirmationMessage(paymentConfirmationStatus(receipt.status), Boolean(orderId)),
            receipt,
            status: paymentConfirmationStatus(receipt.status),
          });
        }
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;
    const setSafeState = (nextState: PaymentConfirmationState) => {
      if (!cancelled) {
        setState(nextState);
      }
    };
    const timeoutId = window.setTimeout(() => {
      const attempt = readStorefrontPaymentAttempt();

      getStorefrontPaymentTransaction({
        correlationId: attempt?.correlationId,
        guestSessionId: attempt?.guestSessionId ?? guestSessionId,
        transactionId,
      })
        .then((transaction) => {
          const status = paymentConfirmationStatus(transaction.status);
          const receipt = createStorefrontPaymentReceipt({
            attempt,
            status: transaction.status,
            transaction,
          });
          if (status === "completed") {
            updateStorefrontPaymentAttemptStatus("SETTLED");
            saveStorefrontPaymentReceipt(receipt);
            clearStorefrontPaymentAttempt();
          } else if (status === "pending") {
            updateStorefrontPaymentAttemptStatus("RETURNED");
            saveStorefrontPaymentReceipt(receipt);
          } else if (status === "error") {
            updateStorefrontPaymentAttemptStatus("FAILED");
            saveStorefrontPaymentReceipt(receipt);
          }
          if (status === "completed" && orderId) {
            resolveTrackingPath(orderId, attempt?.guestSessionId ?? guestSessionId)
              .then((trackingPath) => setSafeState({ message: paymentConfirmationMessage(status, true), receipt, status, trackingPath, transaction }))
              .catch(() => setSafeState({ message: paymentConfirmationMessage(status, true), receipt, status, transaction }));
            return;
          }
          setSafeState({ message: paymentConfirmationMessage(status, Boolean(orderId)), receipt, status, transaction });
        })
        .catch(() => {
          setSafeState({
            message: paymentConfirmationMessage("error", Boolean(orderId)),
            status: "error",
          });
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [guestSessionId, orderId, transactionId]);

  const view = paymentConfirmationView(state.status, Boolean(orderId));

  return (
    <section className="storefrontConfirmation">
      <span>{view.label}</span>
      <h1>{view.title}</h1>
      <p>{state.message}</p>
      <div className="storefrontCheckoutActions">
        {state.status === "completed" && orderId ? (
          <>
            {state.trackingPath ? <Link href={state.trackingPath}>Ver seguimiento del pedido</Link> : null}
            <Link href="/">Seguir comprando</Link>
          </>
        ) : (
          <Link href="/checkout">Volver al checkout</Link>
        )}
      </div>
    </section>
  );
}

async function resolveTrackingPath(orderId: string, guestSessionId?: string) {
  const params = new URLSearchParams();
  if (guestSessionId) params.set("guestSessionId", guestSessionId);
  const response = await fetch(`/api/storefront/orders/${encodeURIComponent(orderId)}/tracking-link?${params.toString()}`, { method: "POST", cache: "no-store" });
  if (!response.ok) throw new Error("tracking link unavailable");
  const payload = await response.json() as { trackingPath?: unknown };
  if (typeof payload.trackingPath !== "string" || !payload.trackingPath.startsWith("/")) throw new Error("tracking link is invalid");
  return payload.trackingPath;
}

function paymentConfirmationStatus(status: string | undefined): PaymentConfirmationStatus {
  const normalized = status?.toUpperCase();
  if (
    normalized === "SETTLED" ||
    normalized === "AUTHORIZED" ||
    normalized === "SUCCEEDED" ||
    normalized === "APPROVED" ||
    normalized === "COMPLETED"
  ) {
    return "completed";
  }
  if (normalized === "FAILED" || normalized === "CANCELLED" || normalized === "CANCELED" || normalized === "DECLINED") {
    return "error";
  }
  return "pending";
}

function paymentConfirmationMessage(status: PaymentConfirmationStatus, hasOrder: boolean) {
  if (status === "completed") {
    if (!hasOrder) {
      return "Pago confirmado. Estamos preparando tu pedido.";
    }
    return "Gracias. Tu pago se registró correctamente.";
  }
  if (status === "error") {
    return "No pudimos confirmar el pago. Intenta de nuevo o usa otro método.";
  }
  return "El pago aún está en proceso. Revisa de nuevo en unos segundos.";
}

function paymentConfirmationView(status: PaymentConfirmationStatus, hasOrder: boolean) {
  if (status === "completed") {
    if (!hasOrder) {
      return {
        label: "Pago confirmado",
        title: "Confirmando pedido",
      };
    }
    return {
      label: "Pago confirmado",
      title: "Pago realizado",
    };
  }
  if (status === "error") {
    return {
      label: "Pago no confirmado",
      title: "No se completó el pago",
    };
  }
  return {
    label: "Pago en proceso",
    title: "Confirmando pago",
  };
}
