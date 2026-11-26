import{adminOnlyOrigin}from"../src/shared/config/admin-deployment-profile.mjs";
import{pathToFileURL}from'node:url';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function assertDeploymentEnvironment(env){
 if(env.ECOMMIUM_UI_SURFACE){adminOnlyOrigin(env);return true;}
 for(const name of ['ECOMMIUM_STOREFRONT_BFF_BASE_URL','ECOMMIUM_ADMIN_BFF_BASE_URL']){let url;try{url=new URL(env[name]);}catch{throw Error('UI_DEPLOYMENT_BFF_INVALID');}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/api/v1')throw Error('UI_DEPLOYMENT_BFF_INVALID');}
 if(!uuid.test(env.ECOMMIUM_STOREFRONT_ORGANIZATION_ID??'')||!uuid.test(env.ECOMMIUM_STOREFRONT_SHOP_ID??'')||env.ECOMMIUM_DEFAULT_ORGANIZATION_ID!==env.ECOMMIUM_STOREFRONT_ORGANIZATION_ID||env.ECOMMIUM_DEFAULT_SHOP_ID!==env.ECOMMIUM_STOREFRONT_SHOP_ID)throw Error('UI_DEPLOYMENT_CONTEXT_INVALID');
 if(typeof env.ECOMMIUM_UI_ADMIN_SESSION_SECRET!=='string'||env.ECOMMIUM_UI_ADMIN_SESSION_SECRET.length<32)throw Error('UI_DEPLOYMENT_SESSION_SECRET_INVALID');
 if(env.ECOMMIUM_UI_ALLOW_STOREFRONT_FIXTURES==='true'||env.ECOMMIUM_ADMIN_BFF_TOKEN||env.GOOGLE_APPLICATION_CREDENTIALS||env.MEDIA_GCS_SERVICE_ACCOUNT_JSON)throw Error('UI_DEPLOYMENT_FORBIDDEN_CREDENTIAL');
 if(env.ECOMMIUM_UI_ROUTING_MODE){
  if(env.ECOMMIUM_UI_ROUTING_MODE!=='SEPARATED_V1')throw Error('UI_DEPLOYMENT_ROUTING_INVALID');
  const origins=['ECOMMIUM_UI_STOREFRONT_ORIGIN','ECOMMIUM_UI_ADMIN_ORIGIN'].map(name=>{let u;try{u=new URL(env[name]);}catch{throw Error('UI_DEPLOYMENT_ROUTING_INVALID');}if(u.protocol!=='https:'||u.origin!==env[name]||u.username||u.password)throw Error('UI_DEPLOYMENT_ROUTING_INVALID');return u.origin;});
  if(new Set([...origins,new URL(env.ECOMMIUM_STOREFRONT_BFF_BASE_URL).origin,new URL(env.ECOMMIUM_ADMIN_BFF_BASE_URL).origin]).size!==4)throw Error('UI_DEPLOYMENT_ROUTING_COLLISION');
  if(!['off','turnstile'].includes(env.ECOMMIUM_SIGNUP_HUMAN_VERIFICATION)||typeof env.ECOMMIUM_TURNSTILE_SITE_KEY!=='string'||(env.ECOMMIUM_SIGNUP_HUMAN_VERIFICATION==='off'?env.ECOMMIUM_TURNSTILE_SITE_KEY!=='':!/^[A-Za-z0-9_-]{3,200}$/.test(env.ECOMMIUM_TURNSTILE_SITE_KEY)))throw Error('UI_DEPLOYMENT_HUMAN_VERIFICATION_INVALID');
 }
 return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{assertDeploymentEnvironment(process.env);}catch(error){console.error(error.message);process.exit(1);}await import('../server.js');}
