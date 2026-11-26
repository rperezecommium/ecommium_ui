import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const bff=process.env.COMMERCIAL_QA_BFF_URL,token=process.env.COMMERCIAL_QA_ADMIN_TOKEN;
if(!bff || !token)throw Error('Run this browser test through the isolated backend commercial-context harness');
const claims=JSON.parse(process.env.COMMERCIAL_QA_ADMIN_PRINCIPAL);
const scope={organizationId:claims.organizationId,shopId:claims.shopId};
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const base='http://127.0.0.1:'+port,secret=randomBytes(32).toString('hex');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),env:{...process.env,ECOMMIUM_ADMIN_BFF_BASE_URL:bff,ECOMMIUM_UI_ADMIN_SESSION_SECRET:secret,ECOMMIUM_STOREFRONT_BFF_BASE_URL:"https://commercial-qa.invalid/api/v1",ECOMMIUM_STOREFRONT_ORGANIZATION_ID:scope.organizationId,ECOMMIUM_STOREFRONT_SHOP_ID:scope.shopId},stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',v=>output+=v);server.stderr.on('data',v=>output+=v);
const artifacts=process.env.COMMERCIAL_QA_ARTIFACT_DIR;
if(artifacts)await mkdir(artifacts,{recursive:true});
let browser;
let video;
let recordingContext;
const stages=[];
async function capture(page,name,label) {
 if(!artifacts)return;
 const file=path.join(artifacts,name+'.png');
 await page.getByLabel(/Grupo comercial/).scrollIntoViewIfNeeded();
 await page.screenshot({path:file,fullPage:true});
 stages.push({label,file});
}
try {
 await new Promise((resolve,reject)=>{const deadline=setTimeout(()=>reject(Error('Isolated UI did not become ready: '+output.slice(-1500))),20000);const check=v=>{if(String(v).includes('Ready in')){clearTimeout(deadline);resolve();}};server.stdout.on('data',check);server.once('exit',()=>{clearTimeout(deadline);reject(Error('UI exited before ready: '+output.slice(-1500)));});});
 browser=await chromium.launch({headless:true,slowMo:artifacts?180:0});const context=recordingContext=await browser.newContext({viewport:{width:1366,height:900},...(artifacts?{recordVideo:{dir:artifacts,size:{width:1366,height:900}}}:{})});
 const persisted={accessToken:token,employeeId:claims.sub,name:'QA Admin',email:claims.email,principalType:'EMPLOYEE',scope:'admin',roles:claims.roles,permissions:claims.permissions,sessionId:claims.sessionId,expiresAt:new Date(claims.exp*1000).toISOString(),...scope};
 const signed='v1.'+Buffer.from(JSON.stringify(persisted)).toString('base64url');const cookie=signed+'.'+createHmac('sha256',secret).update(signed).digest('base64url');
 const adminContext={...scope,shopAlias:'qa',shopName:'QA isolated',primaryDomain:'',shopStatus:'ACTIVE',locale:'es-ES',currency:'EUR',country:'ES',channel:'web'};
 await context.addCookies([{name:'ecommium_employee_session',value:cookie,url:base,httpOnly:true,sameSite:'Lax'},{name:'ecommium_admin_context',value:encodeURIComponent(JSON.stringify({version:2,activePrincipalId:claims.sub,contextsByPrincipal:{[claims.sub]:adminContext}})),url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();video=page.video();await page.goto(base+'/admin/clientes?drawer=create');
 const selector=page.getByLabel(/Grupo comercial/);try { await selector.waitFor({state:'visible',timeout:15000}); } catch(error) { console.log('Browser failure at',page.url(),(await page.locator('body').innerText()).slice(0,2500)); console.log('Isolated UI server diagnostics:',output.slice(-2000)); throw error; }
 assert.ok(await selector.locator('option[value="vip"]').count());
 // The shared drawer is bounded by the visible navigation edge. On mobile,
 // explicitly fold navigation before opening the form; do not relax its ratio limits.
 for(const width of [768,390,1366]) {
  await page.setViewportSize({width,height:900});
  if(width===390){
   await page.goto(base+'/admin/clientes');
   const toggle=page.getByRole('button',{name:'Ocultar navegación',exact:true});
   if(await toggle.isVisible())await toggle.click();
   await expect.poll(async()=> (await page.locator('.adminSidebarPanel').boundingBox())?.width??0).toBe(0);
   await page.goto(base+'/admin/clientes?drawer=create');
  }
  await expect.poll(async()=>{const box=await selector.boundingBox();return Boolean(box && box.width>100 && box.x>=0 && box.x+box.width<=width+1);},{message:'Group selector must fit viewport '+width}).toBe(true);
 }
 await page.locator('input[name=email][required]').fill('browser-'+randomUUID()+'@example.test');
 const email=await page.locator('input[name=email][required]').inputValue();
 await page.locator('input[name=firstName]').fill('Browser');await page.locator('input[name=lastName]').fill('Manual');await selector.selectOption('vip');
 await capture(page,'01-crear-vip','1. Crear cliente y elegir VIP');
 await Promise.all([page.waitForURL(url=>url.searchParams.get('customerMessage')==='Cliente creado.',{timeout:15000}),(async()=>{await page.getByRole('button',{name:'Crear cliente',exact:true}).click();const d=page.getByRole('dialog',{name:'Confirmar cambio comercial',exact:true});await d.getByLabel('Tu contraseña de administrador').fill('commercial-qa-password');await d.getByRole('button',{name:'Confirmar cambio comercial',exact:true}).click();})()]);
 const query=new URLSearchParams({...scope,email});const response=await fetch(bff+'/admin/customers?'+query,{headers:{authorization:'Bearer '+token}});assert.equal(response.status,200);const list=await response.json();const customer=list.items.find(c=>c.email===email);assert.ok(customer);
 const membership=await fetch(bff+'/admin/customers/'+customer.customerId+'/commercial-membership?'+new URLSearchParams(scope),{headers:{authorization:'Bearer '+token}});assert.equal(membership.status,200);const saved=await membership.json();assert.equal(saved.groupCode,'vip');assert.equal(saved.revision,1);
 await page.goto(base+'/admin/clientes/'+encodeURIComponent(customer.customerReference)+'?tab=perfil');
 await selector.waitFor({state:'visible'});assert.equal(await selector.inputValue(),'vip');await capture(page,'02-vip-guardado','2. Reabrir perfil: VIP guardado');await selector.selectOption('');await capture(page,'03-retirar-grupo','3. Elegir Sin grupo específico');
 const save=page.locator('form').filter({has:page.locator('select[name=commercialGroupCode]')}).getByRole('button',{name:/Guardar/});
 await Promise.all([page.waitForURL(url=>url.searchParams.get('customerMessage')==='Cliente actualizado.'),(async()=>{await save.click();const d=page.getByRole('dialog',{name:'Confirmar cambio comercial',exact:true});await d.getByLabel('Tu contraseña de administrador').fill('commercial-qa-password');await d.getByRole('button',{name:'Confirmar cambio comercial',exact:true}).click();})()]);
 const changed=await fetch(bff+'/admin/customers/'+customer.customerId+'/commercial-membership?'+new URLSearchParams(scope),{headers:{authorization:'Bearer '+token}});assert.equal(changed.status,200);const updated=await changed.json();assert.equal(updated.groupCode,null);assert.equal(updated.revision,2);
 await selector.waitFor({state:'visible'});assert.equal(await selector.inputValue(),'');await capture(page,'04-grupo-retirado','4. Guardar: grupo retirado');

 console.log('Playwright PASS: administrator selects VIP during customer creation, atomic profile submission persists membership and editing removes it; selector fits desktop/tablet/mobile and has an accessible label.');
 } finally {
 try {
  if(recordingContext)await recordingContext.close();
  if(artifacts && video){await video.saveAs(path.join(artifacts,'flujo-grupo-comercial.webm'));await writeFile(path.join(artifacts,'steps.json'),JSON.stringify({stages,video:path.join(artifacts,'flujo-grupo-comercial.webm')},null,2));console.log('Visual flow artifacts:',artifacts);}
 } finally {
  if(browser)await browser.close();
  server.kill('SIGTERM');
  if(server.exitCode===null && server.signalCode===null)await Promise.race([once(server,'exit'),new Promise(resolve=>setTimeout(resolve,5000))]);
  if(server.exitCode===null && server.signalCode===null)server.kill('SIGKILL');
 }
}
