export default function CatalogoPage() {
  return <Placeholder title="Catalogo" />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <main className="adminPage">
      <div className="adminBreadcrumb">Admin / {title}</div>
      <h1 className="adminPageTitle">{title}</h1>
      <div className="adminEmptyState">Modulo pendiente de implementar.</div>
    </main>
  );
}
