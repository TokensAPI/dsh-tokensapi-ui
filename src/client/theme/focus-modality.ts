/** Track the input used to restore dialog triggers, without moving focus ourselves. */
export function observeFocusModality(): () => void {
  const root = document.documentElement;
  const previous = root.getAttribute("data-tokens-input");
  const set = (value: "pointer" | "keyboard") => {
    if (root.dataset.tokensInput !== value) root.dataset.tokensInput = value;
  };
  const onPointerDown = () => set("pointer");
  const onKeyDown = (event: KeyboardEvent) => {
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    set("keyboard");
  };
  set("pointer");
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    if (previous === null) root.removeAttribute("data-tokens-input");
    else root.setAttribute("data-tokens-input", previous);
  };
}
