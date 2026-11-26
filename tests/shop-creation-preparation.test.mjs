import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';

const current={organizationId:'old-org',shopId:'old-shop',locale:'es-ES',currency:'EUR',country:'ES',channel:'admin'};
const target={organizationId:'new-org',shopId:'new-shop'};
function fixture(shop={...target,id:target.shopId,locale:'en-US',currency:'USD',country:'US'}) {
  const calls=[];
  const actions=loadTs('src/modules/configuracion/shop-read-preparation-actions.ts',{
    '../../shared/config/admin-context':{getAdminContext:async()=>current,hasRequiredAdminContext:c=>Boolean(c.organizationId&&c.shopId)},
    './organization-shop':{resolveShopContextById:async(...args)=>{calls.push({resolve:args});return {ok:true,shop};},shopToContext:(s,c)=>({...c,...s,shopId:s.id})},
    '../../shared/bff/admin-client':{requestAdminBff:async(path,options)=>{calls.push({path,options});return {ok:true,data:options.parse({requestId:null,...target,state:'FAILED',phase:'SNAPSHOT',attempts:1,updatedAt:'2026-11-05T12:00:00Z',code:'PREPARATION_FAILED',context:{locale:'en-US',currency:'USD',country:'US',channel:'web'}})};}},
  });
  return {actions,calls};
}
test('creation preparation resolves the newly created shop without switching the active shop',async()=>{
  const {actions,calls}=fixture();
  const result=await actions.getShopReadPreparationAction(target);
  assert.equal(result.ok,true);
  assert.deepEqual(calls[0].resolve,['new-org','new-shop']);
  assert.match(calls[1].path,/shops\/new-shop\/read-preparation/);
  const query=new URLSearchParams(calls[1].path.split('?')[1]);
  assert.equal(query.get('currency'),'USD');
  assert.equal(query.get('channel'),'web');
  assert.equal(current.shopId,'old-shop');
});
test('recovery sends retry to the same shop, never creates it again',async()=>{
  const {actions,calls}=fixture();
  await actions.prepareShopReadsAction(target);
  assert.equal(calls.length,2);
  assert.equal(calls[1].options.init.method,'POST');
  assert.deepEqual(JSON.parse(calls[1].options.init.body),{retry:true});
  assert.match(calls[1].path,/\/new-shop\/read-preparation\?/);
});
test('rejects invalid targets and mismatched or incomplete resolved contexts before preparation',async()=>{
  const invalid=fixture();
  assert.equal((await invalid.actions.prepareShopReadsAction({...target,shopId:'../other'})).ok,false);
  assert.equal(invalid.calls.length,0);
  for(const shop of [{...target,id:'other'},{...target,id:target.shopId,locale:'en-US',currency:'USD'}]){
    const {actions,calls}=fixture(shop);
    assert.equal((await actions.prepareShopReadsAction(target)).ok,false);
    assert.equal(calls.length,1);
  }
});

test('successful creation opens completion for its own shop even when not selected as active',async()=>{
  for(const activate of [false,true]) {
    const saved=[],calls=[];
    const actions=loadTs('src/modules/configuracion/context-actions.ts',{
      'next/cache':{revalidatePath:()=>{}},
      'next/navigation':{redirect:url=>{throw Object.assign(new Error('redirect'),{url});}},
      '../../shared/auth/session':{getAdminSession:async()=>null},
      '../../shared/config/admin-context':{getAdminContext:async()=>current,saveAdminContext:async c=>saved.push(c)},
      '../../shared/config/env':{defaultAdminContext:current},
      './organization-shop':{shopToContext:(s,c)=>({...c,...s,shopId:s.id})},
      '../../shared/bff/admin-client':{requestAdminBff:async(path,options)=>{calls.push(path);return {ok:true,data:options.parse({...target,shopId:target.shopId,name:'USA',effectiveSettings:{defaultLocale:'en-US',defaultCurrency:'USD',defaultCountry:'US'}})};}},
    });
    const form=new FormData();
    for(const [k,v] of Object.entries({organizationId:target.organizationId,name:'USA',shopAlias:'usa',locale:'en-US',currency:'USD',country:'US'}))form.set(k,v);
    if(activate)form.set('setActive','on');
    await assert.rejects(actions.createShopAction(form),error=>{
      const url=new URL(error.url,'http://ui.test');
      assert.equal(url.searchParams.get('tab'),'create-shop');
      assert.equal(url.searchParams.get('preparationShopId'),target.shopId);
      assert.equal(url.searchParams.get('preparationOrganizationId'),target.organizationId);
      return true;
    });
    assert.equal(calls.length,1);
    assert.equal(saved.length,activate?1:0);
  }
});
