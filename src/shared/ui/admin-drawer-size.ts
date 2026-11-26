export const DRAWER_MIN_RATIO = 0.2;
export const DRAWER_MAX_RATIO = 0.5;
export const DRAWER_DEFAULT_RATIO = 0.4;

export function clampDrawerRatio(ratio: number): number {
  return Math.min(DRAWER_MAX_RATIO, Math.max(DRAWER_MIN_RATIO, Number.isFinite(ratio) ? ratio : DRAWER_DEFAULT_RATIO));
}

export function availableDrawerWidth(viewport: number, sidebarRight: number): number {
  return Math.max(1, viewport - Math.min(viewport - 1, Math.max(0, sidebarRight)));
}

export function draggedDrawerRatio(startWidth: number, startX: number, currentX: number, available: number): number {
  return clampDrawerRatio((startWidth + startX - currentX) / Math.max(1, available));
}

export function keyboardDrawerRatio(ratio: number, key: string, shift: boolean): number | null {
  if (key === "Home") return DRAWER_MIN_RATIO;
  if (key === "End") return DRAWER_MAX_RATIO;
  if (key === "ArrowLeft") return clampDrawerRatio(ratio + (shift ? 0.05 : 0.01));
  if (key === "ArrowRight") return clampDrawerRatio(ratio - (shift ? 0.05 : 0.01));
  return null;
}
