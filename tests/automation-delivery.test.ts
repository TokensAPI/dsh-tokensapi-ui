import { describe, expect, it, vi } from "vitest"
import type { Context } from "@deepseek-ai/cordis"
import { Session, SessionId } from "@deepseek-ai/dsh-session"
import { DshAutomationDelivery } from "../src/automation-delivery.ts"
import type { AutomationRun, AutomationTask } from "../src/automation-host.ts"

const task: AutomationTask = {
  id: "task-1", name: "BTC 价格", description: "查询 BTC", frequency: "每天", time: "08:30",
  agent: "当前 Agent", skill: "暂不选择", enabled: true, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
  originSessionId: "chat-1", delivery: { mode: "origin_chat", desktopNotification: false, notifyOnSuccess: true, notifyOnFailure: true },
}
const run: AutomationRun = {
  id: "run-1", taskId: task.id, taskName: task.name, ranAt: new Date(0).toISOString(), status: "成功", result: "BTC 当前为 123 USD",
  trigger: "schedule", executionStatus: "succeeded", deliveryStatus: "pending",
}

describe("DshAutomationDelivery", () => {
  it("appends a durable assistant result to the live origin chat", async () => {
    const session = Session.create(SessionId("chat-1"))
    const flush = vi.fn(async () => true)
    const services: Record<string, unknown> = {
      agents: { get: () => ({ session, whenIdle: async () => {} }) },
      sessions: { flush },
    }
    const ctx = { get: (name: string) => services[name] } as unknown as Context
    const result = await new DshAutomationDelivery(ctx).deliver(task, run)
    expect(result).toMatchObject({ status: "delivered", sessionId: "chat-1" })
    expect(flush).toHaveBeenCalledWith(session)
    const message = session.events.find((event) => event.type === "assistant/message")
    expect(message?.type === "assistant/message" && message.data.message.content[0]).toMatchObject({ text: expect.stringContaining("BTC 当前为 123 USD") })
    expect(session.events.at(-1)?.type).toBe("turn/end")
  })

  it("skips silent delivery", async () => {
    const ctx = { get: vi.fn() } as unknown as Context
    const result = await new DshAutomationDelivery(ctx).deliver({ ...task, delivery: { ...task.delivery, mode: "silent" } }, run)
    expect(result.status).toBe("skipped")
    expect(ctx.get).not.toHaveBeenCalled()
  })
})
