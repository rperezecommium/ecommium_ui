import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';

function setup(result) {
  const calls=[];
  const action=loadTs('src/modules/catalogo/catalog-attributes-features-actions.ts',{
    'next/cache':{revalidatePath:path=>calls.push(['revalidate',path])},
    'next/navigation':{redirect:url=>{throw Object.assign(new Error('redirect'),{url});}},
    '../../shared/config/admin-context':{getAdminContext:async()=>({organizationId:'org',shopId:'shop',locale:'es-ES'})},
    './catalog-attributes-features':{createCatalogSpecificationField:async(context,input)=>{calls.push(['create',context,input]);if(result instanceof Error)throw result;return result;}},
  }).createAttributeFeatureAction;
  const form=new FormData();
  form.set('name','Material');form.set('categoryId','bikes');form.set('tab','features');form.set('values','A, B');
  return {action,form,calls};
}
test('invalid feature form never sends a mutation',async()=>{
  const {action,form,calls}=setup({});form.delete('name');
  const result=await action({},form);
  assert.ok(result.fieldErrors.name);assert.equal(calls.length,0);
});
test('BFF rejection is returned without redirecting or invalidating the list',async()=>{
  const {action,form,calls}=setup({ok:false,status:400,error:'La solicitud no es válida.',correlationId:'ui-spec-test'});
  const result=await action({},form);
  assert.match(result.error,/HTTP 400/);assert.match(result.error,/ui-spec-test/);
  assert.equal(calls.length,1);
});
test('successful HTTP response must confirm the named field and feature type',async()=>{
  for(const fields of [[],[{name:'Material',isStockKeepingUnit:true}],[{name:'Other',isStockKeepingUnit:false}]]){
    const {action,form,calls}=setup({ok:true,data:{fields}});
    assert.match((await action({},form)).error,/no confirmó/);assert.equal(calls.length,1);
  }
});
test('confirmed creation redirects only after revalidation',async()=>{
  const {action,form,calls}=setup({ok:true,data:{fields:[{fieldId:'field-new',name:'Material',isStockKeepingUnit:false}]}});
  await assert.rejects(action({},form),error=>error.url==='/admin/catalogo/atributos-caracteristicas?tab=features&createdFieldId=field-new&status=inactive');
  assert.equal(calls[0][2].values.join(','),'A,B');assert.equal(calls[1][0],'revalidate');
});
test('unexpected exception never exposes private exception details',async()=>{
  const {action,form}=setup(new Error('secret upstream detail'));
  const result=await action({},form);assert.ok(result.error);assert.doesNotMatch(result.error,/secret/);
});
