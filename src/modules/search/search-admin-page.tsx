import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminContext } from "../../shared/config/admin-context";
import { searchGcsBucket } from "../../shared/config/env";
import {
  associateSearchControlAction,
  createSearchControlAction,
  createSearchGcsImportJobAction,
  createSearchImportJobAction,
  deleteSearchControlAction,
  deleteSearchNdjsonAction,
  generateSearchNdjsonAction,
  previewSearchIndexAction,
  removeSearchControlAssociationAction,
  updateSearchControlAction,
} from "./search-admin-actions";
import type { SearchAdminData, SearchAdminFilters, SearchAdminRecord, SearchAdminResult, SearchAdminTab } from "./search-admin";

type SearchAdminPageProps = {
  context: AdminContext;
  data: SearchAdminData;
  filters: SearchAdminFilters;
};

const resultColumns = [
  "rank",
  "name",
  "productId",
  "slug",
  "brand",
  "category",
  "price",
  "available",
];

const searchTabs: Array<{ id: SearchAdminTab; label: string }> = [
  { id: "lab", label: "Lab" },
  { id: "controls", label: "Controls" },
  { id: "index", label: "Index" },
  { id: "feed", label: "Feed" },
];

const indexExample = JSON.stringify({
  validateOnly: true,
  reconciliationMode: "INCREMENTAL",
  products: [
    {
      id: "demo-product-1",
      title: "Pastillas de freno demo",
      categories: ["Bike Brakes"],
      brands: ["Northline Components"],
      priceInfo: {
        currencyCode: "EUR",
        price: 9.56,
      },
    },
  ],
}, null, 2);

const productsExample = JSON.stringify([
  {
    id: "demo-product-1",
    title: "Pastillas de freno demo",
    uri: "https://example.com/pdp/pastillas-demo",
    categories: ["Bike Brakes"],
    brands: ["Northline Components"],
    priceInfo: {
      currencyCode: "EUR",
      price: 9.56,
    },
  },
], null, 2);

const advancedControlExample = JSON.stringify({
  control: {
    displayName: "liquido aceite lubricante",
    solutionTypes: ["SOLUTION_TYPE_SEARCH"],
    rule: {
      condition: {},
      twowaySynonymsAction: {
        synonyms: ["liquido", "aceite", "lubricante"],
      },
    },
  },
}, null, 2);

function displayValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || typeof value === "undefined") {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.length ? `array(${value.length})` : "-";
  }
  return "object";
}

function nestedRecord(value: unknown): SearchAdminRecord {
  return typeof value === "object" && value !== null ? value as SearchAdminRecord : {};
}

function pick(record: SearchAdminRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== "undefined" && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function money(record: SearchAdminRecord) {
  const price = nestedRecord(record.price);
  const amount = pick(price, ["currentAmountMinor", "grossAmountMinor", "amountMinor", "valueMinor"]);
  const currency = displayValue(pick(price, ["currency"]) ?? record.currency ?? "EUR");

  if (typeof amount !== "number") {
    return displayValue(pick(record, ["priceLabel", "price"]));
  }

  return `${(amount / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function productCell(record: SearchAdminRecord, column: string, index: number) {
  const brand = nestedRecord(record.brand);
  const category = nestedRecord(record.category);

  const values: Record<string, unknown> = {
    rank: pick(record, ["searchRank", "rank"]) ?? index + 1,
    name: pick(record, ["name", "title", "displayName"]),
    productId: pick(record, ["productId", "id"]),
    slug: pick(record, ["slug", "canonicalSlug"]),
    brand: pick(brand, ["name", "label"]) ?? pick(record, ["brandName", "brand"]),
    category: pick(category, ["name", "label", "slug"]) ?? pick(record, ["categoryName", "categorySlug"]),
    price: money(record),
    available: pick(record, ["available", "isAvailable", "stockLabel"]),
  };

  return displayValue(values[column]);
}

function valueAtPath(source: SearchAdminRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    return (current as SearchAdminRecord)[key];
  }, source);
}

function firstValue(record: SearchAdminRecord, paths: string[]) {
  for (const path of paths) {
    const value = valueAtPath(record, path);
    if (typeof value !== "undefined" && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function arrayDisplay(value: unknown) {
  if (!Array.isArray(value)) {
    return displayValue(value);
  }

  return value.length ? value.map(displayValue).join(", ") : "-";
}

function summarizeJson(value: unknown) {
  if (typeof value === "undefined" || value === null) {
    return "-";
  }

  const text = JSON.stringify(value);
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function controlNameOf(control: SearchAdminRecord, index: number) {
  return displayValue(firstValue(control, ["name", "controlName", "controlId", "id"]) ?? index + 1);
}

function shortControlIdOf(control: SearchAdminRecord, index: number) {
  const name = controlNameOf(control, index);
  const parts = name.split("/");
  return parts[parts.length - 1] || name;
}

function controlDisplayNameOf(control: SearchAdminRecord) {
  return displayValue(firstValue(control, ["displayName", "display_name", "title", "name"]));
}

function controlActionTypeOf(control: SearchAdminRecord) {
  const actionTypes = [
    "twowaySynonymsAction",
    "onewaySynonymsAction",
    "synonymsAction",
    "redirectAction",
    "filterAction",
    "boostAction",
    "buryAction",
  ];

  return actionTypes.find((actionType) => (
    typeof firstValue(control, [`rule.${actionType}`, actionType]) !== "undefined"
  )) ?? "-";
}

function controlSynonymsOf(control: SearchAdminRecord) {
  return arrayDisplay(firstValue(control, [
    "rule.twowaySynonymsAction.synonyms",
    "twowaySynonymsAction.synonyms",
    "rule.onewaySynonymsAction.synonyms",
    "onewaySynonymsAction.synonyms",
    "rule.synonymsAction.synonyms",
    "synonymsAction.synonyms",
  ]));
}

function servingConfigNameOf(config: SearchAdminRecord, index: number) {
  return displayValue(firstValue(config, ["name", "servingConfigName", "servingConfigId", "id"]) ?? index + 1);
}

function servingConfigDisplayNameOf(config: SearchAdminRecord) {
  return displayValue(firstValue(config, ["displayName", "display_name", "title", "name"]));
}

function servingConfigControlsOf(config: SearchAdminRecord) {
  return summarizeJson(firstValue(config, ["controls", "controlIds", "control_ids", "facetSpecIds", "facet_spec_ids"]));
}

function servingConfigControlRefs(config: SearchAdminRecord) {
  const refs = firstValue(config, ["controls", "controlIds", "control_ids"]);
  if (!Array.isArray(refs)) {
    return [];
  }

  return refs.map(displayValue).filter((entry) => entry !== "-");
}

function associatedServingConfigsOf(control: SearchAdminRecord, index: number, configs: SearchAdminRecord[]) {
  const fullName = controlNameOf(control, index);
  const shortId = shortControlIdOf(control, index);
  const associated = configs
    .filter((config) => servingConfigControlRefs(config).some((ref) => (
      ref === fullName || ref === shortId || ref.endsWith(`/${shortId}`)
    )))
    .map(servingConfigNameOf);

  return associated.join(", ") || "-";
}

function tabHref(tab: SearchAdminTab) {
  return tab === "lab" ? "/admin/catalogo/search" : `/admin/catalogo/search?tab=${tab}`;
}

function searchHref(filters: SearchAdminFilters, next: Partial<SearchAdminFilters>) {
  const params = new URLSearchParams();
  const merged = { ...filters, ...next };
  const entries: Array<[keyof SearchAdminFilters, string | undefined]> = [
    ["tab", merged.tab],
    ["drawer", merged.drawer],
    ["controlId", merged.controlId],
    ["query", merged.query],
    ["pageCategory", merged.pageCategory],
    ["limit", merged.limit],
    ["offset", merged.offset],
    ["currency", merged.currency],
    ["country", merged.country],
    ["tradePolicy", merged.tradePolicy],
    ["channel", merged.channel],
    ["customerGroup", merged.customerGroup],
    ["priceTableId", merged.priceTableId],
    ["warehouseId", merged.warehouseId],
    ["at", merged.at],
    ["sort", merged.sort],
    ["preview", merged.preview],
  ];

  for (const [key, value] of entries) {
    if (value) {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  return queryString ? `/admin/catalogo/search?${queryString}` : "/admin/catalogo/search";
}

function drawerCloseHref(filters: SearchAdminFilters) {
  return searchHref(filters, { drawer: undefined, controlId: undefined });
}

function SearchDrawer({
  title,
  description,
  closeHref,
  children,
}: {
  title: string;
  description: string;
  closeHref: string;
  children: ReactNode;
}) {
  return (
    <div className="adminDrawerBackdrop">
      <aside className="adminSideDrawer searchSideDrawer" aria-label={title}>
        <div className="adminSideDrawerHeader">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
        </div>
        {children}
      </aside>
    </div>
  );
}

function ResultStatus<T>({ result }: { result: SearchAdminResult<T> }) {
  if (result.source === "bff") {
    return <span className="adminBadge adminBadgeOk">BFF conectado</span>;
  }

  return <span className="adminBadge adminBadgeWarn">{result.message}</span>;
}

function HealthPanel({ data }: { data: SearchAdminData["health"] }) {
  const record = data.data;
  const rows = Object.entries(record).slice(0, 12);

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Health</h2>
          <p>Estado del servicio Search para el tenant activo.</p>
        </div>
        <ResultStatus result={data} />
      </div>
      {rows.length ? (
        <dl className="pricingDefinitionGrid">
          {rows.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{displayValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="adminBanner adminBannerInfo">
          <p>{data.message ?? "Sin datos de health disponibles."}</p>
        </div>
      )}
    </section>
  );
}

function PreviewForm({ context, filters }: { context: AdminContext; filters: SearchAdminFilters }) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Query preview</h2>
          <p>Ejecuta busquedas como Admin y valida los productos hidratados que devuelve el BFF.</p>
        </div>
      </div>
      <form className="pricingDenseForm" method="get" action="/admin/catalogo/search">
        <input type="hidden" name="preview" value="1" />
        <label className="adminField">
          <span>Busqueda</span>
          <input name="query" defaultValue={filters.query ?? ""} placeholder="pastillas freno" />
        </label>
        <label className="adminField">
          <span>Page category</span>
          <input name="pageCategory" defaultValue={filters.pageCategory ?? ""} placeholder="bike-brakes" />
        </label>
        <label className="adminField">
          <span>Limit</span>
          <input name="limit" defaultValue={filters.limit ?? "12"} inputMode="numeric" />
        </label>
        <label className="adminField">
          <span>Offset</span>
          <input name="offset" defaultValue={filters.offset ?? "0"} inputMode="numeric" />
        </label>
        <label className="adminField">
          <span>Currency</span>
          <input name="currency" defaultValue={filters.currency ?? context.currency} />
        </label>
        <label className="adminField">
          <span>Country</span>
          <input name="country" defaultValue={filters.country ?? context.country} />
        </label>
        <label className="adminField">
          <span>Channel</span>
          <input name="channel" defaultValue={filters.channel ?? context.channel} />
        </label>
        <label className="adminField">
          <span>Trade policy</span>
          <input name="tradePolicy" defaultValue={filters.tradePolicy ?? ""} />
        </label>
        <label className="adminField">
          <span>Customer group</span>
          <input name="customerGroup" defaultValue={filters.customerGroup ?? ""} />
        </label>
        <label className="adminField">
          <span>Price table</span>
          <input name="priceTableId" defaultValue={filters.priceTableId ?? ""} />
        </label>
        <label className="adminField">
          <span>Warehouse</span>
          <input name="warehouseId" defaultValue={filters.warehouseId ?? ""} />
        </label>
        <label className="adminField">
          <span>Sort</span>
          <input name="sort" defaultValue={filters.sort ?? ""} placeholder="price desc" />
        </label>
        <label className="adminField">
          <span>Filtros JSON</span>
          <textarea name="filtersJson" defaultValue={filters.filtersJson ?? ""} placeholder={'[{"field":"brand","value":"Northline"}]'} rows={3} />
        </label>
        <button className="adminButton adminButtonPrimary" type="submit">Ejecutar preview</button>
      </form>
    </section>
  );
}

function PreviewResults({ data }: { data: SearchAdminData["preview"] }) {
  const preview = data.data;
  const products = preview?.products ?? [];

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Resultados</h2>
          <p>Total: {preview?.searchTotal ?? preview?.total ?? products.length} / Provider: {preview?.provider ?? "-"}</p>
        </div>
        <ResultStatus result={data} />
      </div>
      {preview?.attributionToken ? (
        <div className="adminContextHint">Attribution token: {preview.attributionToken}</div>
      ) : null}
      {products.length ? (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable searchPreviewTable">
            <thead>
              <tr>
                {resultColumns.map((column) => <th key={column}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr key={String(pick(product, ["productId", "id", "slug"]) ?? index)}>
                  {resultColumns.map((column) => (
                    <td key={column}>{productCell(product, column, index)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adminBanner adminBannerInfo">
          <p>{data.message ?? "No hay resultados para esta busqueda."}</p>
        </div>
      )}
    </section>
  );
}

function ControlsTable({ data, servingConfigs, filters }: {
  data: SearchAdminData["controls"];
  servingConfigs: SearchAdminRecord[];
  filters: SearchAdminFilters;
}) {
  const controls = data.data;

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Controls</h2>
          <p>Sinónimos, redirects y reglas de relevancia expuestas por Search.</p>
        </div>
        <ResultStatus result={data} />
      </div>
      {controls.length ? (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable searchPreviewTable">
            <thead>
              <tr>
                <th>name</th>
                <th>displayName</th>
                <th>solutionTypes</th>
                <th>accion</th>
                <th>synonyms</th>
                <th>asociado</th>
                <th>acciones</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((control, index) => {
                const controlId = shortControlIdOf(control, index);
                return (
                  <tr key={controlNameOf(control, index)}>
                    <td>{controlNameOf(control, index)}</td>
                    <td>{controlDisplayNameOf(control)}</td>
                    <td>{arrayDisplay(firstValue(control, ["solutionTypes", "solution_types"]))}</td>
                    <td>{controlActionTypeOf(control)}</td>
                    <td>{controlSynonymsOf(control)}</td>
                    <td>{associatedServingConfigsOf(control, index, servingConfigs)}</td>
                    <td>
                      <div className="adminInlineActions">
                        <Link className="adminButton adminButtonTiny" href={searchHref(filters, { tab: "controls", drawer: "control-edit", controlId })}>Editar</Link>
                        <Link className="adminButton adminButtonTiny" href={searchHref(filters, { tab: "controls", drawer: "control-associate", controlId })}>Asociar</Link>
                        <form action={deleteSearchControlAction}>
                          <input type="hidden" name="controlId" value={controlId} />
                          <button className="adminButton adminButtonDanger adminButtonTiny" type="submit">Borrar</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adminBanner adminBannerInfo">
          <p>{data.message ?? "Sin controls."}</p>
        </div>
      )}
    </section>
  );
}

function ServingConfigsTable({ data }: { data: SearchAdminData["servingConfigs"] }) {
  const configs = data.data;

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <div>
          <h2>Serving configs</h2>
          <p>Configuraciones donde se asocian controls para ejecutar reglas de búsqueda.</p>
        </div>
        <ResultStatus result={data} />
      </div>
      {configs.length ? (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable searchPreviewTable">
            <thead>
              <tr>
                <th>name</th>
                <th>displayName</th>
                <th>controls/facetSpecIds</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config, index) => (
                <tr key={servingConfigNameOf(config, index)}>
                  <td>{servingConfigNameOf(config, index)}</td>
                  <td>{servingConfigDisplayNameOf(config)}</td>
                  <td>{servingConfigControlsOf(config)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="adminBanner adminBannerInfo">
          <p>{data.message ?? "Sin serving configs."}</p>
        </div>
      )}
    </section>
  );
}

function selectedControl(filters: SearchAdminFilters, controls: SearchAdminRecord[]) {
  if (!filters.controlId) return undefined;
  return controls.find((control, index) => shortControlIdOf(control, index) === filters.controlId);
}

function ControlDrawer({ data, filters }: { data: SearchAdminData; filters: SearchAdminFilters }) {
  const closeHref = drawerCloseHref(filters);
  const control = selectedControl(filters, data.controls.data);
  const controlId = filters.controlId ?? "";

  if (filters.drawer === "control-create") {
    return (
      <SearchDrawer closeHref={closeHref} description="Crea sinónimos de forma guiada o pega payload Vertex si necesitas una regla avanzada." title="Crear control">
        <form className="pricingDenseForm" action={createSearchControlAction}>
          <label className="adminField">
            <span>Modo</span>
            <select name="controlMode" defaultValue="guided">
              <option value="guided">Sinonimo bidireccional</option>
              <option value="advanced">Avanzado JSON</option>
            </select>
          </label>
          <label className="adminField">
            <span>Control ID</span>
            <input name="controlId" placeholder="liquido-aceite-lubricante" />
          </label>
          <label className="adminField">
            <span>Display name</span>
            <input name="displayName" placeholder="liquido aceite lubricante" />
          </label>
          <label className="adminField">
            <span>Synonyms</span>
            <input name="synonyms" placeholder="liquido, aceite, lubricante" />
          </label>
          <details className="searchAdvancedJson">
            <summary>Payload avanzado</summary>
            <label className="adminField">
              <span>Control JSON</span>
              <textarea className="searchJsonTextarea" name="controlJson" defaultValue={advancedControlExample} rows={12} spellCheck={false} />
            </label>
          </details>
          <label className="adminField">
            <span>Serving config ID</span>
            <input name="servingConfigId" defaultValue="default_serving_config" />
          </label>
          <label className="adminCheckbox">
            <input name="associateAfterCreate" type="checkbox" value="true" defaultChecked />
            Asociar al serving config despues de crear
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Crear control</button>
        </form>
      </SearchDrawer>
    );
  }

  if (filters.drawer === "control-edit") {
    return (
      <SearchDrawer closeHref={closeHref} description="Edita el payload del control seleccionado y limita el cambio con updateMask si aplica." title="Editar control">
        <form className="pricingDenseForm" action={updateSearchControlAction}>
          <label className="adminField">
            <span>Control ID</span>
            <input name="controlId" defaultValue={controlId} />
          </label>
          <label className="adminField">
            <span>updateMask</span>
            <input name="updateMask" placeholder="displayName,rule" />
          </label>
          <label className="adminField">
            <span>Control JSON</span>
            <textarea className="searchJsonTextarea" name="controlJson" defaultValue={JSON.stringify(control ?? {}, null, 2)} rows={18} spellCheck={false} />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Guardar control</button>
        </form>
      </SearchDrawer>
    );
  }

  if (filters.drawer === "control-associate") {
    return (
      <SearchDrawer closeHref={closeHref} description="Vincula o quita el control del serving config que usa la tienda." title="Asociar control">
        <form className="pricingDenseForm" action={associateSearchControlAction}>
          <label className="adminField">
            <span>Control ID</span>
            <input name="controlId" defaultValue={controlId} />
          </label>
          <label className="adminField">
            <span>Serving config ID</span>
            <input name="servingConfigId" defaultValue="default_serving_config" />
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Asociar control</button>
        </form>
        <form className="pricingDenseForm searchDangerForm" action={removeSearchControlAssociationAction}>
          <input type="hidden" name="controlId" value={controlId} />
          <label className="adminField">
            <span>Serving config ID</span>
            <input name="servingConfigId" defaultValue="default_serving_config" />
          </label>
          <button className="adminButton adminButtonDanger" type="submit">Quitar asociacion</button>
        </form>
      </SearchDrawer>
    );
  }

  return null;
}

function ControlsPanel({ data, filters }: { data: SearchAdminData; filters: SearchAdminFilters }) {
  return (
    <>
      <div className="searchActionBar">
        <Link className="adminButton adminButtonPrimary" href={searchHref(filters, { tab: "controls", drawer: "control-create", controlId: undefined })}>Crear control</Link>
      </div>
      <div className="pricingGridTwo">
        <ControlsTable data={data.controls} servingConfigs={data.servingConfigs.data} filters={filters} />
        <ServingConfigsTable data={data.servingConfigs} />
      </div>
      <ControlDrawer data={data} filters={filters} />
    </>
  );
}

function SourceFields({ context, defaultBaseUrl }: { context: AdminContext; defaultBaseUrl: string }) {
  return (
    <>
      <label className="adminField">
        <span>Fuente</span>
        <select name="sourceMode" defaultValue="catalogSource">
          <option value="catalogSource">Catalog source</option>
          <option value="inline">Productos JSON</option>
        </select>
      </label>
      <label className="adminField">
        <span>publicBaseUrl</span>
        <input name="publicBaseUrl" defaultValue={defaultBaseUrl} />
      </label>
      <div className="pricingGridTwo searchCompactGrid">
        <label className="adminField">
          <span>pageSize</span>
          <input name="pageSize" defaultValue="100" inputMode="numeric" />
        </label>
        <label className="adminField">
          <span>maxProducts</span>
          <input name="maxProducts" defaultValue="1000" inputMode="numeric" />
        </label>
      </div>
      <div className="pricingGridTwo searchCompactGrid">
        <label className="adminField">
          <span>Currency</span>
          <input name="currency" defaultValue={context.currency} />
        </label>
        <label className="adminField">
          <span>Country</span>
          <input name="country" defaultValue={context.country} />
        </label>
      </div>
      <div className="pricingGridTwo searchCompactGrid">
        <label className="adminField">
          <span>Channel</span>
          <input name="channel" defaultValue={context.channel} />
        </label>
        <label className="adminField">
          <span>Trade policy</span>
          <input name="tradePolicy" defaultValue="default" />
        </label>
      </div>
      <label className="adminField">
        <span>Warehouse</span>
        <input name="warehouseId" defaultValue="warehouse-default" />
      </label>
      <label className="adminCheckbox">
        <input name="includeAliases" type="checkbox" value="true" defaultChecked />
        Enriquecer con Routing/SEO aliases
      </label>
      <label className="adminCheckbox">
        <input name="includeInactive" type="checkbox" value="true" />
        Incluir productos inactivos
      </label>
      <details className="searchAdvancedJson">
        <summary>Productos JSON manuales</summary>
        <FeedProductInput />
      </details>
    </>
  );
}

function IndexDrawer({ filters }: { filters: SearchAdminFilters }) {
  const closeHref = drawerCloseHref(filters);
  if (filters.drawer !== "index-preview" && filters.drawer !== "index-import") {
    return null;
  }

  const isPreview = filters.drawer === "index-preview";
  return (
    <SearchDrawer
      closeHref={closeHref}
      description={isPreview ? "Valida el payload contra el BFF antes de mutar Search." : "Ejecuta un import inline con el payload revisado."}
      title={isPreview ? "Preview index" : "Crear import job"}
    >
      <form className="pricingDenseForm" action={isPreview ? previewSearchIndexAction : createSearchImportJobAction}>
        <label className="adminField">
          <span>Payload JSON</span>
          <textarea className="searchJsonTextarea" name="indexJson" defaultValue={indexExample} rows={18} spellCheck={false} />
        </label>
        <button className="adminButton adminButtonPrimary" type="submit">{isPreview ? "Ejecutar preview" : "Crear import job"}</button>
      </form>
    </SearchDrawer>
  );
}

function IndexPanel({ filters }: { filters: SearchAdminFilters }) {
  return (
    <>
    <div className="pricingGridTwo searchOperationGrid">
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Index inline</h2>
            <p>Valida un payload pequeño antes de enviarlo a Search.</p>
          </div>
        </div>
        <Link className="adminButton adminButtonPrimary" href={searchHref(filters, { tab: "index", drawer: "index-preview" })}>Preview index</Link>
      </section>

      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Import job</h2>
            <p>Ejecuta importación inline solo después de validar.</p>
          </div>
        </div>
        <Link className="adminButton" href={searchHref(filters, { tab: "index", drawer: "index-import" })}>Crear import job</Link>
        <div className="adminBanner adminBannerWarning">
          <p>Usa preview antes de import real cuando el provider sea Vertex.</p>
        </div>
      </section>
    </div>
    <IndexDrawer filters={filters} />
    </>
  );
}

function FeedProductInput() {
  return (
    <>
      <label className="adminField">
        <span>products[] JSON</span>
        <textarea className="searchJsonTextarea" name="productsJson" defaultValue={productsExample} rows={12} spellCheck={false} />
      </label>
      <label className="adminField">
        <span>Archivo products JSON</span>
        <input name="productsFile" type="file" accept="application/json,.json" />
      </label>
    </>
  );
}

function defaultSearchGcsUri() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `gs://${searchGcsBucket}/search/full/search-products-${timestamp}.ndjson`;
}

function FeedDrawer({ context, filters, defaultBaseUrl }: { context: AdminContext; filters: SearchAdminFilters; defaultBaseUrl: string }) {
  const closeHref = drawerCloseHref(filters);
  const gcsUriDefault = defaultSearchGcsUri();

  if (filters.drawer === "feed-generate") {
    return (
      <SearchDrawer closeHref={closeHref} description="Genera el NDJSON desde Catalog actual o desde un lote manual controlado." title="Generar NDJSON">
        <form className="pricingDenseForm" action={generateSearchNdjsonAction} encType="multipart/form-data">
          <label className="adminField">
            <span>fileName</span>
            <input name="fileName" defaultValue="search-products.ndjson" />
          </label>
          <SourceFields context={context} defaultBaseUrl={defaultBaseUrl} />
          <button className="adminButton adminButtonPrimary" type="submit">Generar NDJSON</button>
        </form>
      </SearchDrawer>
    );
  }

  if (filters.drawer === "feed-gcs") {
    return (
      <SearchDrawer closeHref={closeHref} description="Valida o ejecuta la importación GCS. FULL reemplaza la rama de Search." title="GCS import">
        <form className="pricingDenseForm" action={createSearchGcsImportJobAction} encType="multipart/form-data">
          <label className="adminField">
            <span>Archivo destino en GCS</span>
            <input name="gcsUri" defaultValue={gcsUriDefault} />
            <small>Se genera automaticamente. Cambialo solo si necesitas una ruta especifica.</small>
          </label>
          <label className="adminField">
            <span>reconciliationMode</span>
            <select name="reconciliationMode" defaultValue="FULL">
              <option value="FULL">FULL</option>
              <option value="INCREMENTAL">INCREMENTAL</option>
            </select>
          </label>
          <label className="adminCheckbox">
            <input name="validateOnly" type="checkbox" value="true" defaultChecked />
            validateOnly
          </label>
          <label className="adminCheckbox">
            <input name="fullConfirmed" type="checkbox" value="true" />
            Confirmo FULL si ejecuto import real
          </label>
          <SourceFields context={context} defaultBaseUrl={defaultBaseUrl} />
          <button className="adminButton adminButtonPrimary" type="submit">Crear GCS import job</button>
        </form>
      </SearchDrawer>
    );
  }

  if (filters.drawer === "feed-delete") {
    return (
      <SearchDrawer closeHref={closeHref} description="Borra solo el archivo NDJSON de GCS. No toca Catalog ni productos del índice." title="Eliminar archivo NDJSON">
        <form className="pricingDenseForm" action={deleteSearchNdjsonAction}>
          <label className="adminField">
            <span>Archivo destino en GCS</span>
            <input name="gcsUri" defaultValue={gcsUriDefault} />
            <small>Usa la misma ruta del import que quieres limpiar.</small>
          </label>
          <button className="adminButton adminButtonDanger" type="submit">Eliminar archivo</button>
        </form>
      </SearchDrawer>
    );
  }

  return null;
}

function FeedPanel({ context, filters }: { context: AdminContext; filters: SearchAdminFilters }) {
  const defaultBaseUrl = context.primaryDomain ? `https://${context.primaryDomain}` : "https://example.com";

  return (
    <>
    <div className="pricingGridTwo searchOperationGrid">
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Generar NDJSON</h2>
            <p>Crea contenido compatible con Vertex Product desde Catalog o lote manual.</p>
          </div>
        </div>
        <Link className="adminButton adminButtonPrimary" href={searchHref(filters, { tab: "feed", drawer: "feed-generate" })}>Generar feed</Link>
      </section>

      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>GCS import</h2>
            <p>Sube el NDJSON generado y lanza importación controlada.</p>
          </div>
        </div>
        <Link className="adminButton" href={searchHref(filters, { tab: "feed", drawer: "feed-gcs" })}>Crear GCS import</Link>
      </section>

      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Eliminar NDJSON</h2>
            <p>Limpia solo el artefacto en GCS, sin mutar el índice.</p>
          </div>
        </div>
        <Link className="adminButton adminButtonDanger" href={searchHref(filters, { tab: "feed", drawer: "feed-delete" })}>Eliminar archivo</Link>
      </section>
    </div>
    <FeedDrawer context={context} filters={filters} defaultBaseUrl={defaultBaseUrl} />
    </>
  );
}

export function SearchAdminPage({ context, data, filters }: SearchAdminPageProps) {
  const activeTab = data.tab;

  return (
    <main className="adminPage pricingAdminPage searchAdminPage">
      <div className="adminBreadcrumb">Admin / Catalogo / Busqueda</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Busqueda</h1>
          <p className="adminPageIntro">Gestiona el laboratorio de Search: salud del servicio y preview de consultas usando el BFF.</p>
        </div>
        <Link className="adminButton" href="/admin/catalogo">Volver a catalogo</Link>
      </div>
      <div className="adminContextHint">
        {context.organizationId || "organization pendiente"} / {context.shopId || "shop pendiente"} / {context.locale} / {context.currency} / {context.country} / {context.channel}
      </div>
      {filters.searchMessage ? <div className="adminBanner"><p>{filters.searchMessage}</p></div> : null}
      <nav className="adminTabs pricingTabs" aria-label="Search">
        {searchTabs.map((tab) => (
          <Link
            className={`productEditorTab ${tab.id === activeTab ? "productEditorTabActive" : ""}`}
            href={tabHref(tab.id)}
            key={tab.id}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {activeTab === "lab" ? (
        <>
          <div className="pricingGridTwo">
            <HealthPanel data={data.health} />
            <PreviewForm context={context} filters={filters} />
          </div>
          <PreviewResults data={data.preview} />
        </>
      ) : null}
      {activeTab === "controls" ? <ControlsPanel data={data} filters={filters} /> : null}
      {activeTab === "index" ? <IndexPanel filters={filters} /> : null}
      {activeTab === "feed" ? <FeedPanel context={context} filters={filters} /> : null}
    </main>
  );
}
