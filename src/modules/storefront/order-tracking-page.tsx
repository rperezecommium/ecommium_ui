"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Check, CircleAlert, ExternalLink, PackageCheck, Truck } from "lucide-react";
import type { StorefrontOrderTracking } from "./order-tracking";

type TrackingPageProps = {
  tracking?: StorefrontOrderTracking;
  error?: string;
  errorStatus?: number;
};

export function StorefrontOrderTrackingPage({ tracking, error, errorStatus }: TrackingPageProps) {
  useEffect(() => {
    if (!tracking && errorStatus === 503) {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has("access") || url.searchParams.has("trackingAccessToken")) {
      url.searchParams.delete("access");
      url.searchParams.delete("trackingAccessToken");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [tracking, errorStatus]);

  if (!tracking) {
    const expired = errorStatus === 404;
    const needsLogin = errorStatus === 401;
    const unavailable = errorStatus === 503 || !errorStatus;
    return (
      <section className="storefrontOrderTrackingError">
        <CircleAlert aria-hidden="true" size={28} />
        <h1>{expired ? "Este enlace ya no esta disponible" : needsLogin ? "Inicia sesión para ver este pedido" : "El seguimiento no esta disponible ahora"}</h1>
        <p>{expired ? "Pide un nuevo enlace de seguimiento con la referencia de tu pedido y el email usado al comprar." : needsLogin ? "Entra en tu cuenta para consultar los pedidos que te pertenecen." : error || "Intentalo de nuevo en unos minutos."}</p>
        <div className="storefrontOrderTrackingErrorActions">
          {needsLogin ? <Link href="/auth/login" className="storefrontOrderTrackingPrimaryAction">Iniciar sesión</Link> : null}
          {unavailable ? <button onClick={() => window.location.reload()} type="button">Reintentar</button> : null}
          <Link href="/" className={needsLogin ? "storefrontOrderTrackingSecondaryAction" : "storefrontOrderTrackingPrimaryAction"}>Volver a la tienda</Link>
        </div>
      </section>
    );
  }

  const shipping = tracking.shippingModule.shipping;

  return (
    <section className="storefrontOrderTracking" aria-labelledby="order-tracking-title">
      <header className="storefrontOrderTrackingHeader">
        <div>
          <span>Seguimiento de pedido</span>
          <h1 id="order-tracking-title">Pedido #{tracking.orderReference}</h1>
          <p>{formatDate(tracking.placedAt)}</p>
        </div>
        <Link href="/" className="storefrontOrderTrackingBack">Seguir comprando</Link>
      </header>

      <div className="storefrontOrderTrackingStatus">
        {tracking.status === "DELIVERED" ? <Check aria-hidden="true" size={24} /> : <PackageCheck aria-hidden="true" size={24} />}
        <div>
          <h2>{tracking.title}</h2>
          <p>{tracking.message}</p>
        </div>
      </div>

      <ol className="storefrontOrderTrackingTimeline" aria-label="Estado del pedido">
        {tracking.timeline.map((step) => {
          const state = step.current ? "current" : step.completed ? "completed" : "pending";
          return (
            <li className={`storefrontOrderTrackingStep storefrontOrderTrackingStep${capitalize(state)}`} key={step.code}>
              <span aria-hidden="true">{step.completed ? <Check size={14} /> : <span />}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.occurredAt ? formatDate(step.occurredAt) : state === "current" ? "En curso" : "Pendiente"}</small>
              </div>
            </li>
          );
        })}
      </ol>

      {tracking.shippingModule.visible && shipping ? (
        <section className="storefrontOrderTrackingShipping" aria-labelledby="shipping-detail-title">
          <Truck aria-hidden="true" size={22} />
          <div>
            <h2 id="shipping-detail-title">Detalles de entrega</h2>
            {shipping.carrier?.label ? <p>{shipping.carrier.label}</p> : null}
            {shipping.trackingNumber ? <p>Seguimiento: <strong>{shipping.trackingNumber}</strong></p> : null}
            {shipping.deliveryPromise ? <p>Entrega estimada: {formatPromise(shipping.deliveryPromise)}</p> : null}
          </div>
          {shipping.trackingUrl ? (
            <a href={shipping.trackingUrl} rel="noreferrer" target="_blank">
              Ver transportista <ExternalLink aria-hidden="true" size={15} />
            </a>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(date);
}

function formatPromise(promise: { minDate: string; maxDate: string }) {
  const min = formatDate(promise.minDate);
  const max = formatDate(promise.maxDate);
  return min && max && min !== max ? `${min} – ${max}` : min || max;
}
