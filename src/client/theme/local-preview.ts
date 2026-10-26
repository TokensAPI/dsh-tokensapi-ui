import { DEFAULT_SKIN, type SkinId } from "../../shared/organization-theme.ts";

export type LocalThemeMode = "auto" | SkinId;
const STORAGE_KEY = "dsh-tokensapi-ui-local-theme-preview";
let organizationSkin: SkinId = DEFAULT_SKIN;
let mode: LocalThemeMode | undefined;

export function getLocalThemeMode(): LocalThemeMode {
  if (mode !== undefined) return mode;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    mode = saved === "clean" || saved === "electrox" ? saved : "auto";
  } catch { mode = "auto"; }
  return mode;
}

export function setLocalThemeMode(value: LocalThemeMode): void {
  mode = value;
  try {
    if (value === "auto") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch { /* Storage may be unavailable; the current window still works. */ }
}

export function getOrganizationSkin(): SkinId { return organizationSkin; }

export function resolveLocalTheme(skin: SkinId): SkinId {
  organizationSkin = skin;
  const selected = getLocalThemeMode();
  return selected === "auto" ? skin : selected;
}
