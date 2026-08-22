import { installModelSelection, type AgentRegistry } from "@deepseek-ai/dsh-agent"
import { createAssistantMessage } from "@deepseek-ai/dsh-llm"
import { SessionId, type Session } from "@deepseek-ai/dsh-session"
import type { Context } from "@deepseek-ai/cordis"
import type { AutomationDelivery, AutomationRun, AutomationTask } from "./automation-host.ts"

function appendResult(session: Session, task: AutomationTask, run: AutomationRun): string {
  const turn = (session.events.findLast((event) => event.type === "turn/start")?.data.turn ?? 0) + 1
  const heading = run.executionStatus === "succeeded" ? `自动化任务「${task.name}」已完成` : `自动化任务「${task.name}」执行失败`
  session.append("turn/start", { turn })
  session.append("step/start", { turn, step: 1 })
  const event = session.append("assistant/message", {
    turn,
    step: 1,
    message: createAssistantMessage({
      content: [{ type: "text", text: `${heading}\n\n${run.result}` }],
      source: { provider: "tokens-automation", model: "delivery" },
    }),
  }, { surfaceOp: "append" })
  session.append("step/end", { turn, step: 1 })
  session.append("turn/end", { turn, reason: { kind: "completed" } })
  return event.data.message.id
}

export class DshAutomationDelivery implements AutomationDelivery {
  constructor(private readonly ctx: Context) {}

  async deliver(task: AutomationTask, run: AutomationRun) {
    if (task.delivery.mode === "silent") return { status: "skipped" as const }
    if (run.executionStatus === "succeeded" && !task.delivery.notifyOnSuccess) return { status: "skipped" as const }
    if (run.executionStatus === "failed" && !task.delivery.notifyOnFailure) return { status: "skipped" as const }
    if (task.delivery.mode !== "origin_chat" || task.originSessionId === undefined) {
      return { status: "delivered" as const }
    }
    const agents = this.ctx.get("agents") as AgentRegistry | undefined
    const sessions = this.ctx.get("sessions") as { flush(session: Session): Promise<boolean> } | undefined
    if (agents === undefined || sessions === undefined) return { status: "failed" as const, error: "会话服务不可用，结果已保留在自动化运行记录中。" }
    const id = SessionId(task.originSessionId)
    const live = agents.get(id)
    if (live !== undefined) {
      await live.whenIdle()
      const messageId = appendResult(live.session, task, run)
      await sessions.flush(live.session)
      return { status: "delivered" as const, sessionId: id, messageId }
    }

    const presets = this.ctx.get("agentPresets") as { resolve(id?: string): Promise<{ id: string }>; mount(ctx: Context, id: string): Promise<unknown> } | undefined
    const defaultModel = this.ctx.get("agentDefaultModel") as { currentSelection(): { provider: string; model: string } | undefined } | undefined
    const selection = defaultModel?.currentSelection()
    if (presets === undefined || selection === undefined) return { status: "failed" as const, error: "无法恢复原对话，结果已保留在自动化运行记录中。" }
    const preset = await presets.resolve(undefined)
    const handle = await agents.resume({
      resumeSessionId: id,
      agentOptions: selection,
      setup: async (agentCtx) => {
        installModelSelection(agentCtx, { current: selection, assembled: undefined })
        await presets.mount(agentCtx, preset.id)
      },
    })
    try {
      await handle.agent.whenIdle()
      const messageId = appendResult(handle.agent.session, task, run)
      await sessions.flush(handle.agent.session)
      return { status: "delivered" as const, sessionId: id, messageId }
    } catch (error) {
      return { status: "failed" as const, error: error instanceof Error ? error.message : String(error) }
    } finally {
      await handle.dispose().catch(() => {})
    }
  }
}
