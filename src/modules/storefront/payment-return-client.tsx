"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  cartGrandTotalMinor,
  cartTotalItems,
  normalizeOrderformPayload,
  type StorefrontOrderform,
} from "./cart";
import {
  cancelStorefrontPendingPaymentTransaction,
  clearStorefrontPaymentReceipt,
  completeStorefrontPaymentReturn,
  createStorefrontPaymentAttempt,
  createStorefrontPaymentReceipt,
  getStorefrontPaymentTransaction,
  hasProcessedStorefrontPaymentReturn,
  makeStorefrontPaymentReturnOnceKey,
  markStorefrontPaymentReturnProcessed,
  readStorefrontPaymentAttempt,
  sanitizePspReturnSearchParams,
  saveStorefrontPaymentAttempt,
  saveStorefrontPaymentReceipt,
  updateStorefrontPaymentAttemptStatus,
  type StorefrontPaymentAttempt,
  type StorefrontPaymentProvider,
  type StorefrontPaymentTransaction,
} from "./payments";

type PaymentReturnMode = "return" | "cancel";
type SupportedPaymentProvider = Exclude<StorefrontPaymentProvider, "unknown">;
type PaymentReturnStatus = "loading" | "completed" | "pending" | "cancelled" | "error";
type PaidCheckoutFinalizeResult = {
  confirmationPath: string;
  finalized: boolean;
};
type FinalizePaidCheckoutOptions = {
  attempts?: number;
  delayMs?: number;
  onRetry?: (attemptNumber: number) => void;
};

type PaymentReturnClientProps = {
  mode: PaymentReturnMode;
  provider: SupportedPaymentProvider;
};

type PaymentReturnState = {
  message: string;
  status: PaymentReturnStatus;
  transactionId?: string;
};

export function StorefrontPaymentReturnClient({ mode, provider }: PaymentReturnClientProps) {
  const router = useRouter();
  const [state, setState] = useState<PaymentReturnState>({
    message: mode === "cancel" ? "Pago cancelado." : "Confirmando pago...",
    status: "loading",
  });
  const sanitizedParams = useMemo(() => {
    if (typeof window === "undefined") {
      return {};
    }
    return sanitizePspReturnSearchParams(new URLSearchParams(window.location.search));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let redirectTimeoutId: number | undefined;
    const setSafeState = (nextState: PaymentReturnState) => {
      if (!cancelled) {
        setState(nextState);
      }
    };
    const redirectToConfirmation = (confirmationPath: string) => {
      redirectTimeoutId = window.setTimeout(() => {
        if (!cancelled) {
          router.replace(confirmationPath);
        }
      }, 1400);
    };
    const timeoutId = window.setTimeout(() => {
      const attempt = paymentReturnAttemptFromParams(provider, sanitizedParams) ?? readStorefrontPaymentAttempt();

      if (!attempt || attempt.provider !== provider) {
        setSafeState({
          message: "No pudimos confirmar el pago. Intenta de nuevo.",
          status: "error",
        });
        return;
      }

      if (mode === "cancel") {
        cancelStorefrontPendingPaymentTransaction({
          body: { reason: "CUSTOMER_CANCELLED" },
          correlationId: attempt.correlationId,
          guestSessionId: attempt.guestSessionId,
          transactionId: attempt.transactionId,
        })
          .then(async (transaction) => {
            if (cancelled) {
              return;
            }
            const status = transaction.status?.toUpperCase();
            if (status === "CANCELLED") {
              updateStorefrontPaymentAttemptStatus("CANCELLED");
              clearStorefrontPaymentReceipt();
              setSafeState({
                message: "No se realizó ningún cargo.",
                status: "cancelled",
                transactionId: attempt.transactionId,
              });
              return;
            }
            if (status === "SETTLED") {
              updateStorefrontPaymentAttemptStatus("SETTLED");
              saveStorefrontPaymentReceipt(createStorefrontPaymentReceipt({
                attempt,
                status: transaction.status,
                transaction,
              }));
              const result = await finalizePaidCheckout({ attempt, transaction }).catch(() => null);
              setSafeState({
                message: result?.finalized ? "Pago confirmado." : "El pago fue confirmado. Estamos preparando tu pedido.",
                status: "completed",
                transactionId: transaction.transactionId || attempt.transactionId,
              });
              if (result?.finalized) {
                redirectToConfirmation(result.confirmationPath);
              }
              return;
            }
            updateStorefrontPaymentAttemptStatus("RETURNED");
            setSafeState({
              message: "El pago aún está en proceso. Revisa su estado antes de intentarlo de nuevo.",
              status: "pending",
              transactionId: attempt.transactionId,
            });
          })
          .catch(async () => {
            try {
              const transaction = await getStorefrontPaymentTransaction({
                correlationId: attempt.correlationId,
                guestSessionId: attempt.guestSessionId,
                transactionId: attempt.transactionId,
              });
              if (cancelled) {
                return;
              }
              if (transaction.status?.toUpperCase() === "SETTLED") {
                updateStorefrontPaymentAttemptStatus("SETTLED");
                saveStorefrontPaymentReceipt(createStorefrontPaymentReceipt({
                  attempt,
                  status: transaction.status,
                  transaction,
                }));
                setSafeState({
                  message: "Pago realizado. Estamos preparando la confirmación del pedido.",
                  status: "completed",
                  transactionId: transaction.transactionId || attempt.transactionId,
                });
                return;
              }
              if (transaction.status?.toUpperCase() === "CANCELLED") {
                updateStorefrontPaymentAttemptStatus("CANCELLED");
                clearStorefrontPaymentReceipt();
                setSafeState({
                  message: "No se realizó ningún cargo.",
                  status: "cancelled",
                  transactionId: attempt.transactionId,
                });
                return;
              }
            } catch {
              // The cancellation request failed and the authoritative status is unavailable.
            }
            if (!cancelled) {
              setSafeState({
                message: "No pudimos confirmar la cancelación. El pago sigue pendiente de confirmación.",
                status: "pending",
                transactionId: attempt.transactionId,
              });
            }
          });
        return;
      }

      saveStorefrontPaymentAttempt(attempt);
      const pspReference = pspReturnReference(provider, sanitizedParams);
      const returnOnceKey = makeStorefrontPaymentReturnOnceKey({
        provider,
        pspReference,
        transactionId: attempt.transactionId,
      });

      if (hasProcessedStorefrontPaymentReturn(returnOnceKey)) {
        // sessionStorage only suppresses a duplicate mutating callback. It is
        // never proof that the PSP captured the payment, including after a
        // page refresh.
        getStorefrontPaymentTransaction({
          correlationId: attempt.correlationId,
          guestSessionId: attempt.guestSessionId,
          transactionId: attempt.transactionId,
        })
          .then(async (transaction) => {
            if (cancelled) {
              return;
            }
            const completed = isCompletedPaymentStatus(transaction.status);
            const outcome = paymentReturnOutcome(transaction.status);
            updateStorefrontPaymentAttemptStatus(paymentAttemptStatusForOutcome(outcome));
            saveStorefrontPaymentReceipt(createStorefrontPaymentReceipt({
              attempt,
              status: transaction.status,
              transaction,
            }));
            const result = completed
              ? await finalizePaidCheckoutWithRetry({ attempt, transaction }, {
                onRetry: () => {
                  setSafeState({
                    message: "Pago realizado. Estamos preparando la confirmación del pedido.",
                    status: "completed",
                    transactionId: transaction.transactionId || attempt.transactionId,
                  });
                },
              }).catch(() => notFinalizedCheckoutResult({
                currency: attempt.currency,
                guestSessionId: attempt.guestSessionId,
                quantity: String(attempt.itemsCount),
                revenueMinor: String(attempt.amountMinor),
                transactionId: transaction.transactionId || attempt.transactionId,
              }))
              : null;
            setSafeState({
              message: paymentReturnOutcomeMessage(outcome, Boolean(completed && result?.finalized)),
              status: completed ? "completed" : outcome,
              transactionId: attempt.transactionId,
            });
            if (completed && result) {
              redirectToConfirmation(result.confirmationPath);
            }
          })
          .catch(() => {
            if (cancelled) {
              return;
            }
            setSafeState({
              message: paymentReturnPendingMessage(provider),
              status: "pending",
              transactionId: attempt.transactionId,
            });
          });
        return;
      }

      completeStorefrontPaymentReturn(provider, {
        body: buildCompleteReturnPayload(provider, sanitizedParams, attempt.orderFormId, attempt.guestSessionId),
        correlationId: attempt.correlationId,
        guestSessionId: attempt.guestSessionId,
        transactionId: attempt.transactionId,
      })
        .then(async (transaction) => {
          if (cancelled) {
            return;
          }
          markStorefrontPaymentReturnProcessed(returnOnceKey);
          const completed = isCompletedPaymentStatus(transaction.status);
          const outcome = paymentReturnOutcome(transaction.status);
          updateStorefrontPaymentAttemptStatus(paymentAttemptStatusForOutcome(outcome));
          saveStorefrontPaymentReceipt(createStorefrontPaymentReceipt({
            attempt,
            status: transaction.status,
            transaction,
          }));
          const transactionId = transaction.transactionId || attempt.transactionId;
          let finalizeResult: PaidCheckoutFinalizeResult | null = null;
          if (completed) {
            setSafeState({
              message: "Pago realizado. Estamos preparando la confirmación del pedido.",
              status: "completed",
              transactionId,
            });
            finalizeResult = await finalizePaidCheckoutWithRetry({ attempt, transaction })
              .catch(() => notFinalizedCheckoutResult({
                currency: attempt.currency,
                guestSessionId: attempt.guestSessionId,
                quantity: String(attempt.itemsCount),
                revenueMinor: String(attempt.amountMinor),
                transactionId,
              }));
          }
          setSafeState({
            message: paymentReturnOutcomeMessage(outcome, Boolean(completed && finalizeResult?.finalized)),
            status: completed ? "completed" : outcome,
            transactionId,
          });
          if (completed && finalizeResult) {
            redirectToConfirmation(finalizeResult.confirmationPath);
          }
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          updateStorefrontPaymentAttemptStatus("FAILED");
          setSafeState({
            message: paymentReturnErrorMessage(error),
            status: "error",
            transactionId: attempt.transactionId,
          });
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      if (redirectTimeoutId !== undefined) {
        window.clearTimeout(redirectTimeoutId);
      }
    };
  }, [mode, provider, router, sanitizedParams]);

  return (
    <section className="storefrontCheckoutEmpty">
      <span>{provider === "paypal" ? "PayPal" : "Stripe"}</span>
      <h1>{paymentReturnTitle(state.status, mode)}</h1>
      <p>{state.message}</p>
      <PaymentReturnSteps provider={provider} status={state.status} />
      <div className="storefrontCheckoutActions">
        {state.status === "cancelled" || state.status === "error" ? (
          <Link href="/checkout">Volver al checkout</Link>
        ) : null}
      </div>
    </section>
  );
}

function paymentReturnAttemptFromParams(provider: SupportedPaymentProvider, params: Record<string, string>) {
  const transactionId = params.transactionId ?? params.tx ?? "";
  const orderFormId = params.orderFormId ?? params.orderformId ?? "";
  const paymentSystemId = params.paymentSystemId ?? (provider === "paypal" ? "paypal" : "stripe-card");

  if (!transactionId || !orderFormId) {
    return null;
  }

  return createStorefrontPaymentAttempt({
    actor: params.customerId ? "customer" : "guest",
    amountMinor: parsePositiveInteger(params.amountMinor),
    correlationId: params.correlationId ?? `return-${provider}-${transactionId}`,
    currency: params.currency ?? "",
    customerId: params.customerId,
    guestSessionId: params.guestSessionId,
    itemsCount: parsePositiveInteger(params.itemsCount),
    orderFormId,
    paymentSystemId,
    paymentSystemName: params.paymentSystemName ?? paymentSystemId,
    provider,
    status: "RETURNED",
    transactionId,
  });
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

function parsePositiveInteger(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isCompletedPaymentStatus(status: string | undefined) {
  const normalized = status?.toUpperCase();
  return normalized === "SETTLED";
}

function paymentReturnOutcome(status: string | undefined): PaymentReturnStatus {
  const normalized = status?.toUpperCase();
  if (normalized === "SETTLED") {
    return "completed";
  }
  if (normalized === "CANCELLED" || normalized === "CANCELED") {
    return "cancelled";
  }
  if (normalized === "DENIED" || normalized === "FAILED" || normalized === "DECLINED") {
    return "error";
  }
  return "pending";
}

function paymentAttemptStatusForOutcome(outcome: PaymentReturnStatus) {
  if (outcome === "completed") {
    return "SETTLED";
  }
  if (outcome === "cancelled") {
    return "CANCELLED";
  }
  if (outcome === "error") {
    return "FAILED";
  }
  return "RETURNED";
}

function paymentReturnOutcomeMessage(outcome: PaymentReturnStatus, finalized: boolean) {
  if (outcome === "completed") {
    return finalized ? "Pago confirmado." : "Pago realizado. Estamos preparando la confirmación del pedido.";
  }
  if (outcome === "cancelled") {
    return "No se realizó ningún cargo.";
  }
  if (outcome === "error") {
    return "El pago no fue confirmado. Puedes intentarlo de nuevo.";
  }
  return paymentReturnPendingMessage();
}

function paymentReturnPendingMessage(provider?: SupportedPaymentProvider) {
  const providerName = provider === "paypal" ? "PayPal" : provider === "stripe" ? "Stripe" : "el método de pago";
  return `Estamos confirmando la respuesta de ${providerName}. Esta pantalla avanzará automáticamente.`;
}

function PaymentReturnSteps({
  provider,
  status,
}: {
  provider: SupportedPaymentProvider;
  status: PaymentReturnStatus;
}) {
  if (status !== "loading" && status !== "pending" && status !== "completed") {
    return null;
  }

  const providerName = provider === "paypal" ? "PayPal" : "Stripe";
  const completed = status === "completed";
  const steps = completed
    ? [
        { done: true, label: "Pago realizado" },
        { done: true, label: "Alineando sistema" },
        { done: true, label: "Guardando respuesta" },
        { done: false, label: "Terminando proceso…" },
      ]
    : [
        { done: false, label: `Confirmando respuesta de ${providerName}` },
        { done: false, label: "Alineando sistema" },
        { done: false, label: "Guardando respuesta" },
        { done: false, label: "Terminando proceso…" },
      ];

  return (
    <ol className="storefrontPaymentReturnSteps" aria-label="Progreso del pago">
      {steps.map((step, index) => (
        <li
          className={[
            step.done ? "storefrontPaymentReturnStepDone" : "",
            index === 0 || completed ? "storefrontPaymentReturnStepActive" : "",
          ].filter(Boolean).join(" ") || undefined}
          key={step.label}
        >
          <span aria-hidden="true">{step.done ? "✅" : index === 0 || completed ? "●" : "○"}</span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

function orderStatusForPaymentStatus(status: string | undefined) {
  const normalized = status?.toUpperCase();
  if (normalized === "SETTLED") {
    return "PAYMENT_SETTLED";
  }
  return "PAYMENT_PENDING";
}

async function finalizePaidCheckout(input: {
  attempt: StorefrontPaymentAttempt;
  transaction: StorefrontPaymentTransaction;
}): Promise<PaidCheckoutFinalizeResult> {
  const orderform = await fetchPaymentReturnOrderform(input.attempt);
  const orderFormId = orderform.orderFormId ?? "";
  const itemsCount = cartTotalItems(orderform);
  const transactionId = input.transaction.transactionId || input.attempt.transactionId;
  const paymentStatus = input.transaction.status ?? input.attempt.status;
  const orderStatus = orderStatusForPaymentStatus(paymentStatus);
  const paymentData = {
    amountMinor: input.transaction.amountMinor ?? input.attempt.amountMinor,
    correlationId: input.attempt.correlationId,
    currency: input.transaction.currency ?? input.attempt.currency,
    provider: input.attempt.provider,
    status: paymentStatus,
    supportReference: [transactionId, input.attempt.correlationId].filter(Boolean).join(":"),
    transactionId,
  };

  if (!orderFormId || orderFormId !== input.attempt.orderFormId || itemsCount <= 0) {
    return {
      confirmationPath: buildPaymentConfirmationPath({
        guestSessionId: input.attempt.guestSessionId,
        transactionId,
      }),
      finalized: false,
    };
  }

  const response = await fetch("/api/storefront/checkout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "create-order",
      guestSessionId: input.attempt.guestSessionId,
      payload: {
        orderFormId,
        paymentData,
        paymentStatus,
        paymentTransactionId: transactionId,
        status: orderStatus,
        transactionId,
        checkoutContext: {
          orderFormId,
          paymentTransactionId: transactionId,
        },
        payment: paymentData,
        source: "storefront-payment-return",
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 409) {
    throw new Error(paymentReturnApiMessage(payload));
  }

  await resetPaidCheckoutCart(orderform, input.attempt.guestSessionId);

  const order = asRecord((payload as Record<string, unknown>).order);
  const firstItem = orderform.items[0];
  return {
    confirmationPath: buildPaymentConfirmationPath({
      currency: orderform.currency,
      guestSessionId: input.attempt.guestSessionId,
      orderId: asString(order.orderId) ?? orderFormId,
      productId: firstItem?.productId ?? firstItem?.productSlug ?? "cart",
      quantity: String(itemsCount),
      revenueMinor: String(cartGrandTotalMinor(orderform)),
      transactionId,
      variantId: firstItem?.variantId ?? "",
    }),
    finalized: true,
  };
}

async function finalizePaidCheckoutWithRetry(
  input: {
    attempt: StorefrontPaymentAttempt;
    transaction: StorefrontPaymentTransaction;
  },
  options: FinalizePaidCheckoutOptions = {},
) {
  const attempts = Math.max(1, options.attempts ?? 4);
  const delayMs = Math.max(0, options.delayMs ?? 1250);
  let lastError: unknown;

  for (let attemptNumber = 1; attemptNumber <= attempts; attemptNumber += 1) {
    try {
      const result = await finalizePaidCheckout(input);
      if (result.finalized || attemptNumber === attempts) {
        return result;
      }
    } catch (error) {
      lastError = error;
      if (attemptNumber === attempts) {
        throw error;
      }
    }

    options.onRetry?.(attemptNumber + 1);
    await delay(delayMs);
  }

  if (lastError) {
    throw lastError;
  }

  return notFinalizedCheckoutResult({
    guestSessionId: input.attempt.guestSessionId,
    transactionId: input.transaction.transactionId || input.attempt.transactionId,
  });
}

function notFinalizedCheckoutResult(input: {
  currency?: string;
  guestSessionId?: string;
  quantity?: string;
  revenueMinor?: string;
  transactionId: string;
}): PaidCheckoutFinalizeResult {
  return {
    confirmationPath: buildPaymentConfirmationPath(input),
    finalized: false,
  };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchPaymentReturnOrderform(attempt: StorefrontPaymentAttempt) {
  const params = new URLSearchParams();
  if (attempt.guestSessionId) {
    params.set("guestSessionId", attempt.guestSessionId);
  }

  const response = await fetch(`/api/storefront/cart${params.toString() ? `?${params.toString()}` : ""}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(paymentReturnApiMessage(payload));
  }
  return normalizeOrderformPayload(payload);
}

async function resetPaidCheckoutCart(orderform: StorefrontOrderform, guestSessionId?: string) {
  if (!orderform.orderFormId) {
    return;
  }

  const deleteResponse = await fetch("/api/storefront/cart/items", {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      guestSessionId,
      orderFormId: orderform.orderFormId,
    }),
  });
  const deletePayload = await deleteResponse.json().catch(() => ({}));
  if (!deleteResponse.ok) {
    throw new Error(`El pago fue confirmado, pero no pudimos vaciar el carrito: ${paymentReturnApiMessage(deletePayload)}`);
  }

  const clearedOrderform = normalizeOrderformPayload(deletePayload);
  if (clearedOrderform.items.length > 0) {
    throw new Error("El pago fue confirmado, pero el carrito no quedó vacío.");
  }

  const params = new URLSearchParams({ forceNewCart: "true" });
  if (guestSessionId) {
    params.set("guestSessionId", guestSessionId);
  }
  const nextResponse = await fetch(`/api/storefront/cart?${params.toString()}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const nextPayload = await nextResponse.json().catch(() => ({}));
  if (!nextResponse.ok) {
    throw new Error(`El pago fue confirmado, pero no pudimos preparar un carrito nuevo: ${paymentReturnApiMessage(nextPayload)}`);
  }

  const nextOrderform = normalizeOrderformPayload(nextPayload);
  if (nextOrderform.items.length > 0) {
    throw new Error("El pago fue confirmado, pero el nuevo carrito contiene artículos.");
  }

  window.localStorage.removeItem("ecommium_storefront_order_form_id");
  window.dispatchEvent(new CustomEvent("ecommium:cart-updated", { detail: nextOrderform }));
}

function buildPaymentConfirmationPath(input: {
  currency?: string;
  guestSessionId?: string;
  orderId?: string;
  productId?: string;
  quantity?: string;
  revenueMinor?: string;
  transactionId: string;
  variantId?: string;
}) {
  const params = new URLSearchParams({ transactionId: input.transactionId });
  if (input.guestSessionId) {
    params.set("guestSessionId", input.guestSessionId);
  }
  if (input.orderId) {
    params.set("orderId", input.orderId);
  }
  if (input.revenueMinor) {
    params.set("revenueMinor", input.revenueMinor);
  }
  if (input.currency) {
    params.set("currency", input.currency);
  }
  if (input.productId) {
    params.set("productId", input.productId);
  }
  if (input.variantId) {
    params.set("variantId", input.variantId);
  }
  if (input.quantity) {
    params.set("quantity", input.quantity);
  }
  return `/checkout/confirmation?${params.toString()}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function paymentReturnApiMessage(payload: unknown) {
  const record = asRecord(payload);
  return asString(record.message) ?? "No se pudo cerrar el checkout.";
}

function paymentReturnTitle(status: PaymentReturnStatus, mode: PaymentReturnMode) {
  if (mode === "cancel" || status === "cancelled") {
    return "Pago cancelado";
  }
  if (status === "completed") {
    return "Pago confirmado";
  }
  if (status === "pending") {
    return "Confirmando pago";
  }
  if (status === "error") {
    return "Pago no confirmado";
  }
  return "Confirmando pago";
}

function paymentReturnErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return "No pudimos confirmar el pago. Intenta de nuevo.";
  }
  return "No pudimos confirmar el pago. Intenta de nuevo.";
}
