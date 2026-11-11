// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DebugThemePreview } from "../src/client/theme/DebugThemePreview.tsx";
import { getDebugThemeState, resolveDebugTheme, setDebugThemeMode, setThemeDebugUser } from "../src/client/theme/debug-preview.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  setThemeDebugUser(null);
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("authorized theme debugging", () => {
  it("ignores persisted choices until authorized and isolates choices between users", () => {
    localStorage.setItem("dsh-tokensapi-ui-debug-theme:63", "unififi");
    expect(resolveDebugTheme("electrox")).toBe("electrox");
    setDebugThemeMode("clean");
    expect(getDebugThemeState().mode).toBe("auto");
    setThemeDebugUser(63);
    expect(resolveDebugTheme("electrox")).toBe("unififi");
    setThemeDebugUser(3);
    expect(resolveDebugTheme("electrox")).toBe("electrox");
    setDebugThemeMode("clean");
    setThemeDebugUser(63);
    expect(resolveDebugTheme("electrox")).toBe("unififi");
    setDebugThemeMode("auto");
    expect(resolveDebugTheme("electrox")).toBe("electrox");
    expect(localStorage.getItem("dsh-tokensapi-ui-debug-theme:63")).toBeNull();
    setThemeDebugUser(4);
    expect(getDebugThemeState().userId).toBeNull();
  });

  it("shows all product skins only after authorization and applies a selection immediately", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => root.render(<DebugThemePreview />));
      expect(container.querySelector("fieldset")).toBeNull();
      await act(async () => setThemeDebugUser(63));
      const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
      expect(radios.map((radio) => radio.value)).toEqual(["auto", "clean", "electrox", "unififi"]);
      expect(radios[0]!.checked).toBe(true);
      await act(async () => radios[3]!.click());
      expect(radios[3]!.checked).toBe(true);
      expect(localStorage.getItem("dsh-tokensapi-ui-debug-theme:63")).toBe("unififi");
      expect(document.documentElement.dataset.theme).toBe("unififi");
      await act(async () => setThemeDebugUser(null));
      expect(container.querySelector("fieldset")).toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });
});
