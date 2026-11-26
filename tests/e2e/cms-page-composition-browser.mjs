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
  else if (file.endsWith("/cms-page-composition-actions.ts"))
    source =
      'exports.previewPageCompositionAction=async(document)=>({ok:true,document});exports.commandPageCompositionAction=async(...args)=>{window.attempts=(window.attempts||[]);window.attempts.push(args);return {ok:false,message:"Injected timeout"};};exports.loadPageSectionsAction=async()=>({ok:false,message:"No more fixture pages"});';
  else if (file === "next/navigation")
    source = 'exports.useRouter=()=>({replace:()=>{}});exports.usePathname=()=>"/admin/cms";';
  else if (file.endsWith("/cms-composition-template-actions.ts"))
    source = 'exports.saveCompositionTemplateAction=async(...args)=>{window.templateAttempts=(window.templateAttempts||[]);window.templateAttempts.push(args);return window.templateAttempts.length===1?{ok:false,message:"Injected template timeout"}:{ok:true,receipt:{contractVersion:1,resourceKind:"TEMPLATE",resourceId:"template",revisionToken:"saved",status:"DRAFT",context:args[3],document:args[2].document}};};';
  else if (file.endsWith("/cms-independent-section-actions.ts"))
    source =
      'exports.saveIndependentSectionAction=async(...args)=>{window.attempts=(window.attempts||[]);window.attempts.push(args);return {ok:false,message:"Injected timeout"};};exports.loadSectionModulesAction=async()=>({ok:false,message:"No page fixture"});';
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
const component = add(
  path.resolve("src/modules/cms/cms-page-composer-client.tsx"),
);
const react = add(require.resolve("react")),
  dom = add(require.resolve("react-dom/client"));
const fixture = {
  initialPage: null,
  initialSections: {
    items: [
      {
        contractVersion: 1,
        resourceKind: "SECTION",
        resourceId: "section",
        revisionToken: "v1",
        context: {
          organizationId: "fixture-org",
          shopId: "fixture-shop",
          locale: "es-ES",
        },
        document: {
          sectionId: "s",
          name: "FAQ section",
          root: {
            nodeId: "n",
            kind: "module",
            module: {
              instanceId: "piece",
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
        },
      },
    ],
    total: 1,
    limit: 50,
    offset: 0,
  },
  canWrite: true,
  canPublish: true,
  context: {
    organizationId: "fixture-org",
    shopId: "fixture-shop",
    locale: "es-ES",
  },
};
const renderer = add(path.resolve("packages/cms-blocks/src/react.tsx"));
const script = `(()=>{window.process={env:{NODE_ENV:'production'}};const modules={${Object.entries(
  modules,
)
  .map(
    ([id, m]) =>
      `${JSON.stringify(id)}:{deps:${JSON.stringify(m.deps)},fn:function(require,module,exports){${m.source}\n}}`,
  )
  .join(
    ",",
  )}};const cache={};function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id].fn(s=>req(modules[id].deps[s]),m,m.exports);return m.exports;}const React=req(${JSON.stringify(react)}),root=req(${JSON.stringify(dom)}).createRoot(document.getElementById('root'));let generation=0;window.showComposition=(document,visualViewport)=>root.render(React.createElement(req(${JSON.stringify(renderer)}).CmsPageCompositionView,{document,visualViewport,key:++generation}));window.mount=props=>root.render(React.createElement(req(${JSON.stringify(component)}).CmsPageComposerClient,{...props,key:++generation}));window.mount(${JSON.stringify(fixture)});})();`;
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
    const page = await browser.newPage({ viewport: { width, height: 1000 } }),
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
              fs.readFileSync("app/globals.css", "utf8") +
              fs.readFileSync(
                "src/modules/cms/cms-module-builder.module.css",
                "utf8",
              ),
          })
        : route.fulfill({
            status: 200,
            headers,
            contentType: "text/html",
            body: '<!doctype html><html lang="es"><head><title>Módulos QA</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div></body></html>',
          }),
    );
    await page.goto("https://cms-modules.test/");
    await page.addScriptTag({ content: script });

    await page.getByLabel("Título", { exact: true }).fill("Page QA");
    await page.getByLabel("Ruta", { exact: true }).fill("/page-qa");
    await page.getByLabel("Título SEO", { exact: true }).fill("Page SEO");
    await page
      .getByLabel("Descripción SEO", { exact: true })
      .fill("Description QA");
    await page.getByRole("tab", { name: "Composición", exact: true }).click();
    if (await page.getByLabel("Título", { exact: true }).isVisible())
      throw Error("Inactive page panel remains visible");
    await page
      .getByLabel("Sección de biblioteca", { exact: true })
      .selectOption("section");
    await page
      .getByRole("button", { name: "Insertar copia", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Insertar copia", exact: true })
      .click();
    await page.getByRole("tab", { name: "Previsualizar", exact: true }).click();
    if (await page.getByLabel("Sección de biblioteca", { exact: true }).isVisible())
      throw Error("Inactive composition panel remains visible");
    await page.locator('[id^="cms-piece-"]').first().waitFor();
    const pieces = await page
      .locator('[id^="cms-piece-"]')
      .evaluateAll((nodes) => nodes.map((n) => n.id));
    if (pieces.length !== 2 || new Set(pieces).size !== 2)
      throw Error("Page copies collide");
    await page.getByRole("tab", { name: "Composición", exact: true }).click();
    await page
      .getByRole("button", { name: "Subir FAQ section", exact: true })
      .nth(1)
      .click();
    const css = page.getByRole("textbox", {
      name: "CSS del bloque · base",
      exact: true,
    });
    await css.fill(":scope {");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    if (await page.evaluate(() => window.attempts?.length ?? 0))
      throw Error("Invalid CSS reached owner");
    await css.fill(":scope { padding-top:9px; } div { padding-top:31px; }");
    await page.getByRole("tab", { name: "Previsualizar", exact: true }).click();
    await page.locator('[id^="cms-piece-"]').first().waitFor();
    const leak = await page
      .locator('[id^="cms-piece-"] div')
      .evaluateAll((nodes) =>
        nodes.some((n) => getComputedStyle(n).paddingTop === "31px"),
      );
    if (leak) throw Error("Page CSS enters module");
    const wrappers = await page
      .locator('[data-cms-space-owner="cms-page-draft"]')
      .evaluateAll(
        (nodes) =>
          nodes.filter((n) => getComputedStyle(n).paddingTop === "31px").length,
      );
    if (wrappers !== 2) throw Error("Page section wrapper CSS missing");
    if (
      (await page
        .locator("#cms-page-draft")
        .evaluate((n) => getComputedStyle(n).paddingTop)) !== "9px"
    )
      throw Error("Page root CSS missing");
    await page.getByRole("button", { name: "Guardar como plantilla", exact: true }).click();
    const templateDialog=page.getByRole("dialog",{name:"Guardar como plantilla",exact:true});
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const templateAxe=await page.evaluate(()=>window.axe.run(document.querySelector('[role="dialog"]'),{rules:{"color-contrast":{enabled:false}}}));
    if(templateAxe.violations.length)throw Error("Template drawer axe: "+JSON.stringify(templateAxe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))}))));
    const bounds=await templateDialog.boundingBox();
    if(!bounds||bounds.x<0||bounds.x+bounds.width>width+1)throw Error("Template drawer outside viewport");
    await templateDialog.getByRole("textbox",{name:"Nombre",exact:true}).fill("Template fixture");
    await templateDialog.getByRole("button",{name:"Guardar",exact:true}).click();
    await templateDialog.getByRole("button",{name:"Reintentar el mismo guardado",exact:true}).waitFor();
    if(!await templateDialog.getByRole("textbox",{name:"Nombre",exact:true}).isDisabled())throw Error("Uncertain template remains editable");
    await templateDialog.getByRole("button",{name:"Reintentar el mismo guardado",exact:true}).click();
    await templateDialog.waitFor({state:"detached"});
    if(!await page.evaluate(()=>JSON.stringify(window.templateAttempts[0])===JSON.stringify(window.templateAttempts[1])))throw Error("Template retry changed identity or content");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page
      .getByRole("button", { name: "Reintentar guardar", exact: true })
      .waitFor();
    await page.getByRole("tab", { name: "Página", exact: true }).click();
    if (!(await page.getByLabel("Título", { exact: true }).isDisabled()))
      throw Error("Ambiguous create remains editable");
    await page
      .getByRole("button", { name: "Reintentar guardar", exact: true })
      .click();
    await page.waitForFunction(() => window.attempts?.length === 2);
    if (
      !(await page.evaluate(
        () =>
          JSON.stringify(window.attempts[0]) ===
          JSON.stringify(window.attempts[1]),
      ))
    )
      throw Error("Retry changed operation");
    const payload = await page.evaluate(() => window.attempts[0][2]);
    if (
      payload.composition.document.sections[0].root.module.instanceId ===
      payload.composition.document.sections[1].root.module.instanceId
    )
      throw Error("Persisted copies collide");
    const recoveryCommand = {
      contractVersion: 1,
      operation: "PUBLISH",
      operationId: "00000000-0000-4000-8000-000000000099",
      expectedRevision: "reserved-revision",
      versionId: "reserved-version",
    };
    await page.evaluate(
      ({ props, command, document }) =>
        window.mount({
          ...props,
          initialPage: {
            pageId: "reserved",
            contractVersion: 1,
            revisionToken: "reserved-revision",
            title: "Reserved",
            path: "/reserved",
            status: "DRAFT",
            pageType: "CONTENT",
            latestVersion: {
              versionId: "reserved-version",
              title: "Reserved",
              seo: { title: "Reserved", description: "Description" },
            },
            composition: { document },
            pendingOperation: { state: "RUNNING", command },
          },
        }),
      {
        props: fixture,
        command: recoveryCommand,
        document: payload.composition.document,
      },
    );
    await page
      .getByRole("button", { name: "Reintentar publicación", exact: true })
      .waitFor();
    if (
      !(await page
        .getByRole("button", { name: "Guardar", exact: true })
        .isDisabled())
    )
      throw Error("Reserved operation permits saving a new revision");
    if (!(await page.getByLabel("Título", { exact: true }).isDisabled()))
      throw Error("Reserved operation permits edits");
    await page
      .getByRole("button", { name: "Reintentar publicación", exact: true })
      .click();
    await page.waitForFunction(
      () => window.attempts?.at(-1)?.[0] === "publish",
    );
    if (
      !(await page.evaluate(
        (command) =>
          JSON.stringify(window.attempts.at(-1)[2]) === JSON.stringify(command),
        recoveryCommand,
      ))
    )
      throw Error("Reopened operation changed command identity");
    await page.evaluate(
      (props) => window.mount({ ...props, canWrite: false, canPublish: false }),
      fixture,
    );
    await page
      .getByRole("button", { name: "Guardar", exact: true })
      .waitFor({ state: "detached" });
    if (
      await page.getByRole("button", { name: "Guardar", exact: true }).count()
    )
      throw Error("Readonly exposes save");
    if (
      await page.getByRole("button", { name: "Publicar", exact: true }).count()
    )
      throw Error("Readonly exposes publish");
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const axe = await page.evaluate(async () =>
      window.axe.run(document.getElementById("root"), {
        rules: { "color-contrast": { enabled: false } },
      }),
    );
    if (axe.violations.length)
      throw Error(
        "axe: " +
          JSON.stringify(
            axe.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.html),
            })),
          ),
      );
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    )
      throw Error("Page horizontal overflow");
    await page.evaluate(() => window.showComposition({compositionSchemaVersion:1,sections:[{
      sectionId:"image-section",name:"Image section",root:{kind:"module",nodeId:"image-node",module:{
        instanceId:"image-piece",name:"Image piece",body:{kind:"visual",value:{
          schemaVersion:2,schemaMinorVersion:0,moduleId:"visual-image",type:"visual.module",name:"Images",
          panels:[],contentSchema:{},contentValues:{},assetRefs:[],elements:[
            {elementId:"default-image",elementType:"image",props:{src:"https://cms-modules.test/image.png",alt:"Default image"}},
            {elementId:"responsive-image",elementType:"image",props:{src:"https://cms-modules.test/image.png",alt:"Responsive image"},styles:{base:{height:"210px",minHeight:"0px"},tablet:{height:"140px"},mobile:{height:"90px"}}}
          ]
        }}
      }}
    }]}));
    await page.getByRole("img",{name:"Default image",exact:true}).waitFor();
    const geometry=await page.getByRole("img",{name:"Default image",exact:true}).evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}));
    if(geometry.width<=0||geometry.height<180)throw Error("Visual Media collapsed");
    const responsiveHeight=await page.getByRole("img",{name:"Responsive image",exact:true}).evaluate(n=>n.getBoundingClientRect().height);
    if(responsiveHeight!==(width>=1024?210:width>=768?140:90))throw Error("Visual Media responsive styles not applied");
    const layoutDocument={compositionSchemaVersion:1,layout:{regions:{main:{areas:[{areaId:'split',containerMode:'full-width',columns:['50%','50%']}]}}},sections:['left','right'].map((name,index)=>({sectionId:`cms-${name}`,name,placement:{region:'main',areaId:'split',columnIndex:index+1,order:1},root:{nodeId:`cms-node-${name}`,kind:'module',module:{instanceId:`cms-module-${name}`,name,body:{kind:'registered',type:'accordion',props:{heading:name,items:[{title:'Question',content:'Answer'}]}}}}}))};
    await page.evaluate(doc=>window.showComposition(doc),layoutDocument);
    await page.locator('.cmsCompositionLayout .storefrontCmsPageColumns').waitFor();
    const columns=()=>page.locator('.cmsCompositionLayout .storefrontCmsPageColumns').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length);
    if(await columns()!==(width<=760?1:2))throw Error('Page layout changed its public responsive breakpoint');
    await page.evaluate(doc=>window.showComposition(doc,'desktop'),layoutDocument);
    await page.waitForFunction(()=>document.querySelector('[data-cms-layout-viewport="desktop"]'));
    if(await columns()!==2)throw Error('Desktop layout preview follows the Admin window instead of the selected viewport');
    await page.evaluate(props=>window.mount({...props,initialDocument:{compositionSchemaVersion:1,sections:[],plpModules:[{placement:'beforeList',target:{listingKind:'CATEGORY',categorySlug:'bike-brakes'},module:{instanceId:'cms-plp-test',name:'PLP editorial',editableFields:['heading'],body:{kind:'registered',type:'accordion',props:{heading:'Editorial',items:[{title:'FAQ',content:'Answer'}]}}}}]}}),fixture);
    await page.getByRole('tab',{name:'Página',exact:true}).waitFor();
    if(await page.getByRole('tab',{name:/PLP/}).count())throw Error('PLP tab remains exposed');
    if(await page.getByRole('textbox',{name:'Category slug',exact:true}).count())throw Error('PLP editor remains mounted');
    await page.getByLabel('Título',{exact:true}).fill('Preserve existing PLP');
    await page.getByLabel('Ruta',{exact:true}).fill('/preserve-plp');
    await page.getByLabel('Título SEO',{exact:true}).fill('Preserve PLP');
    await page.getByLabel('Descripción SEO',{exact:true}).fill('Existing content is preserved');
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    await page.waitForFunction(()=>window.attempts?.at(-1)?.[2]?.composition?.document?.plpModules?.[0]?.module?.instanceId==='cms-plp-test');
    const preservedPlp=await page.evaluate(()=>window.attempts.at(-1)[2].composition.document.plpModules[0]);
    if(preservedPlp.target.categorySlug!=='bike-brakes'||preservedPlp.placement!=='beforeList'||preservedPlp.module.body.props.heading!=='Editorial')throw Error('Saving changed existing PLP content');
    const editableDocument=structuredClone(layoutDocument);
    editableDocument.sections[0].root.module.editableFields=['heading'];
    await page.evaluate(({props,document})=>window.mount({...props,initialDocument:document}),{props:fixture,document:editableDocument});
    await page.getByLabel('Título',{exact:true}).fill('Page with embedded edit');
    await page.getByLabel('Ruta',{exact:true}).fill('/embedded-edit');
    await page.getByLabel('Título SEO',{exact:true}).fill('Embedded edit');
    await page.getByLabel('Descripción SEO',{exact:true}).fill('Embedded edit test');
    await page.getByRole('tab',{name:'Composición',exact:true}).click();
    await page.getByRole('button',{name:'Editar sección',exact:true}).first().click();
    await page.getByRole('button',{name:'Editar copia del módulo',exact:true}).click();
    await page.getByLabel('Titulo grupo',{exact:true}).fill('Edited inside page');
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    await page.getByText('Aplica o corrige la edición de la sección antes de guardar o publicar.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Aplicar a la sección',exact:true}).click();
    await page.getByRole('button',{name:'Cerrar edición de sección',exact:true}).click();
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    await page.waitForFunction(()=>window.attempts?.at(-1)?.[2]?.composition?.document?.sections?.[0]?.root?.module?.body?.props?.heading==='Edited inside page');
    const saved=await page.evaluate(()=>window.attempts.at(-1)[2].composition.document);
    if(JSON.stringify(saved.sections[0].placement)!==JSON.stringify(editableDocument.sections[0].placement)||saved.sections[1].root.module.body.props.heading!=='right')throw Error('Embedded editing changed placement or another section');
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      `PASS ${width}: page sections/copy/order; CSS ownership; invalid CSS blocked; identical page/template timeout retry; template drawer axe/bounds; readonly; Media geometry/responsive; axe without contrast`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
