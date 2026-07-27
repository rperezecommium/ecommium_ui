"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2 } from "lucide-react";
import type {
  CmsArea,
  CmsColumnSlot,
  CmsContainerMode,
  CmsLayout,
  CmsRegionCode,
  CmsResponsiveVisibility,
} from "./cms-admin";

type CmsLayoutAreaEditorClientProps = {
  initialLayout: CmsLayout;
  maxWidth: string;
  name?: string;
};

type RegionMeta = {
  code: CmsRegionCode;
  label: string;
  fallbackName: string;
};

const regions: RegionMeta[] = [
  { code: "header", label: "Header", fallbackName: "Header global" },
  { code: "main", label: "Main", fallbackName: "Contenido global" },
  { code: "footer", label: "Footer", fallbackName: "Footer global" },
];

const columnPresets = [
  { label: "100%", value: "100%" },
  { label: "70% / 30%", value: "70%, 30%" },
  { label: "30% / 70%", value: "30%, 70%" },
  { label: "25% / 50% / 25%", value: "25%, 50%, 25%" },
  { label: "33% / 34% / 33%", value: "33%, 34%, 33%" },
];

function uid(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

function visibilityDefaults(value?: Partial<CmsResponsiveVisibility>): CmsResponsiveVisibility {
  return {
    mobile: value?.mobile !== false,
    tablet: value?.tablet !== false,
    desktop: value?.desktop !== false,
  };
}

function normalizeColumns(value: string[] | undefined) {
  const columns = (value ?? ["100%"])
    .map((column) => column.trim())
    .filter(Boolean)
    .slice(0, 3);
  return columns.length ? columns : ["100%"];
}

function percentageFromWidth(width: string) {
  const parsed = Number(width.replace("%", "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

function columnSlots(columns: string[]): CmsColumnSlot[] {
  return columns.map((width, index) => ({
    columnIndex: index + 1,
    width,
    percentage: percentageFromWidth(width),
  }));
}

function columnsText(area: CmsArea) {
  return normalizeColumns(area.columns).join(", ");
}

function columnsFromText(value: string) {
  return normalizeColumns(value.split(","));
}

function columnPercentTotal(columns: string[]) {
  return normalizeColumns(columns).reduce((total, column) => total + percentageFromWidth(column), 0);
}

function areaValidationMessages(area: CmsArea) {
  const messages: string[] = [];
  const total = columnPercentTotal(area.columns);
  const visibility = visibilityDefaults(area.visibility);

  if (Math.abs(total - 100) > 0.5) {
    messages.push(`Las columnas suman ${total}%. Ajusta la distribucion a 100%.`);
  }

  if (!visibility.mobile && !visibility.tablet && !visibility.desktop) {
    messages.push("El area esta oculta en mobile, tablet y desktop.");
  }

  return messages;
}

function defaultArea(region: RegionMeta, maxWidth: string): CmsArea {
  const columns = ["100%"];
  return {
    areaId: `${region.code}-default`,
    name: region.fallbackName,
    containerMode: "container",
    maxWidth,
    columns,
    columnSlots: columnSlots(columns),
    columnGap: "24px",
    rowGap: "24px",
    spacing: {},
    visibility: visibilityDefaults(),
  };
}

function normalizeArea(area: CmsArea, region: RegionMeta, maxWidth: string, index: number): CmsArea {
  const columns = normalizeColumns(area.columns);
  const containerMode: CmsContainerMode = area.containerMode === "full-width" ? "full-width" : "container";
  return {
    ...area,
    areaId: area.areaId || `${region.code}-area-${index + 1}`,
    name: area.name || `${region.label} area ${index + 1}`,
    containerMode,
    maxWidth: containerMode === "container" ? area.maxWidth ?? maxWidth : null,
    columns,
    columnSlots: columnSlots(columns),
    columnGap: area.columnGap ?? "24px",
    rowGap: area.rowGap ?? "24px",
    spacing: area.spacing ?? {},
    visibility: visibilityDefaults(area.visibility),
  };
}

function normalizeLayout(layout: CmsLayout, maxWidth: string): CmsLayout {
  const next: CmsLayout = { regions: {} };

  for (const region of regions) {
    const areas = layout.regions[region.code]?.areas ?? [];
    next.regions[region.code] = {
      source: "global",
      areas: areas.length
        ? areas.map((area, index) => normalizeArea(area, region, maxWidth, index))
        : [defaultArea(region, maxWidth)],
    };
  }

  return next;
}

function updateAreaAt(layout: CmsLayout, region: CmsRegionCode, areaId: string, updater: (area: CmsArea) => CmsArea): CmsLayout {
  const currentRegion = layout.regions[region] ?? { source: "global" as const, areas: [] };
  return {
    regions: {
      ...layout.regions,
      [region]: {
        ...currentRegion,
        source: "global",
        areas: currentRegion.areas.map((area) => area.areaId === areaId ? updater(area) : area),
      },
    },
  };
}

function moveAreaInRegion(layout: CmsLayout, region: CmsRegionCode, areaId: string, direction: -1 | 1): CmsLayout {
  const currentRegion = layout.regions[region] ?? { source: "global" as const, areas: [] };
  const index = currentRegion.areas.findIndex((area) => area.areaId === areaId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= currentRegion.areas.length) {
    return layout;
  }
  const areas = [...currentRegion.areas];
  const [area] = areas.splice(index, 1);
  areas.splice(nextIndex, 0, area);
  return {
    regions: {
      ...layout.regions,
      [region]: { ...currentRegion, source: "global", areas },
    },
  };
}

export function CmsLayoutAreaEditorClient({ initialLayout, maxWidth, name = "layoutJson" }: CmsLayoutAreaEditorClientProps) {
  const [layout, setLayout] = useState<CmsLayout>(() => normalizeLayout(initialLayout, maxWidth));
  const serialized = useMemo(() => JSON.stringify(normalizeLayout(layout, maxWidth)), [layout, maxWidth]);

  function setArea(region: CmsRegionCode, areaId: string, updater: (area: CmsArea) => CmsArea) {
    setLayout((current) => normalizeLayout(updateAreaAt(current, region, areaId, updater), maxWidth));
  }

  function addArea(region: RegionMeta) {
    setLayout((current) => {
      const normalized = normalizeLayout(current, maxWidth);
      const currentRegion = normalized.regions[region.code] ?? { source: "global" as const, areas: [] };
      const nextArea = {
        ...defaultArea(region, maxWidth),
        areaId: uid(`${region.code}-area`),
        name: `${region.label} area ${currentRegion.areas.length + 1}`,
      };
      return {
        regions: {
          ...normalized.regions,
          [region.code]: {
            ...currentRegion,
            source: "global",
            areas: [...currentRegion.areas, nextArea],
          },
        },
      };
    });
  }

  function duplicateArea(region: CmsRegionCode, area: CmsArea) {
    setLayout((current) => {
      const currentRegion = current.regions[region] ?? { source: "global" as const, areas: [] };
      const copy = {
        ...area,
        areaId: uid(`${region}-area`),
        name: `${area.name ?? "Area"} copia`,
      };
      return normalizeLayout({
        regions: {
          ...current.regions,
          [region]: {
            ...currentRegion,
            source: "global",
            areas: [...currentRegion.areas, copy],
          },
        },
      }, maxWidth);
    });
  }

  function removeArea(region: CmsRegionCode, areaId: string) {
    setLayout((current) => {
      const currentRegion = current.regions[region] ?? { source: "global" as const, areas: [] };
      const areas = currentRegion.areas.filter((area) => area.areaId !== areaId);
      return normalizeLayout({
        regions: {
          ...current.regions,
          [region]: { ...currentRegion, source: "global", areas },
        },
      }, maxWidth);
    });
  }

  function moveArea(region: CmsRegionCode, areaId: string, direction: -1 | 1) {
    setLayout((current) => normalizeLayout(moveAreaInRegion(current, region, areaId, direction), maxWidth));
  }

  return (
    <div className="cmsAreaEditor">
      <input type="hidden" name={name} value={serialized} />
      {regions.map((region) => {
        const areas = layout.regions[region.code]?.areas ?? [];
        return (
          <section className="cmsAreaRegion" key={region.code} aria-label={`Region ${region.label}`}>
            <div className="cmsAreaRegionHeader">
              <div>
                <h3>{region.label}</h3>
                <p>{areas.length} areas disponibles para modulos.</p>
              </div>
              <button className="adminButton adminButtonSecondary" type="button" onClick={() => addArea(region)}>
                <Plus size={16} aria-hidden="true" />
                <span>Area</span>
              </button>
            </div>

            <div className="cmsAreaList">
              {areas.map((area, index) => (
                <article className="cmsAreaCard" key={area.areaId}>
                  <header className="cmsAreaCardHeader">
                    <div>
                      <strong>{index + 1}. {area.name || "Area"}</strong>
                      <span>{area.areaId} - {area.containerMode} - {area.columns.join(" / ")}</span>
                    </div>
                    <div className="adminButtonRow">
                      <button className="adminIconButton" type="button" onClick={() => moveArea(region.code, area.areaId, -1)} aria-label="Subir area">
                        <ArrowUp size={16} aria-hidden="true" />
                      </button>
                      <button className="adminIconButton" type="button" onClick={() => moveArea(region.code, area.areaId, 1)} aria-label="Bajar area">
                        <ArrowDown size={16} aria-hidden="true" />
                      </button>
                      <button className="adminIconButton" type="button" onClick={() => duplicateArea(region.code, area)} aria-label="Duplicar area">
                        <CopyPlus size={16} aria-hidden="true" />
                      </button>
                      <button className="adminIconButton adminIconButtonDanger" type="button" onClick={() => removeArea(region.code, area.areaId)} aria-label="Eliminar area">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </header>

                  <div className="cmsAreaFields">
                    <label className="adminField">
                      <span>Nombre</span>
                      <input
                        value={area.name ?? ""}
                        onChange={(event) => setArea(region.code, area.areaId, (current) => ({ ...current, name: event.target.value }))}
                      />
                    </label>
                    <label className="adminField">
                      <span>Ancho</span>
                      <select
                        value={area.containerMode}
                        onChange={(event) => setArea(region.code, area.areaId, (current) => {
                          const containerMode = event.target.value === "full-width" ? "full-width" : "container";
                          return { ...current, containerMode, maxWidth: containerMode === "container" ? maxWidth : null };
                        })}
                      >
                        <option value="container">Container</option>
                        <option value="full-width">Full width</option>
                      </select>
                    </label>
                    <label className="adminField">
                      <span>Preset columnas</span>
                      <select
                        value={columnPresets.some((preset) => preset.value === columnsText(area)) ? columnsText(area) : "custom"}
                        onChange={(event) => {
                          if (event.target.value === "custom") return;
                          const columns = columnsFromText(event.target.value);
                          setArea(region.code, area.areaId, (current) => ({ ...current, columns, columnSlots: columnSlots(columns) }));
                        }}
                      >
                        {columnPresets.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
                        <option value="custom">Personalizado</option>
                      </select>
                    </label>
                    <label className="adminField">
                      <span>Columnas (%)</span>
                      <input
                        value={columnsText(area)}
                        onChange={(event) => {
                          const columns = columnsFromText(event.target.value);
                          setArea(region.code, area.areaId, (current) => ({ ...current, columns, columnSlots: columnSlots(columns) }));
                        }}
                        placeholder="70%, 30%"
                      />
                    </label>
                    <label className="adminField">
                      <span>Gap columnas</span>
                      <input
                        value={area.columnGap ?? ""}
                        onChange={(event) => setArea(region.code, area.areaId, (current) => ({ ...current, columnGap: event.target.value }))}
                        placeholder="24px"
                      />
                    </label>
                    <label className="adminField">
                      <span>Gap filas</span>
                      <input
                        value={area.rowGap ?? ""}
                        onChange={(event) => setArea(region.code, area.areaId, (current) => ({ ...current, rowGap: event.target.value }))}
                        placeholder="24px"
                      />
                    </label>
                  </div>

                  <fieldset className="cmsAreaVisibility">
                    <legend>Visibilidad</legend>
                    {(["mobile", "tablet", "desktop"] as const).map((device) => (
                      <label className="adminCheckbox" key={device}>
                        <input
                          type="checkbox"
                          checked={area.visibility[device]}
                          onChange={(event) => setArea(region.code, area.areaId, (current) => ({
                            ...current,
                            visibility: { ...visibilityDefaults(current.visibility), [device]: event.target.checked },
                          }))}
                        />
                        <span>{device}</span>
                      </label>
                    ))}
                  </fieldset>

                  <div className="cmsSettingsColumnsPreview" aria-label={`Columnas actuales ${area.name ?? region.label}`}>
                    {area.columns.map((column, columnIndex) => (
                      <span key={`${area.areaId}-${columnIndex}`} style={{ flexBasis: column }}>
                        Col {columnIndex + 1} - {column}
                      </span>
                    ))}
                  </div>

                  {areaValidationMessages(area).length > 0 ? (
                    <div className="cmsEditorValidation cmsEditorValidationWarning" role="alert">
                      <strong>Revisar area</strong>
                      <ul>
                        {areaValidationMessages(area).map((message) => <li key={message}>{message}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <div className="cmsEditorValidation cmsEditorValidationOk" role="status">
                      <strong>Area valida</strong>
                      <span>Columnas al 100% y visibilidad activa.</span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
