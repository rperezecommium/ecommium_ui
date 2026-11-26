"use client";

import { createPaymentRefundAction } from "./payments-admin-actions";

type Props = {
  currency: string;
  referenceId?: string;
  refundId: string;
  refundableMinor: number;
  transactionId: string;
};

export function PaymentRefundRequestForm({
  currency,
  referenceId,
  refundId,
  refundableMinor,
  transactionId,
}: Props) {
  return (
    <form action={createPaymentRefundAction} className="paymentsRefundRequestForm">
      <input name="transactionId" type="hidden" value={transactionId} />
      <input name="referenceId" type="hidden" value={referenceId ?? ""} />
      <input name="currency" type="hidden" value={currency} />
      <input name="refundId" type="hidden" value={refundId} />
      <label className="adminField">
        <input defaultValue={refundableMinor} max={refundableMinor} min="1" name="valueMinor" aria-label={`Importe en céntimos de ${currency}`} title={`Introduce el importe en céntimos de ${currency}`} step="1" required type="number" />
      </label>
      <label className="adminCheckbox" title="El importe se devolverá al método de pago original.">
        <input name="confirmed" required type="checkbox" />
        Confirmar reembolso
      </label>
      <button className="adminButton adminButtonPrimary" type="submit">
        Solicitar reembolso
      </button>
    </form>
  );
}
