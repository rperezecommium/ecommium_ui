export type FeatureImpact = {
  groupId: string;
  fieldId: string;
  name: string;
  isActive: boolean;
  version: string;
  affectedProducts: number;
  affectedCategories: number;
  affectedShops: number;
  scopes: Array<{ organizationId: string; shopId: string }>;
  preservesAssignments: true;
};
export const featureId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export function parseFeatureImpact(
  value: unknown,
  groupId: string,
  fieldId: string,
): FeatureImpact {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("INVALID_IMPACT");
  const p = value as FeatureImpact;
  if (
    p.groupId !== groupId ||
    p.fieldId !== fieldId ||
    typeof p.name !== "string" ||
    !p.name ||
    p.name.length > 200 ||
    typeof p.isActive !== "boolean" ||
    !/^[a-f0-9]{64}$/.test(p.version) ||
    p.preservesAssignments !== true ||
    ![p.affectedProducts, p.affectedCategories, p.affectedShops].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    !Array.isArray(p.scopes) ||
    !p.scopes.length ||
    p.scopes.length > 10000 ||
    p.scopes.length !== p.affectedShops ||
    p.scopes.some(
      (s) => !s || !featureId(s.organizationId) || !featureId(s.shopId),
    )
  )
    throw Error("INVALID_IMPACT");
  return p;
}
