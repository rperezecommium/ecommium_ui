import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const source=readFileSync(new URL("../src/modules/storefront/storefront-commercial-context.ts",import.meta.url),"utf8");
function load(enabled,authorization) {
 let calls=0;const exports={};
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 vm.runInNewContext(outputText,{exports,module:{exports},process:{env:{ECOMMIUM_UI_VERIFIED_COMMERCIAL_CONTEXT_ENABLED:enabled}},require:()=>({getStorefrontCustomerAuthorizationHeader:async()=>{calls++;return authorization;}})});
 return {get:exports.getStorefrontCommercialReadOptions,calls:()=>calls};
}
test("commercial reads preserve anonymous behavior until coordinated activation",async()=>{const helper=load(undefined,"Bearer customer");assert.equal((await helper.get()).init,undefined);assert.equal(helper.calls(),0);});
test("commercial reads do not attach customer credentials when no customer session exists",async()=>{const helper=load("true",null);assert.equal((await helper.get()).init,undefined);});
test("commercial reads transmit only the customer bearer and disable shared fetch caching",async()=>{const result=await load("true","Bearer customer").get();assert.equal(result.withAuth,false);assert.equal(result.init.headers.authorization,"Bearer customer");assert.equal(result.init.headers["x-commercial-context-required"],"true");assert.equal(result.init.cache,"no-store");});
