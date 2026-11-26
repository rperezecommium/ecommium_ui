import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/modules/storefront/rotate-purchased-cart.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports},URLSearchParams});
const rotate=exports.rotatePurchasedCart;
test("purchase completion only opens a new cart and preserves the paid cart",async()=>{
 const calls=[];const result=await rotate("paid","guest",async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({orderform:{orderFormId:"next",items:[]}})};});
 assert.equal(calls.length,1);assert.equal(new URL(calls[0].url,"http://test").searchParams.get("forceNewCart"),"true");assert.equal(calls[0].init.method,undefined);assert.equal(result.orderform.orderFormId,"next");
});
test("failed rollover does not silently confirm cleanup",async()=>{
 await assert.rejects(rotate("paid",undefined,async()=>({ok:false,json:async()=>({})})),/preparar/);
});
test("rollover requires a different empty canonical cart",async()=>{
 for(const cart of [{orderFormId:"paid",items:[]},{orderFormId:"next",items:[{}]},{items:[]}])await assert.rejects(rotate("paid",undefined,async()=>({ok:true,json:async()=>({orderform:cart})})),/nuevo y vacío/);
});
