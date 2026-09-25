"use client";

import { useMemo, useRef, useState } from "react";
import type { AdminContext } from "../../shared/config/admin-context";

type Phase = "idle" | "uploading" | "staged" | "applying" | "polling" | "completed" | "failed";
type OwnerJob = { owner: string; response: Record<string, unknown> };
type ImportResponse = { importJobId?: string; state?: string; jobs?: OwnerJob[]; errors?: Array<{ owner: string; message: string }> };

function operationId() {
  return crypto.randomUUID();
}

function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith(".csv") && (!file.type || ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"].includes(file.type));
}

function jobId(job: OwnerJob) {
  return typeof job.response?.jobId === "string" ? job.response.jobId : null;
}

function jobsParam(jobs: OwnerJob[]) {
  return jobs.map((job) => {
    const id = jobId(job);
    return id ? `${job.owner}:${id}` : null;
  }).filter(Boolean).join(",");
}

function statusProgress(payload: ImportResponse | null) {
  const jobs = payload?.jobs ?? [];
  if (!jobs.length) return payload?.state === "STAGED" ? 25 : 0;
  const terminal = jobs.filter((job) => ["COMPLETED", "COMPLETED_WITH_CONFLICTS", "COMPLETED_WITH_WARNINGS"].includes(String(job.response?.state ?? ""))).length;
  return Math.max(35, Math.round((terminal / jobs.length) * 100));
}

export function CatalogCsvImportClient({ context }: { context: AdminContext }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("Sube un CSV de productos para stagearlo antes de aplicar cambios.");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [payload, setPayload] = useState<ImportResponse | null>(null);
  const [jobs, setJobs] = useState<OwnerJob[]>([]);
  const abortRef = useRef(false);
  const percent = useMemo(() => statusProgress(payload), [payload]);

  async function upload(file: File | null) {
    abortRef.current = false;
    setError(null);
    setPayload(null);
    setJobs([]);
    setImportJobId(null);
    setFileName(file?.name ?? null);
    if (!file) { setPhase("idle"); return; }
    if (!isCsvFile(file)) {
      setPhase("failed");
      setError("Archivo no válido. Sube un CSV; no se aceptan PDF, Excel ni imágenes.");
      return;
    }
    setPhase("uploading");
    setMessage("Subiendo CSV y creando staging de catálogo...");
    const form = new FormData();
    form.set("file", file, file.name);
    form.set("operationId", operationId());
    form.set("sourceSystem", "CSV");
    form.set("warehouseId", "main-warehouse");
    form.set("delimiter", "auto");
    const response = await fetch("/api/admin/catalog-import-jobs/csv", { method: "POST", body: form });
    const body = await response.json().catch(() => ({})) as ImportResponse & { error?: string };
    if (!response.ok) {
      setPhase("failed");
      setError(body.error ?? "No se pudo stagear el CSV de productos.");
      return;
    }
    setPayload(body);
    setImportJobId(body.importJobId ?? null);
    setPhase("staged");
    setMessage("CSV stageado. Revisa y aplica cuando quieras crear jobs de catálogo/precio/stock/media.");
  }

  async function apply() {
    if (!importJobId) return;
    setPhase("applying");
    setError(null);
    setMessage("Creando jobs owner desde el staging CSV...");
    const response = await fetch(`/api/admin/catalog-import-jobs/${encodeURIComponent(importJobId)}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operationId: operationId(),
        catalog: { stageKinds: ["categories", "brands", "products", "variants", "features", "suppliers", "relations"], maxItems: 5_000_000 },
        pricing: { auto: true, chunkSize: 10_000, maxItems: 1_000_000 },
        inventory: { auto: true, chunkSize: 10_000, maxItems: 1_000_000 },
        media: { auto: true, chunkSize: 1_000, maxItems: 1_000_000 },
      }),
    });
    const body = await response.json().catch(() => ({})) as ImportResponse & { error?: string };
    if (!response.ok) {
      setPhase("failed");
      setError(body.error ?? "No se pudo aplicar la importación CSV.");
      return;
    }
    if (body.errors?.length) {
      setPayload(body);
      setPhase("failed");
      setError(body.errors.map((entry) => `${entry.owner}: ${entry.message}`).join(" · "));
      return;
    }
    setPayload(body);
    const ownerJobs = body.jobs ?? [];
    setJobs(ownerJobs);
    setPhase("polling");
    setMessage("Jobs owner creados. Consultando progreso sin bloquear la navegación.");
    let latest: ImportResponse = body;
    while (!abortRef.current && ownerJobs.length) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const query = jobsParam(ownerJobs);
      const status = await fetch(`/api/admin/catalog-import-jobs/${encodeURIComponent(importJobId)}${query ? `?jobs=${encodeURIComponent(query)}` : ""}`, { cache: "no-store" });
      if (!status.ok) continue;
      latest = await status.json() as ImportResponse;
      setPayload(latest);
      if ((latest.jobs ?? []).length && (latest.jobs ?? []).every((job) => ["COMPLETED", "COMPLETED_WITH_CONFLICTS", "COMPLETED_WITH_WARNINGS", "FAILED"].includes(String(job.response?.state ?? "")))) break;
    }
    if (abortRef.current) {
      setPhase("idle");
      setMessage("Seguimiento detenido en UI. Los jobs ya creados siguen en backend.");
      return;
    }
    if ((latest.jobs ?? []).some((job) => String(job.response?.state ?? "").includes("FAILED"))) {
      setPhase("failed");
      setMessage("Uno o más jobs terminaron con fallo.");
      return;
    }
    setPhase("completed");
    setMessage("Importación finalizada o entregada a workers owner.");
  }

  const busy = ["uploading", "applying", "polling"].includes(phase);
  return (
    <section className="adminCard pricingBulkImportCard">
      <div className="adminCardHeader">
        <div>
          <h2>Importar productos por CSV</h2>
          <p>Stagea catálogo desde CSV y luego crea jobs owner para catálogo, precios, stock, media y ReadIndex.</p>
        </div>
        <span className={`adminBadge ${phase === "completed" ? "adminBadgeOk" : phase === "failed" ? "adminBadgeError" : ""}`}>{phase}</span>
      </div>
      {error ? <div className="adminBanner adminBannerError"><p>{error}</p></div> : null}
      <div className="adminBanner adminBannerInfo"><p>Formato compatible con CSV de producto tipo PrestaShop. Los productos digitales se conservan pero no se publican automáticamente si bloquean vendibilidad.</p></div>
      <div className="pricingBulkImportDropzone">
        <label className="adminField pricingBulkImportFileField"><span>CSV de productos</span><input accept=".csv,text/csv" disabled={busy} onChange={(event) => void upload(event.currentTarget.files?.[0] ?? null)} type="file" /></label>
        <div className="adminButtonRow">
          {phase === "staged" && importJobId ? <button className="adminButton adminButtonPrimary" onClick={() => void apply()} type="button">Aplicar importación</button> : null}
          {busy ? <button className="adminButton" onClick={() => { abortRef.current = true; }} type="button">Detener seguimiento</button> : null}
          <a className="adminButton" download="catalog-import-template.csv" href="data:text/csv;charset=utf-8,Product%20ID;Active;Name;Categories;Price%20tax%20excluded;Quantity;Manufacturer;Reference%0A1001;1;Producto%20demo;Demo;12.99;5;Marca;SKU-1001%0A">Descargar plantilla</a>
        </div>
      </div>
      <div className="pricingBulkImportProgress" aria-live="polite">
        <div className="pricingBulkImportProgressHeader"><strong>{fileName ?? "Sin archivo"}</strong><span>{message}</span></div>
        <div className="pricingBulkImportProgressTrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
        <div className="pricingBulkImportMetrics"><span>Tenant: {context.organizationId || "-"} / {context.shopId || "-"}</span><span>Import job: {importJobId ?? "-"}</span><span>Owner jobs: {jobs.length}</span></div>
      </div>
      {payload?.errors?.length ? <div className="adminBanner adminBannerError">{payload.errors.map((entry) => <p key={`${entry.owner}-${entry.message}`}>{entry.owner}: {entry.message}</p>)}</div> : null}
    </section>
  );
}
