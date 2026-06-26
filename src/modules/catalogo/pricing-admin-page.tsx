import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminContext } from "../../shared/config/admin-context";
import type { PricingAdminResult, PricingAdminTab, PricingGovernanceData, PricingRecord } from "./pricing-admin";
import {
  deleteFixedPriceAction,
  deletePriceTableReferenceAction,
  deletePricingRuleAction,
  deletePricingReferenceAction,
  deleteTaxDefinitionAction,
  updatePipelineCatalogAction,
  updatePriceTableActivationAction,
  updatePricingRuleAction,
  upsertFixedPriceAction,
  upsertPriceTableReferenceAction,
  upsertPricingReferenceAction,
  upsertTaxDefinitionAction,
} from "./pricing-admin-actions";

type PricingAdminPageProps = {
  context: AdminContext;
  data: PricingGovernanceData;
  filters: {
    tab: PricingAdminTab;
    priceTableId?: string;
    itemId?: string;
    pricingMessage?: string;
  };
};

const tabs: Array<{ id: PricingAdminTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "taxes", label: "Impuestos" },
  { id: "tables", label: "Price tables" },
  { id: "references", label: "Parametros" },
  { id: "rules", label: "Rules" },
  { id: "fixed", label: "Fixed prices" },
  { id: "computed", label: "Computed" },
  { id: "computed-auto", label: "Computed auto" },
  { id: "pipeline", label: "Pipeline catalog" },
];

function tabHref(tab: PricingAdminTab, filters: PricingAdminPageProps["filters"]) {
  const params = new URLSearchParams({ tab });
  if (filters.priceTableId) {
    params.set("priceTableId", filters.priceTableId);
  }
  if (filters.itemId) {
    params.set("itemId", filters.itemId);
  }

  return `/admin/configuracion/precios?${params.toString()}`;
}

function valueText(value: PricingRecord[string]) {
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }
  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }

  return String(value);
}

function recordId(record: PricingRecord, index: number) {
  return String(record.priceTableId ?? record.ruleId ?? record.itemId ?? record.taxCode ?? record.code ?? record.id ?? index);
}

function optionText(value: PricingRecord[string]) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueOptions(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      options.push(normalized);
    }
  }

  return options;
}

function referenceOptions(data: PricingGovernanceData, context: AdminContext) {
  const rows = [
    ...data.rules.data,
    ...data.fixedPrices.data,
    ...data.pipeline.data,
    ...data.taxes.data,
    ...data.priceTables.data,
    ...data.customerGroups.data,
    ...data.channels.data,
    ...data.tradePolicies.data,
    ...data.countries.data,
  ];

  return {
    tradePolicies: uniqueOptions([
      "default",
      ...data.tradePolicies.data.map((record) => optionText(record.code ?? record.tradePolicy)),
      ...rows.map((record) => optionText(record.tradePolicy)),
    ]),
    channels: uniqueOptions([
      context.channel,
      "web",
      ...data.channels.data.map((record) => optionText(record.code ?? record.channel)),
      ...rows.map((record) => optionText(record.channel)),
    ]),
    customerGroups: uniqueOptions([
      ...data.customerGroups.data.map((record) => optionText(record.code ?? record.customerGroup)),
      ...rows.map((record) => optionText(record.customerGroup)),
    ]),
    countries: uniqueOptions([
      context.country,
      ...data.countries.data.map((record) => optionText(record.code ?? record.country)),
      ...rows.map((record) => optionText(record.country)),
    ]),
  };
}

function PricingReferenceDatalists({ data, context }: { data: PricingGovernanceData; context: AdminContext }) {
  const options = referenceOptions(data, context);

  return (
    <>
      <datalist id="pricing-trade-policies">
        {options.tradePolicies.map((value) => <option value={value} key={value} />)}
      </datalist>
      <datalist id="pricing-channels">
        {options.channels.map((value) => <option value={value} key={value} />)}
      </datalist>
      <datalist id="pricing-customer-groups">
        {options.customerGroups.map((value) => <option value={value} key={value} />)}
      </datalist>
      <datalist id="pricing-countries">
        {options.countries.map((value) => <option value={value} key={value} />)}
      </datalist>
    </>
  );
}

function PriceTableSelect({
  data,
  defaultValue,
  label,
}: {
  data: PricingGovernanceData;
  defaultValue?: string;
  label: string;
}) {
  const currentValue = defaultValue?.trim() ?? "";
  const hasCurrent = currentValue && data.priceTables.data.some((table) => String(table.priceTableId ?? table.id ?? "") === currentValue);

  return (
    <select name="priceTableId" defaultValue={currentValue} aria-label={label}>
      <option value="">Seleccionar tabla</option>
      {currentValue && !hasCurrent ? <option value={currentValue}>{currentValue}</option> : null}
      {data.priceTables.data.map((table, index) => {
        const id = String(table.priceTableId ?? table.id ?? "");
        return id ? (
          <option value={id} key={id}>
            {String(table.name ?? table.label ?? id)}
          </option>
        ) : <option disabled key={`table-${index}`}>Tabla sin id</option>;
      })}
    </select>
  );
}

function ResultBanner<T>({ result }: { result: PricingAdminResult<T> }) {
  if (result.source === "bff") {
    return null;
  }

  return (
    <div className="adminBanner adminBannerError">
      <p>{result.message}</p>
      {result.failedEndpoint ? <p className="adminContextHint">{result.failedEndpoint}</p> : null}
    </div>
  );
}

function RecordDetails({ title, result }: { title: string; result: PricingAdminResult<PricingRecord> }) {
  const entries = Object.entries(result.data).filter(([, value]) => typeof value !== "undefined");

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>{title}</h2>
      </div>
      <ResultBanner result={result} />
      {entries.length === 0 ? (
        <p className="adminContextHint">Sin datos para este contexto.</p>
      ) : (
        <dl className="pricingDefinitionGrid">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{valueText(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function RecordTable({
  title,
  result,
  columns,
  empty,
  actions,
}: {
  title: string;
  result: PricingAdminResult<PricingRecord[]>;
  columns: string[];
  empty: string;
  actions?: (record: PricingRecord) => ReactNode;
}) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>{title}</h2>
        <p>{result.data.length} registros</p>
      </div>
      <ResultBanner result={result} />
      {result.data.length === 0 ? (
        <p className="adminContextHint">{empty}</p>
      ) : (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable">
            <thead>
              <tr>
                {columns.map((column) => <th scope="col" key={column}>{column}</th>)}
                {actions ? <th scope="col">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {result.data.map((record, index) => (
                <tr key={recordId(record, index)}>
                  {columns.map((column) => <td key={column}>{valueText(record[column])}</td>)}
                  {actions ? <td>{actions(record)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PricingFilters({ filters, data }: { filters: PricingAdminPageProps["filters"]; data: PricingGovernanceData }) {
  return (
    <form className="pricingFilterBar" action="/admin/configuracion/precios">
      <input type="hidden" name="tab" value={filters.tab} />
      <label className="adminField">
        <span>priceTableId</span>
        <PriceTableSelect data={data} defaultValue={filters.priceTableId} label="priceTableId" />
      </label>
      <label className="adminField">
        <span>itemId</span>
        <input name="itemId" defaultValue={filters.itemId ?? ""} placeholder="productId, variantId o SKU" />
      </label>
      <button className="adminButton adminButtonPrimary" type="submit">Aplicar filtros</button>
    </form>
  );
}

function PriceTableActions({ record }: { record: PricingRecord }) {
  const priceTableId = String(record.priceTableId ?? record.id ?? "");
  const isActive = Boolean(record.active);

  return (
    <div className="pricingActionStack">
      <form action={updatePriceTableActivationAction} className="pricingInlineForm">
        <input type="hidden" name="priceTableId" value={priceTableId} />
        <input type="hidden" name="active" value={String(!isActive)} />
        <button className="adminButton" disabled={!priceTableId} type="submit">
          {isActive ? "Desactivar" : "Activar"}
        </button>
      </form>
      <form action={deletePriceTableReferenceAction} className="pricingInlineForm">
        <input type="hidden" name="priceTableId" value={priceTableId} />
        <input name="confirmDelete" placeholder="DELETE" aria-label="Confirmar desactivar tabla" />
        <button className="adminButton adminButtonDanger" disabled={!priceTableId} type="submit">Baja</button>
      </form>
    </div>
  );
}

function TaxDefinitionForm({ context }: { context: AdminContext }) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Crear impuesto</h2>
      </div>
      <form action={upsertTaxDefinitionAction} className="pricingDenseForm">
        <label className="adminField">
          <span>Codigo</span>
          <input name="code" placeholder="default-iva" />
          <small>Valor que viaja como taxCode en precios.</small>
        </label>
        <label className="adminField">
          <span>Nombre</span>
          <input name="name" placeholder="Default IVA" />
          <small>Etiqueta visible para seleccionar la regla fiscal.</small>
        </label>
        <label className="adminField">
          <span>Ayuda</span>
          <input name="helpText" defaultValue="Regla fiscal usada para calcular precio con/sin impuesto." />
          <small>Texto corto que orienta al operador.</small>
        </label>
        <label className="adminField">
          <span>Tipo</span>
          <select name="calculationType" defaultValue="PERCENTAGE">
            <option value="PERCENTAGE">Porcentaje</option>
            <option value="FIXED">Importe fijo</option>
          </select>
          <small>Modo de calculo del impuesto.</small>
        </label>
        <label className="adminField">
          <span>Porcentaje</span>
          <input name="ratePercent" type="number" min="0" step="0.01" placeholder="10.00" />
          <small>Escribe 10 para guardar 10%.</small>
        </label>
        <label className="adminField">
          <span>Importe menor</span>
          <input name="amountMinor" type="number" min="0" step="1" placeholder="0" />
          <small>Solo para impuestos de importe fijo.</small>
        </label>
        <label className="adminField">
          <span>Pais</span>
          <input name="country" list="pricing-countries" defaultValue={context.country} />
          <small>Mercado donde aplica el impuesto.</small>
        </label>
        <label className="adminField">
          <span>Estado</span>
          <select name="active" defaultValue="true">
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
          <small>Solo los activos alimentan selectores por defecto.</small>
        </label>
        <button className="adminButton adminButtonPrimary" type="submit">Guardar impuesto</button>
      </form>
    </section>
  );
}

function TaxActions({ record }: { record: PricingRecord }) {
  const taxCode = String(record.taxCode ?? record.code ?? "");

  return (
    <form action={deleteTaxDefinitionAction} className="pricingInlineForm">
      <input type="hidden" name="taxCode" value={taxCode} />
      <input name="confirmDelete" placeholder="DELETE" aria-label="Confirmar desactivar impuesto" />
      <button className="adminButton adminButtonDanger" disabled={!taxCode} type="submit">Baja</button>
    </form>
  );
}

function PriceTableReferenceForm({ context }: { context: AdminContext }) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Crear price table</h2>
      </div>
      <form action={upsertPriceTableReferenceAction} className="pricingDenseForm">
        <label className="adminField">
          <span>Codigo</span>
          <input name="code" placeholder="vip-table" />
          <small>Valor que viaja como priceTableId.</small>
        </label>
        <label className="adminField">
          <span>Nombre</span>
          <input name="name" placeholder="VIP" />
          <small>Etiqueta visible para operadores.</small>
        </label>
        <label className="adminField">
          <span>Ayuda</span>
          <input name="helpText" defaultValue="Tabla comercial que agrupa reglas y precios por contexto." />
          <small>Texto de ayuda del selector.</small>
        </label>
        <label className="adminField">
          <span>Moneda</span>
          <input name="currency" defaultValue={context.currency} />
          <small>Moneda recomendada para esta tabla.</small>
        </label>
        <label className="adminField">
          <span>Estado</span>
          <select name="active" defaultValue="true">
            <option value="true">Activa</option>
            <option value="false">Inactiva</option>
          </select>
          <small>Controla disponibilidad en selectores.</small>
        </label>
        <button className="adminButton adminButtonPrimary" type="submit">Guardar price table</button>
      </form>
    </section>
  );
}

function ReferenceForm({ kind, title, help }: { kind: string; title: string; help: string }) {
  return (
    <form action={upsertPricingReferenceAction} className="pricingDenseForm">
      <input type="hidden" name="kind" value={kind} />
      <label className="adminField">
        <span>Codigo</span>
        <input name="code" placeholder={kind === "countries" ? "ES" : "default"} />
        <small>{help}</small>
      </label>
      <label className="adminField">
        <span>Nombre</span>
        <input name="name" placeholder={title} />
        <small>Etiqueta que vera el operador.</small>
      </label>
      <label className="adminField">
        <span>Ayuda</span>
        <input name="helpText" defaultValue={help} />
        <small>Texto breve para el formulario de precios.</small>
      </label>
      <label className="adminField">
        <span>Estado</span>
        <select name="active" defaultValue="true">
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
        <small>Define si aparece en selectores.</small>
      </label>
      <button className="adminButton adminButtonPrimary" type="submit">Guardar</button>
    </form>
  );
}

function ReferenceActions({ kind, record }: { kind: string; record: PricingRecord }) {
  const code = String(record.code ?? record.id ?? "");

  return (
    <form action={deletePricingReferenceAction} className="pricingInlineForm">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="code" value={code} />
      <input name="confirmDelete" placeholder="DELETE" aria-label="Confirmar desactivar parametro" />
      <button className="adminButton adminButtonDanger" disabled={!code} type="submit">Baja</button>
    </form>
  );
}

function ReferenceSection({
  title,
  kind,
  help,
  result,
}: {
  title: string;
  kind: string;
  help: string;
  result: PricingAdminResult<PricingRecord[]>;
}) {
  return (
    <>
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <h2>{title}</h2>
          <p>{result.data.length} registros</p>
        </div>
        <ReferenceForm kind={kind} title={title} help={help} />
      </section>
      <RecordTable title={`${title} existentes`} result={result} columns={["code", "name", "helpText", "active"]} empty="No hay registros." actions={(record) => <ReferenceActions kind={kind} record={record} />} />
    </>
  );
}

function RuleActions({ record, priceTableId }: { record: PricingRecord; priceTableId?: string }) {
  const ruleId = String(record.ruleId ?? record.id ?? "");

  return (
    <div className="pricingActionStack">
      <form action={updatePricingRuleAction} className="pricingInlineForm">
        <input type="hidden" name="priceTableId" value={priceTableId ?? ""} />
        <input type="hidden" name="ruleId" value={ruleId} />
        <select name="active" defaultValue={String(record.active ?? true)} aria-label="active">
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </select>
        <input name="priority" defaultValue={String(record.priority ?? "")} placeholder="priority" />
        <input name="source" defaultValue={String(record.source ?? "")} placeholder="source" />
        <input name="tradePolicy" list="pricing-trade-policies" defaultValue={String(record.tradePolicy ?? "")} placeholder="tradePolicy" />
        <input name="channel" list="pricing-channels" defaultValue={String(record.channel ?? "")} placeholder="channel" />
        <input name="customerGroup" list="pricing-customer-groups" defaultValue={String(record.customerGroup ?? "")} placeholder="customerGroup" />
        <input name="country" list="pricing-countries" defaultValue={String(record.country ?? "")} placeholder="country" />
        <button className="adminButton" disabled={!priceTableId || !ruleId} type="submit">Guardar</button>
      </form>
      <form action={deletePricingRuleAction} className="pricingInlineForm">
        <input type="hidden" name="priceTableId" value={priceTableId ?? ""} />
        <input type="hidden" name="ruleId" value={ruleId} />
        <input name="confirmDelete" placeholder="DELETE" aria-label="Confirmar desactivar regla" />
        <button className="adminButton adminButtonDanger" disabled={!priceTableId || !ruleId} type="submit">Desactivar regla</button>
      </form>
    </div>
  );
}

function FixedPriceForms({ filters, data }: { filters: PricingAdminPageProps["filters"]; data: PricingGovernanceData }) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Editar fixed price</h2>
      </div>
      <form action={upsertFixedPriceAction} className="pricingDenseForm">
        <input name="itemId" defaultValue={filters.itemId ?? ""} placeholder="itemId" />
        <PriceTableSelect data={data} defaultValue={filters.priceTableId} label="priceTableId fixed price" />
        <input name="basePriceMinor" type="number" min={0} placeholder="basePriceMinor" />
        <input name="listPriceMinor" type="number" min={0} placeholder="listPriceMinor" />
        <input name="currency" defaultValue="EUR" placeholder="currency" />
        <select name="taxIncluded" defaultValue="true" aria-label="taxIncluded">
          <option value="true">taxIncluded</option>
          <option value="false">taxExcluded</option>
        </select>
        <button className="adminButton adminButtonPrimary" type="submit">Guardar fixed price</button>
      </form>
      <form action={deleteFixedPriceAction} className="pricingDenseForm pricingDangerForm">
        <input name="itemId" defaultValue={filters.itemId ?? ""} placeholder="itemId" />
        <PriceTableSelect data={data} defaultValue={filters.priceTableId} label="priceTableId delete fixed price" />
        <input name="confirmDelete" placeholder="DELETE" aria-label="Confirmar borrar fixed price" />
        <button className="adminButton adminButtonDanger" type="submit">Borrar fixed price</button>
      </form>
    </section>
  );
}

function PipelineForm({ filters, data }: { filters: PricingAdminPageProps["filters"]; data: PricingGovernanceData }) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Actualizacion masiva por tabla</h2>
      </div>
      <form action={updatePipelineCatalogAction} className="pricingDenseForm">
        <PriceTableSelect data={data} defaultValue={filters.priceTableId} label="priceTableId pipeline" />
        <select name="active" defaultValue="true" aria-label="active">
          <option value="true">Activar pipeline</option>
          <option value="false">Pausar pipeline</option>
        </select>
        <input name="mode" placeholder="mode" defaultValue="rebuild" />
        <button className="adminButton adminButtonPrimary" type="submit">Actualizar pipeline</button>
      </form>
    </section>
  );
}

export function PricingAdminPage({ context, data, filters }: PricingAdminPageProps) {
  const activeTab = filters.tab;

  return (
    <main className="adminPage pricingAdminPage">
      <div className="adminBreadcrumb">Admin / Configuracion / Precios</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Configuracion de precios</h1>
          <p className="adminPageIntro">Define las listas que alimentan Pricing: impuestos, price tables, reglas, fixed prices, computed prices y pipeline catalog.</p>
        </div>
        <Link className="adminButton" href="/admin/products">Ir a productos</Link>
      </div>
      <div className="adminContextHint">
        {context.organizationId || "organization pendiente"} / {context.shopId || "shop pendiente"} / {context.currency} / {context.country} / {context.channel}
      </div>
      {filters.pricingMessage ? <div className="adminBanner"><p>{filters.pricingMessage}</p></div> : null}
      <PricingReferenceDatalists data={data} context={context} />
      <nav className="adminTabs pricingTabs" aria-label="Pricing">
        {tabs.map((tab) => (
          <Link
            className={`productEditorTab ${tab.id === activeTab ? "productEditorTabActive" : ""}`}
            href={tabHref(tab.id, filters)}
            key={tab.id}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <PricingFilters filters={filters} data={data} />

      {activeTab === "summary" ? (
        <div className="pricingGridTwo">
          <RecordDetails title="Config" result={data.config} />
          <RecordDetails title="Migration" result={data.migration} />
        </div>
      ) : null}
      {activeTab === "taxes" ? (
        <>
          <TaxDefinitionForm context={context} />
          <RecordTable title="Impuestos" result={data.taxes} columns={["taxCode", "name", "rate", "country", "isActive"]} empty="No hay impuestos disponibles o falta permiso pricing.admin.read." actions={(record) => <TaxActions record={record} />} />
        </>
      ) : null}
      {activeTab === "tables" ? (
        <>
          <PriceTableReferenceForm context={context} />
          <RecordTable title="Price tables" result={data.priceTables} columns={["priceTableId", "name", "currency", "active", "priority", "updatedAt"]} empty="No hay price tables." actions={(record) => <PriceTableActions record={record} />} />
        </>
      ) : null}
      {activeTab === "references" ? (
        <div className="pricingGridTwo">
          <ReferenceSection
            title="Grupos de cliente"
            kind="customer-groups"
            help="Segmento comercial usado para aplicar precios especificos."
            result={data.customerGroups}
          />
          <ReferenceSection
            title="Canales"
            kind="channels"
            help="Origen de venta donde aplica el precio."
            result={data.channels}
          />
          <ReferenceSection
            title="Politicas comerciales"
            kind="trade-policies"
            help="Politica comercial que agrupa condiciones de precio."
            result={data.tradePolicies}
          />
          <ReferenceSection
            title="Paises"
            kind="countries"
            help="Mercado donde aplica precio o impuesto."
            result={data.countries}
          />
        </div>
      ) : null}
      {activeTab === "rules" ? (
        <>
          {!filters.priceTableId ? <div className="adminBanner"><p>Selecciona priceTableId para listar reglas.</p></div> : null}
          <RecordTable title="Rules" result={data.rules} columns={["ruleId", "active", "priority", "source", "tradePolicy", "channel", "customerGroup", "country"]} empty="No hay reglas para la tabla seleccionada." actions={(record) => <RuleActions record={record} priceTableId={filters.priceTableId} />} />
        </>
      ) : null}
      {activeTab === "fixed" ? (
        <>
          <FixedPriceForms filters={filters} data={data} />
          {!filters.itemId ? <div className="adminBanner"><p>Informa itemId para consultar fixed prices existentes.</p></div> : null}
          <RecordTable title="Fixed prices" result={data.fixedPrices} columns={["itemId", "priceTableId", "basePriceMinor", "listPriceMinor", "currency", "taxIncluded", "active"]} empty="No hay fixed prices para el item." />
        </>
      ) : null}
      {activeTab === "computed" ? (
        <>
          {!filters.itemId || !filters.priceTableId ? <div className="adminBanner"><p>Informa itemId y priceTableId para consultar computed price.</p></div> : null}
          <RecordDetails title="Computed item/table" result={data.computed} />
          <RecordTable title="Computed batch" result={data.computedBatch} columns={["itemId", "priceTableId", "netMinor", "taxMinor", "grossMinor", "currency", "source"]} empty="Sin resultado batch." />
        </>
      ) : null}
      {activeTab === "computed-auto" ? (
        <>
          {!filters.itemId ? <div className="adminBanner"><p>Informa itemId para consultar computed-auto.</p></div> : null}
          <RecordDetails title="Computed auto item" result={data.computedAuto} />
          <RecordTable title="Computed auto batch" result={data.computedAutoBatch} columns={["itemId", "priceTableId", "netMinor", "taxMinor", "grossMinor", "currency", "source"]} empty="Sin resultado batch." />
        </>
      ) : null}
      {activeTab === "pipeline" ? (
        <>
          <PipelineForm filters={filters} data={data} />
          <RecordTable title="Pipeline catalog" result={data.pipeline} columns={["priceTableId", "active", "status", "lastRunAt", "updatedAt"]} empty="No hay pipeline catalog para el contexto." />
          <RecordDetails title="Pipeline tabla seleccionada" result={data.pipelineTable} />
        </>
      ) : null}
    </main>
  );
}
