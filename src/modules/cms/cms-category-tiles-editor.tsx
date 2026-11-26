"use client";
import {Plus,Trash2} from "lucide-react";
export function CmsCategoryTilesEditor({
  items,
  onChange,
}: {
  items: unknown[];
  onChange: (items: Record<string, unknown>[]) => void;
}) {
  const normalizedItems = items.slice(0, 6).map((item) => (
    typeof item === "object" && item !== null && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {}
  ));

  function updateItem(index: number, key: string, value: string) {
    onChange(normalizedItems.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  return (
    <fieldset className="cmsBlockFieldset cmsCategoryTilesEditor">
      <legend>Tarjetas de categoria</legend>
      <div className="cmsCategoryTilesEditorHeader">
        <span>{normalizedItems.length} de 6 tarjetas</span>
        <button
          className="adminButton"
          disabled={normalizedItems.length >= 6}
          onClick={() => onChange([...normalizedItems, { title: "Categoria", imageUrl: "", imageAlt: "", href: "/" }])}
          type="button"
        >
          <Plus aria-hidden="true" size={14} />
          Agregar tarjeta
        </button>
      </div>
      <div className="cmsCategoryTilesEditorList">
        {normalizedItems.map((item, index) => (
          <article className="cmsCategoryTilesEditorItem" key={index}>
            <header>
              <strong>{typeof item.title === "string" && item.title.trim() ? item.title : `Tarjeta ${index + 1}`}</strong>
              <button
                aria-label={`Eliminar tarjeta ${index + 1}`}
                className="adminIconButton adminIconButtonDanger"
                onClick={() => onChange(normalizedItems.filter((_, itemIndex) => itemIndex !== index))}
                type="button"
              >
                <Trash2 aria-hidden="true" size={14} />
              </button>
            </header>
            <label className="adminField">
              <span>Titulo</span>
              <input value={typeof item.title === "string" ? item.title : ""} onChange={(event) => updateItem(index, "title", event.target.value)} />
            </label>
            <label className="adminField">
              <span>Imagen URL</span>
              <input type="url" value={typeof item.imageUrl === "string" ? item.imageUrl : ""} onChange={(event) => updateItem(index, "imageUrl", event.target.value)} />
            </label>
            <label className="adminField">
              <span>Texto alternativo</span>
              <input value={typeof item.imageAlt === "string" ? item.imageAlt : ""} onChange={(event) => updateItem(index, "imageAlt", event.target.value)} />
            </label>
            <label className="adminField">
              <span>Categoria destino</span>
              <input type="url" value={typeof item.href === "string" ? item.href : ""} onChange={(event) => updateItem(index, "href", event.target.value)} />
            </label>
          </article>
        ))}
      </div>
    </fieldset>
  );
}

