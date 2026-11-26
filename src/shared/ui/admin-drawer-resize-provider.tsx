"use client";

import { createContext, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export const AdminDrawerResizeContext = createContext<Map<string, number> | null>(null);

export function AdminDrawerResizeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Query-string changes can open/close a drawer. A different page gets a new
  // map, including when navigating back: no cross-page or persistent storage.
  const pageMemory = useMemo(() => ({ pathname, widths: new Map<string, number>() }), [pathname]);
  return <AdminDrawerResizeContext.Provider value={pageMemory.widths}>{children}</AdminDrawerResizeContext.Provider>;
}
