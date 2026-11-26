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
  if(file === "next/navigation") source="exports.useRouter=()=>({refresh:()=>{window.refreshed=true},push:url=>{window.pushed=url}});";
  else if(file.endsWith('/cms-shell-composition-actions.ts')) source="exports.saveCmsShellSectionsAction=async(...args)=>{window.savedShell=args;return {ok:true}};";
  else if (file.endsWith('/storefront-cms-slider.tsx')) source="exports.StorefrontCmsSlider=({block})=>require('react').createElement('div',{'data-test-slider':true},block.props.slides?.[0]?.title??'Slider');";
  else if (file.endsWith('/cms-design-settings-actions.ts')) source="exports.loadCmsDesignDefaultsAction=async()=>({values:{desktop:{},tablet:{},mobile:{}}});";
  else if (["path", "url", "fs", "source-map-js"].includes(file))
    source = "module.exports={};";
  else if (file.endsWith("/postcss/lib/terminal-highlight.js"))
    source = "module.exports=css=>css;";
  else if (file === "next/dynamic")
    source = `module.exports=load=>{const React=require('react');const Lazy=React.lazy(()=>load().then(component=>({default:component})));return props=>React.createElement(React.Suspense,{fallback:null},React.createElement(Lazy,props));};`;
  else if (file.endsWith("/cms-site-part-preview-actions.ts"))
    source =
      'exports.loadCmsPreviewNavigation=async()=>({categories:[{id:1,name:"Catálogo real QA",slug:"catalogo",href:"/plp/catalogo",depth:0}]});';
  else if (file.endsWith("/cms-save-template-client.tsx"))
    source = 'exports.CmsSaveTemplateClient=()=>null;';
  else if (file.endsWith("/cms-independent-section-actions.ts"))
    source =
      'exports.saveIndependentSectionAction=async(...args)=>{window.attempts=(window.attempts||[]);window.attempts.push(args);return {ok:false,message:"Injected timeout"};};exports.loadSectionModulesAction=async()=>{await new Promise(resolve=>setTimeout(resolve,600));return {ok:false,message:"No page fixture"};};';
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
      spec === "next/dynamic" || spec === "next/navigation"
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
const component=add(path.resolve('src/modules/cms/cms-shell-sections-client.tsx'));
const react=add(require.resolve('react')),dom=add(require.resolve('react-dom/client'));
const block=(id,type,props)=>({blockId:id,type:'cms.section',placement:{region:'header',areaId:'main',columnIndex:1,order:1},props:{document:{sectionId:`cms-section-${id}`,name:id,root:{nodeId:`cms-root-${id}`,kind:'container',layout:'stack',presentation:{},children:[{nodeId:`cms-child-${id}`,kind:'module',module:{instanceId:`cms-instance-${id}`,name:id,body:{kind:'registered',type,props}}}]}},contractVersion:1}});
const fixture={item:{sitePartId:'copy',kind:'HEADER',name:'Header prueba',latestRevision:{revisionId:'r1',updatedAt:'2026-11-23T00:00:00Z',blocks:[block('search','commerce.search',{placeholder:'Buscar productos'}),block('announcement','content.announcementBar',{text:'Anuncio de prueba'}),block('market','store.market',{countryLabel:'España',languageLabel:'Español'})],layout:{regions:{header:{areas:[{areaId:'main',containerMode:'full-width',columns:['100%'],columnGap:'16px',rowGap:'16px'}]}}}}},context:{organizationId:'org',shopId:'shop',locale:'es-ES',currency:'EUR',country:'ES'},modules:{items:[],total:0,limit:50,offset:0},canWrite:true};
const script=`(()=>{window.process={env:{NODE_ENV:'production'}};const modules={${Object.entries(modules).map(([id,m])=>`${JSON.stringify(id)}:{deps:${JSON.stringify(m.deps)},fn:function(require,module,exports){${m.source}\n}}`).join(',')}};const cache={};function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id].fn(s=>req(modules[id].deps[s]),m,m.exports);return m.exports;}const React=req(${JSON.stringify(react)});window.root=req(${JSON.stringify(dom)}).createRoot(document.getElementById('root'));window.mount=(props)=>root.render(React.createElement(req(${JSON.stringify(component)}).CmsShellSectionsClient,{...props,key:props.item.name}));window.mount(${JSON.stringify(fixture)});})();`;
const browser=await chromium.launch({headless:true});
try {
 for(const width of [1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});
  await page.route('http://fixture.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><head><title>Ensayo shell</title></head><body><main id="root" class="adminPage cmsAdminPage"></main></body></html>'}));
  await page.goto('http://fixture.test/');await page.addStyleTag({path:'app/globals.css'});
  await page.addStyleTag({path:'src/modules/cms/cms-module-builder.module.css'});await page.addStyleTag({path:'src/modules/cms/cms-section-preview.module.css'});
  await page.addScriptTag({content:script});
  const save=page.getByRole('button',{name:'Guardar borrador',exact:true});
  await save.waitFor();await page.waitForTimeout(150);
  if(!await save.isDisabled())throw Error('Opening a copy marks it dirty');
  const css=page.getByRole('textbox',{name:'CSS del bloque · base',exact:true});
  await css.fill(':scope {');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Guardar borrador')?.disabled===false);
  if(await page.evaluate(()=>window.dispatchEvent(new Event('beforeunload',{cancelable:true}))))throw Error('Pending invalid CSS can be lost without warning');
  await save.click();
  if(await page.evaluate(()=>Boolean(window.savedShell)))throw Error('Invalid pending CSS was saved');
  await page.getByText('Corrige los campos, JSON o CSS antes de guardar.',{exact:true}).waitFor();
  await css.fill('');
  await page.getByLabel('Nombre de sección',{exact:true}).fill('Buscador editado');
  await save.click();await page.waitForFunction(()=>window.savedShell);
  const saved=await page.evaluate(()=>window.savedShell);
  if(saved[1][0].props.document.name!=='Buscador editado'||saved[1][1].props.document.name!=='announcement')throw Error('Embedded editing changed another section');
  await page.getByLabel('Sección de la pieza',{exact:true}).selectOption('1');
  await page.getByText('Anuncio de prueba',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Preview de la pieza',exact:true}).click();
  await page.getByRole('button',{name:'Cerrar preview',exact:true}).waitFor();
  await page.frameLocator('iframe').getByText('EUR',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar preview',exact:true}).click();
  await page.evaluate(props=>window.mount({...props,item:{...props.item,name:'Header herencia',latestRevision:{...props.item.latestRevision,layout:{...props.item.latestRevision.layout,designSettings:{base:{moduleGap:'32px'},mobile:{moduleGap:'6px'}}}}}}),fixture);
  await page.getByLabel('Nombre de sección',{exact:true}).waitFor();
  const gap=()=>page.locator('[data-cms-node-id="cms-root-search"]').first().evaluate(node=>getComputedStyle(node).gap);
  await page.waitForFunction(()=>{const node=document.querySelector('[data-cms-node-id="cms-root-search"]');return node&&getComputedStyle(node).gap==='32px';});
  await page.getByRole('button',{name:'Móvil',exact:true}).click();
  if(await gap()!=='6px')throw Error('Mobile does not inherit its scoped module gap');
  const panel=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Ajustes básicos heredados'})}).first();
  await panel.locator('summary').click();
  await panel.getByRole('combobox').selectOption('mobile');
  await panel.getByRole('checkbox',{name:'Personalizar gap módulos',exact:true}).uncheck();
  await page.waitForFunction(()=>{const node=document.querySelector('[data-cms-node-id="cms-root-search"]');return node&&getComputedStyle(node).gap==='32px';});
  await page.evaluate(props=>window.mount({...props,item:{...props.item,name:'Header solo lectura'},canWrite:false}),fixture);
  await page.waitForTimeout(100);
  if(!await save.isDisabled())throw Error('Readonly enables mutation');
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const result=await page.evaluate(async()=>window.axe.run(document.getElementById('root'),{rules:{'color-contrast':{enabled:false}}}));
  if(result.violations.length)throw Error('axe: '+JSON.stringify(result.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,html:node.html}))}))));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Horizontal page overflow');
  if(errors.length)throw Error(errors.join('\n'));
  console.log(`PASS ${width}: no false dirty; embedded edit/save; invalid CSS blocked; independent section; preview with explicit currency; readonly; axe without contrast; no page overflow`);
  await page.close();
 }
} finally {await browser.close();}
