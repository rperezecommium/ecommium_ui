import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("development server uses explicit Webpack HMR on the local UI port", () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(repoRoot, "package.json"), "utf8"),
  );

  assert.match(packageJson.scripts.dev, /\bnext dev\b/);
  assert.match(packageJson.scripts.dev, /--webpack\b/);
  assert.match(packageJson.scripts.dev, /(?:-p|--port)\s+5173\b/);
});
