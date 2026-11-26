import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
function fixture(valid=true){
  let creates=0;
  const actions=loadTs('src/modules/catalogo/media-admin-actions.ts',{
    'next/cache':{revalidatePath:()=>{}},
    'next/navigation':{redirect:url=>{throw Object.assign(new Error('redirect'),{url});}},
    '../../shared/config/admin-context':{getAdminContext:async()=>({organizationId:'org',shopId:'shop',locale:'es-ES'})},
    '../../shared/security/media-upload':{validateMediaUploads:async files=>valid?{ok:true,files}:{ok:false,error:'Archivo no admitido'}},
    './media-admin':{createMediaCollection:async()=>{creates++;return {ok:true,data:{mediaCollectionId:'created/1'}};}},
  });
  return {actions,count:()=>creates};
}
function form(){const f=new FormData();f.set('productId','product');f.set('title','Galeria');f.set('returnPath','/admin/catalogo/media?q=Galeria&status=all&drawer=create');f.set('files',new File(['x'],'safe.png',{type:'image/png'}));return f;}
test('media creation closes its drawer and selects the created collection without losing filters',async()=>{
  const {actions,count}=fixture();
  await assert.rejects(actions.createMediaCollectionAction(form()),error=>{
    const url=new URL(error.url,'http://ui.test');
    assert.equal(url.searchParams.has('drawer'),false);
    assert.equal(url.searchParams.get('collectionId'),'created/1');
    assert.equal(url.searchParams.get('q'),'Galeria');
    assert.equal(url.searchParams.get('status'),'all');
    return true;
  });
  assert.equal(count(),1);
});
test('rejected upload stays in the creation drawer and never calls the collection BFF',async()=>{
  const {actions,count}=fixture(false);
  await assert.rejects(actions.createMediaCollectionAction(form()),error=>{
    const url=new URL(error.url,'http://ui.test');
    assert.equal(url.searchParams.get('drawer'),'create');
    assert.equal(url.searchParams.get('mediaMessage'),'Archivo no admitido');
    return true;
  });
  assert.equal(count(),0);
});
