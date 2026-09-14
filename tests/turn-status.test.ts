// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { observeTurnStatus } from "../src/client/shell/turn-status.ts";

async function settleObservers(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("turn status copy", () => {
  afterEach(() => document.body.replaceChildren());

  it("rewrites current and later status labels while preserving the elapsed clock", async () => {
    document.body.innerHTML = `
      <div role="status" aria-live="polite">深度求索中...<span aria-hidden="true">2分05秒</span></div>`;
    const stop = observeTurnStatus();

    expect(document.querySelector('[role="status"]')?.textContent).toBe("正在思考中...2分05秒");

    const later = document.createElement("div");
    later.innerHTML = '<div role="status" aria-live="polite">Deep diving...</div>';
    document.body.append(later);
    await settleObservers();

    expect(later.textContent).toBe("Thinking...");
    stop();
  });

  it("converges after its own character-data mutation", async () => {
    const status = document.createElement("div");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "深度求索中...";
    document.body.append(status);
    const label = status.firstChild;
    if (label === null) throw new Error("missing status label");

    let writes = 0;
    const counter = new MutationObserver((records) => { writes += records.length; });
    counter.observe(label, { characterData: true });

    const stop = observeTurnStatus();
    await settleObservers();
    expect(status.textContent).toBe("正在思考中...");
    expect(writes).toBe(1);
    stop();
    counter.disconnect();
  });
});
