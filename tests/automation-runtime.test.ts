import type { ConnectionHandle } from "@deepseek-ai/dsh-api-remotes/client";
import { expect, it, vi } from "vitest";
import { automationCall, setAutomationRuntime } from "../src/client/modules/automation/data.ts";

it("binds RPC to the current owner, even when owners reuse the same connection", async () => {
  const call = vi.fn(async () => ({ ok: true, value: { version: 1, revision: 0, tasks: [], runs: [] } }));
  const connection = { rpc: { call } } as unknown as ConnectionHandle;
  const first = setAutomationRuntime(connection);
  const second = setAutomationRuntime(connection);
  try {
    first(); first();
    expect(await automationCall("snapshot")).toMatchObject({ version: 1 });
    expect(call).toHaveBeenCalledWith("/tokens-automation", "snapshot", {});
    second(); second();
    await expect(automationCall("snapshot")).rejects.toThrow("connection-unavailable");
  } finally { first(); second(); }
});
