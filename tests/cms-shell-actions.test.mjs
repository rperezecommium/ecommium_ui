import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const context={organizationId:'org',shopId:'shop',locale:'es-ES'};
const baseline={revisionId:'r1',updatedAt:'2026-11-23T00:00:00.000Z'};
const layout={regions:{header:{areas:[{areaId:'header-main',containerMode:'full-width',columns:['100%']}]}}};
const blocks=[{blockId:'search',type:'cms.section',props:{contractVersion:1,document:{sectionId:'cms-section',name:'Search',root:{nodeId:'cms-root',kind:'module',module:{instanceId:'cms-module',name:'Search',body:{kind:'registered',type:'commerce.search',props:{placeholder:'Buscar'}}}}}}}];
function fixture({permissions=['cms.settings.write','cms.pages.publish'],conflict=false,discarded=false,publishFailure=false,wrongSavedResource=false,wrongPublishedRevision=false,wrongPublishedResource=false}={}) {
 const calls=[];let saved;
 const api=loadTs('src/modules/cms/cms-shell-composition-actions.ts',{
  '../auth/current-admin-session':{getCurrentAdminSession:async()=>({scope:'admin',permissions})},
  '../../shared/config/admin-context':{getAdminContext:async()=>context},
  './cms-admin':{
   getCmsSitePart:async(_context,id)=>{calls.push(['get',id]);return {ok:true,data:{sitePartId:id,kind:'HEADER',latestRevision:{...baseline,layout,blocks:blocks}}};},
   updateCmsSitePartDraft:async(_context,id,payload)=>{calls.push(['save',id,payload]);saved={revisionId:'r1',updatedAt:'2026-11-23T00:00:00.001Z',status:'DRAFT',layout:payload.layout,blocks:discarded?[]:payload.blocks};return conflict?{ok:false,error:'revision conflict',status:409}:{ok:true,data:{sitePartId:wrongSavedResource?'other':id,latestRevision:saved}};},
   publishCmsSitePart:async(_context,id,_locale,expected)=>{calls.push(['publish',id,expected]);return publishFailure?{ok:false,error:'Publicación rechazada'}:{ok:true,data:{sitePartId:wrongPublishedResource?'other':id,activeRevisionId:wrongPublishedRevision?'other':'r1',latestRevision:{...saved,status:'ACTIVE'}}};},
  },
 });return {api,calls};
}
test('modern shell publication saves with CAS and publishes only the confirmed revision',async()=>{
 const {api,calls}=fixture();assert.equal((await api.publishCmsShellSectionsAction('copy',blocks,baseline,context,{})).ok,true);
 assert.deepEqual(calls.map(call=>call[0]),['get','save','publish']);assert.deepEqual(calls[1][2].expectedRevision,baseline);
 assert.deepEqual(calls[2][2],{revisionId:'r1',updatedAt:'2026-11-23T00:00:00.001Z'});
});
test('modern publication requires its separate permission and never publishes rejected or discarded content',async()=>{
 for(const options of [{permissions:['cms.settings.write']},{conflict:true},{discarded:true},{wrongSavedResource:true}]) {
  const {api,calls}=fixture(options);assert.equal((await api.publishCmsShellSectionsAction('copy',blocks,baseline,context,{})).ok,false);assert.equal(calls.some(call=>call[0]==='publish'),false);
 }
});
test('modern publication reports saved drafts on failure and rejects mismatched publication receipts',async()=>{
 for(const options of [{publishFailure:true},{wrongPublishedRevision:true},{wrongPublishedResource:true}]) {
  const {api,calls}=fixture(options),result=await api.publishCmsShellSectionsAction('copy',blocks,baseline,context,{});
  assert.equal(result.ok,false);assert.match(result.message,/publicación/);
  assert.deepEqual(calls.map(call=>call[0]),['get','save','publish']);
 }
});
