import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import Ajv from 'ajv';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/modules/cms/cms-template-create.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto:globalThis.crypto});
const create=exports.newCompositionTemplateCommand;
const schema=JSON.parse(readFileSync('docs/contracts/cms-composition-boundary.schema.json','utf8'));
const validate=new Ajv({allErrors:true}).compile({definitions:schema.definitions,$ref:'#/definitions/templateCreate'});
test('blank section and page templates match BFF contract with independent operation identities',()=>{
  for(const kind of ['SECTION','PAGE']){
    const one=create(kind,'  Nueva plantilla  '),two=create(kind,'Nueva plantilla');
    assert.equal(validate(one),true,JSON.stringify(validate.errors));
    assert.equal(one.document.name,'Nueva plantilla');
    assert.equal(one.document.content.kind,kind);
    assert.notEqual(one.operationId,two.operationId);
    if(kind==='SECTION'){
      assert.equal(one.document.content.value.root.children.length,0);
      assert.notEqual(one.document.content.value.root.nodeId,two.document.content.value.root.nodeId);
    }else assert.equal(one.document.content.value.sections.length,0);
  }
});
test('template creation rejects blank names, multiline names, oversized names and unsupported types',()=>{
  for(const name of ['  ','x'.repeat(257),'a\nb'])assert.throws(()=>create('SECTION',name));
  assert.throws(()=>create('MODULE','Name'));
});
