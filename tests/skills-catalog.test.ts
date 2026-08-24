import { describe, expect, it } from "vitest";
import { mergeBundledSkillCatalog } from "../src/client/modules/skills/data.ts";

describe("bundled skill catalog state", () => {
  it("adds installed bundled skills as model-invocable without duplicating server rows", () => {
    const merged = mergeBundledSkillCatalog(
      [{ name: "existing", description: "server", modelInvocable: false }],
      [
        { name: "existing", description: "bundle", installed: true },
        { name: "code-reviewer", description: "review", installed: true },
        { name: "not-installed", description: "skip", installed: false },
      ],
    );
    expect(merged.map((skill) => skill.name)).toEqual(["existing", "code-reviewer"]);
    expect(merged[1]?.modelInvocable).toBe(true);
  });
});
