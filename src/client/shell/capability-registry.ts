// Capability registry (inspired by dsh-better-sidebar's registerTab service):
// the top-nav capabilities are not hardcoded — built-in modules and third-party
// plugins register through the same API, so the workspace is extensible. Exposed
// to other plugins as `ctx.tokensWorkspace` (see index.tsx).
import type { ComponentType } from "react";
import { useSyncExternalStore } from "react";

export interface Capability {
  /** Stable id (also the workspace-store active key). */
  id: string;
  /** Nav label (Chinese product copy). */
  label: string;
  /** Mono uppercase tag under the label. */
  tag: string;
  /** Nav order (ascending). */
  order: number;
  /** The full-page view rendered when this capability is active. */
  render: ComponentType;
}

export type CapabilityInput = Partial<Capability> & Pick<Capability, "id" | "label" | "render">;

const registry = new Map<string, Capability>();
const listeners = new Set<() => void>();
let snapshot: Capability[] = [];

function recompute(): void {
  snapshot = [...registry.values()].sort((a, b) => a.order - b.order);
}

function emit(): void {
  recompute();
  for (const listener of listeners) listener();
}

/** Register (or replace, by id) a capability tab. Returns a disposer. */
export function registerCapability(input: CapabilityInput): () => void {
  registry.set(input.id, { tag: input.label, order: 100, ...input });
  emit();
  return () => {
    registry.delete(input.id);
    emit();
  };
}

export function listCapabilities(): Capability[] {
  return snapshot;
}

/** Subscribe a component to the registered capabilities. */
export function useCapabilities(): Capability[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    listCapabilities,
    listCapabilities,
  );
}
