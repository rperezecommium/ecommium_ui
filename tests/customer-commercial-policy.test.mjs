import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../src/modules/clientes/customer-commercial-policy.ts',import.meta.url),'utf8');
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports}});
const parse=exports.parseCommercialPolicy;
test('commercial policy keeps manual groups separate from registered and B2B defaults',()=>{
  const result=parse({policy:{allowedGroups:['vip','b2b-pro'],registeredGroup:null,b2bGroup:'b2b-pro'},revision:0,internal:'discard'});
  assert.equal(result.policy.registeredGroup,null);assert.equal(result.internal,undefined);
});
for(const policy of [{allowedGroups:['vip','vip'],registeredGroup:null,b2bGroup:null},{allowedGroups:['vip'],registeredGroup:null,b2bGroup:'b2b-pro'},{allowedGroups:['b2b-pro'],registeredGroup:'b2b-pro',b2bGroup:'b2b-pro'},{allowedGroups:['bad code'],registeredGroup:null,b2bGroup:null}])test('commercial policy rejects invalid combinations '+JSON.stringify(policy),()=>assert.throws(()=>parse({policy,revision:0})));
