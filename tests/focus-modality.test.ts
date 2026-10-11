// @vitest-environment happy-dom
import { resolve } from "node:path";
import { readCss } from "../scripts/read-css.mjs";
import { afterEach, describe, expect, it } from "vitest";
import { observeFocusModality } from "../src/client/theme/focus-modality.ts";

const chrome = readCss(resolve("src/client/theme/chrome.css"));
const suppression = chrome.match(/(html\[data-theme\]\[data-tokens-input="pointer"\][^{]+)\{([^}]+)\}/)!;
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.tokensInput;
});

function mountSettings() {
  document.documentElement.dataset.theme = "clean";
  document.body.innerHTML = '<button class="host_trigger" aria-haspopup="dialog" aria-expanded="false">设置</button><button id="close">关闭</button>';
  return document.querySelector<HTMLButtonElement>(".host_trigger")!;
}

describe("settings trigger focus", () => {
  it("keeps restored focus but suppresses the ring after a pointer close", () => {
    const trigger = mountSettings();
    dispose = observeFocusModality();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    document.querySelector<HTMLButtonElement>("#close")!.focus();
    document.querySelector("#close")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    trigger.focus(); // Host's close effect.
    expect(document.activeElement).toBe(trigger);
    expect(trigger.matches(suppression[1]!)).toBe(true);
    expect(suppression[2]).toContain("outline: none !important");
    expect(suppression[2]).toContain("box-shadow: none !important");
  });

  it("retains keyboard focus indications after Escape and subsequent Tab", () => {
    const trigger = mountSettings();
    dispose = observeFocusModality();
    document.dispatchEvent(new PointerEvent("pointerdown"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    trigger.focus();
    expect(trigger.matches(suppression[1]!)).toBe(false);
    expect(chrome).toContain(':is(button, a, [role="button"]):focus-visible');
    document.dispatchEvent(new PointerEvent("pointerdown"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(trigger.matches(suppression[1]!)).toBe(false);
  });

  it("hides the background trigger ring while open without affecting other buttons", () => {
    const trigger = mountSettings();
    dispose = observeFocusModality();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    trigger.setAttribute("aria-expanded", "true");
    trigger.focus();
    expect(trigger.matches(suppression[1]!)).toBe(true);
    const other = document.querySelector<HTMLButtonElement>("#close")!;
    other.focus();
    expect(other.matches(suppression[1]!)).toBe(false);
  });

  it("ignores modifier-only keys and removes listeners on disposal", () => {
    mountSettings();
    document.documentElement.dataset.tokensInput = "keyboard";
    dispose = observeFocusModality();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    expect(document.documentElement.dataset.tokensInput).toBe("pointer");
    dispose();
    dispose = undefined;
    document.dispatchEvent(new PointerEvent("pointerdown"));
    expect(document.documentElement.dataset.tokensInput).toBe("keyboard");
    delete document.documentElement.dataset.tokensInput;
    dispose = observeFocusModality();
    dispose();
    dispose = undefined;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(document.documentElement.hasAttribute("data-tokens-input")).toBe(false);
  });
});
