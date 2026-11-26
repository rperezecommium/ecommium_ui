import { AdminFormValidationError } from "../../shared/validation/admin-form-state";
export type CatalogCreateInput = {
  name: string;
  isActive: boolean;
  slug?: string;
  title?: string;
  description?: string;
  keywords?: string;
  text?: string;
  siteTitle?: string;
};
export function catalogCreatePayload(
  kind: "categories" | "brands",
  input: CatalogCreateInput,
) {
  const errors: Record<string, string> = {};
  const required = (key: keyof CatalogCreateInput, label: string) => {
    const value =
      typeof input[key] === "string" ? (input[key] as string).trim() : "";
    if (!value) errors[key] = `${label} es obligatorio.`;
    return value;
  };
  const name = required("name", "El nombre"),
    keywords = required("keywords", "Las palabras clave");
  let payload;
  if (kind === "categories")
    payload = {
      name,
      slug: required("slug", "El slug"),
      title: required("title", "El título"),
      description: required("description", "La descripción"),
      keywords,
      isActive: input.isActive,
    };
  else
    payload = {
      name,
      text: required("text", "La descripción"),
      siteTitle: required("siteTitle", "El título SEO"),
      keywords,
      isActive: input.isActive,
    };
  if (Object.keys(errors).length) throw new AdminFormValidationError(errors);
  return payload;
}
