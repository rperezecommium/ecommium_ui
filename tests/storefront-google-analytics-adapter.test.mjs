import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/modules/storefront/storefront-google-analytics-adapter.tsx", import.meta.url),
  "utf8",
);
const metaPixelSource = readFileSync(
  new URL("../src/modules/storefront/storefront-meta-pixel-adapter.tsx", import.meta.url),
  "utf8",
);
const matomoSource = readFileSync(
  new URL("../src/modules/storefront/storefront-matomo-cloud-adapter.tsx", import.meta.url),
  "utf8",
);
const claritySource = readFileSync(
  new URL("../src/modules/storefront/storefront-microsoft-clarity-adapter.tsx", import.meta.url),
  "utf8",
);
const header = readFileSync(
  new URL("../src/modules/storefront/storefront-header.tsx", import.meta.url),
  "utf8",
);
const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

test("Approved provider adapters are code-owned, gated, and mounted through the integration registry", () => {
  assert.match(source, /https:\/\/www\.googletagmanager\.com/);
  assert.match(source, /StorefrontConsentScriptGate/);
  assert.match(source, /analyticsWindow\.gtag\("config", measurementId\)/);
  assert.match(source, /ga-disable-\$\{measurementId\}/);
  assert.match(header, /StorefrontConsentIntegrationRegistry/);
  assert.match(header, /storefrontConsentIntegrations/);
  assert.match(nextConfig, /https:\/\/www\.googletagmanager\.com/);
  assert.match(nextConfig, /https:\/\/www\.google-analytics\.com/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|user_id|userId|purchase|event\s*[,(:]/i);
  assert.match(metaPixelSource, /https:\/\/connect\.facebook\.net\/en_US\/fbevents\.js/);
  assert.match(metaPixelSource, /StorefrontConsentScriptGate/);
  assert.match(metaPixelSource, /fbq\("track", "PageView"\)/);
  assert.match(metaPixelSource, /fbq\("consent", "grant"\)/);
  assert.match(metaPixelSource, /fbq\("consent", "revoke"\)/);
  assert.match(nextConfig, /https:\/\/connect\.facebook\.net/);
  assert.match(nextConfig, /https:\/\/www\.facebook\.com/);
  assert.doesNotMatch(metaPixelSource, /fbq\("track",\s*"(?!PageView")/);
  assert.doesNotMatch(metaPixelSource, /fbq\("init",\s*pixelId\s*,/);
  assert.match(matomoSource, /StorefrontConsentScriptGate/);
  assert.match(matomoSource, /"requireConsent"/);
  assert.match(matomoSource, /"setConsentGiven"/);
  assert.match(matomoSource, /"forgetConsentGiven"/);
  assert.match(nextConfig, /https:\/\/\*\.matomo\.cloud/);
  assert.match(claritySource, /StorefrontConsentScriptGate/);
  assert.match(claritySource, /"consentv2"/);
  assert.match(claritySource, /analytics_Storage: "granted"/);
  assert.match(claritySource, /analytics_Storage: "denied"/);
  assert.match(nextConfig, /https:\/\/www\.clarity\.ms/);
});
