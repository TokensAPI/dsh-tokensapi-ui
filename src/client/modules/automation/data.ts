import type { ConnectionHandle } from "@deepseek-ai/dsh-api-remotes/client";

export interface AutomationTask {
  id: string; name: string; description: string; frequency: "仅一次" | "每天" | "每周" | "每月";
  time: string; agent: string; skill: string; enabled: boolean; createdAt: string; updatedAt: string; nextRunAt?: string; originSessionId?: string;
  delivery: { mode: "origin_chat" | "new_chat" | "inbox" | "silent"; desktopNotification: boolean; notifyOnSuccess: boolean; notifyOnFailure: boolean };
}
export interface AutomationRun {
  id: string; taskId: string; taskName: string; ranAt: string; status: "运行中" | "成功" | "失败";
  result: string; trigger: "schedule" | "manual";
  executionStatus: "running" | "succeeded" | "failed"; deliveryStatus: "pending" | "delivered" | "failed" | "skipped";
  deliveredSessionId?: string; deliveredMessageId?: string; deliveryError?: string;
}
export interface AutomationSnapshot { version: 1; revision: number; tasks: AutomationTask[]; runs: AutomationRun[] }

let connection: ConnectionHandle | null = null;
export function setAutomationRuntime(next: ConnectionHandle): void { connection = next; }

export async function automationCall<T>(endpoint: string, payload: unknown = {}): Promise<T> {
  if (connection === null) throw new Error("connection-unavailable");
  const result = await connection.rpc.call("/tokens-automation", endpoint, payload);
  if (!result.ok) throw new Error(result.error.message);
  return result.value as T;
}
