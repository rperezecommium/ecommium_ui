"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { StorefrontPdpContentClient } from "../storefront/pdp-content-client";
import type { StorefrontPdpData } from "../storefront/pdp";

export function ProductPdpPreviewModal({ data, initialVariantId, onClose }: { data: StorefrontPdpData; initialVariantId?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; previousFocus?.focus({ preventScroll: true }); };
  }, []);

  return (
    <dialog ref={dialog} className="productPdpPreviewModal" aria-labelledby="product-preview-title"
      onCancel={event => { event.preventDefault(); if (!dialog.current?.querySelector(".storefrontPdpZoomModal")) onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      } }}>
      <header className="productPreviewHeader">
        <h2 id="product-preview-title">Vista previa PDP</h2>
        <div className="productPreviewHeaderActions">
          {data.productId ? <Link className="adminButton" href={`/admin/products/${encodeURIComponent(data.productId)}/storefront-preview`}>Ver en tienda</Link> : null}
          <button ref={closeButton} aria-label="Cerrar vista previa" className="adminIconButton" type="button" onClick={onClose}><X aria-hidden="true" size={18} /></button>
        </div>
      </header>
      <div className="productPdpPreviewContent storefrontPage">
        <div className="storefrontShell">
          <StorefrontPdpContentClient data={data} initialVariantId={initialVariantId} preview />
        </div>
      </div>
    </dialog>
  );
}
