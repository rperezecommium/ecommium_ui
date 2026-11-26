"use client";

import { useState } from "react";
import { cmsIconCatalog, findCmsIcon } from "../../../packages/cms-blocks/src/icons";

export function CmsIconPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const selected = findCmsIcon(value);
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const icons = cmsIconCatalog.filter(icon => normalize(`${icon.label} ${icon.value}`).includes(normalize(query.trim())));
  return <div className="adminField cmsJsonField">
    <span>Icono · Lucide</span>
    <label className="adminField"><span>Buscar iconos</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Carrito, envío, corazón…" /></label>
    <small role="status">{selected ? `Seleccionado: ${selected.label}` : "Selecciona un icono o conserva tu símbolo personalizado."}</small>
    <div className="cmsIconPickerGrid" role="group" aria-label="Iconos disponibles">
      {icons.map(({ value: iconValue, label, Icon }) => <button key={iconValue} className={`adminButton${value === iconValue ? " adminButtonPrimary" : ""}`} type="button" aria-label={label} aria-pressed={value === iconValue} title={label} onClick={() => onChange(iconValue)}><Icon size={22} aria-hidden="true" /><span>{label}</span></button>)}
    </div>
    {!icons.length ? <small>No hay iconos para esa búsqueda.</small> : null}
    <label className="adminField"><span>Símbolo personalizado (opcional)</span><input value={selected ? "" : value} onChange={event => onChange(event.target.value)} placeholder="★, ✓…" /></label>
  </div>;
}
