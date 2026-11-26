import type { CmsIndependentModule } from "./cms-independent-module-types";
// Canonicalize only declared identities/references to compare a create receipt
// whose owner has assigned fresh IDs. Content, assets and graph topology remain.
export function remapIndependentModule(value: CmsIndependentModule, nextId: () => string) {
  const copy = structuredClone(value),
    ids = new Map<string, string>([[copy.instanceId, nextId()]]);
  const visit = (
    node: Record<string, unknown>,
    fn: (node: Record<string, unknown>) => void,
  ) => {
    fn(node);
    for (const key of ["panels", "elements", "children"])
      if (Array.isArray(node[key]))
        (node[key] as Record<string, unknown>[]).forEach((child) =>
          visit(child, fn),
        );
  };
  if (copy.body.kind === "visual")
    visit(copy.body.value as unknown as Record<string, unknown>, (node) => {
      for (const key of ["moduleId", "panelId", "elementId"])
        if (typeof node[key] === "string") {
          if (ids.has(node[key])) throw new Error("Duplicate identity");
          ids.set(node[key], nextId());
        }
    });
  const ref = (value: string) => ids.get(value) ?? value;
  const fragment = (value: string) =>
    value.startsWith("#") && ids.has(value.slice(1))
      ? "#" + ref(value.slice(1))
      : value;
  copy.instanceId = ref(copy.instanceId);
  if (copy.body.kind === "visual") {
    visit(copy.body.value as unknown as Record<string, unknown>, (node) => {
      for (const key of ["moduleId", "panelId", "elementId"])
        if (typeof node[key] === "string") node[key] = ref(node[key]);
      const props = node.props as Record<string, unknown> | undefined;
      if (props) {
        for (const key of ["ariaLabelledBy", "ariaDescribedBy"])
          if (typeof props[key] === "string")
            props[key] = props[key].split(" ").map(ref).join(" ");
        if (typeof props.href === "string") props.href = fragment(props.href);
      }
    });
    for (const [key, field] of Object.entries(copy.body.value.contentSchema))
      if (field.type === "url") {
        if (typeof field.defaultValue === "string")
          field.defaultValue = fragment(field.defaultValue);
        const values = copy.body.value.contentValues;
        if (values && typeof values[key] === "string")
          values[key] = fragment(values[key]);
      }
  }
  if (copy.styleSheet)
    for (const rules of Object.values(copy.styleSheet))
      for (const rule of rules ?? [])
        rule.selector = rule.selector.replace(/\[[^\]]+\]|#[\w-]+/g, (token) =>
          token.startsWith("#")
            ? "#" + ref(token.slice(1))
            : token.replace(
                /^(\[(?:data-cms-node-id|data-cms-visual-module|aria-labelledby|aria-describedby|id)=)(["']?)([\w.:-]+)\2\]$/,
                (_, start, quote, id) => `${start}${quote}${ref(id)}${quote}]`,
              ),
        );
  return copy;
}
function sorted(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(sorted).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, v]) => JSON.stringify(key) + ":" + sorted(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function independentModuleReceiptMatches(
  expected: CmsIndependentModule,
  actual: CmsIndependentModule,
) {
  try {
    const canonical=(value:CmsIndependentModule)=>{let i=0;return sorted(remapIndependentModule(value,()=>`identity-${i++}`));};
    return canonical(expected) === canonical(actual);
  } catch {
    return false;
  }
}
