// Decoupled turn-status copy. The host ui-chat renders the running indicator as
//
//   <div class="…turnStatus…" role="status" aria-live="polite">
//     深度求索中...
//     <span class="…turnStatusClock…" aria-hidden>2分05秒</span>   (only after 15s)
//   </div>
//
// with NO slot around it, so a plugin cannot register a replacement component.
// The clean "host-untouched" route — the same one already used for the hero
// headline (observeTokensCoworkHeadline) — is to match the host's exact label
// and swap the leading text node, leaving the trailing run-clock <span> intact.
// The exact label strings (zh "深度求索中...", en "Deep diving...") come from
// ui-chat/src/client/locale.ts (key `chat.deepDiving`).

/** Host label → our copy. Keyed by the host's exact text (a locale-aware pair). */
const TURN_STATUS_COPY: Readonly<Record<string, string>> = {
  "深度求索中...": "正在思考中...",
  "Deep diving...": "Thinking...",
};

const TURN_STATUS_SELECTOR = '[role="status"][aria-live="polite"]';

function rewriteStatus(node: Element): void {
  if (!node.matches(TURN_STATUS_SELECTOR)) return;
  for (const child of node.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE) continue;
    const raw = child.textContent ?? "";
    const label = raw.trim();
    const replacement = TURN_STATUS_COPY[label];
    if (replacement === undefined) continue;
    const start = raw.indexOf(label);
    const next = `${raw.slice(0, start)}${replacement}${raw.slice(start + label.length)}`;
    // Idempotent: the mutation we cause is delivered once more, then converges.
    if (raw !== next) child.textContent = next;
    // Swap only the direct label text node; the run-clock <span> stays mounted.
    break;
  }
}

function syncMutationNode(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (parent !== null) rewriteStatus(parent);
    return;
  }
  if (!(node instanceof Element)) return;
  rewriteStatus(node);
  for (const status of node.querySelectorAll(TURN_STATUS_SELECTOR)) rewriteStatus(status);
}

/** Rewrite only the host's exact running-indicator label; everything else is untouched. */
export function observeTurnStatus(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.body ?? document.documentElement;
  syncMutationNode(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") {
        syncMutationNode(record.target);
        continue;
      }
      syncMutationNode(record.target);
      for (const added of record.addedNodes) syncMutationNode(added);
    }
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  return () => observer.disconnect();
}
