import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cleanTheme = readFileSync(
  new URL("../src/client/theme/themes/clean.css", import.meta.url),
  "utf8",
);
const bridge = readFileSync(
  new URL("../src/client/theme/dsh-bridge.css", import.meta.url),
  "utf8",
);
const chrome = readFileSync(
  new URL("../src/client/theme/chrome.css", import.meta.url),
  "utf8",
);
const themePicker = readFileSync(
  new URL("../src/client/theme/ThemePicker.tsx", import.meta.url),
  "utf8",
);

describe("TokensAPI Lake View basic theme", () => {
  it("uses the Lake View palette for both appearances with accessible primary controls", () => {
    expect(cleanTheme).toContain("--lake-primary: oklch(0.765 0.177 163.22)");
    expect(cleanTheme).toContain("--lake-secondary: oklch(0.551 0.0899 200.52)");
    expect(cleanTheme).toContain('[data-theme="clean"][data-color-scheme="light"]');
    expect(cleanTheme).toContain("--theme-bg-shell: rgb(22 27 25 / 84%)");
    expect(cleanTheme).toContain("--theme-bg-surface: rgb(27 34 31 / 76%)");
    expect(cleanTheme).toContain("--theme-accent-soft: rgb(59 128 94 / 20%)");
    expect(cleanTheme).toContain("--theme-fg-secondary: oklch(0.3434 0.05664 163.22)");
    expect(cleanTheme).toContain("--theme-bg-surface: rgb(255 255 255 / 58%)");
    expect(cleanTheme).toContain("--theme-border-subtle: rgb(31 86 61 / 14%)");
    expect(cleanTheme).toContain("--theme-accent-soft: rgb(56 185 125 / 10%)");
    expect(chrome).toContain('[data-composer-card="true"]::before');
    expect(chrome).toContain("pointer-events: none");
    expect(chrome).not.toMatch(/\[data-composer-card="true"\]\s*\{[^}]*backdrop-filter/s);
    expect(cleanTheme).not.toContain("color-mix(in oklch");
    expect(cleanTheme).toMatch(/--theme-fg-on-accent:\s*oklch\(0 0 0\)/);
    expect(cleanTheme).toContain("--theme-accent-fill: var(--lake-primary)");
    expect(cleanTheme).toContain("--theme-text-shadow:");
    expect(cleanTheme).toContain("--theme-glass-text-shadow:");
    expect(cleanTheme).toContain("--theme-glass-muted-text-shadow:");
    expect(cleanTheme).toContain("--theme-glass-panel-fill:");
    expect(cleanTheme).toContain('[data-theme="clean"][data-glass-panels="false"]');
    expect(chrome).toContain('html[data-theme="clean"][data-glass-panels="false"]');
    expect(chrome).toContain("background: var(--theme-bg-surface-raised) !important");
    expect(chrome).toContain('[data-glass-panels="true"]');
    expect(chrome).toContain("-webkit-text-stroke: .1px currentColor");
    expect(chrome).toContain("text-shadow: var(--theme-glass-text-shadow) !important");
    expect(chrome).toContain("text-shadow: var(--theme-glass-muted-text-shadow) !important");
    expect(chrome).toContain("var(--theme-glass-panel-fill) !important");
    expect(chrome).toContain('[data-glass-panels="true"] :where(');
    expect(cleanTheme).toContain("--theme-neon-text-shadow:");
    expect(chrome).toContain('[data-input-backdrop="true"]');
    expect(chrome).toContain("-webkit-text-fill-color: transparent");
    expect(chrome).toContain('[role="presentation"][data-source="command"]');
    expect(chrome).toContain('[role="option"] > span:first-child');
    expect(chrome).toContain('[role="option"] > span:last-child');
  });

  it("uses a resilient system font stack", () => {
    expect(cleanTheme).toContain('"Albert Sans Variable"');
    expect(bridge).toContain("--dsw-font-family: var(--theme-font-sans)");
    expect(existsSync(new URL("../src/client/theme/albert-sans.css", import.meta.url))).toBe(true);
  });

  it("keeps settings tabs out of dialog selection and control chrome", () => {
    expect(chrome).toContain('[aria-selected="true"]:not([role="tab"])');
    expect(chrome).toContain('button:not([aria-label], [role="tab"])');
    expect(chrome).not.toMatch(/\[aria-selected="true"\]\s*\n?\s*\)\s*\{/);
  });

  it("bridges the TokensAPI model manager's custom picker into the glass controls", () => {
    expect(chrome).toContain('input[placeholder="搜索模型"]');
    expect(chrome).toContain('input[placeholder="Search models"]');
    expect(chrome).toContain('> button[aria-expanded]');
    expect(chrome).toContain('backdrop-filter: blur(var(--clean-menu-blur))');
  });

  it("uses a runtime floating-surface marker without broadly styling trees", () => {
    expect(chrome).toContain("[data-tokens-floating-surface]");
    expect(chrome).not.toContain('[role="tree"]');
  });

  it("releases composer clipping for classified and semantic host popups", () => {
    expect(chrome).toMatch(
      /\[data-composer-card="true"\]:has\([\s\S]*\[data-tokens-floating-surface\][\s\S]*\[role="menu"\][\s\S]*\[role="listbox"\][\s\S]*\)\s*\{\s*overflow:\s*visible;/,
    );
  });

  it("frosts agent question cards without depending on generated classes", () => {
    expect(chrome).toContain(
      '[data-question-key] > section[aria-labelledby^="question-"]',
    );
    expect(chrome).toContain(
      "backdrop-filter: blur(var(--theme-glass-blur)) saturate(128%) contrast(1.02)",
    );
    expect(chrome).toContain('[data-question-key] [role="radiogroup"] > button[role="radio"]');
    expect(chrome).toContain('[data-question-key] [role="radiogroup"] > div:has(> input[type="text"])');
    expect(chrome).toContain('button[role="radio"][aria-checked="true"]');
    expect(chrome).toContain('> footer > div:last-child > button:last-child');
    expect(chrome).toContain('html[data-theme="electrox"] [data-question-key]');
    expect(chrome).toContain('[data-theme="electrox"] [data-phase="hero"]');
    expect(chrome).toContain("overflow-wrap: anywhere");
    expect(chrome).toContain("background: var(--theme-bg-canvas)");
    const recommendationBlocks = [
      ...chrome.matchAll(
        /span:has\(> span:nth-child\(3\)\) > span:nth-child\(2\) \{([^}]+)\}/g,
      ),
    ].map((match) => match[1]);
    expect(recommendationBlocks).toHaveLength(2);
    for (const block of recommendationBlocks) {
      expect(block).toContain("var(--theme-accent-primary)");
      expect(block).not.toContain("background: var(--theme-accent-primary)");
      expect(block).not.toContain("background: var(--theme-accent-fill)");
    }
    const selectedNumberBlocks = [
      ...chrome.matchAll(
        /button\[role="radio"\]\[aria-checked="true"\] > span:first-child \{([^}]+)\}/g,
      ),
    ].map((match) => match[1]);
    expect(selectedNumberBlocks).toHaveLength(2);
    for (const block of selectedNumberBlocks) {
      expect(block).toContain("background: var(--theme-accent-soft)");
      expect(block).not.toContain("background: var(--theme-accent-primary)");
      expect(block).not.toContain("background: var(--theme-accent-fill)");
    }
    expect(chrome).not.toContain("Mbwy4a_");
  });

  it("themes the outer shell of the active Agent preset card", () => {
    expect(chrome).toContain('li:has(> button[aria-pressed="true"])');
    expect(chrome).toContain('li:has(> button[aria-pressed="false"]):hover');
    expect(chrome).toContain("var(--theme-accent-primary) 56%");
  });

  it("completes the directory picker's bare show-hidden toggle as a glass button", () => {
    expect(chrome).toContain('button[class*="_showHiddenToggle"][aria-pressed]');
    expect(chrome).toContain("min-height: 36px");
  });

  it("describes and previews the Lake View palette accurately", () => {
    expect(themePicker).toContain("TokensAPI Lake View，湖绿色交互与通透浅色外观");
    expect(themePicker).toContain('["#161b19", "#5fd7a1", "#f8fbf9"]');
    expect(themePicker).not.toContain('["#171717", "#3b82f6", "#f5f5f5"]');
    expect(themePicker).toContain("高级外观选项");
    expect(themePicker).toContain("界面主题 · 基础主题专属");
    expect(themePicker).toContain("玻璃面板");
    expect(themePicker).toContain("getGlassPanelsEnabled");
    expect(themePicker).toContain('theme.id === "clean" && selected');
    expect(themePicker).not.toContain("此选项仅用于基础主题");
  });
});
