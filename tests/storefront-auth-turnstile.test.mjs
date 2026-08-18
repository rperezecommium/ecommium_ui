import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function source(relativePath) {
  return readFileSync(path.resolve(root, relativePath), "utf8");
}

test("storefront signup keeps passive signals and forwards Turnstile token when present", () => {
  const actionsSource = source("src/modules/storefront/storefront-auth-actions.ts");
  const authTypesSource = source("src/modules/storefront/auth-types.ts");
  const verificationSource = source("src/modules/storefront/storefront-human-verification.ts");

  assert.match(actionsSource, /formString\(formData, "startedAt"\)/);
  assert.match(actionsSource, /formString\(formData, "company"\)/);
  assert.match(actionsSource, /formString\(formData, "turnstileToken"\)/);
  assert.match(actionsSource, /verificationResetKey\(\)/);
  assert.match(actionsSource, /verificationResetKey: verificationResetKey\(\)/);
  assert.match(actionsSource, /getStorefrontSignupHumanVerificationConfig/);
  assert.match(actionsSource, /humanVerification\.mode === "turnstile" && !turnstileToken/);
  assert.match(actionsSource, /Completa la verificacion humana para crear tu cuenta/);
  assert.match(actionsSource, /provider: "turnstile"/);
  assert.match(actionsSource, /token: turnstileToken/);
  assert.match(actionsSource, /action: storefrontSignupHumanVerificationAction/);
  assert.match(actionsSource, /activationMode: "email"/);
  assert.match(actionsSource, /No hemos creado tu cuenta ni guardado tus datos/);
  assert.match(authTypesSource, /verificationResetKey\?: string/);
  assert.match(verificationSource, /storefrontSignupHumanVerificationAction = "customer_signup"/);
  assert.match(verificationSource, /NEXT_PUBLIC_ECOMMIUM_SIGNUP_HUMAN_VERIFICATION/);
  assert.match(verificationSource, /NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY/);
});

test("storefront Turnstile configuration exposes only public browser-safe variables", () => {
  const readmeSource = source("README.md");
  const verificationSource = source("src/modules/storefront/storefront-human-verification.ts");

  assert.match(readmeSource, /NEXT_PUBLIC_ECOMMIUM_SIGNUP_HUMAN_VERIFICATION=off\|turnstile/);
  assert.match(readmeSource, /NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY/);
  assert.match(readmeSource, /Never expose the\s+Turnstile secret key/);
  assert.match(readmeSource, /The secret belongs only to the BFF\/Sessions runtime/);
  assert.doesNotMatch(verificationSource, /SECRET|SECRET_KEY|SESSIONS_TURNSTILE_SECRET_KEY/);
});

test("storefront Turnstile documentation covers off on and fail-closed modes", () => {
  const readmeSource = source("README.md");
  const verificationSource = source("src/modules/storefront/storefront-human-verification.ts");
  const gateSource = source("src/modules/storefront/storefront-signup-submit-gate.tsx");
  const widgetSource = source("src/modules/storefront/storefront-turnstile-widget.tsx");
  const actionsSource = source("src/modules/storefront/storefront-auth-actions.ts");

  assert.match(readmeSource, /Configuration matrix:/);
  assert.match(readmeSource, /`off`: no Turnstile widget is rendered/);
  assert.match(readmeSource, /`turnstile` with `NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY`/);
  assert.match(readmeSource, /`turnstile` without `NEXT_PUBLIC_ECOMMIUM_TURNSTILE_SITE_KEY`: signup fails\s+closed/);
  assert.match(readmeSource, /server action refuses requests without `turnstileToken` before calling the\s+BFF/);
  assert.match(readmeSource, /Manual local checks:/);
  assert.match(verificationSource, /turnstileEnabled: mode === "turnstile" && Boolean\(turnstileSiteKey\)/);
  assert.match(gateSource, /const requiresTurnstile = humanVerification\.mode === "turnstile"/);
  assert.match(widgetSource, /La verificacion humana no esta configurada para este entorno/);
  assert.match(actionsSource, /humanVerification\.mode === "turnstile" && !turnstileToken/);
});

test("storefront Turnstile widget loads Cloudflare explicitly and writes the form token", () => {
  const widgetSource = source("src/modules/storefront/storefront-turnstile-widget.tsx");
  const cssSource = source("app/globals.css");

  assert.match(widgetSource, /"use client"/);
  assert.match(widgetSource, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(widgetSource, /__ecommiumTurnstileScriptPromise/);
  assert.match(widgetSource, /turnstile\.render/);
  assert.match(widgetSource, /sitekey: siteKey/);
  assert.match(widgetSource, /action,/);
  assert.match(widgetSource, /callback: \(nextToken\)/);
  assert.match(widgetSource, /onVerificationChange\?\.\(Boolean\(nextToken\)\)/);
  assert.match(widgetSource, /"expired-callback"/);
  assert.match(widgetSource, /onVerificationChange\?\.\(false\)/);
  assert.match(widgetSource, /"error-callback"/);
  assert.match(widgetSource, /name=\{inputName\}/);
  assert.match(widgetSource, /type="hidden"/);
  assert.match(widgetSource, /value=\{token\}/);
  assert.match(widgetSource, /turnstile\.remove\(widgetId\)/);
  assert.match(cssSource, /\.storefrontTurnstile/);
  assert.match(cssSource, /\.storefrontTurnstileWidget/);
  assert.match(cssSource, /\.storefrontTurnstileMessageError/);
});

test("storefront signup submit gate disables submit until Turnstile verifies", () => {
  const gateSource = source("src/modules/storefront/storefront-signup-submit-gate.tsx");
  const cssSource = source("app/globals.css");

  assert.match(gateSource, /getStorefrontSignupHumanVerificationConfig/);
  assert.match(gateSource, /StorefrontTurnstileWidget/);
  assert.match(gateSource, /const requiresTurnstile = humanVerification\.mode === "turnstile"/);
  assert.match(gateSource, /const \[turnstileVerified, setTurnstileVerified\]/);
  assert.match(gateSource, /const canSubmit = !requiresTurnstile \|\| turnstileVerified/);
  assert.match(gateSource, /onVerificationChange=\{handleVerificationChange\}/);
  assert.match(gateSource, /storefront-signup-verification-hint/);
  assert.match(gateSource, /role="status"/);
  assert.match(gateSource, /aria-live="polite"/);
  assert.match(gateSource, /aria-describedby=\{!canSubmit \? verificationHintId : undefined\}/);
  assert.match(gateSource, /disabled=\{pending \|\| !canSubmit\}/);
  assert.match(gateSource, /Completa la verificacion/);
  assert.match(cssSource, /\.storefrontSignupVerificationHint/);
});

test("storefront auth drawer renders signup submit gate only in signup form", () => {
  const drawerSource = source("src/modules/storefront/storefront-auth-drawer.tsx");

  assert.match(drawerSource, /StorefrontSignupSubmitGate/);
  assert.match(drawerSource, /key=\{signupState\.verificationResetKey \?\? "signup-gate"\}/);
  assert.match(
    drawerSource,
    /<label className="storefrontAuthTrap">[\s\S]*?<StorefrontSignupSubmitGate[\s\S]*?pending=\{pending\}/,
  );
  const loginBranch =
    drawerSource.match(/mode === "login" \? \(([\s\S]*?)<\/form>\s*\) : \(/)?.[1] ?? "";
  assert.doesNotMatch(loginBranch, /StorefrontSignupSubmitGate/);
});
