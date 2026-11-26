"use client";

import { X } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

const preferenceKey = "ecommium:hide-seo-resolution-notice";
const preferenceEvent = "ecommium:seo-resolution-notice";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(preferenceEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(preferenceEvent, onChange);
  };
}

function isDismissed() {
  try { return window.localStorage.getItem(preferenceKey) === "hidden"; }
  catch { return false; }
}

export function ProductSeoResolutionNotice({ children }: { children: ReactNode }) {
  const savedDismissal = useSyncExternalStore(subscribe, isDismissed, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (savedDismissal || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(preferenceKey, "hidden");
      window.dispatchEvent(new Event(preferenceEvent));
    } catch { /* Closing still works when browser storage is unavailable. */ }
  }

  return (
    <div className="adminBanner adminSection adminBannerDismissible">
      <p>{children}</p>
      <button className="adminBannerClose" type="button" aria-label="No volver a mostrar el aviso de resolución SEO" title="No volver a mostrar" onClick={dismiss}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
