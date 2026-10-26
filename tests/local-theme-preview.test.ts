// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("local-only theme preview", () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });

  it("defaults to the organization and ignores invalid saved modes", async () => {
    localStorage.setItem("dsh-tokensapi-ui-local-theme-preview", "invalid");
    const preview = await import("../src/client/theme/local-preview.ts");
    expect(preview.getLocalThemeMode()).toBe("auto");
    expect(preview.resolveLocalTheme("electrox")).toBe("electrox");
  });

  it("holds the override across organization updates and restores the latest organization", async () => {
    const preview = await import("../src/client/theme/local-preview.ts");
    preview.setLocalThemeMode("electrox");
    expect(preview.resolveLocalTheme("clean")).toBe("electrox");
    preview.setLocalThemeMode("auto");
    expect(preview.resolveLocalTheme(preview.getOrganizationSkin())).toBe("clean");
    expect(localStorage.getItem("dsh-tokensapi-ui-local-theme-preview")).toBeNull();
  });

  it("restores a saved local override after module reload", async () => {
    const preview = await import("../src/client/theme/local-preview.ts");
    preview.setLocalThemeMode("clean");
    vi.resetModules();
    const reloaded = await import("../src/client/theme/local-preview.ts");
    expect(reloaded.resolveLocalTheme("electrox")).toBe("clean");
  });
});
