// Shared capability-nav state. The top nav (in the shell.overlay slot) is always
// visible; `active` selects which capability page covers the main content area,
// or null to show the underlying DSH conversation. State lives outside React
// (separate slot trees) and is read via useSyncExternalStore.
import { useSyncExternalStore } from "react";

export type Capability = "skills" | "knowledge" | "automation" | "tools";

let active: Capability | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export const workspace = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot(): Capability | null {
    return active;
  },
  /** Toggle a capability page (clicking the active tab returns to chat). */
  select(capability: Capability): void {
    active = active === capability ? null : capability;
    emit();
  },
  /** Return to the conversation. */
  close(): void {
    active = null;
    emit();
  },
};

/** Subscribe a component to the active capability (null = conversation). */
export function useActiveCapability(): Capability | null {
  return useSyncExternalStore(workspace.subscribe, workspace.snapshot, workspace.snapshot);
}
