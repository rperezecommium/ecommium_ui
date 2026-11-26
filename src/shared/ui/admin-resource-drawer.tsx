"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { AdminResizableDrawer } from "./admin-resizable-drawer";

export function AdminResourceDrawer({ drawerId, title, description, closeHref, onClose, children, className = "" }: {
  drawerId: string;
  className?: string;
  title: string;
  description: string;
  closeHref?: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const close = useCallback(() => {
    if (onClose) onClose();
    else if (closeHref) router.replace(closeHref, { scroll: false });
  }, [router, closeHref, onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = drawerRef.current;
    const controls = () => Array.from(drawer?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]',
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    (drawer?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea') ?? drawer)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // A native confirmation dialog owns focus and Escape while it is open.
      if (drawer?.querySelector("dialog[open]")) return;
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const elements = controls();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) { event.preventDefault(); drawer?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === drawer)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [close]);

  return (
    <div className="adminDrawerBackdrop">
      <button className="adminResourceDrawerBackdrop" aria-label={`Cerrar ${title}`} onClick={close} tabIndex={-1} type="button" />
      <AdminResizableDrawer drawerId={drawerId} className={`adminSideDrawer adminResourceDrawer ${className}`} aria-labelledby={titleId} aria-describedby={descriptionId} aria-modal="true" role="dialog" ref={drawerRef} tabIndex={-1}>
        <div className="adminSideDrawerHeader">
          <div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div>
          {closeHref && !onClose ? <Link className="adminButton adminButtonTiny" href={closeHref} replace scroll={false}>Cerrar</Link> : <button className="adminButton adminButtonTiny" type="button" onClick={close}>Cerrar</button>}
        </div>
        {children}
      </AdminResizableDrawer>
    </div>
  );
}
