"use client";
import { createContext, useContext } from "react";
export type PublicRuntime = { mode: "off" | "turnstile"; turnstileSiteKey: string };
const Context = createContext<PublicRuntime | undefined>(undefined);
export function PublicRuntimeProvider({ value, children }: { value: PublicRuntime; children: React.ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePublicRuntime() { return useContext(Context); }
