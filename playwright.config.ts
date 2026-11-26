import { defineConfig } from "@playwright/test";

export default defineConfig({
  // Each spec owns mutable BFF fixtures and a Next process. Keep memory bounded.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  globalSetup: "./tests/e2e/setup.ts",
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    actionTimeout: 10_000,
    trace: "retain-on-failure",
  },
});
