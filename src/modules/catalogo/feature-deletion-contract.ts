import {
  featureId,
  parseFeatureImpact,
  type FeatureImpact,
} from "./feature-deactivation-contract";
export type FeatureDeletion = {
  operationId: string;
  groupId: string;
  fieldId: string;
  name: string;
  affectedProducts: number;
  affectedCategories: number;
  scopes: Array<{ organizationId: string; shopId: string }>;
  deleted: true;
  createdAt: string;
  cacheInvalidationPending: boolean;
};
export type FeatureDeletionStatus = FeatureDeletion & {
  completedShops: number;
  totalShops: number;
  remainingProducts: number;
  remainingDefinitions: number;
  unavailableShops: number;
  complete: boolean;
};
export function parseFeatureDeletion(
  value: unknown,
  operationId: string,
): FeatureDeletion {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("INVALID_DELETION");
  const p = value as FeatureDeletion;
  if (
    p.operationId !== operationId ||
    !featureId(p.operationId) ||
    !featureId(p.groupId) ||
    !featureId(p.fieldId) ||
    p.deleted !== true ||
    typeof p.name !== "string" ||
    !p.name ||
    p.name.length > 200 ||
    typeof p.createdAt !== "string" ||
    !Number.isFinite(Date.parse(p.createdAt)) ||
    typeof p.cacheInvalidationPending !== "boolean" ||
    ![p.affectedProducts, p.affectedCategories].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    !Array.isArray(p.scopes) ||
    !p.scopes.length ||
    p.scopes.length > 10000 ||
    p.scopes.some(
      (s) => !s || !featureId(s.organizationId) || !featureId(s.shopId),
    )
  )
    throw Error("INVALID_DELETION");
  return p;
}
export function parseFeatureDeletionStatus(
  value: unknown,
  operationId: string,
): FeatureDeletionStatus {
  const p = parseFeatureDeletion(value, operationId) as FeatureDeletionStatus;
  if (
    typeof p.complete !== "boolean" ||
    ![
      p.completedShops,
      p.totalShops,
      p.remainingProducts,
      p.remainingDefinitions,
      p.unavailableShops,
    ].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    p.totalShops !== p.scopes.length ||
    p.completedShops + p.unavailableShops > p.totalShops ||
    p.complete !==
      (p.completedShops === p.totalShops && !p.cacheInvalidationPending) ||
    (p.complete &&
      (p.remainingProducts > 0 ||
        p.remainingDefinitions > 0 ||
        p.unavailableShops > 0))
  )
    throw Error("INVALID_DELETION_STATUS");
  return p;
}

export type FeatureDeletionImpact = Omit<
  FeatureImpact,
  "preservesAssignments"
> & { preservesAssignments: false; action: "DELETE" };
export function parseFeatureDeletionImpact(
  value: unknown,
  groupId: string,
  fieldId: string,
): FeatureDeletionImpact {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("INVALID_DELETION_IMPACT");
  const p = value as FeatureDeletionImpact;
  if (p.action !== "DELETE" || p.preservesAssignments !== false)
    throw Error("INVALID_DELETION_IMPACT");
  parseFeatureImpact({ ...p, preservesAssignments: true }, groupId, fieldId);
  return p;
}
