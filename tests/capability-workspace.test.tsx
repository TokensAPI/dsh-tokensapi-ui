// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CapabilityWorkspace } from "../src/client/shell/CapabilityWorkspace.tsx";
import { registerCapability } from "../src/client/shell/capability-registry.ts";
import { workspace } from "../src/client/shell/workspace-store.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class ImmediateResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void { this.callback([], this as unknown as ResizeObserver); }
  disconnect(): void {}
  unobserve(): void {}
}

describe("capability workspace", () => {
  afterEach(() => {
    workspace.close();
    document.body.replaceChildren();
    delete document.documentElement.dataset.theme;
  });

  it("keeps the partner navigation mounted and renders the selected skill page", async () => {
    globalThis.ResizeObserver = ImmediateResizeObserver as unknown as typeof ResizeObserver;
    document.documentElement.dataset.theme = "electrox";
    document.body.innerHTML = `
      <div id="frame" style="display:grid;grid-template-columns:280px minmax(0,1fr) 0px">
        <aside></aside>
        <main></main>
        <div data-shell-overlay><div id="mount"></div></div>
      </div>`;
    const release = registerCapability({
      id: "skills-test",
      label: "技能库",
      render: () => <div data-testid="skills-page">技能页面</div>,
    });
    const mount = document.getElementById("mount");
    if (mount === null) throw new Error("missing test mount");
    const root = createRoot(mount);

    await act(async () => { root.render(<CapabilityWorkspace />); });
    const button = Array.from(document.querySelectorAll("button"))
      .find((item) => item.textContent?.includes("技能库"));
    expect(button).toBeDefined();
    await act(async () => { button?.click(); });

    expect(document.querySelector('header[aria-label="能力导航"]')).toBeNull();
    expect(document.querySelector('nav[aria-label="能力导航"]')).not.toBeNull();
    expect(document.querySelector('[role="region"][aria-label="技能库"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="skills-page"]')?.textContent).toBe("技能页面");
    expect(button?.getAttribute("aria-current")).toBe("page");

    await act(async () => { root.unmount(); });
    release();
  });

  it("keeps the partner navigation mounted when a capability view throws", async () => {
    globalThis.ResizeObserver = ImmediateResizeObserver as unknown as typeof ResizeObserver;
    document.documentElement.dataset.theme = "electrox";
    document.body.innerHTML = `
      <div id="frame" style="display:grid;grid-template-columns:280px minmax(0,1fr) 0px">
        <aside></aside>
        <main></main>
        <div data-shell-overlay><div id="mount"></div></div>
      </div>`;
    const release = registerCapability({
      id: "broken-skills-test",
      label: "技能库",
      render: () => { throw new Error("skill catalog failed"); },
    });
    const mount = document.getElementById("mount");
    if (mount === null) throw new Error("missing test mount");
    const root = createRoot(mount);
    const report = console.error;
    console.error = () => {};

    try {
      await act(async () => { root.render(<CapabilityWorkspace />); });
      const button = Array.from(document.querySelectorAll("button"))
        .find((item) => item.textContent?.includes("技能库"));
      await act(async () => { button?.click(); });

      expect(document.querySelector('[data-tokens-workspace="true"]')).not.toBeNull();
      expect(document.querySelector('nav[aria-label="能力导航"]')).not.toBeNull();
      expect(document.querySelector('[role="alert"]')?.textContent).toContain("技能库暂时无法显示");
    } finally {
      console.error = report;
      await act(async () => { root.unmount(); });
      release();
    }
  });
});
