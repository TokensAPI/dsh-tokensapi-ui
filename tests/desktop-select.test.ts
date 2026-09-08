// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeDesktopSettingsSelect } from "../src/client/theme/desktop-select.ts";

afterEach(() => {
  document.body.replaceChildren();
});

function mountMaterialSelect(): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "dshDesktopSettingsSelect";
  select.setAttribute("aria-label", "窗口材质");
  for (const [label, value] of [
    ["关闭", "off"],
    ["跟随系统", "auto"],
    ["增强", "advanced"],
  ]) {
    const option = document.createElement("option");
    option.textContent = label;
    option.value = value;
    option.selected = value === "auto";
    select.append(option);
  }
  document.body.append(select);
  return select;
}

describe("Desktop material select enhancer", () => {
  it("replaces the native popup without entering an observer feedback loop", async () => {
    const select = mountMaterialSelect();
    const onChange = vi.fn();
    select.addEventListener("change", onChange);

    const dispose = observeDesktopSettingsSelect();
    const trigger = document.querySelector<HTMLButtonElement>(
      ".dshTokensDesktopSelectTrigger",
    );
    expect(trigger?.textContent).toBe("跟随系统");
    expect(trigger?.getAttribute("aria-haspopup")).toBe("listbox");
    expect(select.getAttribute("aria-hidden")).toBe("true");

    // Let child-list and attribute observer deliveries settle. A non-idempotent
    // sync continuously rewrites trigger text/disabled state and never yields.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(trigger?.textContent).toBe("跟随系统");

    trigger?.click();
    const listbox = document.querySelector<HTMLElement>(
      ".dshTokensDesktopSelectListbox[role='listbox']",
    );
    expect(listbox).not.toBeNull();
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");

    const advanced = Array.from(
      listbox?.querySelectorAll<HTMLButtonElement>("[role='option']") ?? [],
    ).find((option) => option.textContent === "增强");
    advanced?.click();

    expect(select.value).toBe("advanced");
    expect(trigger?.textContent).toBe("增强");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".dshTokensDesktopSelectListbox")).toBeNull();

    dispose();
    expect(document.querySelector(".dshTokensDesktopSelectTrigger")).toBeNull();
    expect(select.hasAttribute("aria-hidden")).toBe(false);
  });
});
