"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearStorefrontPaymentAttempt,
  clearStorefrontPaymentReceipt,
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
  transaction?: StorefrontPaymentTransaction;
};

type StorefrontPaymentConfirmationClientProps = {
  transactionId?: string;
};

export function StorefrontPaymentConfirmationClient({ transactionId }: StorefrontPaymentConfirmationClientProps) {
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
            message: "Mostramos la ultima referencia de pago guardada en este navegador.",
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
        guestSessionId: attempt?.guestSessionId,
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
          setSafeState({
            message: paymentConfirmationMessage(status, transaction.status),
            receipt,
            status,
            transaction,
          });
        })
        .catch((error) => {
          setSafeState({
            message: error instanceof Error ? error.message : "No se pudo consultar el estado del pago.",
            status: "error",
          });
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [transactionId]);

  return (
    <section className="storefrontConfirmation">
      <span>{state.status === "completed" ? "Pago confirmado" : "Estado de pago"}</span>
      <h1>{state.status === "completed" ? "Tu pago fue confirmado" : "Confirmación en proceso"}</h1>
      <p>{state.message}</p>
      <dl>
        <div>
          <dt>Transacción</dt>
          <dd>{state.transaction?.transactionId ?? transactionId ?? "Pendiente"}</dd>
        </div>
        <div>
          <dt>Estado Payments</dt>
          <dd>{state.transaction?.status ?? state.receipt?.status ?? state.status}</dd>
        </div>
        {state.receipt ? (
          <>
            <div>
              <dt>Provider</dt>
              <dd>{state.receipt.provider === "paypal" ? "PayPal" : "Stripe"}</dd>
            </div>
            <div>
              <dt>Importe</dt>
              <dd>{paymentReceiptMoney(state.receipt)}</dd>
            </div>
            <div>
              <dt>Referencia soporte</dt>
              <dd>{state.receipt.supportReference}</dd>
            </div>
          </>
        ) : null}
      </dl>
      {state.status === "pending" || state.status === "error" ? (
        <div className="storefrontCheckoutActions">
          <Link href="/checkout">Volver al checkout</Link>
        </div>
      ) : null}
      {state.receipt ? (
        <div className="storefrontCheckoutActions">
          <button
            type="button"
            onClick={() => {
              clearStorefrontPaymentReceipt();
              setState((current) => {
                const next = { ...current };
                delete next.receipt;
                return next;
              });
            }}
          >
            Limpiar referencia local
          </button>
        </div>
      ) : null}
    </section>
  );
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

function paymentConfirmationMessage(status: PaymentConfirmationStatus, rawStatus: string | undefined) {
  if (status === "completed") {
    return "Payments confirmó la transacción. El pedido se mostrará cuando Orders publique su estado final.";
  }
  if (status === "error") {
    return rawStatus
      ? `Payments devolvió estado ${rawStatus}. Revisa el pago o intenta con otro método.`
      : "Payments no pudo confirmar la transacción.";
  }
  return rawStatus
    ? `Payments devolvió estado ${rawStatus}. Seguimos esperando la confirmación operativa.`
    : "Payments todavía no devolvió un estado final.";
}

function paymentReceiptMoney(receipt: StorefrontPaymentReceipt) {
  if (typeof receipt.amountMinor !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("es-ES", {
    currency: receipt.currency ?? "EUR",
    style: "currency",
  }).format(receipt.amountMinor / 100);
}
