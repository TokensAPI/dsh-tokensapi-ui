import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export interface AutomationTask {
  id: string
  name: string
  description: string
  frequency: "仅一次" | "每天" | "每周" | "每月"
  time: string
  agent: string
  skill: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  nextRunAt?: string
  projectPath?: string
  originSessionId?: string
  delivery: AutomationDeliveryOptions
}

export type AutomationDeliveryMode = "origin_chat" | "new_chat" | "inbox" | "silent"
export interface AutomationDeliveryOptions {
  mode: AutomationDeliveryMode
  desktopNotification: boolean
  notifyOnSuccess: boolean
  notifyOnFailure: boolean
}

export interface AutomationRun {
  id: string
  taskId: string
  taskName: string
  ranAt: string
  status: "运行中" | "成功" | "失败"
  result: string
  trigger: "schedule" | "manual"
  sessionId?: string
  executionStatus: "running" | "succeeded" | "failed"
  deliveryStatus: "pending" | "delivered" | "failed" | "skipped"
  deliveredSessionId?: string
  deliveredMessageId?: string
  deliveryError?: string
}

export interface AutomationExecutor {
  execute(task: AutomationTask): Promise<{ status: "成功" | "失败"; result: string; sessionId?: string }>
}

export interface AutomationDelivery {
  deliver(task: AutomationTask, run: AutomationRun): Promise<{
    status: "delivered" | "failed" | "skipped"
    sessionId?: string
    messageId?: string
    error?: string
  }>
}

interface Ledger { version: 1; revision: number; tasks: AutomationTask[]; runs: AutomationRun[] }
type Result<T = unknown> = { ok: true; value: T } | { ok: false; error: { code: string; message: string; details: Record<string, unknown> } }

const EMPTY: Ledger = { version: 1, revision: 0, tasks: [], runs: [] }
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function failure(code: string, message: string): Result<never> {
  return { ok: false, error: { code, message, details: {} } }
}

function automationDir(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "tokens-automation")
}

function nextRun(task: Pick<AutomationTask, "frequency" | "time">, from = new Date()): string | undefined {
  if (!TIME.test(task.time)) return undefined
  const [hour, minute] = task.time.split(":").map(Number)
  const candidate = new Date(from)
  candidate.setSeconds(0, 0)
  candidate.setHours(hour!, minute!, 0, 0)
  if (candidate.getTime() <= from.getTime()) {
    if (task.frequency === "仅一次") candidate.setDate(candidate.getDate() + 1)
    else if (task.frequency === "每天") candidate.setDate(candidate.getDate() + 1)
    else if (task.frequency === "每周") candidate.setDate(candidate.getDate() + 7)
    else candidate.setMonth(candidate.getMonth() + 1)
  }
  return candidate.toISOString()
}

export class AutomationHost {
  private ledger: Ledger = structuredClone(EMPTY)
  private timer: NodeJS.Timeout | undefined
  private writeChain: Promise<void> = Promise.resolve()
  private startPromise: Promise<void> | undefined
  private readonly file: string
  private readonly inFlight = new Set<string>()

  private readonly now: () => number
  private readonly pollIntervalMs: number

  constructor(private readonly executor: AutomationExecutor, options: { file?: string; now?: () => number; pollIntervalMs?: number } = {}, private readonly delivery?: AutomationDelivery) {
    this.file = options.file ?? join(automationDir(), "ledger-v1.json")
    this.now = options.now ?? Date.now
    this.pollIntervalMs = options.pollIntervalMs ?? 15_000
  }

  start(): Promise<void> {
    this.startPromise ??= this.load()
    return this.startPromise
  }

  private async load(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    try {
      const value = JSON.parse(await readFile(this.file, "utf8")) as Partial<Ledger>
      if (value.version === 1 && Array.isArray(value.tasks) && Array.isArray(value.runs)) {
        this.ledger = {
          version: 1,
          revision: Number(value.revision) || 0,
          tasks: value.tasks.map((task) => ({
            ...task,
            delivery: task.delivery ?? {
              mode: task.originSessionId === undefined ? "inbox" : "origin_chat",
              desktopNotification: false,
              notifyOnSuccess: true,
              notifyOnFailure: true,
            },
          })),
          runs: value.runs.map((run) => ({
            ...run,
            executionStatus: run.executionStatus ?? (run.status === "运行中" ? "running" : run.status === "成功" ? "succeeded" : "failed"),
            deliveryStatus: run.deliveryStatus ?? "skipped",
          })),
        }
      }
    } catch {
      this.ledger = structuredClone(EMPTY)
    }
    this.arm()
  }

  dispose(): void { if (this.timer !== undefined) clearTimeout(this.timer) }

  private arm(): void {
    this.timer = setTimeout(() => { void this.tick().finally(() => this.arm()) }, this.pollIntervalMs)
    this.timer.unref?.()
  }

  private async tick(): Promise<void> {
    const now = this.now()
    const due = this.ledger.tasks.filter((task) => task.enabled && task.nextRunAt !== undefined && Date.parse(task.nextRunAt) <= now)
    for (const task of due) await this.run(task, "schedule")
  }

  private persist(): Promise<void> {
    const body = JSON.stringify(this.ledger, null, 2)
    this.writeChain = this.writeChain.then(async () => {
      const temp = `${this.file}.${process.pid}.tmp`
      await writeFile(temp, body, { encoding: "utf8", mode: 0o600 })
      await rename(temp, this.file)
    })
    return this.writeChain
  }

  private snapshot() { return structuredClone(this.ledger) }

  private async commit(): Promise<void> {
    this.ledger.revision += 1
    await this.persist()
  }

  private async run(task: AutomationTask, trigger: AutomationRun["trigger"]): Promise<AutomationRun> {
    if (this.inFlight.has(task.id)) throw Object.assign(new Error("任务正在运行。"), { code: "task-busy" })
    this.inFlight.add(task.id)
    const ranAt = new Date(this.now()).toISOString()
    const run: AutomationRun = {
      id: crypto.randomUUID(), taskId: task.id, taskName: task.name, ranAt,
      status: "运行中", trigger, result: "Agent 正在执行任务。",
      executionStatus: "running", deliveryStatus: "pending",
    }
    this.ledger.runs.unshift(run)
    this.ledger.runs = this.ledger.runs.slice(0, 500)
    if (task.frequency === "仅一次") { task.enabled = false; task.nextRunAt = undefined }
    else task.nextRunAt = nextRun(task, new Date(this.now() + 1_000))
    task.updatedAt = ranAt
    await this.commit()
    try {
      const outcome = await this.executor.execute(structuredClone(task))
      run.status = outcome.status
      run.result = outcome.result
      run.sessionId = outcome.sessionId
      run.executionStatus = outcome.status === "成功" ? "succeeded" : "failed"
    } catch (error) {
      run.status = "失败"
      run.result = error instanceof Error ? error.message : String(error)
      run.executionStatus = "failed"
    } finally {
      this.inFlight.delete(task.id)
      if (this.delivery === undefined) run.deliveryStatus = "skipped"
      else {
        try {
          const delivered = await this.delivery.deliver(structuredClone(task), structuredClone(run))
          run.deliveryStatus = delivered.status
          run.deliveredSessionId = delivered.sessionId
          run.deliveredMessageId = delivered.messageId
          run.deliveryError = delivered.error
        } catch (error) {
          run.deliveryStatus = "failed"
          run.deliveryError = error instanceof Error ? error.message : String(error)
        }
      }
      await this.commit()
    }
    return structuredClone(run)
  }

  async dispatch(endpoint: string, payload: unknown): Promise<Result> {
    try {
      await this.start()
      const input = (payload ?? {}) as Record<string, unknown>
      if (endpoint === "snapshot") return { ok: true, value: this.snapshot() }
      if (endpoint === "create") {
        const name = typeof input.name === "string" ? input.name.trim() : ""
        const frequency = input.frequency
        const time = typeof input.time === "string" ? input.time : ""
        if (name === "") return failure("invalid-name", "请填写任务名称。")
        if (!["仅一次", "每天", "每周", "每月"].includes(String(frequency)) || !TIME.test(time)) return failure("invalid-schedule", "执行计划无效。")
        const now = new Date(this.now()).toISOString()
        const task: AutomationTask = {
          id: crypto.randomUUID(), name, description: String(input.description ?? "").trim(),
          frequency: frequency as AutomationTask["frequency"], time,
          agent: String(input.agent ?? "当前 Agent"), skill: String(input.skill ?? "暂不选择"),
          enabled: true, createdAt: now, updatedAt: now,
          projectPath: typeof input.projectPath === "string" && input.projectPath.trim() !== "" ? input.projectPath : undefined,
          originSessionId: typeof input.originSessionId === "string" && input.originSessionId.trim() !== "" ? input.originSessionId : undefined,
          delivery: {
            mode: ["origin_chat", "new_chat", "inbox", "silent"].includes(String(input.deliveryMode))
              ? input.deliveryMode as AutomationDeliveryMode
              : (typeof input.originSessionId === "string" && input.originSessionId.trim() !== "" ? "origin_chat" : "inbox"),
            desktopNotification: input.desktopNotification === true,
            notifyOnSuccess: input.notifyOnSuccess !== false,
            notifyOnFailure: input.notifyOnFailure !== false,
          },
        }
        task.nextRunAt = nextRun(task, new Date(this.now()))
        this.ledger.tasks.unshift(task)
        await this.commit()
        return { ok: true, value: structuredClone(task) }
      }
      const id = typeof input.id === "string" ? input.id : ""
      const task = this.ledger.tasks.find((item) => item.id === id)
      if (task === undefined) return failure("not-found", "任务不存在。")
      if (endpoint === "get") return { ok: true, value: structuredClone(task) }
      if (endpoint === "update") {
        if (typeof input.name === "string" && input.name.trim() !== "") task.name = input.name.trim()
        if (typeof input.description === "string") task.description = input.description.trim()
        if (["仅一次", "每天", "每周", "每月"].includes(String(input.frequency))) task.frequency = input.frequency as AutomationTask["frequency"]
        if (typeof input.time === "string") {
          if (!TIME.test(input.time)) return failure("invalid-schedule", "执行时间无效。")
          task.time = input.time
        }
        if (typeof input.agent === "string") task.agent = input.agent
        if (typeof input.skill === "string") task.skill = input.skill
        if (typeof input.projectPath === "string" && input.projectPath.trim() !== "") task.projectPath = input.projectPath
        task.nextRunAt = task.enabled ? nextRun(task, new Date(this.now())) : undefined
        task.updatedAt = new Date(this.now()).toISOString()
        await this.commit()
        return { ok: true, value: structuredClone(task) }
      }
      if (endpoint === "toggle") {
        task.enabled = typeof input.enabled === "boolean" ? input.enabled : !task.enabled
        task.nextRunAt = task.enabled ? nextRun(task, new Date(this.now())) : undefined
        task.updatedAt = new Date(this.now()).toISOString()
        await this.commit()
        return { ok: true, value: structuredClone(task) }
      }
      if (endpoint === "delete") {
        this.ledger.tasks = this.ledger.tasks.filter((item) => item.id !== id)
        await this.commit()
        return { ok: true, value: { id, deleted: true } }
      }
      if (endpoint === "run-now") return { ok: true, value: await this.run(task, "manual") }
      return failure("unknown-endpoint", `unknown endpoint ${endpoint}`)
    } catch (error) {
      const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "internal"
      return failure(code, error instanceof Error ? error.message : String(error))
    }
  }
}
