// Decoupled tenant-skin theming (per DEVELOPMENT_REQUIREMENTS §3, and inspired
// by dsh-web-ui's skin center). Layers, in cascade order:
//   1. theme-contract.css  platform-owned --theme-* contract + recipe classes
//   2. themes/<tenant>.css  the active tenant's --theme-* values + geometry
//   3. dsh-bridge.css       maps DSH's --dsw-* onto --theme-* (re-skins DSH)
//   4. chrome.css           structural DSH adjustments (no colors)
// Activation is a single data-theme="<tenant>" on <html>; adding a tenant means
// adding themes/<id>.css + registering it below — components never change.
import contract from "./theme-contract.css";
import electrox from "./themes/electrox.css";
import bridge from "./dsh-bridge.css";
import chrome from "./chrome.css";

/** Registered tenant skins (id → its --theme-* sheet). */
const TENANTS: Record<string, string> = { electrox };

/** Active tenant. Swap this (or drive it from config) to re-skin everything. */
export const ACTIVE_TENANT = "electrox";

const STYLE_TAG = "tokens-core-theme";

/** Inject the theme layers once and activate the tenant on <html>. */
export function injectTheme(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  root.dataset.theme = ACTIVE_TENANT;

  const existing = document.head.querySelector(`style[data-plugin-css="${STYLE_TAG}"]`);
  if (existing !== null) return () => existing.remove();

  const tenantSheet = TENANTS[ACTIVE_TENANT] ?? "";
  const tag = document.createElement("style");
  tag.dataset.plugin = "tokens-core";
  tag.dataset.pluginCss = STYLE_TAG;
  tag.textContent = `${contract}\n${tenantSheet}\n${bridge}\n${chrome}`;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
    if (root.dataset.theme === ACTIVE_TENANT) delete root.dataset.theme;
  };
}
