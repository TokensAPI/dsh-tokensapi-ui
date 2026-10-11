// Retained for future experiments; this module has no active imports or slot registration.
import { useState } from "react";
import css from "./GlassPanelOptions.module.css";
import glassStyles from "./glass-panels.css";
import { observeFloatingSurfaces } from "./floating-surfaces.ts";

const GLASS_PANELS_STORAGE_KEY = "dsh-tokensapi-ui-glass-panels";

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


/** Explicit opt-in for a future experiment. The active plugin never calls this. */
export function injectGlassPanels(): () => void {
  const root = document.documentElement;
  const previous = root.getAttribute("data-glass-panels");
  const tag = document.createElement("style");
  tag.dataset.pluginCss = "dsh-tokensapi-ui-glass-panels";
  tag.textContent = glassStyles;
  document.head.append(tag);
  root.dataset.glassPanels = String(getGlassPanelsEnabled());
  const stopObserving = observeFloatingSurfaces();
  return () => {
    stopObserving();
    tag.remove();
    if (previous === null) root.removeAttribute("data-glass-panels");
    else root.setAttribute("data-glass-panels", previous);
  };
}

export function GlassPanelOptions(): React.JSX.Element {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [glassPanels, setGlassPanels] = useState(getGlassPanelsEnabled);
  return (
    <div className={css.advanced}>
      <button
        type="button"
        className={css.advancedTrigger}
        aria-expanded={advancedOpen}
        aria-controls="tokens-theme-advanced-options"
        onClick={() => setAdvancedOpen(open => !open)}
      >
        <span className={css.advancedIdentity}>
          <span className={css.themeMark} aria-hidden="true" />
          <span>
            <small>界面主题 · 基础主题专属</small>
            <b>高级外观选项</b>
          </span>
        </span>
        <span className={css.chevron} aria-hidden="true">⌄</span>
      </button>
      {advancedOpen && (
        <div className={css.advancedPanel} id="tokens-theme-advanced-options">
          <label className={css.option}>
            <span>
              <b>玻璃面板</b>
              <small>仅增强选择框和设置弹窗；窗口与侧栏使用桌面原生材质。</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={glassPanels}
              onChange={(event) => {
                const enabled = event.currentTarget.checked;
                setGlassPanelsEnabled(enabled);
                setGlassPanels(enabled);
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
