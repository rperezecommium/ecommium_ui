import Link from "next/link";
import type { CatalogDeletionContext } from "./catalog-deletion-contract";
import { listCatalogDeletionOperations } from "./catalog-deletion-actions";
import { CatalogDeletionButton } from "./catalog-deletion-button";
export async function CatalogDeletionOperations({
  context,offset=0,standalone=false,
}: {
  context: CatalogDeletionContext;offset?:number;standalone?:boolean;
}) {
  const result = await listCatalogDeletionOperations(context,offset);
  if (!result.ok)
    return (
      <p role="status">No se pudo consultar si hay eliminaciones pendientes.</p>
    );
  if (!result.items.length)return standalone?<p>No hay eliminaciones pendientes en esta página.</p>:null;
  return (
    <section className="adminSection" aria-label="Eliminaciones pendientes">
      <h2>Eliminaciones pendientes</h2>
      <p>
        Las eliminaciones continúan en segundo plano aunque cierres el navegador. Aquí puedes consultar su estado.
      </p>
      {result.items.map((item) => (
        <div className="adminButtonRow" key={item.operationId}>
          <span>{item.name}</span>
          <CatalogDeletionButton
            target={item.target}
            name={item.name}
            initialOperationId={item.operationId}
          />
        </div>
      ))}
      {standalone?<nav aria-label="Páginas de eliminaciones pendientes">{offset>0?<Link className="adminButton" href={`/admin/catalogo/eliminaciones?offset=${Math.max(0,offset-result.limit)}`}>Anterior</Link>:null}<span>{offset+1}–{offset+result.items.length} de {result.total}</span>{offset+result.limit<result.total?<Link className="adminButton" href={`/admin/catalogo/eliminaciones?offset=${offset+result.limit}`}>Siguiente</Link>:null}</nav>:result.total>result.items.length?<Link href="/admin/catalogo/eliminaciones">Ver todas las eliminaciones pendientes ({result.total})</Link>:null}
    </section>
  );
}
