import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const source = ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,structuredClone,crypto:globalThis.crypto,Map,Set,JSON,require:spec=>load(path.resolve(path.dirname(file),spec+'.ts'))});
  cache.set(file,exports);return exports;
}
const controls = load(path.resolve('src/modules/cms/cms-section-tree-controls.ts'));
const piece = id => ({nodeId:id,kind:'module',module:{instanceId:id,name:id,body:{kind:'registered',type:'accordion',props:{heading:id}}}});
const box = (id,children=[]) => ({nodeId:id,kind:'container',layout:'stack',presentation:{styles:{base:{padding:'12px'}}},children});
const sample = () => ({sectionId:'section',name:'QA',root:box('root',[box('a',[piece('one')]),piece('two'),box('b')])});
const ids = node => node.children.map(n=>n.nodeId).join(',');
test('row arrows reorder, nest in previous container and outdent with unchanged module snapshots',()=>{
  const doc=sample();const original=JSON.stringify(doc);
  const up=controls.moveSectionStep(doc,'two','up');assert.equal(ids(up.root),'two,a,b');
  assert.equal(ids(controls.moveSectionStep(up,'two','down').root),'a,two,b');
  const nested=controls.moveSectionStep(doc,'two','in');assert.equal(ids(nested.root),'a,b');assert.equal(ids(nested.root.children[0]),'one,two');
  const out=controls.moveSectionStep(nested,'two','out');assert.equal(ids(out.root),'a,two,b');
  assert.equal(JSON.stringify(out.root.children[1].module),JSON.stringify(doc.root.children[1].module));
  assert.equal(JSON.stringify(doc),original);
  assert.equal(controls.sectionStepDestination(doc.root,'root','out'),null);
  assert.equal(controls.sectionStepDestination(doc.root,'a','up'),null);
  assert.equal(controls.sectionStepDestination(doc.root,'b','down'),null);
});
test('drop before/after accounts for source removal and inside preserves child order',()=>{
  const doc=sample();
  assert.equal(ids(controls.dropSectionSpace(doc,'a','b','after').root),'two,b,a');
  assert.equal(ids(controls.dropSectionSpace(doc,'b','a','before').root),'b,a,two');
  const nested=controls.dropSectionSpace(doc,'a','b','inside');assert.equal(nested.root.children[1].children[0].nodeId,'a');
  assert.equal(nested.root.children[1].children[0].children[0].nodeId,'one');
  assert.equal(ids(controls.dropSectionSpace(doc,'two','a','inside').root.children[0]),'one,two');
});
test('root, self, descendants and module nesting are refused; depth limit retains original',()=>{
  const doc=sample();
  for(const [id,target,position] of [['root','a','inside'],['a','a','inside'],['a','one','before'],['two','one','inside'],['two','root','before']]) {
    assert.equal(controls.sectionDropDestination(doc.root,id,target,position),null);
    assert.throws(()=>controls.dropSectionSpace(doc,id,target,position));
  }
  let deep=box('deep');for(let i=0;i<6;i++)deep=box('deep'+i,[deep]);
  const limited={...doc,root:box('root',[deep,piece('two')])};
  assert.throws(()=>controls.dropSectionSpace(limited,'two','deep','inside'),/8 niveles/);
  assert.equal(limited.root.children[1].nodeId,'two');
});
test('removing module or container retains source and refuses root deletion',()=>{
  const doc=sample();
  assert.equal(controls.sectionSpaceCount(doc.root.children[0]),2);
  assert.equal(ids(controls.removeSectionSpace(doc,'a').root),'two,b');
  assert.equal(ids(controls.removeSectionSpace(doc,'two').root),'a,b');
  assert.equal(ids(doc.root),'a,two,b');
  assert.throws(()=>controls.removeSectionSpace(doc,'root'));
});

test('area references identify containers and module wrappers with safe stable selectors',()=>{
  const {sectionAreaReferences}=load(path.resolve('src/modules/cms/cms-section-area-reference.ts'));
  const doc=sample(), refs=sectionAreaReferences(doc.root);
  assert.equal(refs[0].label,'Contenedor principal');
  assert.equal(refs.find(r=>r.nodeId==='a').label,'Contenedor 1');
  assert.equal(refs.find(r=>r.nodeId==='one').kind,'module');
  assert.equal(refs.find(r=>r.nodeId==='two').selector,'[data-cms-node-id="two"]');
  assert.equal(refs.length,5);
  doc.root.children.push(piece('bad"]{color:red}'));
  assert.equal(sectionAreaReferences(doc.root).length,5);
});

test('plus creates a container in the requested parent, preserves source and validates budgets',()=>{
  const doc=sample(),before=JSON.stringify(doc);
  const rootChild=controls.addSectionContainer(doc,'root',()=> 'root-child');
  assert.equal(ids(rootChild.document.root),'a,two,b,root-child');
  const nested=controls.addSectionContainer(doc,'a',()=> 'nested-child');
  assert.equal(ids(nested.document.root.children[0]),'one,nested-child');
  assert.equal(nested.document.root.children[0].children[1].layout,'stack');
  assert.equal(JSON.stringify(doc),before);
  assert.throws(()=>controls.addSectionContainer(doc,'two'));
  assert.throws(()=>controls.addSectionContainer(doc,'missing'));
  assert.throws(()=>controls.addSectionContainer(doc,'root',()=> 'a'));
  const full={...doc,root:box('root',Array.from({length:119},(_,i)=>piece('n'+i)))};
  assert.throws(()=>controls.addSectionContainer(full,'root'));
  assert.equal(full.root.children.length,119);
});
