"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { StorefrontSitePartView } from "../storefront/storefront-site-part";
import type { StorefrontSitePart } from "../storefront/storefront-cms-shell";
import type { StorefrontCategoryLink } from "../storefront/plp";
import { loadCmsPreviewNavigation } from "./cms-site-part-preview-actions";

const sizes = [{ label: "Desktop", width: 1440 }, { label: "Tablet", width: 768 }, { label: "Mobile", width: 390 }];
const frameDocument = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="cms-preview-root"></div></body></html>';

export function CmsSavedSitePartPreview({part,locale,country,currency}:{part:StorefrontSitePart;locale:string;country?:string;currency?:string}) {
  const [open,setOpen]=useState(false);
  return <><button type="button" className="adminButton" onClick={()=>setOpen(true)}>Ver contenido conservado</button>{open?<CmsSitePartPreview part={part} locale={locale} country={country} currency={currency} snapshotLabel="Revisión conservada · solo consulta · sin guardar ni publicar" onClose={()=>setOpen(false)}/>:null}</>;
}

/** A real browsing viewport: public media queries never depend on the Admin width. */
export function CmsSitePartPreview({ part, locale, country, currency, onClose, snapshotLabel }: { part: StorefrontSitePart; locale: string; country?: string; currency?: string; onClose: () => void; snapshotLabel?:string }) {
  const unavailable = part.revision.blocks.filter(block => block.type === "visual.module" && block.props.definitionId && !block.props.tree && !Array.isArray(block.props.panels));
  const renderedPart = unavailable.length ? { ...part, revision: { ...part.revision, blocks: part.revision.blocks.filter(block => !unavailable.includes(block)) } } : part;
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(1440);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [styleError, setStyleError] = useState(false);
  const [navigation, setNavigation] = useState<{ categories: StorefrontCategoryLink[]; message?: string }>({ categories: [], message: "Cargando navegación de la tienda…" });
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element.showModal(); close.current?.focus(); document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    let active = true;
    loadCmsPreviewNavigation(locale).then(result => { if (active) setNavigation(result); }).catch(() => { if (active) setNavigation({ categories: [], message: "No se pudo cargar la navegación. Los elementos del borrador siguen visibles." }); });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    if (!host) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    host.ownerDocument.addEventListener("keydown", handleKey);
    return () => host.ownerDocument.removeEventListener("keydown", handleKey);
  }, [host, onClose]);

  async function prepareFrame() {
    const doc = iframe.current?.contentDocument;
    if (!doc) return;
    setReady(false); setStyleError(false);
    doc.head.querySelectorAll("[data-cms-preview-style]").forEach(node => node.remove());
    doc.documentElement.lang = locale;
    doc.title = `Preview · ${part.name}`;
    const pending: Promise<boolean>[] = [];
    // Copy the actual loaded public styles, including development style tags.
    const sources = document.head.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style');
    if (!sources.length) { setStyleError(true); return; }
    for (const source of sources) {
      const node = source.cloneNode(true) as HTMLLinkElement | HTMLStyleElement;
      node.setAttribute("data-cms-preview-style", "");
      if (source instanceof HTMLLinkElement && node instanceof HTMLLinkElement) {
        node.href = source.href;
        pending.push(new Promise(resolve => { node.onload = () => resolve(true); node.onerror = () => resolve(false); }));
      }
      doc.head.append(node);
    }
    setHost(doc.getElementById("cms-preview-root"));
    const loaded = await Promise.all(pending);
    if (loaded.includes(false)) { if (doc === iframe.current?.contentDocument) setStyleError(true); return; }
    await doc.fonts.ready;
    if (doc === iframe.current?.contentDocument) setReady(true);
  }

  return <dialog ref={dialog} className="cmsSitePartPreviewDialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="cmsSitePartPreviewToolbar">
      <div><h2 id={titleId}>Preview · {part.name}</h2><p>{snapshotLabel??'Borrador actual · actualización inmediata · sin guardar ni publicar'}</p></div>
      <button ref={close} className="adminIconButton" type="button" aria-label="Cerrar preview" onClick={onClose}><X size={18} /></button>
    </header>
    <div className="cmsSitePartPreviewToolbar">
      <div className="adminButtonRow" role="group" aria-label="Ancho del preview">{sizes.map(size => <button className={width === size.width ? "adminTab adminTabActive" : "adminTab"} aria-pressed={width === size.width} key={size.label} type="button" onClick={() => setWidth(size.width)}>{size.label}</button>)}</div>
      <label className="adminField"><span>Ancho real (px)</span><input type="number" min={320} max={2560} value={width} onChange={event => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) setWidth(Math.max(320, Math.min(2560, next))); }} /></label>
    </div>
    <p className="cmsSitePartPreviewNotice" role="status">{navigation.message ?? "Navegación de la tienda cargada."} Cuenta y carrito se muestran como visitante, con carrito vacío. Las acciones comerciales están deshabilitadas.</p>
    {unavailable.length ? <p className="adminBanner adminBannerWarning" role="alert">Preview incompleto: {unavailable.length} módulos compartidos no están disponibles en este editor y no se muestran. Recarga su definición antes de validar el resultado.</p> : null}
    <div className="cmsSitePartPreviewScroll" role="region" aria-label="Resultado del preview, desplazable" tabIndex={0} aria-busy={!ready && !styleError}>
      {styleError ? <p role="alert">No se pudieron cargar todos los estilos. <button className="adminButton" type="button" onClick={() => void prepareFrame()}>Reintentar</button></p> : !ready ? <p role="status">Preparando estilos de la tienda…</p> : null}
      <iframe ref={iframe} title={`Resultado ${part.kind === "HEADER" ? "header" : "footer"}`} sandbox="allow-same-origin" srcDoc={frameDocument} onLoad={() => void prepareFrame()} style={{ width, visibility: ready ? "visible" : "hidden" }} />
    </div>
    {host ? createPortal(<div onClickCapture={event => { if ((event.target as Element).closest("a, button")) event.preventDefault(); }} onSubmitCapture={event => event.preventDefault()}>
      <StorefrontSitePartView preview part={renderedPart} categories={navigation.categories} locale={locale} country={country} currency={currency} />
    </div>, host) : null}
  </dialog>;
}
