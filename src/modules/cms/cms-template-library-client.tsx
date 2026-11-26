"use client";
import Link from "next/link";
import { CmsTemplateCreateClient } from "./cms-template-create-client";
import dialogStyles from "./cms-site-part-delete.module.css";
import { useEffect, useRef, useState } from "react";
import { saveCompositionTemplateAction } from "./cms-composition-template-actions";
import type {
  CmsTemplateList,
  CmsTemplateReceipt,
} from "./cms-composition-template-types";
import type { CmsSectionContext } from "./cms-independent-section-types";
import styles from "./cms-module-builder.module.css";
export function CmsTemplateLibraryClient({
  list,
  context,
  canWrite,
  status,
  unavailable,
}: {
  list: CmsTemplateList;
  context: CmsSectionContext;
  canWrite: boolean;
  status: "DRAFT" | "ARCHIVED";
  unavailable?: string;
}) {
  const [items, setItems] = useState(list.items),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(unavailable ?? "");
  const [pending, setPending] = useState<CmsTemplateReceipt | null>(null);
  const [confirmation, setConfirmation] = useState<CmsTemplateReceipt | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (confirmation) dialog.current?.showModal(); }, [confirmation]);
  function closeConfirmation() { dialog.current?.close(); setConfirmation(null); trigger.current?.focus(); }
  async function archive(item: CmsTemplateReceipt) {
    if (busy) return;
    setBusy(true);
    setPending(item);
    try {
      const result = await saveCompositionTemplateAction(
        "archive",
        item.resourceId,
        {
          contractVersion: 1,
          resourceKind: "TEMPLATE",
          expectedRevision: item.revisionToken,
        },
        context,
      );
      if (result.ok) {
        setItems((old) => old.filter((x) => x.resourceId !== item.resourceId));
        setPending(null);
        setMessage("Plantilla archivada. Sus copias no se han modificado.");
      } else {
        if (result.status && result.status < 500 && result.status !== 408)
          setPending(null);
        setMessage(result.message);
      }
    } catch {
      setMessage(
        "Resultado no confirmado. Reintenta el archivo de la misma plantilla.",
      );
    } finally {
      setBusy(false);
    }
  }
  const url = (offset: number) =>
    `/admin/cms/plantillas?status=${status}&offset=${offset}`;
  return (
    <main className="adminPage cmsAdminPage">
      {confirmation ? <dialog ref={dialog} className={dialogStyles.dialog} aria-labelledby="cms-template-archive-title" onCancel={event => { event.preventDefault(); closeConfirmation(); }}>
        <h2 id="cms-template-archive-title">Archivar plantilla</h2>
        <p>¿Archivar «{confirmation.document.name}»? Las copias existentes se conservarán.</p>
        <div className="adminButtonRow"><button type="button" className="adminButton" onClick={closeConfirmation}>Cancelar</button><button type="button" className="adminButton adminButtonPrimary" onClick={() => { const item=confirmation; closeConfirmation(); void archive(item); }}>Confirmar archivo</button></div>
      </dialog> : null}
      <div className="adminBreadcrumb">Admin / CMS / Plantillas</div>
      <p>Idioma: {context.locale}</p>
      <div className={styles.templateToolbar}>
      <nav className={`adminTabs ${styles.templateTabs}`} aria-label="Estado de plantillas">
        <Link className={`adminTab ${status === "DRAFT" ? "adminTabActive" : ""}`} aria-current={status === "DRAFT" ? "page" : undefined} href="/admin/cms/plantillas">
          Disponibles
        </Link>
        <Link
          className={`adminTab ${status === "ARCHIVED" ? "adminTabActive" : ""}`}
          aria-current={status === "ARCHIVED" ? "page" : undefined}
          href="/admin/cms/plantillas?status=ARCHIVED"
        >
          Archivadas
        </Link>
      </nav>
      {canWrite ? <CmsTemplateCreateClient context={context} disabled={!!unavailable || busy || !!pending} onCreated={receipt=>{window.location.assign(`/admin/cms/plantillas?id=${encodeURIComponent(receipt.resourceId)}`);}} /> : null}
      </div>
      {message ? (
        <p role="status" className="adminBanner">
          {message}
        </p>
      ) : null}
      <section
        className={`productListPage productListGrid ${styles.library}`}
        aria-label="Biblioteca de plantillas"
      >
        <div className="adminTableScroller productListTableScroller">
          <table className="adminTable productListTable">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Idioma</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.resourceId}>
                  <td className="productListNameCell">
                    <Link
                      href={`/admin/cms/plantillas?id=${encodeURIComponent(item.resourceId)}`}
                    >
                      {item.document.name}
                    </Link>
                  </td>
                  <td>
                    {item.document.content.kind === "SECTION"
                      ? "Sección"
                      : "Página"}
                  </td>
                  <td>{item.context.locale}</td>
                  <td>
                    <span className="adminBadge">
                      {item.status === "DRAFT" ? "Disponible" : "Archivada"}
                    </span>
                  </td>
                  <td>
                    <div className="productListActions">
                      {canWrite && item.status === "DRAFT" ? (
                        <>
                          <Link
                            className="adminButton"
                            aria-disabled={busy || !!pending}
                            href={`/admin/cms/plantillas?id=${encodeURIComponent(item.resourceId)}&apply=1`}
                            onClick={(e) => {
                              if (busy || pending) e.preventDefault();
                            }}
                          >
                            {item.document.content.kind === "PAGE" ? "Crear página" : "Crear sección"}
                          </Link>
                          <button
                            type="button"
                            className="adminButton"
                            disabled={
                              busy ||
                              !!unavailable ||
                              (!!pending &&
                                pending.resourceId !== item.resourceId)
                            }
                            onClick={(event) => { if (pending) void archive(pending); else { trigger.current = event.currentTarget; setConfirmation(item); } }}
                          >
                            {pending?.resourceId === item.resourceId
                              ? "Reintentar archivo"
                              : "Archivar"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length ? (
            <p>
              Sin plantillas. Guarda una desde el editor de una sección o
              página.
            </p>
          ) : null}
        </div>
        <div className="adminButtonRow">
          {list.offset > 0 ? (
            <Link
              className="adminButton"
              href={url(Math.max(0, list.offset - list.limit))}
            >
              Anterior
            </Link>
          ) : null}
          {list.offset + list.limit < list.total ? (
            <Link className="adminButton" href={url(list.offset + list.limit)}>
              Siguiente
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
