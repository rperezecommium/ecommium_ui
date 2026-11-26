import { access } from "node:fs/promises";
import path from "node:path";

export default async function setup() {
  try {
    await access(path.resolve(".next/BUILD_ID"));
  } catch {
    throw new Error("E2E requiere una compilación de Next. Ejecuta npm run test:e2e o npm run build antes de npx playwright test.");
  }
  process.env.NODE_EXTRA_CA_CERTS = path.resolve("tests/e2e/fixtures/loopback.crt");
  // All child servers use synthetic accounts and this test-only signing secret.
  process.env.ECOMMIUM_UI_ADMIN_SESSION_SECRET = "e2e-only-admin-session-signing-secret-2026";
}
