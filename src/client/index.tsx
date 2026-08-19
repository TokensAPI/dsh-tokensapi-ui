// tokens-core browser half. Ordinary DSH web-client plugin (loads under `dsh
// web`, not Desktop-only). Reshapes the DSH web UI in place:
//   - re-skins the whole app to the ELECTRO X look by overriding DSH's --dsw-*
//     tokens (theme/reskin.css)
//   - adds a persistent top capability nav + full-page capability views via the
//     `shell.overlay` slot (DSH exposes no frame-level nav slot; the nav band
//     rides a reserved top strip, the pages cover the main content area)
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
// Type-only slot-map merge for shell.overlay.
import type {} from "@deepseek-ai/dsh-client-ui-layout/client";
import { injectTheme } from "./theme/inject.ts";
import { CapabilityWorkspace } from "./shell/CapabilityWorkspace.tsx";
import { registerBuiltinCapabilities } from "./shell/register-builtins.tsx";
import { registerCapability, listCapabilities } from "./shell/capability-registry.ts";

export const name = "tokens-core";
export const inject = ["slots"];

/** Public capability API exposed to other plugins as `ctx.tokensWorkspace`. */
export interface TokensWorkspaceApi {
  registerCapability: typeof registerCapability;
  listCapabilities: typeof listCapabilities;
}

export function apply(ctx: ClientContext): void {
  // Global theme: active tenant skin + DSH bridge (see theme/inject.ts).
  ctx.effect(() => injectTheme(), "tokens-core: theme");

  // Capability registry: register the built-ins, and expose the API so
  // third-party plugins can add their own capability tabs.
  registerBuiltinCapabilities();
  const api: TokensWorkspaceApi = { registerCapability, listCapabilities };
  (ctx as { provide?: (key: string, value: unknown) => void }).provide?.("tokensWorkspace", api);

  // Persistent capability shell (top nav + pages) over the DSH frame.
  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      { name: "shell.overlay", id: "tokens-core-workspace", order: 10 },
      CapabilityWorkspace,
    ),
  );
}
