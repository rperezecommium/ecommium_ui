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
const policy={policyVersionId:'policy_12345',fingerprint:'a'.repeat(64),locale:'es-ES',text:'Quiero recibir el newsletter.',privacyPath:'/privacidad-newsletter'};
function actions(origin='http://localhost:5173',reply={status:'ACCEPTED'}){
 const calls=[];const mod=load('src/modules/storefront/newsletter-actions.ts',{
  'next/headers':{headers:async()=>new Headers({origin})},
  '../../shared/bff/storefront-client':{requestStorefrontBff:async(path,opts)=>{calls.push({path,opts});return {ok:true,status:200,data:opts.parse(reply)};}},
  './storefront-context':{resolveStorefrontContext:async()=>({organizationId:'resolved-org',shopId:'resolved-shop',locale:'es-ES'})},
 },{process:{env:{NODE_ENV:'test',NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL:'http://localhost:5173'}}});return {mod,calls};
}
const input={email:'reader@example.test',locale:'es-ES',consent:{accepted:true,policyVersionId:policy.policyVersionId,fingerprint:policy.fingerprint}};
test('Newsletter UI validates closed payload and explicit consent before contacting BFF',async()=>{
 const f=actions();for(const body of [{...input,returnUrl:'http://169.254.169.254'},{...input,consent:{...input.consent,accepted:false}},{...input,email:'reader@example.test\r\nBcc:another@example.test'}])assert.equal((await f.mod.submitNewsletter(body)).ok,false);assert.equal(f.calls.length,0);
});
test('Newsletter UI binds mutations to canonical origin and resolves scope server-side',async()=>{
 const bad=actions('https://attacker.example');assert.equal((await bad.mod.submitNewsletter(input)).ok,false);assert.equal(bad.calls.length,0);
 const good=actions();assert.equal((await good.mod.submitNewsletter(input)).ok,true);assert.match(good.calls[0].path,/organizationId=resolved-org&shopId=resolved-shop/);assert.equal(good.calls[0].opts.init.headers.origin,'http://localhost:5173');assert.deepEqual(JSON.parse(good.calls[0].opts.init.body),input);
});
test('Newsletter UI rejects protocol-relative privacy redirects and unknown token purposes',async()=>{
 const f=actions('http://localhost:5173',{...policy,privacyPath:'//attacker.example'});assert.equal((await f.mod.loadNewsletterPolicy()).ok,false);
 const g=actions();assert.equal((await g.mod.completeNewsletter('providers','x'.repeat(43))).ok,false);assert.equal(g.calls.length,0);
});
test('CMS newsletter remains editable across normalization and uses its configured form styles',()=>{
 const index=load('packages/cms-blocks/src/index.ts');const widget=load('packages/cms-blocks/src/newsletter-form.tsx');const renderer=load('packages/cms-blocks/src/react.tsx',{'./index':index,'./icons':load('packages/cms-blocks/src/icons.ts',{'lucide-react':lucideIcons}),'./rich-text':load('packages/cms-blocks/src/rich-text.ts',{'sanitize-html':sanitizeHtml}),'./newsletter-form':widget});
 const block={blockId:'test-newsletter',type:'visual.module',props:{surface:'page',placement:'main',schemaVersion:2,moduleId:'club',name:'Newsletter',styles:{base:{backgroundColor:'#e5e5e5'}},panels:[{panelId:'form-panel',elements:[{elementId:'form',elementType:'newsletterForm',props:{text:'UNIRME',title:'Tu email',ariaLabel:'Correo'},styles:{base:{backgroundColor:'#525252',color:'#fafafa'}},children:[{elementId:'email',elementType:'paragraph',props:{newsletterPart:'email'},styles:{base:{backgroundColor:'#f5f5f5'}}},{elementId:'privacy',elementType:'paragraph',props:{newsletterPart:'privacy',text:'Mi privacidad'},styles:{base:{color:'#404040'}}}]}]}]}};
 const editable=index.normalizeCmsVisualModuleProps(block.props);assert.equal(editable.tree.children[0].children[0].type,'newsletterForm');assert.equal(editable.tree.children[0].children[0].children[0].props.newsletterPart,'email');
 let received;renderToStaticMarkup(React.createElement(widget.CmsNewsletterContext.Provider,{value:props=>{received=props;return React.createElement('div');}},React.createElement(renderer.CmsBlockRenderer,{block})));
 assert.equal(received.submitLabel,'UNIRME');assert.equal(received.inputStyle.backgroundColor,'#f5f5f5');assert.equal(received.privacyLabel,'Mi privacidad');assert.equal(received.style.backgroundColor,'#525252');
 const preview=renderToStaticMarkup(React.createElement(renderer.CmsBlockRenderer,{block}));assert.match(preview,/disabled/);assert.match(preview,/no recoge ni envía datos/);
});
