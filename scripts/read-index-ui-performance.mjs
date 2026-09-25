#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseUrl = process.env.ECOMMIUM_UI_PERF_BASE_URL || 'http://127.0.0.1:5173';
const outDir = resolve(process.env.ECOMMIUM_UI_PERF_OUT_DIR || '.tmp/read-index-ui-performance');
const routes = (process.env.ECOMMIUM_UI_PERF_ROUTES || '/,/plp/bike-brakes,/admin/products')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);
const iterations = positiveInt(process.env.ECOMMIUM_UI_PERF_ITERATIONS, 3);
const timeoutMs = positiveInt(process.env.ECOMMIUM_UI_PERF_TIMEOUT_MS, 30000);
mkdirSync(outDir, { recursive: true });

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(3));
}

function summarize(samples, key) {
  const values = samples.map((sample) => sample[key]).filter((value) => typeof value === 'number' && Number.isFinite(value));
  return { p50: percentile(values, 50), p95: percentile(values, 95), p99: percentile(values, 99), min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null };
}

async function measureRoute(browser, route) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const requests = [];
    const failed = [];
    page.on('requestfinished', (request) => requests.push({ url: request.url(), method: request.method(), resourceType: request.resourceType() }));
    page.on('requestfailed', (request) => failed.push({ url: request.url(), method: request.method(), failure: request.failure()?.errorText }));
    const started = performance.now();
    let status = null;
    let error = null;
    try {
      const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'load', timeout: timeoutMs });
      status = response?.status() ?? null;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const elapsedMs = performance.now() - started;
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = Object.fromEntries(performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]));
      return nav ? {
        ttfbMs: nav.responseStart,
        domContentLoadedMs: nav.domContentLoadedEventEnd,
        loadMs: nav.loadEventEnd,
        fcpMs: paint['first-contentful-paint'] ?? null,
        transferSize: nav.transferSize,
        encodedBodySize: nav.encodedBodySize,
        decodedBodySize: nav.decodedBodySize,
      } : {};
    }).catch(() => ({}));
    const bffRequests = requests.filter((request) => request.url.includes('/api/v1/') || request.url.includes('/storefront/') || request.url.includes('/admin/'));
    samples.push({ route, iteration: i + 1, status, error, elapsedMs: Number(elapsedMs.toFixed(3)), requestCount: requests.length, failedRequestCount: failed.length, bffRequestCount: bffRequests.length, failed, bffRequests: bffRequests.slice(0, 20), ...perf });
    await context.close();
  }
  return samples;
}

const browser = await chromium.launch({ headless: true });
const allSamples = [];
for (const route of routes) {
  allSamples.push(...await measureRoute(browser, route));
}
await browser.close();
const byRoute = Object.fromEntries(routes.map((route) => {
  const samples = allSamples.filter((sample) => sample.route === route);
  return [route, {
    samples: samples.length,
    errors: samples.filter((sample) => sample.error || sample.status >= 400 || sample.failedRequestCount > 0).length,
    elapsedMs: summarize(samples, 'elapsedMs'),
    ttfbMs: summarize(samples, 'ttfbMs'),
    fcpMs: summarize(samples, 'fcpMs'),
    domContentLoadedMs: summarize(samples, 'domContentLoadedMs'),
    loadMs: summarize(samples, 'loadMs'),
    requestCount: summarize(samples, 'requestCount'),
    bffRequestCount: summarize(samples, 'bffRequestCount'),
  }];
}));
const result = { version: 1, baseUrl, routes, iterations, createdAt: new Date().toISOString(), byRoute, samples: allSamples };
const out = resolve(outDir, `ui-readindex-perf-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', out, byRoute }, null, 2));
