"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search, Upload } from "lucide-react";
import type { AdminContext } from "../../shared/config/admin-context";
import { importPhase, shouldPollImport, statusProgress, type ImportPhase as Phase, type ImportResponse, type ImportOutcomes, type OwnerJob } from "./catalog-csv-import-state";
import { parseImportCategoryAssignment, type ImportCategoryAssignment } from "./catalog-csv-import-category";
import { searchProductCategoriesAction } from "./product-actions";
import type { ProductLookupOption } from "./product-editor-types";

type CommercialContext = {
  channel: string;
  warehouseId: string;
  currency: string;
  country: string;
  publish: boolean;
  availableForSale: boolean;
  manageInventory: boolean;
  allowBackorder: boolean;
};

type InfrastructureCheck = {
  state: "checking" | "ready" | "failed";
  key: string;
  file: File;
  message?: string;
};

const TECHNICAL_CHANNELS = new Set(["admin", "events-cert", "test", "benchmark"]);

function defaultCommercialContext(context: AdminContext): CommercialContext {
  const channel = context.channel && !TECHNICAL_CHANNELS.has(context.channel) ? context.channel : "web";
  return {
    channel,
    warehouseId: "warehouse-default",
    currency: context.currency || "EUR",
    country: context.country || "ES",
    publish: true,
    availableForSale: true,
    manageInventory: true,
    allowBackorder: false,
  };
}

function operationId() {
  return crypto.randomUUID();
}

function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith(".csv") && (!file.type || ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"].includes(file.type));
}

export function CatalogCsvImportClient({ context, categories }: { context: AdminContext; categories: ProductLookupOption[] }) {
  return <CatalogCsvImportForm key={`${context.organizationId}:${context.shopId}:${context.locale}:${context.channel}:${context.currency}:${context.country}`} context={context} categories={categories} />;
}

function CatalogCsvImportForm({ context, categories }: { context: AdminContext; categories: ProductLookupOption[] }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("Sube un CSV de productos para stagearlo antes de aplicar cambios.");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [infrastructure, setInfrastructure] = useState<InfrastructureCheck | null>(null);
  const infrastructureRequest = useRef<AbortController | null>(null);
  const uploadInFlight = useRef(false);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [payload, setPayload] = useState<ImportResponse | null>(null);
  const [outcomes, setOutcomes] = useState<ImportOutcomes | null>(null);
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [outcomeCursors, setOutcomeCursors] = useState<string[]>([]);
  const [jobs, setJobs] = useState<OwnerJob[]>([]);
  const [commercialContext, setCommercialContext] = useState<CommercialContext>(() => defaultCommercialContext(context));
  const [categoryAssignment, setCategoryAssignment] = useState<ImportCategoryAssignment>({ mode: "csv" });
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryPage, setCategoryPage] = useState({ offset: 0, limit: 100, total: categories.length });
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const categoryRequest = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const applyId = useRef<string | null>(null);
  const [watching, setWatching] = useState(false);
  const storageKey = `catalog-import:${context.organizationId}:${context.shopId}`;
  const percent = useMemo(() => statusProgress(payload), [payload]);
  const infrastructureKey = JSON.stringify([context.organizationId, context.shopId, context.locale, commercialContext, categoryAssignment]);
  const currentCheck = infrastructure?.key === infrastructureKey && infrastructure.file === selectedFile ? infrastructure : null;

  useEffect(() => () => infrastructureRequest.current?.abort(), [infrastructureKey]);

  function accept(body: ImportResponse) {
    setPayload(body);
    if (body.outcomes) { setOutcomes(body.outcomes); setOutcomeCursors([]); }
    setJobs(body.jobs ?? []);
    const next = importPhase(body);
    setPhase(next);
    setError(body.errors?.length ? body.errors.map(entry => `${entry.owner}: ${entry.message}`).join(" · ") : null);
    setMessage(next === "completed" ? (body.state === "COMPLETED_WITH_WARNINGS" ? "Importación finalizada con advertencias." : "Importación finalizada.") :
      next === "staged" ? "CSV preparado." : next === "preparing" ? "Preparando CSV..." :
      next === "paused" ? (body.authorizationRefreshPending ? "Validando la sesión renovada..." : "Importación pausada. Reanuda con tu sesión actual.") : next === "failed" ? "Importación detenida por un error." :
      body.phase === "projection" ? "Comprobando publicación..." : "Importación en curso...");
    if (!shouldPollImport(body)) setWatching(false);
  }

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    let cancelled = false;
    async function restore() {
      try {
        const previous = JSON.parse(saved!) as { importJobId: string; operationId: string; fileName: string; commercialContext: CommercialContext; categoryAssignment?: ImportCategoryAssignment };
        if (typeof previous.importJobId !== "string" || typeof previous.operationId !== "string" || !previous.commercialContext ||
          !["channel", "warehouseId", "currency", "country"].every(key => typeof previous.commercialContext[key as keyof CommercialContext] === "string")) {
          throw new Error("No se pudo recuperar el progreso guardado de la importación.");
        }
        const response = await fetch(`/api/admin/catalog-import-jobs/${encodeURIComponent(previous.importJobId)}`, { cache: "no-store" });
        if (cancelled) return;
        applyId.current = previous.operationId;
        setImportJobId(previous.importJobId);
        setFileName(previous.fileName);
        setCommercialContext(previous.commercialContext);
        setCategoryAssignment(parseImportCategoryAssignment(previous.categoryAssignment));
        if (!response.ok) throw new Error("No se pudo recuperar el progreso de la importación.");
        const body = await response.json() as ImportResponse;
        if (cancelled) return;
        setWatching(true);
        accept(body);
      } catch (error) {
        if (!cancelled) { setPhase("failed"); setError(error instanceof Error ? error.message : "No se pudo recuperar el progreso."); }
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, [storageKey]);

  useEffect(() => {
    if (!watching || !importJobId) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/api/admin/catalog-import-jobs/${encodeURIComponent(importJobId!)}`, { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error("No se pudo consultar el progreso de la importación.");
        const body = await response.json() as ImportResponse;
        if (abort.signal.aborted) return;
        accept(body);
        if (shouldPollImport(body)) timer = setTimeout(() => void poll(), 1000);
      } catch (error) {
        if (abort.signal.aborted) return;
        setWatching(false);
        setPhase("failed");
        setError(error instanceof Error ? error.message : "No se pudo consultar el progreso.");
      }
    }
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [watching, importJobId]);

  function invalidateInfrastructure() {
    infrastructureRequest.current?.abort();
    setInfrastructure(null);
  }

  function updateCommercialField<Key extends keyof CommercialContext>(key: Key, value: CommercialContext[Key]) {
    setCommercialContext(current => ({ ...current, [key]: value }));
  }

  function selectFile(file: File | null) {
    invalidateInfrastructure();
    setSelectedFile(file);
    setWatching(false);
    setError(null);
    setPayload(null);
    setOutcomes(null);
    setOutcomeError(null);
    setOutcomeCursors([]);
    setJobs([]);
    setImportJobId(null);
    setFileName(file?.name ?? null);
    setPhase("idle");
    setMessage(file ? "Archivo seleccionado. Sin enviar." : "Sin archivo.");
    if (file) void checkInfrastructure(file);
  }

  async function checkInfrastructure(file = selectedFile) {
    if (!file || importJobId || uploadInFlight.current) return;
    infrastructureRequest.current?.abort();
    const abort = new AbortController();
    infrastructureRequest.current = abort;
    const checked = { key: infrastructureKey, file };
    setInfrastructure({ ...checked, state: "checking" });
    try {
      if (!isCsvFile(file)) throw new Error("Archivo no válido. Sube un CSV; no se aceptan PDF, Excel ni imágenes.");
      parseImportCategoryAssignment(categoryAssignment);
      const query = new URLSearchParams(Object.entries(commercialContext).map(([key, value]) => [key, String(value)]));
      const readiness = await fetch(`/api/admin/catalog-import-jobs/readiness?${query}`, { cache: "no-store", signal: abort.signal });
      const status = await readiness.json() as { ready?: boolean; checks?: Array<{ component: string; ready: boolean }> } | null;
      if (abort.signal.aborted) return;
      const checksValid = Array.isArray(status?.checks) && status.checks.length > 0 &&
        status.checks.every(check => check && typeof check.component === "string" && typeof check.ready === "boolean");
      if (!readiness.ok || status?.ready !== true || !checksValid || status.checks!.some(check => !check.ready)) {
        const missing = checksValid ? status!.checks!.filter(check => !check.ready).map(check => check.component).join(", ") : "";
        throw new Error(`No se ha iniciado la importación. ${missing ? `No disponibles: ${missing}.` : "No se pudo comprobar la infraestructura."}`);
      }
      setInfrastructure({ ...checked, state: "ready" });
    } catch (error) {
      if (!abort.signal.aborted) setInfrastructure({ ...checked, state: "failed", message: error instanceof Error ? error.message : "No se pudo comprobar la infraestructura." });
    }
  }

  async function upload() {
    if (!selectedFile || currentCheck?.state !== "ready" || uploadInFlight.current || importJobId) return;
    const file = selectedFile;
    let assignment: ImportCategoryAssignment;
    try { assignment = parseImportCategoryAssignment(categoryAssignment); }
    catch (error) { setCategoryError(error instanceof Error ? error.message : "Categoría no válida."); invalidateInfrastructure(); return; }
    uploadInFlight.current = true;
    invalidateInfrastructure();
    setError(null);
    setPhase("uploading");
    setMessage("Subiendo CSV y creando staging de catálogo...");
    const form = new FormData();
    form.set("file", file, file.name);
    form.set("operationId", operationId());
    form.set("sourceSystem", "CSV");
    form.set("channel", commercialContext.channel);
    form.set("warehouseId", commercialContext.warehouseId);
    form.set("currency", commercialContext.currency);
    form.set("country", commercialContext.country);
    form.set("publish", String(commercialContext.publish));
    form.set("availableForSale", String(commercialContext.availableForSale));
    form.set("manageInventory", String(commercialContext.manageInventory));
    form.set("allowBackorder", String(commercialContext.allowBackorder));
    form.set("delimiter", "auto");
    form.set("categoryAssignment", JSON.stringify(assignment));
    try {
      let response: Response;
      try { response = await fetch("/api/admin/catalog-import-jobs/csv", { method: "POST", body: form }); }
      catch { setPhase("failed"); setError("No se pudo confirmar la subida del CSV."); return; }
      const body = await response.json().catch(() => ({})) as ImportResponse & { error?: string };
      if (!response.ok) {
        setPhase("failed");
        setError(body.error ?? "No se pudo stagear el CSV de productos.");
        return;
      }
      applyId.current = operationId();
      localStorage.setItem(storageKey, JSON.stringify({ importJobId: body.importJobId, operationId: applyId.current, fileName: file.name, commercialContext, categoryAssignment: assignment }));
      setImportJobId(body.importJobId ?? null);
      setWatching(true);
      accept(body);
    } finally { uploadInFlight.current = false; }
  }

  async function loadOutcomes(cursors: string[]) {
    if (!importJobId) return;
    setOutcomeLoading(true);
    setOutcomeError(null);
    try {
      const cursor = cursors.at(-1);
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const response = await fetch(`/api/admin/catalog-import-jobs/${encodeURIComponent(importJobId)}/outcomes${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo cargar el resultado de los productos.");
      setOutcomes(await response.json() as ImportOutcomes);
      setOutcomeCursors(cursors);
    } catch (error) { setOutcomeError(error instanceof Error ? error.message : "No se pudo cargar el resultado."); }
    finally { setOutcomeLoading(false); }
  }

  async function apply() {
    if (!importJobId) return;
    applyId.current ??= operationId();
    localStorage.setItem(storageKey, JSON.stringify({ importJobId, operationId: applyId.current, fileName, commercialContext, categoryAssignment }));
    setWatching(false);
    setPhase("applying");
    setError(null);
    setMessage("Creando jobs owner desde el staging CSV...");
    let response: Response;
    try { response = await fetch(`/api/admin/catalog-import-jobs/${encodeURIComponent(importJobId)}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operationId: applyId.current ??= operationId(),
        commercialContext,
        catalog: { stageKinds: ["categories", "brands", "products", "variants", "features"], maxItems: 5_000_000 },
        pricing: { auto: true, chunkSize: 10_000, maxItems: 1_000_000 },
        inventory: { auto: true, chunkSize: 10_000, maxItems: 1_000_000 },
        media: { auto: true, chunkSize: 1_000, maxItems: 1_000_000 },
      }),
    }); } catch { setPhase("failed"); setError("No se pudo confirmar la aplicación. Consulta el progreso antes de reintentar."); return; }
    const body = await response.json().catch(() => ({})) as ImportResponse & { error?: string };
    if (!response.ok) {
      setPhase("failed");
      setError(body.error ?? "No se pudo aplicar la importación CSV.");
      return;
    }
    setWatching(true);
    accept(body);
  }

  async function resume() {
    if (!importJobId) return;
    try {
      const response = await fetch(`/api/admin/catalog-import-jobs/${encodeURIComponent(importJobId)}/resume`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      if (!response.ok) throw new Error("No se pudo reanudar la importación.");
      const body = await response.json() as ImportResponse;
      setWatching(true);
      accept(body);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo reanudar."); }
  }

  async function searchCategories(offset = 0) {
    const request = ++categoryRequest.current;
    setCategoryLoading(true);
    setCategoryError(null);
    try {
      const result = await searchProductCategoriesAction(categoryQuery, offset, true);
      if (request !== categoryRequest.current) return;
      if (!result.ok) throw new Error(result.message ?? "No se pudieron cargar las categorías.");
      setCategoryOptions(result.options);
      setCategoryPage({ offset: result.offset ?? offset, limit: result.limit ?? 100, total: result.total ?? result.options.length });
    } catch (error) {
      if (request === categoryRequest.current) setCategoryError(error instanceof Error ? error.message : "No se pudieron cargar las categorías.");
    } finally { if (request === categoryRequest.current) setCategoryLoading(false); }
  }

  function newImport() {
    invalidateInfrastructure();
    setSelectedFile(null);
    setWatching(false);
    localStorage.removeItem(storageKey);
    setImportJobId(null);
    applyId.current = null;
    setPayload(null);
    setJobs([]);
    setFileName(null);
    setError(null);
    setPhase("idle");
    setMessage("Sin archivo.");
    if (fileInput.current) fileInput.current.value = "";
  }

  const busy = ["uploading", "preparing", "applying", "polling"].includes(phase);
  const categoryLocked = busy || !!importJobId;
  return (
    <section className="adminCard pricingBulkImportCard" onChangeCapture={invalidateInfrastructure}>
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
        <label className="adminField"><span>Canal de venta</span><input disabled={busy} value={commercialContext.channel} onChange={(event) => updateCommercialField("channel", event.currentTarget.value)} /></label>
        <label className="adminField"><span>Warehouse</span><input disabled={busy} value={commercialContext.warehouseId} onChange={(event) => updateCommercialField("warehouseId", event.currentTarget.value)} /></label>
        <label className="adminField"><span>Moneda</span><input disabled={busy} value={commercialContext.currency} onChange={(event) => updateCommercialField("currency", event.currentTarget.value.toUpperCase())} /></label>
        <label className="adminField"><span>País</span><input disabled={busy} value={commercialContext.country} onChange={(event) => updateCommercialField("country", event.currentTarget.value.toUpperCase())} /></label>
        <label className="adminField"><span><input checked={commercialContext.publish} disabled={busy} onChange={(event) => updateCommercialField("publish", event.currentTarget.checked)} type="checkbox" /> Publicar productos</span></label>
        <label className="adminField"><span><input checked={commercialContext.availableForSale} disabled={busy} onChange={(event) => updateCommercialField("availableForSale", event.currentTarget.checked)} type="checkbox" /> Disponibles para venta</span></label>
        <label className="adminField"><span><input checked={commercialContext.manageInventory} disabled={busy} onChange={(event) => updateCommercialField("manageInventory", event.currentTarget.checked)} type="checkbox" /> Gestionar inventario</span></label>
        <label className="adminField"><span><input checked={commercialContext.allowBackorder} disabled={busy} onChange={(event) => updateCommercialField("allowBackorder", event.currentTarget.checked)} type="checkbox" /> Permitir venta sin stock</span></label>
      </div>
      <fieldset className="adminFieldset" disabled={categoryLocked}>
        <legend>Categoría de los productos</legend>
        <div className="adminButtonRow" role="radiogroup" aria-label="Origen de la categoría">
          {([{ mode: "csv", label: "Usar categorías del CSV" }, { mode: "existing", label: "Categoría existente" }, { mode: "new", label: "Nueva categoría" }] as const).map(({ mode, label }) => (
            <label key={mode}>
              <input type="radio" name="importCategoryMode" value={mode} checked={categoryAssignment.mode === mode} onChange={() => {
                setCategoryError(null);
                ++categoryRequest.current;
                setCategoryLoading(false);
                setCategoryAssignment(mode === "existing" ? { mode, categoryId: "" } : mode === "new" ? { mode, name: "" } : { mode });
                if (mode === "existing") void searchCategories();
              }} /> {label}
            </label>
          ))}
        </div>
        {categoryAssignment.mode === "existing" ? <>
          <div className="adminButtonRow">
            <label className="adminField"><span>Buscar categoría</span><input type="search" maxLength={200} value={categoryQuery} onChange={event => setCategoryQuery(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void searchCategories(); } }} /></label>
            <button className="adminButton" type="button" aria-label="Buscar categorías" title="Buscar categorías" disabled={categoryLoading} onClick={() => void searchCategories()}><Search size={16} aria-hidden="true" /></button>
          </div>
          <label className="adminField"><span>Categoría de destino</span><select value={categoryAssignment.categoryId} disabled={categoryLoading || categoryLocked} onChange={event => { setCategoryAssignment({ mode: "existing", categoryId: event.currentTarget.value }); setCategoryError(null); }}>
            <option value="">Selecciona una categoría</option>
            {categoryAssignment.categoryId && !categoryOptions.some(option => option.id === categoryAssignment.categoryId) ? <option value={categoryAssignment.categoryId}>{categoryAssignment.categoryId}</option> : null}
            {categoryOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select></label>
          <div className="adminButtonRow" aria-label="Paginación de categorías">
            <button className="adminButton" type="button" title="Categorías anteriores" aria-label="Categorías anteriores" disabled={categoryLoading || categoryPage.offset === 0} onClick={() => void searchCategories(Math.max(0, categoryPage.offset - categoryPage.limit))}><ChevronLeft size={16} aria-hidden="true" /></button>
            <span>{categoryLoading ? "Cargando categorías..." : `${categoryPage.total === 0 ? 0 : categoryPage.offset + 1}-${Math.min(categoryPage.offset + categoryOptions.length, categoryPage.total)} de ${categoryPage.total}`}</span>
            <button className="adminButton" type="button" title="Categorías siguientes" aria-label="Categorías siguientes" disabled={categoryLoading || categoryPage.offset + categoryPage.limit >= categoryPage.total} onClick={() => void searchCategories(categoryPage.offset + categoryPage.limit)}><ChevronRight size={16} aria-hidden="true" /></button>
          </div>
        </> : null}
        {categoryAssignment.mode === "new" ? <label className="adminField"><span>Nombre de la nueva categoría</span><input maxLength={200} required value={categoryAssignment.name} onChange={event => { setCategoryAssignment({ mode: "new", name: event.currentTarget.value }); setCategoryError(null); }} /></label> : null}
        {categoryError ? <p role="alert">{categoryError}</p> : null}
      </fieldset>
      <div className="pricingBulkImportDropzone">
        <label className="adminField pricingBulkImportFileField"><span>CSV de productos</span><input ref={fileInput} accept=".csv,text/csv" disabled={busy || !!importJobId || categoryLoading} onChange={(event) => selectFile(event.currentTarget.files?.[0] ?? null)} type="file" /></label>
        {selectedFile && !importJobId && !busy ? <>
          <div className={`adminBanner ${currentCheck?.state === "ready" ? "adminBannerSuccess" : currentCheck?.state === "failed" ? "adminBannerError" : "adminBannerInfo"}`} role="status" aria-live="polite">
            <p>{currentCheck?.state === "checking" ? "Comprobando infraestructura…" :
              currentCheck?.state === "ready" ? "Sugerencia: sistema listo para la importación" :
              currentCheck?.state === "failed" ? currentCheck.message : "Es necesario comprobar la infraestructura con los datos seleccionados."}</p>
          </div>
          <div className="adminButtonRow">
            <button className="adminButton" type="button" disabled={currentCheck?.state === "checking" || categoryLoading} onClick={() => void checkInfrastructure()}><RefreshCw size={16} aria-hidden="true" /> Comprobar infraestructura</button>
            <button className="adminButton adminButtonPrimary" type="button" disabled={currentCheck?.state !== "ready" || categoryLoading} onClick={() => void upload()}><Upload size={16} aria-hidden="true" /> Iniciar importación</button>
          </div>
        </> : null}
        <div className="adminButtonRow">
          {!busy && importJobId && (!payload?.managed || phase === "completed") ? <button className="adminButton" onClick={newImport} type="button">Nueva importación</button> : null}
          {phase === "staged" && importJobId ? <button className="adminButton adminButtonPrimary" onClick={() => void apply()} type="button">Aplicar importación</button> : null}
          {watching ? <button className="adminButton" onClick={() => { setWatching(false); setMessage("Seguimiento detenido."); }} type="button">Detener seguimiento</button> : null}
          {!watching && importJobId && phase !== "staged" && phase !== "completed" ? <button className="adminButton" onClick={() => setWatching(true)} type="button">Consultar progreso</button> : null}
          {payload?.managed && ["paused", "failed"].includes(phase) ? <button className="adminButton" onClick={() => void resume()} type="button">Reanudar importación</button> : null}
          <a className="adminButton" download="catalog-import-template.csv" href="data:text/csv;charset=utf-8,Product%20ID;Active;Name;Categories;Price%20tax%20excluded;Quantity;Manufacturer;Reference%0A1001;1;Producto%20demo;Demo;12.99;5;Marca;SKU-1001%0A">Descargar plantilla</a>
        </div>
      </div>
      <div className="pricingBulkImportProgress" aria-live="polite">
        <div className="pricingBulkImportProgressHeader"><strong>{fileName ?? "Sin archivo"}</strong><span>{message}</span></div>
        <div className="pricingBulkImportProgressTrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
        <div className="pricingBulkImportMetrics"><span>Tenant: {context.organizationId || "-"} / {context.shopId || "-"}</span><span>Import job: {importJobId ?? "-"}</span><span>Owner jobs: {jobs.length}</span></div>
      </div>
      {importJobId && outcomes ? <div aria-label="Resultado por producto">
        <p aria-live="polite">{outcomes.counts.published} publicados de {outcomes.counts.received}. {outcomes.counts.draft} guardados sin publicar. {outcomes.counts.rejected} rechazados. {outcomes.counts.pending} pendientes.</p>
        {outcomes.unidentifiedRows > 0 ? <p role="alert">{outcomes.unidentifiedRows} filas no pudieron identificarse como productos.</p> : null}
        <div style={{ overflowX: "auto" }}><table className="adminTable">
          <thead><tr><th>Referencia de origen</th><th>Estado</th><th>Motivo</th></tr></thead>
          <tbody>{outcomes.items.map(item => <tr key={item.externalId}><td style={{ overflowWrap: "anywhere" }}>{item.externalId}</td><td>{{ PUBLISHED: "Publicado", DRAFT: "Sin publicar", REJECTED: "Rechazado", PENDING: "Pendiente" }[item.state]}</td><td style={{ overflowWrap: "anywhere" }}>{item.reasons.join(", ") || "-"}</td></tr>)}</tbody>
        </table></div>
        <div className="adminButtonRow">
          <button type="button" className="adminButton" title="Resultados anteriores" aria-label="Resultados anteriores" disabled={outcomeLoading || !outcomeCursors.length} onClick={() => void loadOutcomes(outcomeCursors.slice(0, -1))}><ChevronLeft size={16} aria-hidden="true" /></button>
          <span>{outcomeLoading ? "Cargando..." : `Página ${outcomeCursors.length + 1}`}</span>
          <button type="button" className="adminButton" title="Resultados siguientes" aria-label="Resultados siguientes" disabled={outcomeLoading || !outcomes.nextCursor} onClick={() => void loadOutcomes([...outcomeCursors, outcomes.nextCursor!])}><ChevronRight size={16} aria-hidden="true" /></button>
        </div>
        {outcomeError ? <p role="alert">{outcomeError}</p> : null}
      </div> : null}
      {payload?.errors?.length ? <div className="adminBanner adminBannerError">{payload.errors.map((entry) => <p key={`${entry.owner}-${entry.message}`}>{entry.owner}: {entry.message}</p>)}</div> : null}
    </section>
  );
}
