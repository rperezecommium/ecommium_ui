import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const context={organizationId:'org-1',shopId:'shop-1',locale:'es-ES'};
function fixture(){
  const calls=[];
  const client=loadTs('src/modules/catalogo/catalog-taxonomy.ts',{
    './product-editor-draft':{plainProductText:value=>value},
    '../../shared/bff/admin-client':{requestAdminBff:async(path,options)=>{calls.push({path,options});return {ok:true,data:options.parse?.({categoryId:'cat/1',name:'Bicicletas',isActive:true})};}},
  });
  return {client,calls};
}
test('category deletion preserves tenant and forwards distinct soft and hard modes',async()=>{
  const {client,calls}=fixture();
  for(const mode of ['soft','hard']) await client.deleteCatalogEntity(context,'categories','cat/1',mode);
  assert.equal(calls.length,2);
  for(const [index,mode] of ['soft','hard'].entries()){
    const url=new URL(calls[index].path,'http://bff.test');
    assert.equal(url.pathname,'/admin/categories/cat%2F1');
    assert.equal(url.searchParams.get('mode'),mode);
    assert.equal(url.searchParams.get('organizationId'),'org-1');
    assert.equal(url.searchParams.get('shopId'),'shop-1');
    assert.equal(calls[index].options.init.method,'DELETE');
  }
});
test('inline category editing keeps the scoped PATCH contract',async()=>{
  const {client,calls}=fixture();
  await client.updateCatalogEntity(context,'categories','cat/1',{name:'Urbanas',isActive:false});
  assert.equal(calls[0].options.init.method,'PATCH');
  assert.deepEqual(JSON.parse(calls[0].options.init.body),{...context,name:'Urbanas',isActive:false});
});

test('brand deletion uses the brand endpoint with both modes and tenant scope',async()=>{
  const {client,calls}=fixture();
  for(const mode of ['soft','hard'])await client.deleteCatalogEntity(context,'brands','brand/1',mode);
  for(const [index,mode] of ['soft','hard'].entries()){
    const url=new URL(calls[index].path,'http://bff.test');
    assert.equal(url.pathname,'/admin/brands/brand%2F1');
    assert.equal(url.searchParams.get('mode'),mode);
    assert.equal(url.searchParams.get('organizationId'),'org-1');
    assert.equal(url.searchParams.get('shopId'),'shop-1');
    assert.equal(calls[index].options.init.method,'DELETE');
  }
});
