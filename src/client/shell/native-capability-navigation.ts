import { listCapabilities, subscribeCapabilities, type Capability } from "./capability-registry.ts";
import { bindWorkspaceNavigation } from "./workspace-store.ts";

interface PanelLayout {
  selectPanel(id: string | null): void;
  panelInfo: { getSnapshot(): { activePanelId: string | null }; subscribe(listener: () => void): () => void };
}
export const capabilityPanelId = (cap: Capability): string => cap.nativePanel ?? `tokens-capability:${cap.id}`;

/** Use the same public main slots and selection source as the native sidebar. */
export function installCapabilityNavigation(value: unknown, register: (id: string, cap: Capability) => () => void): () => void {
  const layout = value as Partial<PanelLayout> | null;
  if (typeof layout?.selectPanel !== "function" || typeof layout.panelInfo?.subscribe !== "function" || typeof layout.panelInfo?.getSnapshot !== "function") return () => {};
  const host = layout as PanelLayout;
  const panels = new Map<string, { cap: Capability; release: () => void }>();
  const binding = bindWorkspaceNavigation({
    select(id) {
      const cap = listCapabilities().find(item => item.id === id);
      if (cap) host.selectPanel(capabilityPanelId(cap));
    },
    close() {
      // Closing product pages must not dismiss native schedules/plugins when
      // switching skins, or when a late skill operation completes.
      if (host.panelInfo.getSnapshot().activePanelId?.startsWith("tokens-capability:")) host.selectPanel(null);
    },
  });
  const sync = () => {
    const selected = host.panelInfo.getSnapshot().activePanelId;
    binding.sync(listCapabilities().find(cap => capabilityPanelId(cap) === selected)?.id ?? null);
  };
  const refresh = () => {
    const current = listCapabilities();
    for (const [id, row] of panels) {
      if (!current.includes(row.cap)) { row.release(); panels.delete(id); }
    }
    for (const cap of current) {
      if (cap.nativePanel || panels.has(cap.id)) continue;
      panels.set(cap.id, { cap, release: register(capabilityPanelId(cap), cap) });
    }
    sync();
  };
  try { refresh(); } catch (error) { binding.dispose(); for (const row of panels.values()) row.release(); throw error; }
  const stopPanels = subscribeCapabilities(refresh);
  const stopSelection = host.panelInfo.subscribe(sync);
  return () => {
    stopPanels(); stopSelection(); binding.dispose();
    for (const row of panels.values()) row.release();
  };
}
