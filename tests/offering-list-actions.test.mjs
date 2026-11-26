import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
function fixture(reject=false){
  const calls=[];
  const gateway={createOffering:async payload=>{calls.push(payload);return reject?{ok:false,error:'No se pudo guardar'}:{ok:true,data:{offering:{offeringId:"service-1"}}};},updateOffering:async input=>{calls.push(input);return {ok:true,data:{}};}};
  const actions=loadTs('src/modules/catalogo/catalog-offerings-actions.ts',{
    'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:url=>{throw Object.assign(new Error('redirect'),{url});}},
    '../../shared/config/admin-context':{getAdminContext:async()=>({locale:'es-ES',currency:'USD'})},'./products':{makeProductGateway:()=>gateway},
  });
  return {actions,calls};
}
function form(){const f=new FormData();for(const[k,v]of Object.entries({offeringId:'service-1',name:'Montaje',type:'service',price:'19,99',currency:'EUR',active:'true',returnPath:'/admin/catalogo/offerings?q=Montaje'}))f.set(k,v);return f;}
test('inline offering editing preserves price/type/currency/active and returns to filtered list',async()=>{
  const {actions,calls}=fixture();await assert.rejects(actions.updateCatalogOfferingAction(form()),error=>error.url==='/admin/catalogo/offerings?q=Montaje');
  assert.deepEqual(calls,[{offeringId:'service-1',payload:{type:'service',priceMinor:1999,currency:'EUR',localizedName:[{locale:'es-ES',value:'Montaje'}],active:true}}]);
});
test('offering creation uses context currency and surfaces BFF failure instead of silent success',async()=>{
  const {actions,calls}=fixture(true),f=form();f.delete('currency');
  await assert.rejects(actions.createCatalogOfferingAction(f),error=>new URL(error.url,'http://ui.test').searchParams.get('offeringMessage')==='No se pudo guardar');
  assert.equal(calls[0].currency,'USD');
});
test('invalid offering fields never reach BFF and return URLs cannot leave the module',async()=>{
  for(const field of [{price:'garbage'},{price:'-1'},{currency:'bad-code'},{name:''},{type:'unknown'}]){
    const {actions,calls}=fixture(),f=form();for(const[k,v]of Object.entries(field))f.set(k,v);
    await assert.rejects(actions.updateCatalogOfferingAction(f),error=>error.url.includes('offeringMessage='));assert.equal(calls.length,0);
  }
  const {actions}=fixture(),f=form();f.set('returnPath','https://evil.test/');await assert.rejects(actions.updateCatalogOfferingAction(f),error=>error.url==='/admin/catalogo/offerings');
});


test('confirmed offering creation redirects by its canonical identity even before the projection is ready',async()=>{
  const {actions}=fixture();
  await assert.rejects(actions.createCatalogOfferingAction(form()),error=>{
    const url=new URL(error.url,'http://ui.test');
    return url.searchParams.get('q')==='service-1' && url.searchParams.get('createdOfferingId')==='service-1' && url.searchParams.get('status')==='all';
  });
});
