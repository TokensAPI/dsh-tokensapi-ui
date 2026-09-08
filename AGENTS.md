# Repository instructions

This is the source repository for the `dsh-tokensapi-ui` plugin. Make product changes here, not in a read-only copy under a TokensHarness superproject. Preserve unrelated local screenshots, browser artifacts, and other untracked debugging files.

## Desktop UI debugging

- Treat Desktop's frame geometry and native window material as host-owned. The clean theme must not override Desktop grid rows, caption heights, traffic-light insets, sidebar overflow, or viewport-sized modal geometry. The partner theme may reserve its explicit 72px product bar only while that bar is mounted.
- Never apply `backdrop-filter` to a layout ancestor that contains fixed dialogs, portals, popups, composers, or other interactive descendants. Filters can create containing blocks and compositor layers, rebasing fixed-position overlays and changing clipping or hit testing. Keep shell and dialog containers filter-free; put optional blur on pointer-transparent paint layers or modal-mask siblings with no positioned descendants.
- A problem that appears only on macOS Tahoe, a particular Electron build, or Desktop advanced mode may still be latent plugin CSS. Compare the exact combination of Desktop mode, theme, native material, client version, and plugin version before attributing it to the OS.
- Desktop advanced mode and native window material cannot be validated in the browser test page. Use browser tests only for DOM and CSS behavior that exists there; perform final geometry, blur, stacking, and hit-testing checks in the real Electron client.
- Before interpreting an unchanged client UI as a failed code change, prove which package is loaded. Check the profile dependency/link target, generated bundle timestamp or hash, loader entry, module registration name, and client restart. An independently named local override must register that same alias in both its host and client bundles; otherwise the embedded product plugin may remain active or the loader may reject the bundle.
- Keep `MutationObserver` callbacks convergent. Synchronizers must be idempotent, must not rewrite equal DOM state, and should observe only the attributes they actually consume. Add a DOM behavior test that lets observer delivery settle so feedback loops cannot freeze Electron's renderer.
- Chromium/OS native `select` popups cannot be made fully consistent with DOM listboxes. If replacing one, leave the controlled native select mounted as the source of truth, dispatch bubbling `input` and `change` events, preserve disabled/options state and keyboard behavior, and clean up every observer and listener.
- Separate regressions introduced by a diagnostic patch from the original report. A renderer freeze after adding an observer is not evidence for the original compositor bug.

Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `git diff --check` before release. Release tags must be `v<package.json version>` and are published by `.github/workflows/release.yml`.
