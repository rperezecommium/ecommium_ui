"use client";

import { useEffect } from "react";
import { sendStorefrontSearchEvent } from "./search-events-client";

export type StorefrontPurchaseCompleteEvent = {
  organizationId: string;
  shopId: string;
  visitorId: string;
  transactionId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  revenue: number;
  tax?: number;
  cost?: number;
  currencyCode: string;
};

export function StorefrontPurchaseCompleteClient({ event }: { event: StorefrontPurchaseCompleteEvent | null }) {
  useEffect(() => {
    if (!event) {
      return;
    }

    sendStorefrontSearchEvent({
      organizationId: event.organizationId,
      shopId: event.shopId,
      eventType: "purchase-complete",
      visitorId: event.visitorId,
      productDetails: [{
        productId: event.productId,
        variantId: event.variantId ?? null,
        quantity: event.quantity,
      }],
      purchaseTransaction: {
        id: event.transactionId,
        revenue: event.revenue,
        tax: event.tax ?? null,
        cost: event.cost ?? null,
        currencyCode: event.currencyCode,
      },
      uri: window.location.href,
      occurredAt: new Date().toISOString(),
    });
  }, [event]);

  return null;
}
