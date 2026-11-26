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
  path.resolve("src/modules/cms/cms-module-builder-client.tsx"),
);
const react = add(require.resolve("react")),
  dom = add(require.resolve("react-dom/client"));
const fixture = {
  initialList: { items: [], total: 0, limit: 50, offset: 0 },
  initialReceipt: null,
  canWrite: true,
  context: { organizationId: "fixture-org", shopId: "fixture-shop" },
};
const script = `(()=>{window.process={env:{NODE_ENV:'production'}};const modules={${Object.entries(
  modules,
)
  .map(
    ([id, m]) =>
      `${JSON.stringify(id)}:{deps:${JSON.stringify(m.deps)},fn:function(require,module,exports){${m.source}\n}}`,
  )
  .join(
    ",",
  )}};const cache={};function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id].fn(s=>req(modules[id].deps[s]),m,m.exports);return m.exports;}const React=req(${JSON.stringify(react)}),root=req(${JSON.stringify(dom)}).createRoot(document.getElementById('root'));let generation=0;window.mount=props=>root.render(React.createElement(req(${JSON.stringify(component)}).CmsModuleBuilderClient,{...props,key:++generation}));window.mount(${JSON.stringify(fixture)});})();`;
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
            body: '<!doctype html><html lang="es"><head><title>Módulos QA</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root" class="adminShell" style="display:block"></div></body></html>',
          }),
    );
    await page.goto("https://cms-modules.test/");
    await page.addScriptTag({ content: script });
    const creationSelect=await page.getByLabel('Tipo de módulo',{exact:true}).boundingBox(),creationButton=await page.getByRole('button',{name:'Crear módulo',exact:true}).boundingBox();
    if(creationSelect.height!==32 || creationButton.height!==32 || Math.abs(creationSelect.y-creationButton.y)>1)throw Error('Module creation heights/alignment differ');
    const tabStyle=await page.getByRole('navigation',{name:'Módulos',exact:true}).getByRole('button',{name:'Biblioteca',exact:true}).evaluate(n=>({radius:getComputedStyle(n).borderRadius,background:getComputedStyle(n).backgroundColor}));
    if(tabStyle.radius!=='999px' || tabStyle.background!=='rgb(17, 17, 17)')throw Error('Module badges not applied');

    await page
      .getByLabel("Tipo de módulo", { exact: true })
      .selectOption("accordion");
    await page
      .getByRole("button", { name: "Crear módulo", exact: true })
      .click();
    await page.getByLabel("Nombre", { exact: true }).fill("FAQ independiente");
    // The collection field is identified from its existing registry label.
    const collection = page
      .getByRole("textbox", { name: /Items|Elementos|Preguntas/i })
      .first();
    const valid = await collection.inputValue();
    await collection.fill("[invalid");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    if (await page.evaluate(() => window.attempts?.length ?? 0))
      throw Error("Invalid JSON reached mutation");
    await collection.fill(valid);
    const css = page.getByRole("textbox", {
      name: "CSS del bloque · base",
      exact: true,
    });
    await css.fill(":scope {");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    if (await page.evaluate(() => window.attempts?.length ?? 0))
      throw Error("Invalid CSS reached mutation");
    await css.fill(":scope { padding-top: 8px; }");
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    )
      throw Error("Design horizontal overflow");
    if (await page.locator("form form").count())
      throw Error("Nested form in editor");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page
      .getByRole("button", { name: "Reintentar operación", exact: true })
      .waitFor();
    if (!(await page.getByLabel("Nombre", { exact: true }).isDisabled()))
      throw Error("Ambiguous create can change payload");
    await page
      .getByRole("button", { name: "Reintentar operación", exact: true })
      .click();
    await page.waitForFunction(() => window.attempts?.length === 2);
    if (
      !(await page.evaluate(
        () =>
          JSON.stringify(window.attempts[0]) ===
          JSON.stringify(window.attempts[1]),
      ))
    )
      throw Error("Retry changed operation/body");
    if (
      (await page.getByLabel("Nombre", { exact: true }).inputValue()) !==
      "FAQ independiente"
    )
      throw Error("Timeout discarded edits");
    await page.evaluate(props => window.mount(props), fixture);
    await page.getByRole("button", {name:"Crear módulo", exact:true}).click();
    await page.getByRole("button", {name:"Image Imagen con src y alt.", exact:true}).click();
    await page.getByLabel("Src upload", {exact:true}).setInputFiles({name:"qa.png",mimeType:"image/png",buffer:Buffer.from("fixture")});
    await page.getByRole("alert").filter({hasText:"Isolated fixture"}).waitFor();
    if (await page.getByRole("button", {name:"Guardar",exact:true}).isDisabled()) throw Error("Failed upload leaves editor blocked");
    await page.evaluate(
      (props) => window.mount({ ...props, canWrite: false }),
      fixture,
    );
    await page
      .getByText("No hay módulos en este listado.", { exact: true })
      .waitFor();
    if (
      await page
        .getByRole("button", { name: "Crear módulo", exact: true })
        .count()
    )
      throw Error("Read-only user sees create");
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
      `PASS ${width}: invalid JSON/CSS blocked; upload failure visible; timeout keeps payload; readonly; axe without contrast`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
