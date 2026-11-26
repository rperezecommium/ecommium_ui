export type ShopReadPreparation = {
  requestId: string | null; organizationId: string; shopId: string;
  state: "PENDING" | "RUNNING" | "READY" | "FAILED" | "BLOCKED";
  phase: string; attempts: number; updatedAt: string; code: string | null;
  context: { locale: string; currency: string; country: string; channel: string };
};
export function parseShopReadPreparation(value: unknown): ShopReadPreparation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Estado de preparación no válido.");
  const x = value as Record<string, unknown>, c = x.context as Record<string,unknown> | undefined;
  if (Object.keys(x).some(k=>!["requestId","organizationId","shopId","state","phase","attempts","updatedAt","code","context"].includes(k)) || !["PENDING","RUNNING","READY","FAILED","BLOCKED"].includes(String(x.state)) || typeof x.organizationId!=="string" || !x.organizationId || typeof x.shopId!=="string" || !x.shopId || typeof x.phase!=="string" || !/^[A-Z_]{1,64}$/.test(x.phase) || !Number.isSafeInteger(x.attempts) || Number(x.attempts)<0 || typeof x.updatedAt!=="string" || !Number.isFinite(Date.parse(x.updatedAt)) || x.requestId!==null&&(typeof x.requestId!=="string"||!/^[a-f0-9-]{36}$/.test(x.requestId)) || x.code!==null&&(typeof x.code!=="string"||!/^[A-Z][A-Z0-9_]{1,95}$/.test(x.code)) || !c || Object.keys(c).some(k=>!["locale","currency","country","channel"].includes(k)) || ["locale","currency","country","channel"].some(k=>typeof c[k]!=="string"||!c[k])) throw Error("Estado de preparación no válido.");
  return x as ShopReadPreparation;
}
export const preparationLabels = {PENDING:"Preparando",RUNNING:"Preparando",READY:"Lista",FAILED:"Requiere atención",BLOCKED:"Pendiente de preparación"} as const;
