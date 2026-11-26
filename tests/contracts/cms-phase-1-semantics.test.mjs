// Cross-repository contract conformance. Executes existing owner validators,
// not copies of their CSS / asset / binding implementation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const require=createRequire(import.meta.url);
const uiRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const backend=process.env.ECOMMIUM_CONTRACT_BACKEND_ROOT || path.resolve(uiRoot,'../ecommium/composable_ecommerce');
const ownerRequire=createRequire(path.join(backend,'services/cms/package.json'));
ownerRequire('ts-node').register({compiler:ownerRequire.resolve('typescript'),skipProject:true,transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node',target:'ES2021',experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}});
const visual=ownerRequire('./src/domain/page/visual-module.value-object.ts');
const sheet=ownerRequire('./src/domain/layout/cms-style-sheet.value-object.ts');
const bff=require(path.join(backend,'apps/bff/src/modules/cms/application/validators/cms-visual-module-payload.validator.ts'));
const Ajv=require('ajv');
const schema=JSON.parse(readFileSync(path.join(uiRoot,'docs/contracts/cms-composition-boundary.schema.json')));
const validate=new Ajv({allErrors:true}).compile({$schema:schema.$schema,definitions:schema.definitions,$ref:'#/definitions/module'});
const sample=()=>({instanceId:'instance',name:'Card',body:{kind:'visual',value:{schemaVersion:2,moduleId:'card',type:'container',panels:[{panelId:'panel',elements:[{elementId:'text',elementType:'heading',props:{text:'Heading'}}]}],contentSchema:{}}}});
function validateModule(module){
 if(!validate(module))throw Error('shape');
 if(module.body.kind==='visual'){
  const assets=new Set((module.body.value.assetRefs??[]).map(asset=>asset.assetKey));
  const walk=value=>{
   if(!value||typeof value!=='object')return;
   for(const [key,item] of Object.entries(value)){
    if(['src','backgroundImage'].includes(key)&&typeof item==='string'&&item.startsWith('asset:')&&!assets.has(item.slice(6)))throw Error('unknown local asset');
    walk(item);
   }
  };
  walk(module.body.value);
  for(const [key,field] of Object.entries(module.body.value.contentSchema??{})){
    const value=module.body.value.contentValues?.[key];
    if(field.type==='media'&&typeof value==='string'&&value.startsWith('asset:')&&!assets.has(value.slice(6)))throw Error('unknown bound asset');
  }
  bff.assertCmsVisualModuleV2PayloadSafe(module.body.value);
  visual.normalizeCmsVisualModuleV2Props(module.body.value);
 }
 if(module.styleSheet)sheet.normalizeCmsStyleSheet(module.styleSheet);
 return true;
}
test('canonical visual snapshot passes schema, BFF and CMS',()=>assert.equal(validateModule(sample()),true));
test('unknown nested keys and incompatible functional shape rejected',()=>{
 for(const mutate of [m=>m.body.value.panels[0].elements[0].unexpected=true,m=>m.body.value.styles={other:{color:'red'}},m=>m.body.value.contentSchema={title:{type:'text',required:true,extra:'ignored'}}]){
  const m=sample();mutate(m);assert.throws(()=>validateModule(m),/shape/);
 }
 assert.throws(()=>validateModule({instanceId:'i',name:'FAQ',body:{kind:'registered',type:'accordion',props:{items:[{html:'untyped'}]}}}),/shape/);
});
test('contract rejects duplicate identities, missing content and asset bindings',()=>{
 for(const mutate of [m=>m.body.value.panels[0].elements[0].elementId='panel',m=>m.body.value.panels[0].elements[0].contentBinding='missing',m=>m.body.value.panels[0].elements[0].props={src:'asset:missing'}]){
  const m=sample();mutate(m);assert.throws(()=>validateModule(m));
 }
});
test('CSS declarations, selectors and executable links use owner validation',()=>{
 for(const mutate of [m=>m.body.value.styles={base:{color:'red;display:none'}},m=>m.body.value.panels[0].elements[0].props={href:'javascript:alert(1)'},m=>m.styleSheet={base:[{selector:':scope + body',styles:{color:'red'}}]},m=>m.styleSheet={base:[{selector:'a',styles:{backgroundImage:'url(https://example.com/a.png)'}}]}]){
  const m=sample();mutate(m);assert.throws(()=>validateModule(m));
 }
 const m=sample();m.styleSheet={mobile:[{selector:':scope',styles:{paddingTop:'8px'}}]};assert.equal(validateModule(m),true);
});
test('Media identity is preserved while unavailable references are rejected',()=>{
 const m=sample();m.body.value.assetRefs=[{assetKey:'photo',mediaAssetId:'asset-qa',src:'https://example.com/photo.png',role:'image'}];
 m.body.value.panels[0].elements[0]={elementId:'image',elementType:'image',props:{src:'asset:photo',alt:'Sample'}};
 assert.equal(validateModule(m),true);
 const normalized=visual.normalizeCmsVisualModuleV2Props(m.body.value);
 assert.equal(normalized.assetRefs[0].mediaAssetId,'asset-qa');
 assert.throws(()=>visual.normalizeCmsPresentation({styles:{base:{backgroundImage:'asset:absent'}}}));
});
test('each functional type has a closed payload shape',()=>{
 const examples={
  'banner.hero':{heading:'Hero'},
  'slider.fullWidth':{slides:[{title:'Slide'}]},
  'category.imageTiles':{items:[{title:'Category',href:'/category'}]},
  'plp.categoryIntro':{heading:'Category'},
  'plp.subcategoryTiles':{heading:'Children',items:[{title:'Child',href:'/child'}]},
  accordion:{heading:'FAQ',items:[{title:'Question',content:'Answer'}]},
  carousel:{heading:'Cards',items:[{title:'Card'}]},
  'commerce.productGrid':{source:{kind:'CATEGORY',categorySlug:'bikes'},limit:8},
 };
 for(const [type,props] of Object.entries(examples)){
  const m={instanceId:'i',name:'Functional',body:{kind:'registered',type,props}};
  assert.equal(validateModule(m),true,type);
  props.hydratedProducts=[];
  assert.throws(()=>validateModule(m),/shape/,type);
 }
});
test('bounded representative composition serializes and normalizes all module bodies',()=>{
 const start=performance.now();let bytes=0;
 for(let i=0;i<120;i++){
  const m=sample();m.instanceId=`i-${i}`;m.body.value.moduleId=`module-${i}`;
  const serialized=JSON.stringify(m);bytes+=Buffer.byteLength(serialized);
  assert.equal(validateModule(JSON.parse(serialized)),true);
 }
 assert.ok(bytes<1048576);
 console.log(JSON.stringify({sample:'120 independent small module payloads',bytes,elapsedMs:Math.round(performance.now()-start),scope:'schema/BFF/CMS normalization; not browser performance'}));
});


test('new contract rejects the empty-asset-list loophole observed in the current owner',()=>{
 const m=sample();m.body.value.panels[0].elements[0].props={src:'asset:missing'};
 assert.doesNotThrow(()=>visual.normalizeCmsVisualModuleV2Props(m.body.value));
 assert.throws(()=>validateModule(m),/unknown local asset/);
});


test('functional URLs reject executable schemes and private Admin proxies',()=>{
 const m={instanceId:'i',name:'Hero',body:{kind:'registered',type:'banner.hero',props:{heading:'Hero',ctaHref:'javascript:alert(1)'}}};
 assert.throws(()=>validateModule(m),/shape/);
 m.body.props.ctaHref='/catalog';m.body.props.imageUrl='/api/admin/media-assets/private/content';
 assert.throws(()=>validateModule(m),/shape/);
 m.body.props.imageUrl='https://example.com/image.png';
 assert.equal(validateModule(m),true);
});


test('media content bindings require a local asset even with an empty asset list',()=>{
 const m=sample();m.body.value.contentSchema={photo:{type:'media',required:true}};m.body.value.contentValues={photo:'asset:missing'};
 assert.throws(()=>validateModule(m),/unknown bound asset/);
});
