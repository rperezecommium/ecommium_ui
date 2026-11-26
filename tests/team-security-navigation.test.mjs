import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';

const redirect=url=>{throw Object.assign(new Error('redirect'),{url});};
test('legacy security bookmarks preserve notices/errors within the Team security tab',async()=>{
  const page=loadTs('app/(admin)/admin/configuracion/seguridad/page.tsx',{'next/navigation':{redirect}}).default;
  await assert.rejects(page({searchParams:Promise.resolve({notice:'Identidad confirmada',error:'Acción fallida'})}),error=>{
    const url=new URL(error.url,'http://ui.test');
    assert.equal(url.pathname,'/admin/configuracion/equipo');
    assert.equal(url.searchParams.get('tab'),'security');
    assert.equal(url.searchParams.get('notice'),'Identidad confirmada');
    assert.equal(url.searchParams.get('error'),'Acción fallida');
    return true;
  });
});
test('security actions still use BFF and return through the compatible security route',async()=>{
  const calls=[];
  const actions=loadTs('src/modules/configuracion/admin-security-actions.ts',{
    'next/navigation':{redirect},
    '../../shared/bff/admin-client':{requestAdminBff:async(path,options)=>{calls.push({path,options});return {ok:true,data:{}};}},
  });
  const form=new FormData();form.set('sessionId','device/other');
  await assert.rejects(actions.revokeAdminDeviceSessionAction(form),error=>error.url.startsWith('/admin/configuracion/seguridad?notice='));
  assert.equal(calls[0].path,'/admin/sessions/device%2Fother/revoke');
  assert.equal(calls[0].options.init.method,'POST');
  const empty=new FormData();
  await assert.rejects(actions.verifyAdminStepUpAction(empty),error=>error.url.startsWith('/admin/configuracion/seguridad?error='));
  assert.equal(calls.length,1);
});
