import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TokensBrandMark, TokensBrandName } from "../src/client/shell/BrandSlots.tsx";

const brandStyles = readFileSync(
  new URL("../src/client/shell/BrandSlots.module.css", import.meta.url),
  "utf8",
);
const workspaceStyles = readFileSync(
  new URL("../src/client/shell/CapabilityWorkspace.module.css", import.meta.url),
  "utf8",
);

describe("sidebar branding contract", () => {
  it("uses declared brand slots and never takes ownership of the native toggle", () => {
    const client = readFileSync(new URL("../src/client/index.tsx", import.meta.url), "utf8");
    const workspace = readFileSync(new URL("../src/client/shell/CapabilityWorkspace.tsx", import.meta.url), "utf8");
    const chrome = readFileSync(new URL("../src/client/theme/chrome.css", import.meta.url), "utf8");
    const bridge = readFileSync(new URL("../src/client/theme/dsh-bridge.css", import.meta.url), "utf8");

    expect(client).toContain('ctx.slots.inject("sidebar.brand.mark"');
    expect(client).toContain('ctx.slots.inject("sidebar.brand.name"');
    expect(client).toContain('ctx.slots.inject("conversation.hero.brand.mark"');
    expect(workspace).not.toMatch(/document\.querySelector|\.click\(\)/);
    expect(workspace).toContain("layoutRuntime?.toggleSidebar()");
    expect(workspace).toContain('<span className={styles.poweredName}>TokensAPI</span>');
    expect(workspace).toContain("'[role=\"treeitem\"][aria-selected]'");
    expect(workspace).not.toContain('target.closest("[data-shell-overlay]") === null');
    expect(chrome).not.toMatch(/data-tokens-sidebar|viewBox="0 0 23\.16 17\.04"/);
    expect(client).toContain('setCapabilityWorkspaceLayout(ctx.get("layout")');
    expect(workspace).toContain('data-tokens-partner-sidebar-toggle="true"');
    expect(workspace).toContain('style={{ left: `${sidebarWidth}px` }}');
    expect(chrome).toContain('button:is([aria-label="打开侧边栏"]');
    expect(chrome).not.toContain('top: -56px');
    expect(chrome).toContain(':has(textarea[aria-haspopup="menu"][readonly])');
    expect(chrome).toContain(".dshMarketEmpty > button");
    expect(chrome).toContain('[aria-label="命令"]');
    expect(chrome).toContain('[aria-label="Commands"]');
    expect(bridge).toContain("--dsw-alias-label-primary-foreground: var(--theme-fg-on-accent)");
  });

  it("honours the host-requested mark size", () => {
    const mark = TokensBrandMark({ size: 24, className: "host-mark" });
    expect(mark.type).toBe("span");
    expect(mark.props.style).toEqual({ width: 24, height: 24 });
    expect(mark.props.className).toContain("host-mark");
    expect(mark.props.children).toHaveLength(2);
    expect(mark.props.children[0].props).toMatchObject({ width: 24, height: 24, "aria-hidden": "true" });
    expect(mark.props.children[1].props).toMatchObject({ width: 24, height: 24, "aria-hidden": "true" });
    expect(TokensBrandName().props.children).toHaveLength(3);
  });

  it("keeps the capability header seam aligned and strengthens light branding", () => {
    expect(workspaceStyles).toMatch(/\.topbar\s*\{[^}]*box-sizing:\s*border-box/s);
    expect(workspaceStyles).toMatch(/\.brandSeat::after\s*\{[^}]*width:\s*var\(--theme-border-width\)/s);
    expect(workspaceStyles).not.toMatch(/\.brandSeat\s*\{[^}]*border-right:/s);
    expect(workspaceStyles).not.toMatch(/\.page\s*\{[^}]*border-left:/s);
    expect(workspaceStyles).not.toMatch(/\.page\s*\{[^}]*background-image:/s);
    expect(workspaceStyles).not.toContain(".page::before");
    expect(brandStyles).toMatch(/\.lightMark\s*\{[^}]*filter:\s*none/s);
    expect(brandStyles).not.toContain("scale(1.1)");
    expect(brandStyles).toMatch(/\.name\s*\{[^}]*font-size:\s*16px/s);
    expect(brandStyles).not.toContain("contrast(1.1)");
    expect(existsSync(new URL("../src/client/shell/assets/tokensapi-mark-1024.png", import.meta.url))).toBe(true);
  });
});
