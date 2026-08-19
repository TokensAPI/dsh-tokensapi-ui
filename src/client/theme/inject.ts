// Global design-system theme, ported from the tokens-agent design-system to our
// approach: the platform-owned semantic contract (--theme-* tokens + .theme-*
// recipe classes) plus the ELECTRO X tenant overrides. The Tailwind adapter
// (tailwind-theme.css) is intentionally dropped — these two sheets are plain CSS
// and need no build framework. Components consume the tokens/recipe classes
// directly; the tenant is activated with data-theme="electrox" on our shell root.
import contract from "./theme-contract.css";
import electrox from "./electrox.css";
import reskin from "./reskin.css";

const STYLE_TAG = "tokens-core-theme";

/** Inject the theme sheets once. Returns a disposer (idempotent). */
export function injectTheme(): () => void {
  if (typeof document === "undefined") return () => {};
  const existing = document.head.querySelector(`style[data-plugin-css="${STYLE_TAG}"]`);
  if (existing !== null) return () => existing.remove();
  const tag = document.createElement("style");
  tag.dataset.plugin = "tokens-core";
  tag.dataset.pluginCss = STYLE_TAG;
  tag.textContent = `${contract}\n${electrox}\n${reskin}`;
  document.head.appendChild(tag);
  return () => tag.remove();
}
