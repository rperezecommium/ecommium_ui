"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, CreditCard, Edit3, Loader2, LogIn, Rocket, ShieldCheck, Truck, UserRound } from "lucide-react";
import {
  cartCouponCode,
  cartGrandTotalMinor,
  cartHasCouponData,
  cartHasShippingData,
  cartItemLineTotalMinor,
  cartItemUnitPriceMinor,
  cartTotalItems,
  formatCartMoney,
  normalizeOrderformPayload,
  type StorefrontCartItem,
  type StorefrontOrderform,
} from "./cart";
import { StorefrontCouponControl } from "./cart-client";
import type { StorefrontCheckoutAllowedAction, StorefrontCheckoutContextResponse } from "./checkout-types";
import type { StorefrontAuthActionState } from "./auth-types";
import {
  loginStorefrontCustomer,
  signupStorefrontCustomer,
} from "./storefront-auth-actions";

const guestSessionStorageKey = "ecommium_storefront_guest_session_id";
const orderFormStorageKey = "ecommium_storefront_order_form_id";
const cartUpdatedEventName = "ecommium:cart-updated";

type CheckoutStatus = "loading" | "ready" | "empty" | "error";
type CheckoutStep = "profile" | "shipping" | "payment" | "review";
type CheckoutValidationErrors = Partial<Record<CheckoutStep, string[]>>;
type GuestCheckoutMode = "guest" | "login" | "signup";

type ShippingSla = {
  id: string;
  name: string;
  deliveryChannel?: string;
  priceMinor?: number;
  totalMinor?: number;
  shippingEstimate?: string;
  currency?: string;
};

type ShippingLogisticsInfo = {
  itemIndex: number;
  selectedSla?: string;
  selectedDeliveryChannel?: string;
  slas?: ShippingSla[];
};

type ShippingOptions = {
  logisticsInfo: ShippingLogisticsInfo[];
};

const defaultProfile = {
  email: "",
  firstName: "",
  lastName: "",
  documentType: "dni",
  document: "",
  phone: "",
};

type CheckoutProfile = typeof defaultProfile;

const initialAuthState: StorefrontAuthActionState = {
  status: "idle",
  message: "",
};

const defaultAddress = {
  receiverName: "",
  postalCode: "",
  city: "",
  state: "",
  country: "ES",
  street: "",
  number: "",
  neighborhood: "",
  complement: "",
  reference: "",
};

export function StorefrontCheckoutClient() {
  const [orderform, setOrderform] = useState<StorefrontOrderform | null>(null);
  const [checkoutContext, setCheckoutContext] = useState<StorefrontCheckoutContextResponse | null>(null);
  const [status, setStatus] = useState<CheckoutStatus>("loading");
  const [activeStep, setActiveStep] = useState<CheckoutStep>("profile");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<CheckoutValidationErrors>({});
  const [profile, setProfile] = useState(defaultProfile);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [guestCheckoutMode, setGuestCheckoutMode] = useState<GuestCheckoutMode>("guest");
  const [address, setAddress] = useState(defaultAddress);
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [paymentSystem, setPaymentSystem] = useState("credit-card");
  const [installments, setInstallments] = useState(1);
  const [shippingOptions, setShippingOptions] = useState<ShippingOptions | null>(null);
  const [selectedSlas, setSelectedSlas] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchCheckoutContext()
      .then(({ context, orderform: nextOrderform }) => {
        setCheckoutContext(context);
        setOrderform(nextOrderform);
        syncCheckoutFormsFromContext(context, nextOrderform);
        const nextProfile = profileFromCheckoutContext(context, nextOrderform);
        if (nextProfile) {
          setProfile(nextProfile);
        }
        setStatus(nextOrderform.items.length > 0 ? "ready" : "empty");
      })
      .catch(() => setStatus("error"));
  }, []);

  const completion = useMemo(() => ({
    profile: hasProfile(orderform),
    shipping: cartHasShippingData(orderform),
    payment: hasPayment(orderform),
  }), [orderform]);

  const totals = useMemo(() => ({
    items: cartTotalItems(orderform),
    subtotal: orderform?.totals.itemsSubtotalMinor ?? orderform?.items.reduce((total, item) => total + cartItemLineTotalMinor(item), 0) ?? 0,
    shipping: orderform?.totals.shippingTotalMinor ?? 0,
    discounts: orderform?.totals.discountsTotalMinor ?? 0,
    taxes: orderform?.totals.taxTotalMinor ?? 0,
    grandTotal: cartGrandTotalMinor(orderform),
  }), [orderform]);

  async function applyOrderformAction(action: string, payload: Record<string, unknown>) {
    if (!orderform?.orderFormId) {
      throw new Error("Checkout requiere un carrito activo.");
    }

    const guestSessionId = getOrCreateGuestSessionId();
    const response = await fetch("/api/storefront/checkout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action,
        guestSessionId,
        orderFormId: orderform.orderFormId,
        payload,
      }),
    });
    const responsePayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(errorMessage(responsePayload));
    }

    const nextOrderform = normalizeOrderformPayload(responsePayload);
    commitOrderform(nextOrderform);
    setOrderform(nextOrderform);
    syncCheckoutForms(nextOrderform);
    return responsePayload;
  }

  async function saveProfile() {
    setPendingAction("profile");
    setMessage("");
    const errors = validateProfile(profile, isAuthenticatedCheckout(checkoutContext));
    if (errors.length) {
      setValidationErrors((next) => ({ ...next, profile: errors }));
      setPendingAction(null);
      return;
    }
    try {
      const action = contactMutationAction(checkoutContext);
      await applyOrderformAction(action, {
        email: profile.email.trim(),
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        documentType: profile.documentType.trim(),
        document: profile.document.trim(),
        phone: profile.phone.trim() || null,
        isCorporate: false,
      });
      setActiveStep("shipping");
      setIsProfileEditing(false);
      setCheckoutContext((nextContext) => updateCheckoutContact(nextContext, profile));
      setValidationErrors((next) => ({ ...next, profile: undefined }));
      setMessage("Datos de contacto guardados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el contacto.");
    } finally {
      setPendingAction(null);
    }
  }

  async function resolveShippingOptions() {
    if (!orderform) {
      return;
    }

    setPendingAction("shipping-options");
    setMessage("");
    const errors = validateShippingAddress(address);
    if (errors.length) {
      setValidationErrors((next) => ({ ...next, shipping: errors }));
      setPendingAction(null);
      return;
    }
    try {
      const response = await fetch("/api/storefront/checkout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "resolve-shipping-options",
          guestSessionId: getOrCreateGuestSessionId(),
          payload: buildShippingOptionsPayload(orderform, address),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessage(payload));
      }
      const options = normalizeShippingOptions(payload);
      setShippingOptions(options);
      setSelectedSlas(defaultSelectedSlas(options));
      setValidationErrors((next) => ({ ...next, shipping: undefined }));
      setMessage("Opciones de envío calculadas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron resolver opciones de envío.");
    } finally {
      setPendingAction(null);
    }
  }

  async function continueAuthenticatedContact() {
    setMessage("");
    if (hasProfile(orderform)) {
      setActiveStep("shipping");
      return;
    }
    await saveProfile();
  }

  async function saveShipping() {
    const errors = validateShippingAddress(address);
    if (errors.length) {
      setValidationErrors((next) => ({ ...next, shipping: errors }));
      return;
    }

    if (!shippingOptions) {
      await resolveShippingOptions();
      return;
    }

    setPendingAction("shipping");
    setMessage("");
    try {
      await applyOrderformAction("shipping-data", {
        selectedAddress: buildSelectedAddress(address),
        billingSameAsShipping: true,
        billingAddress: null,
        logisticsInfo: shippingOptions.logisticsInfo.map((info) => {
          const selectedSla = selectedSlas[info.itemIndex] ?? info.selectedSla ?? info.slas?.[0]?.id;
          const sla = info.slas?.find((item) => item.id === selectedSla) ?? info.slas?.[0];
          return {
            itemIndex: info.itemIndex,
            selectedSla,
            selectedDeliveryChannel: sla?.deliveryChannel ?? info.selectedDeliveryChannel ?? "delivery",
          };
        }),
      });
      setActiveStep("payment");
      setValidationErrors((next) => ({ ...next, shipping: undefined }));
      setMessage("Dirección y envío guardados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el envío.");
    } finally {
      setPendingAction(null);
    }
  }

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) {
      return;
    }
    setPendingAction("coupon");
    setCouponMessage("");
    try {
      await applyOrderformAction("coupon", { couponCode: code });
      setCouponMessage("Cupón aplicado.");
    } catch (error) {
      setCouponMessage(error instanceof Error ? error.message : "No se pudo aplicar el cupón.");
    } finally {
      setPendingAction(null);
    }
  }

  async function removeCoupon() {
    setPendingAction("remove-coupon");
    setCouponMessage("");
    try {
      await applyOrderformAction("remove-coupon", {});
      setCouponCode("");
      setCouponMessage("Cupón quitado.");
    } catch (error) {
      setCouponMessage(error instanceof Error ? error.message : "No se pudo quitar el cupón.");
    } finally {
      setPendingAction(null);
    }
  }

  async function savePayment() {
    setPendingAction("payment");
    setMessage("");
    const errors = validatePaymentSelection(orderform, paymentSystem, totals.grandTotal);
    if (errors.length) {
      setValidationErrors((next) => ({ ...next, payment: errors }));
      setPendingAction(null);
      return;
    }
    try {
      await applyOrderformAction("payment-data", {
        payments: [{
          paymentSystem,
          paymentSystemName: paymentSystemName(paymentSystem),
          groupName: paymentSystem === "bank-transfer" ? "offline" : "cards",
          valueMinor: totals.grandTotal,
          referenceValueMinor: totals.grandTotal,
          installments,
        }],
      });
      setActiveStep("review");
      setValidationErrors((next) => ({ ...next, payment: undefined }));
      setMessage("Método de pago guardado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el pago.");
    } finally {
      setPendingAction(null);
    }
  }

  async function createOrder() {
    if (!orderform?.orderFormId) {
      return;
    }
    const nextStep = checkoutNextStep(completion);
    if (nextStep !== "review") {
      setActiveStep(nextStep);
      setValidationErrors((next) => ({
        ...next,
        review: ["Completa contacto, entrega y pago antes de confirmar el pedido."],
      }));
      return;
    }

    setPendingAction("create-order");
    setMessage("");
    try {
      const guestSessionId = getOrCreateGuestSessionId();
      const response = await fetch("/api/storefront/checkout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "create-order",
          guestSessionId,
          payload: {
            orderFormId: orderform.orderFormId,
            checkoutContext: { orderFormId: orderform.orderFormId },
            source: "storefront-checkout",
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessage(payload));
      }
      const order = asRecord((payload as Record<string, unknown>).order);
      const orderId = typeof order.orderId === "string" ? order.orderId : orderform.orderFormId;
      const firstItem = orderform.items[0];
      await clearCheckoutCart(orderform, guestSessionId);
      window.location.href = `/checkout/confirmation?${new URLSearchParams({
        orderId,
        transactionId: orderId,
        revenueMinor: String(cartGrandTotalMinor(orderform)),
        currency: orderform.currency,
        productId: firstItem?.productId ?? firstItem?.productSlug ?? "cart",
        variantId: firstItem?.variantId ?? "",
        quantity: String(cartTotalItems(orderform)),
      }).toString()}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el pedido.");
    } finally {
      setPendingAction(null);
    }
  }

  if (status === "loading") {
    return (
      <section className="storefrontCheckoutEmpty">
        <Loader2 aria-hidden="true" className="storefrontCartSpinner" size={24} />
        <p>Cargando checkout</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="storefrontCheckoutEmpty">
        <h1>No se pudo cargar el checkout</h1>
        <p>Revisa el BFF y vuelve a intentarlo.</p>
        <Link href="/cart">Volver al carrito</Link>
      </section>
    );
  }

  if (status === "empty" || !orderform) {
    return (
      <section className="storefrontCheckoutEmpty">
        <h1>Tu carrito esta vacio</h1>
        <p>El checkout necesita al menos un producto en el carrito.</p>
        <Link href="/plp/bike-drivetrain">Ver catalogo</Link>
      </section>
    );
  }

  const isAuthenticated = isAuthenticatedCheckout(checkoutContext);
  const contactAction = contactMutationAction(checkoutContext);
  const nextStep = checkoutNextStep(completion);
  const canReview = nextStep === "review";

  return (
    <section className="storefrontCheckoutLayout">
      <div className="storefrontCheckoutMain">
        {message ? <p className="storefrontCheckoutNotice">{message}</p> : null}
        <CheckoutProgressPrompt activeStep={activeStep} nextStep={nextStep} onSelect={setActiveStep} />
        <div className="storefrontCheckoutSections">
          <CheckoutSectionCard
            actionLabel={completion.profile ? "Editar" : "Completar"}
            active={activeStep === "profile"}
            icon={<UserRound aria-hidden="true" size={20} />}
            onEdit={() => setActiveStep("profile")}
            status={completion.profile ? "Completo" : "Pendiente"}
            summary={<ContactSectionSummary isAuthenticated={isAuthenticated} profile={profile} />}
            subtitle={profilePanelSubtitle(checkoutContext)}
            title={isAuthenticated ? "Información de contacto" : "Contacto"}
          >
            <CheckoutValidationList messages={validationErrors.profile} />
            {isAuthenticated ? (
              <AuthenticatedContactStep
                isEditing={isProfileEditing}
                mutationNotice={contactMutationNotice(contactAction)}
                onCancel={() => setIsProfileEditing(false)}
                onChange={(patch) => setProfile((next) => ({ ...next, ...patch }))}
                onContinue={continueAuthenticatedContact}
                onEdit={() => setIsProfileEditing(true)}
                onSave={saveProfile}
                pending={pendingAction === "profile"}
                profile={profile}
              />
            ) : (
              <GuestContactStep
                mode={guestCheckoutMode}
                onModeChange={setGuestCheckoutMode}
                onChange={(patch) => setProfile((next) => ({ ...next, ...patch }))}
                onSave={saveProfile}
                pending={pendingAction === "profile"}
                profile={profile}
              />
            )}
          </CheckoutSectionCard>
          <CheckoutSectionCard
            actionLabel={completion.shipping ? "Editar" : "Completar"}
            active={activeStep === "shipping"}
            icon={<Truck aria-hidden="true" size={20} />}
            onEdit={() => setActiveStep("shipping")}
            status={completion.shipping ? "Completo" : "Pendiente"}
            summary={<ShippingSectionSummary address={address} orderform={orderform} />}
            subtitle="Primero calcula opciones reales; despues se guarda la SLA seleccionada en el orderform."
            title="Entrega"
          >
            <CheckoutValidationList messages={validationErrors.shipping} />
            <div className="storefrontCheckoutFormGrid">
              <CheckoutInput label="Recibe" value={address.receiverName} onChange={(value) => setAddress((next) => ({ ...next, receiverName: value }))} />
              <CheckoutInput label="Codigo postal" value={address.postalCode} onChange={(value) => setAddress((next) => ({ ...next, postalCode: value }))} />
              <CheckoutInput label="Ciudad" value={address.city} onChange={(value) => setAddress((next) => ({ ...next, city: value }))} />
              <CheckoutInput label="Provincia" value={address.state} onChange={(value) => setAddress((next) => ({ ...next, state: value }))} />
              <CheckoutInput label="Pais" value={address.country} onChange={(value) => setAddress((next) => ({ ...next, country: value }))} />
              <CheckoutInput label="Calle" value={address.street} onChange={(value) => setAddress((next) => ({ ...next, street: value }))} />
              <CheckoutInput label="Numero" value={address.number} onChange={(value) => setAddress((next) => ({ ...next, number: value }))} />
              <CheckoutInput label="Barrio" value={address.neighborhood} onChange={(value) => setAddress((next) => ({ ...next, neighborhood: value }))} />
              <CheckoutInput label="Complemento" value={address.complement} onChange={(value) => setAddress((next) => ({ ...next, complement: value }))} />
              <CheckoutInput label="Referencia" value={address.reference} onChange={(value) => setAddress((next) => ({ ...next, reference: value }))} />
            </div>
            <ShippingOptionsList
              currency={orderform.currency}
              options={shippingOptions}
              selectedSlas={selectedSlas}
              onSelect={(itemIndex, slaId) => setSelectedSlas((next) => ({ ...next, [itemIndex]: slaId }))}
            />
            <CheckoutActions>
              <button className="storefrontCheckoutSecondaryButton" disabled={pendingAction === "shipping-options"} onClick={resolveShippingOptions} type="button">
                {pendingAction === "shipping-options" ? "Calculando" : "Calcular envío"}
              </button>
              <button disabled={pendingAction === "shipping"} onClick={saveShipping} type="button">
                {pendingAction === "shipping" ? "Guardando" : "Guardar envío"}
              </button>
            </CheckoutActions>
          </CheckoutSectionCard>
          <CheckoutSectionCard
            actionLabel={completion.payment ? "Editar" : "Completar"}
            active={activeStep === "payment"}
            icon={<CreditCard aria-hidden="true" size={20} />}
            onEdit={() => setActiveStep("payment")}
            status={completion.payment ? "Completo" : "Pendiente"}
            summary={<PaymentSectionSummary orderform={orderform} paymentSystem={paymentSystem} />}
            subtitle="Selecciona un método. La autorización/captura del proveedor queda preparada para la siguiente integración."
            title="Pago"
          >
            <CheckoutValidationList messages={validationErrors.payment} />
            <div className="storefrontCheckoutPaymentMethods">
              {["credit-card", "paypal", "bank-transfer"].map((method) => (
                <label key={method}>
                  <input checked={paymentSystem === method} name="paymentSystem" onChange={() => setPaymentSystem(method)} type="radio" />
                  <span>{paymentSystemName(method)}</span>
                </label>
              ))}
            </div>
            <label className="storefrontCheckoutField">
              <span>Cuotas</span>
              <select value={installments} onChange={(event) => setInstallments(Number(event.currentTarget.value) || 1)}>
                <option value={1}>1 cuota</option>
                <option value={3}>3 cuotas</option>
                <option value={6}>6 cuotas</option>
              </select>
            </label>
            <CheckoutActions>
              <button disabled={pendingAction === "payment"} onClick={savePayment} type="button">
                {pendingAction === "payment" ? "Guardando" : "Guardar pago"}
              </button>
            </CheckoutActions>
          </CheckoutSectionCard>
          <CheckoutSectionCard
            actionLabel="Revisar"
            active={activeStep === "review"}
            icon={<ShieldCheck aria-hidden="true" size={20} />}
            onEdit={() => setActiveStep(canReview ? "review" : nextStep)}
            status={canReview ? "Listo" : "Pendiente"}
            summary={<ReviewSectionSummary completion={completion} />}
            subtitle="Revisa los datos guardados en el orderform antes de crear el pedido."
            title="Revisión"
          >
            <CheckoutValidationList messages={validationErrors.review} />
            <CheckoutStateGrid orderform={orderform} />
            <CheckoutActions>
              <button
                disabled={!completion.profile || !completion.shipping || !completion.payment || pendingAction === "create-order"}
                onClick={createOrder}
                type="button"
              >
                {pendingAction === "create-order" ? "Creando pedido" : "Confirmar pedido"}
              </button>
            </CheckoutActions>
          </CheckoutSectionCard>
        </div>
      </div>
      <CheckoutSummary
        couponSlot={(
          <StorefrontCouponControl
            appliedCouponCode={cartCouponCode(orderform)}
            couponCode={couponCode}
            currency={orderform.currency}
            discountMinor={totals.discounts}
            hasAppliedCoupon={cartHasCouponData(orderform)}
            message={couponMessage}
            onApply={applyCoupon}
            onChange={setCouponCode}
            onRemove={removeCoupon}
            pendingAction={pendingAction}
          />
        )}
        orderform={orderform}
        totals={totals}
      />
    </section>
  );
}

function CheckoutProgressPrompt({
  activeStep,
  nextStep,
  onSelect,
}: {
  activeStep: CheckoutStep;
  nextStep: CheckoutStep;
  onSelect: (step: CheckoutStep) => void;
}) {
  const done = nextStep === "review";
  return (
    <div className={done ? "storefrontCheckoutProgressPrompt storefrontCheckoutProgressPromptReady" : "storefrontCheckoutProgressPrompt"}>
      <div>
        <span>{done ? "Pedido listo para revisar" : "Siguiente paso"}</span>
        <strong>{done ? "Revisión" : checkoutStepLabel(nextStep)}</strong>
      </div>
      <button disabled={activeStep === nextStep} onClick={() => onSelect(nextStep)} type="button">
        {done ? "Revisar pedido" : "Abrir"}
      </button>
    </div>
  );
}

function CheckoutSectionCard({
  actionLabel,
  active,
  children,
  icon,
  onEdit,
  status,
  summary,
  subtitle,
  title,
}: {
  actionLabel: string;
  active: boolean;
  children: ReactNode;
  icon: ReactNode;
  onEdit: () => void;
  status: string;
  summary: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <section className={active ? "storefrontCheckoutSectionCard storefrontCheckoutSectionCardActive" : "storefrontCheckoutSectionCard"}>
      <header>
        <span>{icon}</span>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <strong className={status === "Completo" || status === "Listo" ? "storefrontCheckoutSectionStatus storefrontCheckoutSectionStatusOk" : "storefrontCheckoutSectionStatus"}>
          {status}
        </strong>
        {!active ? (
          <button className="storefrontCheckoutSectionEdit" onClick={onEdit} type="button">
            {actionLabel}
          </button>
        ) : null}
      </header>
      {active ? children : <div className="storefrontCheckoutSectionSummary">{summary}</div>}
    </section>
  );
}

function CheckoutInput({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="storefrontCheckoutField">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}

function CheckoutValidationList({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return (
    <div className="storefrontCheckoutValidation" role="alert">
      <strong>Revisa estos datos</strong>
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function ContactSectionSummary({
  isAuthenticated,
  profile,
}: {
  isAuthenticated: boolean;
  profile: CheckoutProfile;
}) {
  return (
    <dl className="storefrontCheckoutMiniSummary">
      <div>
        <dt>Modo</dt>
        <dd>{isAuthenticated ? "Cuenta conectada" : "Invitado"}</dd>
      </div>
      <div>
        <dt>Cliente</dt>
        <dd>{contactName(profile, "Sin identificar")}</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>{profile.email || "-"}</dd>
      </div>
      <div>
        <dt>Telefono</dt>
        <dd>{profile.phone || "-"}</dd>
      </div>
    </dl>
  );
}

function ShippingSectionSummary({
  address,
  orderform,
}: {
  address: typeof defaultAddress;
  orderform: StorefrontOrderform;
}) {
  const hasShipping = cartHasShippingData(orderform);
  return (
    <dl className="storefrontCheckoutMiniSummary">
      <div>
        <dt>Estado</dt>
        <dd>{hasShipping ? "Envío guardado" : "Pendiente"}</dd>
      </div>
      <div>
        <dt>Destino</dt>
        <dd>{shippingAddressSummary(address)}</dd>
      </div>
      <div>
        <dt>País</dt>
        <dd>{address.country || "-"}</dd>
      </div>
      <div>
        <dt>Código postal</dt>
        <dd>{address.postalCode || "-"}</dd>
      </div>
    </dl>
  );
}

function PaymentSectionSummary({
  orderform,
  paymentSystem,
}: {
  orderform: StorefrontOrderform;
  paymentSystem: string;
}) {
  return (
    <dl className="storefrontCheckoutMiniSummary">
      <div>
        <dt>Estado</dt>
        <dd>{hasPayment(orderform) ? "Pago guardado" : "Pendiente"}</dd>
      </div>
      <div>
        <dt>Método</dt>
        <dd>{paymentSystemName(paymentSystem)}</dd>
      </div>
      <div>
        <dt>Total</dt>
        <dd>{formatCartMoney(cartGrandTotalMinor(orderform), orderform.currency)}</dd>
      </div>
    </dl>
  );
}

function ReviewSectionSummary({
  completion,
}: {
  completion: Record<"profile" | "shipping" | "payment", boolean>;
}) {
  return (
    <dl className="storefrontCheckoutMiniSummary">
      <div>
        <dt>Contacto</dt>
        <dd>{completion.profile ? "Completo" : "Pendiente"}</dd>
      </div>
      <div>
        <dt>Entrega</dt>
        <dd>{completion.shipping ? "Completa" : "Pendiente"}</dd>
      </div>
      <div>
        <dt>Pago</dt>
        <dd>{completion.payment ? "Completo" : "Pendiente"}</dd>
      </div>
    </dl>
  );
}

function GuestContactStep({
  mode,
  onChange,
  onModeChange,
  onSave,
  pending,
  profile,
}: {
  mode: GuestCheckoutMode;
  onChange: (patch: Partial<CheckoutProfile>) => void;
  onModeChange: (mode: GuestCheckoutMode) => void;
  onSave: () => void;
  pending: boolean;
  profile: CheckoutProfile;
}) {
  if (mode === "login" || mode === "signup") {
    return (
      <>
        <GuestCheckoutModeSelector mode={mode} onModeChange={onModeChange} />
        <CheckoutAuthPanel mode={mode} />
      </>
    );
  }

  return (
    <>
      <GuestCheckoutModeSelector mode={mode} onModeChange={onModeChange} />
      <div className="storefrontCheckoutFormGrid">
        <CheckoutInput label="Email" type="email" value={profile.email} onChange={(value) => onChange({ email: value })} />
        <CheckoutInput label="Telefono" value={profile.phone} onChange={(value) => onChange({ phone: value })} />
        <CheckoutInput label="Nombre" value={profile.firstName} onChange={(value) => onChange({ firstName: value })} />
        <CheckoutInput label="Apellidos" value={profile.lastName} onChange={(value) => onChange({ lastName: value })} />
        <CheckoutInput label="Tipo documento" value={profile.documentType} onChange={(value) => onChange({ documentType: value })} />
        <CheckoutInput label="Documento" value={profile.document} onChange={(value) => onChange({ document: value })} />
      </div>
      <CheckoutActions>
        <button disabled={pending} onClick={onSave} type="button">
          {pending ? "Guardando" : "Continuar a envío"}
        </button>
      </CheckoutActions>
    </>
  );
}

function GuestCheckoutModeSelector({
  mode,
  onModeChange,
}: {
  mode: GuestCheckoutMode;
  onModeChange: (mode: GuestCheckoutMode) => void;
}) {
  const options: Array<{
    description: string;
    icon: ReactNode;
    id: GuestCheckoutMode;
    label: string;
  }> = [
    {
      description: "Sin crear cuenta",
      icon: <UserRound aria-hidden="true" size={18} />,
      id: "guest",
      label: "Comprar como invitado",
    },
    {
      description: "Usar tus datos guardados",
      icon: <LogIn aria-hidden="true" size={18} />,
      id: "login",
      label: "Iniciar sesión",
    },
    {
      description: "Crear acceso para próximas compras",
      icon: <Rocket aria-hidden="true" size={18} />,
      id: "signup",
      label: "Crear cuenta",
    },
  ];

  return (
    <div className="storefrontCheckoutChoice" aria-label="Como deseas continuar">
      <h2>¿Cómo deseas continuar?</h2>
      <div className="storefrontCheckoutChoiceGrid">
        {options.map((option) => (
          <button
            aria-pressed={mode === option.id}
            className={mode === option.id ? "storefrontCheckoutChoiceCard storefrontCheckoutChoiceCardActive" : "storefrontCheckoutChoiceCard"}
            key={option.id}
            onClick={() => onModeChange(option.id)}
            type="button"
          >
            <span>{option.icon}</span>
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckoutAuthPanel({ mode }: { mode: Exclude<GuestCheckoutMode, "guest"> }) {
  const [loginState, loginAction, loginPending] = useActionState(loginStorefrontCustomer, initialAuthState);
  const [signupState, signupAction, signupPending] = useActionState(signupStorefrontCustomer, initialAuthState);
  const [signupStartedAt] = useState(() => new Date(Date.now() - 8000).toISOString());
  const state = mode === "login" ? loginState : signupState;
  const pending = mode === "login" ? loginPending : signupPending;

  return (
    <div className="storefrontCheckoutAuthInline">
      {state.message ? (
        <p className={state.status === "error" ? "storefrontAuthNotice storefrontAuthNoticeError" : "storefrontAuthNotice storefrontAuthNoticeSuccess"}>
          {state.message}
        </p>
      ) : null}
      {mode === "login" ? (
        <form action={loginAction} className="storefrontAuthForm">
          <input name="redirectTo" type="hidden" value="/checkout" />
          <label className="storefrontAuthField">
            <span>Email</span>
            <input defaultValue={loginState.email} name="email" required type="email" />
          </label>
          <label className="storefrontAuthField">
            <span>Password</span>
            <input minLength={8} name="password" required type="password" />
          </label>
          <button className="storefrontAuthSubmit" disabled={pending} type="submit">
            {pending ? "Entrando..." : "Iniciar sesión"}
          </button>
          <Link className="storefrontAuthAuxLink" href="/auth/password-reset">
            He olvidado mi password
          </Link>
        </form>
      ) : (
        <form action={signupAction} className="storefrontAuthForm">
          <input name="redirectTo" type="hidden" value="/checkout" />
          <div className="storefrontAuthGrid">
            <label className="storefrontAuthField">
              <span>Nombre</span>
              <input name="firstName" required type="text" />
            </label>
            <label className="storefrontAuthField">
              <span>Apellido</span>
              <input name="lastName" required type="text" />
            </label>
          </div>
          <label className="storefrontAuthField">
            <span>Email</span>
            <input defaultValue={signupState.email} name="email" required type="email" />
          </label>
          <label className="storefrontAuthField">
            <span>Password</span>
            <input minLength={8} name="password" required type="password" />
          </label>
          <input name="startedAt" type="hidden" value={signupStartedAt} />
          <label className="storefrontAuthTrap">Empresa<input autoComplete="off" name="company" tabIndex={-1} /></label>
          <button className="storefrontAuthSubmit" disabled={pending} type="submit">
            {pending ? "Creando..." : "Crear cuenta"}
          </button>
        </form>
      )}
    </div>
  );
}

function AuthenticatedContactStep({
  isEditing,
  mutationNotice,
  onCancel,
  onChange,
  onContinue,
  onEdit,
  onSave,
  pending,
  profile,
}: {
  isEditing: boolean;
  mutationNotice: string;
  onCancel: () => void;
  onChange: (patch: Partial<CheckoutProfile>) => void;
  onContinue: () => void;
  onEdit: () => void;
  onSave: () => void;
  pending: boolean;
  profile: CheckoutProfile;
}) {
  if (isEditing) {
    return (
      <>
        <div className="storefrontCheckoutFormGrid">
          <CheckoutInput label="Telefono para este pedido" value={profile.phone} onChange={(value) => onChange({ phone: value })} />
          <CheckoutInput label="Tipo documento" value={profile.documentType} onChange={(value) => onChange({ documentType: value })} />
          <CheckoutInput label="Documento" value={profile.document} onChange={(value) => onChange({ document: value })} />
        </div>
        <p className="storefrontCheckoutInlineNotice">{mutationNotice}</p>
        <CheckoutActions>
          <button className="storefrontCheckoutSecondaryButton" disabled={pending} onClick={onCancel} type="button">
            Cancelar
          </button>
          <button disabled={pending} onClick={onSave} type="button">
            {pending ? "Guardando" : "Guardar y continuar"}
          </button>
        </CheckoutActions>
      </>
    );
  }

  return (
    <>
      <div className="storefrontCheckoutIdentitySummary">
        <span className="storefrontCheckoutIdentityBadge">
          <CheckCircle2 aria-hidden="true" size={16} />
          Cuenta conectada
        </span>
        <dl className="storefrontCheckoutContactRows">
          <div>
            <dt>Cliente</dt>
            <dd>{contactName(profile)}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{profile.email || "-"}</dd>
          </div>
          <div>
            <dt>Telefono</dt>
            <dd>{profile.phone || "-"}</dd>
          </div>
          <div>
            <dt>Documento</dt>
            <dd>{[profile.documentType, profile.document].filter(Boolean).join(" ") || "-"}</dd>
          </div>
        </dl>
      </div>
      <CheckoutActions>
        <button className="storefrontCheckoutSecondaryButton" onClick={onEdit} type="button">
          <Edit3 aria-hidden="true" size={16} />
          Modificar
        </button>
        <button disabled={pending} onClick={onContinue} type="button">
          {pending ? "Guardando" : "Continuar a envío"}
        </button>
      </CheckoutActions>
    </>
  );
}

function CheckoutActions({ children }: { children: ReactNode }) {
  return <div className="storefrontCheckoutActions">{children}</div>;
}

function ShippingOptionsList({
  currency,
  onSelect,
  options,
  selectedSlas,
}: {
  currency: string;
  onSelect: (itemIndex: number, slaId: string) => void;
  options: ShippingOptions | null;
  selectedSlas: Record<number, string>;
}) {
  if (!options?.logisticsInfo.length) {
    return null;
  }

  return (
    <div className="storefrontCheckoutShippingOptions">
      {options.logisticsInfo.map((info) => (
        <fieldset key={info.itemIndex}>
          <legend>Opciones para item {info.itemIndex + 1}</legend>
          {(info.slas ?? []).map((sla) => (
            <label key={sla.id}>
              <input
                checked={(selectedSlas[info.itemIndex] ?? info.selectedSla) === sla.id}
                name={`sla-${info.itemIndex}`}
                onChange={() => onSelect(info.itemIndex, sla.id)}
                type="radio"
              />
              <span>
                <strong>{sla.name}</strong>
                <small>{sla.shippingEstimate ? `${sla.shippingEstimate} · ` : ""}{formatCartMoney(sla.totalMinor ?? sla.priceMinor ?? 0, sla.currency ?? currency)}</small>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function CheckoutStateGrid({ orderform }: { orderform: StorefrontOrderform }) {
  return (
    <dl className="storefrontCheckoutStateGrid">
      <div>
        <dt>Contacto</dt>
        <dd>{hasProfile(orderform) ? "Guardado" : "Pendiente"}</dd>
      </div>
      <div>
        <dt>Entrega</dt>
        <dd>{cartHasShippingData(orderform) ? "Guardada" : "Pendiente"}</dd>
      </div>
      <div>
        <dt>Pago</dt>
        <dd>{hasPayment(orderform) ? "Seleccionado" : "Pendiente"}</dd>
      </div>
      <div>
        <dt>Promoción</dt>
        <dd>{cartHasCouponData(orderform) ? "Aplicada" : "Sin cupón"}</dd>
      </div>
    </dl>
  );
}

function CheckoutSummary({
  couponSlot,
  orderform,
  totals,
}: {
  couponSlot?: ReactNode;
  orderform: StorefrontOrderform;
  totals: {
    discounts: number;
    grandTotal: number;
    items: number;
    shipping: number;
    subtotal: number;
    taxes: number;
  };
}) {
  return (
    <aside className="storefrontCheckoutSummary">
      <h2>Resumen</h2>
      <div className="storefrontCheckoutSummaryItems">
        {orderform.items.map((item) => <CheckoutSummaryItem currency={orderform.currency} item={item} key={`${item.variantId ?? item.refId ?? item.name}`} />)}
      </div>
      {couponSlot}
      <dl>
        <div>
          <dt>Productos</dt>
          <dd>{totals.items}</dd>
        </div>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatCartMoney(totals.subtotal, orderform.currency)}</dd>
        </div>
        {cartHasCouponData(orderform) && totals.discounts > 0 ? (
          <div>
            <dt>Descuentos</dt>
            <dd>-{formatCartMoney(totals.discounts, orderform.currency)}</dd>
          </div>
        ) : null}
        {cartHasShippingData(orderform) || totals.shipping > 0 ? (
          <div>
            <dt>Envío</dt>
            <dd>{totals.shipping > 0 ? formatCartMoney(totals.shipping, orderform.currency) : "Gratis"}</dd>
          </div>
        ) : null}
        {totals.taxes > 0 ? (
          <div>
            <dt>Impuestos</dt>
            <dd>{formatCartMoney(totals.taxes, orderform.currency)}</dd>
          </div>
        ) : null}
        <div className="storefrontCheckoutSummaryTotal">
          <dt>Total</dt>
          <dd>{formatCartMoney(totals.grandTotal, orderform.currency)}</dd>
        </div>
      </dl>
    </aside>
  );
}

function CheckoutSummaryItem({ currency, item }: { currency: string; item: StorefrontCartItem }) {
  return (
    <article>
      <span>
        {item.imageUrl ? <Image alt={item.imageAlt ?? item.name} fill sizes="56px" src={item.imageUrl} unoptimized /> : null}
      </span>
      <div>
        <strong>{item.name}</strong>
        <small>{item.quantity} x {formatCartMoney(cartItemUnitPriceMinor(item), currency)}</small>
      </div>
      <b>{formatCartMoney(cartItemLineTotalMinor(item), currency)}</b>
    </article>
  );
}

async function fetchCheckoutContext() {
  const guestSessionId = getOrCreateGuestSessionId();
  const params = new URLSearchParams({ guestSessionId, forceNewCart: "false" });
  const response = await fetch(`/api/storefront/checkout/context?${params.toString()}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(payload));
  }
  const orderform = normalizeOrderformPayload(payload);
  saveOrderformId(orderform.orderFormId);
  return {
    context: payload as StorefrontCheckoutContextResponse,
    orderform,
  };
}

function commitOrderform(orderform: StorefrontOrderform) {
  saveOrderformId(orderform.orderFormId);
}

function syncCheckoutForms(orderform: StorefrontOrderform) {
  saveOrderformId(orderform.orderFormId);
}

function syncCheckoutFormsFromContext(context: StorefrontCheckoutContextResponse, orderform: StorefrontOrderform) {
  syncCheckoutForms(orderform);
}

function profilePanelSubtitle(context: StorefrontCheckoutContextResponse | null) {
  if (context?.identity.state === "AUTHENTICATED") {
    return "Realizarás esta compra con tu cuenta.";
  }
  return "Puedes continuar como invitado o iniciar sesión.";
}

function checkoutNextStep(completion: Record<"profile" | "shipping" | "payment", boolean>): CheckoutStep {
  if (!completion.profile) {
    return "profile";
  }
  if (!completion.shipping) {
    return "shipping";
  }
  if (!completion.payment) {
    return "payment";
  }

  return "review";
}

function checkoutStepLabel(step: CheckoutStep) {
  if (step === "profile") {
    return "Contacto";
  }
  if (step === "shipping") {
    return "Entrega";
  }
  if (step === "payment") {
    return "Pago";
  }

  return "Revisión";
}

function isAuthenticatedCheckout(context: StorefrontCheckoutContextResponse | null) {
  return context?.identity.state === "AUTHENTICATED";
}

function validateProfile(profile: CheckoutProfile, authenticated: boolean) {
  const errors: string[] = [];
  if (!isValidEmail(profile.email)) {
    errors.push("Introduce un email válido.");
  }

  if (!authenticated) {
    if (!profile.firstName.trim()) {
      errors.push("Introduce tu nombre.");
    }
    if (!profile.lastName.trim()) {
      errors.push("Introduce tus apellidos.");
    }
    if (!profile.phone.trim()) {
      errors.push("Introduce un teléfono de contacto.");
    }
  }

  if (profile.phone.trim() && profile.phone.replace(/\D/g, "").length < 6) {
    errors.push("Introduce un teléfono válido.");
  }

  return errors;
}

function validateShippingAddress(address: typeof defaultAddress) {
  const errors: string[] = [];
  if (!address.receiverName.trim()) {
    errors.push("Introduce quién recibe el pedido.");
  }
  if (!address.postalCode.trim() || address.postalCode.trim().length < 4) {
    errors.push("Introduce un código postal válido.");
  }
  if (!address.city.trim()) {
    errors.push("Introduce la ciudad.");
  }
  if (!address.country.trim()) {
    errors.push("Introduce el país.");
  }
  if (!address.street.trim()) {
    errors.push("Introduce la calle.");
  }
  if (!address.number.trim()) {
    errors.push("Introduce el número.");
  }

  return errors;
}

function validatePaymentSelection(orderform: StorefrontOrderform | null, paymentSystem: string, totalMinor: number) {
  const errors: string[] = [];
  if (!orderform?.items.length) {
    errors.push("El carrito necesita productos para seleccionar pago.");
  }
  if (!["credit-card", "paypal", "bank-transfer"].includes(paymentSystem)) {
    errors.push("Selecciona un método de pago válido.");
  }
  if (!Number.isFinite(totalMinor) || totalMinor < 0) {
    errors.push("No se pudo calcular el total del pedido.");
  }

  return errors;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function contactMutationAction(context: StorefrontCheckoutContextResponse | null): "client-profile-data" | "profile" {
  const mutationScope = context?.sections?.contact?.mutationScope;
  if (mutationScope === "profile" || mutationScope === "client-profile-data") {
    return mutationScope;
  }

  return context?.identity.state === "AUTHENTICATED" && allowedCheckoutAction(context, "profile") ? "profile" : "client-profile-data";
}

function contactMutationNotice(action: "client-profile-data" | "profile") {
  if (action === "profile") {
    return "Este cambio se guardará en tu perfil de cliente y se usará en este pedido.";
  }

  return "Este cambio solo se utilizará para este pedido.";
}

function allowedCheckoutAction(context: StorefrontCheckoutContextResponse | null, action: StorefrontCheckoutAllowedAction) {
  return Array.isArray(context?.allowedActions) && context.allowedActions.includes(action);
}

function updateCheckoutContact(context: StorefrontCheckoutContextResponse | null, profile: CheckoutProfile) {
  if (!context) {
    return context;
  }

  return {
    ...context,
    contact: {
      ...(context.contact ?? {}),
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone || null,
      documentType: profile.documentType,
      document: profile.document,
    },
  };
}

function contactName(profile: CheckoutProfile, fallback = "Cliente autenticado") {
  return [profile.firstName, profile.lastName].filter(Boolean).join(" ") || fallback;
}

function shippingAddressSummary(address: typeof defaultAddress) {
  const line = [address.street, address.number, address.city].filter(Boolean).join(", ");
  return line || "Sin dirección";
}

function profileFromCheckoutContext(context: StorefrontCheckoutContextResponse, orderform: StorefrontOrderform) {
  const contact = context.contact ?? orderform.clientProfileData;
  if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
    return null;
  }

  const contactRecord = contact as Record<string, unknown>;
  return {
    ...defaultProfile,
    email: asText(contactRecord.email) ?? "",
    firstName: asText(contactRecord.firstName) ?? "",
    lastName: asText(contactRecord.lastName) ?? "",
    documentType: asText(contactRecord.documentType) ?? defaultProfile.documentType,
    document: asText(contactRecord.document) ?? "",
    phone: asText(contactRecord.phone) ?? "",
  };
}

function buildSelectedAddress(value: typeof defaultAddress) {
  return {
    addressType: "residential",
    receiverName: value.receiverName.trim(),
    isDisposable: true,
    postalCode: value.postalCode.trim(),
    city: value.city.trim(),
    state: value.state.trim(),
    country: value.country.trim(),
    street: value.street.trim(),
    number: value.number.trim(),
    neighborhood: value.neighborhood.trim() || null,
    complement: value.complement.trim() || null,
    reference: value.reference.trim() || null,
  };
}

function buildShippingOptionsPayload(orderform: StorefrontOrderform, address: typeof defaultAddress) {
  return {
    currency: orderform.currency,
    selectedAddress: {
      postalCode: address.postalCode.trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      country: address.country.trim(),
    },
    itemsSubtotalMinor: orderform.totals.itemsSubtotalMinor ?? 0,
    items: orderform.items.map((item, itemIndex) => ({
      itemIndex,
      variantId: item.variantId,
      refId: item.refId,
      quantity: item.quantity,
      priceMinor: cartItemUnitPriceMinor(item),
      weightGrams: 1500,
    })),
  };
}

function normalizeShippingOptions(payload: unknown): ShippingOptions {
  const root = asRecord(payload);
  const logisticsInfo = Array.isArray(root.logisticsInfo) ? root.logisticsInfo : [];
  return {
    logisticsInfo: logisticsInfo.map((value) => {
      const info = asRecord(value);
      const slas = Array.isArray(info.slas) ? info.slas : [];
      return {
        itemIndex: asNumber(info.itemIndex) ?? 0,
        selectedSla: asText(info.selectedSla),
        selectedDeliveryChannel: asText(info.selectedDeliveryChannel),
        slas: slas.map((slaValue) => {
          const sla = asRecord(slaValue);
          return {
            id: asText(sla.id) ?? "",
            name: asText(sla.name) ?? "Servicio",
            deliveryChannel: asText(sla.deliveryChannel),
            priceMinor: asNumber(sla.priceMinor),
            totalMinor: asNumber(sla.totalMinor),
            shippingEstimate: asText(sla.shippingEstimate),
            currency: asText(sla.currency),
          };
        }).filter((sla) => sla.id),
      };
    }),
  };
}

function defaultSelectedSlas(options: ShippingOptions) {
  return Object.fromEntries(
    options.logisticsInfo.map((info) => [info.itemIndex, info.selectedSla ?? info.slas?.[0]?.id ?? ""]),
  );
}

function paymentSystemName(value: string) {
  if (value === "paypal") {
    return "PayPal";
  }
  if (value === "bank-transfer") {
    return "Transferencia";
  }
  return "Tarjeta";
}

function hasProfile(orderform: StorefrontOrderform | null) {
  return Boolean(orderform?.clientProfileData && Object.keys(orderform.clientProfileData).length > 0);
}

function hasPayment(orderform: StorefrontOrderform | null) {
  return Boolean(orderform?.paymentData && Object.keys(orderform.paymentData).length > 0);
}

function getOrCreateGuestSessionId() {
  const existing = readGuestSessionId();
  if (existing) {
    return existing;
  }

  const next = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
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

function saveOrderformId(orderFormId?: string) {
  if (typeof window === "undefined" || !orderFormId) {
    return;
  }
  window.localStorage.setItem(orderFormStorageKey, orderFormId);
}

async function clearCheckoutCart(orderform: StorefrontOrderform, guestSessionId: string) {
  if (!orderform.orderFormId) {
    return;
  }

  const response = await fetch("/api/storefront/cart/items", {
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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return;
  }

  const clearedOrderform = normalizeOrderformPayload(payload);
  window.localStorage.removeItem(orderFormStorageKey);
  window.dispatchEvent(new CustomEvent(cartUpdatedEventName, { detail: clearedOrderform }));
}

function errorMessage(payload: unknown) {
  return typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
    ? payload.message
    : "No se pudo operar el checkout.";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
