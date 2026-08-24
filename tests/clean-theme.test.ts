import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cleanTheme = readFileSync(
  new URL("../src/client/theme/themes/clean.css", import.meta.url),
  "utf8",
);
const fontSheet = readFileSync(
  new URL("../src/client/theme/albert-sans.css", import.meta.url),
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

describe("TokensAPI Lake View basic theme", () => {
  it("uses the Lake View palette for both appearances with accessible primary controls", () => {
    expect(cleanTheme).toContain("--lake-primary: oklch(0.765 0.177 163.22)");
    expect(cleanTheme).toContain("--lake-secondary: oklch(0.551 0.0899 200.52)");
    expect(cleanTheme).toContain('[data-theme="clean"][data-color-scheme="light"]');
    expect(cleanTheme).toContain("--theme-bg-shell: oklch(0.214 0.00885 163.22)");
    expect(cleanTheme).toContain("--theme-bg-surface: oklch(0.2314 0.01416 163.22)");
    expect(cleanTheme).toContain("--theme-accent-soft: oklch(0.2894 0.03186 163.22)");
    expect(cleanTheme).toContain("--theme-fg-secondary: oklch(0.3434 0.05664 163.22)");
    expect(cleanTheme).toContain("--theme-bg-surface: rgb(255 255 255 / 66%)");
    expect(cleanTheme).toContain("--theme-border-subtle: rgb(31 86 61 / 14%)");
    expect(cleanTheme).toContain("--theme-accent-soft: oklch(0.9671 0.02478 163.22)");
    expect(chrome).toContain('[data-composer-card="true"]::before');
    expect(chrome).toContain("pointer-events: none");
    expect(chrome).not.toMatch(/\[data-composer-card="true"\]\s*\{[^}]*backdrop-filter/s);
    expect(cleanTheme).not.toContain("color-mix(in oklch");
    expect(cleanTheme).toMatch(/--theme-fg-on-accent:\s*oklch\(0 0 0\)/);
    expect(cleanTheme).toContain("--theme-accent-fill: var(--lake-primary)");
  });

  it("self-hosts Albert Sans and ships its redistribution license", () => {
    expect(cleanTheme).toContain('"Albert Sans Variable"');
    expect(fontSheet.match(/@font-face/g)).toHaveLength(2);
    expect(fontSheet).toContain("@fontsource-variable/albert-sans/files/");
    expect(bridge).toContain("--dsw-font-family: var(--theme-font-sans)");
    expect(
      existsSync(new URL("../licenses/Albert-Sans-OFL-1.1.txt", import.meta.url)),
    ).toBe(true);
  });
});
