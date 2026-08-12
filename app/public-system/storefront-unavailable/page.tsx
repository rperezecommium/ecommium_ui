export default function StorefrontUnavailablePage() {
  return (
    <main className="storefrontUnavailablePage">
      <section className="storefrontUnavailablePanel" role="status">
        <p className="storefrontUnavailableEyebrow">Tienda no disponible</p>
        <h1>Estamos preparando esta tienda</h1>
        <p>
          La dirección todavía no está asociada a una tienda activa o el servicio
          está temporalmente indisponible. Vuelve a intentarlo en unos minutos.
        </p>
        <a href="/">Reintentar</a>
      </section>
    </main>
  );
}
