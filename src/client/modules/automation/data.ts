import type { ConnectionHandle } from "@deepseek-ai/dsh-api-remotes/client";

import type { AutomationResponses } from "../../../shared/automation-contract.ts";
export type { AutomationTask, AutomationRun, AutomationSnapshot } from "../../../shared/automation-contract.ts";

let connection: ConnectionHandle | null = null;
let runtimeOwner: symbol | undefined;
export function setAutomationRuntime(next: ConnectionHandle): () => void {
  const owner = Symbol();
  runtimeOwner = owner;
  connection = next;
  return () => {
    if (runtimeOwner !== owner) return;
    connection = null;
    runtimeOwner = undefined;
  };
}

export async function automationCall<E extends keyof AutomationResponses>(endpoint: E, payload: unknown = {}): Promise<AutomationResponses[E]> {
  if (connection === null) throw new Error("connection-unavailable");
  const result = await connection.rpc.call("/tokens-automation", endpoint, payload);
  if (!result.ok) throw new Error(result.error.message);
  return result.value as AutomationResponses[E];
}
