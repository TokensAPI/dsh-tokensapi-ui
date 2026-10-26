import { createHash } from "node:crypto"
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { AutomationSnapshot, AutomationTask } from "./shared/automation-contract.ts"

export interface NativeRequest {
  title: string; prompt: string
  at?: string; after_seconds?: number
  daily?: { time: string; time_zone: string }
  weekly?: { time: string; time_zone: string; weekdays: number[] }
  cron?: { expression: string; time_zone: string }
}
export interface NativeTask { id: string; sessionId: string; prompt: string }
export interface MigrationTarget {
  catalog(): Promise<NativeTask[]>
  ensureSession(task: AutomationTask, dedicatedId: string): Promise<string>
  create(sessionId: string, request: NativeRequest): Promise<{ id: string }>
}
interface Entry {
  taskId: string; taskName: string
  state: "prepared" | "creating" | "migrated" | "archived" | "blocked"
  marker: string; sessionId?: string; nativeId?: string; error?: string
  warnings: string[]
}
export interface MigrationReport {
  version: 1; sourceHash: string; timeZone: string
  entries: Record<string, Entry>; complete: boolean
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex")
async function acquireLock(lock: string): Promise<void> {
  try { await writeFile(lock, String(process.pid), { flag: "wx", mode: 0o600 }); return }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error }
  // Serialize stale-lock reclamation too: two starters must not unlink each
  // other's newly acquired lock. An interrupted recovery fails closed.
  const recovery = `${lock}.recovery`
  await writeFile(recovery, String(process.pid), { flag: "wx", mode: 0o600 })
  try {
    const oldLock = await optionalRead(lock)
    if (oldLock !== undefined) {
      const pid = Number(oldLock)
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`迁移锁损坏，请检查 ${lock}`)
      try { process.kill(pid, 0); throw new Error("另一个迁移正在运行。") }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error }
      await unlink(lock)
    }
    await writeFile(lock, String(process.pid), { flag: "wx", mode: 0o600 })
  } finally { await unlink(recovery) }
}
async function optionalRead(file: string): Promise<string | undefined> {
  try { return await readFile(file, "utf8") }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error }
}
async function save(file: string, value: unknown): Promise<void> {
  const temp = `${file}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 })
  await rename(temp, file)
}

/** The old scheduler used the host's local zone, never the browser's zone. */
export function planNativeTask(task: AutomationTask, marker: string, timeZone: string, now: number): { request: NativeRequest; warnings: string[] } {
  if (!task.name.trim() || task.name.trim().length > 120) throw new Error("任务名称必须为 1–120 个字符；原始名称已保留在备份。")
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(task.time)) throw new Error("旧任务时间无效。")
  const anchor = Date.parse(task.nextRunAt ?? "")
  if (!Number.isFinite(anchor)) throw new Error("启用的旧任务缺少有效的下次执行时间。")
  const request: NativeRequest = { title: task.name.trim(), prompt: `${task.description.trim() || task.name.trim()}\n\n<!-- ${marker} -->` }
  const warnings = ["改为在固定会话中执行；历史执行结果保存在旧账本备份。"]
  if (task.delivery?.mode === "silent" || task.delivery?.notifyOnSuccess === false || task.delivery?.notifyOnFailure === false) {
    warnings.push("原生自动化在目标会话中回复，不再应用旧版结果通知过滤。")
  }
  const time = `${task.time}:00`
  if (task.frequency === "仅一次") {
    if (anchor > now) request.at = new Date(anchor).toISOString()
    else { request.after_seconds = 60; warnings.push("已过期的一次性任务将在迁移后约一分钟补执行。") }
  } else if (task.frequency === "每天") request.daily = { time, time_zone: timeZone }
  else {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric", weekday: "short" }).formatToParts(anchor)
    if (task.frequency === "每周") {
      const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.find(p => p.type === "weekday")!.value) + 1
      request.weekly = { time, time_zone: timeZone, weekdays: [weekday] }
    } else if (task.frequency === "每月") {
      const day = Number(parts.find(p => p.type === "day")!.value)
      const [hour, minute] = task.time.split(":").map(Number)
      request.cron = { expression: `${minute} ${hour} ${day} * *`, time_zone: timeZone }
      if (day > 28) warnings.push(`每月 ${day} 日执行；没有该日期的月份跳过，不再使用旧版日期溢出规则。`)
    } else throw new Error("未知的旧任务频率。")
  }
  if (task.frequency !== "仅一次" && anchor <= now) warnings.push("周期任务从下一个原生计划时间继续，不补跑迁移前错过的次数。")
  return { request, warnings }
}

function decodeLedger(raw: string): AutomationSnapshot {
  const value = JSON.parse(raw) as AutomationSnapshot
  if (value?.version !== 1 || !Array.isArray(value.tasks) || !Array.isArray(value.runs)) throw new Error("旧账本格式无效；未修改源文件。")
  const ids = new Set<string>()
  for (const task of value.tasks) {
    if (!task || typeof task.id !== "string" || !task.id || ids.has(task.id) || typeof task.enabled !== "boolean") throw new Error("旧账本任务 ID 或启用状态无效；未修改源文件。")
    ids.add(task.id)
  }
  return value
}

/** One exclusive migration per shared legacy ledger, including across processes. */
export async function migrateAutomation(file: string, target: MigrationTarget, options: { now?: number; timeZone?: string; signal?: AbortSignal } = {}): Promise<MigrationReport | undefined> {
  if (await optionalRead(file) === undefined) return undefined
  await mkdir(dirname(file), { recursive: true })
  const lock = `${file}.migration.lock`
  await acquireLock(lock)
  try { return await migrateLocked(file, target, options) }
  finally { await unlink(lock) }
}

async function migrateLocked(file: string, target: MigrationTarget, options: { now?: number; timeZone?: string; signal?: AbortSignal }): Promise<MigrationReport> {
  const backupFile = `${file}.pre-native.bak`
  const reportFile = `${file}.migration.json`
  const raw = (await optionalRead(backupFile)) ?? (await readFile(file, "utf8"))
  const ledger = decodeLedger(raw)
  if (await optionalRead(backupFile) === undefined) await writeFile(backupFile, raw, { flag: "wx", mode: 0o600 })
  const saved = await optionalRead(reportFile)
  const report: MigrationReport = saved === undefined ? {
    version: 1, sourceHash: digest(raw), timeZone: options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    entries: {}, complete: false,
  } : JSON.parse(saved)
  if (report.version !== 1 || report.sourceHash !== digest(raw) || !report.entries || typeof report.timeZone !== "string") throw new Error("迁移记录与旧账本备份不匹配；已停止迁移。")
  if (report.complete) return report
  // Freeze old tasks durably BEFORE any native creation; a downgrade cannot double-run them.
  const current = decodeLedger(await readFile(file, "utf8"))
  const frozen = { ...ledger, revision: ledger.revision + 1, tasks: ledger.tasks.map(task => ({ ...task, enabled: false, nextRunAt: undefined })) }
  if (JSON.stringify(current) !== JSON.stringify(ledger) && JSON.stringify(current) !== JSON.stringify(frozen)) throw new Error("迁移期间旧账本发生变化；已停止迁移以保留新数据。")
  await save(file, frozen)
  await save(reportFile, report)
  for (const task of ledger.tasks) {
    options.signal?.throwIfAborted()
    const key = digest(task.id)
    const entry = report.entries[key] ??= { taskId: task.id, taskName: task.name, state: task.enabled ? "prepared" : "archived", marker: `tokens-automation-migration:${digest(report.sourceHash + task.id)}`, warnings: [] }
    if (entry.state === "migrated" || entry.state === "archived") continue
    try {
      const plan = planNativeTask(task, entry.marker, report.timeZone, options.now ?? Date.now())
      entry.warnings = plan.warnings
      // Catalog includes inactive one-shot rows, so a crash after delivery is also recoverable.
      const matches = (await target.catalog()).filter(row => row.prompt.endsWith(`<!-- ${entry.marker} -->`))
      options.signal?.throwIfAborted()
      if (matches.length > 1) throw new Error("发现多个迁移来源相同的原生任务，请人工核对。")
      if (matches.length === 1) {
        const row = matches[0]!
        if (entry.sessionId !== row.sessionId) throw new Error("原生任务的目标会话与迁移记录不匹配。")
        entry.nativeId = row.id; entry.state = "migrated"; delete entry.error
      } else {
        if (entry.state === "creating") throw new Error("上次创建结果无法确认，已停止自动重试以防重复执行。")
        entry.sessionId = await target.ensureSession(task, `tokens-migrated-${digest(report.sourceHash + task.id).slice(0, 32)}`)
        options.signal?.throwIfAborted()
        // 'creating' is a durable intent. Never blindly replay an uncertain request.
        entry.state = "creating"
        await save(reportFile, report)
        const row = await target.create(entry.sessionId, plan.request)
        entry.nativeId = row.id; entry.state = "migrated"; delete entry.error
      }
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error)
      if (entry.state !== "creating") entry.state = "blocked"
    }
    await save(reportFile, report)
  }
  report.complete = Object.values(report.entries).every(entry => entry.state === "migrated" || entry.state === "archived")
  await save(reportFile, report)
  return report
}
