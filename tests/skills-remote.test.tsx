// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillsList } from "../src/client/modules/skills/SkillsList.tsx";
import { setSkillsRuntime } from "../src/client/modules/skills/data.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("skills catalog remote", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("loads through the declared remote.skills surface", async () => {
    const list = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        skills: [{ name: "review", description: "Review code", modelInvocable: true }],
      },
    });
    const snapshot = {
      current: "session-1",
      ids: ["session-1"],
      byId: {},
    };
    setSkillsRuntime({
      remoteSkills: { list },
      sessions: {
        list: {
          getSnapshot: () => snapshot,
          subscribe: () => () => {},
        },
      },
      connection: {
        rpc: {
          call: vi.fn().mockResolvedValue({ ok: true, value: { skills: [] } }),
        },
      },
    } as never);

    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const root = createRoot(mount);

    await act(async () => {
      root.render(<SkillsList onOpen={() => {}} />);
      await Promise.resolve();
    });

    expect(list).toHaveBeenCalledWith({ sessionId: "session-1" }, expect.any(AbortSignal));
    expect(document.body.textContent).toContain("review");
    expect(document.body.textContent).toContain("Review code");

    await act(async () => { root.unmount(); });
  });
});
