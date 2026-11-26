/** Compare all submitted values, allowing only additional server defaults. */
export function cmsCompositionMatches(expected: unknown, actual: unknown): boolean {
  if (expected === null || typeof expected !== "object") return typeof expected === "string" && typeof actual === "string" ? expected.trim() === actual.trim() : expected === actual;
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.length === actual.length && expected.every((value, index) => cmsCompositionMatches(value, actual[index]));
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const record = actual as Record<string, unknown>;
  return Object.entries(expected).every(([key, value]) => value === undefined || cmsCompositionMatches(value, record[key]));
}
