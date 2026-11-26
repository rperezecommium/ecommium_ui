import * as lucideIcons from "lucide-react";
import sanitizeHtml from "sanitize-html";
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
 const exports={};const ctx={exports,module:{exports},URL,URLSearchParams,Set,Map,Math,JSON,...globals,require:k=>{if(k==='react')return React;if(k==='react/jsx-runtime')return jsx;if(k in dependencies)return dependencies[k];throw new Error('Unexpected dependency: '+k);}};
 vm.runInNewContext(code,ctx);return ctx.module.exports;
}

const index=load('packages/cms-blocks/src/index.ts');
const widget=load('packages/cms-blocks/src/newsletter-form.tsx');
const renderer=load('packages/cms-blocks/src/react.tsx',{'./index':index,'./icons':load('packages/cms-blocks/src/icons.ts',{'lucide-react':lucideIcons}),'./rich-text':load('packages/cms-blocks/src/rich-text.ts',{'sanitize-html':sanitizeHtml}),'./newsletter-form':widget});
const block={blockId:'grid-test',type:'commerce.productGrid',props:{heading:'Componentes',subtitle:'Tu próxima salida',source:{kind:'CATEGORY',categorySlug:'componentes'},limit:8,columns:4,mobileColumns:2,widthPercent:90,gap:24,sort:'PRICE_ASC',hydration:{status:'READY'},hydratedProducts:[{productId:'p1',name:'Cadena <script>alert(1)</script>',brand:'Marca',href:'/pdp/cadena',imageUrl:'/cadena.jpg',priceLabel:'36,00 €',previousPriceLabel:'40,00 €',discountPercent:10,sizeLabels:['UNICA']}]}};
test('Product grid retains its category, ordering and layout through CMS serialization',()=>{
 const roundtrip=index.blocksFromJson(index.blocksToJson([block]))[0];
 assert.equal(roundtrip.props.source.categorySlug,'componentes');assert.equal(roundtrip.props.columns,4);assert.equal(roundtrip.props.sort,'PRICE_ASC');assert.equal(roundtrip.props.subtitle,'Tu próxima salida');
 const def=index.getCmsBlockDefinition('commerce.productGrid');assert.ok(def.editorFields.some(f=>f.key==='mobileColumns'));assert.ok(!def.editorFields.some(f=>f.type==='json'));
});
test('Product cards render genuine metadata with safe links and escaped text',()=>{
 const html=renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block}));
 assert.match(html,/width:90%/);assert.match(html,/--cms-product-columns:4/);assert.match(html,/--cms-product-mobile-columns:2/);assert.match(html,/cmsProductGridHeading/);assert.match(html,/<del>40,00/);assert.match(html,/10%/);assert.match(html,/UNICA/);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);
 const unsafe={...block,props:{...block.props,hydratedProducts:[{productId:'p2',name:'Sin precio',href:'javascript:alert(1)',imageUrl:'javascript:alert(1)'}]}};
 const safe=renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block:unsafe}));assert.ok(!safe.includes('href="javascript:'));assert.ok(!safe.includes('<del>'));assert.ok(!safe.includes('cmsCategoryProductDiscount'));assert.match(safe,/Precio no disponible/);
});
test('Unavailable commercial reads have an honest retry state',()=>{
 const html=renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block:{...block,props:{...block.props,hydratedProducts:[],hydration:{status:'UNAVAILABLE'}}}}));assert.match(html,/Inténtalo de nuevo/);
});
