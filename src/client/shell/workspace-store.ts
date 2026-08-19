// Shared capability-nav state. `active` is a capability id (from the registry)
// or null to show the underlying DSH conversation. State lives outside React
// (the trigger and the overlay render in separate slot trees) and is read via
// useSyncExternalStore.
import { useSyncExternalStore } from "react";

let active: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export const workspace = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot(): string | null {
    return active;
  },
  /** Toggle a capability page (clicking the active tab returns to chat). */
  select(id: string): void {
    active = active === id ? null : id;
    emit();
  },
  /** Return to the conversation. */
  close(): void {
    active = null;
    emit();
  },
};

/** Subscribe a component to the active capability id (null = conversation). */
export function useActiveCapability(): string | null {
  return useSyncExternalStore(workspace.subscribe, workspace.snapshot, workspace.snapshot);
}
