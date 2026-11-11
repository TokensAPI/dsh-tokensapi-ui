import { DEFAULT_SKIN, type SkinId } from "../../shared/organization-theme.ts";

export type DebugThemeMode = "auto" | SkinId;
const listeners = new Set<() => void>();
let state: { userId: number | null; mode: DebugThemeMode } = { userId: null, mode: "auto" };
let organizationSkin: SkinId = DEFAULT_SKIN;
const storageKey = (id: number): string => `dsh-tokensapi-ui-debug-theme:${id}`;
const validMode = (value: unknown): value is DebugThemeMode =>
  value === "auto" || value === "clean" || value === "electrox" || value === "unififi";
const emit = (): void => { for (const listener of listeners) listener(); };

export const getDebugThemeState = () => state;
export function subscribeDebugTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** A server-confirmed identity is required before reading any saved override. */
export function setThemeDebugUser(value: unknown): void {
  const userId = value === 3 || value === 63 ? value : null;
  if (state.userId === userId) return;
  let mode: DebugThemeMode = "auto";
  if (userId !== null) {
    try {
      const saved = localStorage.getItem(storageKey(userId));
      if (validMode(saved)) mode = saved;
    } catch { /* Storage can be unavailable. */ }
  }
  state = { userId, mode };
  emit();
}

export function setDebugThemeMode(mode: DebugThemeMode): void {
  if (state.userId === null || !validMode(mode)) return;
  try {
    if (mode === "auto") localStorage.removeItem(storageKey(state.userId));
    else localStorage.setItem(storageKey(state.userId), mode);
  } catch { /* Keep the selection in memory for this window. */ }
  state = { ...state, mode };
  emit();
}

export function resolveDebugTheme(skin: SkinId): SkinId {
  organizationSkin = skin;
  return state.userId !== null && state.mode !== "auto" ? state.mode : skin;
}

export const getDebugOrganizationSkin = (): SkinId => organizationSkin;
