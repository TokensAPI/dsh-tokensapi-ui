import { afterEach, expect, it, vi } from "vitest";
import { installCapabilityNavigation } from "../src/client/shell/native-capability-navigation.ts";
import { registerCapability } from "../src/client/shell/capability-registry.ts";
import { workspace } from "../src/client/shell/workspace-store.ts";

const cleanup: (() => void)[] = [];
afterEach(() => { for (const dispose of cleanup.splice(0).reverse()) dispose(); workspace.close(); });
function fixture() {
  for (const id of ["skills", "knowledge", "tools", "automation"]) cleanup.push(registerCapability({ id, label: id, render: () => null, ...(id === "automation" ? { nativePanel: "schedules" } : {}) }));
  let activePanelId: string | null = null;
  const listeners = new Set<() => void>();
  const seats = new Set(["schedules", "plugins"]);
  const selectPanel = vi.fn((id: string | null) => {
    if (id && !seats.has(id)) throw new Error("missing panel");
    activePanelId = id; for (const listener of listeners) listener();
  });
  const layout = { selectPanel, panelInfo: { getSnapshot: () => ({ activePanelId }), subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } } };
  const register = vi.fn((id: string) => { seats.add(id); return () => { seats.delete(id); }; });
  cleanup.push(installCapabilityNavigation(layout, register));
  return { layout, register, seats, listeners };
}

it("registers three real main pages and shares native schedules with the sidebar", () => {
  const h = fixture();
  expect(h.register.mock.calls.map(([id]) => id).sort()).toEqual(["tokens-capability:knowledge", "tokens-capability:skills", "tokens-capability:tools"]);
  workspace.select("skills"); expect(h.layout.panelInfo.getSnapshot().activePanelId).toBe("tokens-capability:skills");
  workspace.select("automation"); expect(h.layout.panelInfo.getSnapshot().activePanelId).toBe("schedules");
  expect(workspace.snapshot()).toBe("automation");
  workspace.select("automation"); expect(h.layout.panelInfo.getSnapshot().activePanelId).toBe("schedules");
});

it("clears top selection when the sidebar opens plugins or a conversation", () => {
  const h = fixture();
  for (const id of ["skills", "knowledge", "tools"]) {
    workspace.select(id); expect(workspace.snapshot()).toBe(id);
    h.layout.selectPanel("plugins"); expect(workspace.snapshot()).toBeNull();
    h.layout.selectPanel("schedules"); expect(workspace.snapshot()).toBe("automation");
    h.layout.selectPanel(null); expect(workspace.snapshot()).toBeNull();
  }
});

it("closes only product panels without dismissing native pages", () => {
  const h = fixture();
  workspace.select("skills"); workspace.close(); expect(h.layout.panelInfo.getSnapshot().activePanelId).toBeNull();
  h.layout.selectPanel("plugins"); workspace.close(); expect(h.layout.panelInfo.getSnapshot().activePanelId).toBe("plugins");
  h.layout.selectPanel("schedules"); workspace.close(); expect(h.layout.panelInfo.getSnapshot().activePanelId).toBe("schedules");
});

it("supports dynamic capabilities and releases subscriptions and main slots", () => {
  const h = fixture();
  const stop = registerCapability({ id: "extension", label: "extension", render: () => null });
  cleanup.push(stop);
  expect(h.seats.has("tokens-capability:extension")).toBe(true);
  workspace.select("extension"); expect(workspace.snapshot()).toBe("extension");
  stop(); expect(h.seats.has("tokens-capability:extension")).toBe(false);
  expect(workspace.snapshot()).toBeNull();
});
