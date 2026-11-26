// Isolated, hydrated UI regression. No session, BFF or real deletion is used.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url), modules = {}, cached = new Map();
let sequence = 0;
function add(file, override) {
  if (cached.has(file)) return cached.get(file);
  const id = String(sequence++); cached.set(file, id);
  const source = override ?? fs.readFileSync(file, 'utf8'), deps = {};
  for (const match of source.matchAll(/require\(["']([^"']+)["']\)/g)) deps[match[1]] = add(createRequire(file).resolve(match[1]));
  modules[id] = { source, deps }; return id;
}
const filename = path.resolve('src/modules/cms/cms-site-part-delete-button.tsx');
let source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
source = source.replace('require("./cms-site-part-delete.module.css")', '({dialog:"deleteDialog"})')
  .replace('require("./cms-site-parts-actions")', '({deleteCmsSitePartAction:async data=>{window.deletes.push(data.get("confirmName"));return {error:"Elemento en uso. No se ha eliminado."};}})');
const component = add(filename, source), react = add(require.resolve('react')), dom = add(require.resolve('react-dom/client'));
const script = `window.process={env:{NODE_ENV:"production"}};
const modules={${Object.entries(modules).map(([id, m]) => `${JSON.stringify(id)}:{deps:${JSON.stringify(m.deps)},fn:function(require,module,exports){${m.source}\n}}`).join(',')}};
const cache={};function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id].fn(s=>req(modules[id].deps[s]),m,m.exports);return m.exports;}
const React=req(${JSON.stringify(react)});window.deletes=[];
req(${JSON.stringify(dom)}).createRoot(document.getElementById("root")).render(React.createElement(React.Fragment,null,
React.createElement(req(${JSON.stringify(component)}).CmsSitePartDeleteButton,{id:"test",kind:"HEADER",name:"test_header",locale:"es-ES",usageCount:0}),
React.createElement(req(${JSON.stringify(component)}).CmsSitePartDeleteButton,{id:"used",kind:"HEADER",name:"En uso",locale:"es-ES",usageCount:1})));`;
const css = fs.readFileSync('app/globals.css', 'utf8') + fs.readFileSync('src/modules/cms/cms-site-part-delete.module.css', 'utf8').replaceAll('.dialog', '.deleteDialog');
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(`<!doctype html><html lang="es"><head><title>CMS QA</title><style>${css}</style></head><body><main><div id="root"></div></main></body></html>`);
    await page.addScriptTag({ content: script });
    const trigger = page.getByTitle('Eliminar test_header', { exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    const submit = page.getByRole('button', { name: 'Eliminar definitivamente', exact: true });
    if (!await submit.isDisabled()) throw Error('Confirmation required');
    await page.getByRole('textbox').fill('wrong');
    if (!await submit.isDisabled()) throw Error('Exact name required');
    await page.getByRole('textbox').fill('test_header'); await submit.click();
    await page.getByRole('alert').waitFor();
    if ((await page.evaluate(() => window.deletes)).length !== 1) throw Error('Unexpected submissions');
    const box = await dialog.boundingBox();
    if (box.x < 0 || box.x + box.width > width + 1) throw Error('Dialog overflow');
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const report = await page.evaluate(() => axe.run(document.querySelector('dialog'), { rules: { 'color-contrast': { enabled: false } } }));
    if (report.violations.length) throw Error(JSON.stringify(report.violations.map(v => v.id)));
    await page.keyboard.press('Escape');
    if (await dialog.count()) throw Error('Escape must close');
    if (!await trigger.evaluate(el => el === document.activeElement)) throw Error('Focus must return');
    if (await page.getByTitle('En uso: reemplaza o retira sus asignaciones antes de eliminar', { exact: true }).isEnabled()) throw Error('Assigned item must be blocked');
    await trigger.click(); await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    if (await page.getByRole('dialog').count()) throw Error('Cancel must close');
    await page.close();
  }
  console.log('3 responsive hydrated dialog cases PASS; confirmation, assigned block, simulated conflict, cancel/Escape, focus and axe (contrast excluded). No real deletions.');
} finally { await browser.close(); }
