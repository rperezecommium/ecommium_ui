const mediaTypes = {
  "image/jpeg": { extension: ".jpg", signature: (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: ".png", signature: (bytes: Uint8Array) => bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]) },
  "image/webp": { extension: ".webp", signature: (bytes: Uint8Array) => bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} as const;

export const safeMediaMimeTypes = Object.keys(mediaTypes) as Array<keyof typeof mediaTypes>;
export const safeMediaInputAccept = safeMediaMimeTypes.join(",");
export const maximumMediaFilesPerUpload = 12;
export const maximumMediaBytes = 8 * 1024 * 1024;

export type MediaUploadValidation =
  | { ok: true; file: File }
  | { ok: false; error: string };

export type MediaUploadsValidation =
  | { ok: true; files: File[] }
  | { ok: false; error: string };

function safeFileName(name: string, extension: string) {
  const stem = name.replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "").slice(0, 80) || "media";
  return `${stem}${extension}`;
}

export async function validateMediaUpload(file: File): Promise<MediaUploadValidation> {
  if (!file.size) return { ok: false, error: "Selecciona una imagen con contenido." };
  if (file.size > maximumMediaBytes) return { ok: false, error: "Cada imagen puede ocupar como máximo 8 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = safeMediaMimeTypes.find((type) => mediaTypes[type].signature(bytes));
  if (!mediaType) return { ok: false, error: "Solo se admiten imágenes JPG, PNG o WebP válidas." };
  if (file.type && file.type !== mediaType) return { ok: false, error: "El tipo declarado de la imagen no coincide con su contenido." };

  return { ok: true, file: new File([file], safeFileName(file.name, mediaTypes[mediaType].extension), { type: mediaType }) };
}

export async function validateMediaUploads(files: File[]): Promise<MediaUploadsValidation> {
  if (!files.length) return { ok: false, error: "Selecciona al menos una imagen." };
  if (files.length > maximumMediaFilesPerUpload) return { ok: false, error: `Puedes subir como máximo ${maximumMediaFilesPerUpload} imágenes a la vez.` };
  const validated = await Promise.all(files.map(validateMediaUpload));
  const invalid = validated.find((result) => !result.ok);
  if (invalid && !invalid.ok) return invalid;
  return { ok: true, files: validated.map((result) => (result as { ok: true; file: File }).file) };
}

export function isSafeInlineMediaType(contentType: string | null) {
  const normalized = contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return safeMediaMimeTypes.includes(normalized as keyof typeof mediaTypes) ? normalized : undefined;
}
