import type { ConnectionHandle } from "@deepseek-ai/dsh-api-remotes/client";

let connection: ConnectionHandle | null = null;

export function setToolsBrowserRuntime(next: ConnectionHandle): void {
  connection = next;
}

export interface BrowserBounds { x: number; y: number; width: number; height: number }

async function call(endpoint: string, payload: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  if (connection === null) return { ok: false, message: "connection-unavailable" };
  try {
    const result = await connection.rpc.call("/tokens-browser", endpoint, payload);
    return result.ok ? { ok: true } : { ok: false, message: result.error.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function mountToolBrowser(url: string, bounds: BrowserBounds): Promise<{ ok: true } | { ok: false; message: string }> {
  return call("mount", { url, bounds });
}

export function updateToolBrowserBounds(bounds: BrowserBounds): Promise<{ ok: true } | { ok: false; message: string }> {
  return call("bounds", { bounds });
}

export function hideToolBrowser(): Promise<{ ok: true } | { ok: false; message: string }> {
  return call("hide", {});
}
