const ACTIVE_STATUSES = new Set(["ACTIVE", "PUBLISHED", "ONLINE"]);
const INACTIVE_STATUSES = new Set(["ARCHIVED", "DISABLED", "DRAFT", "INACTIVE", "OFFLINE"]);

function statusText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : undefined;
}

export function productStatusIsActive(record: Record<string, unknown>, fallback = false) {
  if (typeof record.isActive === "boolean") {
    return record.isActive;
  }
  if (typeof record.active === "boolean") {
    return record.active;
  }

  const status = statusText(record.status ?? record.publicationStatus ?? record.state);
  if (!status) {
    return fallback;
  }
  if (ACTIVE_STATUSES.has(status)) {
    return true;
  }
  if (INACTIVE_STATUSES.has(status)) {
    return false;
  }

  return fallback;
}
