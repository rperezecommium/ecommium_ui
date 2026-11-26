import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
function setup(result) {
  const calls=[];
  const actions=loadTs('src/modules/catalogo/catalog-attributes-features-actions.ts',{
    'next/cache':{revalidatePath:path=>calls.push(['revalidate',path])},
    'next/navigation':{redirect:url=>{throw Object.assign(new Error('redirect'),{url});}},
    '../../shared/config/admin-context':{getAdminContext:async()=>({organizationId:'org',shopId:'shop',locale:'es-ES'})},
    './catalog-attributes-features':{updateCatalogSpecificationField:async(context,input)=>{calls.push(['update',context,input]);return result;}},
  });
  const form=new FormData();
  for(const [key,value] of Object.entries({groupId:'group',fieldId:'field',name:'QA',tab:'attributes',isFilter:'true',isOnProductDetails:'true'}))form.set(key,value);
  return {actions,form,calls};
}
test('deactivation preserves scope and flags, requires canonical inactive confirmation',async()=>{
  const {actions,form,calls}=setup({ok:true,data:{fields:[{fieldId:'field',isActive:false}]}});
  await assert.rejects(actions.updateAttributeFeatureAction(form),error=>{
    const url=new URL(error.url,'http://ui.test');
    assert.equal(url.searchParams.get('updatedFieldId'),'field');
    assert.equal(url.searchParams.get('expectedActive'),'false');
    assert.equal(url.searchParams.get('tab'),'attributes');return true;
  });
  assert.equal(calls[0][1].shopId,'shop');
  assert.equal(calls[0][2].isActive,false);
  assert.equal(calls[0][2].isFilter,true);
  assert.equal(calls[0][2].isOnProductDetails,true);
  assert.equal(calls[1][0],'revalidate');
});
test('rejected update surfaces public status/reference and never revalidates as success',async()=>{
  const {actions,form,calls}=setup({ok:false,status:403,error:'Sin permiso.',correlationId:'ref-test'});
  await assert.rejects(actions.updateAttributeFeatureAction(form),error=>{
    const message=new URL(error.url,'http://ui.test').searchParams.get('mutationError');
    assert.match(message,/HTTP 403/);assert.match(message,/ref-test/);return true;
  });
  assert.equal(calls.length,1);
});
test('HTTP success without matching field and state is not confirmation',async()=>{
  for(const fields of [[],[{fieldId:'other',isActive:false}],[{fieldId:'field',isActive:true}]]){
    const {actions,form,calls}=setup({ok:true,data:{fields}});
    await assert.rejects(actions.updateAttributeFeatureAction(form),error=>new URL(error.url,'http://ui.test').searchParams.get('mutationError')?.includes('no confirmó'));
    assert.equal(calls.length,1);
  }
});
test('missing identity is visible and sends no mutation',async()=>{
  const {actions,form,calls}=setup({});form.delete('fieldId');
  await assert.rejects(actions.updateAttributeFeatureAction(form),error=>new URL(error.url,'http://ui.test').searchParams.get('mutationError')?.includes('Faltan'));
  assert.equal(calls.length,0);
});

test('legacy deactivation cannot bypass the impact review',async()=>{const {actions,form,calls}=setup({});await assert.rejects(actions.deactivateAttributeFeatureAction(form),error=>new URL(error.url,'http://ui.test').searchParams.get('mutationError')?.includes('revisa el impacto'));assert.equal(calls.length,0);});
