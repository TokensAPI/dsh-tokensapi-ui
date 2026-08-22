import { installModelSelection, type AgentRegistry } from "@deepseek-ai/dsh-agent"
import { createUserMessage } from "@deepseek-ai/dsh-llm"
import { SessionId } from "@deepseek-ai/dsh-session"
import type { Context } from "@deepseek-ai/cordis"
import type { AutomationTask } from "./automation-host.ts"

export interface AutomationExecutionResult { status: "成功" | "失败"; result: string; sessionId?: string }

function lastAssistantText(events: readonly { type: string; data: unknown }[]): string {
  let text = ""
  for (const event of events) {
    if (event.type !== "assistant/message") continue
    const blocks = (event.data as { message?: { content?: { type: string; text?: string }[] } }).message?.content ?? []
    const candidate = blocks.filter((block) => block.type === "text").map((block) => block.text ?? "").join("").trim()
    if (candidate !== "") text = candidate
  }
  return text
}

function lastTurnReason(events: readonly { type: string; data: unknown }[]): { kind?: string; error?: { message?: string } } | undefined {
  let reason: { kind?: string; error?: { message?: string } } | undefined
  for (const event of events) if (event.type === "turn/end") reason = (event.data as { reason?: typeof reason }).reason
  return reason
}

export class DshAutomationExecutor {
  constructor(private readonly ctx: Context, private readonly timeoutMs = 5 * 60_000) {}

  async execute(task: AutomationTask): Promise<AutomationExecutionResult> {
    const agents = this.ctx.get("agents") as AgentRegistry | undefined
    const presets = this.ctx.get("agentPresets") as {
      resolve(id?: string): Promise<{ id: string }>
      mount(ctx: Context, id: string): Promise<unknown>
    } | undefined
    const defaultModel = this.ctx.get("agentDefaultModel") as {
      currentSelection(): { provider: string; model: string } | undefined
    } | undefined
    if (agents === undefined || presets === undefined) return { status: "失败", result: "Agent 服务或预设服务不可用。" }
    const selection = defaultModel?.currentSelection()
    if (selection === undefined) return { status: "失败", result: "尚未配置可用于自动化任务的默认模型。" }

    const sessionId = SessionId(`tokens-automation-${crypto.randomUUID()}`)
    const preset = await presets.resolve(undefined)
    const handle = await agents.create({
      sessionId,
      meta: { cwd: task.projectPath ?? process.cwd(), agentPreset: preset.id },
      agentOptions: selection,
      setup: async (agentCtx) => {
        installModelSelection(agentCtx, { current: selection, assembled: undefined })
        await presets.mount(agentCtx, preset.id)
      },
    })
    const deadline = async <T>(promise: Promise<T>): Promise<T> => {
      let timer: NodeJS.Timeout | undefined
      try {
        return await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`任务执行超过 ${Math.round(this.timeoutMs / 1000)} 秒`)), this.timeoutMs)
            timer.unref?.()
          }),
        ])
      } finally { if (timer !== undefined) clearTimeout(timer) }
    }
    try {
      await deadline(handle.agent.whenIdle())
      handle.agent.followup(createUserMessage({
        content: [{ type: "text", text: task.description.trim() || task.name }],
        source: { kind: "plugin", plugin: "tokens-automation" },
      }))
      await deadline(handle.agent.whenIdle())
      const result = lastAssistantText(handle.agent.session.events)
      const reason = lastTurnReason(handle.agent.session.events)
      if (reason?.kind !== "completed") {
        return { status: "失败", result: reason?.error?.message ?? `Agent 运行未正常完成：${reason?.kind ?? "unknown"}`, sessionId }
      }
      return { status: result === "" ? "失败" : "成功", result: result || "Agent 已结束运行，但没有生成文本结果。", sessionId }
    } catch (error) {
      return { status: "失败", result: error instanceof Error ? error.message : String(error), sessionId }
    } finally {
      await handle.dispose().catch(() => {})
    }
  }
}
