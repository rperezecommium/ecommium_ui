// Browser UI checks with failing action fixtures; not BFF/CMS certification.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url),
  modules = {},
  cache = new Map();
function add(file) {
  if (cache.has(file)) return cache.get(file);
  const id = String(cache.size);
  cache.set(file, id);
  let source;
  if (["path", "url", "fs", "source-map-js"].includes(file))
    source = "module.exports={};";
  else if (file.endsWith('/storefront-cms-slider.tsx')) source="exports.StorefrontCmsSlider=({block})=>require('react').createElement('div',{'data-test-slider':true},block.props.slides?.[0]?.title??'Slider');";
  else if (file.endsWith('/cms-design-settings-actions.ts')) source="exports.loadCmsDesignDefaultsAction=async()=>({values:{desktop:{},tablet:{},mobile:{}}});";
  else if (file.endsWith("/postcss/lib/terminal-highlight.js"))
    source = "module.exports=css=>css;";
  else if (file === "next/dynamic")
    source = `module.exports=load=>{const React=require('react');const Lazy=React.lazy(()=>load().then(component=>({default:component})));return props=>React.createElement(React.Suspense,{fallback:null},React.createElement(Lazy,props));};`;
  else if (file.endsWith("/cms-site-part-preview-actions.ts"))
    source =
      'exports.loadCmsPreviewNavigation=async()=>({categories:[{id:1,name:"Catálogo real QA",slug:"catalogo",href:"/plp/catalogo",depth:0}]});';
  else if (file.endsWith("/cms-composition-template-actions.ts"))
    source = `exports.saveCompositionTemplateAction=async(...args)=>{await window.recordTemplateAttempt(args);if(window.failCreation)return {ok:false,message:"Injected timeout",status:503};const body=args[2];return {ok:true,receipt:{contractVersion:1,resourceKind:"TEMPLATE",resourceId:"created-qa",revisionToken:"r1",status:"DRAFT",context:args[3],document:body.document}};};`;
  else if (file.endsWith("/cms-independent-module-actions.ts"))
    source =
      'exports.saveIndependentModuleAction=async(...args)=>{window.attempts=(window.attempts||[]);window.attempts.push(args);return {ok:false,message:"Injected timeout"};};';
  else if (file.endsWith(".module.css"))
    source =
      "module.exports=" +
      JSON.stringify(
        Object.fromEntries(
          [
            ...fs.readFileSync(file, "utf8").matchAll(/\.([A-Za-z][\w-]*)/g),
          ].map((m) => [m[1], m[1]]),
        ),
      ) +
      ";";
  else if (file.endsWith(".json"))
    source = "module.exports=" + fs.readFileSync(file, "utf8") + ";";
  else if (file.endsWith("/cms-admin-actions.ts"))
    source =
      'exports.uploadCmsBuilderMediaAction=async()=>({ok:false,message:"Isolated fixture"});';
  else if (
    file.endsWith("/storefront-auth-drawer.tsx") ||
    file.endsWith("/cart-client.tsx")
  )
    source =
      "exports.StorefrontAuthEntry=exports.StorefrontCartStatus=()=>null;";
  else if (file.endsWith("/newsletter-client.tsx"))
    source = "exports.NewsletterProvider=({children})=>children;";
  else if (file === "next/link" || file === "next/image")
    source = `module.exports=({children,priority,...props})=>require('react').createElement('${file === "next/link" ? "a" : "img"}',props,children);`;
  else source = fs.readFileSync(file, "utf8");
  if (/\.tsx?$/.test(file))
    source = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
  const deps = {};
  for (const match of source.matchAll(/require\(["']([^"']+)["']\)/g)) {
    const spec = match[1];
    if (
      spec === "next/link" ||
      spec === "next/image" ||
      spec === "next/dynamic"
    )
      deps[spec] = add(spec);
    else if (spec.startsWith(".")) {
      const base = path.resolve(path.dirname(file), spec);
      const resolved = [
        base,
        base + ".ts",
        base + ".tsx",
        base + ".js",
        path.join(base, "index.ts"),
      ].find(
        (candidate) =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      );
      if (!resolved) throw Error(`Unresolved ${spec} in ${file}`);
      deps[spec] = add(resolved);
    } else
      deps[spec] = add(
        ["path", "url", "fs", "source-map-js"].includes(spec)
          ? spec
          : require.resolve(spec),
      );
  }
  modules[id] = { source, deps };
  return id;
}
const component=add(path.resolve('src/modules/cms/cms-template-library-client.tsx'));
const react=add(require.resolve('react')),dom=add(require.resolve('react-dom/client'));
const fixture={list:{items:[],total:0,limit:50,offset:0},context:{organizationId:'qa-org',shopId:'qa-shop',locale:'es-ES'},canWrite:true,status:'DRAFT'};
const script=`(()=>{window.process={env:{NODE_ENV:'production'}};const modules={${Object.entries(modules).map(([id,m])=>`${JSON.stringify(id)}:{deps:${JSON.stringify(m.deps)},fn:function(require,module,exports){${m.source}\n}}`).join(',')}};const cache={};function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id].fn(s=>req(modules[id].deps[s]),m,m.exports);return m.exports;}const React=req(${JSON.stringify(react)}),root=req(${JSON.stringify(dom)}).createRoot(document.getElementById('root'));let generation=0;window.mount=props=>root.render(React.createElement(req(${JSON.stringify(component)}).CmsTemplateLibraryClient,{...props,key:++generation}));window.mount(${JSON.stringify(fixture)});})();`;
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),attempts=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('recordTemplateAttempt',args=>attempts.push(args));
  await page.route('https://cms-templates.test/**',route=>route.request().url().endsWith('/styles.css')?route.fulfill({contentType:'text/css',body:fs.readFileSync('app/globals.css','utf8')+fs.readFileSync('src/modules/cms/cms-module-builder.module.css','utf8')}):route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><head><title>Plantillas QA</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root" class="adminShell" style="display:block"></div></body></html>'}));
  for(const kind of ['SECTION','PAGE']){
   await page.goto('https://cms-templates.test/');await page.addScriptTag({content:script});
   const trigger=page.getByRole('button',{name:'Crear nueva plantilla',exact:true});
   const nav=await page.getByRole('navigation',{name:'Estado de plantillas'}).boundingBox(),link=await trigger.boundingBox();
   if(link.x<nav.x+nav.width || Math.abs((link.y+link.height/2)-(nav.y+nav.height/2))>2)throw Error('Creation link not aligned to right of badges: '+JSON.stringify({width,nav,link}));
   const style=await trigger.evaluate(n=>({background:getComputedStyle(n).backgroundColor,decoration:getComputedStyle(n).textDecorationLine}));
   if(style.background!=='rgba(0, 0, 0, 0)' || style.decoration!=='underline')throw Error('Creation trigger is not link styled');
   await trigger.click();await page.getByLabel('Nombre de plantilla',{exact:true}).fill('Plantilla '+kind);
   await page.getByLabel('Tipo de plantilla',{exact:true}).selectOption(kind);
   if(kind==='SECTION'){
    await page.evaluate(()=>window.failCreation=true);
    await page.getByRole('button',{name:'Crear y abrir diseño',exact:true}).click();
    await page.getByRole('button',{name:'Reintentar la misma creación',exact:true}).waitFor();
    if(!await page.getByLabel('Nombre de plantilla',{exact:true}).isDisabled())throw Error('Uncertain creation editable');
    await page.evaluate(()=>window.failCreation=false);
    await page.getByRole('button',{name:'Reintentar la misma creación',exact:true}).click();
   }else await page.getByRole('button',{name:'Crear y abrir diseño',exact:true}).click();
   await page.waitForURL('**/admin/cms/plantillas?id=created-qa');
   const last=attempts.at(-1);if(last[0]!=='create'||last[2].document.content.kind!==kind)throw Error('Wrong template command');
   if(kind==='SECTION' && JSON.stringify(attempts.at(-2))!==JSON.stringify(last))throw Error('Retry changed operation');
  }
  await page.goto('https://cms-templates.test/');await page.addScriptTag({content:script});
  await page.evaluate(props=>window.mount({...props,canWrite:false}),fixture);
  await page.getByRole('navigation',{name:'Estado de plantillas'}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('button[aria-controls="cms-template-create-form"]'));
  await page.evaluate(props=>window.mount(props),fixture);
  await page.getByRole('button',{name:'Crear nueva plantilla',exact:true}).click();
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const axe=await page.evaluate(()=>window.axe.run(document.getElementById('root'),{rules:{'color-contrast':{enabled:false}}}));
  if(axe.violations.length)throw Error('axe: '+axe.violations.map(v=>v.id).join(','));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Overflow');
  if(errors.length)throw Error(errors.join(';'));
  console.log('PASS '+width+': link alignment, SECTION/PAGE creation, exact retry, readonly, axe');
  await page.close();
 }
}finally{await browser.close();}
