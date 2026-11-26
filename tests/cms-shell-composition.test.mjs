import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file);
 if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));
 const exports={};cache.set(file,exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,structuredClone,Buffer,TextEncoder,crypto:globalThis.crypto,require:spec=>spec==='server-only'?{}:spec.startsWith('.')?load(path.resolve(path.dirname(file),spec+(path.extname(spec)?'':'.ts'))):require(spec)});
 return exports;
}
const {insertShellLibrarySection}=load(path.resolve('src/modules/cms/cms-shell-composition.ts'));
const {assertShellCompositionBlocks}=load(path.resolve('src/modules/cms/cms-shell-composition-validation.ts'));
const sectionBlocks=(type='commerce.search',props={placeholder:'Buscar productos'})=>[{blockId:'search',type:'cms.section',placement:{region:'header',areaId:'main',columnIndex:2,order:1},props:{contractVersion:1,document:{sectionId:'cms-section',name:'Search',root:{nodeId:'cms-root',kind:'container',layout:'stack',presentation:{},children:[{nodeId:'cms-node',kind:'module',module:{instanceId:'cms-module',name:'Search',body:{kind:'registered',type,props}}}]}}}}];
test('blank shell library insertion produces editable independent sections in the existing layout',()=>{
 const section=sectionBlocks()[0].props.document;
 const before=structuredClone(section);
 const first=insertShellLibrarySection(section,'HEADER','header-main',1),second=insertShellLibrarySection(section,'FOOTER','footer-main',2);
 assert.doesNotThrow(()=>assertShellCompositionBlocks([first]));
 assert.doesNotThrow(()=>assertShellCompositionBlocks([second]));
 assert.notEqual(first.props.document.sectionId,section.sectionId);
 assert.notEqual(first.props.document.root.children[0].module.instanceId,second.props.document.root.children[0].module.instanceId);
 first.props.document.root.children[0].module.body.props.placeholder='Buscar desde esta copia';
 assert.equal(second.props.document.root.children[0].module.body.props.placeholder,'Buscar productos');
 assert.equal(JSON.stringify(section),JSON.stringify(before));
 assert.equal(first.placement.region,'header');assert.equal(first.placement.areaId,'header-main');
 assert.equal(second.placement.region,'footer');assert.equal(second.placement.columnIndex,1);
 assert.throws(()=>insertShellLibrarySection(section,'HEADER','',1));
});
test('nested functional configuration is strict and rejects unsafe destinations and unknown props',()=>{
 for(const [type,props] of [['store.logo',{href:'//evil.test'}],['catalog.navigation',{items:[{label:'Unsafe',href:'javascript:alert(1)'}]}],['commerce.cart',{customerId:'other'}],['footer.social',{items:[{label:'Unsafe',href:'http://evil.test'}]}]]){
  assert.throws(()=>assertShellCompositionBlocks(sectionBlocks(type,props)));
 }
});
test('embedded section document and request budgets are enforced before transport',()=>{
 const copy=sectionBlocks();copy[0].props.document.extra='unexpected';assert.throws(()=>assertShellCompositionBlocks(copy));
 assert.throws(()=>assertShellCompositionBlocks(Array.from({length:25},()=>sectionBlocks()[0])));
});
const {resolveCmsDesignSettings,cmsDesignFromTokens}=load(path.resolve('packages/cms-blocks/src/design-settings.ts'));
const {updateModuleInstanceContent}=load(path.resolve('src/modules/cms/cms-module-instance-content.ts'));
test('design inheritance resolves per viewport and clearing an override restores its parent',()=>{
 const global=cmsDesignFromTokens({maxWidth:'1280px',defaultModuleGap:'24px',defaultColumnGap:'16px',colors:{foreground:'#111111',background:'#ffffff'}});
 const parent=resolveCmsDesignSettings(global,{mobile:{moduleGap:'8px'},base:{color:'#222222'}});
 const child=resolveCmsDesignSettings(parent,{base:{moduleGap:'12px'},mobile:{columnGap:'4px'}});
 assert.equal(child.mobile.moduleGap,'12px');assert.equal(child.desktop.moduleGap,'12px');assert.equal(child.mobile.columnGap,'4px');
 assert.equal(resolveCmsDesignSettings(parent,{}).mobile.moduleGap,'8px');
 assert.equal(parent.mobile.moduleGap,'8px');assert.equal(global.desktop.moduleGap,'24px');
 assert.equal(cmsDesignFromTokens({maxWidth:'url(javascript:x)',colors:{foreground:'red;position:fixed'}}).desktop.maxWidth,undefined);
});
test('registered instances change declared fields only and preserve independent design',()=>{
 const piece={instanceId:'cms-instance',name:'Search',editableFields:['placeholder'],designSettings:{mobile:{moduleGap:'8px'}},body:{kind:'registered',type:'commerce.search',props:{placeholder:'Buscar',presentation:{styles:{base:{padding:'4px'}}}}}};
 const before=structuredClone(piece),changed=updateModuleInstanceContent(piece,{placeholder:'Buscar bicicletas',presentation:{},customerId:'other'});
 assert.equal(changed.body.props.placeholder,'Buscar bicicletas');assert.deepEqual(changed.body.props.presentation,piece.body.props.presentation);assert.equal(changed.body.props.customerId,undefined);assert.deepEqual(piece,before);
 const blocks=sectionBlocks();blocks[0].props.document.root.children[0].module=changed;
 assert.doesNotThrow(()=>assertShellCompositionBlocks(blocks));
 changed.editableFields=['customerId'];assert.throws(()=>assertShellCompositionBlocks(blocks));
});
const {copyTemplateContent}=load(path.resolve('src/modules/cms/cms-composition-template-copy.ts'));
const {pageCompositionMatches,cmsPagePublicationIssues}=load(path.resolve('src/modules/cms/cms-page-composition.ts'));
const {validatePageContract}=load(path.resolve('src/modules/cms/cms-page-composition-validation.ts'));
test('page layout and independent PLP snapshots survive copy with new module identities',()=>{
 const page={compositionSchemaVersion:1,sections:[],layout:{regions:{main:{areas:[{areaId:'main',containerMode:'container',columns:['70%','30%']}]}}},plpModules:[{placement:'beforeList',target:{listingKind:'CATEGORY',categorySlug:'bike-brakes'},module:{instanceId:'cms-intro',name:'Intro',editableFields:['heading'],body:{kind:'registered',type:'plp.categoryIntro',props:{heading:'Bike Brakes'}}}}]};
 validatePageContract('composition',page);let id=0;
 const copy=copyTemplateContent({kind:'PAGE',value:page},()=>`cms-copy-${++id}`).value;
 assert.notEqual(copy.plpModules[0].module.instanceId,page.plpModules[0].module.instanceId);
 assert.equal(copy.plpModules[0].module.body.props.heading,'Bike Brakes');
 assert.equal(pageCompositionMatches(page,copy,true),true);
 copy.plpModules[0].module.body.props.heading='Changed';assert.equal(pageCompositionMatches(page,copy,true),false);
 assert.equal(page.plpModules[0].module.body.props.heading,'Bike Brakes');
 page.plpModules[0].target={};assert.equal(cmsPagePublicationIssues(page).length,1);
 page.plpModules[0].target={categorySlug:'bike-brakes'};
 page.sections=[{sectionId:'cms-hidden',name:'Hidden source',placement:{region:'main',areaId:'missing',columnIndex:1,order:1},root:{nodeId:'cms-hidden-node',kind:'container',layout:'stack',presentation:{},children:[]}}];
 assert.equal(cmsPagePublicationIssues(page).length,1);
 assert.doesNotThrow(()=>validatePageContract('composition',page));
});
