"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { type StorefrontConsentSelection } from "./storefront-consent";
import { storefrontConsentCopy, type StorefrontConsentCopy } from "./storefront-consent-copy";
import { useStorefrontConsentRuntime } from "./storefront-consent-runtime";

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute("hidden"));
}

export function StorefrontConsentBanner() {
  const {
    decision,
    isSaving,
    policy,
    recordDecision,
    reload,
    renewalRequired,
    status,
    locale,
  } = useStorefrontConsentRuntime();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const copy = storefrontConsentCopy(policy?.effectiveLocale ?? locale);

  const openPreferences = useCallback(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setSelected(
      new Set(
        decision?.selections
          .filter((item) => item.status === "GRANTED")
          .map((item) => item.purposeKey) ?? [],
      ),
    );
    setPreferencesOpen(true);
  }, [decision]);

  const closePreferences = useCallback(() => setPreferencesOpen(false), []);

  useEffect(() => {
    if (!preferencesOpen) return undefined;

    document.body.classList.add("storefrontConsentDialogOpen");
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePreferences();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const controls = focusableElements(dialogRef.current);
      if (controls.length === 0) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.classList.remove("storefrontConsentDialogOpen");
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeydown);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [closePreferences, preferencesOpen]);

  const persist = async (
    action: "ACCEPT_ALL" | "REJECT_ALL" | "SAVE_PREFERENCES" | "WITHDRAW_ALL",
  ) => {
    if (!policy) return;
    setMessage("");
    const selections: StorefrontConsentSelection[] =
      action === "SAVE_PREFERENCES"
        ? policy.purposes
            .filter((purpose) => !purpose.necessary)
            .map((purpose) => ({
              purposeKey: purpose.purposeKey,
              status: selected.has(purpose.purposeKey) ? "GRANTED" : "DENIED",
            }))
        : [];
    const result = await recordDecision(
      action,
      selections,
      preferencesOpen ? "PREFERENCE_CENTER" : "BANNER",
    );
    if (!result.ok) {
      setMessage(result.reason === "POLICY_UNAVAILABLE" ? copy.policyUnavailable : copy.saveFailed);
      return;
    }
    closePreferences();
  };

  if (status === "loading" || status === "not-configured") return null;
  if (status === "unavailable") {
    return (
      <aside aria-live="polite" className="storefrontConsentBanner storefrontConsentError">
        <p>{copy.unavailable}</p>
        <button onClick={() => void reload()} type="button">
          {copy.retry}
        </button>
      </aside>
    );
  }
  if (!policy) return null;

  const requiresDecision = renewalRequired || !decision;
  if (!requiresDecision && !preferencesOpen) {
    return (
      <button
        className="storefrontConsentReview"
        onClick={openPreferences}
        type="button"
      >
        {copy.review}
      </button>
    );
  }

  return (
    <section
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-live="polite"
      className="storefrontConsentBanner"
      role="region"
    >
      <div>
        <p className="storefrontConsentEyebrow">{copy.eyebrow}</p>
        <h2 id={titleId}>{copy.title}</h2>
        <p id={descriptionId}>{copy.description}</p>
      </div>
      {preferencesOpen ? (
        <div className="storefrontConsentDialogLayer">
          <button
            aria-label={copy.close}
            className="storefrontConsentDialogBackdrop"
            onClick={closePreferences}
            type="button"
          />
          <div
            aria-describedby={`${descriptionId}-settings`}
            aria-labelledby={`${titleId}-settings`}
            aria-modal="true"
            aria-busy={isSaving}
            className="storefrontConsentDialog"
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <header className="storefrontConsentDialogHeader">
              <div>
                <p className="storefrontConsentEyebrow">{copy.eyebrow}</p>
                <h2 id={`${titleId}-settings`}>{copy.settingsTitle}</h2>
              </div>
              <button aria-label={copy.close} onClick={closePreferences} type="button">×</button>
            </header>
            <p id={`${descriptionId}-settings`}>{copy.settingsDescription}</p>
            <fieldset className="storefrontConsentPreferences">
              <legend className="srOnly">{copy.settingsTitle}</legend>
              {policy.purposes.map((purpose) => {
                const checked = purpose.necessary || selected.has(purpose.purposeKey);
                const status = purpose.necessary ? copy.necessary : checked ? copy.enabled : copy.disabled;
                return (
                  <label key={purpose.purposeKey}>
                    <input
                      aria-label={`${purpose.title}: ${status}`}
                      checked={checked}
                      disabled={purpose.necessary || isSaving}
                      onChange={(event) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(purpose.purposeKey);
                          else next.delete(purpose.purposeKey);
                          return next;
                        })
                      }
                      type="checkbox"
                    />
                    <span>
                      <strong>{purpose.title}</strong>
                      <small>{purpose.description}</small>
                    </span>
                    <em>{status}</em>
                  </label>
                );
              })}
            </fieldset>
            <ConsentActions
              copy={copy}
              firstLayerRejectAction={policy.firstLayerRejectAction}
              isSaving={isSaving}
              onAccept={() => void persist("ACCEPT_ALL")}
              onReject={() => void persist("REJECT_ALL")}
              onSave={() => void persist("SAVE_PREFERENCES")}
              preferencesOpen
            />
            <button className="storefrontConsentWithdraw" disabled={isSaving} onClick={() => void persist("WITHDRAW_ALL")} type="button">
              {copy.withdraw}
            </button>
          </div>
        </div>
      ) : null}
      {message ? <p aria-live="assertive" className="storefrontConsentMessage">{message}</p> : null}
      {!preferencesOpen ? (
        <ConsentActions
          copy={copy}
          firstLayerRejectAction={policy.firstLayerRejectAction}
          isSaving={isSaving}
          onAccept={() => void persist("ACCEPT_ALL")}
          onReject={() => void persist("REJECT_ALL")}
          onSave={openPreferences}
          preferencesOpen={false}
        />
      ) : null}
    </section>
  );
}

function ConsentActions({
  copy,
  firstLayerRejectAction,
  isSaving,
  onAccept,
  onReject,
  onSave,
  preferencesOpen,
}: {
  copy: StorefrontConsentCopy;
  firstLayerRejectAction: boolean;
  isSaving: boolean;
  onAccept: () => void;
  onReject: () => void;
  onSave: () => void;
  preferencesOpen: boolean;
}) {
  return (
    <div aria-label={copy.saving} aria-busy={isSaving} className="storefrontConsentActions">
      {firstLayerRejectAction || preferencesOpen ? (
        <button className="storefrontConsentActionSecondary" disabled={isSaving} onClick={onReject} type="button">
          {copy.reject}
        </button>
      ) : null}
      <button className="storefrontConsentActionSecondary" disabled={isSaving} onClick={onSave} type="button">
        {preferencesOpen ? copy.save : copy.configure}
      </button>
      <button className="storefrontConsentActionPrimary" disabled={isSaving} onClick={onAccept} type="button">
        {copy.accept}
      </button>
    </div>
  );
}
