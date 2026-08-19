// Persistent capability shell rendered into the `shell.overlay` slot. Two
// absolutely-positioned pieces (a fragment → both become direct children of the
// overlay layer, so both get pointer-events):
//   - a full-width top nav band, ALWAYS visible. Its left "brand seat" tracks the
//     live sidebar column width (border aligned to the sidebar edge) so the band
//     stays seamless whether the sidebar is expanded or collapsed.
//   - a capability page that covers the main content area (offset by the sidebar
//     width) only while a capability is selected; otherwise the DSH conversation
//     shows through.
// 联合品牌: the client brand (粒刻/ELECTRO X) is dominant top-left; the platform
// (tokensapi) is a small "powered by" mark. The reserved top strip comes from the
// injected frame padding (theme/reskin.css).
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useActiveCapability, workspace } from "./workspace-store.ts";
import { useCapabilities } from "./capability-registry.ts";
import { TOKENSAPI_LOGO } from "./tokensapi-logo.ts";
import { BRAND_LOGO } from "./brand-logo.ts";
import styles from "./CapabilityWorkspace.module.css";

/** Measure the sidebar column width from the enclosing frame's grid tracks. */
function useSidebarWidth(node: HTMLElement | null): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (node === null) return;
    const frame = node.closest("[data-shell-overlay]")?.parentElement ?? null;
    if (frame === null) return;
    const measure = (): void => {
      const first = getComputedStyle(frame).gridTemplateColumns.split(" ")[0] ?? "0";
      const px = Number.parseFloat(first);
      setWidth(Number.isFinite(px) ? px : 0);
    };
    measure();
    // The frame's own size doesn't change when the sidebar collapses (only its
    // grid-template-columns changes), so observe the grid CHILDREN too — the
    // sidebar column resizes 280→56 and fires this — plus attribute mutations.
    const resize = new ResizeObserver(measure);
    resize.observe(frame);
    for (const child of Array.from(frame.children)) resize.observe(child);
    const mutation = new MutationObserver(measure);
    mutation.observe(frame, { attributes: true, attributeFilter: ["style", "data-sidebar-collapsed"] });
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [node]);
  return width;
}

/** Drive DSH's own (now hidden) sidebar collapse toggle from our nav band. */
function toggleSidebar(): void {
  // DSH's toggle is "收起侧边栏" when open; when collapsed the expand affordance
  // is the rail button "打开侧边栏" (also "展开侧边栏" in some builds).
  const btn = document.querySelector<HTMLButtonElement>(
    'button[aria-label="收起侧边栏"], button[aria-label="展开侧边栏"], button[aria-label="打开侧边栏"]',
  );
  btn?.click();
}

export function CapabilityWorkspace(): React.JSX.Element {
  const active = useActiveCapability();
  const capabilities = useCapabilities();
  const activeCap = capabilities.find((item) => item.id === active) ?? null;
  const [barNode, setBarNode] = useState<HTMLElement | null>(null);
  const sidebarWidth = useSidebarWidth(barNode);
  const wide = sidebarWidth === 0 || sidebarWidth > 150;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") workspace.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Returning to the conversation: the capability page covers only the main
  // content area, so the sidebar (conversation list) stays clickable. A click
  // anywhere OUTSIDE our overlay (i.e. in the DSH sidebar) while a page is open
  // means the user picked a conversation — close the page to reveal it. Capture
  // phase so the sidebar's own handler still runs and loads the conversation.
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (workspace.snapshot() === null) return;
      const target = event.target as Element | null;
      if (target !== null && target.closest("[data-shell-overlay]") === null) {
        workspace.close();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <>
      <header ref={setBarNode} className={styles.topbar}>
        <div
          className={styles.brandSeat}
          data-collapsed={!wide || undefined}
          style={sidebarWidth > 0 ? { width: `${sidebarWidth}px` } : undefined}
        >
          <img className={styles.mark} src={BRAND_LOGO} alt="ELECTRO X / 粒刻" />
          {wide ? (
            <div className={styles.brandText}>
              <div className={styles.brandTitle}>
                ELECTRO&nbsp;X <span className={styles.brandSlash}>/</span> 粒刻
              </div>
              <div className={styles.poweredBy}>
                powered by
                <img className={styles.poweredLogo} src={TOKENSAPI_LOGO} alt="" aria-hidden="true" />
                <span className={styles.poweredName}>tokensapi</span>
              </div>
            </div>
          ) : null}
        </div>

        <nav className={styles.nav} aria-label="能力导航">
          {capabilities.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.navItem}
              data-active={item.id === active || undefined}
              aria-current={item.id === active ? "page" : undefined}
              onClick={() => workspace.select(item.id)}
            >
              <span className={styles.navLabel}>{item.label}</span>
              <span className={styles.navTag}>{item.tag}</span>
            </button>
          ))}
        </nav>

      </header>

      {/* Collapse control as a bottom-left bar over the sidebar foot (reference
          places 收起侧边栏 there); tracks sidebar width, icon-only when collapsed. */}
      <button
        type="button"
        className={styles.collapseBar}
        data-collapsed={!wide || undefined}
        aria-label="切换侧栏"
        title="收起 / 展开侧栏"
        style={sidebarWidth > 0 ? { width: `${wide ? sidebarWidth - 16 : sidebarWidth}px` } : undefined}
        onClick={toggleSidebar}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
          <line x1="6" y1="2.5" x2="6" y2="13.5" />
        </svg>
        {wide ? <span className={styles.collapseLabel}>收起侧边栏</span> : null}
      </button>

      {activeCap !== null ? (
        <div
          className={clsx(styles.page, "theme-canvas")}
          style={{ left: `${sidebarWidth}px` }}
          role="region"
          aria-label={activeCap.label}
        >
          <activeCap.render />
        </div>
      ) : null}
    </>
  );
}
