import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";

// Opt-in evidence from real browser renders against the explicit test BFF.
export async function captureEvidence(page: Page, name: string) {
  if (process.env.ECOMMIUM_QA_SCREENSHOTS !== "true") return;
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Invalid evidence filename");
  const directory = path.resolve("docs/qa/evidence/20261105");
  await mkdir(directory, { recursive: true });
  const recovery = page.getByRole("status", { name: "Copia de recuperación disponible", exact: true });
  if (await recovery.isVisible() && !(await page.getByRole("dialog").first().isVisible()) && await page.locator(":popover-open").count() === 0) {
    await recovery.getByRole("button", { name: "Descartar", exact: true }).click();
    await recovery.waitFor({ state: "hidden" });
  }
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll(".adminMain, .adminContent").forEach(element => element.scrollTo(0, 0));
  });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}
