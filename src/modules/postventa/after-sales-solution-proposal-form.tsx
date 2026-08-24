"use client";

import { useState } from "react";
import type { AfterSalesAdminCase, AfterSalesAdminSolutionType } from "./after-sales-admin";
import { sendAfterSalesSolutionProposalAction } from "./after-sales-admin-actions";

type ProposalSolutionType = Exclude<AfterSalesAdminSolutionType, "NO_ACTION"> | "NO_ACTION";

type SolutionDefinition = {
  value: ProposalSolutionType;
  label: string;
  amountRequired: boolean;
  returnQuestion?: string;
  messageLabel: string;
  messagePlaceholder: string;
};

const SOLUTIONS: SolutionDefinition[] = [
  {
    value: "REFUND",
    label: "Reembolso",
    amountRequired: true,
    returnQuestion: "¿Debe devolver el producto?",
    messageLabel: "Mensaje para el cliente",
    messagePlaceholder: "Ej. Te reembolsaremos el importe indicado al recibir el producto.",
  },
  {
    value: "EXCHANGE",
    label: "Cambio",
    amountRequired: false,
    returnQuestion: "¿Debe devolver el producto original?",
    messageLabel: "Mensaje para el cliente",
    messagePlaceholder: "Ej. Te enviaremos el producto acordado cuando recibamos el original.",
  },
  {
    value: "REPAIR",
    label: "Reparación",
    amountRequired: false,
    returnQuestion: "¿Necesitamos recibir el producto para repararlo?",
    messageLabel: "Mensaje para el cliente",
    messagePlaceholder: "Ej. Organizaremos la reparación y te mantendremos informado.",
  },
  {
    value: "REPLACEMENT",
    label: "Reemplazo",
    amountRequired: false,
    returnQuestion: "¿Debe devolver el producto original?",
    messageLabel: "Mensaje para el cliente",
    messagePlaceholder: "Ej. Te enviaremos una sustitución del producto afectado.",
  },
  {
    value: "STORE_CREDIT",
    label: "Crédito en tienda",
    amountRequired: true,
    returnQuestion: "¿Debe devolver el producto?",
    messageLabel: "Mensaje para el cliente",
    messagePlaceholder: "Ej. Añadiremos el importe indicado como crédito en tu cuenta.",
  },
  {
    value: "NO_ACTION",
    label: "Sin acción",
    amountRequired: false,
    messageLabel: "Explicación para el cliente",
    messagePlaceholder: "Explica claramente por qué no podemos ofrecer una solución en este caso.",
  },
];

export function AfterSalesSolutionProposalForm({
  currency,
  selectedCase,
}: {
  currency: string;
  selectedCase: AfterSalesAdminCase;
}) {
  const [solutionType, setSolutionType] = useState<ProposalSolutionType | "">("");
  const [returnRequired, setReturnRequired] = useState(false);
  const selected = SOLUTIONS.find((solution) => solution.value === solutionType) ?? null;

  return (
    <form action={sendAfterSalesSolutionProposalAction} className="pricingDenseForm">
      <input name="caseId" type="hidden" value={selectedCase.caseId} />
      <input name="caseTab" type="hidden" value="propuesta" />
      <input name="currency" type="hidden" value={currency} />

      <label className="adminField">
        <span>Solución ofrecida</span>
        <select
          name="solutionType"
          onChange={(event) => {
            const next = event.target.value as ProposalSolutionType | "";
            setSolutionType(next);
            if (!SOLUTIONS.find((solution) => solution.value === next)?.returnQuestion) {
              setReturnRequired(false);
            }
          }}
          required
          value={solutionType}
        >
          <option disabled value="">Selecciona una solución</option>
          {SOLUTIONS.map((solution) => <option key={solution.value} value={solution.value}>{solution.label}</option>)}
        </select>
      </label>

      {selected ? (
        <>
          <label className="adminField">
            <span>{selected.messageLabel}</span>
            <textarea
              maxLength={4000}
              name="customerMessage"
              placeholder={selected.messagePlaceholder}
              required
              rows={4}
            />
          </label>

          <div className="pricingDenseFormGrid">
            {selected.amountRequired ? (
              <label className="adminField">
                <span>Importe ({currency})</span>
                <input
                  aria-describedby="after-sales-proposal-amount-help"
                  autoComplete="off"
                  inputMode="decimal"
                  name="amount"
                  placeholder="Ej. 51,18 €"
                  required
                  type="text"
                />
                <small id="after-sales-proposal-amount-help">Puedes escribir 51,18 €, 51.18 o 1.234,50. Lo convertiremos automáticamente.</small>
              </label>
            ) : null}
            <label className="adminField">
              <span>Esperar respuesta</span>
              <select defaultValue="7" name="expiresInDays">
                <option value="3">3 días</option>
                <option value="7">7 días</option>
                <option value="14">14 días</option>
                <option value="30">30 días</option>
              </select>
            </label>
          </div>

          {selected.returnQuestion ? (
            <>
              <label className="adminCheckbox">
                <input checked={returnRequired} name="returnRequired" onChange={(event) => setReturnRequired(event.target.checked)} type="checkbox" value="true" />
                {selected.returnQuestion}
              </label>
              {returnRequired ? (
                <label className="adminField">
                  <span>Transporte de la devolución</span>
                  <select defaultValue="STORE" name="returnShippingPaidBy">
                    <option value="STORE">Lo asume la tienda</option>
                    <option value="CUSTOMER">Lo asume el cliente</option>
                  </select>
                </label>
              ) : null}
            </>
          ) : null}

          <button className="adminButton" type="submit">Enviar propuesta al cliente</button>
        </>
      ) : null}
    </form>
  );
}
