// Decoupled skin theming. This package ships MULTIPLE skins; electrox is just
// the default — new skins get added here, not baked into components. Layers, in
// cascade order:
//   1. theme-contract.css   platform-owned --theme-* contract + recipe classes
//   2. themes/<id>.css       EVERY registered skin, each scoped to [data-theme=<id>]
//   3. dsh-bridge.css        maps DSH's --dsw-* onto --theme-* (re-skins DSH)
//   4. chrome.css            structural DSH adjustments (no colors)
// All skins are injected once; the active skin is a single `data-theme="<id>"`
// on <html>, so SWITCHING a skin is just an attribute swap — no re-injection.
// Add a skin: create themes/<id>.css (`[data-theme="<id>"] { --theme-*: … }`) and
// register it in SKINS below. Components never change.
import contract from "./theme-contract.css";
import clean from "./themes/clean.css";
import electrox from "./themes/electrox.css";
import bridge from "./dsh-bridge.css";
import chrome from "./chrome.css";

/** Registered skins (id → its [data-theme="<id>"]-scoped --theme-* sheet). */
const SKINS: Record<string, string> = {
  clean,
  electrox,
};

/** Default skin when none is stored. */
export const DEFAULT_SKIN = "clean";

const STORAGE_KEY = "dsh-tokensapi-ui-skin";
const GLASS_PANELS_STORAGE_KEY = "dsh-tokensapi-ui-glass-panels";
const STYLE_TAG = "dsh-tokensapi-ui-theme";

type ColorScheme = "light" | "dark";

/** Read the effective DSH appearance. Explicit dark mode is marked on body;
 * light and follow-system are reflected by the root color-scheme style. */
function getDshColorScheme(): ColorScheme {
  if (document.body?.hasAttribute("data-ds-dark-theme")) return "dark";
  return getComputedStyle(document.documentElement).colorScheme === "dark" ? "dark" : "light";
}

function syncColorScheme(): void {
  document.documentElement.dataset.colorScheme = getDshColorScheme();
}

/** All registered skin ids (drives a skin picker). */
export function listSkins(): readonly string[] {
  return Object.keys(SKINS);
}

/** The active skin id (persisted; falls back to DEFAULT_SKIN). */
export function getActiveSkin(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null && stored in SKINS) return stored;
  } catch {
    // storage unavailable
  }
  return DEFAULT_SKIN;
}

/** Switch the active skin — a single <html> data-theme swap; persists the choice. */
export function setActiveSkin(id: string): void {
  if (!(id in SKINS)) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage unavailable — still apply for this session
  }
  if (typeof document !== "undefined") document.documentElement.dataset.theme = id;
}

/** Whether the optional translucent panel treatment is enabled. */
export function getGlassPanelsEnabled(): boolean {
  try {
    return localStorage.getItem(GLASS_PANELS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Toggle the optional glass treatment. The practical opaque mode is the default. */
export function setGlassPanelsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(GLASS_PANELS_STORAGE_KEY, String(enabled));
  } catch {
    // storage unavailable — still apply for this session
  }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.glassPanels = String(enabled);
  }
}

/** Inject all skin layers once and activate the stored (or default) skin. */
export function injectTheme(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  root.dataset.theme = getActiveSkin();
  root.dataset.glassPanels = String(getGlassPanelsEnabled());

  syncColorScheme();
  const observer = new MutationObserver(syncColorScheme);
  observer.observe(root, { attributes: true, attributeFilter: ["style"] });
  if (document.body !== null) {
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
  }

  const skinSheets = Object.values(SKINS).join("\n");
  const cssText = `${contract}\n${skinSheets}\n${bridge}\n${chrome}`;
  const existing = document.head.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_TAG}"]`);
  if (existing !== null) {
    // Watch/HMR reloads the module while the previous style element remains in
    // the document. Refresh its contents instead of silently keeping stale CSS.
    existing.textContent = cssText;
    return () => {
      observer.disconnect();
      existing.remove();
    };
  }

  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-tokensapi-ui";
  tag.dataset.pluginCss = STYLE_TAG;
  tag.textContent = cssText;
  document.head.appendChild(tag);
  return () => {
    observer.disconnect();
    tag.remove();
    delete root.dataset.theme;
    delete root.dataset.colorScheme;
    delete root.dataset.glassPanels;
  };
}
