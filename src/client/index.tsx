// DSH web/Desktop client: skin injection, host adapters and capability slots.
// Clean uses host geometry; the partner shell reserves space only while mounted.
import type { ClientContext, ISessions } from "@deepseek-ai/dsh-client-runtime/client";
import type { ConnectionHandle } from "@deepseek-ai/dsh-api-remotes/client";
// Type-only slot-map merge for shell.overlay.
import type {} from "@deepseek-ai/dsh-client-ui-layout/client";
import type {} from "@deepseek-ai/dsh-client-ui-sidebar/client";
import type {} from "@deepseek-ai/dsh-client-ui-conversation/client";
import { injectTheme, setActiveSkin } from "./theme/inject.ts";
import { observeOrganizationTheme } from "./theme/organization-theme.ts";
import { THEME_CHANNEL } from "../shared/organization-theme.ts";
import { CapabilityPanel, CapabilityWorkspace, setCapabilityWorkspaceLayout } from "./shell/CapabilityWorkspace.tsx";
import { installCapabilityNavigation } from "./shell/native-capability-navigation.ts";
import type { ILayout } from "@deepseek-ai/dsh-client-ui-layout/client";
import { observeTokensCoworkHeadline, TokensBrandMark, TokensBrandName } from "./shell/BrandSlots.tsx";
import { observeTurnStatus } from "./shell/turn-status.ts";
import { registerBuiltinCapabilities } from "./shell/register-builtins.tsx";
import { registerCapability, listCapabilities } from "./shell/capability-registry.ts";
import { setSkillsRuntime, type SkillsRemote } from "./modules/skills/data.ts";
import { observeStartupGate } from "./startup/StartupLoading.ts";
import { observeDesktopSettingsSelect } from "./theme/desktop-select.ts";
import { observeFocusModality } from "./theme/focus-modality.ts";
import { LocalThemePreview } from "./theme/LocalThemePreview.tsx";
import { setNativeScheduleLayout } from "./modules/automation/native-schedule.ts";

export const name = "dsh-tokensapi-ui";
// 'connection' + 'sessions' back the skills module's real catalog (skill.list
// RPC addressed by the current session); 'slots' backs the overlay + nav.
export const inject = ["slots", "connection", "sessions", "layout", "remote", "remote.skills"];

/** Public capability API exposed to other plugins as `ctx.tokensWorkspace`. */
export interface TokensWorkspaceApi {
  registerCapability: typeof registerCapability;
  listCapabilities: typeof listCapabilities;
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => setNativeScheduleLayout(ctx.get("layout")), "tokens-core: native automation navigation");

  if (typeof __TOKENS_LOCAL_THEME_PREVIEW__ !== "undefined" && __TOKENS_LOCAL_THEME_PREVIEW__) {
    ctx.slots.inject("settings.general.item", () => ctx.slots.register(
      { name: "settings.general.item", id: "tokens-local-theme-preview", order: 90 },
      LocalThemePreview,
    ));
  }
  ctx.effect(() => setCapabilityWorkspaceLayout(ctx.get("layout") as ILayout), "tokens-core: layout runtime");
  // Global theme: active tenant skin + DSH bridge (see theme/inject.ts).
  ctx.effect(() => injectTheme(), "tokens-core: theme");
  ctx.effect(() => observeOrganizationTheme({
    read: async () => {
      const connection = ctx.get("connection") as ConnectionHandle;
      const result = await connection.rpc.call(THEME_CHANNEL, "snapshot", {});
      if (!result.ok) throw new Error("organization theme unavailable");
      return result.value;
    },
    onCredentialChange: (listener) => ctx.remote.$on("credentials/reference-updated", listener),
    onConnectionReset: (listener) => ctx.on("connection/reset", listener),
  }, setActiveSkin), "tokens-core: organization theme");
  ctx.effect(() => observeFocusModality(), "tokens-core: dialog trigger focus");
  ctx.effect(() => observeStartupGate(), "tokens-core: startup loading");
  ctx.effect(() => observeDesktopSettingsSelect(), "tokens-core: desktop settings select");
  ctx.effect(() => observeTokensCoworkHeadline(), "tokens-core: hero brand copy");
  ctx.effect(() => observeTurnStatus(), "tokens-core: turn status copy");

  // Use the shell's declared branding seats. In particular, the collapsed
  // mark remains inside DSH's native expand button, so its click lifecycle,
  // animation and responsive replacement behavior stay entirely upstream.
  ctx.slots.inject("sidebar.brand.mark", () => {
    try {
      return ctx.slots.register({ name: "sidebar.brand.mark" }, TokensBrandMark);
    } catch {
      // A host-provided single occupant must never prevent the rest of this
      // plugin from mounting.
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
  ctx.effect(() => setSkillsRuntime({
    connection: ctx.get("connection") as ConnectionHandle,
    remoteSkills: (ctx as unknown as { remote: { skills: SkillsRemote } }).remote.skills,
    sessions: ctx.get("sessions") as unknown as ISessions,
  }), "tokens-core: skills runtime");

  // Capability registry: register the built-ins, and expose the API so
  // third-party plugins can add their own capability tabs.
  ctx.effect(() => registerBuiltinCapabilities(), "tokens-core: built-in capabilities");
  // DSH 0.2 public keyed main seat; the bundled development SDK is still 0.1.
  const mainSlots = ctx.slots as unknown as {
    inject(name: "main", setup: () => () => void): void;
    register(options: { name: "main"; key: string }, view: () => React.JSX.Element): () => void;
  };
  if (typeof (ctx.get("layout") as { selectPanel?: unknown }).selectPanel === "function") {
    mainSlots.inject("main", () => installCapabilityNavigation(ctx.get("layout"), (id, capability) =>
      mainSlots.register({ name: "main", key: id }, () => <CapabilityPanel capability={capability} />),
    ));
  }
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
