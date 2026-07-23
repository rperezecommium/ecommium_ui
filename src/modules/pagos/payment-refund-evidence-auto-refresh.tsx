"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  active: boolean;
};

export function PaymentRefundEvidenceAutoRefresh({ active }: Props) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!active || attempts >= 15) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setAttempts((current) => current + 1);
      router.refresh();
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [active, attempts, router]);

  if (!active) {
    return null;
  }

  return (
    <div aria-live="polite" className="adminBanner adminBannerInfo paymentsRefundRefreshing">
      <strong>Confirmación en curso.</strong> Payments actualiza este detalle cada 2 segundos mientras el proveedor responde. No vuelvas a solicitar el reembolso.
      {attempts >= 15 ? " La comprobación automática ha terminado; revisa de nuevo más tarde o escala el caso si continúa pendiente." : null}
    </div>
  );
}
