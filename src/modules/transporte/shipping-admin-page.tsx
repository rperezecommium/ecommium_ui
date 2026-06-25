import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import type { ShippingAdminData, ShippingAdminResult, ShippingAdminTab, ShippingRecord, ShippingScalar } from "./shipping-admin";
import {
  upsertShippingCarrierAction,
  upsertShippingCarrierServiceAction,
  upsertShippingRateRuleAction,
  upsertShippingZoneAction,
} from "./shipping-admin-actions";

type ShippingAdminPageProps = {
  context: AdminContext;
  data: ShippingAdminData;
  filters: {
    tab: ShippingAdminTab;
    includeInactive?: boolean;
    shippingMessage?: string;
    quoteRequested?: boolean;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
    variantId?: string;
    quantity?: string;
    priceMinor?: string;
    weightGrams?: string;
    widthMm?: string;
    heightMm?: string;
    depthMm?: string;
    itemsSubtotalMinor?: string;
    customerGroupId?: string;
  };
};

const tabs: Array<{ id: ShippingAdminTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "zones", label: "Zonas" },
  { id: "carriers", label: "Transportistas" },
  { id: "services", label: "Servicios" },
  { id: "rules", label: "Reglas de tarifa" },
  { id: "quote", label: "Simulador" },
];

function tabHref(tab: ShippingAdminTab, filters: ShippingAdminPageProps["filters"]) {
  const params = new URLSearchParams({ tab });
  if (filters.includeInactive) {
    params.set("includeInactive", "true");
  }

  return `/admin/transporte?${params.toString()}`;
}

function valueText(value: ShippingScalar) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "-";
  }
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }
  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }

  return String(value);
}

function stringValue(record: ShippingRecord, key: string) {
  const value = record[key];
  return Array.isArray(value) ? value.join(", ") : valueText(value) === "-" ? "" : String(value);
}

function boolValue(record: ShippingRecord, key: string, fallback = true) {
  return typeof record[key] === "boolean" ? String(record[key]) : String(fallback);
}

function recordId(record: ShippingRecord, index: number) {
  return String(
    record.zoneId ??
      record.carrierId ??
      record.carrierServiceId ??
      record.shippingRateRuleId ??
      record.id ??
      index,
  );
}

function ResultBanner<T>({ result }: { result: ShippingAdminResult<T> }) {
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

function RecordTable({
  title,
  result,
  rows,
  columns,
  empty,
  actions,
}: {
  title: string;
  result: ShippingAdminResult<unknown>;
  rows: ShippingRecord[];
  columns: string[];
  empty: string;
  actions?: (record: ShippingRecord) => ReactNode;
}) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>{title}</h2>
        <p>{rows.length} registros</p>
      </div>
      <ResultBanner result={result} />
      {rows.length === 0 ? (
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
              {rows.map((record, index) => (
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

function ShippingFilters({ filters }: { filters: ShippingAdminPageProps["filters"] }) {
  if (filters.tab === "quote") {
    return null;
  }

  return (
    <form className="pricingFilterBar" action="/admin/transporte">
      <input type="hidden" name="tab" value={filters.tab} />
      <label className="productListFilterCheckbox">
        <input name="includeInactive" type="checkbox" value="true" defaultChecked={Boolean(filters.includeInactive)} />
        Incluir inactivos
      </label>
      <button className="adminButton adminButtonPrimary" type="submit">Aplicar</button>
    </form>
  );
}

function QuoteSimulatorForm({
  filters,
  context,
}: {
  filters: ShippingAdminPageProps["filters"];
  context: AdminContext;
}) {
  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Simular cotizacion</h2>
        <p>POST /shipping/options/resolve</p>
      </div>
      <form className="pricingDenseForm" action="/admin/transporte">
        <input type="hidden" name="tab" value="quote" />
        <input type="hidden" name="quote" value="1" />
        <input name="postalCode" defaultValue={filters.postalCode ?? "28001"} placeholder="Codigo postal" />
        <input name="city" defaultValue={filters.city ?? "Madrid"} placeholder="Ciudad" />
        <input name="state" defaultValue={filters.state ?? context.country} placeholder="Estado/provincia" />
        <input name="country" defaultValue={filters.country ?? context.country} placeholder="Pais" />
        <input name="variantId" defaultValue={filters.variantId ?? "simulated-variant"} placeholder="variantId" />
        <input name="quantity" defaultValue={filters.quantity ?? "1"} type="number" min={1} placeholder="Cantidad" />
        <input name="priceMinor" defaultValue={filters.priceMinor ?? "4000"} type="number" min={0} placeholder="Precio item minor" />
        <input name="itemsSubtotalMinor" defaultValue={filters.itemsSubtotalMinor ?? ""} type="number" min={0} placeholder="Subtotal minor" />
        <input name="weightGrams" defaultValue={filters.weightGrams ?? "1500"} type="number" min={0} placeholder="Peso g" />
        <input name="widthMm" defaultValue={filters.widthMm ?? ""} type="number" min={0} placeholder="Ancho mm" />
        <input name="heightMm" defaultValue={filters.heightMm ?? ""} type="number" min={0} placeholder="Alto mm" />
        <input name="depthMm" defaultValue={filters.depthMm ?? ""} type="number" min={0} placeholder="Profundidad mm" />
        <input name="customerGroupId" defaultValue={filters.customerGroupId ?? ""} placeholder="customerGroupId" />
        <button className="adminButton adminButtonPrimary" type="submit">Calcular opciones</button>
      </form>
    </section>
  );
}

function QuoteResult({ data }: { data: ShippingAdminData }) {
  const quote = data.quote;

  if (!quote) {
    return (
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <h2>Resultado</h2>
        </div>
        <p className="adminContextHint">Completa el formulario y calcula para ver SLAs aplicables.</p>
      </section>
    );
  }

  if (quote.source === "unavailable") {
    return (
      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <h2>Resultado</h2>
        </div>
        <ResultBanner result={quote} />
      </section>
    );
  }

  return (
    <section className="pricingPanel">
      <div className="pricingPanelHeader">
        <h2>Resultado</h2>
        <p>{quote.data.calculatedAt ?? "calculado"}</p>
      </div>
      <div className="pricingEditorContext">
        <span><strong>Destino:</strong> {valueText(quote.data.selectedAddress.postalCode)} / {valueText(quote.data.selectedAddress.country)}</span>
        <span><strong>Moneda:</strong> {quote.data.currency}</span>
        <span><strong>Items:</strong> {quote.data.logisticsInfo.length}</span>
      </div>
      {quote.data.logisticsInfo.flatMap((info) => info.slas.map((sla) => ({ info, sla }))).length === 0 ? (
        <p className="adminContextHint">Shipping no devolvio opciones para el contexto simulado.</p>
      ) : (
        <div className="adminTableScroller">
          <table className="adminTable pricingTable">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">SLA</th>
                <th scope="col">Carrier</th>
                <th scope="col">Servicio</th>
                <th scope="col">Canal</th>
                <th scope="col">Estimacion</th>
                <th scope="col">Precio</th>
                <th scope="col">Tax</th>
                <th scope="col">Total</th>
                <th scope="col">Warehouse</th>
              </tr>
            </thead>
            <tbody>
              {quote.data.logisticsInfo.flatMap((info) =>
                info.slas.map((sla, index) => (
                  <tr key={`${info.itemIndex}-${String(sla.id ?? index)}`}>
                    <td>{info.itemId || info.itemIndex}</td>
                    <td>{valueText(sla.name ?? sla.id)}</td>
                    <td>{valueText(sla.carrierId)}</td>
                    <td>{valueText(sla.carrierServiceId)}</td>
                    <td>{valueText(sla.deliveryChannel)}</td>
                    <td>{valueText(sla.shippingEstimate ?? sla.transitTime)}</td>
                    <td>{valueText(sla.priceMinor)}</td>
                    <td>{valueText(sla.taxMinor)}</td>
                    <td>{valueText(sla.totalMinor)}</td>
                    <td>{valueText(sla.warehouseId)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ZoneForm({ record }: { record?: ShippingRecord }) {
  return (
    <form action={upsertShippingZoneAction} className="pricingDenseForm">
      <input name="zoneId" defaultValue={stringValue(record ?? {}, "zoneId")} placeholder="zoneId" />
      <input name="name" defaultValue={stringValue(record ?? {}, "name")} placeholder="Nombre" />
      <input name="countries" defaultValue={stringValue(record ?? {}, "countries")} placeholder="Paises: ES, FR" />
      <input name="states" defaultValue={stringValue(record ?? {}, "states")} placeholder="Estados/provincias" />
      <input name="postalCodePrefixes" defaultValue={stringValue(record ?? {}, "postalCodePrefixes")} placeholder="Prefijos CP" />
      <select name="active" defaultValue={boolValue(record ?? {}, "active")}>
        <option value="true">Activa</option>
        <option value="false">Inactiva</option>
      </select>
      <button className="adminButton adminButtonPrimary" type="submit">Guardar zona</button>
    </form>
  );
}

function CarrierForm({ record }: { record?: ShippingRecord }) {
  return (
    <form action={upsertShippingCarrierAction} className="pricingDenseForm">
      <input name="carrierId" defaultValue={stringValue(record ?? {}, "carrierId")} placeholder="carrierId" />
      <input name="name" defaultValue={stringValue(record ?? {}, "name")} placeholder="Nombre" />
      <input name="trackingUrlTemplate" defaultValue={stringValue(record ?? {}, "trackingUrlTemplate")} placeholder="Tracking URL template" />
      <input name="logoUrl" defaultValue={stringValue(record ?? {}, "logoUrl")} placeholder="Logo URL" />
      <select name="active" defaultValue={boolValue(record ?? {}, "active")}>
        <option value="true">Activo</option>
        <option value="false">Inactivo</option>
      </select>
      <button className="adminButton adminButtonPrimary" type="submit">Guardar transportista</button>
    </form>
  );
}

function ServiceForm({
  record,
  carriers,
}: {
  record?: ShippingRecord;
  carriers: ShippingRecord[];
}) {
  const carrierId = stringValue(record ?? {}, "carrierId");

  return (
    <form action={upsertShippingCarrierServiceAction} className="pricingDenseForm">
      <input name="carrierServiceId" defaultValue={stringValue(record ?? {}, "carrierServiceId")} placeholder="carrierServiceId" />
      <select name="carrierId" defaultValue={carrierId}>
        <option value="">Transportista</option>
        {carriers.map((carrier, index) => {
          const id = String(carrier.carrierId ?? "");
          return id ? <option value={id} key={id}>{String(carrier.name ?? id)}</option> : <option disabled key={`carrier-${index}`}>Sin carrierId</option>;
        })}
      </select>
      <input name="name" defaultValue={stringValue(record ?? {}, "name")} placeholder="Nombre del servicio" />
      <select name="deliveryChannel" defaultValue={stringValue(record ?? {}, "deliveryChannel") || "delivery"}>
        <option value="delivery">delivery</option>
        <option value="pickup-in-point">pickup-in-point</option>
      </select>
      <select name="ratingBasis" defaultValue={stringValue(record ?? {}, "ratingBasis") || "WEIGHT"}>
        <option value="WEIGHT">WEIGHT</option>
        <option value="PRICE">PRICE</option>
      </select>
      <input name="transitTimeLabel" defaultValue={stringValue(record ?? {}, "transitTimeLabel") || "3-5bd"} placeholder="3-5bd" />
      <input name="estimateBusinessDays" defaultValue={stringValue(record ?? {}, "estimateBusinessDays") || "3"} type="number" min={0} placeholder="Dias" />
      <input name="handlingFeeMinor" defaultValue={stringValue(record ?? {}, "handlingFeeMinor") || "0"} type="number" min={0} placeholder="Manipulacion minor" />
      <input name="maxWeightGrams" defaultValue={stringValue(record ?? {}, "maxWeightGrams")} type="number" min={0} placeholder="Peso max g" />
      <input name="maxWidthMm" defaultValue={stringValue(record ?? {}, "maxWidthMm")} type="number" min={0} placeholder="Ancho max mm" />
      <input name="maxHeightMm" defaultValue={stringValue(record ?? {}, "maxHeightMm")} type="number" min={0} placeholder="Alto max mm" />
      <input name="maxDepthMm" defaultValue={stringValue(record ?? {}, "maxDepthMm")} type="number" min={0} placeholder="Profundidad max mm" />
      <input name="customerGroupIds" defaultValue={stringValue(record ?? {}, "customerGroupIds")} placeholder="Customer groups" />
      <select name="active" defaultValue={boolValue(record ?? {}, "active")}>
        <option value="true">Activo</option>
        <option value="false">Inactivo</option>
      </select>
      <button className="adminButton adminButtonPrimary" type="submit">Guardar servicio</button>
    </form>
  );
}

function RateRuleForm({
  record,
  zones,
  services,
  currency,
}: {
  record?: ShippingRecord;
  zones: ShippingRecord[];
  services: ShippingRecord[];
  currency: string;
}) {
  return (
    <form action={upsertShippingRateRuleAction} className="pricingDenseForm">
      <input name="shippingRateRuleId" defaultValue={stringValue(record ?? {}, "shippingRateRuleId")} placeholder="shippingRateRuleId" />
      <select name="carrierServiceId" defaultValue={stringValue(record ?? {}, "carrierServiceId")}>
        <option value="">Servicio</option>
        {services.map((service, index) => {
          const id = String(service.carrierServiceId ?? "");
          return id ? <option value={id} key={id}>{String(service.name ?? id)}</option> : <option disabled key={`service-${index}`}>Sin serviceId</option>;
        })}
      </select>
      <select name="zoneId" defaultValue={stringValue(record ?? {}, "zoneId")}>
        <option value="">Zona</option>
        {zones.map((zone, index) => {
          const id = String(zone.zoneId ?? "");
          return id ? <option value={id} key={id}>{String(zone.name ?? id)}</option> : <option disabled key={`zone-${index}`}>Sin zoneId</option>;
        })}
      </select>
      <select name="ratingBasis" defaultValue={stringValue(record ?? {}, "ratingBasis") || "WEIGHT"}>
        <option value="WEIGHT">WEIGHT</option>
        <option value="PRICE">PRICE</option>
      </select>
      <input name="minWeightGrams" defaultValue={stringValue(record ?? {}, "minWeightGrams")} type="number" min={0} placeholder="Min peso g" />
      <input name="maxWeightGrams" defaultValue={stringValue(record ?? {}, "maxWeightGrams")} type="number" min={0} placeholder="Max peso g" />
      <input name="minOrderAmountMinor" defaultValue={stringValue(record ?? {}, "minOrderAmountMinor")} type="number" min={0} placeholder="Min pedido minor" />
      <input name="maxOrderAmountMinor" defaultValue={stringValue(record ?? {}, "maxOrderAmountMinor")} type="number" min={0} placeholder="Max pedido minor" />
      <input name="priceMinor" defaultValue={stringValue(record ?? {}, "priceMinor") || "0"} type="number" min={0} placeholder="Precio minor" />
      <input name="currency" defaultValue={stringValue(record ?? {}, "currency") || currency} placeholder="EUR" />
      <input name="taxRateBasisPoints" defaultValue={stringValue(record ?? {}, "taxRateBasisPoints") || "0"} type="number" min={0} placeholder="Tax bps" />
      <input name="freeShippingThresholdMinor" defaultValue={stringValue(record ?? {}, "freeShippingThresholdMinor")} type="number" min={0} placeholder="Gratis desde minor" />
      <select name="outOfRangeBehavior" defaultValue={stringValue(record ?? {}, "outOfRangeBehavior") || "DISABLE_CARRIER"}>
        <option value="DISABLE_CARRIER">DISABLE_CARRIER</option>
        <option value="HIGHEST_RATE">HIGHEST_RATE</option>
      </select>
      <input name="priority" defaultValue={stringValue(record ?? {}, "priority") || "10"} type="number" min={0} placeholder="Prioridad" />
      <select name="active" defaultValue={boolValue(record ?? {}, "active")}>
        <option value="true">Activa</option>
        <option value="false">Inactiva</option>
      </select>
      <button className="adminButton adminButtonPrimary" type="submit">Guardar regla</button>
    </form>
  );
}

export function ShippingAdminPage({ context, data, filters }: ShippingAdminPageProps) {
  const configuration = data.configuration.data;
  const activeTab = filters.tab;

  if (!hasRequiredAdminContext(context)) {
    return (
      <main className="adminPage">
        <div className="adminBreadcrumb">Admin / Transporte</div>
        <div className="adminBanner adminBannerError">
          <p>Selecciona Organization y Shop antes de configurar transporte.</p>
          <Link className="adminButton" href="/admin/configuracion/contexto">Ir a contexto</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="adminPage pricingAdminPage">
      <div className="adminBreadcrumb">Admin / Transporte</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Transporte</h1>
          <p className="adminPageIntro">Configuracion global de transportistas, zonas, servicios y reglas tarifarias para Shipping/Logistics.</p>
        </div>
        <Link className="adminButton" href="/admin/products">Volver a productos</Link>
      </div>
      <div className="adminContextHint">
        {context.organizationId} / {context.shopId} / {context.currency} / {context.country} / {context.channel}
      </div>
      {filters.shippingMessage ? <div className="adminBanner"><p>{filters.shippingMessage}</p></div> : null}

      <nav className="adminTabs pricingTabs" aria-label="Transporte">
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

      <ShippingFilters filters={filters} />

      {activeTab === "summary" ? (
        <div className="pricingGridTwo">
          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <h2>Resumen</h2>
              <p>{data.configuration.source === "bff" ? "BFF conectado" : "BFF no disponible"}</p>
            </div>
            <ResultBanner result={data.configuration} />
            <div className="productPriceSummary productPriceSummaryWide">
              <strong>{configuration.zones.length}</strong>
              <span>Zonas</span>
              <strong>{configuration.carriers.length}</strong>
              <span>Transportistas</span>
              <strong>{configuration.carrierServices.length}</strong>
              <span>Servicios</span>
              <strong>{configuration.rateRules.length}</strong>
              <span>Reglas</span>
              <strong>{filters.includeInactive ? "Si" : "No"}</strong>
              <span>Incluye inactivos</span>
            </div>
          </section>
          <section className="pricingPanel">
            <div className="pricingPanelHeader">
              <h2>Crear rapido</h2>
            </div>
            <p className="adminContextHint">Usa las pestanas para crear o editar recursos. Los cambios se guardan por recurso en Shipping/Logistics.</p>
          </section>
        </div>
      ) : null}

      {activeTab === "zones" ? (
        <>
          <section className="pricingPanel">
            <div className="pricingPanelHeader"><h2>Crear zona</h2></div>
            <ZoneForm />
          </section>
          <RecordTable title="Zonas" result={data.configuration} rows={configuration.zones} columns={["zoneId", "name", "countries", "states", "postalCodePrefixes", "active"]} empty="No hay zonas configuradas." actions={(record) => <ZoneForm record={record} />} />
        </>
      ) : null}

      {activeTab === "carriers" ? (
        <>
          <section className="pricingPanel">
            <div className="pricingPanelHeader"><h2>Crear transportista</h2></div>
            <CarrierForm />
          </section>
          <RecordTable title="Transportistas" result={data.configuration} rows={configuration.carriers} columns={["carrierId", "name", "trackingUrlTemplate", "logoUrl", "active"]} empty="No hay transportistas configurados." actions={(record) => <CarrierForm record={record} />} />
        </>
      ) : null}

      {activeTab === "services" ? (
        <>
          <section className="pricingPanel">
            <div className="pricingPanelHeader"><h2>Crear servicio</h2></div>
            <ServiceForm carriers={configuration.carriers} />
          </section>
          <RecordTable title="Servicios de transportista" result={data.configuration} rows={configuration.carrierServices} columns={["carrierServiceId", "carrierId", "name", "deliveryChannel", "ratingBasis", "transitTimeLabel", "estimateBusinessDays", "handlingFeeMinor", "active"]} empty="No hay servicios configurados." actions={(record) => <ServiceForm record={record} carriers={configuration.carriers} />} />
        </>
      ) : null}

      {activeTab === "rules" ? (
        <>
          <section className="pricingPanel">
            <div className="pricingPanelHeader"><h2>Crear regla tarifaria</h2></div>
            <RateRuleForm zones={configuration.zones} services={configuration.carrierServices} currency={context.currency} />
          </section>
          <RecordTable title="Reglas tarifarias" result={data.configuration} rows={configuration.rateRules} columns={["shippingRateRuleId", "carrierServiceId", "zoneId", "ratingBasis", "minWeightGrams", "maxWeightGrams", "minOrderAmountMinor", "maxOrderAmountMinor", "priceMinor", "currency", "taxRateBasisPoints", "freeShippingThresholdMinor", "outOfRangeBehavior", "priority", "active"]} empty="No hay reglas tarifarias configuradas." actions={(record) => <RateRuleForm record={record} zones={configuration.zones} services={configuration.carrierServices} currency={context.currency} />} />
        </>
      ) : null}

      {activeTab === "quote" ? (
        <>
          <QuoteSimulatorForm filters={filters} context={context} />
          <QuoteResult data={data} />
        </>
      ) : null}
    </main>
  );
}
