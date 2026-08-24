import { useEffect, useState } from "react";
import type { PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import { getActiveSkin, setActiveSkin } from "./inject.ts";
import css from "./ThemePicker.module.css";

type ThemePickerProps = PropsRuntime<"settings.general.item">;

const THEMES = [
  { id: "glass", name: "通用玻璃", description: "流体水色与悬浮磨砂", colors: ["#071923", "#0891b2", "#2563eb"] },
  { id: "aurora", name: "极光玻璃", description: "蓝紫极光与高光玻璃", colors: ["#070816", "#8b5cf6", "#22d3ee"] },
  { id: "clean", name: "通用简洁", description: "克制、清晰、低装饰", colors: ["#171717", "#60a5fa", "#f5f5f5"] },
  { id: "electrox", name: "ELECTRO X", description: "合作方定制主题", colors: ["#11140f", "#d4ff3a", "#ffffff"] },
] as const;

function storedNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  } catch {
    return fallback;
  }
}

function storedMotion(): boolean {
  try { return localStorage.getItem("dsh-tokensapi-ui-motion") !== "reduced"; }
  catch { return true; }
}

function persist(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch {}
}

export function ThemePicker(_props: ThemePickerProps): React.JSX.Element {
  const [active, setActive] = useState(getActiveSkin);
  const [blur, setBlur] = useState(() => storedNumber("dsh-tokensapi-ui-blur", 20, 0, 40));
  const [glass, setGlass] = useState(() => storedNumber("dsh-tokensapi-ui-glass", 60, 20, 85));
  const [motion, setMotion] = useState(storedMotion);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--tokens-glass-blur", `${blur}px`);
    root.style.setProperty("--tokens-glass-alpha", String(0.9 - glass * 0.005));
    root.dataset.tokensMotion = motion ? "full" : "reduced";
    persist("dsh-tokensapi-ui-blur", String(blur));
    persist("dsh-tokensapi-ui-glass", String(glass));
    persist("dsh-tokensapi-ui-motion", motion ? "full" : "reduced");
  }, [blur, glass, motion]);
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
      {(active === "glass" || active === "aurora") && <div className={css.controls}>
        <label><span>背景模糊 <b>{blur}px</b></span><input aria-label="背景模糊" type="range" min="0" max="40" value={blur} onChange={e => setBlur(Number(e.target.value))} /></label>
        <label><span>玻璃透明度 <b>{glass}%</b></span><input aria-label="玻璃透明度" type="range" min="20" max="85" value={glass} onChange={e => setGlass(Number(e.target.value))} /></label>
        <button type="button" className={css.motion} aria-pressed={motion} onClick={() => setMotion(value => !value)}>{motion ? "动态背景：开启" : "动态背景：关闭"}</button>
      </div>}
    </section>
  );
}
