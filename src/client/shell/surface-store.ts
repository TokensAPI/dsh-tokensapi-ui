interface SurfaceSnapshot {
  modalCount: number;
  domModalOpen: boolean;
}

let snapshot: SurfaceSnapshot = { modalCount: 0, domModalOpen: false };
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = { ...snapshot };
  for (const listener of listeners) listener();
}

export const surfaces = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot(): SurfaceSnapshot {
    return snapshot;
  },
  openModal(): () => void {
    snapshot.modalCount += 1;
    emit();
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      snapshot.modalCount = Math.max(0, snapshot.modalCount - 1);
      emit();
    };
  },
};

export function nativeViewsSuspended(): boolean {
  return surfaces.snapshot().modalCount > 0 || surfaces.snapshot().domModalOpen;
}

function visibleDialog(dialog: Element): boolean {
  if (!(dialog instanceof HTMLElement)) return false;
  if (dialog.hidden || dialog.getAttribute("aria-hidden") === "true") return false;
  const style = getComputedStyle(dialog);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && dialog.getClientRects().length > 0;
}

/** Suspend native Electron views whenever the Host or another plugin opens a dialog. */
export function observeGlobalModals(): () => void {
  if (typeof document === "undefined") return () => {};
  const refresh = (): void => {
    const next = Array.from(document.querySelectorAll('[role="dialog"]')).some(visibleDialog);
    if (snapshot.domModalOpen === next) return;
    snapshot.domModalOpen = next;
    emit();
  };
  refresh();
  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
  return () => {
    observer.disconnect();
    if (snapshot.domModalOpen) {
      snapshot.domModalOpen = false;
      emit();
    }
  };
}
