"use client";

import { useState } from "react";
import type { EmailDeliveryStatus } from "./communications-admin";

const statuses: EmailDeliveryStatus[] = ["PENDING", "SENT", "FAILED", "SKIPPED", "RETRYING"];

export function CommunicationsDeliveryStatusFilter({ initialStatus }: { initialStatus?: EmailDeliveryStatus }) {
  const [status, setStatus] = useState(initialStatus ?? "");

  return <>
    <label className="adminField">
      <span>Estado</span>
      <select name="deliveryStatus" value={status} onChange={event => setStatus(event.target.value)}>
        <option value="">Todos</option>
        {statuses.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    <label className="adminCheckbox communicationsDeliveryFailures">
      <input type="checkbox" checked={status === "FAILED"} onChange={event => setStatus(event.target.checked ? "FAILED" : "")} />
      Ver fallidas
    </label>
  </>;
}
