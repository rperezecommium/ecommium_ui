import { cookies } from "next/headers";
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

  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <StorefrontPurchaseCompleteClient event={event} />
      <div className="storefrontShell">
        <section className="storefrontConfirmation">
          <span>Pedido confirmado</span>
          <h1>Tu pedido fue recibido</h1>
          <p>Hemos registrado la confirmación y pronto podrás consultar el estado del pedido.</p>
          <dl>
            <div>
              <dt>Referencia</dt>
              <dd>{first(query?.transactionId) ?? first(query?.orderId) ?? "Pendiente"}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatMoney(event?.revenue, event?.currencyCode ?? currency())}</dd>
            </div>
          </dl>
        </section>
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

function formatMoney(value: number | undefined, currencyCode: string) {
  if (typeof value !== "number") {
    return "Pendiente";
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}
