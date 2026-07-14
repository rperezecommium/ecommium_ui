"use client";

import { useEffect, useRef, useState } from "react";

type StorefrontTurnstileStatus =
  | "idle"
  | "loading"
  | "ready"
  | "expired"
  | "error";

type StorefrontTurnstileState = {
  action: string;
  siteKey: string;
  status: StorefrontTurnstileStatus;
  token: string;
};

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window &
  typeof globalThis & {
    turnstile?: TurnstileApi;
    __ecommiumTurnstileScriptPromise?: Promise<TurnstileApi>;
  };

type StorefrontTurnstileWidgetProps = {
  action: string;
  enabled: boolean;
  inputName?: string;
  onVerificationChange?: (verified: boolean) => void;
  siteKey: string;
};

const turnstileScriptUrl =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function getTurnstileWindow() {
  return window as TurnstileWindow;
}

function loadTurnstileScript(): Promise<TurnstileApi> {
  const turnstileWindow = getTurnstileWindow();

  if (turnstileWindow.turnstile) {
    return Promise.resolve(turnstileWindow.turnstile);
  }

  if (turnstileWindow.__ecommiumTurnstileScriptPromise) {
    return turnstileWindow.__ecommiumTurnstileScriptPromise;
  }

  turnstileWindow.__ecommiumTurnstileScriptPromise = new Promise(
    (resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${turnstileScriptUrl}"]`,
      );
      const script = existingScript ?? document.createElement("script");

      script.addEventListener("load", () => {
        if (turnstileWindow.turnstile) {
          resolve(turnstileWindow.turnstile);
          return;
        }
        reject(new Error("Turnstile script loaded without API"));
      });
      script.addEventListener("error", () => {
        reject(new Error("Turnstile script failed to load"));
      });

      if (!existingScript) {
        script.async = true;
        script.defer = true;
        script.src = turnstileScriptUrl;
        document.head.appendChild(script);
      }
    },
  );

  return turnstileWindow.__ecommiumTurnstileScriptPromise;
}

export function StorefrontTurnstileWidget({
  action,
  enabled,
  inputName = "turnstileToken",
  onVerificationChange,
  siteKey,
}: StorefrontTurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [verification, setVerification] = useState<StorefrontTurnstileState>({
    action: "",
    siteKey: "",
    status: "idle",
    token: "",
  });

  useEffect(() => {
    if (!enabled || !siteKey) {
      return undefined;
    }

    let cancelled = false;

    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        if (widgetIdRef.current) {
          turnstile.remove(widgetIdRef.current);
        }

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (nextToken) => {
            onVerificationChange?.(Boolean(nextToken));
            setVerification({
              action,
              siteKey,
              status: "ready",
              token: nextToken,
            });
          },
          "expired-callback": () => {
            onVerificationChange?.(false);
            setVerification({
              action,
              siteKey,
              status: "expired",
              token: "",
            });
          },
          "error-callback": () => {
            onVerificationChange?.(false);
            setVerification({
              action,
              siteKey,
              status: "error",
              token: "",
            });
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          onVerificationChange?.(false);
          setVerification({
            action,
            siteKey,
            status: "error",
            token: "",
          });
        }
      });

    return () => {
      cancelled = true;
      const widgetId = widgetIdRef.current;
      const turnstile = getTurnstileWindow().turnstile;

      if (widgetId && turnstile) {
        turnstile.remove(widgetId);
      }
      widgetIdRef.current = null;
    };
  }, [action, enabled, onVerificationChange, siteKey]);

  if (!enabled) {
    return null;
  }

  const currentVerification =
    verification.action === action && verification.siteKey === siteKey
      ? verification
      : { action, siteKey, status: "loading" as const, token: "" };
  const token =
    currentVerification.status === "ready" ? currentVerification.token : "";
  const status = siteKey ? currentVerification.status : "idle";

  return (
    <div className="storefrontTurnstile" data-status={status}>
      <input name={inputName} readOnly type="hidden" value={token} />
      {siteKey ? (
        <div
          aria-label="Verificacion humana"
          className="storefrontTurnstileWidget"
          ref={containerRef}
        />
      ) : (
        <p className="storefrontTurnstileMessage storefrontTurnstileMessageError">
          La verificacion humana no esta configurada para este entorno.
        </p>
      )}
      {status === "loading" ? (
        <p className="storefrontTurnstileMessage">Preparando verificacion...</p>
      ) : null}
      {status === "expired" ? (
        <p className="storefrontTurnstileMessage storefrontTurnstileMessageError">
          La verificacion expiro. Completa el desafio de nuevo.
        </p>
      ) : null}
      {status === "error" ? (
        <p className="storefrontTurnstileMessage storefrontTurnstileMessageError">
          No pudimos cargar la verificacion. Intentalo de nuevo.
        </p>
      ) : null}
    </div>
  );
}
