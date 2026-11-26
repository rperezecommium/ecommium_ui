import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function harness(result) {
  const calls=[];
  const source=readFileSync(new URL('../src/modules/catalogo/pricing-admin-actions.ts',import.meta.url),'utf8');
  const testModule={exports:{}};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:testModule.exports,module:testModule,URLSearchParams,encodeURIComponent,
    require(name) {
      if(name==='next/cache') return {revalidatePath(){}};
      if(name==='next/navigation') return {redirect(url){throw Object.assign(Error('redirect'),{url});}};
      if(name.endsWith('/admin-context')) return {getAdminContext:async()=>({organizationId:'org-1',shopId:'shop-1'})};
      if(name==='./pricing-admin') return {mutatePricing:async(...args)=>{calls.push(args);return result;}};
      throw Error(name);
    },
  });
  return {calls,action:testModule.exports.removeTaxDefinitionAction,tableAction:testModule.exports.removePriceTableReferenceAction};
}
function form(ack=true) {const data=new FormData();data.set('taxCode','vat/es');if(ack){data.set('confirmDelete','DELETE');data.set('detachPrices','true');}return data;}
async function message(action,data) {try{await action(data);}catch(error){return new URL(error.url,'https://ui.test').searchParams.get('pricingMessage');}throw Error('missing redirect');}

test('permanent removal requires explicit detachment confirmation before calling BFF',async()=>{
  const {action,calls}=harness({ok:true,data:{}});
  assert.match(await message(action,form(false)),/Confirma/);assert.equal(calls.length,0);
});
test('permanent removal uses its dedicated scoped endpoint and validates the full receipt',async()=>{
  const {action,calls}=harness({ok:true,data:{mode:'hard',code:'vat/es',deleted:true,detachedPrices:8,remainingAssignments:0}});
  assert.match(await message(action,form()),/8 precios han quedado sin impuesto/);
  assert.equal(calls[0][1],'/admin/pricing/taxes/vat%2Fes/permanent?organizationId=org-1&shopId=shop-1&detachPrices=true');
  assert.equal(calls[0][2],'DELETE');
});
test('legacy soft receipt, wrong code, pending assignments and invalid counts cannot report success',async()=>{
  for(const data of [{deleted:true,code:'vat/es'}, {mode:'hard',code:'other',deleted:true,detachedPrices:1,remainingAssignments:0}, {mode:'hard',code:'vat/es',deleted:true,detachedPrices:1,remainingAssignments:1}, {mode:'hard',code:'vat/es',deleted:true,detachedPrices:-1,remainingAssignments:0}]) {
    const {action}=harness({ok:true,data});assert.match(await message(action,form()),/No se pudo confirmar/);
  }
});
test('BFF authorization failure cannot report removal',async()=>{
  const {action}=harness({ok:false,status:403,error:'forbidden'});
  assert.match(await message(action,form()),/pricing.admin.write/);
});


test('table removal requires acknowledgement and validates inactive, detached receipt',async()=>{
 const data=new FormData();data.set('priceTableId','vip');
 const empty=harness({ok:true,data:{}});assert.match(await message(empty.tableAction,data),/Confirma/);assert.equal(empty.calls.length,0);
 data.set('confirmDelete','DELETE');data.set('deactivatePrices','true');
 const valid=harness({ok:true,data:{mode:'hard',code:'vip',deleted:true,affectedPrices:4,remainingAssignments:0,activePricesRemaining:0}});
 assert.match(await message(valid.tableAction,data),/4 precios y sus reglas/);assert.equal(valid.calls[0][1],'/admin/pricing/price-tables/vip/permanent?organizationId=org-1&shopId=shop-1&deactivatePrices=true');
 for(const receipt of [{deleted:true,code:'vip'},{mode:'hard',code:'vip',deleted:true,affectedPrices:4,remainingAssignments:0,activePricesRemaining:1}]){
  const invalid=harness({ok:true,data:receipt});assert.match(await message(invalid.tableAction,data),/No se pudo confirmar/);
 }
});
