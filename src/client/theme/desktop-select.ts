const NATIVE_SELECTOR = "select.dshDesktopSettingsSelect";
const BRIDGE_CLASS = "dshTokensNativeSelectBridge";
const TRIGGER_CLASS = "dshTokensDesktopSelectTrigger";
const LISTBOX_CLASS = "dshTokensDesktopSelectListbox";

interface EnhancedSelect {
  select: HTMLSelectElement;
  trigger: HTMLButtonElement;
  listbox: HTMLDivElement | null;
  onNativeChange: () => void;
}

let nextId = 0;

function selectedLabel(select: HTMLSelectElement): string {
  const selected = Array.from(select.options).find((option) => option.value === select.value);
  return selected?.textContent?.trim() || select.value;
}

/**
 * Replace only Desktop's window-material native popup with a DOM-owned listbox.
 * The original controlled select remains mounted as the source of truth and
 * receives a normal bubbling change event, so Desktop still owns persistence,
 * validation and restart prompts.
 */
export function observeDesktopSettingsSelect(): () => void {
  if (typeof document === "undefined") return () => {};

  const entries = new Map<HTMLSelectElement, EnhancedSelect>();
  let active: EnhancedSelect | null = null;
  let disposed = false;

  const close = (entry: EnhancedSelect, restoreFocus = false): void => {
    if (entry.listbox === null) return;
    entry.listbox.remove();
    entry.listbox = null;
    entry.trigger.setAttribute("aria-expanded", "false");
    entry.trigger.removeAttribute("aria-controls");
    if (active === entry) active = null;
    if (restoreFocus) entry.trigger.focus();
  };

  const sync = (entry: EnhancedSelect): void => {
    const label = selectedLabel(entry.select);
    const disabled = entry.select.disabled;
    if (entry.trigger.textContent !== label) entry.trigger.textContent = label;
    if (entry.trigger.disabled !== disabled) entry.trigger.disabled = disabled;
    if (entry.trigger.getAttribute("aria-disabled") !== String(disabled)) {
      entry.trigger.setAttribute("aria-disabled", String(disabled));
    }
  };

  const choose = (entry: EnhancedSelect, option: HTMLOptionElement): void => {
    if (option.disabled || entry.select.disabled) return;
    entry.select.value = option.value;
    entry.select.dispatchEvent(new Event("input", { bubbles: true }));
    entry.select.dispatchEvent(new Event("change", { bubbles: true }));
    sync(entry);
    close(entry, true);
  };

  const position = (entry: EnhancedSelect): void => {
    if (entry.listbox === null) return;
    const rect = entry.trigger.getBoundingClientRect();
    const gap = 6;
    const availableBelow = window.innerHeight - rect.bottom - gap - 8;
    const availableAbove = rect.top - gap - 8;
    const openAbove = availableBelow < 160 && availableAbove > availableBelow;
    entry.listbox.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`;
    entry.listbox.style.width = `${rect.width}px`;
    entry.listbox.style.maxHeight = `${Math.max(96, openAbove ? availableAbove : availableBelow)}px`;
    if (openAbove) {
      entry.listbox.style.top = "auto";
      entry.listbox.style.bottom = `${window.innerHeight - rect.top + gap}px`;
    } else {
      entry.listbox.style.top = `${rect.bottom + gap}px`;
      entry.listbox.style.bottom = "auto";
    }
  };

  const open = (entry: EnhancedSelect, focusDirection: 1 | -1 | 0 = 0): void => {
    if (entry.select.disabled) return;
    if (active !== null && active !== entry) close(active);
    if (entry.listbox !== null) {
      close(entry);
      return;
    }

    const listbox = document.createElement("div");
    const listboxId = `dsh-tokens-desktop-select-${++nextId}`;
    listbox.id = listboxId;
    listbox.className = LISTBOX_CLASS;
    listbox.dataset.tokensFloatingSurface = "popup";
    listbox.dataset.tokensDesktopSelectListbox = "true";
    listbox.setAttribute("role", "listbox");
    listbox.setAttribute("aria-label", entry.select.getAttribute("aria-label") || "窗口材质");

    const optionButtons: HTMLButtonElement[] = [];
    for (const option of entry.select.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(option.selected));
      button.disabled = option.disabled;
      button.textContent = option.textContent?.trim() || option.value;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        choose(entry, option);
      });
      listbox.appendChild(button);
      optionButtons.push(button);
    }

    listbox.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(entry, true);
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const enabled = optionButtons.filter((button) => !button.disabled);
      if (enabled.length === 0) return;
      const current = enabled.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home"
        ? 0
        : event.key === "End"
          ? enabled.length - 1
          : (current + (event.key === "ArrowUp" ? -1 : 1) + enabled.length) % enabled.length;
      enabled[next]?.focus();
    });

    document.body.appendChild(listbox);
    entry.listbox = listbox;
    active = entry;
    entry.trigger.setAttribute("aria-expanded", "true");
    entry.trigger.setAttribute("aria-controls", listboxId);
    position(entry);

    if (focusDirection !== 0) {
      const enabled = optionButtons.filter((button) => !button.disabled);
      const selected = optionButtons.find((button) => button.getAttribute("aria-selected") === "true");
      (selected ?? enabled[focusDirection > 0 ? 0 : enabled.length - 1])?.focus();
    }
  };

  const enhance = (select: HTMLSelectElement): void => {
    if (entries.has(select)) return;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = TRIGGER_CLASS;
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      open(entries.get(select)!);
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        open(entries.get(select)!, event.key === "ArrowDown" ? 1 : -1);
      }
    });
    select.classList.add(BRIDGE_CLASS);
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    select.insertAdjacentElement("afterend", trigger);
    const entry: EnhancedSelect = {
      select,
      trigger,
      listbox: null,
      onNativeChange: () => {},
    };
    entry.onNativeChange = () => sync(entry);
    entries.set(select, entry);
    select.addEventListener("change", entry.onNativeChange);
    sync(entry);
  };

  const refresh = (): void => {
    if (disposed) return;
    for (const select of document.querySelectorAll<HTMLSelectElement>(NATIVE_SELECTOR)) enhance(select);
    for (const [select, entry] of entries) {
      if (!select.isConnected) {
        close(entry);
        select.removeEventListener("change", entry.onNativeChange);
        entry.trigger.remove();
        entries.delete(select);
      } else {
        sync(entry);
      }
    }
  };

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "selected", "value"],
  });
  const closeFromOutside = (event: PointerEvent): void => {
    if (active === null) return;
    const target = event.target;
    if (target instanceof Node && (active.trigger.contains(target) || active.listbox?.contains(target))) return;
    close(active);
  };
  const reposition = (): void => { if (active !== null) position(active); };
  document.addEventListener("pointerdown", closeFromOutside, true);
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
  refresh();

  return () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener("pointerdown", closeFromOutside, true);
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
    for (const entry of entries.values()) {
      close(entry);
      entry.trigger.remove();
      entry.select.removeEventListener("change", entry.onNativeChange);
      entry.select.classList.remove(BRIDGE_CLASS);
      entry.select.removeAttribute("aria-hidden");
      entry.select.removeAttribute("tabindex");
    }
    entries.clear();
  };
}
