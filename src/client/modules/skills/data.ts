// Skills data plane. Ports the read side of the reference skill plaza plugin
// (plugins/tokens_DshSkillsUI_code): the catalog rides the official `skill.list`
// RPC addressed by the current session — no dependency on that plugin's private
// '/skill-plaza' host channel (its node half is an empty apply). Write verbs
// (upload/delete) and SKILL.md bodies need that channel and are deferred.
//
// The connection + sessions services are captured once at plugin apply
// (setSkillsRuntime) so components never read services off a per-call argument
// — the same root-context pattern as packages/client/ui-skill.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ConnectionHandle, SessionId, SkillEntry } from "@deepseek-ai/dsh-api-remotes/client";
import type { ISessions } from "@deepseek-ai/dsh-client-runtime/client";
import { workspace } from "../../shell/workspace-store.ts";

export type { SkillEntry } from "@deepseek-ai/dsh-api-remotes/client";

interface SkillsRuntime {
  connection: ConnectionHandle;
  sessions: ISessions;
}

let runtime: SkillsRuntime | null = null;

/** Capture the connection + sessions services at plugin apply. */
export function setSkillsRuntime(next: SkillsRuntime): void {
  runtime = next;
}

/** Subscribe to the current (selected) session id; null when no session is open. */
export function useCurrentSessionId(): SessionId | null {
  const sessions = runtime?.sessions ?? null;
  return useSyncExternalStore(
    (onChange) => (sessions ? sessions.list.subscribe(onChange) : () => {}),
    () => sessions?.list.getSnapshot().current ?? null,
    () => null,
  );
}

/** Catalog request lifecycle for one session. */
export type CatalogState =
  | { phase: "no-session" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; skills: readonly SkillEntry[] };

/**
 * Fetch the session's user-invocable skill catalog via the official skill.list
 * RPC (one call per session/reload). Mirrors ui-skill's ok-check.
 */
export function useSkillCatalog(sessionId: SessionId | null): {
  state: CatalogState;
  reload: () => void;
} {
  const [state, setState] = useState<CatalogState>(
    sessionId === null ? { phase: "no-session" } : { phase: "loading" },
  );
  const [nonce, setNonce] = useState(0);
  const revision = useSkillsRevision();

  useEffect(() => {
    if (sessionId === null) {
      setState({ phase: "no-session" });
      return;
    }
    const connection = runtime?.connection ?? null;
    if (connection === null) {
      setState({ phase: "error", message: "connection unavailable" });
      return;
    }
    let cancelled = false;
    setState({ phase: "loading" });
    connection.api.skills
      .list({ sessionId })
      .then(({ result }) => {
        if (cancelled) return;
        if (!result.ok) {
          setState({ phase: "error", message: `${result.error.code}: ${result.error.message}` });
          return;
        }
        setState({ phase: "ready", skills: result.value.skills });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ phase: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, nonce, revision]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}

/**
 * Copy the skill's slash command (`/name `) to the clipboard. Pasting and
 * sending it runs the skill through the deterministic slash pipeline exactly as
 * a typed line (host-side `dsh-tool-skill`), same as the reference plugin.
 */
export async function copySkillCommand(name: string): Promise<boolean> {
  return copyCommandImpl(name);
}

// ── Write plane: the '/tokens-skills' host channel (install/delete over the
// user skill root + curated bundled skills). Mutations bump a shared revision
// so the catalog / owned / bundled hooks all refetch. ──────────────────────

/** One curated skill shipped with the plugin. */
export interface BundledSkill {
  name: string;
  description: string;
  installed: boolean;
}

/** Structured install/upload outcome (code carries the host's semantic reason). */
export type WriteResult = { ok: true; name: string } | { ok: false; code: string };

let revision = 0;
const revListeners = new Set<() => void>();

/** Bump after any successful write so all skills hooks refetch. */
export function bumpSkillsRevision(): void {
  revision += 1;
  for (const listener of revListeners) listener();
}

function useSkillsRevision(): number {
  return useSyncExternalStore(
    (onChange) => {
      revListeners.add(onChange);
      return () => revListeners.delete(onChange);
    },
    () => revision,
    () => 0,
  );
}

/** Call one '/tokens-skills' endpoint, returning the raw RpcResult. */
async function channel(
  endpoint: string,
  payload: unknown,
): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  const connection = runtime?.connection ?? null;
  if (connection === null) return { ok: false, message: "connection-unavailable" };
  const result = await connection.rpc.call("/tokens-skills", endpoint, payload);
  return result.ok ? { ok: true, value: result.value } : { ok: false, message: result.error.message };
}

/** Read a picked file as base64 (upload wire form; chunked for large files). */
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Install a shared SKILL.md or zip bundle into the user skill root. */
export async function uploadSkillFile(file: File, overwrite = false): Promise<WriteResult> {
  const data = await fileToBase64(file);
  const result = await channel("skills/upload", { fileName: file.name, data, overwrite });
  if (!result.ok) return { ok: false, code: result.message };
  bumpSkillsRevision();
  return { ok: true, name: (result.value as { name: string }).name };
}

/** Install one plugin-bundled curated skill into the user skill root. */
export async function installBundled(name: string, overwrite = false): Promise<WriteResult> {
  const result = await channel("bundled/install", { name, overwrite });
  if (!result.ok) return { ok: false, code: result.message };
  bumpSkillsRevision();
  return { ok: true, name };
}

/** Delete one user-root skill directory. */
export async function deleteSkill(name: string): Promise<WriteResult> {
  const result = await channel("skills/delete", { name });
  if (!result.ok) return { ok: false, code: result.message };
  bumpSkillsRevision();
  return { ok: true, name };
}

/** Names of skills living in the user root — the ones this plugin may delete. */
export function useOwnedSkills(): ReadonlySet<string> {
  const rev = useSkillsRevision();
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    channel("skills/inventory", {}).then((result) => {
      if (cancelled || !result.ok) return;
      const names = (result.value as { skills: { name: string }[] }).skills.map((s) => s.name);
      setOwned(new Set(names));
    });
    return () => {
      cancelled = true;
    };
  }, [rev]);
  return owned;
}

/** The plugin's curated skills with their installed state. */
export function useBundledSkills(): readonly BundledSkill[] {
  const rev = useSkillsRevision();
  const [skills, setSkills] = useState<readonly BundledSkill[]>([]);
  useEffect(() => {
    let cancelled = false;
    channel("bundled/list", {}).then((result) => {
      if (cancelled || !result.ok) return;
      setSkills((result.value as { skills: BundledSkill[] }).skills);
    });
    return () => {
      cancelled = true;
    };
  }, [rev]);
  return skills;
}

/**
 * Prefill the DSH composer with `/name ` and focus it. Uses the native value
 * setter + an input event so the controlled React input adopts the value and the
 * slash pipeline arms (a plain `.value =` would not notify React).
 */
export function insertSkillCommand(name: string): boolean {
  const area = document.querySelector<HTMLTextAreaElement>("[data-composer-card] textarea") ??
    document.querySelector<HTMLTextAreaElement>("textarea");
  if (area === null) return false;
  const text = `/${name} `;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter !== undefined) setter.call(area, text);
  else area.value = text;
  area.dispatchEvent(new Event("input", { bubbles: true }));
  area.focus();
  try {
    area.setSelectionRange(text.length, text.length);
  } catch {
    // Some browsers reject setSelectionRange on certain states; harmless.
  }
  return true;
}

export type UseSkillResult = "ready" | "no-session" | "composer-unavailable";

/** Close the skills workspace and prefill the active task's composer. */
export async function useSkillInCurrentTask(name: string): Promise<UseSkillResult> {
  const current = runtime?.sessions.list.getSnapshot().current ?? null;
  if (current === null) {
    showSkillCoach("请先新建或选择一个任务，再使用该技能");
    return "no-session";
  }
  workspace.close();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (insertSkillCommand(name)) {
      showSkillCoach(`已为你填入 /${name}，补充需求后按回车即可调用`);
      return "ready";
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
  }
  showSkillCoach("未找到当前任务的输入框，请稍后重试");
  return "composer-unavailable";
}

/**
 * Transient bottom-centre coaching toast. Rendered straight to <body> so it
 * survives the capability overlay closing (the composer lives behind it).
 */
export function showSkillCoach(message: string): void {
  const id = "tokens-skill-coach";
  document.getElementById(id)?.remove();
  const tip = document.createElement("div");
  tip.id = id;
  tip.dataset.theme = "electrox";
  tip.textContent = message;
  tip.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:104px",
    "transform:translateX(-50%)",
    "z-index:70",
    "max-width:560px",
    "padding:12px 18px",
    "background:var(--theme-bg-surface-raised)",
    "color:var(--theme-fg-primary)",
    "border:1px solid var(--theme-border-strong)",
    "border-left:3px solid var(--theme-accent-primary)",
    "font-size:13px",
    "line-height:20px",
    "box-shadow:0 16px 48px -14px rgba(0,0,0,0.65)",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(tip);
  window.setTimeout(() => tip.remove(), 5600);
}

async function copyCommandImpl(name: string): Promise<boolean> {
  const text = `/${name} `;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts / missing async clipboard.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
