import { describe, expect, it, vi } from "vitest"
import type { Context } from "@deepseek-ai/cordis"
import { DshAutomationExecutor } from "../src/automation-executor.ts"
import type { AutomationTask } from "../src/automation-host.ts"

const task: AutomationTask = {
  id: "task-1", name: "BTC 价格", description: "查询当前 BTC 价格", frequency: "每天", time: "08:30",
  agent: "当前 Agent", skill: "暂不选择", enabled: true, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
}

function fakeContext(options: { completed?: boolean; text?: string } = {}): { ctx: Context; followup: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> } {
  const events: { type: string; data: unknown }[] = []
  const followup = vi.fn(() => {
    if (options.text !== undefined) events.push({ type: "assistant/message", data: { message: { content: [{ type: "text", text: options.text }] } } })
    events.push({ type: "turn/end", data: { reason: { kind: options.completed === false ? "blocked" : "completed" } } })
  })
  const dispose = vi.fn(async () => {})
  const services: Record<string, unknown> = {
    agents: { create: vi.fn(async () => ({ agent: { whenIdle: async () => {}, followup, session: { events } }, dispose })) },
    agentPresets: { resolve: vi.fn(async () => ({ id: "standard" })), mount: vi.fn(async () => {}) },
    agentDefaultModel: { currentSelection: () => ({ provider: "tokens", model: "default" }) },
  }
  return { ctx: { get: (name: string) => services[name] } as unknown as Context, followup, dispose }
}

describe("DshAutomationExecutor", () => {
  it("runs the task prompt in a fresh agent and captures its final text", async () => {
    const { ctx, followup, dispose } = fakeContext({ text: "BTC 当前为 123 USD" })
    const result = await new DshAutomationExecutor(ctx, 1_000).execute(task)
    expect(result).toMatchObject({ status: "成功", result: "BTC 当前为 123 USD" })
    expect(followup).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it("does not report blocked agent turns as successful", async () => {
    const { ctx } = fakeContext({ completed: false, text: "需要授权" })
    const result = await new DshAutomationExecutor(ctx, 1_000).execute(task)
    expect(result.status).toBe("失败")
    expect(result.result).toContain("blocked")
  })
})
