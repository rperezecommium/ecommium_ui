import Link from "next/link";
import { CreditCard, GitBranch, Landmark, Radar, ReceiptText, Route } from "lucide-react";
import type { InvoiceAdminCapabilities, InvoiceAdminData, InvoiceAdminFilters } from "./invoices-admin";
import { InvoicesAdminPage } from "./invoices-admin-page";
import type {
  PaymentAffiliationAdminRecord,
  PaymentRuleAdminRecord,
  PaymentSystemAdminRecord,
  PaymentsAdminCapabilities,
  PaymentsAdminData,
  PaymentsAdminFilters,
  PaymentsAdminTab,
} from "./payments-admin";
import {
  createPaymentAffiliationAction,
  createPaymentRuleAction,
  createPaymentSystemAction,
  setPaymentResourceActiveAction,
} from "./payments-admin-actions";

type Props = {
  invoiceCapabilities: InvoiceAdminCapabilities;
  invoiceData: InvoiceAdminData;
  invoiceFilters: InvoiceAdminFilters;
  paymentsCapabilities: PaymentsAdminCapabilities;
  paymentsData: PaymentsAdminData;
  paymentsFilters: PaymentsAdminFilters;
};

const tabs: Array<{ href: PaymentsAdminTab; icon: typeof CreditCard; label: string }> = [
  { href: "facturas", icon: ReceiptText, label: "Facturas" },
  { href: "metodos", icon: CreditCard, label: "Metodos" },
  { href: "afiliaciones", icon: Landmark, label: "Afiliaciones" },
  { href: "reglas", icon: GitBranch, label: "Reglas" },
  { href: "diagnostico", icon: Radar, label: "Diagnostico" },
];

function activeTab(filters: PaymentsAdminFilters): PaymentsAdminTab {
  return tabs.some((tab) => tab.href === filters.tab) ? filters.tab as PaymentsAdminTab : "facturas";
}

function valueText(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return "-";
}

function badge(active: boolean) {
  return active ? "adminBadge adminBadgeOk" : "adminBadge adminBadgeWarn";
}

function ResultBanner({ result }: { result: { ok: boolean; error?: string } }) {
  if (result.ok) {
    return null;
  }

  return (
    <div className="adminBanner adminBannerError">
      <p>{result.error}</p>
    </div>
  );
}

function tabHref(tab: PaymentsAdminTab, includeInactive: boolean) {
  const params = new URLSearchParams({ tab });
  if (includeInactive) {
    params.set("includeInactive", "true");
  }
  return `/admin/pagos?${params.toString()}`;
}

function PaymentsTabs({ current, includeInactive }: { current: PaymentsAdminTab; includeInactive: boolean }) {
  return (
    <div className="adminButtonRow">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            className={`adminButton ${current === tab.href ? "adminButtonPrimary" : ""}`}
            href={tabHref(tab.href, includeInactive)}
            key={tab.href}
          >
            <Icon aria-hidden="true" size={16} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function PaymentsToolbar({ current, includeInactive }: { current: PaymentsAdminTab; includeInactive: boolean }) {
  const nextParams = new URLSearchParams({ tab: current });
  if (!includeInactive) {
    nextParams.set("includeInactive", "true");
  }

  return (
    <div className="adminButtonRow">
      <Link className="adminButton" href={`/admin/pagos?${nextParams.toString()}`}>
        {includeInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
      </Link>
    </div>
  );
}

function PaymentsKpis({ data }: { data: PaymentsAdminData }) {
  const methods = data.paymentSystems.ok ? data.paymentSystems.data : [];
  const affiliations = data.affiliations.ok ? data.affiliations.data : [];
  const rules = data.rules.ok ? data.rules.data : [];

  return (
    <section className="adminKpiGrid">
      <div className="adminKpi">
        <span>Metodos activos</span>
        <strong>{methods.filter((item) => item.active).length}</strong>
        <p>{methods.length} configurados</p>
      </div>
      <div className="adminKpi">
        <span>Afiliaciones</span>
        <strong>{affiliations.filter((item) => item.active).length}</strong>
        <p>PayPal, Stripe u otros PSP</p>
      </div>
      <div className="adminKpi">
        <span>Reglas activas</span>
        <strong>{rules.filter((item) => item.active).length}</strong>
        <p>Routing por pais, moneda y prioridad</p>
      </div>
      <div className="adminKpi">
        <span>Contexto</span>
        <strong>{data.context.shopAlias || data.context.shopId || "-"}</strong>
        <p>{data.context.currency} / {data.context.country}</p>
      </div>
    </section>
  );
}

function StatusActionForm({
  active,
  canManage,
  id,
  includeInactive,
  resource,
  tab,
}: {
  active: boolean;
  canManage: boolean;
  id: string;
  includeInactive: boolean;
  resource: "payment-systems" | "affiliations" | "rules";
  tab: PaymentsAdminTab;
}) {
  if (!canManage) {
    return null;
  }

  return (
    <form action={setPaymentResourceActiveAction}>
      <input name="tab" type="hidden" value={tab} />
      <input name="resource" type="hidden" value={resource} />
      <input name="id" type="hidden" value={id} />
      <input name="active" type="hidden" value={active ? "false" : "true"} />
      <input name="includeInactive" type="hidden" value={includeInactive ? "true" : "false"} />
      <button className="adminButton" type="submit">{active ? "Desactivar" : "Reactivar"}</button>
    </form>
  );
}

function PaymentSystemsTable({
  canManage,
  includeInactive,
  items,
}: {
  canManage: boolean;
  includeInactive: boolean;
  items: PaymentSystemAdminRecord[];
}) {
  if (!items.length) {
    return <div className="adminEmptyState">No hay metodos de pago configurados.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th>Metodo</th>
            <th>Provider</th>
            <th>Grupo</th>
            <th>Tipo</th>
            <th>Cuotas</th>
            <th>Estado</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.paymentSystemId}>
              <td><strong>{item.name}</strong><div className="adminMuted">{item.paymentSystemId}</div></td>
              <td>{valueText(item.provider)}</td>
              <td>{valueText(item.groupName)}</td>
              <td>{valueText(item.methodType)}</td>
              <td>{item.supportsInstallments ? valueText(item.maxInstallments) : "No"}</td>
              <td><span className={badge(item.active)}>{item.active ? "Activo" : "Inactivo"}</span></td>
              <td>
                <StatusActionForm
                  active={item.active}
                  canManage={canManage}
                  id={item.paymentSystemId}
                  includeInactive={includeInactive}
                  resource="payment-systems"
                  tab="metodos"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AffiliationsTable({
  canManage,
  includeInactive,
  items,
}: {
  canManage: boolean;
  includeInactive: boolean;
  items: PaymentAffiliationAdminRecord[];
}) {
  if (!items.length) {
    return <div className="adminEmptyState">No hay afiliaciones PSP configuradas.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th>Afiliacion</th>
            <th>Provider</th>
            <th>Merchant</th>
            <th>Estado</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.affiliationId}>
              <td><strong>{item.name}</strong><div className="adminMuted">{item.affiliationId}</div></td>
              <td>{valueText(item.provider)}</td>
              <td>{valueText(item.merchantId)}</td>
              <td><span className={badge(item.active)}>{item.active ? "Activa" : "Inactiva"}</span></td>
              <td>
                <StatusActionForm
                  active={item.active}
                  canManage={canManage}
                  id={item.affiliationId}
                  includeInactive={includeInactive}
                  resource="affiliations"
                  tab="afiliaciones"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RulesTable({
  canManage,
  includeInactive,
  items,
}: {
  canManage: boolean;
  includeInactive: boolean;
  items: PaymentRuleAdminRecord[];
}) {
  if (!items.length) {
    return <div className="adminEmptyState">No hay reglas de routing de pagos.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable">
        <thead>
          <tr>
            <th>Regla</th>
            <th>Prioridad</th>
            <th>Metodo</th>
            <th>Afiliacion</th>
            <th>Pais/moneda</th>
            <th>Rango</th>
            <th>Estado</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.ruleId}>
              <td><strong>{item.name}</strong><div className="adminMuted">{item.ruleId}</div></td>
              <td>{valueText(item.priority)}</td>
              <td>{valueText(item.paymentSystemId)}</td>
              <td>{valueText(item.affiliationId)}</td>
              <td>{valueText(item.country)} / {valueText(item.currency)}</td>
              <td>{valueText(item.minValueMinor)} - {valueText(item.maxValueMinor)}</td>
              <td><span className={badge(item.active)}>{item.active ? "Activa" : "Inactiva"}</span></td>
              <td>
                <StatusActionForm
                  active={item.active}
                  canManage={canManage}
                  id={item.ruleId}
                  includeInactive={includeInactive}
                  resource="rules"
                  tab="reglas"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreatePaymentSystemForm({ canManage }: { canManage: boolean }) {
  if (!canManage) {
    return null;
  }

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Nuevo metodo</h2>
          <p>Define solo metodos instalados y soportados por Payments.</p>
        </div>
        <CreditCard aria-hidden="true" size={18} />
      </div>
      <form action={createPaymentSystemAction} className="pricingDenseForm">
        <label className="adminField"><span>ID</span><input name="paymentSystemId" placeholder="stripe-card" required /></label>
        <label className="adminField"><span>Nombre</span><input name="name" placeholder="Tarjeta" required /></label>
        <label className="adminField"><span>Provider</span><select name="provider" required><option value="stripe">Stripe</option><option value="paypal">PayPal</option></select></label>
        <label className="adminField"><span>Grupo</span><input name="groupName" placeholder="cards" /></label>
        <label className="adminField"><span>Tipo</span><input name="methodType" placeholder="CREDIT_CARD" /></label>
        <label className="adminField"><span>Max cuotas</span><input name="maxInstallments" min="1" type="number" /></label>
        <label className="adminCheckbox"><input name="supportsInstallments" type="checkbox" /> Permite cuotas</label>
        <label className="adminCheckbox"><input defaultChecked name="active" type="checkbox" /> Activo</label>
        <button className="adminButton adminButtonPrimary" type="submit">Crear metodo</button>
      </form>
    </section>
  );
}

function CreateAffiliationForm({ canManage }: { canManage: boolean }) {
  if (!canManage) {
    return null;
  }

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Nueva afiliacion</h2>
          <p>Guarda referencias operativas; los secretos pertenecen al BFF/Payments.</p>
        </div>
        <Landmark aria-hidden="true" size={18} />
      </div>
      <form action={createPaymentAffiliationAction} className="pricingDenseForm">
        <label className="adminField"><span>ID</span><input name="affiliationId" placeholder="stripe-main" required /></label>
        <label className="adminField"><span>Nombre</span><input name="name" placeholder="Stripe principal" required /></label>
        <label className="adminField"><span>Provider</span><select name="provider" required><option value="stripe">Stripe</option><option value="paypal">PayPal</option></select></label>
        <label className="adminField"><span>Merchant</span><input name="merchantId" placeholder="acct_..." /></label>
        <label className="adminCheckbox"><input defaultChecked name="active" type="checkbox" /> Activa</label>
        <button className="adminButton adminButtonPrimary" type="submit">Crear afiliacion</button>
      </form>
    </section>
  );
}

function CreateRuleForm({ canManage, data }: { canManage: boolean; data: PaymentsAdminData }) {
  if (!canManage) {
    return null;
  }

  const systems = data.paymentSystems.ok ? data.paymentSystems.data : [];
  const affiliations = data.affiliations.ok ? data.affiliations.data : [];

  return (
    <section className="adminCard">
      <div className="adminCardHeader">
        <div>
          <h2>Nueva regla</h2>
          <p>Routing por prioridad, contexto comercial y afiliacion PSP.</p>
        </div>
        <Route aria-hidden="true" size={18} />
      </div>
      <form action={createPaymentRuleAction} className="pricingDenseForm">
        <label className="adminField"><span>ID</span><input name="ruleId" placeholder="stripe-es-eur" required /></label>
        <label className="adminField"><span>Nombre</span><input name="name" placeholder="Stripe ES EUR" required /></label>
        <label className="adminField"><span>Metodo</span><select name="paymentSystemId" required>{systems.map((item) => <option key={item.paymentSystemId} value={item.paymentSystemId}>{item.name}</option>)}</select></label>
        <label className="adminField"><span>Afiliacion</span><select name="affiliationId" required>{affiliations.map((item) => <option key={item.affiliationId} value={item.affiliationId}>{item.name}</option>)}</select></label>
        <label className="adminField"><span>Prioridad</span><input defaultValue="100" name="priority" type="number" /></label>
        <label className="adminField"><span>Pais</span><input defaultValue={data.context.country} name="country" /></label>
        <label className="adminField"><span>Moneda</span><input defaultValue={data.context.currency} name="currency" /></label>
        <label className="adminField"><span>Min menor</span><input name="minValueMinor" type="number" /></label>
        <label className="adminField"><span>Max menor</span><input name="maxValueMinor" type="number" /></label>
        <label className="adminCheckbox"><input defaultChecked name="active" type="checkbox" /> Activa</label>
        <button className="adminButton adminButtonPrimary" type="submit">Crear regla</button>
      </form>
    </section>
  );
}

function MethodsPanel({
  capabilities,
  data,
  includeInactive,
}: {
  capabilities: PaymentsAdminCapabilities;
  data: PaymentsAdminData;
  includeInactive: boolean;
}) {
  return (
    <div className="adminGrid">
      <section className="adminCard">
        <div className="adminCardHeader"><div><h2>Metodos de pago</h2><p>Storefront mostrara solo metodos activos instalados.</p></div></div>
        {!data.paymentSystems.ok ? (
          <ResultBanner result={data.paymentSystems} />
        ) : (
          <PaymentSystemsTable
            canManage={capabilities.canManagePayments}
            includeInactive={includeInactive}
            items={data.paymentSystems.data}
          />
        )}
      </section>
      <CreatePaymentSystemForm canManage={capabilities.canManagePayments} />
    </div>
  );
}

function AffiliationsPanel({
  capabilities,
  data,
  includeInactive,
}: {
  capabilities: PaymentsAdminCapabilities;
  data: PaymentsAdminData;
  includeInactive: boolean;
}) {
  return (
    <div className="adminGrid">
      <section className="adminCard">
        <div className="adminCardHeader"><div><h2>Afiliaciones PSP</h2><p>Conectores operativos para Stripe, PayPal y futuros providers.</p></div></div>
        {!data.affiliations.ok ? (
          <ResultBanner result={data.affiliations} />
        ) : (
          <AffiliationsTable
            canManage={capabilities.canManagePayments}
            includeInactive={includeInactive}
            items={data.affiliations.data}
          />
        )}
      </section>
      <CreateAffiliationForm canManage={capabilities.canManagePayments} />
    </div>
  );
}

function RulesPanel({
  capabilities,
  data,
  includeInactive,
}: {
  capabilities: PaymentsAdminCapabilities;
  data: PaymentsAdminData;
  includeInactive: boolean;
}) {
  return (
    <div className="adminGrid">
      <section className="adminCard">
        <div className="adminCardHeader"><div><h2>Reglas de routing</h2><p>Prioridad por metodo, afiliacion, pais, moneda e importe.</p></div></div>
        {!data.rules.ok ? (
          <ResultBanner result={data.rules} />
        ) : (
          <RulesTable
            canManage={capabilities.canManagePayments}
            includeInactive={includeInactive}
            items={data.rules.data}
          />
        )}
      </section>
      <CreateRuleForm canManage={capabilities.canManagePayments} data={data} />
    </div>
  );
}

function DiagnosticsPanel({ data, filters }: { data: PaymentsAdminData; filters: PaymentsAdminFilters }) {
  return (
    <div className="adminGrid">
      <section className="adminCard">
        <div className="adminCardHeader"><div><h2>Lookup de tarjeta</h2><p>Valida BIN contra Payments sin tocar datos PAN/CVV.</p></div><Radar aria-hidden="true" size={18} /></div>
        <form className="pricingDenseForm">
          <input name="tab" type="hidden" value="diagnostico" />
          <label className="adminField"><span>BIN</span><input name="cardBin" placeholder="424242" defaultValue={filters.cardBin ?? ""} /></label>
          <button className="adminButton adminButtonPrimary" type="submit">Consultar</button>
        </form>
        {!data.cardLookup.ok ? <ResultBanner result={data.cardLookup} /> : null}
        {data.cardLookup.ok && data.cardLookup.data ? (
          <dl className="adminDefinitionList">
            <div><dt>BIN</dt><dd>{valueText(data.cardLookup.data.bin ?? filters.cardBin)}</dd></div>
            <div><dt>Marca</dt><dd>{valueText(data.cardLookup.data.brand)}</dd></div>
            <div><dt>Metodos compatibles</dt><dd>{data.cardLookup.data.paymentSystems.map((item) => item.name).join(", ") || "-"}</dd></div>
          </dl>
        ) : (
          <div className="adminEmptyState">Introduce un BIN para comprobar routing de tarjeta.</div>
        )}
      </section>
      <section className="adminCard">
        <div className="adminCardHeader"><div><h2>Seguridad operativa</h2><p>La UI no captura PAN/CVV ni expone secretos PSP.</p></div></div>
        <ul className="adminStatusList">
          <li>PayPal y Stripe se operan mediante Payments/BFF.</li>
          <li>Los secretos quedan fuera de variables NEXT_PUBLIC.</li>
          <li>Storefront consume payment-systems activos por tenant.</li>
          <li>Return/cancel usa correlationId, intento local minimo e idempotencia.</li>
        </ul>
      </section>
    </div>
  );
}

export function PaymentsAdminPage({
  invoiceCapabilities,
  invoiceData,
  invoiceFilters,
  paymentsCapabilities,
  paymentsData,
  paymentsFilters,
}: Props) {
  const current = activeTab(paymentsFilters);
  const includeInactive = paymentsFilters.includeInactive === "true";

  return (
    <main className="adminPage">
      <div className="adminBreadcrumb">Admin / Pagos</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Pagos</h1>
          <p className="adminPageIntro">Configura metodos, afiliaciones y reglas Payments; conserva la consola fiscal en Facturas.</p>
        </div>
      </div>
      {paymentsFilters.notice ? (
        <div className="adminBanner adminBannerSuccess">
          <p>{paymentsFilters.notice}</p>
        </div>
      ) : null}
      <PaymentsTabs current={current} includeInactive={includeInactive} />
      <PaymentsToolbar current={current} includeInactive={includeInactive} />
      <PaymentsKpis data={paymentsData} />
      {current === "facturas" ? (
        <InvoicesAdminPage capabilities={invoiceCapabilities} data={invoiceData} embedded filters={invoiceFilters} />
      ) : null}
      {current === "metodos" ? (
        <MethodsPanel capabilities={paymentsCapabilities} data={paymentsData} includeInactive={includeInactive} />
      ) : null}
      {current === "afiliaciones" ? (
        <AffiliationsPanel capabilities={paymentsCapabilities} data={paymentsData} includeInactive={includeInactive} />
      ) : null}
      {current === "reglas" ? (
        <RulesPanel capabilities={paymentsCapabilities} data={paymentsData} includeInactive={includeInactive} />
      ) : null}
      {current === "diagnostico" ? <DiagnosticsPanel data={paymentsData} filters={paymentsFilters} /> : null}
    </main>
  );
}
