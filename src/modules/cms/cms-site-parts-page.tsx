import {CmsShellSectionsClient} from "./cms-shell-sections-client";
import {listIndependentModules} from "./cms-independent-modules";
import {listIndependentSections} from "./cms-independent-sections";
import { CmsSitePartCreateInline } from "./cms-site-part-create-inline";
import { CmsSitePartAssignmentsDrawer } from "./cms-site-part-assignments-drawer";
import { CmsShellAssignmentForm } from "./cms-shell-assignment-form";
import { CmsSitePartNotice } from "./cms-site-part-notice";
import Link from "next/link";
import { CmsSitePartDeleteButton } from "./cms-site-part-delete-button";
import { Archive, Copy, Pencil } from "lucide-react";
import type { AdminContext } from "../../shared/config/admin-context";
import { archiveCmsSitePartAction, duplicateCmsSitePartAction } from "./cms-site-parts-actions";
import type { CmsSitePart, CmsSitePartDetail, CmsSitePartKind, CmsSitePartList } from "./cms-admin";
import dynamic from "next/dynamic";
const CmsSavedSitePartPreview = dynamic(() => import("./cms-site-part-preview").then(module => module.CmsSavedSitePartPreview), { loading: () => <p role="status">Cargando vista previa…</p> });

type Props = { canPublish?: boolean; canManage?: boolean; context: AdminContext; kind: CmsSitePartKind; data: CmsSitePartList; detail?: CmsSitePartDetail | null; locale: string; selectedId?: string; tab?: string; message?: string; unavailable?: string };

export function CmsSitePartsPage({ context, canManage = false, canPublish=false, kind, data, detail, locale, selectedId, tab, message, unavailable }: Props) {
  const selected = detail ?? (selectedId ? data.items.find((item) => item.sitePartId === selectedId) : data.items[0]) ?? null;
  const label = kind === "HEADER" ? "Headers" : "Footers";
  const base = kind === "HEADER" ? "/admin/cms/headers" : "/admin/cms/footers";
  const activeTab = ["library", "design"].includes(tab ?? "")
    ? tab : tab === "history" ? "library" : selectedId ? "design" : "library";
  const href = (nextTab: string, id = selected?.sitePartId) => {
    const params = new URLSearchParams({ tab: nextTab, locale });
    if (id) params.set("sitePartId", id);
    return `${base}?${params.toString()}`;
  };
  return (
    <main className="adminPage cmsAdminPage cmsSitePartsPage">
      <section className="adminPageHeader">
        <div><div className="adminBreadcrumb">Admin / CMS / {label}</div><h1>{label}</h1><p>Componentes reutilizables, versionados y asignables por superficie.</p>{selected && activeTab === "design" ? <h2 className="cmsSitePartTitle">{selected.name}</h2> : null}</div>

      </section>
      <nav className="productEditorTabs pricingTabs" aria-label={`Secciones de ${label}`}>
        {[
          { id: "library", label: "Biblioteca" },
          { id: "design", label: "Diseño" },
        ].map((item) => <Link key={item.id} href={href(item.id)} aria-current={activeTab === item.id ? "page" : undefined} className={`productEditorTab${activeTab === item.id ? " productEditorTabActive" : ""}`}>{item.label}</Link>)}
        {canManage ? <CmsSitePartCreateInline kind={kind} locale={locale} /> : null}
        <CmsSitePartAssignmentsDrawer kind={kind} initialOpen={tab === "assignments"}>
        <CmsShellAssignmentForm kind={kind} context={{...context,locale}} items={data.items} canWrite={canManage}/>
        </CmsSitePartAssignmentsDrawer>
      </nav>
      {message ? <CmsSitePartNotice key={message} message={message} /> : null}
      {unavailable ? <section className="adminBanner adminBannerError"><strong>CMS no disponible</strong><p>{unavailable}</p></section> : null}

      {activeTab === "library" ? <section className="productListPage productListGrid cmsSitePartLibrary" aria-label={`Biblioteca de ${label.toLowerCase()}`}>
        <div className="adminTableScroller productListTableScroller"><table className="adminTable productListTable"><thead><tr><th scope="col">Nombre</th><th scope="col">Estado</th><th scope="col">Revisión</th><th scope="col">Usos</th><th scope="col">Acciones</th></tr></thead><tbody>
          {data.items.map((item) => <tr key={item.sitePartId}><td className="productListNameCell"><Link href={href("design", item.sitePartId)} title={item.sitePartId}>{item.name}</Link></td><td><span className={`adminBadge ${item.status === "ACTIVE" ? "adminBadgeOk" : "adminBadgeWarn"}`}>{item.status}</span></td><td className="productListNumericCell">{item.latestRevision?.revision ?? 1}</td><td className="productListNumericCell">{item.usageCount}</td><td><div className="productListActions">{canManage ? <CmsSitePartDeleteButton showIcon={false} id={item.sitePartId} name={item.name} kind={kind} locale={locale} usageCount={item.usageCount} /> : null}<Link className="adminButton employeesActionInfo" href={href("design", item.sitePartId)} title="Editar"><Pencil aria-hidden="true" size={16} /><span className="adminVisuallyHidden">Editar {item.name}</span></Link></div></td></tr>)}
          {data.items.length === 0 ? <tr><td colSpan={5}>No hay elementos creados.</td></tr> : null}
        </tbody></table></div>
      </section> : null}



      {activeTab === "design" ? selected ? <SitePartEditor canPublish={canPublish} item={selected} kind={kind} locale={locale} canManage={canManage} context={context} /> : <section className="pricingPanel"><p>Crea un elemento en Biblioteca para comenzar el diseño.</p><Link href={href("library")}>Ir a Biblioteca</Link></section> : null}
    </main>
  );
}

async function SitePartEditor({ item, kind, locale, canManage, canPublish, context }: { canPublish:boolean; context: AdminContext; canManage: boolean; item: CmsSitePart | CmsSitePartDetail; kind: CmsSitePartKind; locale: string }) {
  const revision = item.latestRevision;
  if(revision && revision.blocks.every(block=>block.type==="cms.section")) {
    const [modules,sections]=await Promise.all([listIndependentModules({...context,locale}),listIndependentSections({...context,locale})]);
    return <section className="cmsSitePartEditor">
      {!modules.ok?<p role="alert">{modules.error}</p>:null}
      {!sections.ok?<p role="alert">{sections.error}</p>:null}
      <CmsShellSectionsClient key={`${item.sitePartId}:${revision.updatedAt}`} item={item} context={{...context,locale}} modules={modules.ok?modules.data:{items:[],total:0,limit:50,offset:0}} initialSections={sections.ok?sections.data:{items:[],total:0,limit:50,offset:0}} canWrite={canManage} canPublish={canPublish}/>
      <SitePartCommands item={item} kind={kind} locale={locale} canManage={canManage}/>
    </section>;
  }
  return <section className="cmsSitePartEditor" aria-label="Pieza histórica conservada">
    <p>Vista previa del contenido guardado.</p>
    {revision ? <CmsSavedSitePartPreview part={{sitePartId:item.sitePartId,kind:item.kind,name:item.name,revision}} locale={locale} country={context.country} currency={context.currency}/> : null}
    <SitePartCommands item={item} kind={kind} locale={locale} canManage={canManage} />
  </section>;
}

function SitePartCommands({ item, kind, locale, canManage }: { item: CmsSitePart; kind: CmsSitePartKind; locale: string; canManage: boolean }) {
  if(!canManage)return null;
  return <>
      {canManage ? <CmsSitePartDeleteButton id={item.sitePartId} name={item.name} kind={kind} locale={locale} usageCount={item.usageCount} /> : null}
      <form action={duplicateCmsSitePartAction}><input name="sitePartId" type="hidden" value={item.sitePartId} /><input name="kind" type="hidden" value={kind} /><input name="locale" type="hidden" value={locale} /><input aria-label="Nombre de la copia" name="duplicateName" defaultValue={`${item.name} copia`} /><button className="adminButton adminButtonSecondary" type="submit"><Copy size={16} /> Duplicar</button></form>
      <form action={archiveCmsSitePartAction}><input name="sitePartId" type="hidden" value={item.sitePartId} /><input name="kind" type="hidden" value={kind} /><input name="locale" type="hidden" value={locale} /><button className="adminButton adminButtonDanger" disabled={item.usageCount > 0} title={item.usageCount > 0 ? "Reemplaza sus asignaciones antes de archivar" : "Archivar"} type="submit"><Archive size={16} /> Archivar</button></form>
  </>;
}
