import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
export function loadTs(file, overrides = {}, cache = new Map()) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const compiled = { exports: {} };
  cache.set(file, compiled);
  const require = (specifier) => {
    if (specifier in overrides) return overrides[specifier];
    if (specifier.startsWith(".")) {
      const json = path.resolve(path.dirname(file), specifier);
      if (json.endsWith('.json') && fs.existsSync(json)) return JSON.parse(fs.readFileSync(json, 'utf8'));
      const resolved = path.resolve(path.dirname(file), specifier) + ".ts";
      if (fs.existsSync(resolved)) return loadTs(resolved, overrides, cache);
    }
    return createRequire(file)(specifier);
  };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInThisContext("(function(require,module,exports){" + source + "\n})", {
    filename: file,
  })(require, compiled, compiled.exports);
  return compiled.exports;
}
