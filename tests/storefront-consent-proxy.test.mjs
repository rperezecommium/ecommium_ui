import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/modules/storefront/storefront-consent-proxy.ts", import.meta.url),
  "utf8",
);

test("Consent same-origin proxy remains a constrained Storefront BFF transport", () => {
  assert.match(source, /getStorefrontBffBaseUrl/);
  assert.match(source, /\/storefront\/consent\/\$\{path\}/);
  assert.match(source, /validateSameOriginMutation\(publicRequest\)/);
  assert.match(source, /getStorefrontContext\(\)/);
  assert.match(source, /ec_consent_subject/);
  assert.match(source, /attribute\.startsWith\("domain="\)/);
  assert.match(source, /process\.env\.NODE_ENV !== "production" \|\| normalized\.includes\("secure"\)/);
  assert.doesNotMatch(source, /services\/consent|CONSENT_INTERNAL_TOKEN|localStorage|sessionStorage/);
});

test("Consent proxy accepts only the published decision shape and no arbitrary forwarding", () => {
  assert.match(source, /const decisionKeys = new Set/);
  assert.match(source, /Object\.keys\(value\)\.some\(\(key\) => !decisionKeys\.has\(key\)\)/);
  assert.match(source, /value\.selections\.length > 64/);
  assert.match(source, /AbortSignal\.timeout\(15_000\)/);
  assert.match(source, /Cache-Control": cacheControl/);
});

// Exercise the actual transport with an internal Next URL and public Host.
import vm from "node:vm";
import ts from "typescript";
function transport({host="shop.example.test:9443",origin,configured="https://shop.example.test:9443",shopId="shop",fetchSite="same-origin"}={}) {
  const environment={NODE_ENV:"production",ECOMMIUM_UI_STOREFRONT_ORIGIN:configured};
  const calls=[];
  const securitySource=readFileSync(new URL("../src/shared/security/request-security.ts",import.meta.url),"utf8");
  const compile=value=>ts.transpileModule(value,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const security={};vm.runInNewContext(compile(securitySource),{exports:security,process:{env:environment},URL,TextEncoder});
  const exports={};
  vm.runInNewContext(compile(source),{exports,process:{env:environment},URL,URLSearchParams,Request,Response,Headers,AbortSignal,crypto,
    require:name=>name.includes("storefront-env")?{getStorefrontBffBaseUrl:()=>"https://api.example.test/api/v1"}:name.includes("storefront-context")?{getStorefrontContext:async()=>({organizationId:"org",shopId:"shop",locale:"es-ES"})}:security,
    fetch:async(url,options)=>{calls.push({url,options});return Response.json({status:"NOT_CONFIGURED",snapshot:null,decision:null,renewalRequired:false},{headers:{"content-type":"application/json"}});}
  });
  const request=decision=>new Request("http://0.0.0.0:8080/api/v1/storefront/consent/"+(decision?"decisions":"policy")+"?organizationId=org&shopId="+shopId+(decision?"":"&locale=es-ES"),{method:decision?"POST":"GET",headers:{host,...(origin?{origin}:{}),"sec-fetch-site":fetchSite,"content-type":"application/json"},...(decision?{body:JSON.stringify({configurationVersionId:"version",configurationVersion:1,snapshotFingerprint:"fingerprint",effectiveLocale:"es-ES",action:"REJECT_ALL",selections:[],origin:"BANNER",idempotencyKey:"11111111-1111-4111-8111-111111111111"})}:{})});
  return {calls,policy:()=>exports.proxyConsentPolicy(request(false)),decision:()=>exports.proxyConsentDecision(request(true))};
}
test("internal Next address accepts only the configured public Host",async()=>{
 const t=transport();assert.equal((await t.policy()).status,200);assert.equal(t.calls.length,1);assert.equal(t.calls[0].options.headers.get("host"),"shop.example.test:9443");
 for(const host of ["evil.example.test:9443","shop.example.test:9444","shop.example.test:9443,evil.test","admin.example.test:9443"]){const denied=transport({host});assert.equal((await denied.policy()).status,503);assert.equal(denied.calls.length,0);}
});
test("public same-origin decision survives reverse proxy; foreign or absent origin stays rejected",async()=>{
 const t=transport({origin:"https://shop.example.test:9443"});assert.equal((await t.decision()).status,200);assert.equal(t.calls.length,1);
 for(const options of [{origin:"https://evil.test"},{origin:"http://shop.example.test:9443"},{origin:"https://shop.example.test:9444"},{},{origin:"https://shop.example.test:9443",fetchSite:"cross-site"}]){const denied=transport(options);assert.equal((await denied.decision()).status,403);assert.equal(denied.calls.length,0);}
});
test("invalid configured origin and different Shop cannot reach BFF",async()=>{
 for(const configured of ["http://shop.example.test:9443","https://user:password@shop.example.test:9443","https://shop.example.test:9443/path","https://shop.example.test:9443?q=1"]){const t=transport({configured});assert.equal((await t.policy()).status,503);assert.equal(t.calls.length,0);}
 const t=transport({shopId:"other-shop"});assert.equal((await t.policy()).status,400);assert.equal(t.calls.length,0);
});
