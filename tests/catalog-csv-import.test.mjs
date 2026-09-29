import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/modules/catalogo/catalog-csv-import-state.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
const { importPhase, statusProgress } = exports;

test('UPLOADED and intermediate preparation states do not enable Apply', () => {
  for (const state of ['UPLOADED', 'PARSING', 'NORMALIZED', 'DEPENDENCIES_RESOLVED']) assert.equal(importPhase({ state }), 'preparing');
  assert.equal(importPhase({ state: 'STAGED' }), 'staged');
});
test('Catalog completion alone and publication acceptance do not mean import completion', () => {
  assert.equal(importPhase({ state: 'COMPLETED' }), 'polling');
  assert.equal(importPhase({ state: 'PROJECTING', managed: true, phase: 'projection' }), 'polling');
  assert.ok(statusProgress({ state: 'PROJECTING', managed: true, phase: 'projection' }) < 100);
  assert.equal(importPhase({ state: 'COMPLETED', managed: true }), 'completed');
  assert.equal(statusProgress({ state: 'COMPLETED', managed: true }), 100);
});
test('partial acceptance preserves the jobs in the response and reports failure', () => {
  const payload = { state: 'PARTIALLY_APPLIED', jobs: [{ owner: 'catalog', response: { jobId: 'c1', state: 'QUEUED' } }], errors: [{ owner: 'pricing', message: 'STAGE_UNRESOLVED' }] };
  assert.equal(importPhase(payload), 'failed');
  assert.equal(payload.jobs[0].response.jobId, 'c1');
});
test('expired authorization is resumable and never completed', () => {
  assert.equal(importPhase({ state: 'AWAITING_AUTHORIZATION', managed: true, errors: [{ owner: 'catalog', message: 'AUTHORIZATION_REQUIRED' }] }), 'paused');
});
test('infrastructure pauses remain resumable and partial completion is explicit', () => {
  assert.equal(importPhase({ state: 'PAUSED', managed: true, errors: [{ owner: 'media', message: 'MEDIA_IMPORT_INFRASTRUCTURE_UNAVAILABLE' }] }), 'paused');
  assert.equal(importPhase({ state: 'COMPLETED_WITH_WARNINGS', managed: true }), 'completed');
});
test('UI checks readiness before submitting CSV and displays owner outcome counts', () => {
  const ui = readFileSync(new URL('../src/modules/catalogo/catalog-csv-import-client.tsx', import.meta.url), 'utf8');
  assert.ok(ui.indexOf('/readiness?') < ui.indexOf('new FormData()'));
  assert.match(ui, /status\?\.ready !== true/);
  assert.match(ui, /currentCheck\?\.state !== "ready" \|\| uploadInFlight.current/);
  assert.match(ui, /onChangeCapture=\{invalidateInfrastructure\}/);
  assert.match(ui, /infrastructure.file === selectedFile/);
  assert.match(ui, /if \(abort.signal.aborted\) return/);
  assert.match(ui, /Sugerencia: sistema listo para la importación/);
  assert.match(ui, /outcomes.counts.published/);
  assert.match(ui, /outcomes.counts.rejected/);
  assert.match(ui, /outcomes.counts.draft/);
  assert.match(ui, /outcomes.nextCursor/);
});
test('component delegates continuation and publication to BFF, stores no token, and reads progress by import ID', () => {
  const ui = readFileSync(new URL('../src/modules/catalogo/catalog-csv-import-client.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /publication\/apply|jobsParam|ownerJobs\.every/);
  assert.match(ui, /setJobs\(body\.jobs \?\? \[\]\)/);
  assert.match(ui, /applyId\.current \?\?= operationId\(\)/);
  assert.doesNotMatch(ui, /localStorage\.setItem[^\n]*(?:token|authorization)/i);
  assert.match(ui, /abort\.abort\(\)/);
});

const categoryExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/modules/catalogo/catalog-csv-import-category.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: categoryExports });
const { parseImportCategoryAssignment } = categoryExports;
test('category modes are exclusive and default to CSV', () => {
  assert.equal(parseImportCategoryAssignment().mode, 'csv');
  assert.equal(parseImportCategoryAssignment({ mode: 'new', name: '  Nutrition, sport  ' }).name, 'Nutrition, sport');
  const categoryId = '8084421f-b39e-459d-8261-1947250ff84f';
  assert.equal(parseImportCategoryAssignment({ mode: 'existing', categoryId }).categoryId, categoryId);
  for (const invalid of [null, {}, { mode: 'csv', name: 'Other' }, { mode: 'existing', categoryId: '' }, { mode: 'new', name: ' ' }, { mode: 'new', name: 'x'.repeat(201) }]) assert.throws(() => parseImportCategoryAssignment(invalid));
});
test('category choice is persisted with the import and forwarded through the BFF profile', () => {
  const ui = readFileSync(new URL('../src/modules/catalogo/catalog-csv-import-client.tsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../app/api/admin/catalog-import-jobs/csv/route.ts', import.meta.url), 'utf8');
  assert.match(ui, /form.set\("categoryAssignment", JSON.stringify\(assignment\)\)/);
  assert.match(ui, /parseImportCategoryAssignment\(previous.categoryAssignment\)/);
  assert.match(ui, /const categoryLocked = busy \|\| !!importJobId/);
  assert.match(route, /form.set\("profile", JSON.stringify\(\{ categoryAssignment \}\)\)/);
  assert.doesNotMatch(ui, /createProductCategoryInlineAction/);
});
