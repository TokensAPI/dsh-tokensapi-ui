const SURFACE_ATTRIBUTE = "data-tokens-floating-surface";
const ACTIVE_TRIGGER_SELECTOR =
  '[aria-haspopup]:not([aria-haspopup="false"])[aria-expanded="true"]';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const POPUP_ITEM_SELECTOR = [
  '[role="option"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="treeitem"]',
  '[role="gridcell"]',
].join(",");

const POPUP_CLASS_HINT = /(?:menu|listbox|dropdown|popover|popup|picker|select)/i;

export interface FloatingSurfaceFacts {
  position: string;
  visible: boolean;
  focusableCount: number;
  popupItemCount: number;
  className: string;
  localToTrigger: boolean;
  recentlyAdded: boolean;
  controlledByTrigger: boolean;
}

export function supportsFloatingPopupType(value: string | null): boolean {
  return value !== null && value !== "false" && value !== "dialog";
}

export function scoreFloatingSurface(facts: FloatingSurfaceFacts): number {
  if (!facts.visible || (facts.position !== "absolute" && facts.position !== "fixed")) {
    return Number.NEGATIVE_INFINITY;
  }
  if (facts.focusableCount === 0 && facts.popupItemCount === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 6;
  score += Math.min(facts.focusableCount, 2);
  score += Math.min(facts.popupItemCount, 3) * 2;
  if (POPUP_CLASS_HINT.test(facts.className)) score += 1;
  if (facts.localToTrigger) score += 4;
  if (facts.recentlyAdded) score += 3;
  if (facts.controlledByTrigger) score += 20;
  return score;
}

function isVisible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function describeCandidate(
  element: HTMLElement,
  options: Pick<FloatingSurfaceFacts, "localToTrigger" | "recentlyAdded" | "controlledByTrigger">,
): FloatingSurfaceFacts {
  return {
    position: getComputedStyle(element).position,
    visible: isVisible(element),
    focusableCount: element.querySelectorAll(FOCUSABLE_SELECTOR).length,
    popupItemCount: element.querySelectorAll(POPUP_ITEM_SELECTOR).length,
    className: typeof element.className === "string" ? element.className : "",
    ...options,
  };
}

function addElementTree(target: Set<HTMLElement>, node: Node): void {
  if (!(node instanceof HTMLElement)) return;
  target.add(node);
  for (const descendant of node.querySelectorAll<HTMLElement>("*")) target.add(descendant);
}

function isPositionedInteractiveCandidate(element: HTMLElement): boolean {
  const position = getComputedStyle(element).position;
  if (position !== "absolute" && position !== "fixed") return false;
  return (
    element.querySelector(FOCUSABLE_SELECTOR) !== null ||
    element.querySelector(POPUP_ITEM_SELECTOR) !== null
  );
}

function localCandidates(trigger: HTMLElement): Set<HTMLElement> {
  const candidates = new Set<HTMLElement>();
  let branch: HTMLElement = trigger;
  let ancestor = trigger.parentElement;
  let levels = 0;

  while (ancestor !== null && ancestor !== document.body && levels < 8) {
    const levelCandidates = new Set<HTMLElement>();
    for (const sibling of ancestor.children) {
      if (!(sibling instanceof HTMLElement) || sibling === branch || sibling.contains(trigger)) continue;
      addElementTree(levelCandidates, sibling);
    }
    for (const candidate of levelCandidates) {
      if (isPositionedInteractiveCandidate(candidate)) candidates.add(candidate);
    }
    if (candidates.size > 0) break;
    branch = ancestor;
    ancestor = ancestor.parentElement;
    levels += 1;
  }
  return candidates;
}

function controlledCandidate(trigger: HTMLElement): HTMLElement | null {
  const controlledId = trigger.getAttribute("aria-controls");
  return controlledId === null ? null : document.getElementById(controlledId);
}

/**
 * Mark popup surfaces by their relationship to an actually expanded trigger.
 * The marker gives theme CSS a stable contract even when a host/plugin uses a
 * new ARIA role or a generated CSS-module class for its popup implementation.
 */
export function observeFloatingSurfaces(): () => void {
  if (typeof document === "undefined") return () => {};

  const marked = new Set<HTMLElement>();
  const recentlyAdded = new Set<HTMLElement>();
  let refreshQueued = false;
  let disposed = false;

  const refresh = (): void => {
    refreshQueued = false;
    if (disposed) return;
    const nextMarked = new Set<HTMLElement>();
    const triggers = document.querySelectorAll<HTMLElement>(ACTIVE_TRIGGER_SELECTOR);

    for (const trigger of triggers) {
      if (!supportsFloatingPopupType(trigger.getAttribute("aria-haspopup"))) continue;

      const controlled = controlledCandidate(trigger);
      const candidates = localCandidates(trigger);
      if (controlled !== null) candidates.add(controlled);
      for (const element of recentlyAdded) {
        if (!element.contains(trigger)) candidates.add(element);
      }

      let best: HTMLElement | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const candidate of candidates) {
        if (!candidate.isConnected || candidate.contains(trigger)) continue;
        const score = scoreFloatingSurface(
          describeCandidate(candidate, {
            localToTrigger: !recentlyAdded.has(candidate),
            recentlyAdded: recentlyAdded.has(candidate),
            controlledByTrigger: candidate === controlled,
          }),
        );
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
      if (best !== null && Number.isFinite(bestScore)) nextMarked.add(best);
    }

    for (const element of marked) {
      if (!nextMarked.has(element)) element.removeAttribute(SURFACE_ATTRIBUTE);
    }
    for (const element of nextMarked) element.setAttribute(SURFACE_ATTRIBUTE, "popup");
    marked.clear();
    for (const element of nextMarked) marked.add(element);
    recentlyAdded.clear();
  };

  const queueRefresh = (): void => {
    if (disposed || refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(refresh);
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) addElementTree(recentlyAdded, node);
    }
    queueRefresh();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded", "aria-hidden", "class", "hidden", "style"],
  });
  refresh();

  return () => {
    disposed = true;
    observer.disconnect();
    for (const element of marked) element.removeAttribute(SURFACE_ATTRIBUTE);
    marked.clear();
    recentlyAdded.clear();
  };
}
