"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import {
  cartHasCouponData,
  cartHasShippingData,
  cartGrandTotalMinor,
  cartItemLineTotalMinor,
  cartItemUnitPriceMinor,
  cartTotalItems,
  formatCartMoney,
  normalizeOrderformPayload,
  type StorefrontCartItem,
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
  quantity: number;
  refId?: string;
  variantId?: string;
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

      const orderform = await mutateCart("POST", {
        guestSessionId,
        items: [{ quantity, refId, variantId }],
        orderFormId,
      });
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

export function StorefrontCartPageClient() {
  const [orderform, setOrderform] = useState<StorefrontOrderform | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

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
    subtotal: orderform?.totals.itemsSubtotalMinor ?? orderform?.items.reduce((total, item) => total + cartItemLineTotalMinor(item), 0) ?? 0,
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
            onQuantityChange={updateLineQuantity}
          />
        ))}
      </div>
      <aside className="storefrontCartSummary" aria-label="Resumen del carrito">
        <h2>Resumen</h2>
        <dl>
          <div>
            <dt>Productos</dt>
            <dd>{totals.items}</dd>
          </div>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCartMoney(totals.subtotal, orderform.currency)}</dd>
          </div>
          {cartHasCouponData(orderform) && orderform.totals.discountsTotalMinor ? (
            <div>
              <dt>Descuentos</dt>
              <dd>-{formatCartMoney(orderform.totals.discountsTotalMinor, orderform.currency)}</dd>
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
  const subtotalMinor = orderform.totals.itemsSubtotalMinor ?? orderform.items.reduce((total, currentItem) => total + cartItemLineTotalMinor(currentItem), 0);
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
  const discountsMinor = orderform.totals.discountsTotalMinor ?? 0;

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
  onQuantityChange,
}: {
  currency: string;
  disabled: boolean;
  index: number;
  item: StorefrontCartItem;
  onQuantityChange: (itemIndex: number, quantity: number) => void;
}) {
  const productHref = item.productUrlPath?.startsWith("/") && !item.productUrlPath.startsWith("//")
    ? item.productUrlPath
    : item.productSlug
      ? `/pdp/${encodeURIComponent(item.productSlug)}`
      : undefined;

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
        {item.availableOfferings.length > 0 ? (
          <small>{item.availableOfferings.length} servicio(s) disponibles</small>
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
  return orderform.items.find((item) =>
    (itemInput.variantId && item.variantId === itemInput.variantId) ||
    (itemInput.refId && item.refId === itemInput.refId)
  ) ?? orderform.items[orderform.items.length - 1] ?? null;
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
