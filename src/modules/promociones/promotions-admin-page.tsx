import Link from "next/link";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import {
  createPromotionCouponAction,
  deletePromotionCouponAction,
  hardDeletePromotionCouponAction,
  updatePromotionCouponAction,
} from "./promotions-admin-actions";
import type {
  PromotionCoupon,
  PromotionsAdminData,
  PromotionsAdminFilters,
} from "./promotions-admin";

type PromotionsAdminPageProps = {
  context: AdminContext;
  data: PromotionsAdminData;
  filters: PromotionsAdminFilters;
};

const cartRuleFields = [
  "Codigo de cupon",
  "Nombre",
  "Descuento",
  "Compra minima",
  "Vigencia",
  "Estado",
  "Acciones",
];

function promotionsHref(filters: PromotionsAdminFilters, overrides: Partial<PromotionsAdminFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.status && next.status !== "active") params.set("status", next.status);
  if (next.promotionMessage) params.set("promotionMessage", next.promotionMessage);
  if (next.drawer) params.set("drawer", next.drawer);
  if (next.couponCode) params.set("couponCode", next.couponCode);
  const query = params.toString();

  return query ? `/admin/promociones?${query}` : "/admin/promociones";
}

function moneyMinor(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(value / 100);
}

function valueText(coupon: PromotionCoupon) {
  return coupon.discountType === "FIXED"
    ? moneyMinor(coupon.value, coupon.currency)
    : `${coupon.value}%`;
}

function discountTypeText(coupon: PromotionCoupon) {
  return coupon.discountType === "FIXED" ? "Importe fijo" : "Porcentaje";
}

function dateText(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function inputDateValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function ResultBanner({ data }: { data: PromotionsAdminData }) {
  const result = data.coupons;
  if (result.source === "bff") {
    return null;
  }

  return (
    <div className="adminBanner adminBannerError">
      <p>{result.message ?? "Promotions no esta disponible."}</p>
      {result.failedEndpoint ? <p className="adminContextHint">{result.failedEndpoint}</p> : null}
      {result.correlationId ? <p className="adminContextHint">Correlation: {result.correlationId}</p> : null}
    </div>
  );
}

function CouponForm({
  coupon,
  filters,
}: {
  coupon?: PromotionCoupon;
  filters: PromotionsAdminFilters;
}) {
  const isEditing = Boolean(coupon);
  const action = isEditing ? updatePromotionCouponAction : createPromotionCouponAction;

  return (
    <form action={action} className="pricingDenseForm">
      <input type="hidden" name="q" value={filters.q ?? ""} />
      <input type="hidden" name="status" value={filters.status ?? "active"} />
      <label className="adminField">
        <span>Codigo</span>
        <input
          name="couponCode"
          defaultValue={coupon?.couponCode ?? ""}
          disabled={isEditing}
          placeholder="WELCOME10"
        />
      </label>
      {coupon ? <input type="hidden" name="couponCode" value={coupon.couponCode} /> : null}
      <label className="adminField">
        <span>Nombre</span>
        <input name="name" defaultValue={coupon?.name ?? ""} placeholder="Bienvenida 10%" />
      </label>
      <label className="adminField">
        <span>Tipo</span>
        <select name="discountType" defaultValue={coupon?.discountType ?? "PERCENTAGE"}>
          <option value="PERCENTAGE">Porcentaje</option>
          <option value="FIXED">Importe fijo</option>
        </select>
      </label>
      <label className="adminField">
        <span>Valor</span>
        <input name="value" type="number" step="0.01" min="0" defaultValue={coupon?.value ?? 10} />
      </label>
      <label className="adminField">
        <span>Moneda</span>
        <input name="currency" defaultValue={coupon?.currency ?? "USD"} />
      </label>
      <label className="adminField">
        <span>Compra minima</span>
        <input name="minSubtotalMinor" type="number" min="0" defaultValue={coupon?.minSubtotalMinor ?? 0} />
      </label>
      <label className="adminField">
        <span>Desde</span>
        <input name="validFrom" type="datetime-local" defaultValue={inputDateValue(coupon?.validFrom ?? null)} />
      </label>
      <label className="adminField">
        <span>Hasta</span>
        <input name="validTo" type="datetime-local" defaultValue={inputDateValue(coupon?.validTo ?? null)} />
      </label>
      <label className="adminField">
        <span>Estado</span>
        <select name="active" defaultValue={String(coupon?.active ?? true)}>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </label>
      <button className="adminButton adminButtonPrimary" type="submit">
        {isEditing ? "Guardar cupon" : "Crear cupon"}
      </button>
    </form>
  );
}

function CouponDrawer({
  filters,
  coupon,
}: {
  filters: PromotionsAdminFilters;
  coupon?: PromotionCoupon;
}) {
  if (!filters.drawer) {
    return null;
  }

  const isEditing = filters.drawer === "edit";
  const closeHref = promotionsHref(filters, { drawer: undefined, couponCode: undefined });

  return (
    <div className="adminDrawerBackdrop">
      <aside className="adminSideDrawer" aria-label={isEditing ? "Editar cupon" : "Crear cupon"}>
        <div className="adminSideDrawerHeader">
          <div>
            <h2>{isEditing ? "Editar cupon" : "Crear cupon"}</h2>
            <p>{isEditing ? coupon?.couponCode ?? filters.couponCode : "Nueva regla de carrito"}</p>
          </div>
          <Link className="adminButton adminButtonTiny" href={closeHref}>Cerrar</Link>
        </div>
        {isEditing && !coupon ? (
          <div className="adminBanner adminBannerError"><p>No se encontro el cupon seleccionado.</p></div>
        ) : (
          <CouponForm coupon={coupon} filters={filters} />
        )}
      </aside>
    </div>
  );
}

function CouponRows({
  coupons,
  context,
  filters,
}: {
  coupons: PromotionCoupon[];
  context: AdminContext;
  filters: PromotionsAdminFilters;
}) {
  if (coupons.length === 0) {
    return <div className="adminEmptyState">No hay cupones para el filtro actual.</div>;
  }

  const shopLabel = context.shopAlias || context.shopName || context.shopId || "Contexto activo";

  return (
    <div className="adminTableScroller">
      <table className="adminTable seoTable promotionsCouponTable">
        <colgroup>
          <col className="promotionsCouponCodeColumn" />
          <col className="promotionsCouponNameColumn" />
          <col className="promotionsCouponDiscountColumn" />
          <col className="promotionsCouponMinColumn" />
          <col className="promotionsCouponDateColumn" />
          <col className="promotionsCouponStatusColumn" />
          <col className="promotionsCouponActionsColumn" />
        </colgroup>
        <thead>
          <tr>
            {cartRuleFields.map((field) => (
              <th scope="col" key={field}>{field}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon) => (
            <tr key={coupon.couponCode}>
              <td>
                <strong>{coupon.couponCode}</strong>
                <div className="adminContextHint">Tienda: {shopLabel}</div>
              </td>
              <td>{coupon.name}</td>
              <td>
                <strong>{valueText(coupon)}</strong>
                <div className="adminContextHint">{discountTypeText(coupon)} / {coupon.currency}</div>
              </td>
              <td>{moneyMinor(coupon.minSubtotalMinor, coupon.currency)}</td>
              <td>
                <div>{dateText(coupon.validFrom)}</div>
                <div className="adminContextHint">{dateText(coupon.validTo)}</div>
              </td>
              <td>
                <span className={`adminBadge ${coupon.active ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                  {coupon.active ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="promotionsCouponActionsCell">
                <div className="adminInlineActions">
                  <Link
                    className="adminButton adminButtonTiny"
                    href={promotionsHref(filters, {
                      drawer: "edit",
                      couponCode: coupon.couponCode,
                    })}
                  >
                    Editar
                  </Link>
                  {coupon.active ? (
                    <details className="promotionsDeactivateMenu">
                      <summary className="adminButton adminButtonTiny promotionsDeactivateToggle">
                        Desactivar
                      </summary>
                      <div className="promotionsDeactivatePanel">
                        <strong>Desactivar cupon</strong>
                        <p>El cupon dejara de aplicarse en nuevas compras. No se borra definitivamente.</p>
                        <form action={deletePromotionCouponAction} className="promotionsDeactivateForm">
                          <input type="hidden" name="couponCode" value={coupon.couponCode} />
                          <input type="hidden" name="q" value={filters.q ?? ""} />
                          <input type="hidden" name="status" value={filters.status ?? "active"} />
                          <label className="adminField">
                            <span>Escribe DESACTIVAR</span>
                            <input
                              name="confirmDelete"
                              aria-label={`Confirmar desactivacion ${coupon.couponCode}`}
                              placeholder="DESACTIVAR"
                            />
                          </label>
                          <button className="adminButton adminButtonTiny promotionsConfirmDeactivateButton" type="submit">
                            Confirmar
                          </button>
                        </form>
                      </div>
                    </details>
                  ) : (
                    <span className="adminContextHint">Ya inactivo</span>
                  )}
                  <details className="promotionsDeleteMenu">
                    <summary className="adminButton adminButtonTiny promotionsDeleteToggle">
                      Eliminar
                    </summary>
                    <div className="promotionsDeletePanel">
                      <strong>Eliminar cupon</strong>
                      <p>Esto borra la promocion de forma definitiva y la quita de la lista. Usa esta accion para limpiar cupones que ya no deben existir.</p>
                      <form action={hardDeletePromotionCouponAction} className="promotionsDeactivateForm">
                        <input type="hidden" name="couponCode" value={coupon.couponCode} />
                        <input type="hidden" name="q" value={filters.q ?? ""} />
                        <input type="hidden" name="status" value={filters.status ?? "active"} />
                        <label className="adminField">
                          <span>Escribe {coupon.couponCode}</span>
                          <input
                            name="confirmHardDelete"
                            aria-label={`Confirmar eliminacion definitiva ${coupon.couponCode}`}
                            placeholder={coupon.couponCode}
                          />
                        </label>
                        <button className="adminButton adminButtonDanger adminButtonTiny" type="submit">
                          Eliminar definitivamente
                        </button>
                      </form>
                    </div>
                  </details>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PromotionsAdminPage({ context, data, filters }: PromotionsAdminPageProps) {
  const coupons = data.coupons.data.coupons;
  const selectedCoupon = coupons.find((coupon) => coupon.couponCode === filters.couponCode);
  const activeCount = coupons.filter((coupon) => coupon.active).length;
  const inactiveCount = coupons.length - activeCount;
  const canUseTenant = hasRequiredAdminContext(context);

  return (
    <main className="adminPage seoAdminPage">
      <div className="adminBreadcrumb">Admin / Promociones</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Promociones</h1>
          <p className="adminPageIntro">
            Cupones, reglas de carrito y descuentos promocionales gestionados por Promotions.
          </p>
        </div>
        <Link className="adminButton adminButtonPrimary" href={promotionsHref(filters, { drawer: "create", couponCode: undefined })}>
          Crear cupon
        </Link>
      </div>

      {filters.promotionMessage ? (
        <div className="adminBanner">
          <p>{filters.promotionMessage}</p>
        </div>
      ) : null}
      {!canUseTenant ? (
        <div className="adminBanner adminBannerError">
          <p>Selecciona Organization y Shop para operar cupones.</p>
        </div>
      ) : null}
      <ResultBanner data={data} />

      <section className="adminSummaryGrid" aria-label="Resumen promociones">
        <div>
          <span>Total</span>
          <strong>{data.coupons.data.total}</strong>
        </div>
        <div>
          <span>Activos</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>Inactivos</span>
          <strong>{inactiveCount}</strong>
        </div>
        <div>
          <span>Contexto</span>
          <strong>{context.shopAlias || context.shopId || "Pendiente"}</strong>
        </div>
      </section>

      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Reglas de carrito</h2>
            <p>
              Equivalente operativo a los cart rules de PrestaShop: cupones por codigo, importe fijo o porcentaje,
              compra minima, moneda, vigencia y activacion.
            </p>
          </div>
          <span className="adminStatusBadge adminStatusBadgeNeutral">BFF Admin</span>
        </div>
        <form aria-label="Filtros promociones" className="pricingFilterBar promotionsFilterBar" method="get">
          <label className="adminField">
            <span>Buscar</span>
            <input name="q" defaultValue={filters.q ?? ""} placeholder="Codigo o nombre" />
          </label>
          <label className="adminField">
            <span>Estado</span>
            <select name="status" defaultValue={filters.status ?? "active"}>
              <option value="active">Activos</option>
              <option value="all">Todos</option>
            </select>
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Aplicar</button>
          <Link className="adminButton" href="/admin/promociones">Limpiar</Link>
        </form>
        <CouponRows coupons={coupons} context={context} filters={filters} />
      </section>

      <section className="pricingPanel">
        <div className="pricingPanelHeader">
          <div>
            <h2>Reglas de precio de catalogo</h2>
            <p>
              Los precios especificos por producto, variante, grupo, pais o cantidad no se editan aqui. En Ecommium
              pertenecen a Pricing y se gobiernan desde Configuracion &gt; Precios.
            </p>
          </div>
          <Link className="adminButton adminButtonTiny" href="/admin/configuracion/precios?tab=fixed">
            Ver fixed prices
          </Link>
        </div>
        <div className="adminEmptyState">
          Usa Configuracion &gt; Precios para price tables, rules, fixed prices y computed-auto.
        </div>
      </section>
      <CouponDrawer filters={filters} coupon={selectedCoupon} />
    </main>
  );
}
