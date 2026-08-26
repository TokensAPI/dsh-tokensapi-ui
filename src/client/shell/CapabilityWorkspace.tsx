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
import type { ILayout } from "@deepseek-ai/dsh-client-ui-layout/client";
import { BRAND_LOGO } from "./brand-logo.ts";
import darkTokensApiLogo from "./assets/tokens-cowork-dark-mark-96.png";
import lightTokensApiLogo from "./assets/tokensapi-mark-1024.png";
import styles from "./CapabilityWorkspace.module.css";

let layoutRuntime: ILayout | null = null;

export function setCapabilityWorkspaceLayout(layout: ILayout): void {
  layoutRuntime = layout;
}

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

export function CapabilityWorkspace(): React.JSX.Element {
  const active = useActiveCapability();
  const capabilities = useCapabilities();
  const activeCap = capabilities.find((item) => item.id === active) ?? null;
  const [barNode, setBarNode] = useState<HTMLElement | null>(null);
  const sidebarWidth = useSidebarWidth(barNode);
  const wide = sidebarWidth === 0 || sidebarWidth > 150;

  useEffect(() => {
    const root = document.documentElement;
    const sync = (): void => {
      if (root.dataset.theme === "clean") workspace.close();
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const overlay = barNode?.closest<HTMLElement>("[data-shell-overlay]") ?? null;
    const frame = overlay?.parentElement ?? null;
    if (frame === null) return;
    frame.toggleAttribute("data-tokens-capability-active", activeCap !== null);
    if (activeCap !== null) frame.dataset.tokensCapabilityActive = activeCap.id;
    else delete frame.dataset.tokensCapabilityActive;

    let hostMain: HTMLElement | null = null;
    let previousInert = false;
    let previousAriaHidden: string | null = null;
    if (activeCap !== null && overlay !== null) {
      const boundary = sidebarWidth > 0 ? sidebarWidth : 56;
      hostMain = Array.from(frame.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== overlay && !child.contains(overlay))
        .map((child) => ({ child, rect: child.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.right > boundary + 80)
        .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0]?.child ?? null;
      if (hostMain !== null) {
        previousInert = hostMain.inert;
        previousAriaHidden = hostMain.getAttribute("aria-hidden");
        hostMain.dataset.tokensHostMain = "true";
        hostMain.inert = true;
        hostMain.setAttribute("aria-hidden", "true");
      }
    }
    return () => {
      frame.removeAttribute("data-tokens-capability-active");
      if (hostMain !== null) {
        delete hostMain.dataset.tokensHostMain;
        hostMain.inert = previousInert;
        if (previousAriaHidden === null) hostMain.removeAttribute("aria-hidden");
        else hostMain.setAttribute("aria-hidden", previousAriaHidden);
      }
    };
  }, [activeCap, barNode, sidebarWidth]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") workspace.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Return to the conversation only for a real session-row selection. Sidebar
  // chrome (toggle, Settings, search, filters, workspace rows) must remain usable
  // without dismissing the active capability page. Session rows and search
  // results share role=treeitem + aria-selected; nested row-action buttons are
  // excluded because capture runs before their stopPropagation handlers.
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (workspace.snapshot() === null) return;
      const target = event.target as Element | null;
      if (target === null) return;
      const sessionRow = target.closest<HTMLElement>('[role="treeitem"][aria-selected]');
      if (sessionRow === null) return;
      const nestedButton = target.closest("button");
      if (nestedButton !== null && nestedButton !== sessionRow) return;
      workspace.close();
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
          <span className={styles.markFrame}>
            <img className={styles.mark} src={BRAND_LOGO} alt="ELECTRO X / 粒刻" />
          </span>
          {wide ? (
            <div className={styles.brandText}>
              <div className={styles.brandTitle}>
                ELECTRO&nbsp;X <span className={styles.brandSlash}>/</span> 粒刻
              </div>
              <div className={styles.poweredBy}>
                powered by
                <span className={styles.poweredLogo} aria-hidden="true">
                  <img className={styles.poweredLogoLight} src={lightTokensApiLogo} alt="" />
                  <img className={styles.poweredLogoDark} src={darkTokensApiLogo} alt="" />
                </span>
                <span className={styles.poweredName}>TokensAPI</span>
              </div>
            </div>
          ) : null}
          {wide ? (
            <button
              type="button"
              className={styles.sidebarToggle}
              data-tokens-partner-sidebar-toggle="true"
              aria-label="收起侧边栏"
              title="收起侧边栏"
              onClick={() => layoutRuntime?.toggleSidebar()}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
                <line x1="6" y1="2.5" x2="6" y2="13.5" />
              </svg>
            </button>
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
