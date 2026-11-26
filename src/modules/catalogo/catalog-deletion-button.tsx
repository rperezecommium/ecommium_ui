"use client";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  advanceCatalogDeletion,
  confirmCatalogDeletion,
  loadCatalogDeletionReview,
  readCatalogDeletion,
} from "./catalog-deletion-actions";
import {
  catalogDeletionId,
  type CatalogDeletionOperation,
  type CatalogDeletionReview,
  type CatalogDeletionTarget,
} from "./catalog-deletion-contract";
type Pending = {
  operationId?: string;
  command?: {
    reviewId: string;
    version: string;
    confirmationRefId: string;
    idempotencyKey: string;
  };
};
const owners: Record<string, string> = {
  inventory: "Stock",
  pricing: "Precios",
  "routing-seo": "SEO y sitemap",
  media: "Imágenes",
  cms: "Contenido",
  search: "Búsqueda",
};
const labels: Record<string, string> = {
  sharedCatalogReferences: "Referencias de otros productos",
  retainedGalleryAssets: "Imágenes conservadas en la galería",
  stockLevels: "Registros de stock",
  onHand: "Unidades a retirar",
  activeReservations: "Reservas activas",
  prices: "Precios",
  offeringLinks: "Servicios asociados",
  sharedRules: "Reglas compartidas",
  collections: "Colecciones",
  assets: "Imágenes",
  routes: "Rutas",
  redirects: "Redirecciones",
  paths: "Direcciones afectadas",
  contentReferences: "Referencias en contenido",
  documents: "Documentos candidatos del buscador",
  activeImports: "Importaciones pendientes",
};
const blockers: Record<string, string> = {
  INVENTORY_RESERVATIONS_OR_QUARANTINE:
    "Hay reservas activas o unidades en cuarentena. Resuélvelas antes de eliminar.",
  PRICING_SHARED_RULE_REFERENCES_REQUIRE_REVIEW:
    "Hay reglas de precio compartidas que deben desvincularse primero.",
  CMS_SHARED_CONTENT_REFERENCES_REQUIRE_REVIEW:
    "Hay contenido que utiliza el producto o sus imágenes. Retira esas referencias antes de eliminar.",
  CATALOG_SHARED_MEDIA_REFERENCES_REQUIRE_REVIEW:
    "Otras variantes o productos utilizan estas imágenes. Desvincúlalas antes de eliminar el producto.",
  SEARCH_IMPORTS_IN_PROGRESS:
    "Hay importaciones de búsqueda en curso. Espera a que terminen.",
};
export function CatalogDeletionButton({
  target,
  name,
  disabled = false,
  disabledReason,
  onComplete,
  initialOperationId,
  iconOnly = false,
}: {
  iconOnly?: boolean;
  initialOperationId?: string;
  target: CatalogDeletionTarget;
  name: string;
  disabled?: boolean;
  disabledReason?: string;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false),
    [review, setReview] = useState<CatalogDeletionReview | null>(null),
    [operation, setOperation] = useState<CatalogDeletionOperation | null>(null),
    [pending, setPending] = useState<Pending | null>(null),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [checks, setChecks] = useState(0),
    [expired,setExpired]=useState(false);
  const key = `catalog-deletion:${target.organizationId}:${target.shopId}:${target.productId}:${target.variantId ?? "product"}`;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
    } else if (dialog.current?.open) dialog.current.close();
  }, [open]);
  function persist(p: Pending) {
    localStorage.setItem(key, JSON.stringify(p));
    setPending(p);
  }
  function finish(o: CatalogDeletionOperation) {
    setOperation(o);
    persist({ operationId: o.operationId });
    if (o.status === "ABORTED") {
      localStorage.removeItem(key);
      setPending(null);
      setError(
        "El impacto cambió o un servicio no estaba disponible. Se liberaron las barreras y no se eliminó el recurso. Revisa de nuevo antes de confirmar.",
      );
    }
    if (o.status === "COMPLETED") {
      localStorage.removeItem(key);
      setPending(null);
    }
  }
  async function show() {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpen(true);
    setError("");
    setBusy(true);
    setReview(null);
    setOperation(null);
    setConfirmation("");
    setChecks(0);
    setExpired(false);
    try {
      let stored: Pending | null = initialOperationId
        ? { operationId: initialOperationId }
        : null;
      try {
        stored =
          (JSON.parse(localStorage.getItem(key) ?? "null") as Pending | null) ??
          stored;
      } catch {
        stored = null;
      }
      setPending(stored);
      if (stored?.operationId && catalogDeletionId(stored.operationId)) {
        const r = await readCatalogDeletion(target, stored.operationId);
        if (r.ok) finish(r.operation);
        else setError(r.error);
      } else if (stored?.command) {
        setError(
          "Hay una confirmación enviada cuyo resultado debe recuperarse antes de iniciar otra.",
        );
      } else {
        const r = await loadCatalogDeletionReview(target);
        if (r.ok){setReview(r.review);setExpired(Date.parse(r.review.expiresAt)<=Date.now());}
        else setError(r.error);
      }
    } catch {
      setError(
        "No se pudo consultar la eliminación. No cierres una operación pendiente como si hubiera terminado.",
      );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function confirm(recover = false) {
    if (inFlight.current) return;
    const command = recover
      ? pending?.command
      : review
        ? {
            reviewId: review.reviewId,
            version: review.version,
            confirmationRefId: confirmation,
            idempotencyKey: crypto.randomUUID(),
          }
        : null;
    if (!command || (!recover && confirmation !== review?.refId)) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      persist({ command });
      const r = await confirmCatalogDeletion(target, command);
      if (r.ok) {
        finish(r.operation);
        if(r.operation.asynchronous){
          // Accepted is not completed. The durable worker owns all further progress.
          setOpen(false);localStorage.removeItem(key);
          if(onComplete)onComplete();else router.refresh();
        }
      }
      else {
        setError(r.error);
        if ("rejected" in r && r.rejected) {
          localStorage.removeItem(key);
          setPending(null);
        }
      }
    } catch {
      setError(
        "Resultado pendiente de confirmar. Recupera esta misma operación.",
      );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function advance() {
    if (!operation || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await advanceCatalogDeletion(target, operation.operationId);
      if (r.ok) {
        setChecks((c) => c + 1);
        finish(r.operation);
      } else setError(r.error);
    } catch {
      setError(
        "La operación sigue pendiente; reintenta para recuperar su estado.",
      );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function checkStatus(){
    if(!operation||inFlight.current)return;
    inFlight.current=true;
    try{const r=await readCatalogDeletion(target,operation.operationId);if(r.ok)finish(r.operation);else setError(r.error);}finally{inFlight.current=false;}
  }
  useEffect(() => {
    if (
      !open ||
      busy ||
      error ||
      !operation ||
      operation.status === "COMPLETED" ||
      operation.status === "ABORTED" ||
      operation.status === "BLOCKED" ||
      (!operation.asynchronous && (operation.status === "RETRYABLE" || checks >= 30))
    )
      return;
    const timer = setTimeout(
      () => void (operation.asynchronous?checkStatus():advance()),
      operation.asynchronous || operation.status === "AWAITING_PROJECTION" ? 1500 : 400,
    );
    return () => clearTimeout(timer);
  });
  function close() {
    if (inFlight.current) return;
    setOpen(false);
    if (operation?.status === "COMPLETED") {
      if (onComplete) onComplete();
      else router.refresh();
    } else setTimeout(() => trigger.current?.focus(), 0);
  }
  useEffect(()=>{if(!review)return;const timer=setTimeout(()=>setExpired(true),Math.max(0,Date.parse(review.expiresAt)-Date.now()));return()=>clearTimeout(timer);},[review]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={iconOnly ? "productFeatureTableAction productFeatureTableDelete" : "adminButton adminButtonDanger"}
        disabled={disabled || busy}
        title={disabledReason ?? (iconOnly ? `Eliminar ${name}` : undefined)}
        aria-label={`${initialOperationId ? "Consultar eliminación de" : "Eliminar"} ${name}`}
        onClick={() => void show()}
      >
        {iconOnly ? <Trash2 size={14} aria-hidden="true" /> : initialOperationId?"Ver estado":"Eliminar"}
      </button>
      {open
        ? createPortal(
            <dialog
              ref={dialog}
              className="catalogDeletionDialog"
              aria-labelledby={title}
              onCancel={(event) => {
                if (busy) event.preventDefault();
                else close();
              }}
              onClose={() => {
                if (open) close();
              }}
            >
              <h2 id={title}>
                Eliminar {target.variantId ? "variante" : "producto"} «{name}»
              </h2>
              <div aria-live="polite">
                {busy ? <p>Comprobando…</p> : null}
                {error ? <p role="alert">{error}</p> : null}
              </div>
              {review && !operation ? (
                <>
                  <p>
                    Esta acción no se puede deshacer. Se retirarán sus datos
                    operativos y se actualizarán las vistas públicas.
                  </p>
                  <p>
                    {target.variantId
                      ? "El producto padre y sus rutas se conservarán. Las imágenes que siguen en su galería también se conservan."
                      : "Incluye todas sus variantes, rutas SEO y entradas del sitemap."}{" "}
                    El historial de compras y los recursos compartidos se
                    conservan.
                  </p>
                  <dl>
                    {review.participants.map((p) => (
                      <div key={p.owner}>
                        <dt>
                          <strong>{owners[p.owner]}</strong>
                        </dt>
                        <dd>
                          {Object.entries(p.counts).map(([k, n]) => (
                            <span className="catalogDeletionCount" key={k}>
                              {labels[k] ?? k}: {n}
                            </span>
                          ))}
                          {p.blockers.map((b) => (
                            <p role="alert" key={b}>
                              {blockers[b] ??
                                "Hay dependencias pendientes de revisión."}
                            </p>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {review.canDelete ? (
                    <label>
                      Escribe <strong>{review.refId}</strong> para confirmar
                      <input
                        aria-label="Referencia para confirmar eliminación"
                        autoComplete="off"
                        value={confirmation}
                        disabled={busy}
                        onChange={(e) => setConfirmation(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                      />
                    </label>
                  ) : (
                    <p>
                      La eliminación está bloqueada hasta resolver estas
                      dependencias.
                    </p>
                  )}
                  {expired ? (
                    <p role="alert">
                      La revisión ha caducado. Consulta el impacto de nuevo.
                    </p>
                  ) : null}
                </>
              ) : null}
              {operation ? (
                <div role="status">
                  <p>
                    {operation.status === "PENDING"
                      ? "Eliminación solicitada. Se procesa en segundo plano."
                      : operation.status === "BLOCKED"
                      ? "La eliminación requiere revisión. El elemento sigue retirado y sus datos pendientes se conservan."
                      : operation.status === "ABORTED"
                      ? "Eliminación no iniciada; puedes revisar el impacto de nuevo."
                      : operation.status === "ABORTING"
                        ? "Liberando las barreras previas. El recurso se conserva."
                        : operation.status === "COMPLETED"
                          ? "Eliminación completada y actualización pública comprobada."
                          : operation.status === "AWAITING_PROJECTION"
                            ? "Datos retirados. Comprobando la actualización pública…"
                            : operation.status === "RETRYABLE"
                              ? "La eliminación está pendiente de completar. Reintenta para continuar desde el paso guardado."
                              : `Eliminación en curso: paso ${Math.min(operation.step + 1, 15)} de 15.`}
                  </p>
                  <small>Operación: {operation.operationId}</small>
                  <p>
                    Una eliminación iniciada no se cancela al cerrar esta
                    ventana.
                  </p>
                </div>
              ) : null}
              <div className="adminButtonRow">
                <button
                  className="adminButton"
                  type="button"
                  disabled={busy}
                  autoFocus
                  onClick={close}
                >
                  {operation &&
                  operation.status !== "COMPLETED" &&
                  operation.status !== "ABORTED"
                    ? "Continuar después"
                    : operation
                      ? "Cerrar"
                      : "Cancelar"}
                </button>
                {pending?.command && !operation ? (
                  <button
                    className="adminButton adminButtonPrimary"
                    type="button"
                    disabled={busy}
                    onClick={() => void confirm(true)}
                  >
                    Recuperar operación
                  </button>
                ) : null}
                {review && !operation && !pending?.command ? (
                  <button
                    className="adminButton adminButtonDanger"
                    type="button"
                    disabled={
                      busy ||
                      !review.canDelete ||
                      expired ||
                      confirmation !== review.refId
                    }
                    onClick={() => void confirm()}
                  >
                    Eliminar definitivamente
                  </button>
                ) : null}
                {operation &&
                operation.status !== "COMPLETED" &&
                operation.status !== "ABORTED" &&
                (error || operation.status === "BLOCKED" || operation.status === "RETRYABLE" || checks >= 30) ? (
                  <button
                    type="button"
                    className="adminButton adminButtonPrimary"
                    disabled={busy}
                    onClick={() => {
                      setChecks(0);
                      void advance();
                    }}
                  >
                    Reintentar actualización
                  </button>
                ) : null}
                {(!operation || operation.status === "ABORTED") &&
                !pending?.command &&
                !busy ? (
                  <button
                    type="button"
                    className="adminButton"
                    onClick={() => void show()}
                  >
                    Revisar de nuevo
                  </button>
                ) : null}
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
