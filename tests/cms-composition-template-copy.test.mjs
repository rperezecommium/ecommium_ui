import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    structuredClone,
    TextEncoder,
    Map,
    Set,
    JSON,
    crypto: globalThis.crypto,
    require: (spec) => load(path.resolve(path.dirname(file), spec + ".ts")),
  });
  return exports;
}
const { copyTemplateContent, templateReceiptMatches } = load(path.resolve("src/modules/cms/cms-composition-template-copy.ts"));
const source = () => ({name:"Template",content:{kind:"PAGE",value:{compositionSchemaVersion:1,sections:[{sectionId:"section",name:"Section",root:{nodeId:"slot",kind:"module",module:{instanceId:"piece",name:"Card",body:{kind:"registered",type:"accordion",props:{heading:"FAQ",items:[]}}}}}],styleSheet:{base:[{selector:'#section [data-cms-node-id="slot"]',styles:{padding:"8px"}}]}}}});
test("independent page copies remap section/node/module identities and page CSS",()=>{
 const original=source();
 const first={name:original.name,content:copyTemplateContent(original.content)};
 const second={name:original.name,content:copyTemplateContent(original.content)};
 assert.equal(templateReceiptMatches(original,first),true);
 const a=first.content.value.sections[0],b=second.content.value.sections[0];
 assert.notEqual(a.sectionId,b.sectionId);
 assert.notEqual(a.root.nodeId,b.root.nodeId);
 assert.notEqual(a.root.module.instanceId,b.root.module.instanceId);
 assert.equal(first.content.value.styleSheet.base[0].selector,`#${a.sectionId} [data-cms-node-id="${a.root.nodeId}"]`);
 a.name="Changed";
 assert.equal(templateReceiptMatches(original,first),false);
 assert.equal(original.content.value.sections[0].name,"Section");
 assert.equal(b.name,"Section");
});
test("section copies carry only document data with no template reference",()=>{
 const original={name:"Template",content:{kind:"SECTION",value:source().content.value.sections[0]}};
 const copy={name:original.name,content:copyTemplateContent(original.content)};
 assert.equal(templateReceiptMatches(original,copy),true);
 assert.notEqual(copy.content.value.sectionId,original.content.value.sectionId);
 assert.deepEqual(Object.keys(copy.content).sort(),["kind","value"]);
 assert.equal(templateReceiptMatches(original,{...copy,name:"Other"}),false);
});
