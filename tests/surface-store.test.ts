import { describe, expect, it, vi } from "vitest";
import { nativeViewsSuspended, surfaces } from "../src/client/shell/surface-store.ts";

describe("surface modal coordination", () => {
  it("reference counts nested modals and disposes idempotently", () => {
    const listener = vi.fn();
    const unsubscribe = surfaces.subscribe(listener);
    const closeFirst = surfaces.openModal();
    const closeSecond = surfaces.openModal();
    expect(surfaces.snapshot().modalCount).toBe(2);
    expect(nativeViewsSuspended()).toBe(true);
    closeFirst();
    closeFirst();
    expect(surfaces.snapshot().modalCount).toBe(1);
    closeSecond();
    expect(surfaces.snapshot().modalCount).toBe(0);
    expect(surfaces.snapshot().domModalOpen).toBe(false);
    expect(nativeViewsSuspended()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
  });
});
