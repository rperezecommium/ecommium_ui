"use client";

import { useState } from "react";
import type { AfterSalesAdminCaseItem, AfterSalesAdminDrawerTab } from "./after-sales-admin";
import { createAfterSalesResolutionAction } from "./after-sales-admin-actions";

type ResolutionType = "REFUND" | "EXCHANGE" | "REPAIR" | "REPLACEMENT" | "STORE_CREDIT" | "NO_ACTION";

const options: Array<{ value: ResolutionType; label: string; help: string }> = [
  { value: "REFUND", label: "Reembolso", help: "Indica el importe a devolver. Puede ser total o parcial." },
  { value: "EXCHANGE", label: "Cambio", help: "Registra el cambio acordado con el cliente." },
  { value: "REPAIR", label: "Reparación", help: "Registra la reparación acordada o su orden externa." },
  { value: "REPLACEMENT", label: "Sustitución", help: "Registra el reemplazo del artículo afectado." },
  { value: "STORE_CREDIT", label: "Crédito en tienda", help: "Indica el saldo que se abonará al cliente." },
  { value: "NO_ACTION", label: "Sin compensación", help: "Explica por qué el caso se cierra sin una compensación." },
];

export function AfterSalesResolutionForm({
  caseId,
  caseTab,
  currency,
  items,
}: {
  caseId: string;
  caseTab: AfterSalesAdminDrawerTab;
  currency: string;
  items: AfterSalesAdminCaseItem[];
}) {
  const [resolutionType, setResolutionType] = useState<ResolutionType>("REFUND");
  const selected = options.find((option) => option.value === resolutionType) ?? options[0];
  const requiresAmount = resolutionType === "REFUND" || resolutionType === "STORE_CREDIT";
  const needsExternalReference = ["EXCHANGE", "REPAIR", "REPLACEMENT"].includes(resolutionType);

  return (
    <form action={createAfterSalesResolutionAction} className="pricingDenseForm afterSalesDecisionForm">
      <input name="caseId" type="hidden" value={caseId} />
      <input name="currency" type="hidden" value={currency} />
      <input name="caseTab" type="hidden" value={caseTab} />
      <label className="adminField">
        <span>Línea afectada</span>
        <select name="caseItemId" required>
          {items.map((item) => (
            <option key={item.caseItemId} value={item.caseItemId}>
              {item.name ?? item.caseItemId}
            </option>
          ))}
        </select>
      </label>
      <label className="adminField">
        <span>Decisión</span>
        <select name="resolutionType" onChange={(event) => setResolutionType(event.target.value as ResolutionType)} value={resolutionType}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <p className="adminMuted afterSalesDecisionHint">{selected.help}</p>
      {requiresAmount ? (
        <label className="adminField">
          <span>Importe en céntimos ({currency})</span>
          <input min="1" name="amountMinor" placeholder="Ej. 5118" required type="number" />
        </label>
      ) : null}
      {needsExternalReference ? (
        <label className="adminField">
          <span>{resolutionType === "REPAIR" ? "Orden de reparación" : "Referencia operativa"} <em>(opcional)</em></span>
          <input name="externalReference" placeholder={resolutionType === "REPAIR" ? "Ej. RMA del taller" : "Ej. referencia de reposición"} />
        </label>
      ) : null}
      {resolutionType === "NO_ACTION" ? (
        <label className="adminField">
          <span>Motivo de la decisión</span>
          <input minLength={8} name="note" placeholder="Explica la decisión al equipo" required />
        </label>
      ) : null}
      <button className="adminButton" disabled={!items.length} type="submit">Confirmar decisión</button>
    </form>
  );
}
