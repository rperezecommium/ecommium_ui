import * as lucideIcons from "lucide-react";
import sanitizeHtml from "sanitize-html";
import postcss from 'postcss';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
function load(path,dependencies={},globals={}){
 const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};const ctx={exports,module:{exports},URL,URLSearchParams,Set,Map,Math,JSON,structuredClone,...globals,require:k=>{if(k==='react')return React;if(k==='react/jsx-runtime')return jsx;if(k in dependencies)return dependencies[k];throw new Error('Unexpected dependency: '+k);}};
 vm.runInNewContext(code,ctx);return ctx.module.exports;
}

const index=load('packages/cms-blocks/src/index.ts');
const widget=load('packages/cms-blocks/src/newsletter-form.tsx');
const renderer=load('packages/cms-blocks/src/react.tsx',{'./index':index,'./design-settings':load('packages/cms-blocks/src/design-settings.ts'),'./page-layout':load('packages/cms-blocks/src/page-layout.tsx'),'./icons':load('packages/cms-blocks/src/icons.ts',{'lucide-react':lucideIcons}),'./rich-text':load('packages/cms-blocks/src/rich-text.ts',{'sanitize-html':sanitizeHtml}),'./newsletter-form':widget});

const history = load('src/modules/cms/cms-editor-history.ts');
test('reading independent shell sections preserves their strict envelope for the next save',()=>{
 const block={blockId:'slot',type:'cms.section',placement:{region:'header',areaId:'header-main',columnIndex:1,order:1},props:{contractVersion:1,document:{sectionId:'section',name:'Header',root:{nodeId:'root',kind:'container',layout:'stack',presentation:{},children:[]}}}};
 const normalized=index.normalizeCmsBlock(block);
 assert.equal(JSON.stringify(normalized.props),JSON.stringify(block.props));
 assert.equal(normalized.props.surface,undefined);assert.equal(normalized.props.placement,undefined);
 assert.equal(normalized.placement.region,'header');
 assert.equal(JSON.stringify(index.normalizeCmsBlock(normalized)),JSON.stringify(normalized));
});
test('confirmed writes wait for their BFF revision without replaying commands or accepting stale reads', async()=>{
 const {waitForCmsReceiptVisibility}=load('src/modules/cms/cms-receipt-visibility.ts');
 let reads=0;const delays=[];
 assert.equal(await waitForCmsReceiptVisibility(async()=>({ok:true,data:{revisionToken:++reads<3?'old':'saved'}}),'saved',async ms=>{delays.push(ms);}),true);
 assert.equal(reads,3);assert.equal(JSON.stringify(delays),JSON.stringify([100,200]));
 reads=0;
 assert.equal(await waitForCmsReceiptVisibility(async()=>{reads++;throw Error('Read model unavailable');},'saved',async()=>{}),false);
 assert.equal(reads,9);
});
const editor = load('src/modules/cms/cms-visual-editor.tsx', {'./cms-blocks': index, 'lucide-react': {}, 'next/dynamic': () => () => null, '../../shared/ui/cms-icon-picker': {}});
test('shared history preserves bounded undo/redo and clears abandoned futures', () => {
  const checkpoint = history.checkpointHistory({past: [1,2], future: [9]}, 3, 2);
  assert.equal(JSON.stringify(checkpoint), JSON.stringify({past:[2,3],future:[]}));
  const undone = history.undoHistory(checkpoint, 4, 2);
  assert.equal(undone.value, 3);
  const redone = history.redoHistory(undone.history, undone.value, 2);
  assert.equal(redone.value, 4);
  assert.equal(history.undoHistory({past:[],future:[]}, 1, 2), null);
});
test('shared presets infer content and produce reusable independent node trees', () => {
  const tree = {nodeId:'root', type:'container', children:[{nodeId:'heading',type:'heading',contentBinding:'title',props:{text:'Heading'}}]};
  const first = editor.createLocalVisualPreset({moduleId:'fixture',tree,contentValues:{title:'Custom'}}, 'Fixture', []);
  const next = editor.createLocalVisualPreset({moduleId:'fixture',tree}, 'Fixture', [first]);
  assert.equal(next.version, 2);
  assert.equal(first.contentValues.title, 'Custom');
  assert.ok(first.contentSchema.title);
  assert.notEqual(first.tree.children[0].nodeId, tree.children[0].nodeId);
  assert.equal(tree.children[0].nodeId, 'heading');
});
test('system/area presentation shares safe responsive rendering and explicit preview scopes', () => {
  const presentation={styles:{base:{paddingTop:'30px'},tablet:{paddingTop:'20px'},mobile:{paddingTop:'10px'}}};
  const publicHtml=renderToStaticMarkup(React.createElement(renderer.CmsPresentationView,{presentation},'Content'));
  assert.match(publicHtml, /@media\(max-width:1023px\)/);
  assert.match(publicHtml, /padding-top:10px !important/);
  const preview=renderToStaticMarkup(React.createElement(renderer.CmsPresentationView,{presentation,visualViewport:'mobile'},'Content'));
  assert.match(preview, /padding-top:10px/);
  assert.ok(!preview.includes('@media'));
  const unsafe=renderToStaticMarkup(React.createElement(renderer.CmsPresentationView,{presentation:{styles:{mobile:{backgroundImage:'url(javascript:alert(1))',color:'red;display:none'}}}},'Safe'));
  assert.ok(!unsafe.includes('javascript:'));
  assert.ok(!unsafe.includes('red;display:none'));
  const hostileAsset=renderToStaticMarkup(React.createElement(renderer.CmsPresentationView,{presentation:{assetRefs:[{assetKey:'background',mediaAssetId:'asset',src:'/assets/image.png);color:red}body{display:none'}],styles:{mobile:{backgroundImage:'asset:background'}}}},'Safe'));
  assert.ok(!hostileAsset.includes('}body{'));
  assert.match(hostileAsset, /%29/);
});
test('visual serialization preserves inline responsive nodes and keeps shared references compact', () => {
  const tree={nodeId:'root',type:'container',children:[{nodeId:'title',type:'heading',props:{text:'Title'},responsiveStyles:{mobile:{fontSize:'18px'}}}]};
  const props=index.migrateCmsVisualModuleV1ToV2ForRenderer({schemaVersion:1,tree});
  const blocks=index.blocksFromJson(index.blocksToJson([{blockId:'visual',type:'visual.module',props}]));
  assert.equal(blocks[0].props.schemaVersion,2);
  assert.match(JSON.stringify(blocks[0]), /18px/);
  const compact=editor.builderBlocksForCmsDraftPayload([{blockId:'ref',type:'visual.module',props:{...props,visualDefinitionReference:true,definitionId:'shared',contentValues:{title:'Instance'}}}]);
  assert.equal(JSON.stringify(compact[0].props),JSON.stringify({definitionId:'shared',contentValues:{title:'Instance'}}));
});


const sheetEditor = load('src/modules/cms/cms-block-style-sheet-editor.tsx', {'postcss':postcss, './cms-visual-editor':editor, './cms-blocks':index});
test('one block CSS box reuses Builder properties for selectors and responsive sheets',()=>{
 const rules=sheetEditor.parseCmsBlockCss(':scope { padding-top:20px; } a.example:hover { background:red; color:white; }');
 assert.equal(rules[1].selector,'a.example:hover');
 assert.equal(rules[1].styles.backgroundColor,'red');
 assert.equal(rules[0].styles.paddingTop,'20px');
 const sheet={base:rules,mobile:sheetEditor.parseCmsBlockCss('a { color:blue; }')};
 const css=renderer.cmsBlockStyleSheetCss(sheet,'cms-fixture');
 assert.match(css,/#cms-fixture a.example:hover/);
 assert.match(css,/@media\(max-width:767px\)/);
 assert.match(css,/background-color:red !important/);
});
test('block CSS selectors cannot escape the block and unsafe CSS does not apply',()=>{
 for(const source of [':scope + a {color:red}', 'a ~ body {color:red}', '@import "evil.css";', 'a {background-image:url(https://evil.test/x)}','a {color:expression(alert(1))}','a { invented: red }','a {color:red;']) assert.throws(()=>sheetEditor.parseCmsBlockCss(source));
 const hostile=renderer.cmsBlockStyleSheetCss({base:[{selector:':scope + body',styles:{color:'red'}},{selector:'a',styles:{color:'red;}body{display:none'}}]},'cms-fixture');
 assert.ok(!hostile.includes('body'));
});

test('positioned visual artwork survives serialization and shares safe offsets/rotation with preview CSS', () => {
 const props=index.migrateCmsVisualModuleV1ToV2ForRenderer({schemaVersion:1,tree:{nodeId:'art',type:'div',styles:{position:'relative',width:'100%',aspectRatio:'4 / 3'},children:[{nodeId:'hand',type:'div',styles:{position:'absolute',top:'48%',left:'62%',width:'18%',height:'50%',transform:'rotate(14deg)'},responsiveStyles:{mobile:{left:'58%'}}}]}});
 const block=index.blocksFromJson(index.blocksToJson([{blockId:'artwork',type:'visual.module',props}]))[0];
 const html=renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block,mode:'admin-preview',visualViewport:'mobile'}));
 assert.match(html,/top:48%/);assert.match(html,/left:58%/);assert.match(html,/transform:rotate\(14deg\)/);
 const css=renderer.cmsBlockStyleSheetCss({base:sheetEditor.parseCmsBlockCss('.hand { position:absolute; top:48%; left:62%; transform:rotate(14deg); }')},'artwork');
 assert.match(css,/#artwork \.hand/);assert.match(css,/top:48%/);assert.match(css,/transform:rotate\(14deg\)/);
 for(const value of ['1px 2px','auto','calc(100% - 1px)','url(https://example.com/a)']) assert.equal(editor.isVisualStyleValueSafe('top',value),false);
 for(const value of ['rotate(14)','rotate(14deg);display:none','scale(calc(1))']) assert.equal(editor.isVisualStyleValueSafe('transform',value),false);
});


test('independent module renderer scopes DOM, ARIA, fragments and CSS for two copies',()=>{
 const piece=instanceId=>({instanceId,name:'Card',body:{kind:'visual',value:{schemaVersion:2,moduleId:'module',type:'container',panels:[{panelId:'panel',elements:[{elementId:'title',elementType:'heading',props:{text:'Title'}},{elementId:'link',elementType:'link',props:{text:'Read',href:'#title',ariaLabelledBy:'title',ariaDescribedBy:'title'}}]}],contentSchema:{}}},styleSheet:{base:[{selector:'#title',styles:{color:'red'}},{selector:'#'+instanceId,styles:{padding:'7px'}}]}});
 const html=renderToStaticMarkup(React.createElement(React.Fragment,null,...['first','second'].map(id=>React.createElement(renderer.CmsIndependentModuleView,{key:id,document:piece(id)}))));
 for(const id of ['first','second']){
  assert.match(html,new RegExp(`id="cms-${id}--title"`));
  assert.match(html,new RegExp(`aria-labelledby="cms-${id}--title"`));
  assert.match(html,new RegExp(`aria-describedby="cms-${id}--title"`));
  assert.match(html,new RegExp(`href="#cms-${id}--title"`));
  assert.match(html,new RegExp(`#cms-piece-${id} #cms-${id}--title`));
  assert.match(html,new RegExp(`#cms-piece-${id}\\{padding:7px !important\\}`));
 }
 const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);
 const old=renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block:{blockId:'legacy',type:'visual.module',props:piece('old').body.value}}));
 assert.ok(!old.includes('aria-labelledby='));assert.doesNotMatch(old,/\sid="title"/);
});

test('rich text preserves formatting through V2 and renders sanitized HTML in preview and storefront', () => {
 const props=index.migrateCmsVisualModuleV1ToV2ForRenderer({schemaVersion:1,tree:{nodeId:'root',type:'container',children:[{nodeId:'rich',type:'richText',props:{text:'Legacy fallback',html:'<p><strong>Negrita</strong> y <em>cursiva</em></p><ul><li>Elemento</li></ul><img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:alert(3)">Enlace</a>'}}]}});
 const block=index.blocksFromJson(index.blocksToJson([{blockId:'rich-module',type:'visual.module',props}]))[0];
 for(const mode of ['storefront','admin-preview']) {
  const html=renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block,mode}));
  assert.match(html, /<strong>Negrita<\/strong>/);assert.match(html, /<em>cursiva<\/em>/);assert.match(html, /<ul><li>Elemento<\/li><\/ul>/);
  assert.ok(!/onerror|javascript:|<script|Legacy fallback/.test(html));
 }
 const plain={blockId:'plain',type:'visual.module',props:{schemaVersion:1,tree:{nodeId:'root',type:'richText',props:{text:'<strong>Literal</strong>'}}}};
 assert.match(renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block:plain})), /&lt;strong&gt;Literal&lt;\/strong&gt;/);
});

test('visual icons retain their selection through V2 and render allowlisted SVGs', () => {
 const props=index.migrateCmsVisualModuleV1ToV2ForRenderer({schemaVersion:1,tree:{nodeId:'root',type:'container',children:[{nodeId:'icon',type:'icon',props:{text:'lucide:heart',ariaLabel:'Favoritos'},styles:{fontSize:'32px',color:'#25b9d7'}}]}});
 const block=index.blocksFromJson(index.blocksToJson([{blockId:'icons',type:'visual.module',props}]))[0];
 const html=renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block}));
 assert.match(html, /<svg/);assert.match(html, /lucide-heart/);assert.match(html, /width="1em"/);assert.match(html, /font-size:32px/);assert.match(html,/aria-label="Favoritos"/);
 const legacy={blockId:'legacy-icon',type:'visual.module',props:{schemaVersion:1,tree:{nodeId:'root',type:'icon',props:{text:'★'}}}};
 assert.match(renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block:legacy})), /★/);
 const unsafe={...legacy,props:{schemaVersion:1,tree:{nodeId:'root',type:'icon',props:{text:'<svg onload=alert(1)>'}}}};
 const escaped=renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block:unsafe}));assert.ok(!escaped.includes('<svg'));assert.match(escaped,/&lt;svg/);
});

test('visual library separates structure and content and disables additions on content nodes', () => {
 const root={nodeId:'root',type:'container',children:[]};
 const block={blockId:'structure',type:'visual.module',props:{schemaVersion:1,tree:root}};
 const html=renderToStaticMarkup(React.createElement(editor.VisualNodeLibrary,{selectedBlock:block,selectedNode:root,onAddNode:()=>{}}));
 assert.match(html,/aria-label="Nodos estructurales"/);assert.match(html,/aria-label="Nodos de contenido"/);
 const structure=html.split('aria-label="Nodos estructurales"')[1].split('</section>')[0];
 assert.match(structure,/<strong>Flex<\/strong>/);assert.ok(!structure.includes('<strong>Heading</strong>'));
 const content=html.split('aria-label="Nodos de contenido"')[1];assert.match(content,/<strong>Text · enriquecido<\/strong>/);assert.match(content,/<strong>Form · newsletter<\/strong>/);
 const disabled=renderToStaticMarkup(React.createElement(editor.VisualNodeLibrary,{selectedBlock:block,selectedNode:{nodeId:'text',type:'paragraph'},onAddNode:()=>{}}));
 assert.equal((disabled.match(/disabled=""/g)??[]).length,editor.visualNodeCatalog.length);
});

test('content nodes reject new children and moves; legacy children remain recoverable', () => {
 const tree={nodeId:'root',type:'container',children:[{nodeId:'title',type:'heading',props:{text:'Title'},children:[{nodeId:'legacy',type:'paragraph',props:{text:'Preservar'}}]},{nodeId:'flex',type:'flex',children:[]}]};
 const block={blockId:'guards',type:'visual.module',props:{schemaVersion:1,tree}};
 const child={nodeId:'new',type:'image',props:{src:'/photo.jpg'}};
 assert.equal(editor.addVisualNodeToParent(block,'title',child),block);
 const inserted=editor.addVisualNodeToParent(block,'flex',child);
 assert.ok(editor.findVisualNode(index.normalizeCmsVisualModuleProps(inserted.props).tree,'new'));
 assert.equal(editor.moveVisualNodeToParentInTree(tree,'flex','title'),tree);
 assert.equal(editor.moveVisualNodeToParentInTree(tree,'title','legacy'),tree);
 const rescued=editor.moveVisualNodeToParentInTree(tree,'legacy','flex');
 assert.equal(editor.findVisualParentId(rescued,'legacy'),'flex');
 assert.equal(editor.findVisualNode(tree,'legacy').props.text,'Preservar');
 assert.equal(editor.duplicateVisualNodeInBlock(block,'legacy').copyId,null);
 const targets=editor.visualNodeMoveTargets(tree,'legacy');
 assert.equal(targets.some(target=>target.nodeId==='title'),false);
 assert.ok(targets.some(target=>target.nodeId==='root'));
 assert.equal(editor.canMoveVisualNodeOut(tree,'legacy'),true);
});

test('import validation rejects content nesting without changing legacy drafts', () => {
 assert.throws(()=>editor.assertVisualNodeHierarchy({nodeId:'bad',type:'paragraph',children:[{nodeId:'child',type:'div'}]}),/contenido no admiten hijos/);
 assert.doesNotThrow(()=>editor.assertVisualNodeHierarchy({nodeId:'section',type:'section',children:[{nodeId:'div',type:'div',children:[{nodeId:'rich',type:'richText',props:{html:'<p>Texto</p>'}}]}]}));
});

test('updating selected node content fields preserves other fields and independent values', () => {
  const original = { title: { type: 'text', label: 'Original' } };
  const next = editor.inferredVisualContentSchema({ nodeId: 'second', type: 'heading', contentBinding: 'secondTitle' }, original);
  assert.equal(next.title.label, 'Original');
  assert.equal(next.secondTitle.type, 'text');
  assert.equal(Object.keys(original).length, 1);
  const markup = renderToStaticMarkup(React.createElement(editor.VisualContentValuesEditor, {
    schema: { secondTitle: next.secondTitle }, values: { title: 'Original text', secondTitle: 'Second text' }, onChange() {},
  }));
  assert.ok(markup.includes('Second text'));
  assert.ok(!markup.includes('Original text'));
});

test('instance content starts with design text but preserves overrides, defaults and source', () => {
  const tree = { nodeId: 'root', type: 'container', children: [
    { nodeId: 'title', type: 'heading', contentBinding: 'title', props: { text: 'Library title' } },
    { nodeId: 'body', type: 'richText', contentBinding: 'body', props: { html: '<p>Library body</p>' } },
    { nodeId: 'private', type: 'heading', contentBinding: 'private', props: { text: 'Not exposed' } },
  ] };
  const schema = { title: { type: 'text' }, body: { type: 'richText' } };
  const values = { title: 'Copy title', unrelated: true };
  const result = editor.visualInstanceContentValues(tree, schema, values);
  assert.equal(result.title, 'Copy title');
  assert.equal(result.body, '<p>Library body</p>');
  assert.equal(result.private, undefined);
  assert.equal(values.body, undefined);
  assert.equal(tree.children[0].props.text, 'Library title');
  assert.equal(editor.visualInstanceContentValues(tree, schema, { title: '' }).title, '');
  assert.equal(editor.visualInstanceContentValues(tree, { title: { type: 'text', defaultValue: 'Default' } }, {}).title, 'Default');
});

test('section instance edits retain module design and accept only creator-declared keys', () => {
  const { updateModuleInstanceContent } = load('src/modules/cms/cms-module-instance-content.ts');
  const originalModule = { instanceId: 'copy', name: 'Designed banner', styleSheet: { base: [] }, body: {
    kind: 'visual', value: { moduleId: 'copy', schemaVersion: 2, panels: [{panelId:'panel',styles:{base:{color:'binding:tint'}}}],
      contentSchema: { title: { type: 'text' }, tint: { type: 'color' } }, contentValues: { title: 'Original', undeclared: 'Keep' },
    },
  } };
  const next = updateModuleInstanceContent(originalModule, { title: 'New', tint: '#25b9d7', padding: '200px', name: 'Injected', undeclared: 'Overwrite' });
  assert.equal(next.body.value.contentValues.title, 'New');
  assert.equal(next.body.value.contentValues.tint, '#25b9d7');
  assert.equal(next.body.value.contentValues.undeclared, 'Keep');
  assert.equal(next.body.value.contentValues.padding, undefined);
  assert.equal(next.name, originalModule.name);
  assert.equal(next.styleSheet, originalModule.styleSheet);
  assert.equal(next.body.value.panels, originalModule.body.value.panels);
  assert.equal(originalModule.body.value.contentValues.title, 'Original');
  const registered = { instanceId:'registered', name:'FAQ', body:{kind:'registered',type:'accordion',props:{heading:'Fixed'}} };
  assert.deepEqual(JSON.parse(JSON.stringify(updateModuleInstanceContent(registered, { heading: 'Change' }))), registered);
  const editable = {...registered, editableFields:['heading']};
  assert.equal(updateModuleInstanceContent(editable, {heading:'New',secret:'Injected'}).body.props.heading, 'New');
  assert.equal(updateModuleInstanceContent(editable, {heading:'New',secret:'Injected'}).body.props.secret, undefined);
  assert.equal(editable.body.props.heading, 'Fixed');
});

test('spacing-only composition wrappers preserve system typography; explicit typography still inherits', () => {
 const child=React.createElement('div',{className:'storefrontMarket'},'Market');
 const spacing=renderToStaticMarkup(React.createElement(renderer.CmsPresentationView,{presentation:{styles:{base:{gap:'24px',maxWidth:'1280px'}}}},child));
 assert.doesNotMatch(spacing,/data-cms-presentation-font-size/);
 assert.doesNotMatch(spacing,/data-cms-presentation-font-family/);
 const custom=renderToStaticMarkup(React.createElement(renderer.CmsPresentationView,{presentation:{styles:{base:{fontSize:'18px',fontFamily:'Arial',color:'#363a41'}}}},child));
 for(const key of ['font-size','font-family','color'])assert.match(custom,new RegExp('data-cms-presentation-'+key+'="true"'));
});
