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
const component = add(
  path.resolve("src/modules/cms/cms-section-builder-client.tsx"),
);
const react = add(require.resolve("react")),
  dom = add(require.resolve("react-dom/client"));
const fixture = {
  initialList: { items: [], total: 0, limit: 50, offset: 0 },
  initialReceipt: null,
  initialModules: {
    items: [
      {
        contractVersion: 1,
        resourceKind: "MODULE",
        resourceId: "faq",
        revisionToken: "v1",
        status: "DRAFT",
        context: { organizationId: "fixture-org", shopId: "fixture-shop" },
        document: {
          instanceId: "faq-instance",
          name: "FAQ",
          body: {
            kind: "registered",
            type: "accordion",
            props: {
              heading: "FAQ",
              items: [{ title: "Question", content: "Answer" }],
            },
          },
        },
      },
    ],
    total: 1,
    limit: 50,
    offset: 0,
  },
  canWrite: true,
  context: {
    organizationId: "fixture-org",
    shopId: "fixture-shop",
    locale: "es-ES",
  },
};
fixture.initialModules.items.push({
  ...fixture.initialModules.items[0], resourceId: "banner", document: {
    instanceId: "banner-source", name: "Banner", body: { kind: "visual", value: {
      schemaVersion: 2, moduleId: "banner", type: "container",
      tree: { nodeId: "banner-root", type: "container", children: [
        { nodeId: "banner-title", type: "heading", contentBinding: "title", props: { text: "Library title" } },
        { nodeId: "banner-body", type: "text", contentBinding: "description", props: { text: "Library description" } },
      ] },
      panels: [{ panelId: "banner-panel", styles: { base: { backgroundColor: "binding:background" } }, elements: [
        { elementId: "banner-title", elementType: "heading", contentBinding: "title", props: { text: "Library title" } },
        { elementId: "banner-body", elementType: "text", contentBinding: "description", props: { text: "Library description" } },
      ] }], contentValues: { background: "#25b9d7" }, contentSchema: { title: { type: "text", label: "Título editable" }, description: { type: "text", label: "Descripción editable" }, background: { type: "color", label: "Fondo editable", defaultValue: "#25b9d7" } },
    } },
  },
});
fixture.initialModules.total = 60;
const script = `(()=>{window.process={env:{NODE_ENV:'production'}};const modules={${Object.entries(
  modules,
)
  .map(
    ([id, m]) =>
      `${JSON.stringify(id)}:{deps:${JSON.stringify(m.deps)},fn:function(require,module,exports){${m.source}\n}}`,
  )
  .join(
    ",",
  )}};const cache={};function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id].fn(s=>req(modules[id].deps[s]),m,m.exports);return m.exports;}const React=req(${JSON.stringify(react)}),root=req(${JSON.stringify(dom)}).createRoot(document.getElementById('root'));let generation=0;window.mount=props=>root.render(React.createElement(req(${JSON.stringify(component)}).CmsSectionBuilderClient,{...props,key:++generation}));window.mount(${JSON.stringify(fixture)});})();`;
const previousMode = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
const configModule = { exports: {} };
new Function(
  "module",
  "exports",
  ts.transpileModule(fs.readFileSync("next.config.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(configModule, configModule.exports);
const headers = Object.fromEntries(
  (await configModule.exports.default.headers())[0].headers.map(
    ({ key, value }) => [key, value],
  ),
);
if (previousMode === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = previousMode;
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390 }),
      errors = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error("BROWSER " + error.message);
    });
    await page.route("https://cms-modules.test/**", (route) =>
      route.request().url().endsWith("/styles.css")
        ? route.fulfill({
            status: 200,
            contentType: "text/css",
            body:
              fs.readFileSync("app/globals.css", "utf8") + fs.readFileSync("src/modules/cms/cms-section-preview.module.css", "utf8") + fs.readFileSync("src/modules/cms/cms-section-tree-editor.module.css", "utf8") +
              fs.readFileSync(
                "src/modules/cms/cms-module-builder.module.css",
                "utf8",
              ),
          })
        : route.fulfill({
            status: 200,
            headers,
            contentType: "text/html",
            body: '<!doctype html><html lang="es"><head><title>Módulos QA</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root" class="adminShell" style="display:block"></div></body></html>',
          }),
    );
    await page.goto("https://cms-modules.test/");
    await page.addScriptTag({ content: script });
    const sectionTab=await page.getByRole('navigation',{name:'Secciones',exact:true}).getByRole('button',{name:'Biblioteca',exact:true}).evaluate(n=>({radius:getComputedStyle(n).borderRadius,background:getComputedStyle(n).backgroundColor}));
    if(sectionTab.radius!=='999px' || sectionTab.background!=='rgb(17, 17, 17)')throw Error('Section badges not applied');


    await page.getByRole("button", { name: "Crear sección", exact: true }).click();
    const selector=await page.getByLabel('Selector del área seleccionada',{exact:true}).textContent();
    if(!selector.startsWith('[data-cms-node-id="'))throw Error('Missing stable area selector');
    await page.context().grantPermissions(['clipboard-read','clipboard-write']);
    await page.getByRole('button',{name:'Copiar selector',exact:true}).click();
    await page.getByText('Selector copiado.',{exact:true}).waitFor();
    if(await page.evaluate(()=>navigator.clipboard.readText())!==selector)throw Error('Copied selector mismatch');

    if(await page.getByText('Ejemplos de selectores:',{exact:false}).isVisible())throw Error('Irrelevant CSS examples visible');
    await page.getByRole('button',{name:'Insertar regla para esta área',exact:true}).click();
    const areaCss=page.getByRole('textbox',{name:'CSS del bloque · base',exact:true});
    if(!(await areaCss.inputValue()).includes(selector))throw Error('Area rule not inserted');
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    if(await page.evaluate(()=>window.attempts?.length??0))throw Error('Incomplete area rule reached save');
    await areaCss.fill(selector+' { border: 2px solid #25b9d7; }');
    await page.waitForFunction(()=>!document.querySelector('[data-cms-editor-error="true"]'));
    if(await page.locator('[data-admin-section-preview]').locator(selector).evaluate(n=>getComputedStyle(n).borderTopWidth)!=='2px')throw Error('Area border not rendered: '+JSON.stringify({selector,css:await page.locator('[data-admin-section-preview] style').allTextContents(),error:await page.getByRole('alert').allTextContents()}));
    await areaCss.fill('');
    await page.getByLabel('Mostrar límites',{exact:true}).check();
    if(!await page.locator('[data-admin-section-preview] [data-preview-boundary]').count())throw Error('Area limits missing');
    await page.getByLabel('Mostrar límites',{exact:true}).uncheck();
    await page.getByRole('button',{name:'Seleccionar área',exact:true}).click();
    await page.keyboard.press('Escape');
    if(await page.getByRole('button',{name:'Seleccionar área',exact:true}).getAttribute('aria-pressed')!=='false')throw Error('Escape did not cancel picker');
    const containerStyles=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Estilos del contenedor'})});
    const sectionBoxes = page.locator('.sectionEditorFieldset > .sectionBox');
    if(await sectionBoxes.count()!==3)throw Error('Expected three functional boxes');
    const boxStyles=await sectionBoxes.evaluateAll(nodes=>nodes.map(n=>({background:getComputedStyle(n).backgroundColor,border:getComputedStyle(n).borderTopWidth,rect:n.getBoundingClientRect().toJSON()})));
    if(boxStyles.some(box=>box.background!=='rgb(255, 255, 255)' || box.border!=='1px'))throw Error('Functional boxes lack white surface/border');
    if(boxStyles[1].rect.y-boxStyles[0].rect.bottom<10 || boxStyles[2].rect.y-boxStyles[1].rect.bottom<10)throw Error('Functional boxes not separated');

    if(await containerStyles.evaluate(n=>n.open))throw Error('Container styles not collapsed initially');
    await containerStyles.locator('summary').click();
    for(const scope of ['Base','Desktop','Tablet','Mobile']){
      await page.getByRole('group',{name:'Scope de estilos visuales'}).getByRole('button',{name:scope,exact:true}).click();
      for(const label of ['Text color','Font family','Font size','Font weight','Line height','Text align','Styles JSON directo','Hover styles JSON'])if(await page.getByLabel(label,{exact:true}).count())throw Error('Module style in container: '+label);
    }
    await page.getByRole('group',{name:'Scope de estilos visuales'}).getByRole('button',{name:'Base',exact:true}).click();
    if(!await page.locator('[data-style-key="padding"]').isVisible() || !await page.locator('[data-style-key="backgroundColor"]').isVisible())throw Error('Container controls removed');
    await containerStyles.locator('summary').focus();
    await page.keyboard.press('Enter');
    if(await page.locator('[data-style-key="padding"]').isVisible())throw Error('Container styles did not collapse by keyboard');

    for(const [field,button] of [['Distribución','Añadir contenedor'],['Módulo de biblioteca','Insertar copia']]){
      const fieldBox=await page.getByLabel(field,{exact:true}).boundingBox(),buttonBox=await page.getByRole('button',{name:button,exact:true}).boundingBox();
      if(fieldBox.height!==32 || buttonBox.height!==32)throw Error('Admin control height mismatch: '+JSON.stringify({fieldBox,buttonBox}));
    }
    if(width>=768){
      const layoutRect=await page.getByLabel('Distribución',{exact:true}).boundingBox();
      const libraryRect=await page.getByLabel('Módulo de biblioteca',{exact:true}).boundingBox();
      if(libraryRect.x<=layoutRect.x || Math.abs(layoutRect.y-libraryRect.y)>2)throw Error('Distribution and library not alongside each other');
      for(const [field,button] of [['Distribución','Añadir contenedor'],['Módulo de biblioteca','Insertar copia']]){
        const select=await page.getByLabel(field,{exact:true}).boundingBox(),action=await page.getByRole('button',{name:button,exact:true}).boundingBox();
        if(action.x<select.x+select.width || Math.abs(action.y-select.y)>2 || action.height!==select.height)throw Error('Container actions not horizontal');
      }
    }

    const addStyle=await page.getByRole('button',{name:'Añadir contenedor',exact:true}).evaluate(n=>({background:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color}));
    if(addStyle.background!=='rgb(37, 185, 215)' || addStyle.color!=='rgb(255, 255, 255)')throw Error('Insertion button does not use primary styling');
    await page.getByRole("button", { name: "Más módulos", exact: true }).click();
    await page.getByText("Cargando módulos…", { exact: true }).waitFor();
    if (await page.getByLabel("Nombre de sección", { exact: true }).isDisabled()) throw Error("Module loading blocks editing");
    if (await page.getByRole("button", { name: "Guardar", exact: true }).isDisabled()) throw Error("Module loading blocks save");
    if (!await page.getByLabel("Módulo de biblioteca", { exact: true }).isDisabled()) throw Error("Loading selector enabled");
    await page.getByText("No page fixture", { exact: true }).waitFor();
    await page.getByLabel("Módulo de biblioteca", { exact: true }).selectOption("banner");
    await page.getByRole("button", { name: "Insertar copia", exact: true }).click();
    await page.getByRole("button", { name: "Insertar copia", exact: true }).click();
    await page.getByRole("button", { name: "Banner · 2", exact: true }).first().click();
    await page.getByRole("button", { name: "Editar copia del módulo", exact: true }).click();
    for (const label of ["Nombre del módulo", "Content binding", "Label", "Styles JSON directo", "CSS del bloque · base"]) {
      if (await page.getByLabel(label, { exact: true }).count()) throw Error("Module design control exposed: " + label);
    }
    if (await page.getByRole("button", { name: /^Añadir contenedor$|Duplicar nodo|Reemplazar nodo/ }).count()) throw Error("Design actions in module fields");
    if (await page.getByText(/Avanzado:.*copia/).count()) throw Error("Advanced module design still exposed");
    const title = page.getByLabel("Título editable", { exact: true }).first();
    if (await title.inputValue() !== "Library title") throw Error("Missing design text fallback");
    if (await page.getByLabel("Content binding", { exact: true }).count()) throw Error("Design shown by default");
    await page.getByLabel("Fondo editable", { exact: true }).fill("#72c279");
    await title.fill("Only this copy");
    await page.getByLabel("Descripción editable", { exact: true }).first().fill("Copy description");
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const contentAxe = await page.evaluate(async () => window.axe.run(document.querySelector('[aria-label="Contenido de la copia del módulo"]'), { rules: { "color-contrast": { enabled: false } } }));
    if (contentAxe.violations.length) throw Error("Content axe: " + JSON.stringify(contentAxe.violations.map(v => ({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error("Content form overflow");
    await page.getByRole("button", { name: "Aplicar y seguir editando", exact: true }).click();
    await page.getByText("Cambios aplicados a la sección. Puedes seguir editando; están pendientes de guardar.", { exact: true }).waitFor();
    await page.getByLabel("Título editable", { exact: true }).first().fill("Only this copy");
    await page.getByRole("button", { name: "Aplicar a la sección", exact: true }).click();
    if (await page.getByRole("heading", { name: "Only this copy", exact: true }).count() !== 1) throw Error("Copy change not rendered");
    if (await page.getByRole("heading", { name: "Library title", exact: true }).count() !== 1) throw Error("Other copy changed");
    const backgroundColors = await page.locator('[id^="cms-piece-"] [data-cms-style-id]').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).backgroundColor));
    if (!backgroundColors.includes('rgb(114, 194, 121)') || !backgroundColors.includes('rgb(37, 185, 215)')) throw Error('Declared background binding not isolated between copies: ' + backgroundColors);

    await page.getByRole('button',{name:'Seleccionar área',exact:true}).click();
    await page.getByRole('heading',{name:'Library title',exact:true}).click();
    const pickedId=await page.locator('[data-admin-section-preview] [data-preview-selected]').getAttribute('data-cms-node-id');
    if(await page.locator('[data-section-node="'+pickedId+'"] button[aria-pressed="true"]').count()!==1)throw Error('Preview did not select matching tree row');
    if(await page.getByRole('button',{name:'Seleccionar área',exact:true}).getAttribute('aria-pressed')!=='false')throw Error('Picker did not finish');
    await page.getByRole('button',{name:'Seleccionar área',exact:true}).click();
    await page.getByRole('heading',{name:'Only this copy',exact:true}).click();
    await page.getByRole("button", { name: "Editar copia del módulo", exact: true }).click();
    await page.getByLabel("Título editable", { exact: true }).first().fill("Discard this");
    await page.getByRole("button", { name: "Cancelar edición del módulo", exact: true }).click();
    if (await page.getByRole("heading", { name: "Only this copy", exact: true }).count() !== 1) throw Error("Cancel changed copy");
    await page.evaluate(props => window.mount(props), fixture);
    await page.getByRole("button", { name: "Crear sección", exact: true }).waitFor();
    await page.getByRole("button", { name: "Crear sección", exact: true }).click();
    await page.getByRole('button',{name:'Añadir contenedor dentro de Contenedor principal',exact:true}).focus();
    await page.keyboard.press('Enter');
    const firstBox=await page.locator('[data-section-node]').last().getAttribute('data-section-node');
    await page.locator('[data-section-node="'+firstBox+'"]').getByRole('button',{name:'Añadir contenedor dentro de Contenedor stack',exact:true}).click();
    const nestedBox=await page.locator('[data-section-node]').last().getAttribute('data-section-node');
    const nestedParent=await page.locator('[data-section-node="'+nestedBox+'"]').evaluate(n=>n.parentElement.parentElement.parentElement.querySelector(':scope > [data-section-node]').dataset.sectionNode);
    if(nestedParent!==firstBox)throw Error('Plus inserted outside requested parent');
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('[data-section-node="'+nestedBox+'"]').getByRole('button',{name:'Eliminar Contenedor stack',exact:true}).click();
    await page.getByRole('button',{name:'Contenedor principal · 1',exact:true}).click();
    await page.getByLabel("Módulo de biblioteca", { exact: true }).selectOption("faq");
    await page.getByRole("button", { name: "Insertar copia", exact: true }).click();
    await page.getByRole("button", { name: "Insertar copia", exact: true }).click();
    const treeRows = page.locator('[data-section-node]');
    const rowIds = await treeRows.evaluateAll(nodes=>nodes.map(n=>n.dataset.sectionNode));
    const rowFor = id => page.locator('[data-section-node="'+id+'"]');
    const parentOf = id => rowFor(id).evaluate(n=>n.parentElement.parentElement.parentElement.querySelector(':scope > [data-section-node]')?.dataset.sectionNode);
    const [rootId,boxId,firstId,secondId] = rowIds;
    await rowFor(firstId).getByRole('button',{name:'Entrar en el contenedor anterior: FAQ',exact:true}).click();
    if(await parentOf(firstId)!==boxId) throw Error('Arrow did not indent module');
    await rowFor(firstId).getByRole('button',{name:'Sacar del contenedor: FAQ',exact:true}).click();
    if(await parentOf(firstId)!==rootId) throw Error('Arrow did not outdent module');
    const drag = async(sourceId,targetId,position,cancel=false)=>{
      const handle=rowFor(sourceId).getByRole('button',{name:/^Arrastrar /});
      await handle.scrollIntoViewIfNeeded();
      await rowFor(targetId).scrollIntoViewIfNeeded();
      const source=await handle.boundingBox(), target=await rowFor(targetId).boundingBox();
      await page.mouse.move(source.x+source.width/2,source.y+source.height/2);
      await page.mouse.down();
      await page.mouse.move(source.x+source.width/2+8,source.y+source.height/2,{steps:2});
      await page.mouse.move(target.x+target.width/2,target.y+target.height*position,{steps:12});
      if(cancel)await page.keyboard.press('Escape');
      await page.mouse.up();
    };
    await drag(firstId,boxId,.5);
    if(await parentOf(firstId)!==boxId)throw Error('Pointer drop did not nest module');
    await drag(secondId,boxId,.5,true);
    if(await parentOf(secondId)!==rootId)throw Error('Escape did not cancel drag');
    await drag(boxId,firstId,.5);
    if(await parentOf(boxId)!==rootId)throw Error('Container moved into descendant');
    await drag(boxId,secondId,.9);
    const reordered=await page.locator('[data-section-root="true"]').evaluate(n=>[...n.parentElement.querySelector(':scope > ul').children].map(li=>li.querySelector('[data-section-node]').dataset.sectionNode));
    if(reordered.join(',')!==[secondId,boxId].join(','))throw Error('Container/subtree reorder failed');
    if(await parentOf(firstId)!==boxId)throw Error('Container lost its module');
    await rowFor(boxId).getByRole('button',{name:'Contenedor stack · 2',exact:true}).click();
    await page.getByRole('button',{name:'Seleccionar área',exact:true}).click();
    await rowFor(secondId).getByRole('button',{name:'FAQ · 2',exact:true}).click();
    const previewSelection=await page.locator('[data-preview-selected]').getAttribute('data-cms-node-id');
    if(previewSelection!==secondId)throw Error('Tree selection did not update preview');
    await page.keyboard.press('Escape');

    if(width===390){
      const handle=rowFor(secondId).getByRole('button',{name:/^Arrastrar /});
      await handle.scrollIntoViewIfNeeded();await rowFor(boxId).scrollIntoViewIfNeeded();
      const source=await handle.boundingBox(),target=await rowFor(boxId).boundingBox();
      const cdp=await page.context().newCDPSession(page);
      const point={x:source.x+16,y:source.y+16};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
      for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+(target.x+target.width/2-point.x)*i/12,y:point.y+(target.y+target.height/2-point.y)*i/12}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await cdp.detach();
      if(await parentOf(secondId)!==boxId)throw Error('Touch drop did not nest module');
      await rowFor(secondId).getByRole('button',{name:'Sacar del contenedor: FAQ',exact:true}).click();
    }
    const treeAxe=await page.evaluate(async()=>window.axe.run(document.querySelector('[aria-label="Árbol de sección"]'),{rules:{'color-contrast':{enabled:false}}}));
    if(treeAxe.violations.length)throw Error('Tree axe: '+treeAxe.violations.map(v=>v.id).join(','));
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Tree overflow');

    await rowFor(secondId).getByRole('button',{name:'Eliminar FAQ',exact:true}).focus();
    page.once('dialog',dialog=>dialog.dismiss());
    await page.keyboard.press('Enter');
    if(await rowFor(secondId).count()!==1)throw Error('Cancelled removal changed tree');
    page.once('dialog',dialog=>dialog.accept());
    await rowFor(secondId).getByRole('button',{name:'Eliminar FAQ',exact:true}).click();
    if(await rowFor(secondId).count())throw Error('Module removal failed');
    page.once('dialog',async dialog=>{if(!dialog.message().includes('1 elemento interior'))throw Error('Missing subtree warning');await dialog.accept();});
    await rowFor(boxId).getByRole('button',{name:'Eliminar Contenedor stack',exact:true}).click();
    if(await page.locator('[data-section-node]').count()!==1)throw Error('Container removal did not remove subtree');
    if(await page.locator('[data-section-root="true"]').getByRole('button',{name:/Eliminar|Arrastrar/}).count())throw Error('Root controls exposed');
    await page.evaluate(props=>window.mount(props),fixture);
    await page.getByRole('button',{name:'Crear sección',exact:true}).waitFor();


    await page
      .getByRole("button", { name: "Crear sección", exact: true })
      .click();
    await page
      .getByLabel("Nombre de sección", { exact: true })
      .fill("Section QA");
    await page
      .getByRole("button", { name: "Añadir contenedor", exact: true })
      .click();
    await page
      .getByLabel("Módulo de biblioteca", { exact: true })
      .selectOption("faq");
    await page
      .getByRole("button", { name: "Insertar copia", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Insertar copia", exact: true })
      .click();
    const pieces = await page
      .locator('[id^="cms-piece-"]')
      .evaluateAll((nodes) => nodes.map((n) => n.id));
    if (pieces.length !== 2 || new Set(pieces).size !== 2)
      throw Error("Copied modules collide");
    await page
      .getByRole("button", { name: "FAQ · 2", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Editar copia del módulo", exact: true })
      .click();
    await page.getByText("El creador no ha habilitado campos editables para este módulo. Su contenido y diseño se conservan.", { exact: true }).waitFor();
    if (await page.getByLabel("Nombre del módulo", { exact: true }).count()) throw Error("Module rename exposed in section");
    await page
      .getByRole("button", { name: "Aplicar a la sección", exact: true })
      .click();
    await page
      .getByRole("button", { name: "FAQ · 2", exact: true })
      .first().waitFor();
    await page.getByRole("button", {name:"Entrar en el contenedor anterior: FAQ",exact:true}).first().click();
    await page.getByRole("button", {name:"FAQ · 3",exact:true}).waitFor();
    await page.getByRole("button", {name:"Contenedor stack · 2",exact:true}).click();
    if(await page.getByLabel("Mover a contenedor",{exact:true}).count() || await page.getByRole("button",{name:"Mover al final",exact:true}).count())throw Error("Obsolete move controls exposed");
    const css = page.getByRole("textbox", {
      name: "CSS del bloque · base",
      exact: true,
    });
    await css.fill(":scope {");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    if (await page.evaluate(() => window.attempts?.length ?? 0))
      throw Error("Invalid CSS reached mutation");
    await css.fill("div { padding-top:31px; }");
    const leak = await page
      .locator('[id^="cms-piece-"] div')
      .evaluateAll((nodes) =>
        nodes.some((n) => getComputedStyle(n).paddingTop === "31px"),
      );
    if (leak) throw Error("Section CSS entered module internals");
    const padding = await page
      .locator("div[data-cms-space-owner]")
      .first()
      .evaluate((n) => getComputedStyle(n).paddingTop);
    if (padding !== "31px") throw Error("Section CSS missing from wrappers");
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    )
      throw Error("Design horizontal overflow");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Reintentar el mismo guardado",
        exact: true,
      })
      .waitFor();
    if (!(await page.getByLabel("Nombre de sección").isDisabled()))
      throw Error("Ambiguous attempt editable");
    await page
      .getByRole("button", {
        name: "Reintentar el mismo guardado",
        exact: true,
      })
      .click();
    await page.waitForFunction(() => window.attempts?.length === 2);
    if (
      !(await page.evaluate(
        () =>
          JSON.stringify(window.attempts[0]) ===
          JSON.stringify(window.attempts[1]),
      ))
    )
      throw Error("Retry changed input");
    await page.evaluate(
      (props) => window.mount({ ...props, canWrite: false }),
      fixture,
    );
    await page
      .getByText("No hay secciones disponibles.", { exact: true })
      .waitFor();
    if (
      await page
        .getByRole("button", { name: "Crear sección", exact: true })
        .count()
    )
      throw Error("Read-only exposes create");
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const axe = await page.evaluate(async () =>
      window.axe.run(document.getElementById("root"), {
        rules: { "color-contrast": { enabled: false } },
      }),
    );
    if (axe.violations.length)
      throw Error("axe: " + axe.violations.map((v) => v.id).join(","));
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    )
      throw Error("Page horizontal overflow");
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      `PASS ${width}: tree/move/copy; CSS isolation; invalid CSS blocked; timeout keeps payload; readonly; axe without contrast`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
