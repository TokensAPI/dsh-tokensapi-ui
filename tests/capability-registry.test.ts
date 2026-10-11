import { describe, expect, it } from "vitest";
import { listCapabilities, registerCapability } from "../src/client/shell/capability-registry.ts";

describe("capability registration ownership", () => {
  it("keeps replacements when an old owner disposes and allows re-registration", () => {
    const first = registerCapability({ id: "ownership-test", label: "old", render: () => null });
    const second = registerCapability({ id: "ownership-test", label: "new", render: () => null });
    try {
      first(); first();
      expect(listCapabilities().find((cap) => cap.id === "ownership-test")?.label).toBe("new");
      second(); second();
      expect(listCapabilities().some((cap) => cap.id === "ownership-test")).toBe(false);
      const reloaded = registerCapability({ id: "ownership-test", label: "reloaded", render: () => null });
      expect(listCapabilities().find((cap) => cap.id === "ownership-test")?.label).toBe("reloaded");
      reloaded();
    } finally { first(); second(); }
  });
});
