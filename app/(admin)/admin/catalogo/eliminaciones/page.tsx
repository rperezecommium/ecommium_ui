import Link from 'next/link';
import {getAdminContext} from '../../../../../src/shared/config/admin-context';
import {getCurrentAdminSession} from '../../../../../src/modules/auth/current-admin-session';
import {CatalogDeletionOperations} from '../../../../../src/modules/catalogo/catalog-deletion-operations';
export default async function CatalogDeletionOperationsPage({searchParams}:{searchParams?:Promise<{offset?:string}>}){
 const session=await getCurrentAdminSession();if(!session?.permissions.some(p=>['*','system.admin','catalog.products.delete'].includes(p)))return <p role="alert">No tienes permiso para consultar eliminaciones.</p>;
 const c=await getAdminContext();const params=await searchParams;const offset=Number(params?.offset??0);if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)return <p role="alert">Página no válida.</p>;
 return <><div className="adminBreadcrumb">Admin / Catálogo / Eliminaciones</div><Link className="adminButton" href="/admin/products">Volver a productos</Link><CatalogDeletionOperations standalone context={{organizationId:c.organizationId,shopId:c.shopId,locale:c.locale}} offset={offset}/></>;
}
