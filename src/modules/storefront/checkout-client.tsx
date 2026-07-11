"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, CreditCard, Edit3, Loader2, LogIn, Rocket, ShieldCheck, Truck, UserRound } from "lucide-react";
import {
  cartAppliedCouponOffer,
  cartAvailableCoupons,
  cartCouponCode,
  cartDiscountsTotalMinor,
  cartGrandTotalMinor,
  cartHasCouponData,
  cartHasShippingData,
  cartItemLineTotalMinor,
  cartItemUnitPriceMinor,
  cartItemsSubtotalMinor,
  cartOfferingsTotalMinor,
  cartTotalItems,
  formatCartMoney,
  normalizeOrderformPayload,
  type StorefrontCartItem,
  type StorefrontOrderform,
} from "./cart";
import { couponApplicationFeedback, normalizeCouponCodeInput, StorefrontCouponControl, type CouponMessageStatus } from "./cart-client";
import type {
  StorefrontCheckoutAddress,
  StorefrontCheckoutAddressBook,
  StorefrontCheckoutAllowedAction,
  StorefrontCheckoutContextResponse,
} from "./checkout-types";
import type { StorefrontAuthActionState } from "./auth-types";
import {
  loginStorefrontCustomer,
  signupStorefrontCustomer,
} from "./storefront-auth-actions";
import {
  createStorefrontPaymentAttempt,
  createStorefrontPaymentCorrelationId,
  createStorefrontPaymentReceipt,
  createStorefrontPaymentTransaction,
  decideStorefrontPaymentAction,
  installedStorefrontPaymentMethods,
  normalizeStorefrontPaymentMethods,
  readStorefrontPaymentAttempt,
  readStorefrontPaymentReceipt,
  saveStorefrontPaymentAttempt,
  saveStorefrontPaymentReceipt,
  type StorefrontPaymentMethod,
} from "./payments";

const guestSessionStorageKey = "ecommium_storefront_guest_session_id";
const orderFormStorageKey = "ecommium_storefront_order_form_id";
const cartUpdatedEventName = "ecommium:cart-updated";

type CheckoutStatus = "loading" | "ready" | "empty" | "error";
type CheckoutStep = "profile" | "shipping" | "payment" | "review";
type CheckoutValidationErrors = Partial<Record<CheckoutStep, string[]>>;
type GuestCheckoutMode = "guest" | "login" | "signup";
type PaymentSystemsStatus = "idle" | "loading" | "ready" | "error";

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
  const [invalidCouponCode, setInvalidCouponCode] = useState<string | undefined>();
  const [couponMessage, setCouponMessage] = useState("");
  const [couponMessageStatus, setCouponMessageStatus] = useState<CouponMessageStatus>("info");
  const [pendingCouponCode, setPendingCouponCode] = useState<string | undefined>();
  const [paymentSystem, setPaymentSystem] = useState("");
  const [paymentSystems, setPaymentSystems] = useState<StorefrontPaymentMethod[]>([]);
  const [paymentSystemsStatus, setPaymentSystemsStatus] = useState<PaymentSystemsStatus>("idle");
  const [paymentSystemsMessage, setPaymentSystemsMessage] = useState("");
  const [installments, setInstallments] = useState(1);
  const [shippingOptions, setShippingOptions] = useState<ShippingOptions | null>(null);
  const [selectedSlas, setSelectedSlas] = useState<Record<number, string>>({});
  const [selectedAddressBookId, setSelectedAddressBookId] = useState("");
  const [addressAlias, setAddressAlias] = useState("");
  const [addressBookMessage, setAddressBookMessage] = useState("");

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
        const nextAddress = checkoutAddressForForm(context);
        if (nextAddress) {
          setAddress(addressFormFromCheckoutAddress(nextAddress));
          setSelectedAddressBookId(nextAddress.addressId ?? "");
          setAddressAlias(nextAddress.alias ?? "");
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
    subtotal: cartItemsSubtotalMinor(orderform),
    shipping: orderform?.totals.shippingTotalMinor ?? 0,
    discounts: cartDiscountsTotalMinor(orderform),
    offerings: cartOfferingsTotalMinor(orderform),
    taxes: orderform?.totals.taxTotalMinor ?? 0,
    grandTotal: cartGrandTotalMinor(orderform),
  }), [orderform]);
  const selectedPaymentMethod = useMemo(
    () => paymentSystems.find((method) => method.paymentSystemId === paymentSystem) ?? null,
    [paymentSystem, paymentSystems],
  );
  const installmentOptions = useMemo(() => {
    return paymentInstallmentOptions(selectedPaymentMethod);
  }, [selectedPaymentMethod]);

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
    return nextOrderform;
  }

  const loadPaymentSystems = useCallback(async () => {
    setPaymentSystemsStatus("loading");
    setPaymentSystemsMessage("");

    try {
      const guestSessionId = getOrCreateGuestSessionId();
      const params = new URLSearchParams({ guestSessionId });
      const response = await fetch(`/api/storefront/payments/payment-systems?${params.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessage(payload));
      }

      const installedMethods = installedStorefrontPaymentMethods(normalizeStorefrontPaymentMethods(payload));
      const nextPaymentSystem = installedMethods.some((method) => method.paymentSystemId === paymentSystem)
        ? paymentSystem
        : installedMethods[0]?.paymentSystemId ?? "";
      const nextMethod = installedMethods.find((method) => method.paymentSystemId === nextPaymentSystem) ?? null;
      setPaymentSystems(installedMethods);
      setPaymentSystem(nextPaymentSystem);
      setInstallments((current) => {
        const available = paymentInstallmentOptions(nextMethod);
        return available.includes(current) ? current : available[0] ?? 1;
      });
      setPaymentSystemsStatus("ready");
      setPaymentSystemsMessage(installedMethods.length ? "" : "No hay métodos de pago activos para esta tienda.");
    } catch (error) {
      setPaymentSystems([]);
      setPaymentSystem("");
      setPaymentSystemsStatus("error");
      setPaymentSystemsMessage(error instanceof Error ? error.message : "No se pudieron cargar los métodos de pago.");
    }
  }, [paymentSystem]);

  useEffect(() => {
    if (status !== "ready" || !orderform?.items.length || paymentSystemsStatus !== "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadPaymentSystems();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadPaymentSystems, orderform?.orderFormId, orderform?.items.length, paymentSystemsStatus, status]);

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
    const selectedSavedAddress = findAddressBookItem(checkoutContext?.sections?.shipping?.addressBook, selectedAddressBookId);
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
        selectedAddress: buildSelectedAddress(address, selectedSavedAddress),
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

  async function applyCouponCode(nextCouponCode: string) {
    const code = normalizeCouponCodeInput(nextCouponCode);
    if (!code) {
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
    setPendingAction("coupon");
    setCouponMessage(`Validando cupón ${code}...`);
    setCouponMessageStatus("info");
    try {
      const nextOrderform = await applyOrderformAction("coupon", { couponCode: code });
      const feedback = couponApplicationFeedback(nextOrderform, code);
      setCouponMessage(feedback.message);
      setCouponMessageStatus(feedback.status);
      setInvalidCouponCode(feedback.status === "error" ? code : undefined);
    } catch (error) {
      setCouponMessage(error instanceof Error ? error.message : "No se pudo aplicar el cupón.");
      setCouponMessageStatus("error");
    } finally {
      setPendingCouponCode(undefined);
      setPendingAction(null);
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

  function updateShippingAddress(patch: Partial<typeof defaultAddress>) {
    setAddress((next) => ({ ...next, ...patch }));
    setSelectedAddressBookId("");
    setShippingOptions(null);
    setAddressBookMessage("");
  }

  function selectAddressBookItem(addressId: string) {
    if (!addressId) {
      setSelectedAddressBookId("");
      setAddressAlias("");
      setAddressBookMessage("");
      setShippingOptions(null);
      return;
    }

    const selected = findAddressBookItem(checkoutContext?.sections?.shipping?.addressBook, addressId);
    if (!selected) {
      return;
    }

    setSelectedAddressBookId(selected.addressId ?? "");
    setAddress(addressFormFromCheckoutAddress(selected));
    setAddressAlias(selected.alias ?? "");
    setShippingOptions(null);
    setAddressBookMessage("");
  }

  async function saveAddressToBook() {
    const errors = [
      ...validateShippingAddress(address),
      ...validateAddressAlias(addressAlias),
    ];
    if (errors.length) {
      setValidationErrors((next) => ({ ...next, shipping: errors }));
      return;
    }

    setPendingAction("address-book");
    setAddressBookMessage("");
    setMessage("");
    try {
      const response = await fetch("/api/storefront/me/addresses", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(buildAddressBookPayload(address, addressAlias)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessage(payload));
      }

      const nextAddressBook = normalizeAddressBookPayload(payload, checkoutContext?.sections?.shipping?.addressBook);
      const payloadRecord = asRecord(payload);
      const addressRecord = asRecord(payloadRecord.address);
      const createdAddressId = asText(payloadRecord.addressId) ?? asText(payloadRecord.id) ?? asText(addressRecord.addressId) ?? asText(addressRecord.id) ?? "";
      const nextSelected = findAddressBookItem(nextAddressBook, createdAddressId);
      setCheckoutContext((next) => updateCheckoutAddressBook(next, nextAddressBook));
      if (nextSelected?.addressId) {
        setSelectedAddressBookId(nextSelected.addressId);
        setAddress(addressFormFromCheckoutAddress(nextSelected));
        setAddressAlias(nextSelected.alias ?? addressAlias.trim());
      }
      setValidationErrors((next) => ({ ...next, shipping: undefined }));
      setAddressBookMessage("Dirección guardada.");
    } catch (error) {
      setAddressBookMessage(error instanceof Error ? error.message : "No se pudo guardar la dirección.");
    } finally {
      setPendingAction(null);
    }
  }

  async function removeCoupon() {
    setPendingAction("remove-coupon");
    setCouponMessage("");
    setCouponMessageStatus("info");
    try {
      await applyOrderformAction("remove-coupon", {});
      setCouponCode("");
      setInvalidCouponCode(undefined);
      setCouponMessage("Cupón quitado.");
      setCouponMessageStatus("info");
    } catch (error) {
      setCouponMessage(error instanceof Error ? error.message : "No se pudo quitar el cupón.");
      setCouponMessageStatus("error");
    } finally {
      setPendingAction(null);
    }
  }

  async function savePayment() {
    setPendingAction("payment");
    setMessage("");
    const errors = validatePaymentSelection(orderform, paymentSystem, paymentSystems, totals.grandTotal);
    if (errors.length) {
      setValidationErrors((next) => ({ ...next, payment: errors }));
      setPendingAction(null);
      return;
    }
    const selectedMethod = selectedPaymentMethod;
    if (!selectedMethod) {
      setValidationErrors((next) => ({ ...next, payment: ["Selecciona un método de pago válido."] }));
      setPendingAction(null);
      return;
    }
    try {
      const nextOrderform = await applyOrderformAction("payment-data", {
        payments: [{
          paymentSystem: selectedMethod.paymentSystemId,
          paymentSystemName: selectedMethod.name,
          groupName: selectedMethod.groupName ?? paymentGroupName(selectedMethod),
          methodType: selectedMethod.methodType ?? selectedMethod.provider,
          provider: selectedMethod.provider,
          valueMinor: totals.grandTotal,
          referenceValueMinor: totals.grandTotal,
          installments,
        }],
      });
      const transactionId = createCheckoutTransactionId();
      const correlationId = createStorefrontPaymentCorrelationId();
      const transaction = await createStorefrontPaymentTransaction({
        body: buildPaymentTransactionPayload({
          actor: isAuthenticatedCheckout(checkoutContext) ? "customer" : "guest",
          correlationId,
          installments,
          method: selectedMethod,
          orderform: nextOrderform,
          profile,
          transactionId,
        }),
        correlationId,
        guestSessionId: getOrCreateGuestSessionId(),
      });
      const decision = decideStorefrontPaymentAction(selectedMethod, transaction);

      if (decision.kind === "redirect") {
        saveStorefrontPaymentAttempt(createStorefrontPaymentAttempt({
          actor: isAuthenticatedCheckout(checkoutContext) ? "customer" : "guest",
          amountMinor: totals.grandTotal,
          correlationId,
          currency: nextOrderform.currency,
          customerId: checkoutContext?.identity.customerId ?? undefined,
          guestSessionId: getOrCreateGuestSessionId(),
          itemsCount: cartTotalItems(nextOrderform),
          orderFormId: nextOrderform.orderFormId ?? "",
          paymentSystemId: selectedMethod.paymentSystemId,
          paymentSystemName: selectedMethod.name,
          provider: selectedMethod.provider === "paypal" ? "paypal" : "stripe",
          status: "REDIRECTED",
          transactionId: transaction.transactionId || transactionId,
        }));
        setMessage("Redirigiendo al proveedor de pago...");
        window.location.assign(decision.redirectUrl);
        return;
      }

      if (decision.kind === "unsupported") {
        throw new Error(decision.message);
      }

      if (decision.kind === "pending") {
        saveStorefrontPaymentAttempt(createStorefrontPaymentAttempt({
          actor: isAuthenticatedCheckout(checkoutContext) ? "customer" : "guest",
          amountMinor: totals.grandTotal,
          correlationId,
          currency: nextOrderform.currency,
          customerId: checkoutContext?.identity.customerId ?? undefined,
          guestSessionId: getOrCreateGuestSessionId(),
          itemsCount: cartTotalItems(nextOrderform),
          orderFormId: nextOrderform.orderFormId ?? "",
          paymentSystemId: selectedMethod.paymentSystemId,
          paymentSystemName: selectedMethod.name,
          provider: selectedMethod.provider === "paypal" ? "paypal" : "stripe",
          status: "RETURNED",
          transactionId: transaction.transactionId || transactionId,
        }));
        saveStorefrontPaymentReceipt(createStorefrontPaymentReceipt({
          attempt: readStorefrontPaymentAttempt(),
          status: transaction.status,
          transaction,
        }));
        setMessage("Pago pendiente de confirmación.");
      } else {
        const allowsOrder = paymentStatusAllowsOrder(transaction.status);
        const paymentAttempt = createStorefrontPaymentAttempt({
          actor: isAuthenticatedCheckout(checkoutContext) ? "customer" : "guest",
          amountMinor: totals.grandTotal,
          correlationId,
          currency: nextOrderform.currency,
          customerId: checkoutContext?.identity.customerId ?? undefined,
          guestSessionId: getOrCreateGuestSessionId(),
          itemsCount: cartTotalItems(nextOrderform),
          orderFormId: nextOrderform.orderFormId ?? "",
          paymentSystemId: selectedMethod.paymentSystemId,
          paymentSystemName: selectedMethod.name,
          provider: selectedMethod.provider === "paypal" ? "paypal" : "stripe",
          status: allowsOrder ? "SETTLED" : "RETURNED",
          transactionId: transaction.transactionId || transactionId,
        });
        saveStorefrontPaymentAttempt(paymentAttempt);
        saveStorefrontPaymentReceipt(createStorefrontPaymentReceipt({
          attempt: paymentAttempt,
          status: transaction.status,
          transaction,
        }));
        if (allowsOrder) {
          setActiveStep("review");
          setMessage("Método de pago guardado.");
        } else {
          setMessage("Pago pendiente de confirmación.");
        }
      }
      setValidationErrors((next) => ({ ...next, payment: undefined }));
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
      const paymentReference = confirmedCheckoutPaymentReference(orderform, totals.grandTotal);
      if (!paymentReference) {
        setValidationErrors((next) => ({
          ...next,
          review: ["Confirma el pago con Payments antes de crear el pedido."],
        }));
        setPendingAction(null);
        return;
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
          guestSessionId,
          payload: {
            orderFormId: orderform.orderFormId,
            checkoutContext: {
              orderFormId: orderform.orderFormId,
              paymentTransactionId: paymentReference.transactionId,
            },
            payment: paymentReference,
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
        transactionId: paymentReference.transactionId,
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
  const addressBook = checkoutContext?.sections?.shipping?.addressBook ?? null;
  const addressBookWarning = checkoutContext?.warnings?.some((warning) => warning.section === "addresses");

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
            {isAuthenticated ? (
              <AddressBookSelector
                addressBook={addressBook}
                degraded={Boolean(addressBookWarning)}
                onSelect={selectAddressBookItem}
                selectedAddressId={selectedAddressBookId}
              />
            ) : null}
            <div className="storefrontCheckoutFormGrid">
              <CheckoutInput label="Recibe" value={address.receiverName} onChange={(value) => updateShippingAddress({ receiverName: value })} />
              <CheckoutInput label="Codigo postal" value={address.postalCode} onChange={(value) => updateShippingAddress({ postalCode: value })} />
              <CheckoutInput label="Ciudad" value={address.city} onChange={(value) => updateShippingAddress({ city: value })} />
              <CheckoutInput label="Provincia" value={address.state} onChange={(value) => updateShippingAddress({ state: value })} />
              <CheckoutInput label="Pais" value={address.country} onChange={(value) => updateShippingAddress({ country: value })} />
              <CheckoutInput label="Calle" value={address.street} onChange={(value) => updateShippingAddress({ street: value })} />
              <CheckoutInput label="Numero" value={address.number} onChange={(value) => updateShippingAddress({ number: value })} />
              <CheckoutInput label="Barrio" value={address.neighborhood} onChange={(value) => updateShippingAddress({ neighborhood: value })} />
              <CheckoutInput label="Complemento" value={address.complement} onChange={(value) => updateShippingAddress({ complement: value })} />
              <CheckoutInput label="Referencia" value={address.reference} onChange={(value) => updateShippingAddress({ reference: value })} />
            </div>
            {isAuthenticated ? (
              <AddressBookSavePanel
                addressBook={addressBook}
                alias={addressAlias}
                message={addressBookMessage}
                onAliasChange={setAddressAlias}
                onSave={saveAddressToBook}
                pending={pendingAction === "address-book"}
                selectedAddressId={selectedAddressBookId}
              />
            ) : null}
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
            summary={<PaymentSectionSummary orderform={orderform} paymentMethod={selectedPaymentMethod} paymentSystem={paymentSystem} />}
            subtitle="Selecciona uno de los métodos activos configurados en Payments."
            title="Pago"
          >
            <CheckoutValidationList messages={validationErrors.payment} />
            {paymentSystemsStatus === "loading" ? (
              <p className="storefrontCheckoutNotice">Cargando métodos de pago...</p>
            ) : null}
            {paymentSystemsStatus === "error" || paymentSystemsMessage ? (
              <p className="storefrontCheckoutNotice">{paymentSystemsMessage}</p>
            ) : null}
            {paymentSystems.length > 0 ? (
              <>
                <div className="storefrontCheckoutPaymentMethods">
                  {paymentSystems.map((method) => (
                    <label key={method.paymentSystemId}>
                      <input
                        checked={paymentSystem === method.paymentSystemId}
                        name="paymentSystem"
                        onChange={() => {
                          setPaymentSystem(method.paymentSystemId);
                          setInstallments(paymentInstallmentOptions(method)[0] ?? 1);
                        }}
                        type="radio"
                      />
                      <span>{method.name}</span>
                      <small>{paymentProviderLabel(method)}</small>
                    </label>
                  ))}
                </div>
                <label className="storefrontCheckoutField">
                  <span>Cuotas</span>
                  <select value={installments} onChange={(event) => setInstallments(Number(event.currentTarget.value) || 1)}>
                    {installmentOptions.map((value) => (
                      <option key={value} value={value}>{value} {value === 1 ? "cuota" : "cuotas"}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <CheckoutActions>
              <button disabled={pendingAction === "payment" || paymentSystemsStatus !== "ready" || paymentSystems.length === 0} onClick={savePayment} type="button">
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
            appliedCouponOffer={cartAppliedCouponOffer(orderform)}
            availableCoupons={cartAvailableCoupons(orderform)}
            couponCode={couponCode}
            currency={orderform.currency}
            discountMinor={totals.discounts}
            hasAppliedCoupon={cartHasCouponData(orderform)}
            invalidCouponCode={invalidCouponCode}
            message={couponMessage}
            messageStatus={couponMessageStatus}
            onApply={applyCoupon}
            onChange={updateCouponCode}
            onRemove={removeCoupon}
            onSelectAvailableCoupon={applyCouponCode}
            pendingAction={pendingAction}
            pendingCouponCode={pendingCouponCode}
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
  paymentMethod,
  paymentSystem,
}: {
  orderform: StorefrontOrderform;
  paymentMethod: StorefrontPaymentMethod | null;
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
        <dd>{paymentMethod?.name ?? paymentSystemName(paymentSystem)}</dd>
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

function AddressBookSelector({
  addressBook,
  degraded,
  onSelect,
  selectedAddressId,
}: {
  addressBook: StorefrontCheckoutAddressBook | null;
  degraded: boolean;
  onSelect: (addressId: string) => void;
  selectedAddressId: string;
}) {
  if (degraded) {
    return <p className="storefrontCheckoutAddressBookNotice">Direcciones no disponibles ahora.</p>;
  }

  if (!addressBook?.items.length) {
    return <p className="storefrontCheckoutAddressBookNotice">Sin direcciones guardadas.</p>;
  }

  const selectedAddress = findAddressBookItem(addressBook, selectedAddressId);

  return (
    <div className="storefrontCheckoutAddressBook">
      <div className="storefrontCheckoutAddressBookHeader">
        <h2>Dirección guardada</h2>
        <span>{addressBook.count}/{addressBook.maxAddresses}</span>
      </div>
      <label className="storefrontCheckoutField">
        <span>Alias</span>
        <select value={selectedAddressId} onChange={(event) => onSelect(event.currentTarget.value)}>
          <option value="">Nueva dirección</option>
          {addressBook.items.map((item) => (
            <option key={item.addressId ?? item.alias ?? addressBookItemLine(item)} value={item.addressId ?? ""}>
              {addressBookItemLabel(item)}
            </option>
          ))}
        </select>
      </label>
      {selectedAddress ? (
        <p className="storefrontCheckoutAddressBookMeta">{addressBookItemLine(selectedAddress)}</p>
      ) : null}
    </div>
  );
}

function AddressBookSavePanel({
  addressBook,
  alias,
  message,
  onAliasChange,
  onSave,
  pending,
  selectedAddressId,
}: {
  addressBook: StorefrontCheckoutAddressBook | null;
  alias: string;
  message: string;
  onAliasChange: (value: string) => void;
  onSave: () => void;
  pending: boolean;
  selectedAddressId: string;
}) {
  if (!addressBook) {
    return null;
  }

  if (selectedAddressId) {
    return message ? <p className="storefrontCheckoutAddressBookNotice">{message}</p> : null;
  }

  if (addressBook.count >= addressBook.maxAddresses) {
    return <p className="storefrontCheckoutAddressBookNotice">Límite de direcciones alcanzado.</p>;
  }

  return (
    <div className="storefrontCheckoutSaveAddressPanel">
      <CheckoutInput label="Alias de dirección" value={alias} onChange={onAliasChange} />
      <button className="storefrontCheckoutSecondaryButton" disabled={pending} onClick={onSave} type="button">
        {pending ? "Guardando" : "Guardar en libreta"}
      </button>
      {message ? <p>{message}</p> : null}
    </div>
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
    offerings: number;
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
        {totals.offerings > 0 ? (
          <div>
            <dt>Servicios adicionales</dt>
            <dd>{formatCartMoney(totals.offerings, orderform.currency)}</dd>
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
        {item.offerings.length > 0 ? (
          <ul className="storefrontCheckoutSummaryOfferings" aria-label="Servicios adicionales seleccionados">
            {item.offerings.map((offering) => (
              <li key={offering.offeringId ?? offering.id ?? offering.name}>
                <span>{offering.name}</span>
                <b>{formatCartMoney(offering.priceMinor ?? 0, offering.currency ?? currency)}</b>
              </li>
            ))}
          </ul>
        ) : null}
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

function validatePaymentSelection(
  orderform: StorefrontOrderform | null,
  paymentSystem: string,
  paymentSystems: StorefrontPaymentMethod[],
  totalMinor: number,
) {
  const errors: string[] = [];
  if (!orderform?.items.length) {
    errors.push("El carrito necesita productos para seleccionar pago.");
  }
  if (!paymentSystems.length) {
    errors.push("No hay métodos de pago activos para esta tienda.");
  } else if (!paymentSystems.some((method) => method.paymentSystemId === paymentSystem)) {
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

function checkoutAddressForForm(context: StorefrontCheckoutContextResponse) {
  const shipping = context.sections?.shipping;
  const selectedAddress = shipping?.selectedAddress;
  if (selectedAddress && typeof selectedAddress === "object") {
    return selectedAddress;
  }

  const defaultShippingAddressId = shipping?.addressBook?.defaultShippingAddressId;
  return defaultShippingAddressId
    ? findAddressBookItem(shipping.addressBook, defaultShippingAddressId)
    : null;
}

function addressFormFromCheckoutAddress(address: StorefrontCheckoutAddress) {
  return {
    ...defaultAddress,
    receiverName: address.receiverName ?? "",
    postalCode: address.postalCode ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    country: address.country ?? defaultAddress.country,
    street: address.street ?? "",
    number: address.number ?? "",
    neighborhood: address.neighborhood ?? "",
    complement: address.complement ?? "",
    reference: address.reference ?? "",
  };
}

function findAddressBookItem(addressBook: StorefrontCheckoutAddressBook | null | undefined, addressId: string) {
  if (!addressId) {
    return null;
  }

  return addressBook?.items.find((item) => item.addressId === addressId) ?? null;
}

function addressBookItemLabel(address: StorefrontCheckoutAddress) {
  return address.alias?.trim() || addressBookItemLine(address);
}

function addressBookItemLine(address: StorefrontCheckoutAddress) {
  return [address.street, address.number, address.city, address.postalCode].filter(Boolean).join(", ") || "Dirección";
}

function validateAddressAlias(alias: string) {
  const value = alias.trim();
  if (value.length < 2) {
    return ["Introduce un alias para la dirección."];
  }
  if (value.length > 40) {
    return ["El alias debe tener 40 caracteres o menos."];
  }
  return [];
}

function buildAddressBookPayload(value: typeof defaultAddress, alias: string) {
  return {
    alias: alias.trim(),
    addressType: "residential",
    addressRole: "SHIPPING",
    receiverName: value.receiverName.trim(),
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

function buildSelectedAddress(value: typeof defaultAddress, savedAddress?: StorefrontCheckoutAddress | null) {
  return {
    addressId: savedAddress?.addressId ?? undefined,
    alias: savedAddress?.alias ?? undefined,
    addressType: savedAddress?.addressType ?? "residential",
    addressRole: savedAddress?.addressRole ?? undefined,
    receiverName: value.receiverName.trim(),
    isDisposable: !savedAddress?.addressId,
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

function normalizeAddressBookPayload(payload: unknown, previous?: StorefrontCheckoutAddressBook | null): StorefrontCheckoutAddressBook {
  const root = asRecord(payload);
  const bookRecord = asRecord(root.addressBook);
  const rawItems = Array.isArray(bookRecord.items) ? bookRecord.items : undefined;
  const createdAddress = normalizeCheckoutAddress(root.address ?? root);
  const previousItems = previous?.items ?? [];
  const items = rawItems
    ? rawItems.map(normalizeCheckoutAddress).filter((item) => item.addressId)
    : upsertAddressBookItem(previousItems, createdAddress);

  return {
    maxAddresses: asNumber(bookRecord.maxAddresses) ?? previous?.maxAddresses ?? 5,
    count: asNumber(bookRecord.count) ?? items.length,
    defaultShippingAddressId: asText(bookRecord.defaultShippingAddressId) ?? previous?.defaultShippingAddressId ?? null,
    defaultBillingAddressId: asText(bookRecord.defaultBillingAddressId) ?? previous?.defaultBillingAddressId ?? null,
    items,
  };
}

function normalizeCheckoutAddress(value: unknown): StorefrontCheckoutAddress {
  const record = asRecord(value);
  return {
    addressId: asText(record.addressId) ?? asText(record.id) ?? null,
    alias: asText(record.alias) ?? null,
    addressType: asText(record.addressType) ?? null,
    addressRole: asText(record.addressRole) ?? null,
    receiverName: asText(record.receiverName) ?? null,
    street: asText(record.street) ?? null,
    number: asText(record.number) ?? null,
    neighborhood: asText(record.neighborhood) ?? null,
    city: asText(record.city) ?? null,
    state: asText(record.state) ?? null,
    country: asText(record.country) ?? null,
    postalCode: asText(record.postalCode) ?? null,
    complement: asText(record.complement) ?? null,
    reference: asText(record.reference) ?? null,
    createdAt: asText(record.createdAt) ?? null,
    updatedAt: asText(record.updatedAt) ?? null,
  };
}

function upsertAddressBookItem(items: StorefrontCheckoutAddress[], address: StorefrontCheckoutAddress) {
  if (!address.addressId) {
    return items;
  }

  const withoutCurrent = items.filter((item) => item.addressId !== address.addressId);
  return [...withoutCurrent, address];
}

function updateCheckoutAddressBook(
  context: StorefrontCheckoutContextResponse | null,
  addressBook: StorefrontCheckoutAddressBook,
) {
  if (!context) {
    return context;
  }

  return {
    ...context,
    sections: {
      ...(context.sections ?? {}),
      shipping: {
        ...(context.sections?.shipping ?? {}),
        addressBook,
      },
    },
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
  if (!value) {
    return "Pendiente";
  }
  if (value.toLowerCase().includes("paypal")) {
    return "PayPal";
  }
  return "Tarjeta";
}

function paymentProviderLabel(method: StorefrontPaymentMethod) {
  if (method.provider === "paypal") {
    return "PayPal";
  }
  if (method.provider === "stripe") {
    return method.methodType?.toLowerCase().includes("card") ? "Stripe tarjeta" : "Stripe";
  }
  return method.methodType ?? method.groupName ?? "Método activo";
}

function paymentInstallmentOptions(method: StorefrontPaymentMethod | null) {
  const configured = method?.installments?.filter((value) => Number.isFinite(value) && value > 0) ?? [];
  return configured.length ? configured : [1];
}

function paymentGroupName(method: StorefrontPaymentMethod) {
  if (method.provider === "paypal") {
    return "paypal";
  }
  if (method.provider === "stripe") {
    return "cards";
  }
  return method.groupName ?? "payments";
}

function createCheckoutTransactionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildPaymentTransactionPayload(input: {
  actor: "guest" | "customer";
  correlationId: string;
  installments: number;
  method: StorefrontPaymentMethod;
  orderform: StorefrontOrderform;
  profile: CheckoutProfile;
  transactionId: string;
}) {
  const amountMinor = cartGrandTotalMinor(input.orderform);
  const orderFormId = input.orderform.orderFormId ?? "";
  const urls = paymentProviderReturnUrls(input.method);
  const inventory = buildPaymentInventorySnapshot(input.orderform, input.transactionId);

  if (!inventory.items.length) {
    throw new Error("No se pudo preparar el inventario para iniciar el pago.");
  }

  return {
    transactionId: input.transactionId,
    referenceId: orderFormId,
    channel: "storefront",
    salesChannel: "web",
    paymentSystemId: input.method.paymentSystemId,
    country: paymentCountry(input.orderform),
    valueMinor: Math.max(0, Math.round(amountMinor)),
    currency: input.orderform.currency,
    softDescriptor: "ECOMMIUM",
    prepareForRecurrency: false,
    checkoutContext: {
      returnUrl: urls.returnUrl,
      cancelUrl: urls.cancelUrl,
      brandName: "Ecommium",
      locale: "es-ES",
      userAction: "PAY_NOW",
      landingPage: "LOGIN",
      paymentMethodId: input.method.paymentSystemId,
      paymentMethodName: input.method.name,
    },
    payer: {
      emailAddress: input.profile.email.trim() || undefined,
      givenName: input.profile.firstName.trim() || undefined,
      surname: input.profile.lastName.trim() || undefined,
    },
    inventory,
    actor: input.actor,
    payment: {
      installments: input.installments,
      paymentSystemName: input.method.name,
      groupName: input.method.groupName ?? paymentGroupName(input.method),
      methodType: input.method.methodType ?? input.method.provider,
      provider: input.method.provider,
    },
    correlationId: input.correlationId,
  };
}

function paymentProviderReturnUrls(method: StorefrontPaymentMethod) {
  const provider = method.provider === "paypal" ? "paypal" : "stripe";
  const origin = window.location.origin;

  return {
    cancelUrl: `${origin}/checkout/payments/${provider}/cancel`,
    returnUrl: `${origin}/checkout/payments/${provider}/return`,
  };
}

function buildPaymentInventorySnapshot(orderform: StorefrontOrderform, transactionId: string) {
  return {
    saleId: transactionId,
    orderFormId: orderform.orderFormId ?? "",
    warehouseId: findWarehouseId(orderform.shippingData) ?? "warehouse-default",
    items: orderform.items
      .map((item) => ({
        variantId: item.variantId ?? "",
        quantity: Math.max(0, Math.round(item.quantity)),
      }))
      .filter((item) => item.variantId && item.quantity > 0),
  };
}

function paymentCountry(orderform: StorefrontOrderform) {
  return findCountry(orderform.shippingData) ?? "ES";
}

function findCountry(value: unknown): string | undefined {
  const record = asRecord(value);
  const direct = asText(record.country);
  if (direct) {
    return direct;
  }
  return findStringByKey(value, "country");
}

function findWarehouseId(value: unknown): string | undefined {
  return findStringByKey(value, "warehouseId");
}

function findStringByKey(value: unknown, key: string): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findStringByKey(item, key);
      if (nested) {
        return nested;
      }
    }
    return undefined;
  }

  const record = asRecord(value);
  const direct = asText(record[key]);
  if (direct) {
    return direct;
  }

  for (const nested of Object.values(record)) {
    if (typeof nested === "object" && nested !== null) {
      const match = findStringByKey(nested, key);
      if (match) {
        return match;
      }
    }
  }

  return undefined;
}

function hasProfile(orderform: StorefrontOrderform | null) {
  return Boolean(orderform?.clientProfileData && Object.keys(orderform.clientProfileData).length > 0);
}

function hasPayment(orderform: StorefrontOrderform | null) {
  return Boolean(orderform?.paymentData && Object.keys(orderform.paymentData).length > 0);
}

type ConfirmedCheckoutPaymentReference = {
  amountMinor?: number;
  correlationId?: string;
  currency?: string;
  provider: "paypal" | "stripe";
  status: string;
  supportReference?: string;
  transactionId: string;
};

function confirmedCheckoutPaymentReference(
  orderform: StorefrontOrderform,
  amountMinor: number,
): ConfirmedCheckoutPaymentReference | null {
  const receipt = readStorefrontPaymentReceipt();
  if (
    receipt &&
    receipt.transactionId &&
    paymentStatusAllowsOrder(receipt.status) &&
    paymentReferenceMatchesOrderform(receipt.orderFormId, orderform.orderFormId) &&
    paymentAmountMatchesOrderform(receipt.amountMinor, amountMinor)
  ) {
    return {
      amountMinor: receipt.amountMinor,
      correlationId: receipt.correlationId,
      currency: receipt.currency,
      provider: receipt.provider,
      status: receipt.status,
      supportReference: receipt.supportReference,
      transactionId: receipt.transactionId,
    };
  }

  const attempt = readStorefrontPaymentAttempt();
  if (
    attempt &&
    attempt.status === "SETTLED" &&
    paymentReferenceMatchesOrderform(attempt.orderFormId, orderform.orderFormId) &&
    paymentAmountMatchesOrderform(attempt.amountMinor, amountMinor)
  ) {
    return {
      amountMinor: attempt.amountMinor,
      correlationId: attempt.correlationId,
      currency: attempt.currency,
      provider: attempt.provider,
      status: attempt.status,
      supportReference: [attempt.transactionId, attempt.correlationId].filter(Boolean).join(":"),
      transactionId: attempt.transactionId,
    };
  }

  return null;
}

function paymentStatusAllowsOrder(status: string | undefined) {
  const normalized = status?.toUpperCase();
  return normalized === "SETTLED" ||
    normalized === "AUTHORIZED" ||
    normalized === "SUCCEEDED" ||
    normalized === "APPROVED" ||
    normalized === "COMPLETED";
}

function paymentReferenceMatchesOrderform(referenceOrderFormId: string | undefined, orderFormId: string | undefined) {
  return Boolean(referenceOrderFormId && orderFormId && referenceOrderFormId === orderFormId);
}

function paymentAmountMatchesOrderform(referenceAmountMinor: number | undefined, amountMinor: number) {
  return typeof referenceAmountMinor !== "number" || referenceAmountMinor === amountMinor;
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
