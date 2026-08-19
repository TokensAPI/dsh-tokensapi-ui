// tokens-core browser half: a visible row at the foot of the sidebar (next to
// Settings), contributed into the `sidebar.footer.action` list slot.
//
// Ordinary DSH web-client plugin styled the idiomatic way — CSS Modules + the
// platform's --dsw-* design tokens (docs/web-styling.md forbids Tailwind and a
// component library). tsdown compiles the .module.css with lightningcss and
// injects it as a <style> tag automatically; here we just consume the hashed
// class map. The row follows the host's light/dark theme via the tokens.
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
// Type-only: pulls ui-sidebar's SlotMap merge (the 'sidebar.footer.action' entry
// and its { wide } owner props), so the registration below is type-checked.
import type {} from "@deepseek-ai/dsh-client-ui-sidebar/client";
import clsx from "clsx";
import styles from "./TokensCoreRow.module.css";

export const name = "tokens-core";
export const inject = ["slots"];

/** Owner of `sidebar.footer.action` passes `wide`: true when the sidebar is
 * expanded, false when collapsed to the icon rail. */
function TokensCoreRow({ wide }: { wide: boolean }): React.JSX.Element {
  return (
    <div
      className={clsx(styles.row, wide ? styles.wide : styles.collapsed)}
      title="tokens-core"
    >
      <span className={styles.badge}>T</span>
      {wide ? <span>tokens-ui-3-core</span> : null}
    </div>
  );
}

export function apply(ctx: ClientContext): void {
  // Defer registration until the slot is declared, so plugin load order does
  // not matter (same pattern as packages/client/ui-jobs).
  ctx.slots.inject("sidebar.footer.action", () =>
    ctx.slots.register(
      { name: "sidebar.footer.action", id: "tokens-core", order: 10 },
      TokensCoreRow,
    ),
  );
}
