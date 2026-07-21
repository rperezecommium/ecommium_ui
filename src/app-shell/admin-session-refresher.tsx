"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const refreshLeadMs = 60_000;
const channelName = "ecommium-admin-session";

type Props = {
  sessionId?: string;
  expiresAt?: string;
};

type RefreshMessage = {
  type: "refreshed";
  sessionId?: string;
  expiresAt?: string;
};

function toTimestamp(value?: string) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function AdminSessionRefresher({ sessionId, expiresAt }: Props) {
  const router = useRouter();
  const expiresAtRef = useRef(expiresAt);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/session/refresh", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    }).catch(() => null);
    if (!response?.ok) return;

    const payload = await response.json().catch(() => null) as RefreshMessage | null;
    if (!payload?.expiresAt) return;

    expiresAtRef.current = payload.expiresAt;
    channelRef.current?.postMessage({
      type: "refreshed",
      sessionId: payload.sessionId,
      expiresAt: payload.expiresAt,
    } satisfies RefreshMessage);
    router.refresh();
  }, [router]);

  const refreshWithBrowserLock = useCallback(async () => {
    const lockName = `ecommium-admin-refresh:${sessionId ?? "current"}`;
    if (typeof navigator !== "undefined" && "locks" in navigator) {
      await navigator.locks.request(lockName, { ifAvailable: true }, async (lock) => {
        if (lock) await refresh();
      });
      return;
    }
    await refresh();
  }, [refresh, sessionId]);

  const schedule = useCallback(() => {
    clearTimer();
    const expiration = toTimestamp(expiresAtRef.current);
    if (!expiration) return;
    const delay = Math.max(1_000, expiration - Date.now() - refreshLeadMs);
    timerRef.current = setTimeout(() => {
      void refreshWithBrowserLock();
    }, delay);
  }, [clearTimer, refreshWithBrowserLock]);

  useEffect(() => {
    expiresAtRef.current = expiresAt;
    schedule();

    const channel = typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(channelName);
    channelRef.current = channel;
    channel?.addEventListener("message", (event: MessageEvent<RefreshMessage>) => {
      if (event.data?.type !== "refreshed" || !event.data.expiresAt) return;
      expiresAtRef.current = event.data.expiresAt;
      schedule();
    });

    const onVisibilityChange = () => {
      const expiration = toTimestamp(expiresAtRef.current);
      if (document.visibilityState === "visible" && expiration && expiration - Date.now() <= refreshLeadMs) {
        void refreshWithBrowserLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      channel?.close();
      channelRef.current = null;
    };
  }, [clearTimer, expiresAt, refreshWithBrowserLock, schedule]);

  return null;
}
