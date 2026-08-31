import { useState } from "react";
import type { PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import {
  getActiveSkin,
  getGlassPanelsEnabled,
  setActiveSkin,
  setGlassPanelsEnabled,
} from "./inject.ts";
import css from "./ThemePicker.module.css";

type ThemePickerProps = PropsRuntime<"settings.general.item">;

const THEMES = [
  { id: "clean", name: "基础主题", description: "TokensAPI Lake View，湖绿色交互与通透浅色外观", colors: ["#161b19", "#5fd7a1", "#f8fbf9"] },
  { id: "electrox", name: "合作方主题", description: "保留 ELECTRO X 联合品牌与能力导航", colors: ["#11140f", "#d4ff3a", "#ffffff"] },
] as const;

export function ThemePicker(_props: ThemePickerProps): React.JSX.Element {
  const [active, setActive] = useState(getActiveSkin);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [glassPanels, setGlassPanels] = useState(getGlassPanelsEnabled);
  return (
    <section className={css.group} aria-labelledby="tokens-theme-title">
      <div>
        <div className={css.title} id="tokens-theme-title">界面主题</div>
        <div className={css.hint}>选择产品外观，修改会立即生效并自动保存。</div>
      </div>
      <div className={css.grid}>
        {THEMES.map(theme => {
          const selected = active === theme.id;
          return (
            <div
              key={theme.id}
              className={selected ? css.themeItemActive : css.themeItem}
            >
              <button
                type="button"
                className={css.card}
                aria-pressed={selected}
                onClick={() => { setActiveSkin(theme.id); setActive(theme.id); }}
              >
                <span className={css.preview} aria-hidden="true">
                  {theme.colors.map(color => <i key={color} style={{ background: color }} />)}
                </span>
                <span className={css.name}>{theme.name}</span>
                <span className={css.description}>{theme.description}</span>
              </button>
              {theme.id === "clean" && selected && (
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
                          <small>开启透明层与背景模糊；关闭时使用更清晰、厚实的不透明面板。</small>
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
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
