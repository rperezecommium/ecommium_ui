"use client";

import { useMemo, useRef, useState } from "react";
import type { AdminContext } from "../../shared/config/admin-context";

type PriceImportItem = {
  externalId?: string | null;
  productId: string;
  variantId?: string | null;
  currency: string;
  basePriceMinor: number;
  listPriceMinor?: number | null;
  costPriceMinor?: number | null;
  priceTableId?: string | null;
  tradePolicy?: string | null;
  channel?: string | null;
  customerGroup?: string | null;
  country?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  timezone?: string | null;
  taxIncluded?: boolean;
  active?: boolean;
  priority?: number;
  source?: string;
};

type BulkJobStatus = {
  jobId: string;
  state: string;
  total: number;
  applied: number;
  conflicts: number;
  projected: number;
  pending: number;
  pendingProjection: number;
  lastError: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type JobRow = {
  index: number;
  jobId: string;
  status: BulkJobStatus;
};

type ImportPhase = "idle" | "validating" | "submitting" | "polling" | "completed" | "failed";

type PricingBulkImportClientProps = {
  context: AdminContext;
};

const chunkSize = 10_000;
const maxRows = 1_000_000;
const terminalStates = new Set(["COMPLETED", "COMPLETED_WITH_CONFLICTS", "FAILED"]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function operationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function headerValue(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean | undefined) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "si", "sí"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function parseInteger(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseMoneyMinor(row: Record<string, string>) {
  const minor = headerValue(row, ["amountminor", "amountminor", "basepriceminor", "baseprice", "amountminor"]);
  const parsedMinor = parseInteger(minor);
  if (typeof parsedMinor === "number") return parsedMinor;

  const decimal = headerValue(row, ["amount", "price", "basepriceamount", "basepriceeuro", "basepriceeur"]);
  if (!decimal) return undefined;
  const value = Number(decimal.replace(",", "."));
  return Number.isFinite(value) ? Math.round(value * 100) : undefined;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const delimiter = detectDelimiter(text);

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      row.push(field.trim());
      field = "";
      continue;
    }
    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell)) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  row.push(field.trim());
  if (row.some((cell) => cell)) rows.push(row);

  const headers = (rows.shift() ?? []).map(normalizeHeader);
  return rows.map((cells, index) => ({
    rowNumber: index + 2,
    row: headers.reduce<Record<string, string>>((acc, header, cellIndex) => {
      if (header) acc[header] = cells[cellIndex] ?? "";
      return acc;
    }, {}),
  }));
}

function detectDelimiter(text: string) {
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  const scores = [
    { delimiter: ";", count: header.split(";").length },
    { delimiter: ",", count: header.split(",").length },
    { delimiter: "\t", count: header.split("\t").length },
  ];
  scores.sort((a, b) => b.count - a.count);
  return scores[0]?.delimiter ?? ";";
}

function csvRowToItem(row: Record<string, string>, rowNumber: number, context: AdminContext): { item?: PriceImportItem; error?: string } {
  const productId = headerValue(row, ["productid", "product", "productuuid"]);
  const amountMinor = parseMoneyMinor(row);
  const currency = headerValue(row, ["currency", "moneda"]) ?? context.currency ?? "EUR";

  if (!productId) {
    return { error: `Fila ${rowNumber}: falta productId. pricingId puede venir, pero el bulk actual necesita productId.` };
  }
  if (typeof amountMinor !== "number" || amountMinor < 0) {
    return { error: `Fila ${rowNumber}: falta amountMinor/basePriceMinor válido.` };
  }
  if (!/^[A-Z]{3}$/.test(currency.toUpperCase())) {
    return { error: `Fila ${rowNumber}: currency debe usar ISO 4217, ejemplo EUR.` };
  }

  return {
    item: {
      externalId: headerValue(row, ["pricingid", "priceid", "externalid", "id"]) ?? null,
      productId,
      variantId: headerValue(row, ["variantid", "itemid", "skuid"]) ?? null,
      currency: currency.toUpperCase(),
      basePriceMinor: amountMinor,
      listPriceMinor: parseInteger(headerValue(row, ["listpriceminor", "listpriceamountminor"])) ?? null,
      costPriceMinor: parseInteger(headerValue(row, ["costpriceminor", "costamountminor"])) ?? null,
      priceTableId: headerValue(row, ["pricetableid", "pricetable"]) ?? null,
      tradePolicy: headerValue(row, ["tradepolicy", "policy"]) ?? null,
      channel: headerValue(row, ["channel"]) ?? context.channel ?? "import",
      customerGroup: headerValue(row, ["customergroup", "customersegment"]) ?? null,
      country: headerValue(row, ["country"]) ?? context.country ?? null,
      validFrom: headerValue(row, ["validfrom", "from"]) ?? null,
      validUntil: headerValue(row, ["validuntil", "to"]) ?? null,
      timezone: headerValue(row, ["timezone"]) ?? "UTC",
      taxIncluded: parseBoolean(headerValue(row, ["taxincluded", "taxincludedinprice"]), false),
      active: parseBoolean(headerValue(row, ["active", "isactive"]), true),
      priority: parseInteger(headerValue(row, ["priority"])) ?? 1,
      source: headerValue(row, ["source"]) ?? "BASE",
    },
  };
}

function isCsvFile(file: File) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv")) return false;
  if (!file.type) return true;
  return ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"].includes(file.type);
}

function statusProgress(status: BulkJobStatus) {
  return Math.min(status.total, Math.max(status.applied + status.conflicts, status.projected));
}

function jobIsTerminal(job: JobRow) {
  return terminalStates.has(job.status.state);
}

function errorText(status: number, fallback: string) {
  if (status === 409) return "Pricing tiene demasiados jobs activos. Esperando capacidad para continuar.";
  if (status === 413) return "El chunk supera el tamaño permitido.";
  if (status === 401) return "La sesión Admin caducó.";
  if (status === 403) return "Falta permiso pricing.admin.write.";
  if (status === 503) return "Pricing Import Bulk no está habilitado o no está disponible.";
  return fallback;
}

export function PricingBulkImportClient({ context }: PricingBulkImportClientProps) {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [message, setMessage] = useState("Selecciona un CSV para comenzar.");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [validRows, setValidRows] = useState(0);
  const [submittedRows, setSubmittedRows] = useState(0);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const abortRef = useRef(false);

  const progress = useMemo(() => {
    const processed = jobs.reduce((sum, job) => sum + statusProgress(job.status), 0);
    const projected = jobs.reduce((sum, job) => sum + Math.min(job.status.projected, job.status.total), 0);
    const conflicts = jobs.reduce((sum, job) => sum + job.status.conflicts, 0);
    const denominator = Math.max(validRows, totalRows, 1);
    return {
      processed,
      projected,
      conflicts,
      percent: Math.round((processed / denominator) * 100),
    };
  }, [jobs, totalRows, validRows]);

  async function refreshJobs(currentJobs = jobs) {
    if (!currentJobs.length) return currentJobs;
    const next: JobRow[] = [];
    for (const job of currentJobs) {
      if (jobIsTerminal(job)) {
        next.push(job);
        continue;
      }
      const response = await fetch(`/api/admin/pricing/bulk-jobs/${encodeURIComponent(job.jobId)}`, { cache: "no-store" });
      if (!response.ok) {
        next.push(job);
        continue;
      }
      const status = await response.json() as BulkJobStatus;
      next.push({ ...job, status });
    }
    setJobs(next);
    return next;
  }

  async function waitForCapacity(currentJobs: JobRow[]) {
    let tracked = currentJobs;
    while (!abortRef.current && tracked.filter((job) => !jobIsTerminal(job)).length >= 2) {
      setMessage("Pricing mantiene 2 jobs activos. Esperando capacidad antes de enviar el siguiente chunk.");
      await sleep(3000);
      tracked = await refreshJobs(tracked);
    }
    return tracked;
  }

  async function submitChunk(items: PriceImportItem[], index: number, currentJobs: JobRow[]) {
    let tracked = await waitForCapacity(currentJobs);
    while (!abortRef.current) {
      const response = await fetch("/api/admin/pricing/bulk-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: operationId(),
          maxItems: items.length,
          items,
        }),
      });
      if (response.ok) {
        const status = await response.json() as BulkJobStatus;
        const next = [...tracked, { index, jobId: status.jobId, status }];
        setJobs(next);
        setSubmittedRows((value) => value + items.length);
        return next;
      }
      if (response.status === 409) {
        setMessage(errorText(response.status, "Esperando capacidad de Pricing."));
        await sleep(4000);
        tracked = await refreshJobs(tracked);
        tracked = await waitForCapacity(tracked);
        continue;
      }
      throw new Error(errorText(response.status, "No se pudo crear el job de pricing."));
    }
    return tracked;
  }

  async function handleFile(file: File | null) {
    abortRef.current = false;
    setError(null);
    setRowErrors([]);
    setJobs([]);
    setTotalRows(0);
    setValidRows(0);
    setSubmittedRows(0);
    setFileName(file?.name ?? null);

    if (!file) {
      setPhase("idle");
      setMessage("Selecciona un CSV para comenzar.");
      return;
    }
    if (!isCsvFile(file)) {
      setPhase("failed");
      setError("Archivo no válido. Sube un CSV; no se aceptan PDF, Excel ni imágenes.");
      setMessage("Formato rechazado antes de enviar datos.");
      return;
    }

    try {
      setPhase("validating");
      setMessage("Leyendo y validando CSV...");
      const text = await file.text();
      const parsedRows = parseCsv(text);
      if (parsedRows.length < 1) throw new Error("El CSV no contiene filas.");
      if (parsedRows.length > maxRows) throw new Error(`El CSV supera ${maxRows.toLocaleString("es-ES")} filas.`);
      setTotalRows(parsedRows.length);

      let chunk: PriceImportItem[] = [];
      let chunkIndex = 0;
      let accepted = 0;
      let trackedJobs: JobRow[] = [];
      const errors: string[] = [];
      setPhase("submitting");

      for (const { row, rowNumber } of parsedRows) {
        if (abortRef.current) break;
        const converted = csvRowToItem(row, rowNumber, context);
        if (converted.error) {
          if (errors.length < 20) errors.push(converted.error);
          continue;
        }
        if (!converted.item) continue;
        chunk.push(converted.item);
        accepted += 1;
        setValidRows(accepted);
        if (chunk.length === chunkSize) {
          setMessage(`Enviando chunk ${chunkIndex + 1} (${accepted.toLocaleString("es-ES")} filas válidas)...`);
          trackedJobs = await submitChunk(chunk, chunkIndex, trackedJobs);
          chunk = [];
          chunkIndex += 1;
        }
      }

      setRowErrors(errors);
      if (!accepted) throw new Error(errors[0] ?? "No hay filas válidas para enviar.");
      if (chunk.length) {
        setMessage(`Enviando chunk ${chunkIndex + 1} (${accepted.toLocaleString("es-ES")} filas válidas)...`);
        trackedJobs = await submitChunk(chunk, chunkIndex, trackedJobs);
      }

      setPhase("polling");
      setMessage("Jobs creados. Consultando progreso hasta finalizar.");
      while (!abortRef.current && trackedJobs.some((job) => !jobIsTerminal(job))) {
        await sleep(3000);
        trackedJobs = await refreshJobs(trackedJobs);
      }
      if (abortRef.current) {
        setMessage("Seguimiento detenido en la UI. Los jobs ya creados pueden seguir procesando en backend.");
        setPhase("idle");
        return;
      }
      const failed = trackedJobs.find((job) => job.status.state === "FAILED");
      setPhase(failed ? "failed" : "completed");
      setMessage(failed ? "Uno o más jobs terminaron en FAILED." : "Importación finalizada.");
      if (failed) setError(failed.status.lastError ?? "Pricing bulk job failed.");
    } catch (caught) {
      setPhase("failed");
      setError(caught instanceof Error ? caught.message : "No se pudo procesar el CSV.");
    }
  }

  const busy = phase === "validating" || phase === "submitting" || phase === "polling";
  const progressWidth = `${Math.min(100, Math.max(0, progress.percent))}%`;

  return (
    <section className="adminCard pricingBulkImportCard">
      <div className="adminCardHeader">
        <div>
          <h2>Importar precios por CSV</h2>
          <p>Actualiza precios en jobs bulk de Pricing. El navegador valida el archivo y lo envía en chunks de 10.000 filas.</p>
        </div>
        <span className={`adminBadge ${phase === "completed" ? "adminBadgeOk" : phase === "failed" ? "adminBadgeError" : ""}`}>{phase}</span>
      </div>

      {error ? <div className="adminBanner adminBannerError"><p>{error}</p></div> : null}
      <div className="adminBanner adminBannerInfo">
        <p>CSV esperado: <code>productId,amountMinor,currency</code>. Opcionales: <code>pricingId</code>, <code>variantId</code>, <code>priceTableId</code>, <code>channel</code>, <code>country</code>, <code>customerGroup</code>, <code>validFrom</code>, <code>validUntil</code>.</p>
      </div>

      <div className="pricingBulkImportDropzone">
        <label className="adminField pricingBulkImportFileField">
          <span>Archivo CSV</span>
          <input
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => void handleFile(event.currentTarget.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <div className="adminButtonRow">
          {busy ? <button className="adminButton" onClick={() => { abortRef.current = true; }} type="button">Detener seguimiento</button> : null}
          <a className="adminButton" download="pricing-bulk-template.csv" href="data:text/csv;charset=utf-8,productId,variantId,pricingId,amountMinor,currency%0A11111111-1111-4111-8111-111111111111,,price-1,999,EUR%0A">
            Descargar plantilla
          </a>
        </div>
      </div>

      <div className="pricingBulkImportProgress" aria-live="polite">
        <div className="pricingBulkImportProgressHeader">
          <strong>{fileName ?? "Sin archivo"}</strong>
          <span>{message}</span>
        </div>
        <div className="pricingBulkImportProgressTrack" aria-label={`Progreso ${progress.percent}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
          <span style={{ width: progressWidth }} />
        </div>
        <div className="pricingBulkImportMetrics">
          <span>Total: {totalRows.toLocaleString("es-ES")}</span>
          <span>Válidas: {validRows.toLocaleString("es-ES")}</span>
          <span>Enviadas: {submittedRows.toLocaleString("es-ES")}</span>
          <span>Aplicadas/conflicto: {progress.processed.toLocaleString("es-ES")}</span>
          <span>Proyectadas: {progress.projected.toLocaleString("es-ES")}</span>
          <span>Conflictos: {progress.conflicts.toLocaleString("es-ES")}</span>
        </div>
      </div>

      {rowErrors.length ? (
        <details className="pricingBulkImportErrors">
          <summary>{rowErrors.length} errores de validación mostrados (máximo 20)</summary>
          <ul className="adminPlainList">
            {rowErrors.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </details>
      ) : null}

      {jobs.length ? (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable">
            <thead><tr><th>Chunk</th><th>Job</th><th>Estado</th><th>Total</th><th>Aplicadas</th><th>Proyectadas</th><th>Conflictos</th><th>Error</th></tr></thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.jobId}>
                  <td>{job.index + 1}</td>
                  <td><code>{job.jobId}</code></td>
                  <td>{job.status.state}</td>
                  <td>{job.status.total}</td>
                  <td>{job.status.applied}</td>
                  <td>{job.status.projected}</td>
                  <td>{job.status.conflicts}</td>
                  <td>{job.status.lastError ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
