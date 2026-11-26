"use client";

import { Menu } from "lucide-react";
import { forwardRef, useCallback, useContext, useId, useLayoutEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AdminDrawerResizeContext } from "./admin-drawer-resize-provider";
import { availableDrawerWidth, clampDrawerRatio, draggedDrawerRatio, DRAWER_DEFAULT_RATIO, DRAWER_MAX_RATIO, DRAWER_MIN_RATIO, keyboardDrawerRatio } from "./admin-drawer-size";

type Props = ComponentPropsWithoutRef<"div"> & { drawerId: string };
type Drag = { pointer: number; startX: number; startWidth: number; startRatio: number; available: number; moved: boolean; previousCursor: string; previousSelection: string };

/** Standard Admin lateral panel. Keep business forms and close behaviour at the call site. */
export const AdminResizableDrawer = forwardRef<HTMLElement, Props>(function AdminResizableDrawer(
  { drawerId, children, style, id, role = "dialog", tabIndex = -1, ...props }, forwardedRef,
) {
  const widths = useContext(AdminDrawerResizeContext);
  const generatedId = useId();
  const panelId = id ?? generatedId;
  const panel = useRef<HTMLElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const ratio = useRef(DRAWER_DEFAULT_RATIO);
  const available = useRef(1);
  const drag = useRef<Drag | null>(null);
  const frame = useRef<number | null>(null);
  const pendingRatio = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const assignPanel = useCallback((element: HTMLElement | null) => {
    panel.current = element;
    if (typeof forwardedRef === "function") forwardedRef(element);
    else if (forwardedRef) forwardedRef.current = element;
  }, [forwardedRef]);

  const paint = useCallback((nextRatio: number) => {
    ratio.current = clampDrawerRatio(nextRatio);
    panel.current?.style.setProperty("--admin-drawer-available", `${available.current}px`);
    panel.current?.style.setProperty("--admin-drawer-width", `${ratio.current * available.current}px`);
    const percent = Math.round(ratio.current * 100);
    handle.current?.setAttribute("aria-valuenow", String(percent));
    handle.current?.setAttribute("aria-valuetext", `${percent}% del espacio disponible`);
  }, []);

  const flush = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (pendingRatio.current !== null) paint(pendingRatio.current);
    pendingRatio.current = null;
  }, [paint]);

  const finish = useCallback((commit: boolean) => {
    const current = drag.current;
    if (!current) return;
    flush();
    drag.current = null;
    if (commit) widths?.set(drawerId, ratio.current);
    else paint(current.startRatio);
    document.body.style.cursor = current.previousCursor;
    document.body.style.userSelect = current.previousSelection;
    suppressClick.current = current.moved || !commit;
    panel.current?.setAttribute("data-drawer-resize-state", suppressClick.current ? "idle" : "selected");
    if (handle.current?.hasPointerCapture(current.pointer)) handle.current.releasePointerCapture(current.pointer);
  }, [drawerId, flush, paint, widths]);

  useLayoutEffect(() => {
    const measure = () => {
      const sidebar = document.querySelector<HTMLElement>(".adminSidebarPanel");
      const next = availableDrawerWidth(document.documentElement.clientWidth, sidebar?.getBoundingClientRect().right ?? 0);
      if (next !== available.current && drag.current) finish(false);
      available.current = next;
      paint(ratio.current);
    };
    ratio.current = clampDrawerRatio(widths?.get(drawerId) ?? DRAWER_DEFAULT_RATIO);
    measure();
    panel.current?.setAttribute("data-drawer-resize-state", "idle");
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    const sidebar = document.querySelector(".adminSidebarPanel");
    if (sidebar) observer.observe(sidebar);
    window.addEventListener("resize", measure);
    const cancelDrag = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !drag.current) return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };
    // Cancel before a modal's document-level Escape handler can close it.
    document.addEventListener("keydown", cancelDrag, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("keydown", cancelDrag, true);
      finish(false);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [drawerId, finish, paint, widths]);

  const begin = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    panel.current?.setAttribute("data-drawer-resize-state", "selected");
    drag.current = {
      pointer: event.pointerId, startX: event.clientX,
      startWidth: ratio.current * available.current, startRatio: ratio.current,
      available: available.current, moved: false,
      previousCursor: document.body.style.cursor, previousSelection: document.body.style.userSelect,
    };
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointer) return;
    if (!current.moved && Math.abs(event.clientX - current.startX) < 2) return;
    current.moved = true;
    panel.current?.setAttribute("data-drawer-resize-state", "dragging");
    pendingRatio.current = draggedDrawerRatio(current.startWidth, current.startX, event.clientX, current.available);
    if (frame.current === null) frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pendingRatio.current !== null) paint(pendingRatio.current);
      pendingRatio.current = null;
    });
  };

  return (
    <div {...props} id={panelId} role={role} aria-modal={props["aria-modal"] ?? true} tabIndex={tabIndex} ref={assignPanel}
      data-admin-resizable-drawer={drawerId}
      style={{ ...style, "--admin-drawer-min-ratio": DRAWER_MIN_RATIO, "--admin-drawer-max-ratio": DRAWER_MAX_RATIO, "--admin-drawer-default-ratio": DRAWER_DEFAULT_RATIO } as CSSProperties}>
      {children}
      <button ref={handle} className="adminDrawerResizeHandle" type="button" role="separator" aria-label="Ajustar ancho de la ventana lateral" aria-orientation="vertical"
        aria-controls={panelId} aria-valuemin={DRAWER_MIN_RATIO * 100} aria-valuemax={DRAWER_MAX_RATIO * 100} aria-valuenow={DRAWER_DEFAULT_RATIO * 100}
        title="Arrastra para ajustar el ancho. También puedes usar las flechas izquierda y derecha."
        onPointerDown={begin} onPointerMove={move}
        onPointerUp={event => { if (event.pointerId === drag.current?.pointer) finish(true); }}
        onPointerCancel={() => finish(false)} onLostPointerCapture={() => finish(false)}
        onClick={event => {
          event.stopPropagation();
          if (suppressClick.current) { suppressClick.current = false; return; }
          panel.current?.setAttribute("data-drawer-resize-state", "selected");
        }}
        onFocus={() => panel.current?.setAttribute("data-drawer-resize-state", "selected")}
        onBlur={() => { if (!drag.current) panel.current?.setAttribute("data-drawer-resize-state", "idle"); }}
        onKeyDown={event => {
          if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopPropagation(); finish(false); return; }
          const next = keyboardDrawerRatio(ratio.current, event.key, event.shiftKey);
          if (next === null) return;
          event.preventDefault(); event.stopPropagation();
          paint(next); widths?.set(drawerId, next);
          panel.current?.setAttribute("data-drawer-resize-state", "selected");
        }}>
        <Menu size={14} aria-hidden="true" />
      </button>
    </div>
  );
});
