export type CmsEditorHistory<T> = { past: T[]; future: T[] };
export function checkpointHistory<T>(history: CmsEditorHistory<T>, current: T, limit: number): CmsEditorHistory<T> {
  return { past: [...history.past, current].slice(-limit), future: [] };
}
export function undoHistory<T>(history: CmsEditorHistory<T>, current: T, limit: number) {
  const value = history.past.at(-1);
  return value === undefined ? null : { value, history: { past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, limit) } };
}
export function redoHistory<T>(history: CmsEditorHistory<T>, current: T, limit: number) {
  const [value, ...future] = history.future;
  return value === undefined ? null : { value, history: { past: [...history.past, current].slice(-limit), future } };
}
