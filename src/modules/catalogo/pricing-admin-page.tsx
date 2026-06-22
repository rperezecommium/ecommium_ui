import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminContext } from "../../shared/config/admin-context";
import type { PricingAdminResult, PricingAdminTab, PricingGovernanceData, PricingRecord } from "./pricing-admin";
import {
  deleteFixedPriceAction,
  deletePricingRuleAction,
  updatePipelineCatalogAction,
  updatePriceTableActivationAction,
  updatePricingRuleAction,
  upsertFixedPriceAction,
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

  return `/admin/catalogo/precios?${params.toString()}`;
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
  return String(record.priceTableId ?? record.ruleId ?? record.itemId ?? record.taxCode ?? record.id ?? index);
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
    <form className="pricingFilterBar" action="/admin/catalogo/precios">
      <input type="hidden" name="tab" value={filters.tab} />
      <label className="adminField">
        <span>priceTableId</span>
        <select name="priceTableId" defaultValue={filters.priceTableId ?? ""}>
          <option value="">Seleccionar tabla</option>
          {data.priceTables.data.map((table, index) => {
            const id = String(table.priceTableId ?? table.id ?? "");
            return id ? (
              <option value={id} key={id}>
                {String(table.name ?? table.label ?? id)}
              </option>
            ) : <option disabled key={`table-${index}`}>Tabla sin id</option>;
          })}
        </select>
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
    <form action={updatePriceTableActivationAction} className="pricingInlineForm">
      <input type="hidden" name="priceTableId" value={priceTableId} />
      <input type="hidden" name="active" value={String(!isActive)} />
      <button className="adminButton" disabled={!priceTableId} type="submit">
        {isActive ? "Desactivar" : "Activar"}
      </button>
    </form>
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
        <input name="tradePolicy" defaultValue={String(record.tradePolicy ?? "")} placeholder="tradePolicy" />
        <input name="channel" defaultValue={String(record.channel ?? "")} placeholder="channel" />
        <input name="customerGroup" defaultValue={String(record.customerGroup ?? "")} placeholder="customerGroup" />
        <input name="country" defaultValue={String(record.country ?? "")} placeholder="country" />
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

function FixedPriceForms({ filters }: { filters: PricingAdminPageProps["filters"] }) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Editar fixed price</h2>
      </div>
      <form action={upsertFixedPriceAction} className="pricingDenseForm">
        <input name="itemId" defaultValue={filters.itemId ?? ""} placeholder="itemId" />
        <input name="priceTableId" defaultValue={filters.priceTableId ?? ""} placeholder="priceTableId" />
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
        <input name="priceTableId" defaultValue={filters.priceTableId ?? ""} placeholder="priceTableId" />
        <input name="confirmDelete" placeholder="DELETE" aria-label="Confirmar borrar fixed price" />
        <button className="adminButton adminButtonDanger" type="submit">Borrar fixed price</button>
      </form>
    </section>
  );
}

function PipelineForm({ filters }: { filters: PricingAdminPageProps["filters"] }) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Actualizacion masiva por tabla</h2>
      </div>
      <form action={updatePipelineCatalogAction} className="pricingDenseForm">
        <input name="priceTableId" defaultValue={filters.priceTableId ?? ""} placeholder="priceTableId" />
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
      <div className="adminBreadcrumb">Admin / Catalogo / Precios</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Pricing</h1>
          <p className="adminPageIntro">Gobernanza de impuestos, tablas, reglas, fixed prices, computed prices y pipeline catalog.</p>
        </div>
        <Link className="adminButton" href="/admin/products">Volver a productos</Link>
      </div>
      <div className="adminContextHint">
        {context.organizationId || "organization pendiente"} / {context.shopId || "shop pendiente"} / {context.currency} / {context.country} / {context.channel}
      </div>
      {filters.pricingMessage ? <div className="adminBanner"><p>{filters.pricingMessage}</p></div> : null}
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
        <RecordTable title="Impuestos" result={data.taxes} columns={["taxCode", "name", "rate", "country", "active"]} empty="No hay impuestos disponibles o falta permiso pricing.admin.read." />
      ) : null}
      {activeTab === "tables" ? (
        <RecordTable title="Price tables" result={data.priceTables} columns={["priceTableId", "name", "currency", "active", "priority", "updatedAt"]} empty="No hay price tables." actions={(record) => <PriceTableActions record={record} />} />
      ) : null}
      {activeTab === "rules" ? (
        <>
          {!filters.priceTableId ? <div className="adminBanner"><p>Selecciona priceTableId para listar reglas.</p></div> : null}
          <RecordTable title="Rules" result={data.rules} columns={["ruleId", "active", "priority", "source", "tradePolicy", "channel", "customerGroup", "country"]} empty="No hay reglas para la tabla seleccionada." actions={(record) => <RuleActions record={record} priceTableId={filters.priceTableId} />} />
        </>
      ) : null}
      {activeTab === "fixed" ? (
        <>
          <FixedPriceForms filters={filters} />
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
          <PipelineForm filters={filters} />
          <RecordTable title="Pipeline catalog" result={data.pipeline} columns={["priceTableId", "active", "status", "lastRunAt", "updatedAt"]} empty="No hay pipeline catalog para el contexto." />
          <RecordDetails title="Pipeline tabla seleccionada" result={data.pipelineTable} />
        </>
      ) : null}
    </main>
  );
}
