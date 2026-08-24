import { useSyncExternalStore } from "react";
import { nativeViewsSuspended, surfaces } from "./surface-store.ts";

export function useNativeViewsSuspended(): boolean {
  return useSyncExternalStore(surfaces.subscribe, nativeViewsSuspended, () => false);
}
