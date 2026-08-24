import { StorefrontPaymentConfirmationClient } from "../../../src/modules/storefront/payment-confirmation-client";
import { StorefrontHeader } from "../../../src/modules/storefront/plp-page";

type ConfirmationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const query = await searchParams;
  const orderId = first(query?.orderId);
  const transactionId = first(query?.transactionId) ?? orderId;
  const guestSessionId = first(query?.guestSessionId);
  const revenueMinor = first(query?.revenueMinor);
  const currency = first(query?.currency);
  const quantity = first(query?.quantity);

  return (
    <main className="storefrontPage">
      <StorefrontHeader />
      <div className="storefrontShell">
        <StorefrontPaymentConfirmationClient
          currency={currency}
          guestSessionId={guestSessionId}
          orderId={orderId}
          quantity={quantity}
          revenueMinor={revenueMinor}
          transactionId={transactionId}
        />
      </div>
    </main>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
