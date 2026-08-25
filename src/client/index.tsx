// tokens-core browser half. Ordinary DSH web-client plugin (loads under `dsh
// web`, not Desktop-only). Reshapes the DSH web UI in place:
//   - re-skins the whole app to the ELECTRO X look by overriding DSH's --dsw-*
//     tokens (theme/reskin.css)
//   - adds a persistent top capability nav + full-page capability views via the
//     `shell.overlay` slot (DSH exposes no frame-level nav slot; the nav band
//     rides a reserved top strip, the pages cover the main content area)
import type { ClientContext, ISessions } from "@deepseek-ai/dsh-client-runtime/client";
import type { ConnectionHandle } from "@deepseek-ai/dsh-api-remotes/client";
// Type-only slot-map merge for shell.overlay.
import type {} from "@deepseek-ai/dsh-client-ui-layout/client";
import type {} from "@deepseek-ai/dsh-client-ui-sidebar/client";
import type {} from "@deepseek-ai/dsh-client-ui-conversation/client";
import { injectTheme } from "./theme/inject.ts";
import { ThemePicker } from "./theme/ThemePicker.tsx";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import { CapabilityWorkspace, setCapabilityWorkspaceLayout } from "./shell/CapabilityWorkspace.tsx";
import type { ILayout } from "@deepseek-ai/dsh-client-ui-layout/client";
import { observeTokensCoworkHeadline, TokensBrandMark, TokensBrandName } from "./shell/BrandSlots.tsx";
import { registerBuiltinCapabilities } from "./shell/register-builtins.tsx";
import { registerCapability, listCapabilities } from "./shell/capability-registry.ts";
import { setSkillsRuntime } from "./modules/skills/data.ts";
import { setToolsBrowserRuntime } from "./modules/tools/browser.ts";
import { setAutomationRuntime } from "./modules/automation/data.ts";
import { observeStartupGate } from "./startup/StartupLoading.ts";
import { observeGlobalModals } from "./shell/surface-store.ts";

export const name = "dsh-tokensapi-ui";
// 'connection' + 'sessions' back the skills module's real catalog (skill.list
// RPC addressed by the current session); 'slots' backs the overlay + nav.
export const inject = ["slots", "connection", "sessions", "layout"];

/** Public capability API exposed to other plugins as `ctx.tokensWorkspace`. */
export interface TokensWorkspaceApi {
  registerCapability: typeof registerCapability;
  listCapabilities: typeof listCapabilities;
}

export function apply(ctx: ClientContext): void {
  setCapabilityWorkspaceLayout(ctx.get("layout") as ILayout);
  // Global theme: active tenant skin + DSH bridge (see theme/inject.ts).
  ctx.effect(() => injectTheme(), "tokens-core: theme");
  ctx.effect(() => observeStartupGate(), "tokens-core: startup loading");
  ctx.effect(() => observeGlobalModals(), "tokens-core: modal surface coordination");
  ctx.effect(() => observeTokensCoworkHeadline(), "tokens-core: hero brand copy");

  ctx.slots.inject("settings.general.item", () =>
    ctx.slots.register(
      { name: "settings.general.item", id: "tokens-theme-picker", order: 20 },
      ThemePicker,
    ),
  );

  // Use the shell's declared branding seats. In particular, the collapsed
  // mark remains inside DSH's native expand button, so its click lifecycle,
  // animation and responsive replacement behavior stay entirely upstream.
  ctx.slots.inject("sidebar.brand.mark", () => {
    try {
      return ctx.slots.register({ name: "sidebar.brand.mark" }, TokensBrandMark);
    } catch {
      // A host-provided single occupant must never prevent the rest of this
      // plugin (including the theme picker) from mounting.
      return () => {};
    }
  });
  ctx.slots.inject("sidebar.brand.name", () => {
    try {
      return ctx.slots.register({ name: "sidebar.brand.name" }, TokensBrandName);
    } catch {
      return () => {};
    }
  });
  ctx.slots.inject("conversation.hero.brand.mark", () => {
    try {
      return ctx.slots.register({ name: "conversation.hero.brand.mark" }, TokensBrandMark);
    } catch {
      return () => {};
    }
  });

  // Hand the skills module its data plane: the root-context connection (for the
  // official skill.list RPC) + the sessions feed (current session id). Captured
  // once here so module components never read services off a per-call argument.
  setSkillsRuntime({
    connection: ctx.get("connection") as ConnectionHandle,
    sessions: ctx.get("sessions") as unknown as ISessions,
  });
  setToolsBrowserRuntime(ctx.get("connection") as ConnectionHandle);
  setAutomationRuntime(ctx.get("connection") as ConnectionHandle);

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
