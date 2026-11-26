import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTs } from './helpers/load-ts.mjs';

function fixture({ count = 0, conflict = false, unavailable = false, wrongIdentity = false, permissions=['cms.settings.write','cms.pages.read'] } = {}) {
  const calls = [];
  const actions = loadTs('src/modules/cms/cms-site-parts-actions.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect(destination) { throw { destination }; } },
    '../../shared/config/admin-context': { getAdminContext: async () => ({ organizationId: 'org', shopId: 'shop', locale: 'es-ES' }) },
    '../auth/current-admin-session': {getCurrentAdminSession:async()=>({scope:'admin',permissions})},
    './cms-admin': {
      getCmsSitePart: async () => ({ ok: true, data: { sitePartId: wrongIdentity ? 'other' : 'part', kind: 'HEADER', name: 'test_header' } }),
      getCmsSitePartUsage: async () => unavailable ? { ok: false } : { ok: true, data: { count } },
      deleteCmsSitePart: async () => { calls.push('DELETE'); return conflict ? { ok: false, status: 409 } : { ok: true }; },
      saveCmsShellAssignment: async (_context, payload) => { calls.push(payload); return { ok: true }; },
      listCmsShellAssignmentPages:async(context,offset)=>{calls.push({context,offset});return {ok:true,data:{items:[],total:51,limit:50,offset}};},
    },
  });
  return { actions, calls };
}
function form() {
  const result = new FormData();
  for (const [key, value] of Object.entries({ sitePartId: 'part', kind: 'HEADER', locale: 'fr-FR', confirmName: 'test_header' })) result.set(key, value);
  return result;
}
test('deletion requires the current exact name and identity', async () => {
  for (const wrongIdentity of [false, true]) {
    const { actions, calls } = fixture({ wrongIdentity }); const data = form();
    if (!wrongIdentity) data.set('confirmName', 'wrong');
    assert.ok((await actions.deleteCmsSitePartAction(data)).error);
    assert.equal(calls.length, 0);
  }
});
test('assigned or unverifiable usage never sends DELETE', async () => {
  for (const options of [{ count: 1 }, { unavailable: true }]) {
    const { actions, calls } = fixture(options);
    assert.ok((await actions.deleteCmsSitePartAction(form())).error);
    assert.equal(calls.length, 0);
  }
});
test('concurrent assignment conflict keeps the user in the confirmation flow', async () => {
  const { actions } = fixture({ conflict: true });
  assert.match((await actions.deleteCmsSitePartAction(form())).error, /uso|cambiado/);
});
test('successful deletion returns to the library without a stale selection', async () => {
  const { actions, calls } = fixture();
  await assert.rejects(actions.deleteCmsSitePartAction(form()), error => {
    const url = new URL(error.destination, 'https://ui.test');
    assert.equal(url.searchParams.get('tab'), 'library');
    assert.equal(url.searchParams.get('locale'), 'fr-FR');
    assert.equal(url.searchParams.has('sitePartId'), false);
    return true;
  });
  assert.deepEqual(calls, ['DELETE']);
});
test('explicit release sends null only for the selected kind', async () => {
  const { actions, calls } = fixture(); const data = form();
  data.set('selectedId', '__none__'); data.set('scope', 'DEFAULT'); data.set('breadcrumbMode', 'AUTO');
  await assert.rejects(actions.saveCmsShellAssignmentAction(data), error => Boolean(error.destination));
  assert.equal(calls[0].headerId, null); assert.equal('footerId' in calls[0], false);
});
test('page shell assignment changes only its chosen kind and preserves the selected page scope',async()=>{
 const {actions,calls}=fixture(),data=form();
 data.set('scope','PAGE');data.set('scopeKey','landing');data.set('selectedId','new-header');data.set('breadcrumbMode','AUTO');
 await assert.rejects(actions.saveCmsShellAssignmentAction(data),error=>Boolean(error.destination));
 assert.equal(calls[0].scope,'PAGE');assert.equal(calls[0].scopeKey,'landing');assert.equal(calls[0].headerId,'new-header');assert.equal('footerId' in calls[0],false);
});
test('read-only Employee cannot change a shell assignment',async()=>{
 const {actions,calls}=fixture({permissions:['cms.settings.read','cms.pages.read']});
 await assert.rejects(actions.saveCmsShellAssignmentAction(form()),/permiso/);assert.equal(calls.length,0);
});
test('page options use bounded pagination and refuse a changed context before BFF access',async()=>{
 const {actions,calls}=fixture({permissions:['cms.pages.read']}),context={organizationId:'org',shopId:'shop',locale:'es-ES'};
 assert.equal((await actions.loadCmsShellAssignmentPagesAction({...context,shopId:'other'},0)).ok,false);
 assert.equal((await actions.loadCmsShellAssignmentPagesAction(context,-1)).ok,false);assert.equal(calls.length,0);
 const result=await actions.loadCmsShellAssignmentPagesAction(context,50);assert.equal(result.ok,true);assert.equal(result.data.limit,50);assert.equal(calls[0].offset,50);
});
test('deletion client rejects false or mismatched receipts', async () => {
  const blocks = loadTs('packages/cms-blocks/src/index.ts');
  for (const data of [{ sitePartId: 'other', deleted: true }, { sitePartId: 'part', deleted: false }]) {
    let endpoint;
    const admin = loadTs('src/modules/cms/cms-admin.ts', { 'server-only': {}, './cms-blocks': blocks, '../../shared/bff/admin-client': { requestAdminBff: async (path, options) => {
      endpoint = path; assert.equal(options.init.method, 'DELETE');
      assert.throws(() => options.parse(data)); return { ok: false };
    } } });
    await admin.deleteCmsSitePart({ organizationId: 'org', shopId: 'shop' }, 'part', 'fr-FR');
    assert.match(endpoint, /organizationId=org&shopId=shop&locale=fr-FR/);
  }
});
