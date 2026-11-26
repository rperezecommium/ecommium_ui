export type StorefrontSignupHumanVerificationMode = "off" | "turnstile";

export const storefrontSignupHumanVerificationAction = "customer_signup";

function normalizeSignupHumanVerificationMode(
  value: string | undefined,
): StorefrontSignupHumanVerificationMode {
  return value?.trim().toLowerCase() === "turnstile" ? "turnstile" : "off";
}

export function getStorefrontSignupHumanVerificationConfig(runtime?: {mode: "off" | "turnstile"; turnstileSiteKey: string}) {
  const mode = runtime?.mode ?? normalizeSignupHumanVerificationMode(
    process.env.ECOMMIUM_SIGNUP_HUMAN_VERIFICATION ?? process.env.NEXT_PUBLIC_ECOMMIUM_SIGNUP_HUMAN_VERIFICATION,
  );
  const turnstileSiteKey =
    runtime?.turnstileSiteKey ?? process.env.ECOMMIUM_TURNSTILE_SITE_KEY?.trim() ?? process.env.NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY?.trim() ?? "";

  return {
    action: storefrontSignupHumanVerificationAction,
    mode,
    turnstileEnabled: mode === "turnstile" && Boolean(turnstileSiteKey),
    turnstileSiteKey,
  };
}
