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
  }, [sessionId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}

/**
 * Copy the skill's slash command (`/name `) to the clipboard. Pasting and
 * sending it runs the skill through the deterministic slash pipeline exactly as
 * a typed line (host-side `dsh-tool-skill`), same as the reference plugin.
 */
export async function copySkillCommand(name: string): Promise<boolean> {
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
