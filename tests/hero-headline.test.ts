// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { observeTokensCoworkHeadline } from "../src/client/shell/BrandSlots.tsx";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("new-session branding", () => {
  afterEach(() => document.body.replaceChildren());

  it.each(["探索未至之境", "Explore the unknown", "Into the Unknown"])("hides %s only in the hero", async (headline) => {
    document.body.innerHTML = `<article><h2>${headline}</h2></article><div data-phase="hero"><h2>${headline}</h2></div>`;
    const stop = observeTokensCoworkHeadline();
    try {
      await settle();
      expect(document.querySelector<HTMLElement>('[data-phase="hero"] h2')?.hidden).toBe(true);
      expect(document.querySelector("article h2")?.textContent).toBe(headline);
    } finally { stop(); }
  });

  it("handles in-place locale updates and settles after its own mutations", async () => {
    document.body.innerHTML = '<div data-phase="hero"><h2>Loading</h2></div>';
    const heading = document.querySelector("h2")!;
    const stop = observeTokensCoworkHeadline();
    try {
      heading.firstChild!.textContent = "Into the Unknown";
      await settle();
      expect(heading.hidden).toBe(true);
      expect(heading.textContent).toBe("");
      let changes = 0;
      const counter = new MutationObserver((records) => { changes += records.length; });
      counter.observe(heading, { attributes: true, childList: true, characterData: true, subtree: true });
      await settle();
      await settle();
      counter.disconnect();
      expect(changes).toBe(0);
    } finally { stop(); }
  });
});
