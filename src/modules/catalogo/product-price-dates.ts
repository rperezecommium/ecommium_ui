/** datetime-local uses the browser's local zone, never an unlabelled UTC value. */
export function isoToDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dateTimeLocalToIso(
  value: string,
  originalIso?: string | null,
): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;

  const original = originalIso ? new Date(originalIso) : null;
  if (original && !Number.isNaN(original.getTime())) {
    // Keep seconds, milliseconds and the later occurrence of a repeated hour.
    if (isoToDateTimeLocal(originalIso) === value) return originalIso ?? null;
    // Editing within a repeated hour retains the original occurrence if possible.
    const candidate = new Date(Date.parse(`${value}Z`) + original.getTimezoneOffset() * 60_000);
    if (!Number.isNaN(candidate.getTime()) && isoToDateTimeLocal(candidate.toISOString()) === value) return candidate.toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Reject nonexistent local times instead of silently moving them past a DST gap.
  return isoToDateTimeLocal(date.toISOString()) === value ? date.toISOString() : null;
}
