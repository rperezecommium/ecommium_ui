import { cookies } from "next/headers";
import { StorefrontPaymentConfirmationClient } from "../../../src/modules/storefront/payment-confirmation-client";
import { StorefrontHeader } from "../../../src/modules/storefront/plp-page";
import {
  StorefrontPurchaseCompleteClient,
  type StorefrontPurchaseCompleteEvent,
} from "../../../src/modules/storefront/purchase-complete-client";
import { normalizeStorefrontVisitorId, storefrontVisitorCookieName } from "../../../src/modules/storefront/visitor";
import { defaultAdminContext } from "../../../src/shared/config/env";

type ConfirmationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const localStorefrontDefaults = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  shopId: "22222222-2222-4222-8222-222222222222",
  currency: "EUR",
};

export default async function CheckoutConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const query = await searchParams;
  const cookieStore = await cookies();
  const visitorId = normalizeStorefrontVisitorId(cookieStore.get(storefrontVisitorCookieName)?.value);
  const event = buildPurchaseCompleteEvent(query, visitorId);
  const orderId = first(query?.orderId);
  const transactionId = first(query?.transactionId) ?? orderId;
  const guestSessionId = first(query?.guestSessionId);

  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <StorefrontPurchaseCompleteClient event={event} />
      <div className="storefrontShell">
        <StorefrontPaymentConfirmationClient guestSessionId={guestSessionId} orderId={orderId} transactionId={transactionId} />
      </div>
    </main>
  );
}

function buildPurchaseCompleteEvent(
  query: Record<string, string | string[] | undefined> | undefined,
  visitorId: string,
): StorefrontPurchaseCompleteEvent | null {
  const transactionId = first(query?.transactionId) ?? first(query?.orderId);
  const productId = first(query?.productId);
  const revenue = amount(first(query?.revenue), first(query?.revenueMinor));
  const quantity = positiveInt(first(query?.quantity), 1);

  if (!transactionId || !productId || typeof revenue !== "number" || revenue <= 0) {
    return null;
  }

  return {
    organizationId: organizationId(),
    shopId: shopId(),
    visitorId,
    transactionId,
    productId,
    variantId: first(query?.variantId),
    quantity,
    revenue,
    tax: amount(first(query?.tax), first(query?.taxMinor)),
    cost: amount(first(query?.cost), first(query?.costMinor)),
    currencyCode: first(query?.currency) ?? currency(),
  };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function amount(value: string | undefined, minorValue: string | undefined) {
  const minor = Number.parseInt(minorValue ?? "", 10);
  if (Number.isInteger(minor)) {
    return minor / 100;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function organizationId() {
  return process.env.ECOMMIUM_STOREFRONT_ORGANIZATION_ID ||
    defaultAdminContext.organizationId ||
    localStorefrontDefaults.organizationId;
}

function shopId() {
  return process.env.ECOMMIUM_STOREFRONT_SHOP_ID ||
    defaultAdminContext.shopId ||
    localStorefrontDefaults.shopId;
}

function currency() {
  return process.env.ECOMMIUM_STOREFRONT_CURRENCY ||
    defaultAdminContext.currency ||
    localStorefrontDefaults.currency;
}
