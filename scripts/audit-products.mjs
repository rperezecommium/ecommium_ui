import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const collect = process.argv.includes("--collect-only");
const directoryArgument = process.argv.find((arg) => arg.startsWith("--results="))?.slice(10);
const directory = path.resolve(directoryArgument ?? `artifacts/products-audit/${new Date().toISOString().replaceAll(":", "-")}`);
const scope = JSON.parse(await readFile(path.join(root, "tests/audit/products-scope.json"), "utf8"));
await mkdir(directory, { recursive: true });
const environment = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(directory, "e2e.json") };
// This runner audits the UI against explicit fixtures. It never opts into live retirement labs.
for (const key of Object.keys(environment)) if (key.startsWith("RETIREMENT_LAB_") || key === "CATALOG_RETIREMENT_LAB_URL") delete environment[key];
const selection = "product|catalog|variant|feature|brand|category|media|offering|stock|pricing|inventory";
const stages = [];
async function run(name, command, args) {
  const startedAt = Date.now();
  const file = path.join(directory, `${name}.log`);
  const { createWriteStream } = await import("node:fs");
  const stream = createWriteStream(file);
  console.log(`[${name}] ${command} ${args.join(" ")}`);
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: environment, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.pipe(stream, { end: false });
    child.stderr.pipe(stream, { end: false });
    child.once("error", reject);
    child.once("close", (code) => { stream.end(); resolve(code ?? 1); });
  });
  const stage = { name, exitCode, durationMs: Date.now() - startedAt };
  stages.push(stage);
  console.log(`[${name}] ${exitCode === 0 ? "PASS" : "FAIL"}`);
  return exitCode;
}
if (!collect) {
  await run("lint", "npm", ["run", "lint"]);
  const build = await run("build", "npm", ["run", "build"]);
  const files = (await readdir(path.join(root, "tests"))).filter((name) => name.endsWith(".test.mjs")).map((name) => `tests/${name}`);
  await run("unit", process.execPath, ["--test", ...files]);
  if (build === 0) await run("e2e", "npx", ["--no-install", "playwright", "test", "tests/e2e/admin-login.spec.ts", "--grep", selection, "--reporter=line,json", `--output=${path.join(directory, "browser")}`]);
  else stages.push({ name: "e2e", exitCode: null, reason: "Build failed; browser tests were not run." });
  await writeFile(path.join(directory, "stages.json"), JSON.stringify(stages, null, 2));
}
const read = async (name) => readFile(path.join(directory, name), "utf8").catch(() => "");
const tap = await read("unit.log");
const metric = (name) => Number(tap.match(new RegExp(`^# ${name} (\\d+)`, "m"))?.[1] ?? 0);
const unitFailures = [...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map((match) => match[1]);
const browser = JSON.parse(await read("e2e.json") || "{}");
const scenarios = [];
function visit(suites, parents = []) {
  for (const suite of suites ?? []) {
    const titles = [...parents, suite.title].filter(Boolean);
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      const result = test.results?.at(-1);
      scenarios.push({ title: [...titles, spec.title].join(" / "), file: spec.file ?? suite.file, line: spec.line, outcome: test.status, durationMs: result?.duration, error: result?.error?.message?.replace(/\u001b\[[0-9;]*m/g, "").slice(0, 1200) });
    }
    visit(suite.suites, titles);
  }
}
visit(browser.suites);
const persistedStages = collect ? JSON.parse(await read("stages.json") || "[]") : stages;
const report = { generatedAt: new Date().toISOString(), mode: "automated-fixtures-only", warning: "This report does not certify real services, production, or manual CRUD completion.", stages: persistedStages, unit: { total: metric("tests"), passed: metric("pass"), failed: metric("fail"), failures: unitFailures }, browser: { stats: browser.stats ?? {}, errors: browser.errors ?? [], scenarios }, scope: scope.map((resource) => ({ ...resource, matchingScenarios: scenarios.filter((scenario) => new RegExp(resource.pattern, "i").test(scenario.title)).map(({ title, outcome }) => ({ title, outcome })) })) };
await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
const safe = (text) => String(text).replaceAll("|", "\\|").replaceAll("\n", " ");
const lines = ["# Auditoría automatizada de Productos", "", `Fecha UTC: ${report.generatedAt}`, "", "**Alcance:** pruebas de código y navegador con BFF simulado. Las verificaciones reales deben registrarse por separado. Un caso sin evidencia no está aprobado.", "", `Unitarias: ${report.unit.passed}/${report.unit.total} aprobadas; ${report.unit.failed} fallidas.`, `Navegador: ${scenarios.length} casos; ${scenarios.filter((item) => item.outcome === "unexpected").length} fallidos; ${scenarios.filter((item) => item.outcome === "skipped").length} omitidos.`, "", "## Fallos unitarios", "", ...unitFailures.map((name) => `- ${safe(name)}`), "", "## Escenarios de navegador", "", "| Caso | Resultado |", "|---|---|", ...scenarios.map((item) => `| ${safe(item.title)} | ${safe(item.outcome)} |`), "", "## Matriz de alcance", "", "| Recurso | Comprobaciones requeridas | Casos relacionados (no equivalen a cobertura completa) |", "|---|---|---|", ...report.scope.map((item) => `| ${safe(item.resource)} | ${safe(item.checks.join("; "))} | ${item.matchingScenarios.length} |`), "", "Ver report.json y logs para detalles. No atribuir automáticamente un fallo del test a un fallo del producto: puede ser un selector o fixture obsoleto."];
await writeFile(path.join(directory, "report.md"), lines.join("\n") + "\n");
console.log(`Informe: ${path.join(directory, "report.md")}`);
if (report.unit.failed || scenarios.some((item) => item.outcome === "unexpected") || persistedStages.some((stage) => stage.exitCode !== 0)) process.exitCode = 1;
