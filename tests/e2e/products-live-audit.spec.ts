import { test, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

test.use({ trace: "off", video: "off", screenshot: "off", viewport: { width: 1440, height: 1000 } });
test.skip(process.env.PRODUCTS_LIVE_AUDIT !== "true", "Opt-in: real UI mutations on explicitly identified QA records only.");

test("products live audit confirms persisted QA state through the front", async ({ page }, info) => {
  test.setTimeout(900000);
  const base = process.env.PRODUCTS_AUDIT_BASE_URL ?? "http://localhost:5173";
  if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Live audit is limited to the local UI");
  const credentialsFile = process.env.PRODUCTS_AUDIT_CREDENTIALS_FILE;
  if (!credentialsFile) throw new Error("An explicit employee credentials source is required");
  const source = JSON.parse(await readFile(credentialsFile, "utf8")) as { values: Array<{ key: string; value: string }> };
  const credential = (key: string) => source.values.find((item) => item.key === key)?.value;
  const email = credential("authEmployeeEmail");
  const password = credential("authEmployeePassword");
  if (!email || !password) throw new Error("Configured employee credentials are missing");
  const rows: Array<{ name: string; status: string; detail?: string; durationMs: number; screenshot?: string }> = [];
  const output = path.resolve("artifacts/products-live-audit");
  await mkdir(output, { recursive: true });
  const productId = process.env.PRODUCTS_AUDIT_EXISTING_PRODUCT_ID;
  if (!productId || !/^[a-f0-9-]{36}$/i.test(productId)) throw new Error("An explicit QA product identity is required");
  const productPath = `/admin/products/${productId}`;
  const auditSku = "QA-AUDIT-20261111-A";
  let authenticated = false;
  let sequence = 0;
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "beforeunload") await dialog.accept();
    else await dialog.dismiss(); // Confirmations must be explicitly handled in each test case.
  });
  async function checkpoint(name: string, action: () => Promise<void>) {
    const start = Date.now();
    const row = { name, status: "PASS", durationMs: 0 } as typeof rows[number];
    try { await test.step(name, action); }
    catch (error) { row.status = "FAIL"; row.detail = (error instanceof Error ? error.message : String(error)).replace(/\u001b\[[0-9;]*m/g, "").slice(0, 1600); }
    row.durationMs = Date.now() - start;
    if (authenticated) {
      const filename = `${String(++sequence).padStart(2, "0")}.png`;
      await page.screenshot({ path: path.join(output, filename), fullPage: true }).then(() => { row.screenshot = filename; }).catch(() => {});
    }
    rows.push(row);
    await writeFile(path.join(output, "live.json"), JSON.stringify({ mode: "real-ui-real-bff", productId, rows }, null, 2));
    console.log(`[live] ${row.status}: ${name}`);
  }
  async function openProduct() {
    await page.goto(base + productPath);
    await expect(page.getByLabel("Referencia / SKU", { exact: true })).toHaveValue(auditSku, { timeout: 30000 });
  }
  async function saveDraft() {
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    const draft = page.getByRole("button", { name: "Guardar borrador", exact: true });
    await expect(draft).toBeVisible();
    await draft.click();
    await expect(page.getByText("Guardando producto", { exact: false })).toHaveCount(0, { timeout: 60000 });
    await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeEnabled({ timeout: 60000 });
    const failure = page.locator(".adminBannerError");
    await expect(failure).toHaveCount(0);
  }

  await checkpoint("Sesión Employee real y contexto Admin", async () => {
    await page.goto(base + "/auth/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Entrar con BFF Auth", exact: true }).click();
    await page.waitForURL(/\/admin(?:\/|$)/, { timeout: 30000 });
    authenticated = true;
  });
  if (!authenticated) {
    await writeFile(path.join(output, "live.json"), JSON.stringify({ mode: "real-ui-real-bff", productId, rows }, null, 2));
    expect(rows.filter((row) => row.status === "FAIL")).toEqual([]);
    return;
  }
  await checkpoint("Producto creado: nombre, SKU, precio y stock tras abrir su URL canónica", async () => {
    await openProduct();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(/QA/);
    await expect(page.getByLabel("Existencias", { exact: true })).toHaveValue("12");
    await expect(page.getByLabel("Precio con IVA", { exact: true })).toHaveValue("19.99");
  });
  await checkpoint("Categoría y marca QA siguen seleccionadas al reabrir", async () => {
    await openProduct();
    await expect(page.getByLabel("Categoria principal", { exact: true }).locator("option:checked")).toContainText("QA");
    await expect(page.getByLabel("Marca / proveedor", { exact: true }).locator("option:checked")).toContainText("QA");
  });
  await checkpoint("Edición de nombre y SEO se conserva tras guardar y recargar", async () => {
    await openProduct();
    await page.getByLabel("Nombre", { exact: true }).fill("QA Auditoria Productos 20261111 A editado");
    await page.getByLabel("Titulo SEO", { exact: true }).fill("QA SEO auditado 20261111 A");
    await saveDraft();
    await openProduct();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("QA Auditoria Productos 20261111 A editado");
    await expect(page.getByLabel("Titulo SEO", { exact: true })).toHaveValue("QA SEO auditado 20261111 A");
  });
  await checkpoint("Imagen: subir PNG QA y comprobar presencia inmediata", async () => {
    await openProduct();
    await page.locator('input[type="file"]').first().setInputFiles(path.resolve("tests/fixtures/products-audit.png"));
    await expect(page.getByRole("group", { name: "Galería de imágenes del producto" })).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole("button", { name: /Editar metadata: products-audit/ })).toBeVisible();
  });
  await checkpoint("Imagen: metadata, portada y persistencia al reabrir", async () => {
    // Uploaded draft media belongs to the current editor; save before navigating.
    await page.getByTitle("Título del asset", { exact: true }).fill("QA Imagen Auditoria A");
    await page.getByTitle("Alt del asset", { exact: true }).fill("QA Imagen Auditoria A");
    await page.getByRole("checkbox", { name: "Imagen de portada", exact: true }).check();
    await saveDraft();
    await openProduct();
    await expect(page.getByRole("button", { name: "Editar metadata: QA Imagen Auditoria A", exact: true })).toBeVisible({ timeout: 30000 });
  });
  await checkpoint("Precio y Auditoría no muestran imágenes; resumen de inventario visible", async () => {
    await openProduct();
    await page.getByRole("button", { name: "Precio", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Imágenes", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Auditoria", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Imágenes", exact: true })).toHaveCount(0);
    await expect(page.getByRole("table", { name: "Resumen de inventario por variante" })).toBeVisible();
  });
  await checkpoint("Variante manual: crear, asignar atributo registrado y guardar", async () => {
    await openProduct();
    await page.getByRole("button", { name: "Variantes", exact: true }).click();
    await page.getByRole("button", { name: "Anadir variante", exact: true }).click();
    await page.getByLabel("Referencia de la variante seleccionada", { exact: true }).fill(auditSku + "-S");
    await page.getByRole("button", { name: "Añadir atributo a la variante", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Asignar atributo", exact: true });
    await picker.getByRole("row", { name: /QA Talla Auditoria A/ }).getByRole("button", { name: "Elegir valor", exact: true }).click();
    await page.getByRole("button", { name: "Small", exact: true }).click();
    await expect(page.getByRole("table", { name: "Atributos asignados a la variante" })).toContainText("Small");
    await saveDraft();
    await openProduct();
    await page.getByRole("button", { name: "Variantes", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Seleccionar " + auditSku + "-S", exact: true })).toBeVisible();
  });
  await checkpoint("Variante generada desde un atributo existente", async () => {
    await openProduct();
    await page.getByRole("button", { name: "Variantes", exact: true }).click();
    await page.getByText("Generar variantes desde atributos", { exact: true }).click();
    await page.getByRole("checkbox", { name: "QA Talla Auditoria A", exact: true }).check();
    await page.getByRole("checkbox", { name: "QA Talla Auditoria A: Large", exact: true }).check();
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "SKU / referencia", exact: true }) })).toContainText("Large");
    await saveDraft();
  });
  await checkpoint("Transporte: valor propio y restauración sin checkbox", async () => {
    await openProduct();
    await page.getByRole("button", { name: "Variantes", exact: true }).click();
    await page.getByRole("radio", { name: "Seleccionar " + auditSku + "-S", exact: true }).check();
    await page.getByLabel("Ancho (mm)", { exact: true }).fill("420");
    await expect(page.getByRole("button", { name: "Heredar valores", exact: true })).toBeEnabled();
    await saveDraft();
    await openProduct();
    await page.getByRole("button", { name: "Variantes", exact: true }).click();
    await page.getByRole("radio", { name: "Seleccionar " + auditSku + "-S", exact: true }).check();
    await expect(page.getByLabel("Ancho (mm)", { exact: true })).toHaveValue("420");
    await page.getByRole("button", { name: "Heredar valores", exact: true }).click();
    await expect(page.getByRole("button", { name: "Heredar valores", exact: true })).toBeDisabled();
    await saveDraft();
  });
  await checkpoint("Inventario: edición aislada y stock disponible después de guardar", async () => {
    await openProduct();
    await page.getByRole("button", { name: "Variantes", exact: true }).click();
    await page.getByRole("radio", { name: "Seleccionar " + auditSku + "-S", exact: true }).check();
    await page.getByLabel("Existencias", { exact: true }).fill("8");
    await page.getByLabel("Reservado", { exact: true }).fill("2");
    await page.getByLabel("Stock de seguridad", { exact: true }).fill("1");
    await expect(page.getByRole("table", { name: "Disponibilidad del inventario" })).toContainText("5");
    await saveDraft();
    await openProduct();
    await page.getByRole("button", { name: "Variantes", exact: true }).click();
    await page.getByRole("radio", { name: "Seleccionar " + auditSku + "-S", exact: true }).check();
    await expect(page.getByLabel("Existencias", { exact: true })).toHaveValue("8");
    await page.getByRole("radio", { name: "Seleccionar " + auditSku, exact: true }).check();
    await expect(page.getByLabel("Existencias", { exact: true })).toHaveValue("12");
  });
  await writeFile(path.join(output, "live.json"), JSON.stringify({ mode: "real-ui-real-bff", productId, rows }, null, 2));
  await info.attach("products-live-audit.json", { body: JSON.stringify({ productId, rows }, null, 2), contentType: "application/json" });
  expect(rows.filter((row) => row.status === "FAIL").map(({ name, detail }) => ({ name, detail }))).toEqual([]);
});
