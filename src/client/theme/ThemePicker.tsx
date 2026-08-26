import { useState } from "react";
import type { PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import { getActiveSkin, setActiveSkin } from "./inject.ts";
import css from "./ThemePicker.module.css";

type ThemePickerProps = PropsRuntime<"settings.general.item">;

const THEMES = [
  { id: "clean", name: "基础主题", description: "TokensAPI Lake View，湖绿色交互与通透浅色外观", colors: ["#161b19", "#5fd7a1", "#f8fbf9"] },
  { id: "electrox", name: "合作方主题", description: "保留 ELECTRO X 联合品牌与能力导航", colors: ["#11140f", "#d4ff3a", "#ffffff"] },
] as const;

export function ThemePicker(_props: ThemePickerProps): React.JSX.Element {
  const [active, setActive] = useState(getActiveSkin);
  return (
    <section className={css.group} aria-labelledby="tokens-theme-title">
      <div>
        <div className={css.title} id="tokens-theme-title">界面主题</div>
        <div className={css.hint}>选择产品外观，修改会立即生效并自动保存。</div>
      </div>
      <div className={css.grid}>
        {THEMES.map(theme => (
          <button
            key={theme.id}
            type="button"
            className={active === theme.id ? css.cardActive : css.card}
            aria-pressed={active === theme.id}
            onClick={() => { setActiveSkin(theme.id); setActive(theme.id); }}
          >
            <span className={css.preview} aria-hidden="true">
              {theme.colors.map(color => <i key={color} style={{ background: color }} />)}
            </span>
            <span className={css.name}>{theme.name}</span>
            <span className={css.description}>{theme.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
