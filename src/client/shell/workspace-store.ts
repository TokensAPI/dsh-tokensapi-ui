// Shared capability-nav state. `active` is a capability id (from the registry)
// or null to show the underlying DSH conversation. State lives outside React
// (the trigger and the overlay render in separate slot trees) and is read via
// useSyncExternalStore.
import { useSyncExternalStore } from "react";

let active: string | null = null;
const listeners = new Set<() => void>();
interface Navigation {
  select(id: string): void;
  close(): void;
}
let navigation: Navigation | undefined;

export function bindWorkspaceNavigation(next: Navigation): { sync(id: string | null): void; dispose(): void } {
  navigation = next;
  active = null;
  emit();
  return {
    sync(id) { if (navigation === next && active !== id) { active = id; emit(); } },
    dispose() { if (navigation === next) { navigation = undefined; active = null; emit(); } },
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export const workspace = {
  native(): boolean { return navigation !== undefined; },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot(): string | null {
    return active;
  },
  /** Toggle a capability page (clicking the active tab returns to chat). */
  select(id: string): void {
    if (navigation) { navigation.select(id); return; }
    active = active === id ? null : id;
    emit();
  },
  /** Return to the conversation. */
  close(): void {
    if (navigation) { navigation.close(); return; }
    if (active === null) return;
    active = null;
    emit();
  },
};

/** Subscribe a component to the active capability id (null = conversation). */
export function useActiveCapability(): string | null {
  return useSyncExternalStore(workspace.subscribe, workspace.snapshot, workspace.snapshot);
}
