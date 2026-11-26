import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const source=readFileSync(new URL("../src/shared/config/storefront-commercial-policy.ts",import.meta.url),"utf8");
const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports},URL,process:{env:{}}});
const select=exports.withStorefrontCommercialPolicy;
const env={ECOMMIUM_STOREFRONT_ORGANIZATION_ID:"org",ECOMMIUM_STOREFRONT_SHOP_ID:"shop",ECOMMIUM_STOREFRONT_TRADE_POLICY:"b2c"};
test("explicit deployment policy reaches every commercial stage for its canonical shop",()=>{
 for(const route of ["/storefront/pdp/p","/storefront/plp/c","/storefront/page","/storefront/search","/orderforms/current","/storefront/checkout/context","/payments/transactions","/orders"]){
  const url=new URL(select(route+"?organizationId=org&shopId=shop&currency=GBP",env),"http://test");
  assert.equal(url.searchParams.get("tradePolicy"),"b2c");assert.equal(url.searchParams.get("currency"),"GBP");
 }
});
test("policy has no implicit default and never leaks into another shop or technical calls",()=>{
 const p="/orderforms/current?organizationId=org&shopId=other";
 assert.equal(select(p,env),p);
 assert.equal(select("/orderforms/current?organizationId=org&shopId=shop",{}),"/orderforms/current?organizationId=org&shopId=shop");
 assert.equal(select("/storefront/context/resolve?organizationId=org&shopId=shop",env),"/storefront/context/resolve?organizationId=org&shopId=shop");
});
test("policy rejects missing tenant, malformed identifiers and conflicting selection",()=>{
 assert.throws(()=>select("/orders",{ECOMMIUM_STOREFRONT_TRADE_POLICY:"b2c"}));
 assert.throws(()=>select("/orders",{...env,ECOMMIUM_STOREFRONT_TRADE_POLICY:"invalid policy"}));
 assert.throws(()=>select("/orders?organizationId=org&shopId=shop&tradePolicy=other",env));
});
