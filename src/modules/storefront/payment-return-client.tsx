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
  completeStorefrontPaymentReturn,
  createStorefrontPaymentAttempt,
  createStorefrontPaymentReceipt,
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
      }, 450);
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
        updateStorefrontPaymentAttemptStatus("CANCELLED");
        setSafeState({
          message: "No se realizó ningún cargo.",
          status: "cancelled",
          transactionId: attempt.transactionId,
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
        finalizePaidCheckout({
          attempt,
          transaction: {
            amountMinor: attempt.amountMinor,
            currency: attempt.currency,
            nextAction: { raw: {}, type: "NONE" },
            paymentSystemId: attempt.paymentSystemId,
            raw: {},
            status: "SETTLED",
            transactionId: attempt.transactionId,
          },
        })
          .then((result) => {
            if (cancelled) {
              return;
            }
            setSafeState({
              message: result.finalized ? "Pago confirmado." : "Pago en proceso. Te avisaremos cuando se confirme.",
              status: result.finalized ? "completed" : "pending",
              transactionId: attempt.transactionId,
            });
            if (result.finalized) {
              redirectToConfirmation(result.confirmationPath);
            }
          })
          .catch(() => {
            if (cancelled) {
              return;
            }
            setSafeState({
              message: "Pago en proceso. Te avisaremos cuando se confirme.",
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
          updateStorefrontPaymentAttemptStatus(completed ? "SETTLED" : "RETURNED");
          saveStorefrontPaymentReceipt(createStorefrontPaymentReceipt({
            attempt,
            status: transaction.status,
            transaction,
          }));
          const transactionId = transaction.transactionId || attempt.transactionId;
          let finalizeResult: PaidCheckoutFinalizeResult | null = null;
          if (completed) {
            finalizeResult = await finalizePaidCheckout({ attempt, transaction })
              .catch(() => ({
                confirmationPath: buildPaymentConfirmationPath({
                  guestSessionId: attempt.guestSessionId,
                  transactionId,
                }),
                finalized: false,
              }));
          }
          setSafeState({
            message: completed && finalizeResult?.finalized
              ? "Pago confirmado."
              : "Pago en proceso. Te avisaremos cuando se confirme.",
            status: completed && finalizeResult?.finalized ? "completed" : "pending",
            transactionId,
          });
          if (completed && finalizeResult?.finalized) {
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
      <div className="storefrontCheckoutActions">
        {state.status === "cancelled" || state.status === "error" || state.status === "pending" ? (
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
  return normalized === "SETTLED" ||
    normalized === "CAPTURED" ||
    normalized === "PAID" ||
    normalized === "SUCCEEDED" ||
    normalized === "COMPLETED";
}

function orderStatusForPaymentStatus(status: string | undefined) {
  const normalized = status?.toUpperCase();
  if (
    normalized === "SETTLED" ||
    normalized === "CAPTURED" ||
    normalized === "PAID" ||
    normalized === "SUCCEEDED" ||
    normalized === "COMPLETED"
  ) {
    return "PAYMENT_SETTLED";
  }
  if (normalized === "AUTHORIZED" || normalized === "APPROVED" || normalized === "REQUIRES_CAPTURE") {
    return "PAYMENT_AUTHORIZED";
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
  await deleteResponse.json().catch(() => ({}));

  const params = new URLSearchParams({ forceNewCart: "true" });
  if (guestSessionId) {
    params.set("guestSessionId", guestSessionId);
  }
  const nextResponse = await fetch(`/api/storefront/cart?${params.toString()}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const nextPayload = await nextResponse.json().catch(() => ({}));
  const nextOrderform = nextResponse.ok
    ? normalizeOrderformPayload(nextPayload)
    : normalizeOrderformPayload({ orderform: { items: [], totals: { grandTotalMinor: 0 } } });

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
    return "Pago en proceso";
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
