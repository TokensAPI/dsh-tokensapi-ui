import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const host = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/client/index.tsx", import.meta.url), "utf8");
const tools = readFileSync(new URL("../src/client/modules/tools/ToolsModule.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/client/shell/CapabilityWorkspace.tsx", import.meta.url), "utf8");
const workspaceStyles = readFileSync(new URL("../src/client/shell/CapabilityWorkspace.module.css", import.meta.url), "utf8");
const build = readFileSync(new URL("../tsdown.config.ts", import.meta.url), "utf8");

describe("Desktop isolation contract", () => {
  it("does not depend on Electron or private native browser RPCs", () => {
    const shippedSources = [host, client, tools, build].join("\n");
    expect(shippedSources).not.toMatch(/BrowserWindow|WebContentsView|tokens-browser|tokens-account/);
    expect(build).not.toMatch(/["']electron["']/);
  });

  it("renders online tools in a sandboxed web iframe with an external fallback", () => {
    expect(tools).toContain("<iframe");
    expect(tools).toContain('sandbox="allow-downloads allow-forms');
    expect(tools).toContain('target="_blank"');
    expect(tools).toContain('rel="noopener noreferrer"');
    expect(tools).not.toContain("connection.rpc");
  });

  it("keeps the capability bar and page in one stable click-through overlay root", () => {
    expect(workspace).toContain('<div className={styles.workspace} data-tokens-workspace="true">');
    expect(workspace).toContain("class CapabilityViewBoundary");
    expect(workspace).toContain("const ActiveView = activeCap?.render ?? null");
    expect(workspace).toContain("<ActiveView />");
    expect(workspaceStyles).toMatch(/\.workspace\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*pointer-events:\s*none !important;/s);
    expect(workspaceStyles).toMatch(/\.topbar\s*\{[^}]*pointer-events:\s*auto;/s);
    expect(workspaceStyles).toMatch(/\.page\s*\{[^}]*pointer-events:\s*auto;/s);
  });
});
