import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {parseRemovalReview,parseRemovalReceipt}=loadTs('src/modules/catalogo/pricing-reviewed-removal-schema.ts');
const version='a'.repeat(64);
const amount={currency:'EUR',netAmountMinor:100,taxAmountMinor:21,grossAmountMinor:121,taxIncluded:false};
const review=()=>({impactVersion:version,affectedPrices:1,canConfirm:true,blockers:[],options:[{code:'new',name:'Sustituto'}],rows:[{pricingId:'p1',productId:'product1',variantId:null,currency:'EUR',active:true,before:amount,after:amount}]});
const expected={kind:'taxes',code:'old',impactVersion:version,replacementCode:'new'};
const receipt=()=>({...expected,reviewed:true,deleted:true,mode:'hard',remainingAssignments:0,affectedPrices:1,readStatus:'PENDING'});

test('review preserves typed monetary values and nested arrays',()=>{
 const value=parseRemovalReview(review());assert.equal(value.rows[0].before.grossAmountMinor,121);assert.equal(value.options[0].code,'new');
});
test('review rejects malformed rows, impossible amounts, contradictory permission and unsafe counts',()=>{
 for(const change of [{affectedPrices:-1},{affectedPrices:1.5},{impactVersion:'old'},{canConfirm:true,blockers:['MISSING']},{rows:[{...review().rows[0],before:{...amount,grossAmountMinor:122}}]},{rows:[{...review().rows[0],currency:'invalid'}]},{rows:[{...review().rows[0],active:'true'}]},{options:[{code:'new',name:'A'},{code:'new',name:'B'}]}])assert.throws(()=>parseRemovalReview({...review(),...change}));
});
test('receipt cannot confuse another operation or owner write with converged reads',()=>{
 assert.equal(parseRemovalReceipt(receipt(),expected).readStatus,'PENDING');
 for(const change of [{kind:'price-tables'},{code:'other'},{replacementCode:'other'},{affectedPrices:-1},{remainingAssignments:1},{deleted:false},{impactVersion:'b'.repeat(64)},{readStatus:'COMPLETE'}])assert.throws(()=>parseRemovalReceipt({...receipt(),...change},expected));
});
function actions(result){
 const calls=[];
 const actionModule=loadTs('src/modules/catalogo/pricing-reviewed-removal-actions.ts',{
  'next/navigation':{redirect(url){throw Object.assign(Error('redirect'),{url});}},
  'next/cache':{revalidatePath(){}},
  '../../shared/config/admin-context':{getAdminContext:async()=>({organizationId:'org',shopId:'shop'})},
  '../../shared/bff/admin-client':{requestAdminBff:async(path,options)=>{calls.push({path,body:JSON.parse(options.init.body)});if(!result.ok)return result;try{return {ok:true,data:options.parse(result.data)}}catch{return {ok:false,status:502}}}},
 });return {...actionModule,calls};
}
function form(){const f=new FormData();for(const [key,value]of Object.entries({...expected,confirm:'yes'}))f.set(key,value);return f;}
test('confirmation validates before sending and scopes the request using the session',async()=>{
 const api=actions({ok:true,data:receipt()});const f=form();f.set('organizationId','foreign');
 await assert.rejects(()=>api.confirmPricingRemoval(f),e=>{const url=new URL(e.url,'http://test');assert.match(url.searchParams.get('pricingMessage'),/pendiente de verificación/);return true});
 assert.match(api.calls[0].path,/organizationId=org&shopId=shop/);assert.equal('organizationId' in api.calls[0].body,false);
 for(const key of ['impactVersion','confirm']){const data=form();data.delete(key);const action=actions({ok:true,data:receipt()});await assert.rejects(()=>action.confirmPricingRemoval(data));assert.equal(action.calls.length,0);}
});
test('failed or malformed confirmation cannot claim a saved change',async()=>{
 for(const result of [{ok:false,status:409},{ok:false,status:403},{ok:true,data:{...receipt(),affectedPrices:-1}},{ok:true,data:{...receipt(),replacementCode:'other'}}]){
  const api=actions(result);await assert.rejects(()=>api.confirmPricingRemoval(form()),e=>{assert.match(new URL(e.url,'http://test').searchParams.get('pricingMessage'),/no se ha confirmado/);return true});
 }
});
