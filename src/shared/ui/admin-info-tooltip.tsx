"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AdminInfoTooltipProps = {
  label: string;
  title?: string;
  description: string;
  example?: string;
};

type TooltipPosition = {
  left: number;
  top: number;
  width: number;
};

export function AdminInfoTooltip({ label, title, description, example }: AdminInfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const tooltipId = useId();
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    if (document.activeElement === triggerRef.current) {
      return;
    }
    cancelClose();
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 120);
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !tooltipRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const updatePosition = () => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      const width = Math.min(320, window.innerWidth - 32);
      setPosition({
        left: Math.max(16, Math.min(bounds.right - width, window.innerWidth - width - 16)),
        top: bounds.bottom + 8,
        width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => () => cancelClose(), []);

  return (
    <span className="adminInfoTooltip" onMouseEnter={() => { cancelClose(); setIsOpen(true); }} onMouseLeave={scheduleClose} ref={tooltipRef}>
      <button
        aria-controls={isOpen ? tooltipId : undefined}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={label}
        className="adminInfoTooltipTrigger"
        ref={triggerRef}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
            setIsOpen(false);
          }
        }}
        onClick={() => setIsOpen(true)}
        onFocus={() => setIsOpen(true)}
        type="button"
      >
        <CircleHelp aria-hidden="true" size={17} strokeWidth={2.25} />
      </button>
      {isOpen && position ? createPortal(
        <span
          className="adminInfoTooltipContent"
          id={tooltipId}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          role="tooltip"
          style={position}
        >
          {title ? <strong>{title}</strong> : null}
          <span>{description}</span>
          {example ? <span><b>Ejemplo:</b> {example}</span> : null}
        </span>,
        document.body,
      ) : null}
    </span>
  );
}
