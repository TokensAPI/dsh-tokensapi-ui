import { afterEach, describe, expect, it, vi } from "vitest";
import { openNativeSchedule, setNativeScheduleLayout } from "../src/client/modules/automation/native-schedule.ts";
import { workspace } from "../src/client/shell/workspace-store.ts";

describe("native automation navigation", () => {
  afterEach(() => workspace.close());

  it("opens the registered native panel and releases the product overlay", () => {
    const selectPanel = vi.fn();
    const stop = setNativeScheduleLayout({ selectPanel });
    try {
      workspace.select("automation");
      openNativeSchedule();
      expect(selectPanel).toHaveBeenCalledWith("schedules");
      expect(workspace.snapshot()).toBeNull();
    } finally { stop(); }
  });

  it("keeps the fallback page available when native schedule is not mounted", () => {
    const stop = setNativeScheduleLayout({ selectPanel: () => { throw new Error("not registered"); } });
    try {
      workspace.select("automation");
      expect(openNativeSchedule).toThrow("not registered");
      expect(workspace.snapshot()).toBe("automation");
    } finally { stop(); }
  });

  it("supports runtime replacement without an old disposer clearing the current layout", () => {
    const first = setNativeScheduleLayout({});
    const selectPanel = vi.fn();
    const second = setNativeScheduleLayout({ selectPanel });
    first();
    openNativeSchedule();
    expect(selectPanel).toHaveBeenCalledOnce();
    second();
    expect(openNativeSchedule).toThrow("当前客户端不支持");
  });
});
