"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { StorefrontSearchEventData } from "./plp";
import { useStorefrontConsentService } from "./storefront-consent-runtime";
import { fallbackStorefrontVisitorId, normalizeStorefrontVisitorId, storefrontVisitorCookieName } from "./visitor";

type SearchEventsClientProps = {
  event: StorefrontSearchEventData;
  products: Array<{
    productId: string;
    variantId?: string;
  }>;
};

const storefrontAnalyticsServiceKey = "analytics";
const analyticsConsentStoreKey = Symbol.for("ecommium.storefront.analytics-consent");

type AnalyticsConsentStore = {
  allowed: boolean;
  listeners: Set<() => void>;
};

function analyticsConsentStore(): AnalyticsConsentStore | null {
  if (typeof window === "undefined") return null;
  const browserWindow = window as typeof window & {
    [analyticsConsentStoreKey]?: AnalyticsConsentStore;
  };
  const current = browserWindow[analyticsConsentStoreKey];
  if (current) return current;

  const store: AnalyticsConsentStore = { allowed: false, listeners: new Set() };
  Object.defineProperty(browserWindow, analyticsConsentStoreKey, {
    configurable: false,
    enumerable: false,
    value: store,
    writable: false,
  });
  return store;
}

function setAnalyticsConsentAllowed(allowed: boolean) {
  const store = analyticsConsentStore();
  if (!store || store.allowed === allowed) return;
  store.allowed = allowed;
  store.listeners.forEach((listener) => listener());
}

function subscribeAnalyticsConsent(listener: () => void) {
  const store = analyticsConsentStore();
  if (!store) return () => undefined;
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function analyticsConsentSnapshot() {
  return analyticsConsentStore()?.allowed ?? false;
}

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

function clearStorefrontVisitorId() {
  document.cookie = `${storefrontVisitorCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function sendAuthorizedStorefrontSearchEvent(payload: Record<string, unknown>) {
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
    if (navigator.sendBeacon("/api/storefront/search/events", blob)) {
      return;
    }
  }

  void fetch("/api/storefront/search/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * La única entrada de analítica para Storefront. La política publicada decide
 * si puede emitir; sin autorización el callback descarta el payload y la
 * cookie de visitante se retira. No hay cola previa al consentimiento.
 */
export function useStorefrontAnalytics() {
  const allowed = useSyncExternalStore(
    subscribeAnalyticsConsent,
    analyticsConsentSnapshot,
    () => false,
  );

  useEffect(() => {
    if (!allowed) {
      clearStorefrontVisitorId();
    }
  }, [allowed]);

  return useCallback((payload: Record<string, unknown>) => {
    if (allowed) {
      sendAuthorizedStorefrontSearchEvent(payload);
    }
  }, [allowed]);
}

export function StorefrontConsentAnalyticsLifecycle() {
  const allowed = useStorefrontConsentService(storefrontAnalyticsServiceKey);

  useEffect(() => {
    setAnalyticsConsentAllowed(allowed);
    if (!allowed) {
      clearStorefrontVisitorId();
    }
  }, [allowed]);

  return null;
}

export function StorefrontSearchEventsClient({ event, products }: SearchEventsClientProps) {
  const recordAnalyticsEvent = useStorefrontAnalytics();

  useEffect(() => {
    if (!event.query || products.length === 0) {
      return;
    }

    recordAnalyticsEvent({
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
  }, [event, products, recordAnalyticsEvent]);

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

      recordAnalyticsEvent({
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
  }, [event, products, recordAnalyticsEvent]);

  return null;
}
