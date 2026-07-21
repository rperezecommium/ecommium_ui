"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const warningLeadMs = 5 * 60_000;
const activityThrottleMs = 60_000;
const recoveryTtlMs = 12 * 60 * 60_000;
const recoveryChannelName = "ecommium-admin-session-guardian";
const excludedRecoveryFields = /password|secret|token|api.?key|credential|card|cvv|iban|account|email/i;

type AdminSessionState = {
  status: "ACTIVE";
  sessionId: string;
  createdAt: string;
  lastActivityAt: string;
  idleExpiresAt: string | null;
  absoluteExpiresAt: string | null;
  enforcement: "DISABLED" | "ENABLED";
};

type StoredControl =
  | { value: string; kind: "value" }
  | { value: boolean; kind: "checked" }
  | { value: string[]; kind: "multiple" };

type StoredRecovery = {
  version: 1;
  savedAt: string;
  pathname: string;
  forms: Record<string, Record<string, StoredControl>>;
};

type GuardianMessage = {
  type: "activity";
  state: AdminSessionState;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number };

type Props = {
  employeeId: string;
  sessionId?: string;
};

function parseState(value: unknown): AdminSessionState | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const asIso = (candidate: unknown) => (
    typeof candidate === "string" && Number.isFinite(new Date(candidate).getTime())
      ? candidate
      : undefined
  );
  const sessionId = typeof record.sessionId === "string" ? record.sessionId.trim() : "";
  const createdAt = asIso(record.createdAt);
  const lastActivityAt = asIso(record.lastActivityAt);
  const idleExpiresAt = record.idleExpiresAt === null ? null : asIso(record.idleExpiresAt);
  const absoluteExpiresAt = record.absoluteExpiresAt === null ? null : asIso(record.absoluteExpiresAt);

  if (
    record.status !== "ACTIVE" ||
    !sessionId ||
    !createdAt ||
    !lastActivityAt ||
    idleExpiresAt === undefined ||
    absoluteExpiresAt === undefined ||
    (record.enforcement !== "DISABLED" && record.enforcement !== "ENABLED")
  ) {
    return null;
  }

  return {
    status: "ACTIVE",
    sessionId,
    createdAt,
    lastActivityAt,
    idleExpiresAt,
    absoluteExpiresAt,
    enforcement: record.enforcement,
  };
}

function recoveryKey(employeeId: string, pathname: string) {
  return `ecommium-admin-recovery:v1:${employeeId}:${pathname}`;
}

function formKey(form: HTMLFormElement) {
  const index = Array.from(document.forms).indexOf(form);
  return form.dataset.sessionRecoveryKey || form.id || `form-${Math.max(0, index)}`;
}

function readRecovery(employeeId: string, pathname: string): StoredRecovery | null {
  try {
    const raw = window.sessionStorage.getItem(recoveryKey(employeeId, pathname));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRecovery;
    const savedAt = new Date(parsed.savedAt).getTime();
    if (
      parsed.version !== 1 ||
      parsed.pathname !== pathname ||
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > recoveryTtlMs ||
      typeof parsed.forms !== "object" ||
      parsed.forms === null
    ) {
      window.sessionStorage.removeItem(recoveryKey(employeeId, pathname));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeRecovery(employeeId: string, pathname: string, recovery: StoredRecovery) {
  try {
    const serialized = JSON.stringify(recovery);
    if (serialized.length <= 100_000) {
      window.sessionStorage.setItem(recoveryKey(employeeId, pathname), serialized);
    }
  } catch {
    // La recuperación es opcional: cuota o modo privado no deben bloquear la edición.
  }
}

function isRecoverableControl(control: Element): control is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) {
    return false;
  }
  if (!control.name || control.disabled || control.dataset.sessionRecovery === "off") return false;
  if (excludedRecoveryFields.test(control.name) || excludedRecoveryFields.test(control.id)) return false;
  if (control instanceof HTMLInputElement) {
    return !["button", "submit", "reset", "file", "hidden", "image", "password"].includes(control.type);
  }
  return true;
}

function snapshotForm(form: HTMLFormElement, employeeId: string, pathname: string) {
  if (form.dataset.sessionRecovery === "off") return;
  const controls: Record<string, StoredControl> = {};
  for (const element of Array.from(form.elements)) {
    if (!isRecoverableControl(element)) continue;
    if (Object.keys(controls).length >= 120) break;

    if (element instanceof HTMLInputElement) {
      if (element.type === "radio" && !element.checked) continue;
      controls[element.name] = element.type === "checkbox"
        ? { kind: "checked", value: element.checked }
        : { kind: "value", value: element.value.slice(0, 10_000) };
      continue;
    }

    if (element instanceof HTMLSelectElement && element.multiple) {
      controls[element.name] = {
        kind: "multiple",
        value: Array.from(element.selectedOptions).map((option) => option.value).slice(0, 80),
      };
      continue;
    }

    controls[element.name] = { kind: "value", value: element.value.slice(0, 10_000) };
  }

  if (Object.keys(controls).length === 0) return;
  const current = readRecovery(employeeId, pathname) ?? {
    version: 1 as const,
    savedAt: new Date().toISOString(),
    pathname,
    forms: {},
  };
  current.savedAt = new Date().toISOString();
  current.forms[formKey(form)] = controls;
  writeRecovery(employeeId, pathname, current);
}

function snapshotAllForms(employeeId: string, pathname: string) {
  for (const form of Array.from(document.forms)) {
    snapshotForm(form, employeeId, pathname);
  }
}

function restoreRecovery(recovery: StoredRecovery) {
  for (const form of Array.from(document.forms)) {
    const controls = recovery.forms[formKey(form)];
    if (!controls) continue;

    for (const element of Array.from(form.elements)) {
      if (!isRecoverableControl(element)) continue;
      const stored = controls[element.name];
      if (!stored) continue;

      if (element instanceof HTMLInputElement && element.type === "checkbox" && stored.kind === "checked") {
        element.checked = stored.value === true;
      } else if (element instanceof HTMLInputElement && element.type === "radio" && stored.kind === "value") {
        element.checked = element.value === stored.value;
      } else if (element instanceof HTMLSelectElement && element.multiple && stored.kind === "multiple") {
        const values = new Set(stored.value);
        for (const option of Array.from(element.options)) option.selected = values.has(option.value);
      } else if (stored.kind === "value" && typeof stored.value === "string") {
        element.value = stored.value;
      } else {
        continue;
      }

      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

function timestamp(value: string | null) {
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function requestState(path: "state" | "continue"): Promise<ApiResult<AdminSessionState>> {
  try {
    const response = await fetch(`/api/admin/session/${path}`, {
      method: path === "state" ? "GET" : "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return { ok: false, status: response.status };
    const state = parseState(await response.json());
    return state ? { ok: true, data: state } : { ok: false, status: 502 };
  } catch {
    return { ok: false, status: 503 };
  }
}

async function refreshTechnicalToken() {
  try {
    const response = await fetch("/api/admin/session/refresh", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function AdminSessionGuardian({ employeeId, sessionId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<AdminSessionState | null>(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [busy, setBusy] = useState<"continue" | "close" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<StoredRecovery | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityAtRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);

  const clearWarningTimer = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = null;
  }, []);

  const applyState = useCallback((next: AdminSessionState) => {
    setState(next);
    clearWarningTimer();
    const idleExpiresAt = timestamp(next.idleExpiresAt);
    if (next.enforcement !== "ENABLED" || !idleExpiresAt) {
      setWarningOpen(false);
      return;
    }
    const delay = idleExpiresAt - Date.now() - warningLeadMs;
    if (delay <= 0) {
      setWarningOpen(true);
      return;
    }
    warningTimerRef.current = setTimeout(() => setWarningOpen(true), delay);
  }, [clearWarningTimer]);

  const clearLocalSessionAndRedirect = useCallback(async () => {
    await fetch("/api/admin/session/clear", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    }).catch(() => undefined);
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
  }, []);

  const requestWithTechnicalRefresh = useCallback(async (path: "state" | "continue") => {
    const first = await requestState(path);
    if (first.ok || first.status !== 401) return first;
    if (!(await refreshTechnicalToken())) return first;
    router.refresh();
    return requestState(path);
  }, [router]);

  const syncState = useCallback(async () => {
    const result = await requestWithTechnicalRefresh("state");
    if (result.ok) {
      applyState(result.data);
      return;
    }
    if (result.status === 401) {
      await clearLocalSessionAndRedirect();
    }
  }, [applyState, clearLocalSessionAndRedirect, requestWithTechnicalRefresh]);

  const reportHumanActivity = useCallback(() => {
    if (warningOpen || busy || Date.now() - activityAtRef.current < activityThrottleMs) return;
    activityAtRef.current = Date.now();
    void (async () => {
      const result = await requestWithTechnicalRefresh("continue");
      if (result.ok) {
        applyState(result.data);
        channelRef.current?.postMessage({ type: "activity", state: result.data } satisfies GuardianMessage);
        return;
      }
      if (result.status === 401) await clearLocalSessionAndRedirect();
    })();
  }, [applyState, busy, clearLocalSessionAndRedirect, requestWithTechnicalRefresh, warningOpen]);

  const continueWorking = useCallback(async () => {
    setBusy("continue");
    setNotice(null);
    const result = await requestWithTechnicalRefresh("continue");
    setBusy(null);
    if (result.ok) {
      applyState(result.data);
      channelRef.current?.postMessage({ type: "activity", state: result.data } satisfies GuardianMessage);
      setWarningOpen(false);
      return;
    }
    if (result.status === 401) {
      await clearLocalSessionAndRedirect();
      return;
    }
    setNotice("No pudimos renovar la sesión por un problema temporal. Tu copia de recuperación sigue disponible; vuelve a intentarlo.");
  }, [applyState, clearLocalSessionAndRedirect, requestWithTechnicalRefresh]);

  const closeSession = useCallback(async () => {
    snapshotAllForms(employeeId, pathname);
    setRecovery(readRecovery(employeeId, pathname));
    setBusy("close");
    setNotice(null);
    const response = await fetch("/api/admin/session/close", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    }).catch(() => null);
    setBusy(null);
    if (response?.ok || response?.status === 401) {
      await clearLocalSessionAndRedirect();
      return;
    }
    setNotice("No pudimos cerrar la sesión por un problema temporal. No se ha borrado ninguna credencial ni tu copia de recuperación.");
  }, [clearLocalSessionAndRedirect, employeeId, pathname]);

  useEffect(() => {
    const recoveryTimer = window.setTimeout(() => {
      setRecovery(readRecovery(employeeId, pathname));
    }, 0);
    const stateTimer = window.setTimeout(() => {
      void syncState();
    }, 0);

    const channel = typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(`${recoveryChannelName}:${sessionId ?? "current"}`);
    channelRef.current = channel;
    channel?.addEventListener("message", (event: MessageEvent<GuardianMessage>) => {
      if (event.data?.type === "activity") applyState(event.data.state);
    });

    const onActivity = (event: Event) => {
      const target = event.target;
      if (target instanceof Element) {
        const form = target.closest("form");
        if (form instanceof HTMLFormElement && (event.type === "input" || event.type === "change")) {
          snapshotForm(form, employeeId, pathname);
          setRecovery(readRecovery(employeeId, pathname));
        }
      }
      reportHumanActivity();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncState();
    };
    const onBeforeUnload = () => snapshotAllForms(employeeId, pathname);
    const eventTypes = ["pointerdown", "keydown", "input", "change", "focusin"] as const;
    eventTypes.forEach((eventType) => document.addEventListener(eventType, onActivity, true));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.clearTimeout(recoveryTimer);
      window.clearTimeout(stateTimer);
      clearWarningTimer();
      eventTypes.forEach((eventType) => document.removeEventListener(eventType, onActivity, true));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      channel?.close();
      channelRef.current = null;
    };
  }, [applyState, clearWarningTimer, employeeId, pathname, reportHumanActivity, sessionId, syncState]);

  useEffect(() => {
    if (!warningOpen) return;
    continueButtonRef.current?.focus();
    const idleExpiresAt = timestamp(state?.idleExpiresAt ?? null);
    const updateCountdown = () => setCountdown(formatCountdown((idleExpiresAt ?? Date.now()) - Date.now()));
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(interval);
  }, [state?.idleExpiresAt, warningOpen]);

  const restoreDraft = () => {
    if (!recovery) return;
    restoreRecovery(recovery);
    setNotice("Se restauró la copia de recuperación en los formularios visibles. Revisa los datos antes de guardar.");
  };

  const discardDraft = () => {
    window.sessionStorage.removeItem(recoveryKey(employeeId, pathname));
    setRecovery(null);
  };

  return (
    <>
      {recovery ? (
        <aside className="adminSessionRecovery" aria-label="Copia de recuperación disponible" role="status">
          <div>
            <strong>Hay una copia de recuperación en esta pestaña</strong>
            <p>Se guardó {new Date(recovery.savedAt).toLocaleString()} y no contiene contraseñas, secretos ni datos de pago.</p>
          </div>
          <div className="adminSessionRecoveryActions">
            <button className="adminButton adminButtonTiny" onClick={restoreDraft} type="button">Recuperar</button>
            <button className="adminButton adminButtonTiny" onClick={discardDraft} type="button">Descartar</button>
          </div>
        </aside>
      ) : null}

      {warningOpen ? (
        <div className="adminSessionWarningLayer">
          <aside aria-describedby="admin-session-warning-description" aria-labelledby="admin-session-warning-title" aria-modal="true" className="adminSessionWarning" role="dialog">
            <p className="adminSessionWarningEyebrow">Sesión administrativa</p>
            <h2 id="admin-session-warning-title">Tu sesión está a punto de expirar</h2>
            <p id="admin-session-warning-description">
              Para proteger el Admin, necesitamos confirmar que sigues trabajando. Tiempo restante: <strong>{countdown}</strong>.
            </p>
            {notice ? <p className="adminSessionWarningError" role="alert">{notice}</p> : null}
            <div className="adminSessionWarningActions">
              <button className="adminButton adminButtonPrimary" disabled={busy !== null} onClick={() => void continueWorking()} ref={continueButtonRef} type="button">
                {busy === "continue" ? "Renovando…" : "Continuar trabajando"}
              </button>
              <button className="adminButton adminButtonDanger" disabled={busy !== null} onClick={() => void closeSession()} type="button">
                {busy === "close" ? "Cerrando…" : "Cerrar sesión"}
              </button>
            </div>
            <p className="adminSessionWarningHint">La renovación se valida en el servidor. Si hay un problema de red, no cerraremos tu sesión ni borraremos la copia de recuperación.</p>
          </aside>
        </div>
      ) : notice ? <p className="adminSessionNotice" role="status">{notice}</p> : null}
    </>
  );
}
