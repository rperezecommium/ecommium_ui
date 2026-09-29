export type ImportCategoryAssignment =
  | { mode: "csv" }
  | { mode: "existing"; categoryId: string }
  | { mode: "new"; name: string };

export function parseImportCategoryAssignment(value: unknown): ImportCategoryAssignment {
  if (value === undefined) return { mode: "csv" };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Selecciona una opción de categoría válida.");
  const input = value as Record<string, unknown>;
  const keys = input.mode === "csv" ? ["mode"] : input.mode === "existing" ? ["mode", "categoryId"] : ["mode", "name"];
  if (Object.keys(input).some(key => !keys.includes(key))) throw new Error("Selecciona una sola opción de categoría.");
  if (input.mode === "csv") return { mode: "csv" };
  if (input.mode === "existing") {
    if (typeof input.categoryId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.categoryId.trim())) {
      throw new Error("Selecciona una categoría existente.");
    }
    return { mode: "existing", categoryId: input.categoryId.trim().toLowerCase() };
  }
  if (input.mode === "new" && typeof input.name === "string") {
    const name = input.name.trim().normalize("NFC");
    if (name && name.length <= 200 && !/[\x00-\x1f\x7f]/.test(name)) return { mode: "new", name };
    throw new Error("Escribe un nombre de categoría de 1 a 200 caracteres.");
  }
  throw new Error("Selecciona una opción de categoría válida.");
}
