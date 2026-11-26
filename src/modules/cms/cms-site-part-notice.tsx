"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function CmsSitePartNotice({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("cmsSitePartMessage");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return <section className="adminBanner adminBannerInfo adminBannerDismissible">
    <p role="status">{message}</p>
    <button className="adminBannerClose" type="button" aria-label="Cerrar aviso" onClick={dismiss}><X size={16} aria-hidden="true" /></button>
  </section>;
}
