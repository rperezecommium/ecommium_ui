"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import {
  cartAppliedCouponOffer,
  cartAvailableCoupons,
  cartCouponCode,
  cartDiscountsTotalMinor,
  cartHasCouponData,
  cartHasShippingData,
  cartGrandTotalMinor,
  cartItemLineTotalMinor,
  cartItemUnitPriceMinor,
  cartItemsSubtotalMinor,
  cartOfferingsTotalMinor,
  cartTotalItems,
  formatCartMoney,
  normalizeOrderformPayload,
  type StorefrontCartItem,
  type StorefrontCartOffering,
  type StorefrontCouponOffer,
  type StorefrontOrderform,
} from "./cart";

const guestSessionStorageKey = "ecommium_storefront_guest_session_id";
const orderFormStorageKey = "ecommium_storefront_order_form_id";
const cartUpdatedEventName = "ecommium:cart-updated";

type AddToCartButtonProps = {
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  onAdded?: (orderform: StorefrontOrderform) => void;
  offerings?: StorefrontCartOffering[];
  quantity: number;
  refId?: string;
  variantId?: string;
};

type AddedCartSnapshot = {
  item: StorefrontCartItem | null;
  orderform: StorefrontOrderform;
  quantityAdded: number;
};

type CartMutationItem = {
  itemIndex?: number;
  offerings?: StorefrontCartOffering[];
  quantity: number;
  refId?: string;
  variantId?: string;
};

export type CouponMessageStatus = "error" | "info" | "success";

type StorefrontCouponControlProps = {
  appliedCouponCode?: string;
  appliedCouponOffer?: StorefrontCouponOffer;
  availableCoupons?: StorefrontCouponOffer[];
  couponCode: string;
  currency: string;
  discountMinor?: number;
  hasAppliedCoupon?: boolean;
  invalidCouponCode?: string;
  message?: string;
  messageStatus?: CouponMessageStatus;
  onApply: () => void;
  onChange: (value: string) => void;
  onRemove: () => void;
  onSelectAvailableCoupon?: (couponCode: string) => void;
  pendingAction: string | null;
  pendingCouponCode?: string;
};

export function StorefrontCartStatus() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const syncFromOrderform = (orderform: StorefrontOrderform) => setCount(cartTotalItems(orderform));
    const syncFromEvent = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      syncFromOrderform(normalizeOrderformPayload(detail));
    };

    window.addEventListener(cartUpdatedEventName, syncFromEvent);

    if (readGuestSessionId() && readOrderFormId()) {
      fetchCartCurrent({ createGuest: false })
        .then(syncFromOrderform)
        .catch(() => setCount(0));
    }

    return () => window.removeEventListener(cartUpdatedEventName, syncFromEvent);
  }, []);

  return (
    <Link className="storefrontCartStatus" href="/cart">
      <ShoppingCart aria-hidden="true" size={18} />
      <span>Carrito</span>
      <strong className="storefrontCartBadge">{count}</strong>
    </Link>
  );
}

export function StorefrontAddToCartButton({
  className,
  compact,
  disabled,
  onAdded,
  offerings = [],
  quantity,
  refId,
  variantId,
}: AddToCartButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "added" | "error">("idle");
  const [addedSnapshot, setAddedSnapshot] = useState<AddedCartSnapshot | null>(null);
  const canAdd = !disabled && quantity > 0 && Boolean(variantId || refId);
  const label = status === "loading" ? "Añadiendo" : status === "added" ? "Añadido" : compact ? "Añadir" : "Añadir al carrito";

  async function addItem() {
    if (!canAdd || status === "loading") {
      return;
    }

    setStatus("loading");
    try {
      const guestSessionId = getOrCreateGuestSessionId();
      const current = await fetchCartCurrent({ guestSessionId });
      const orderFormId = current.orderFormId;
      if (!orderFormId) {
        throw new Error("El carrito no devolvio orderFormId.");
      }

      let orderform = await mutateCart("POST", {
        guestSessionId,
        items: [{
          offerings: offerings.length > 0 ? offerings : undefined,
          quantity,
          refId,
          variantId,
        }],
        orderFormId,
      });
      const selectedOfferings = offerings.filter((offering) => offering.offeringId);
      let addedItemIndex = findAddedCartItemIndex(orderform, { refId, variantId });
      const missingOfferingIds = missingCartOfferingIds(orderform.items[addedItemIndex], selectedOfferings);
      if (missingOfferingIds.length > 0 && addedItemIndex >= 0) {
        for (const offeringId of missingOfferingIds) {
          orderform = await mutateCartOffering({
            guestSessionId,
            itemIndex: addedItemIndex,
            offeringId,
            orderFormId: orderform.orderFormId ?? orderFormId,
          });
          addedItemIndex = findAddedCartItemIndex(orderform, { refId, variantId });
        }
      }
      commitOrderform(orderform);
      setAddedSnapshot({
        item: findAddedCartItem(orderform, { refId, variantId }),
        orderform,
        quantityAdded: quantity,
      });
      onAdded?.(orderform);
      setStatus("added");
      window.setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2200);
    }
  }

  return (
    <>
      <button className={className} disabled={!canAdd || status === "loading"} onClick={addItem} type="button">
        {status === "loading" ? <Loader2 aria-hidden="true" className="storefrontCartSpinner" size={18} /> : <ShoppingCart aria-hidden="true" size={18} />}
        <span>{status === "error" ? "No añadido" : label}</span>
      </button>
      {addedSnapshot ? (
        <StorefrontCartConfirmationDialog
          snapshot={addedSnapshot}
          onClose={() => setAddedSnapshot(null)}
        />
      ) : null}
    </>
  );
}

export function StorefrontCouponControl({
  appliedCouponCode,
  appliedCouponOffer,
  availableCoupons = [],
  couponCode,
  currency,
  discountMinor = 0,
  hasAppliedCoupon,
  invalidCouponCode,
  message,
  messageStatus = "info",
  onApply,
  onChange,
  onRemove,
  onSelectAvailableCoupon,
  pendingAction,
  pendingCouponCode,
}: StorefrontCouponControlProps) {
  const couponIsApplied = hasAppliedCoupon ?? Boolean(appliedCouponCode);
  const appliedCouponLabel = appliedCouponCode ?? "Promoción";
  const hasAvailableCoupons = availableCoupons.length > 0;
  const visibleCoupons = availableCoupons.slice(0, 3);
  const hiddenCouponsCount = Math.max(0, availableCoupons.length - visibleCoupons.length);
  const autoOpenPanelKey = `${couponIsApplied}:${appliedCouponLabel}:${messageStatus}:${message ?? ""}`;
  const shouldAutoOpenPanel = couponIsApplied || Boolean(message);
  const [manuallyClosedPanelKey, setManuallyClosedPanelKey] = useState<string | null>(null);
  const [userOpenedPanel, setUserOpenedPanel] = useState(false);
  const panelOpen = shouldAutoOpenPanel
    ? manuallyClosedPanelKey !== autoOpenPanelKey
    : userOpenedPanel;
  const isApplying = pendingAction === "coupon";
  const isRemoving = pendingAction === "remove-coupon";
  const isBusy = isApplying || isRemoving;
  const couponControlId = useId();
  const couponInputId = `${couponControlId}-input`;
  const couponMessageId = `${couponControlId}-message`;
  const couponSummaryId = `${couponControlId}-summary`;
  const currentCouponCode = normalizeCouponCodeInput(couponCode);
  const normalizedPendingCouponCode = normalizeCouponCodeInput(pendingCouponCode ?? "");
  const hasInvalidCurrentCode = Boolean(
    invalidCouponCode &&
    messageStatus === "error" &&
    currentCouponCode === invalidCouponCode,
  );
  const appliedCouponDetail = appliedCouponOffer
    ? discountMinor > 0
      ? couponOfferConstraint(appliedCouponOffer, currency)
      : couponOfferBenefit(appliedCouponOffer, currency)
    : undefined;

  return (
    <details
      aria-busy={isBusy}
      aria-labelledby={couponSummaryId}
      className="storefrontCouponPanel"
      onToggle={(event) => {
        const isOpen = event.currentTarget.open;
        setUserOpenedPanel(isOpen);
        setManuallyClosedPanelKey(shouldAutoOpenPanel && !isOpen ? autoOpenPanelKey : null);
      }}
      open={panelOpen}
    >
      <summary className="storefrontCouponSummary" id={couponSummaryId}>
        <span>{couponIsApplied ? "Cupón aplicado" : hasAvailableCoupons ? "Cupón disponible" : "¿Tienes un cupón?"}</span>
        <strong>{couponIsApplied ? appliedCouponLabel : hasAvailableCoupons ? availableCoupons[0].couponCode : "Añadir código"}</strong>
      </summary>
      <div className="storefrontCouponBody">
        {couponIsApplied ? (
          <div className="storefrontCouponApplied">
            <div>
              <strong>{appliedCouponLabel}</strong>
              <span>{discountMinor > 0 ? `Ahorro ${formatCartMoney(discountMinor, currency)}` : "Promoción activa"}</span>
              {appliedCouponDetail ? <em>{appliedCouponDetail}</em> : null}
            </div>
            <button disabled={isRemoving} onClick={onRemove} type="button">
              {isRemoving ? <Loader2 aria-hidden="true" className="storefrontCartSpinner" size={15} /> : <X aria-hidden="true" size={15} />}
              Quitar
            </button>
          </div>
        ) : (
          <>
            {hasAvailableCoupons ? (
              <div className="storefrontCouponOffers" aria-label="Cupones disponibles">
                {visibleCoupons.map((coupon) => {
                  const constraint = couponOfferConstraint(coupon, currency);
                  const isCouponOfferApplying = isApplying && normalizedPendingCouponCode === coupon.couponCode;
                  return (
                    <button
                      disabled={isApplying}
                      key={coupon.couponCode}
                      onClick={() => onSelectAvailableCoupon?.(coupon.couponCode)}
                      type="button"
                    >
                      <span>
                        <strong>{coupon.couponCode}</strong>
                        <small>{couponOfferBenefit(coupon, currency)}</small>
                        {constraint ? <em>{constraint}</em> : null}
                      </span>
                      <b>
                        {isCouponOfferApplying ? <Loader2 aria-hidden="true" className="storefrontCartSpinner" size={13} /> : null}
                        {isCouponOfferApplying ? "Aplicando" : "Usar"}
                      </b>
                    </button>
                  );
                })}
                {hiddenCouponsCount > 0 ? (
                  <p className="storefrontCouponMore">{hiddenCouponsCount === 1 ? "Hay 1 cupón más disponible." : `Hay ${hiddenCouponsCount} cupones más disponibles.`}</p>
                ) : null}
              </div>
            ) : null}
            <form className="storefrontCouponForm" onSubmit={(event) => {
              event.preventDefault();
              onApply();
            }}>
              <label htmlFor={couponInputId}>
                <span>Código</span>
                <input
                  aria-describedby={message ? couponMessageId : undefined}
                  aria-invalid={hasInvalidCurrentCode}
                  autoComplete="off"
                  id={couponInputId}
                  onChange={(event) => onChange(event.currentTarget.value)}
                  placeholder="WELCOME10"
                  value={couponCode}
                />
              </label>
              <button disabled={!couponCode.trim() || isApplying || hasInvalidCurrentCode} type="submit">
                {isApplying ? <Loader2 aria-hidden="true" className="storefrontCartSpinner" size={15} /> : null}
                Aplicar
              </button>
            </form>
          </>
        )}
        {message ? (
          <p
            aria-live={messageStatus === "error" ? "assertive" : "polite"}
            className={`storefrontCouponMessage storefrontCouponMessage${messageStatus}`}
            id={couponMessageId}
            role={messageStatus === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </div>
    </details>
  );
}

export function normalizeCouponCodeInput(value: string) {
  return value.trim().toUpperCase();
}

export function couponApplicationFeedback(orderform: StorefrontOrderform, requestedCode: string) {
  const appliedCode = cartCouponCode(orderform);
  const discountMinor = cartDiscountsTotalMinor(orderform);
  const codeLabel = appliedCode ?? requestedCode;

  if (cartHasCouponData(orderform) || discountMinor > 0) {
    return {
      message: discountMinor > 0
        ? `Cupón ${codeLabel} aplicado. Ahorro ${formatCartMoney(discountMinor, orderform.currency)}.`
        : `Cupón ${codeLabel} aplicado.`,
      status: "success" as CouponMessageStatus,
    };
  }

  return {
    message: `No pudimos validar el cupón ${requestedCode}. Revisa el código o sus condiciones.`,
    status: "error" as CouponMessageStatus,
  };
}

export function couponOfferBenefit(coupon: StorefrontCouponOffer, fallbackCurrency = "EUR") {
  const discountType = coupon.discountType?.toUpperCase() ?? "";
  const currency = coupon.currency ?? fallbackCurrency;

  if (typeof coupon.value === "number" && Number.isFinite(coupon.value)) {
    if (discountType.includes("PERCENT")) {
      return `${coupon.value}% descuento`;
    }
    if (discountType.includes("FIXED") || discountType.includes("AMOUNT")) {
      return `${formatCartMoney(coupon.value, currency)} descuento`;
    }
  }

  return coupon.description ?? coupon.name;
}

export function couponOfferConstraint(coupon: StorefrontCouponOffer, fallbackCurrency = "EUR") {
  const conditions = [];
  if (typeof coupon.minSubtotalMinor === "number" && coupon.minSubtotalMinor > 0) {
    conditions.push(`Desde ${formatCartMoney(coupon.minSubtotalMinor, coupon.currency ?? fallbackCurrency)}`);
  }
  const validTo = formatCouponDate(coupon.validTo);
  if (validTo) {
    conditions.push(`Hasta ${validTo}`);
  }

  return conditions.slice(0, 2).join(" · ");
}

function formatCouponDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function StorefrontCartPageClient() {
  const [orderform, setOrderform] = useState<StorefrontOrderform | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [invalidCouponCode, setInvalidCouponCode] = useState<string | undefined>();
  const [couponMessage, setCouponMessage] = useState("");
  const [couponMessageStatus, setCouponMessageStatus] = useState<CouponMessageStatus>("info");
  const [pendingCouponCode, setPendingCouponCode] = useState<string | undefined>();

  useEffect(() => {
    fetchCartCurrent()
      .then((nextOrderform) => {
        commitOrderform(nextOrderform);
        setOrderform(nextOrderform);
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
      });
  }, []);

  const totals = useMemo(() => ({
    items: cartTotalItems(orderform),
    subtotal: cartItemsSubtotalMinor(orderform),
    shipping: orderform?.totals.shippingTotalMinor ?? 0,
    taxes: orderform?.totals.taxTotalMinor ?? 0,
    grandTotal: cartGrandTotalMinor(orderform),
  }), [orderform]);

  async function updateLineQuantity(itemIndex: number, quantity: number) {
    if (!orderform?.orderFormId) {
      return;
    }

    setPendingKey(`line-${itemIndex}`);
    try {
      const nextOrderform = await mutateCart("PATCH", {
        guestSessionId: getOrCreateGuestSessionId(),
        items: [{ itemIndex, quantity: Math.max(0, quantity) }],
        orderFormId: orderform.orderFormId,
      });
      commitOrderform(nextOrderform);
      setOrderform(nextOrderform);
    } finally {
      setPendingKey(null);
    }
  }

  async function addLineOffering(itemIndex: number, offeringId: string) {
    if (!orderform?.orderFormId || !offeringId) {
      return;
    }

    setPendingKey(`offering-${itemIndex}-${offeringId}`);
    try {
      const nextOrderform = await mutateCartOffering({
        guestSessionId: getOrCreateGuestSessionId(),
        itemIndex,
        offeringId,
        orderFormId: orderform.orderFormId,
      });
      commitOrderform(nextOrderform);
      setOrderform(nextOrderform);
    } finally {
      setPendingKey(null);
    }
  }

  async function removeLineOffering(itemIndex: number, offeringId: string) {
    if (!orderform?.orderFormId || !offeringId) {
      return;
    }

    setPendingKey(`offering-remove-${itemIndex}-${offeringId}`);
    try {
      const nextOrderform = await mutateCartOffering({
        guestSessionId: getOrCreateGuestSessionId(),
        itemIndex,
        method: "DELETE",
        offeringId,
        orderFormId: orderform.orderFormId,
      });
      commitOrderform(nextOrderform);
      setOrderform(nextOrderform);
    } finally {
      setPendingKey(null);
    }
  }

  async function clearCart() {
    if (!orderform?.orderFormId || orderform.items.length === 0) {
      return;
    }

    setPendingKey("clear");
    try {
      const nextOrderform = await mutateCart("DELETE", {
        guestSessionId: getOrCreateGuestSessionId(),
        items: [],
        orderFormId: orderform.orderFormId,
      });
      commitOrderform(nextOrderform);
      setOrderform(nextOrderform);
    } finally {
      setPendingKey(null);
    }
  }

  async function applyCouponCode(nextCouponCode: string) {
    const code = normalizeCouponCodeInput(nextCouponCode);
    if (!orderform?.orderFormId || !code) {
      return;
    }

    if (cartCouponCode(orderform)?.toUpperCase() === code) {
      setCouponCode(code);
      setInvalidCouponCode(undefined);
      setPendingCouponCode(undefined);
      setCouponMessage(`El cupón ${code} ya está aplicado.`);
      setCouponMessageStatus("info");
      return;
    }

    setCouponCode(code);
    setInvalidCouponCode(undefined);
    setPendingCouponCode(code);
    setPendingKey("coupon");
    setCouponMessage(`Validando cupón ${code}...`);
    setCouponMessageStatus("info");
    try {
      const nextOrderform = await mutateCheckoutCoupon("coupon", {
        guestSessionId: getOrCreateGuestSessionId(),
        orderFormId: orderform.orderFormId,
        payload: { couponCode: code },
      });
      commitOrderform(nextOrderform);
      setOrderform(nextOrderform);
      const feedback = couponApplicationFeedback(nextOrderform, code);
      setCouponMessage(feedback.message);
      setCouponMessageStatus(feedback.status);
      setInvalidCouponCode(feedback.status === "error" ? code : undefined);
    } catch (error) {
      setCouponMessage(error instanceof Error ? error.message : "No se pudo aplicar el cupón.");
      setCouponMessageStatus("error");
    } finally {
      setPendingCouponCode(undefined);
      setPendingKey(null);
    }
  }

  async function applyCoupon() {
    await applyCouponCode(couponCode);
  }

  function updateCouponCode(value: string) {
    setCouponCode(value);
    setInvalidCouponCode(undefined);
    if (couponMessageStatus === "error") {
      setCouponMessage("");
      setCouponMessageStatus("info");
    }
  }

  async function removeCoupon() {
    if (!orderform?.orderFormId) {
      return;
    }

    setPendingKey("remove-coupon");
    setCouponMessage("");
    setCouponMessageStatus("info");
    try {
      const nextOrderform = await mutateCheckoutCoupon("remove-coupon", {
        guestSessionId: getOrCreateGuestSessionId(),
        orderFormId: orderform.orderFormId,
      });
      commitOrderform(nextOrderform);
      setOrderform(nextOrderform);
      setCouponCode("");
      setInvalidCouponCode(undefined);
      setCouponMessage("Cupón quitado.");
      setCouponMessageStatus("info");
    } catch (error) {
      setCouponMessage(error instanceof Error ? error.message : "No se pudo quitar el cupón.");
      setCouponMessageStatus("error");
    } finally {
      setPendingKey(null);
    }
  }

  if (status === "loading") {
    return (
      <section className="storefrontCartEmpty">
        <Loader2 aria-hidden="true" className="storefrontCartSpinner" size={24} />
        <p>Cargando carrito</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="storefrontCartEmpty">
        <h1>No se pudo cargar el carrito</h1>
        <p>Revisa que el BFF este levantado y vuelve a intentarlo.</p>
        <Link href="/plp/bike-drivetrain">Volver al catalogo</Link>
      </section>
    );
  }

  if (!orderform || orderform.items.length === 0) {
    return (
      <section className="storefrontCartEmpty">
        <ShoppingCart aria-hidden="true" size={30} />
        <h1>Tu carrito esta vacio</h1>
        <p>Añade productos desde el listado o desde la ficha de producto.</p>
        <Link href="/plp/bike-drivetrain">Ver catalogo</Link>
      </section>
    );
  }

  return (
    <section className="storefrontCartLayout">
      <div className="storefrontCartItems" aria-label="Productos en carrito">
        <div className="storefrontCartItemsHeader">
          <h1>Carrito</h1>
          <button disabled={pendingKey === "clear"} onClick={clearCart} type="button">
            <Trash2 aria-hidden="true" size={16} />
            Vaciar
          </button>
        </div>
        {orderform.items.map((item, index) => (
          <CartLine
            currency={orderform.currency}
            disabled={pendingKey === `line-${index}`}
            index={index}
            item={item}
            key={`${item.variantId ?? item.refId ?? item.name}-${index}`}
            onOfferingAdd={addLineOffering}
            onOfferingRemove={removeLineOffering}
            onQuantityChange={updateLineQuantity}
            pendingOfferingId={pendingKey?.startsWith(`offering-${index}-`) ? pendingKey.slice(`offering-${index}-`.length) : null}
            pendingOfferingRemoveId={pendingKey?.startsWith(`offering-remove-${index}-`) ? pendingKey.slice(`offering-remove-${index}-`.length) : null}
          />
        ))}
      </div>
      <aside className="storefrontCartSummary" aria-label="Resumen del carrito">
        <h2>Resumen</h2>
        <StorefrontCouponControl
          appliedCouponCode={cartCouponCode(orderform)}
          appliedCouponOffer={cartAppliedCouponOffer(orderform)}
          availableCoupons={cartAvailableCoupons(orderform)}
          couponCode={couponCode}
          currency={orderform.currency}
          discountMinor={cartDiscountsTotalMinor(orderform)}
          hasAppliedCoupon={cartHasCouponData(orderform)}
          invalidCouponCode={invalidCouponCode}
          message={couponMessage}
          messageStatus={couponMessageStatus}
          onApply={applyCoupon}
          onChange={updateCouponCode}
          onRemove={removeCoupon}
          onSelectAvailableCoupon={applyCouponCode}
          pendingAction={pendingKey}
          pendingCouponCode={pendingCouponCode}
        />
        <dl>
          <div>
            <dt>Productos</dt>
            <dd>{totals.items}</dd>
          </div>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCartMoney(totals.subtotal, orderform.currency)}</dd>
          </div>
          {cartHasCouponData(orderform) && cartDiscountsTotalMinor(orderform) ? (
            <div>
              <dt>Descuentos</dt>
              <dd>-{formatCartMoney(cartDiscountsTotalMinor(orderform), orderform.currency)}</dd>
            </div>
          ) : null}
          {cartHasShippingData(orderform) || totals.shipping > 0 ? (
            <div>
              <dt>Envio</dt>
              <dd>{totals.shipping > 0 ? formatCartMoney(totals.shipping, orderform.currency) : "Gratis"}</dd>
            </div>
          ) : null}
          {totals.taxes > 0 ? (
            <div>
              <dt>Impuestos</dt>
              <dd>{formatCartMoney(totals.taxes, orderform.currency)}</dd>
            </div>
          ) : null}
          <div className="storefrontCartSummaryTotal">
            <dt>Total</dt>
            <dd>{formatCartMoney(totals.grandTotal, orderform.currency)}</dd>
          </div>
        </dl>
        <div className="storefrontCartSummaryActions">
          <Link href="/checkout">Finalizar compra</Link>
          <Link href="/plp/bike-drivetrain">Seguir comprando</Link>
        </div>
      </aside>
    </section>
  );
}

function StorefrontCartConfirmationDialog({
  onClose,
  snapshot,
}: {
  onClose: () => void;
  snapshot: AddedCartSnapshot;
}) {
  const { item, orderform, quantityAdded } = snapshot;
  const subtotalMinor = cartItemsSubtotalMinor(orderform);
  const totalItems = cartTotalItems(orderform);
  const productName = item?.name ?? "Producto";

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.classList.add("storefrontModalOpen");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("storefrontModalOpen");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return createPortal((
    <div aria-labelledby="storefrontCartConfirmationTitle" aria-modal="true" className="storefrontCartModalLayer" role="dialog">
      <button aria-label="Cerrar" className="storefrontCartModalBackdrop" onClick={onClose} type="button" />
      <section className="storefrontCartModal">
        <header className="storefrontCartModalHeader">
          <h2 id="storefrontCartConfirmationTitle">
            <CheckCircle2 aria-hidden="true" size={22} />
            Producto añadido correctamente a tu carrito
          </h2>
          <button aria-label="Cerrar" onClick={onClose} type="button">
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="storefrontCartModalBody">
          <div className="storefrontCartModalProduct">
            <div className="storefrontCartModalImage">
              {item?.imageUrl ? (
                <Image src={item.imageUrl} alt={item.imageAlt ?? productName} fill sizes="128px" unoptimized />
              ) : (
                <ShoppingCart aria-hidden="true" size={28} />
              )}
            </div>
            <div>
              <h3>{productName}</h3>
              {item ? <p>{formatCartMoney(cartItemUnitPriceMinor(item), orderform.currency)}</p> : null}
              {item?.refId ?? item?.variantId ? <span>{item.refId ?? item.variantId}</span> : null}
              <span>Cantidad: <strong>{quantityAdded}</strong></span>
              {item?.offerings.length ? (
                <ul className="storefrontCartModalOfferings" aria-label="Servicios adicionales añadidos">
                  {item.offerings.map((offering) => (
                    <li key={offering.offeringId ?? offering.id ?? offering.name}>
                      <span>{offering.name}</span>
                      <strong>{formatCartMoney(offering.priceMinor ?? 0, offering.currency ?? orderform.currency)}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <CartTotalsPanel
            actionSlot={(
              <div className="storefrontCartModalActions">
                <button onClick={onClose} type="button">Continuar comprando</button>
                <Link href="/checkout">
                  <CheckCircle2 aria-hidden="true" size={17} />
                  Finalizar compra
                </Link>
              </div>
            )}
            orderform={orderform}
            subtotalMinor={subtotalMinor}
            totalItems={totalItems}
          />
        </div>
      </section>
    </div>
  ), document.body);
}

function CartTotalsPanel({
  actionSlot,
  orderform,
  subtotalMinor,
  totalItems,
}: {
  actionSlot?: ReactNode;
  orderform: StorefrontOrderform;
  subtotalMinor: number;
  totalItems: number;
}) {
  const shippingMinor = orderform.totals.shippingTotalMinor ?? 0;
  const taxMinor = orderform.totals.taxTotalMinor ?? 0;
  const discountsMinor = cartDiscountsTotalMinor(orderform);
  const offeringsMinor = cartOfferingsTotalMinor(orderform);

  return (
    <div className="storefrontCartTotalsPanel">
      <p>{totalItems === 1 ? "Hay 1 articulo en tu carrito." : `Hay ${totalItems} articulos en tu carrito.`}</p>
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatCartMoney(subtotalMinor, orderform.currency)}</dd>
        </div>
        {cartHasCouponData(orderform) && discountsMinor > 0 ? (
          <div>
            <dt>Descuentos</dt>
            <dd>-{formatCartMoney(discountsMinor, orderform.currency)}</dd>
          </div>
        ) : null}
        {offeringsMinor > 0 ? (
          <div>
            <dt>Servicios adicionales</dt>
            <dd>{formatCartMoney(offeringsMinor, orderform.currency)}</dd>
          </div>
        ) : null}
        {cartHasShippingData(orderform) || shippingMinor > 0 ? (
          <div>
            <dt>Envio</dt>
            <dd>{shippingMinor > 0 ? formatCartMoney(shippingMinor, orderform.currency) : "Gratis"}</dd>
          </div>
        ) : null}
        {taxMinor > 0 ? (
          <div>
            <dt>Impuestos</dt>
            <dd>{formatCartMoney(taxMinor, orderform.currency)}</dd>
          </div>
        ) : null}
        <div className="storefrontCartTotalsPanelTotal">
          <dt>Total</dt>
          <dd>{formatCartMoney(cartGrandTotalMinor(orderform), orderform.currency)}</dd>
        </div>
      </dl>
      {actionSlot}
    </div>
  );
}

function CartLine({
  currency,
  disabled,
  index,
  item,
  onOfferingAdd,
  onOfferingRemove,
  onQuantityChange,
  pendingOfferingId,
  pendingOfferingRemoveId,
}: {
  currency: string;
  disabled: boolean;
  index: number;
  item: StorefrontCartItem;
  onOfferingAdd: (itemIndex: number, offeringId: string) => void;
  onOfferingRemove: (itemIndex: number, offeringId: string) => void;
  onQuantityChange: (itemIndex: number, quantity: number) => void;
  pendingOfferingId?: string | null;
  pendingOfferingRemoveId?: string | null;
}) {
  const productHref = item.productUrlPath?.startsWith("/") && !item.productUrlPath.startsWith("//")
    ? item.productUrlPath
    : item.productSlug
      ? `/pdp/${encodeURIComponent(item.productSlug)}`
      : undefined;
  const selectedOfferingIds = new Set(item.offerings.map((offering) => offering.offeringId).filter(Boolean));
  const availableOfferings = item.availableOfferings.filter((offering) =>
    offering.active !== false &&
    Boolean(offering.offeringId) &&
    !selectedOfferingIds.has(offering.offeringId)
  );
  const hasOfferingPanel = item.offerings.length > 0 || availableOfferings.length > 0;

  return (
    <article className="storefrontCartItem">
      <div className="storefrontCartItemImage">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.imageAlt ?? item.name} fill sizes="92px" unoptimized />
        ) : (
          <ShoppingCart aria-hidden="true" size={24} />
        )}
      </div>
      <div className="storefrontCartItemMain">
        {productHref ? <Link href={productHref}>{item.name}</Link> : <strong>{item.name}</strong>}
        <span>{item.refId ?? item.variantId ?? "SKU pendiente"}</span>
        {hasOfferingPanel ? (
          <div className="storefrontCartItemOfferingPanel" aria-label="Servicios adicionales del producto">
            {item.offerings.length > 0 ? (
              <ul className="storefrontCartItemOfferings" aria-label="Servicios adicionales seleccionados">
                {item.offerings.map((offering) => {
                  const offeringId = offering.offeringId ?? offering.id ?? "";
                  const pending = Boolean(offeringId) && pendingOfferingRemoveId === offeringId;
                  return (
                  <li key={offeringId || offering.name}>
                    <button
                      aria-label={`Quitar ${offering.name}`}
                      className="storefrontCartItemOfferingRemove"
                      disabled={disabled || !offeringId || Boolean(pendingOfferingRemoveId)}
                      onClick={() => onOfferingRemove(index, offeringId)}
                      type="button"
                    >
                      {pending ? (
                        <Loader2 aria-hidden="true" className="storefrontCartSpinner" size={14} />
                      ) : (
                        <Trash2 aria-hidden="true" size={14} />
                      )}
                    </button>
                    <span>{offering.name}</span>
                    <strong>{formatCartMoney(offering.priceMinor ?? 0, offering.currency ?? currency)}</strong>
                  </li>
                  );
                })}
              </ul>
            ) : null}
            {availableOfferings.length > 0 ? (
              <div className="storefrontCartItemOfferingActions" aria-label="Servicios adicionales disponibles">
                {availableOfferings.map((offering) => {
                  const offeringId = offering.offeringId!;
                  const pending = pendingOfferingId === offeringId;
                  return (
                    <button
                      aria-label={`Añadir ${offering.name}`}
                      disabled={disabled || Boolean(pendingOfferingId)}
                      key={offeringId}
                      onClick={() => onOfferingAdd(index, offeringId)}
                      type="button"
                    >
                      <span>
                        <strong>{offering.name}</strong>
                        {offering.type ? <small>{offering.type}</small> : null}
                      </span>
                      <b>
                        {pending ? <Loader2 aria-hidden="true" className="storefrontCartSpinner" size={13} /> : null}
                        {formatCartMoney(offering.priceMinor ?? 0, offering.currency ?? currency)}
                      </b>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="storefrontCartPrice">
        <span>Unidad</span>
        <strong>{formatCartMoney(cartItemUnitPriceMinor(item), currency)}</strong>
      </div>
      <div className="storefrontCartQuantity">
        <button aria-label="Reducir cantidad" disabled={disabled || item.quantity <= 1} onClick={() => onQuantityChange(index, item.quantity - 1)} type="button">
          <Minus aria-hidden="true" size={15} />
        </button>
        <input
          aria-label="Cantidad"
          disabled={disabled}
          min={1}
          onChange={(event) => onQuantityChange(index, Number(event.target.value) || 1)}
          type="number"
          value={item.quantity}
        />
        <button aria-label="Aumentar cantidad" disabled={disabled} onClick={() => onQuantityChange(index, item.quantity + 1)} type="button">
          <Plus aria-hidden="true" size={15} />
        </button>
      </div>
      <div className="storefrontCartLineTotal">
        <span>Total</span>
        <strong>{formatCartMoney(cartItemLineTotalMinor(item), currency)}</strong>
      </div>
      <button className="storefrontCartRemove" disabled={disabled} onClick={() => onQuantityChange(index, 0)} type="button">
        <Trash2 aria-hidden="true" size={17} />
        <span>Eliminar</span>
      </button>
    </article>
  );
}

function findAddedCartItem(orderform: StorefrontOrderform, itemInput: { refId?: string; variantId?: string }) {
  const index = findAddedCartItemIndex(orderform, itemInput);
  return index >= 0 ? orderform.items[index] : null;
}

function findAddedCartItemIndex(orderform: StorefrontOrderform, itemInput: { refId?: string; variantId?: string }) {
  const index = orderform.items.findIndex((item) =>
    (itemInput.variantId && item.variantId === itemInput.variantId) ||
    (itemInput.refId && item.refId === itemInput.refId)
  );
  return index >= 0 ? index : orderform.items.length - 1;
}

function missingCartOfferingIds(item: StorefrontCartItem | undefined, offerings: StorefrontCartOffering[]) {
  const selectedIds = offerings
    .map((offering) => offering.offeringId)
    .filter((offeringId): offeringId is string => Boolean(offeringId));
  if (!item) {
    return selectedIds;
  }

  const appliedOfferingIds = new Set(item.offerings.map((offering) => offering.offeringId).filter(Boolean));
  return selectedIds.filter((offeringId) => !appliedOfferingIds.has(offeringId));
}

async function fetchCartCurrent({
  createGuest = true,
  forceNewCart = false,
  guestSessionId,
}: {
  createGuest?: boolean;
  forceNewCart?: boolean;
  guestSessionId?: string;
} = {}) {
  const activeGuestSessionId = guestSessionId ?? (createGuest ? getOrCreateGuestSessionId() : readGuestSessionId());
  if (!activeGuestSessionId) {
    return normalizeOrderformPayload({ orderform: { items: [], totals: { grandTotalMinor: 0 } } });
  }

  const params = new URLSearchParams({
    guestSessionId: activeGuestSessionId,
  });
  if (forceNewCart) {
    params.set("forceNewCart", "true");
  }

  const response = await fetch(`/api/storefront/cart?${params.toString()}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(asErrorMessage(payload));
  }

  const orderform = normalizeOrderformPayload(payload);
  saveOrderformId(orderform.orderFormId);
  return orderform;
}

async function mutateCart(method: "POST" | "PATCH" | "DELETE", input: {
  guestSessionId: string;
  items: CartMutationItem[];
  orderFormId: string;
}) {
  const response = await fetch("/api/storefront/cart/items", {
    body: JSON.stringify(input),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
    },
    method,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(asErrorMessage(payload));
  }

  const orderform = normalizeOrderformPayload(payload);
  saveOrderformId(orderform.orderFormId);
  return orderform;
}

async function mutateCartOffering(input: {
  guestSessionId: string;
  itemIndex: number;
  method?: "POST" | "DELETE";
  offeringId: string;
  orderFormId: string;
}) {
  const response = await fetch("/api/storefront/cart/offerings", {
    body: JSON.stringify(input),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
    },
    method: input.method ?? "POST",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(asErrorMessage(payload));
  }

  const orderform = normalizeOrderformPayload(payload);
  saveOrderformId(orderform.orderFormId);
  return orderform;
}

async function mutateCheckoutCoupon(action: "coupon" | "remove-coupon", input: {
  guestSessionId: string;
  orderFormId: string;
  payload?: Record<string, unknown>;
}) {
  const response = await fetch("/api/storefront/checkout", {
    body: JSON.stringify({ ...input, action, payload: input.payload ?? {} }),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(asErrorMessage(payload));
  }

  const orderform = normalizeOrderformPayload(payload);
  saveOrderformId(orderform.orderFormId);
  return orderform;
}

function commitOrderform(orderform: StorefrontOrderform) {
  saveOrderformId(orderform.orderFormId);
  window.dispatchEvent(new CustomEvent(cartUpdatedEventName, { detail: orderform }));
}

function getOrCreateGuestSessionId() {
  const existing = readGuestSessionId();
  if (existing) {
    return existing;
  }

  const next = createUuid();
  window.localStorage.setItem(guestSessionStorageKey, next);
  return next;
}

function readGuestSessionId() {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(guestSessionStorageKey);
  return value && value.length >= 20 ? value : null;
}

function readOrderFormId() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(orderFormStorageKey);
}

function saveOrderformId(orderFormId?: string) {
  if (typeof window === "undefined" || !orderFormId) {
    return;
  }
  window.localStorage.setItem(orderFormStorageKey, orderFormId);
}

function createUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16 >> Number(char) / 4)).toString(16),
  );
}

function asErrorMessage(payload: unknown) {
  return typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
    ? payload.message
    : "No se pudo operar el carrito.";
}
