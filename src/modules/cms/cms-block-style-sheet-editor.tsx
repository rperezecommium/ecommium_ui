"use client";
import { useRef, useState } from "react";
import postcss from "postcss";
import { visualStylePropertyRegistry, isVisualStyleValueSafe, visualStyleScopes, visualStyleScopeLabels } from "./cms-visual-editor";
import type { CmsScopedStyleSheet } from "./cms-blocks";
import { cmsStyleSelectorSafe } from "./cms-blocks";
import type { CmsSectionAreaReference } from "./cms-section-area-reference";

type Scope = keyof CmsScopedStyleSheet;
const scopes = visualStyleScopes;
export function parseCmsBlockCss(source: string): NonNullable<CmsScopedStyleSheet["base"]> {
  if (source.length > 32768) throw new Error("El CSS supera 32 KB por dispositivo.");
  const root = postcss.parse(source), rules: NonNullable<CmsScopedStyleSheet["base"]> = [];
  root.each(node => {
    if (node.type === "comment") return;
    if (node.type !== "rule") throw new Error("Escribe reglas CSS con selector. Usa las pestañas para separar dispositivos.");
    const styles: Record<string, string> = {};
    node.each(declaration => {
      if (declaration.type === "comment") return;
      if (declaration.type !== "decl") throw new Error("No se admiten reglas anidadas.");
      const property = declaration.prop === "background" ? "background-color" : declaration.prop;
      const definition = visualStylePropertyRegistry.find(field => field.cssProperty === property);
      if (!definition) throw new Error(`Propiedad no admitida por el Builder: ${declaration.prop}.`);
      if (!declaration.value.trim() || !isVisualStyleValueSafe(definition.key, declaration.value) || /[<>\\\x00-\x1f]/.test(declaration.value)) throw new Error(`Valor no válido para ${declaration.prop}.`);
      if (typeof CSS !== "undefined" && !CSS.supports(property, declaration.value)) throw new Error(`El navegador no reconoce el valor de ${declaration.prop}. Los colores no llevan comillas.`);
      styles[definition.key] = declaration.value.trim();
    });
    for (const selector of node.selectors) {
      if (!cmsStyleSelectorSafe(selector) || (typeof CSS !== "undefined" && !CSS.supports(`selector(${selector})`))) throw new Error(`Selector no admitido dentro del bloque: ${selector}.`);
      rules.push({ selector, styles: { ...styles } });
    }
  });
  if (rules.length > 128) throw new Error("Máximo 128 reglas por dispositivo.");
  return rules;
}
function toCss(rules: CmsScopedStyleSheet["base"]) {
  return (rules ?? []).map(rule => `${rule.selector} {\n${Object.entries(rule.styles).map(([key, value]) => `  ${visualStylePropertyRegistry.find(field => field.key === key)?.cssProperty ?? key}: ${value};`).join("\n")}\n}`).join("\n\n");
}
export function CmsBlockStyleSheetEditor({ value = {}, onChange, resource = "bloque", selection }: { selection?: CmsSectionAreaReference; value?: CmsScopedStyleSheet; onChange: (value: CmsScopedStyleSheet) => void; resource?: "bloque" | "página" | "sección" }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [copyMessage, setCopyMessage] = useState<{selector:string;message:string}|null>(null);
  const [scope, setScope] = useState<Scope>("base");
  const canonical = toCss(value[scope]);
  const [pending, setPending] = useState<{ scope: Scope; source: string; error: string | null; canonical: string } | null>(null);
  const current = pending?.scope === scope && pending.canonical === canonical ? pending : null;
  const isSection = resource === "sección";
  function insertAreaRule() {
    if (!selection || current?.error || !cmsStyleSelectorSafe(selection.selector)) return;
    const source = current?.source ?? canonical;
    const existing = (value[scope] ?? []).some(rule=>rule.selector===selection.selector);
    if (!existing) setPending({scope,canonical,source:`${source}${source.trim()?"\n\n":""}${selection.selector} {\n  \n}`,error:"Completa la regla del área seleccionada con una propiedad CSS."});
    textarea.current?.focus();
  }
  return <section className="pricingPanel cmsBlockStyleSheetEditor" aria-label="Estilos del bloque completo">
    <div className="pricingPanelHeader"><div><h2>{resource === "página" ? "Estilos de la página" : isSection ? "CSS de la sección" : "Estilos del bloque completo"}</h2><p>{resource === "página" ? ":scope selecciona la composición. Los selectores solo afectan a sus envolturas de sección." : isSection ? ":scope selecciona la sección completa. Usa la referencia del área seleccionada para afectar solo a su contenedor o envoltura." : "Una sola hoja para esta pieza. :scope selecciona la cabecera completa; los demás selectores solo afectan a su interior."}</p></div></div>
    <div className="adminButtonRow" role="group" aria-label="Dispositivo de la hoja de estilos">{scopes.map(item => <button key={item} disabled={!!current?.error && scope !== item} className={scope === item ? "adminTab adminTabActive" : "adminTab"} type="button" aria-pressed={scope === item} onClick={() => setScope(item)}>{visualStyleScopeLabels[item]}</button>)}</div>
    <p hidden={resource !== "bloque"}>Ejemplos de selectores: <code>a</code>, <code>button</code>, <code>.storefrontLogo</code>, <code>.storefrontCartStatus</code> y <code>{'[data-cms-area="checkout-main"]'}</code>.</p>
    {isSection && selection ? <div className="cmsSectionSelectorReference">
      <p><strong>{selection.label}</strong>{selection.kind === "module" ? " · Envoltura del módulo; su diseño interno se conserva." : " · Contenedor de la sección."}</p>
      <code aria-label="Selector del área seleccionada">{selection.selector}</code>
      <div className="adminButtonRow">
        <button className="adminButton" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(selection.selector);setCopyMessage({selector:selection.selector,message:"Selector copiado."});}catch{setCopyMessage({selector:selection.selector,message:"No se pudo copiar. Puedes seleccionar la referencia y copiarla manualmente."});}}}>Copiar selector</button>
        <button className="adminButton" type="button" disabled={!!current?.error} onClick={insertAreaRule}>Insertar regla para esta área</button>
      </div>
      {copyMessage?.selector === selection.selector ? <p role="status">{copyMessage.message}</p> : null}
    </div> : null}
    <label className="adminField"><span>CSS del bloque · {scope}</span><textarea ref={textarea} rows={14} spellCheck={false} value={current?.source ?? canonical} aria-invalid={!!current?.error} data-cms-editor-error={current?.error ? "true" : undefined} onChange={event => {
      const source = event.target.value;
      try { const rules = parseCmsBlockCss(source); const next = { ...value, [scope]: rules }; if (JSON.stringify(next).length > 131072) throw new Error("La hoja completa supera 128 KB."); onChange(next); setPending({ scope, source, canonical: toCss(rules), error: null }); }
      catch (error) { setPending({ scope, source, canonical, error: error instanceof Error ? error.message : "CSS no válido." }); }
    }} placeholder={isSection ? ':scope { padding: 16px; }' : ':scope { background: white; }\na { color: red; }\na:hover { color: blue; }'} /></label>
    {current?.error ? <p role="alert">{current.error} No se guardará ni publicará hasta corregirlo.</p> : <p role="status">CSS aplicado al borrador y al Preview. Base se hereda; cada pestaña guarda sus ajustes.</p>}
  </section>;
}
