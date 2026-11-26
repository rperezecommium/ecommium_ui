import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Repeatable QA orchestration. No real business mutations are started here.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const output = path.resolve(root, option('output', 'docs/qa/full-app-20261125'));
if (!output.startsWith(root + path.sep)) throw Error('Output must be inside the UI repository');
fs.mkdirSync(output, {recursive:true});
const plan = JSON.parse(fs.readFileSync(path.join(root,'tests/audit/full-app/process.json'),'utf8'));
const reportPath = path.join(output,'results.json');
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath,'utf8')) : {
  schemaVersion:1, startedAt:new Date().toISOString(), scope:plan.scope,
  phases:{}, integrationChecks:[], findings:[], processes:structuredClone(plan.processes),
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save() {
  const evidence = name => {
    const file=path.join(output,name);
    return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
  };
  const readings=evidence('live-read.json')?.checks??[];
  const operations=evidence('live-operations.json')?.operations??[];
  const responsive=evidence('live-responsive.json')?.checks??[];
  report.integrationChecks=readings.map(c=>({name:c.route,status:c.status,detail:`Lectura únicamente; HTTP ${c.httpStatus??'sin confirmar'}${c.failure?'; '+c.failure:''}${c.overflow?'; overflow horizontal':''}`}));
  report.realOperations=operations;
  report.responsive=responsive;
  for(const p of report.processes){
    const matching=readings.filter(c=>c.route===p.route);
    if(matching.length)p.readingStatus=matching.at(-1).status;
    for(const operation of operations.filter(o=>o.id.startsWith(p.id+'-'))){
      const test=p.cases.find(c=>c.id===operation.id);
      if(test){test.status=operation.status;test.evidence=[operation.evidence];}
    }
  }
  const statuses=report.processes.flatMap(p=>p.cases.map(c=>c.status));
  report.caseCounts=Object.fromEntries(plan.statusValues.map(status=>[status,statuses.filter(s=>s===status).length]));
  report.verdict=statuses.some(s=>s==='FALLIDO')||Object.values(report.phases).some(p=>p.status==='FALLIDO')?'INCOMPLETO_CON_FALLOS':'INCOMPLETO';
  report.updatedAt = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(report,null,2)+'\n');
  const rows = Object.entries(report.phases).map(([name,phase]) => `<tr><td>${escape(name)}</td><td>${escape(phase.status)}</td><td>${escape(phase.mode)}</td><td>${phase.log ? `<a href="${escape(phase.log)}">Log</a>` : ''}</td></tr>`).join('');
  const processes = report.processes.map(p => `<details><summary>${escape(p.id)} · ${escape(p.surface)} · ${escape(p.name)} — Lectura: ${escape(p.readingStatus??'NO_EJECUTADO')}</summary><p>${escape(p.route)}</p><ul>${p.cases.map(c => `<li>${escape(c.id)} — ${escape(c.action)}: <strong>${escape(c.status)}</strong>${c.evidence.length ? ' · '+c.evidence.map(escape).join(', ') : ''}</li>`).join('')}</ul><p>Comprobaciones adicionales: ${p.requiredChecks.map(escape).join('; ')}.</p><p>Pruebas candidatas, sin equivalencia automática con integración: ${p.candidateTestFiles.map(escape).join(', ')}</p></details>`).join('');
  const checks = report.integrationChecks.map(c => `<li><strong>${escape(c.status)}</strong> · ${escape(c.name)} · ${escape(c.detail)}</li>`).join('');
  const findings = report.findings.map(c => `<li><strong>${escape(c.id)}</strong> · ${escape(c.detail)}</li>`).join('');
  const realRows=operations.map(o=>`<li><strong>${escape(o.status)}</strong> · ${escape(o.id)} · ${escape(o.action)} · ${escape(o.evidence)}</li>`).join('');
  const responsiveRows=responsive.map(c=>`<tr><td>${escape(c.route)}</td><td>${c.width}px</td><td>${c.overflow?'Sí':'No'}</td><td>${c.violations.map(v=>escape(v.id)).join(', ')||'Sin violaciones detectadas'}</td></tr>`).join('');
  const certification = report.functionalQaCertification;
  const certificationRows = (certification?.incidents ?? []).map(c => `<article><h3>${escape(c.id)} · ${escape(c.title)} — ${escape(c.state)}</h3><p><strong>Causa raíz:</strong> ${escape(c.rootCause)}</p><p><strong>Regla:</strong> ${escape(c.businessRule)}</p><p><strong>Solución:</strong> ${escape(c.solution)}</p><p><strong>Componentes:</strong> ${c.components.map(escape).join('; ')}</p><ul>${c.tests.map(t => `<li>${escape(t)}</li>`).join('')}</ul><p><strong>Evidencias:</strong> ${escape(c.evidence)}</p><p><strong>Límites:</strong> ${escape(c.risksAndDependencies)}</p><details><summary>Hallazgo original preservado</summary><p>${escape(c.originalFinding.detail)}</p></details></article>`).join('');
  const certificationHtml = certification ? `<h2>Certificación funcional acotada</h2><p>${escape(certification.scope)}</p><p>${escape(certification.limitation)} ${certification.automatedTests} pruebas selectivas aprobadas, además de operaciones reales documentadas.</p><p><a href="${escape(certification.evidenceFile)}">Evidencias detalladas</a></p>${certificationRows}` : '';
  fs.writeFileSync(path.join(output,'report.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>QA completo Ecommium</title><style>body{font:15px system-ui;max-width:1100px;margin:32px auto;padding:0 18px;color:#363a41}table{border-collapse:collapse;width:100%}td,th{padding:10px;border:1px solid #d9e1e7;text-align:left}summary{cursor:pointer;padding:12px;background:#eef3f6;margin-top:8px}li{margin:8px 0}p{line-height:1.6}</style><h1>QA Admin y Storefront</h1><p><strong>${escape(report.verdict)}</strong></p><p>Actualizado: ${escape(report.updatedAt)}. ${plan.processes.length} procesos; ${plan.processes.reduce((n,p)=>n+p.cases.length,0)} casos. Las fases automáticas no aprueban por sí solas un proceso real completo.</p><p>Casos reales: ${Object.entries(report.caseCounts).map(([s,n])=>`${escape(s)}: ${n}`).join(' · ')}. Las lecturas no equivalen a CRUD completo.</p><h2>Cómo repetir</h2><p><code>npm run test:full-app</code> ejecuta análisis, build, unitarias, contratos y navegadores aislados. Continúa después de un fallo y devuelve error al terminar si alguna fase falla. No ejecuta compras ni escrituras reales automáticamente. Usar <code>-- --phases=unit,contracts</code> para una selección o <code>-- --refresh</code> para reconstruir este informe.</p><h2>Fases ejecutadas</h2><table><tr><th>Fase</th><th>Estado</th><th>Entorno</th><th>Evidencia</th></tr>${rows}</table>${certificationHtml}<h2>Hallazgos</h2><ul>${findings || '<li>Sin hallazgos registrados.</li>'}</ul><h2>Recorridos reales</h2><ul>${realRows}</ul><h2>Lecturas reales</h2><ul>${checks || '<li>Sin comprobaciones registradas todavía.</li>'}</ul><h2>Responsive y accesibilidad real</h2><p>Axe en main, sin excluir contraste. Las comprobaciones incompletas requieren revisión manual y no acreditan accesibilidad total.</p><table><tr><th>Ruta</th><th>Ancho</th><th>Overflow</th><th>Axe</th></tr>${responsiveRows}</table><h2>Seguimiento por proceso</h2>${processes}</html>`);
}
const phases = {
  lint:{command:'npm',args:['run','lint'],mode:'Análisis estático'},
  build:{command:'npm',args:['run','build'],mode:'Compilación'},
  unit:{command:'npm',args:['test'],mode:'Unitarias / contratos UI / fixtures'},
  contracts:{command:'npm',args:['run','test:cms-contracts'],mode:'Contratos CMS documentados / fixtures'},
  e2e:{command:'npx',args:['--no-install','playwright','test','--reporter=line'],mode:'Navegador con BFF simulados; live audit opt-in omitido'},
};
for (const file of fs.readdirSync(path.join(root,'tests/e2e')).filter(f=>f.endsWith('-browser.mjs'))) {
  phases[file.replace('-browser.mjs','')]={command:process.execPath,args:[`tests/e2e/${file}`],mode:'Navegador CMS aislado; acciones simuladas'};
}
if (args.includes('--refresh')) { save(); process.exit(0); }
if (args.includes('--list')) { console.log(Object.keys(phases).join('\n')); process.exit(0); }
const selected=option('phases',Object.keys(phases).join(',')).split(',');
for (const name of selected) if (!phases[name]) throw Error(`Unknown phase: ${name}`);
for (const name of selected) {
  const phase=phases[name], startedAt=new Date().toISOString();
  const log=`${name}.log`;
  report.phases[name]={status:'EN_EJECUCION',mode:phase.mode,startedAt,log};save();
  console.log(`START ${name}`);
  const stream=fs.createWriteStream(path.join(output,log));
  const result=await new Promise(resolve=>{
    const child=spawn(phase.command,phase.args,{cwd:root,env:{...process.env,PRODUCTS_LIVE_AUDIT:'false',PLAYWRIGHT_HTML_OPEN:'never'},stdio:['ignore','pipe','pipe']});
    child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});
    child.once('error',error=>resolve({code:null,error:error.message}));
    child.once('close',(code,signal)=>resolve({code,signal}));
  });
  await new Promise(resolve=>stream.end(resolve));
  report.phases[name]={...report.phases[name],status:result.code===0?'APROBADO':'FALLIDO',...result,finishedAt:new Date().toISOString()};save();
  console.log(`${report.phases[name].status} ${name}`);
}
process.exitCode=selected.some(name=>report.phases[name].status==='FALLIDO')?1:0;
