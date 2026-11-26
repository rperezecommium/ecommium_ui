"use server";
import {getCurrentAdminSession} from '../auth/current-admin-session';
import {getAdminContext} from '../../shared/config/admin-context';
import {getCmsGlobalSettings} from './cms-admin';
import {cmsDesignFromTokens,emptyCmsDesign} from '../../../packages/cms-blocks/src/design-settings';
export async function loadCmsDesignDefaultsAction(expected?:{organizationId:string;shopId:string;locale?:string}) {
 const session=await getCurrentAdminSession();
 if(session?.scope!=='admin')return {values:emptyCmsDesign,message:'No se pudieron consultar los ajustes heredados.'};
 const context=await getAdminContext();
 if(expected&&(expected.organizationId!==context.organizationId||expected.shopId!==context.shopId||(expected.locale!==undefined&&expected.locale!==context.locale)))return {values:emptyCmsDesign,message:'El contexto cambió. Vuelve a abrir el documento para consultar su herencia.'};
 const result=await getCmsGlobalSettings(context,context.locale);
 return result.ok?{values:cmsDesignFromTokens(result.data.settings.tokens)}:{values:emptyCmsDesign,message:result.error};
}
