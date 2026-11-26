import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';

const context={organizationId:'org',shopId:'shop',locale:'es-ES',currency:'EUR'};
const service={offeringId:'service',name:'QA',active:false};
function actions(gateway) {
  return loadTs('src/modules/catalogo/product-actions.ts',{
    'next/cache':{revalidatePath(){}},'next/navigation':{redirect(){}},
    '../auth/current-admin-session':{getCurrentAdminSession:async()=>({permissions:['*']})},
    '../../shared/config/admin-context':{getAdminContext:async()=>context},
    '../../shared/bff/admin-client':{requestAdminBff(){}},
    './products':{makeProductGateway:()=>gateway},
    './catalog-taxonomy':{},
  });
}
test('offering actions use canonical write receipts and never overwrite them with a delayed projection',async()=>{
  const action=actions({
    setOfferingVariantActivation:async()=>({ok:true,data:{updated:true,active:false,offerings:[service]}}),
    detachOfferingFromVariant:async()=>({ok:true,data:{detached:true,offerings:[]}}),
    resolveOfferingsBatchByVariants(){throw Error('projection must not confirm writes')},
  });
  const disabled=await action.setOfferingVariantActivationAction({variantId:'variant',offeringId:'service',active:false});
  assert.equal(disabled.ok,true);assert.equal(disabled.offerings[0].active,false);
  const removed=await action.detachOfferingFromVariantAction({variantId:'variant',offeringId:'service'});
  assert.equal(removed.ok,true);assert.deepEqual(removed.offerings,[]);
});
test('accepted mutations without confirmation and nonexistent relations cannot claim success',async()=>{
  for(const receipt of [{},{updated:false,offerings:[service]},{updated:true,offerings:[{...service,active:true}]}]){
    const action=actions({setOfferingVariantActivation:async()=>({ok:true,data:receipt})});
    assert.equal((await action.setOfferingVariantActivationAction({variantId:'variant',offeringId:'service',active:false})).ok,false);
  }
  const action=actions({detachOfferingFromVariant:async()=>({ok:true,data:{offerings:[service]}})});
  assert.equal((await action.detachOfferingFromVariantAction({variantId:'variant',offeringId:'service'})).ok,false);
});
test('tax recovery validates the response through the existing mapper without changing product data',async()=>{
  const taxActions=loadTs('src/modules/catalogo/product-tax-lookup-actions.ts',{
    '../../shared/config/admin-context':{getAdminContext:async()=>context},
    './pricing-admin':{getPricingTaxes:async received=>{assert.equal(received,context);return {source:'unavailable',data:[],message:'Unavailable'}},toTaxLookupOption(){throw Error('no fallback taxes')}},
  });
  assert.deepEqual(await taxActions.reloadProductTaxesAction(),{ok:false,taxes:[],message:'Unavailable'});
});
