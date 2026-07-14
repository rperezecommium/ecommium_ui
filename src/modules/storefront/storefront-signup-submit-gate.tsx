"use client";

import { useCallback, useState } from "react";
import { getStorefrontSignupHumanVerificationConfig } from "./storefront-human-verification";
import { StorefrontTurnstileWidget } from "./storefront-turnstile-widget";

type StorefrontSignupSubmitGateProps = {
  pending: boolean;
};

export function StorefrontSignupSubmitGate({
  pending,
}: StorefrontSignupSubmitGateProps) {
  const humanVerification = getStorefrontSignupHumanVerificationConfig();
  const requiresTurnstile = humanVerification.mode === "turnstile";
  const [turnstileVerified, setTurnstileVerified] = useState(
    !requiresTurnstile,
  );
  const canSubmit = !requiresTurnstile || turnstileVerified;
  const verificationHintId = "storefront-signup-verification-hint";
  const handleVerificationChange = useCallback((verified: boolean) => {
    setTurnstileVerified(verified);
  }, []);

  return (
    <>
      <StorefrontTurnstileWidget
        action={humanVerification.action}
        enabled={requiresTurnstile}
        onVerificationChange={handleVerificationChange}
        siteKey={humanVerification.turnstileSiteKey}
      />
      {requiresTurnstile && !turnstileVerified ? (
        <p
          className="storefrontSignupVerificationHint"
          id={verificationHintId}
          role="status"
          aria-live="polite"
        >
          Completa la verificacion humana para activar el registro.
        </p>
      ) : null}
      <button
        aria-describedby={!canSubmit ? verificationHintId : undefined}
        className="storefrontAuthSubmit"
        disabled={pending || !canSubmit}
        type="submit"
      >
        {pending
          ? "Creando..."
          : !canSubmit
            ? "Completa la verificacion"
            : "Crear cuenta"}
      </button>
    </>
  );
}
