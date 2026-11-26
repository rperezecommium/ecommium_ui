// Executable specification only. Not wired to any production route.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const Ajv = require('ajv');
const schema = JSON.parse(readFileSync(new URL('../../docs/contracts/cms-composition-boundary.schema.json', import.meta.url)));
const validateShape = new Ajv({ allErrors: true }).compile(schema);
const MAX_BYTES = 1048576;

// Cross-node requirements that JSON Schema cannot express. This harness does
// not implement module/CSS semantic validation, CAS or ownership authorization.
function validateBoundary(input) {
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) throw Error('bytes');
  if (!validateShape(input)) throw Error('shape');
  const ids = new Set();
  let nodes = 0;
  const identity = id => { if (ids.has(id)) throw Error('duplicate'); ids.add(id); };
  function visit(node, depth) {
    if (depth > 8) throw Error('depth');
    if (++nodes > 120) throw Error('nodes');
    identity(node.nodeId);
    if (node.kind === 'container') node.children.forEach(child => visit(child, depth + 1));
    else {
      identity(node.module.instanceId);
      const body = node.module.body;
      if(body.kind==='visual'){
        identity(body.value.moduleId);
        const descend=value=>{
          if(!value||typeof value!=='object')return;
          for(const [key,item] of Object.entries(value)){
            if(key==='panelId'||key==='elementId')identity(item);
            if(['panels','elements','children'].includes(key))item.forEach(descend);
          }
        };
        descend(body.value);
      }
      if (body.kind === 'visual' && ('definitionId' in body.value || body.value.visualDefinitionReference)) throw Error('live-reference');
    }
  }
  for (const section of input.document.sections) {
    identity(section.sectionId);
    visit(section.root, 1);
  }
  return true;
}
const container = (id, children = []) => ({ nodeId: id, kind: 'container', layout: 'grid', presentation: {}, children });
const request = () => ({ contractVersion: 1, expectedRevision: 'opaque', document: { compositionSchemaVersion: 1, sections: [{ sectionId: 's', name: 'Section', root: container('root') }] } });

test('request and receipt have distinct strict envelopes', () => {
  const draft = request();
  assert.equal(validateBoundary(draft), true);
  const receipt = { contractVersion: 1, resourceId: 'p', revisionToken: 'next', context: { organizationId: 'o', shopId: 's', locale: 'es-ES' }, state: 'DRAFT', document: draft.document };
  assert.equal(validateBoundary(receipt), true);
  for (const key of ['resourceId', 'revisionToken', 'context', 'document']) {
    const broken = structuredClone(receipt); delete broken[key];
    assert.throws(() => validateBoundary(broken), /shape/);
  }
  assert.throws(() => validateBoundary({ ...draft, organizationId: 'injected' }), /shape/);
  delete draft.expectedRevision;
  assert.throws(() => validateBoundary(draft), /shape/);
});
test('24 sections accepted; 25 rejected without truncation', () => {
  const draft = request();
  draft.document.sections = Array.from({length:24}, (_,i) => ({ sectionId:`s${i}`,name:'Section',root:container(`r${i}`) }));
  assert.equal(validateBoundary(draft), true);
  draft.document.sections.push({sectionId:'extra',name:'Extra',root:container('extra-root')});
  assert.throws(() => validateBoundary(draft), /shape/);
  assert.equal(draft.document.sections.length,25);
});
test('node budget applies to whole document and depth includes root', () => {
  const draft = request();
  draft.document.sections[0].root.children = Array.from({length:119}, (_,i) => container(`n${i}`));
  assert.equal(validateBoundary(draft), true);
  draft.document.sections.push({sectionId:'s2',name:'Second',root:container('r2')});
  assert.throws(() => validateBoundary(draft), /nodes/);
  const deep = request(); let node = deep.document.sections[0].root;
  for(let i=2;i<=8;i++){const child=container(`d${i}`);node.children=[child];node=child;}
  assert.equal(validateBoundary(deep), true);
  node.children=[container('d9')];
  assert.throws(() => validateBoundary(deep), /depth/);
});
test('duplicate identities and live visual references rejected', () => {
  const draft=request();draft.document.sections[0].root.children=[container('root')];
  assert.throws(() => validateBoundary(draft), /duplicate/);
  draft.document.sections[0].root.children=[{nodeId:'m',kind:'module',module:{instanceId:'i',name:'Card',body:{kind:'visual',value:{definitionId:'shared'}}}}];
  assert.throws(() => validateBoundary(draft), /shape/); // closed visual schema rejects definitionId before traversal
});
test('budget measures UTF-8 bytes, including embedded snapshots', () => {
  const draft=request();
  const modules = Array.from({length:2}, (_,index) => ({nodeId:`m${index}`,kind:'module',module:{instanceId:`i${index}`,name:'FAQ',body:{kind:'registered',type:'accordion',props:{heading:'FAQ',items:Array.from({length:120},()=>({title:'Q',content:''}))}}}}));
  draft.document.sections[0].root.children=modules;
  let room=MAX_BYTES-Buffer.byteLength(JSON.stringify(draft));
  const fields=modules.flatMap(node=>node.module.body.props.items);
  for(const field of fields){const length=Math.min(6000,room);field.content='a'.repeat(length);room-=length;}
  assert.equal(room,0);
  assert.equal(validateBoundary(draft),true);
  fields.at(-1).content+='é';
  assert.throws(()=>validateBoundary(draft),/bytes/);
});
test('unknown structural fields and unsupported versions fail closed', () => {
  const draft=request();draft.document.sections[0].root.hiddenPayload=true;
  assert.throws(()=>validateBoundary(draft),/shape/);
  delete draft.document.sections[0].root.hiddenPayload;
  draft.document.compositionSchemaVersion=2;
  assert.throws(()=>validateBoundary(draft),/shape/);
});


test('functional module payloads and envelopes reject unknown keys',()=>{
 const draft=request();
 const piece={instanceId:'i',name:'FAQ',body:{kind:'registered',type:'accordion',props:{heading:'FAQ',items:[{title:'Question',content:'Answer'}]}}};
 draft.document.sections[0].root.children=[{nodeId:'n',kind:'module',module:piece}];
 assert.equal(validateBoundary(draft),true);
 piece.body.props.items[0].onclick='execute';
 assert.throws(()=>validateBoundary(draft),/shape/);
 delete piece.body.props.items[0].onclick;
 assert.equal(validateShape({contractVersion:1,resourceKind:'MODULE',operationId:'12345678-1234-4234-8234-123456789abc',document:piece}),true);
 assert.equal(validateShape({contractVersion:1,resourceKind:'MODULE',document:piece}),false);
 assert.equal(validateShape({contractVersion:1,resourceKind:'MODULE',status:'DRAFT',resourceId:'r',revisionToken:'v',context:{organizationId:'o',shopId:'s'},document:piece}),true);
 assert.equal(validateShape({contractVersion:1,operation:'PUBLISH',operationId:'12345678-1234-4234-8234-123456789abc',expectedRevision:'v',versionId:'snapshot'}),true);
});


test('visual IDs are unique across copied module instances',()=>{
 const draft=request();
 const piece=index=>({nodeId:`n${index}`,kind:'module',module:{instanceId:`i${index}`,name:'Card',body:{kind:'visual',value:{schemaVersion:2,moduleId:`module${index}`,type:'container',panels:[{panelId:'shared-panel'}],contentSchema:{}}}}});
 draft.document.sections[0].root.children=[piece(1),piece(2)];
 assert.throws(()=>validateBoundary(draft),/duplicate/);
 draft.document.sections[0].root.children[1].module.body.value.panels[0].panelId='copy-panel';
 assert.equal(validateBoundary(draft),true);
});


test('section and template create/update/receipt envelopes require locale and concurrency',()=>{
 const section=request().document.sections[0];
 for(const [kind,document] of [['SECTION',section],['TEMPLATE',{name:'Template',content:{kind:'SECTION',value:section}}],['TEMPLATE',{name:'Page template',content:{kind:'PAGE',value:request().document}}]]){
  const create={contractVersion:1,resourceKind:kind,operationId:'12345678-1234-4234-8234-123456789abc',document};
  assert.equal(validateShape(create),true);
  assert.equal(validateShape({...create,expectedRevision:'also'}),false);
  const update={contractVersion:1,resourceKind:kind,expectedRevision:'expected',document};
  assert.equal(validateShape(update),true);
  const receipt={...(kind==='TEMPLATE'?{status:'DRAFT'}:{}),contractVersion:1,resourceKind:kind,resourceId:'r',revisionToken:'new',context:{organizationId:'o',shopId:'s',locale:'es-ES'},document};
  assert.equal(validateShape(receipt),true);
  delete receipt.context.locale;
  assert.equal(validateShape(receipt),false);
 }
 const publish={contractVersion:1,operation:'PUBLISH',operationId:'12345678-1234-4234-8234-123456789abc',expectedRevision:'expected',versionId:'selected'};
 for(const key of ['operationId','expectedRevision','versionId']){
  const missing={...publish};delete missing[key];assert.equal(validateShape(missing),false);
 }
});

test('template archive requires revision and template receipts require known state',()=>{
 const archive={contractVersion:1,resourceKind:'TEMPLATE',expectedRevision:'old'};
 assert.equal(validateShape(archive),true);
 assert.equal(validateShape({...archive,expectedRevision:undefined}),false);
 assert.equal(validateShape({...archive,document:{}}),false);
});
