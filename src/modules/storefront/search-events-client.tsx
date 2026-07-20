"use client";

import { useEffect } from "react";
import type { StorefrontSearchEventData } from "./plp";
import { fallbackStorefrontVisitorId, normalizeStorefrontVisitorId, storefrontVisitorCookieName } from "./visitor";

type SearchEventsClientProps = {
  event: StorefrontSearchEventData;
  products: Array<{
    productId: string;
    variantId?: string;
  }>;
};

function cookieVisitorId() {
  const encoded = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${storefrontVisitorCookieName}=`))
    ?.slice(storefrontVisitorCookieName.length + 1);

  if (!encoded) {
    return undefined;
  }

  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

function makeVisitorId() {
  if (crypto.randomUUID) {
    return `sf-${crypto.randomUUID()}`;
  }

  return `sf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function ensureStorefrontVisitorId() {
  const current = normalizeStorefrontVisitorId(cookieVisitorId());
  if (current !== fallbackStorefrontVisitorId) {
    return current;
  }

  const visitorId = makeVisitorId();
  document.cookie = `${storefrontVisitorCookieName}=${encodeURIComponent(visitorId)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return visitorId;
}

export function sendStorefrontSearchEvent(payload: Record<string, unknown>) {
  const visitorId = ensureStorefrontVisitorId();
  const payloadVisitorId = normalizeStorefrontVisitorId(
    typeof payload.visitorId === "string" ? payload.visitorId : undefined,
  );
  const body = JSON.stringify({
    ...payload,
    visitorId: payloadVisitorId === fallbackStorefrontVisitorId ? visitorId : payloadVisitorId,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/storefront/search/events", blob);
    return;
  }

  void fetch("/api/storefront/search/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function StorefrontSearchEventsClient({ event, products }: SearchEventsClientProps) {
  useEffect(() => {
    if (!event.query || products.length === 0) {
      return;
    }

    sendStorefrontSearchEvent({
      organizationId: event.organizationId,
      shopId: event.shopId,
      eventType: "search",
      visitorId: event.visitorId,
      attributionToken: event.attributionToken ?? null,
      query: event.query,
      offset: event.offset,
      productDetails: products.slice(0, 24).map((product) => ({
        productId: product.productId,
        variantId: product.variantId ?? null,
      })),
      uri: window.location.href,
      occurredAt: new Date().toISOString(),
    });
  }, [event, products]);

  useEffect(() => {
    if (!event.query || products.length === 0) {
      return undefined;
    }

    const onClick = (clickEvent: MouseEvent) => {
      const target = clickEvent.target instanceof Element ? clickEvent.target : null;
      const link = target?.closest<HTMLAnchorElement>("[data-search-product-id]");
      if (!link) {
        return;
      }

      sendStorefrontSearchEvent({
        organizationId: event.organizationId,
        shopId: event.shopId,
        eventType: "detail-page-view",
        visitorId: event.visitorId,
        attributionToken: event.attributionToken ?? null,
        query: event.query,
        productDetails: [{
          productId: link.dataset.searchProductId,
          variantId: link.dataset.searchVariantId || null,
        }],
        uri: link.href,
        referrerUri: window.location.href,
        occurredAt: new Date().toISOString(),
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [event, products]);

  return null;
}
