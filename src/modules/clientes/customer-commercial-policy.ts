export type CommercialPolicy = { allowedGroups: string[]; registeredGroup: string | null; b2bGroup: string | null };
export function parseCommercialPolicy(value: unknown): {policy:CommercialPolicy;revision:number} {
  if (!value || typeof value !== "object") throw new Error("Política inválida");
  const data = value as {policy:CommercialPolicy;revision:number};
  const policy = data.policy;
  if (!Number.isSafeInteger(data.revision) || data.revision < 0 || !policy || typeof policy !== "object" || !Array.isArray(policy.allowedGroups) || policy.allowedGroups.length > 100 || new Set(policy.allowedGroups).size !== policy.allowedGroups.length || policy.allowedGroups.some(code => typeof code !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(code))) throw new Error("Política inválida");
  for (const code of [policy.registeredGroup,policy.b2bGroup]) if (code !== null && !policy.allowedGroups.includes(code)) throw new Error("Política inválida");
  if (policy.b2bGroup !== null && policy.b2bGroup === policy.registeredGroup) throw new Error("B2B no puede ser predeterminado");
  return {policy:{allowedGroups:[...policy.allowedGroups],registeredGroup:policy.registeredGroup,b2bGroup:policy.b2bGroup},revision:data.revision};
}
