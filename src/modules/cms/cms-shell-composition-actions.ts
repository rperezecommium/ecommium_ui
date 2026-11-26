"use server";
import {getCurrentAdminSession} from '../auth/current-admin-session';
import {getAdminContext} from '../../shared/config/admin-context';
import {getCmsSitePart,updateCmsSitePartDraft,publishCmsSitePart} from './cms-admin';
import {assertShellCompositionBlocks,assertShellDesignSettings} from './cms-shell-composition-validation';
import {cmsCompositionMatches} from './cms-composition-receipt';
import type {CmsBlock} from './cms-blocks';

async function scope(expected:{organizationId:string;shopId:string;locale:string}) {
 const session=await getCurrentAdminSession();
 if(session?.scope!=='admin'||!session.permissions.some(p=>['*','admin:*','system.admin','cms.settings.write'].includes(p))) throw Error('No tienes permiso para modificar cabeceras o pies.');
 const context=await getAdminContext();
 if(context.organizationId!==expected.organizationId||context.shopId!==expected.shopId||context.locale!==expected.locale) throw Error('El contexto ha cambiado. Vuelve a abrir la pieza.');
 return context;
}
export async function saveCmsShellSectionsAction(id:string,blocks:CmsBlock[],baseline:{revisionId:string;updatedAt:string},expected:{organizationId:string;shopId:string;locale:string},designSettings?:import('../../../packages/cms-blocks/src/design-settings').CmsDesignSettings) {
 try {
  const context=await scope(expected);
  assertShellCompositionBlocks(blocks);
  if(designSettings!==undefined)assertShellDesignSettings(designSettings);
  const current=await getCmsSitePart(context,id,expected.locale);
  if(!current.ok)return {ok:false as const,message:current.error};
  const revision=current.data.latestRevision;
  if(!revision||revision.revisionId!==baseline.revisionId||revision.updatedAt!==baseline.updatedAt) throw Error('La pieza cambió. Conserva tu edición y vuelve a abrirla.');
  const layout=designSettings?{...revision.layout,designSettings}:revision.layout;
  const result=await updateCmsSitePartDraft(context,id,{layout,blocks,expectedRevision:baseline},expected.locale);
  if(!result.ok)return {ok:false as const,message:result.error};
  const saved=result.data.latestRevision;
  if(result.data.sitePartId!==id||!saved||saved.status!=='DRAFT'||!cmsCompositionMatches({layout,blocks},{layout:saved.layout,blocks:saved.blocks})) throw Error('No se pudo confirmar el contenido guardado. Reabre la pieza antes de repetir.');
  return {ok:true as const,revision:{revisionId:saved.revisionId,updatedAt:saved.updatedAt},layout};
 }catch(error){return {ok:false as const,message:error instanceof Error?error.message:'No se pudo guardar.'};}
}
export async function publishCmsShellSectionsAction(id:string,blocks:CmsBlock[],baseline:{revisionId:string;updatedAt:string},expected:{organizationId:string;shopId:string;locale:string},designSettings?:import('../../../packages/cms-blocks/src/design-settings').CmsDesignSettings) {
 try {
  const session=await getCurrentAdminSession();
  if(session?.scope!=='admin'||!session.permissions.some(permission=>['*','admin:*','system.admin','cms.pages.publish'].includes(permission)))throw Error('No tienes permiso para publicar esta pieza.');
  const context=await scope(expected),saved=await saveCmsShellSectionsAction(id,blocks,baseline,expected,designSettings);
  if(!saved.ok)return saved;
  const result=await publishCmsSitePart(context,id,expected.locale,saved.revision);
  if(!result.ok)return {ok:false as const,message:`El borrador se guardó, pero no se pudo confirmar la publicación. ${result.error}`};
  const active=result.data.latestRevision;
  if(result.data.sitePartId!==id||result.data.activeRevisionId!==saved.revision.revisionId||active?.status!=='ACTIVE'||!cmsCompositionMatches({layout:saved.layout,blocks},active))throw Error('No se pudo confirmar la publicación completa. Revisa el historial antes de repetir.');
  return {ok:true as const};
 }catch(error){return {ok:false as const,message:error instanceof Error?error.message:'No se pudo confirmar la publicación.'};}
}
