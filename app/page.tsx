const metrics = [
  { label: "Ventas hoy", value: "$42.8k", delta: "+12.4%" },
  { label: "Pedidos activos", value: "1,284", delta: "+8.1%" },
  { label: "Conversion", value: "6.7%", delta: "+1.3%" },
  { label: "Stock critico", value: "18", delta: "-4 alertas" },
];

const orders = [
  { id: "#EC-1048", client: "Northstar Home", status: "Listo", total: "$1,245" },
  { id: "#EC-1047", client: "Atelier Sol", status: "En ruta", total: "$842" },
  { id: "#EC-1046", client: "Mercado Verde", status: "Revision", total: "$2,918" },
  { id: "#EC-1045", client: "Urban Shelf", status: "Pagado", total: "$536" },
];

const channels = [
  { name: "Shopify", value: "48%", color: "var(--blue)" },
  { name: "Amazon", value: "27%", color: "var(--green)" },
  { name: "Wholesale", value: "15%", color: "var(--yellow)" },
  { name: "Retail", value: "10%", color: "var(--red)" },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Navegacion principal">
        <div className="brand">
          <span className="brandMark">E</span>
          <div>
            <strong>Ecommium</strong>
            <small>Control tower</small>
          </div>
        </div>

        <nav className="nav">
          <a className="active" href="#">Panel</a>
          <a href="#">Pedidos</a>
          <a href="#">Inventario</a>
          <a href="#">Clientes</a>
          <a href="#">Reportes</a>
        </nav>

        <div className="syncBox">
          <span>Sincronizacion</span>
          <strong>98.7%</strong>
          <small>Canales actualizados hace 4 min</small>
        </div>
      </aside>

      <section className="workspace">
        <div className="content">
          <header className="topbar">
            <div>
              <p className="eyebrow">Operacion ecommerce</p>
              <h1>Ecommium UI</h1>
            </div>
            <div className="actions">
              <button type="button" className="iconButton" aria-label="Buscar">
                <span aria-hidden="true">⌕</span>
              </button>
              <button type="button" className="primaryButton">Nuevo pedido</button>
            </div>
          </header>

          <section className="metricGrid" aria-label="Metricas principales">
            {metrics.map((metric) => (
              <article className="metricCard" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.delta}</small>
              </article>
            ))}
          </section>

          <section className="mainGrid">
            <div className="panel revenuePanel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Rendimiento</p>
                  <h2>Ingresos por hora</h2>
                </div>
                <button type="button" className="ghostButton">Hoy</button>
              </div>
              <div className="chart" aria-label="Grafica de ingresos por hora">
                {[42, 58, 44, 67, 73, 61, 86, 78, 92, 84, 96, 89].map((height, index) => (
                  <span
                    key={index}
                    style={{ height: `${height}%` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Canales</p>
                  <h2>Distribucion</h2>
                </div>
              </div>
              <div className="channelList">
                {channels.map((channel) => (
                  <div className="channel" key={channel.name}>
                    <span className="dot" style={{ background: channel.color }} />
                    <strong>{channel.name}</strong>
                    <span>{channel.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel orderPanel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Fulfillment</p>
                  <h2>Pedidos recientes</h2>
                </div>
                <button type="button" className="ghostButton">Ver todos</button>
              </div>
              <div className="orders">
                {orders.map((order) => (
                  <div className="orderRow" key={order.id}>
                    <span>{order.id}</span>
                    <strong>{order.client}</strong>
                    <em>{order.status}</em>
                    <span>{order.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
