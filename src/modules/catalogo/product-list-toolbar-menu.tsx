"use client";

import { useState, type ReactNode } from "react";

export function ProductListToolbarMenu({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  return (
    <details
      className="productListToolbarMenu"
      open={hovered || pinned}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) { setPinned(false); setHovered(false); }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setPinned(false); setHovered(false);
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="productListToolbarTrigger" onClick={(event) => {
        event.preventDefault();
        setPinned(!pinned);
        setHovered(false);
      }}>
        {icon}{label}
      </summary>
      {children}
    </details>
  );
}
