import type { StorefrontPdpVariant } from "./pdp";

type Variant = Pick<StorefrontPdpVariant, "variantId" | "available" | "options">;

export function pdpVariantOptionGroups(variants: Variant[]) {
  const groups = new Map<string, Set<string>>();
  for (const variant of variants) {
    for (const option of variant.options) {
      const attribute = option.attributeCode.trim();
      const value = option.valueCode.trim();
      if (!attribute || !value) continue;
      if (!groups.has(attribute)) groups.set(attribute, new Set());
      groups.get(attribute)!.add(value);
    }
  }
  return Array.from(groups, ([attribute, values]) => ({ attribute, values: [...values] }));
}

export function pdpVariantForOption(
  variants: Variant[], selected: Variant | undefined, attribute: string, value: string,
) {
  const selectedOptions = new Map(selected?.options.map(option => [option.attributeCode.trim(), option.valueCode.trim()]));
  const candidates = variants.filter(variant => variant.available && variant.options.some(
    option => option.attributeCode.trim() === attribute && option.valueCode.trim() === value,
  ));
  // Select an existing combination, retaining the other selected attributes
  // wherever possible. Stable ties follow the existing variant order.
  const score = (variant: Variant) => variant.options.filter(option =>
    option.attributeCode.trim() !== attribute && selectedOptions.get(option.attributeCode.trim()) === option.valueCode.trim(),
  ).length;
  return candidates.find(variant => variant.variantId === selected?.variantId)
    ?? candidates.reduce<Variant | undefined>((best, candidate) => !best || score(candidate) > score(best) ? candidate : best, undefined);
}
