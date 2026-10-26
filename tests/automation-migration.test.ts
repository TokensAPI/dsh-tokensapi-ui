import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { migrateAutomation, planNativeTask, type MigrationTarget, type NativeTask } from "../src/automation-migration.ts"
import type { AutomationTask } from "../src/shared/automation-contract.ts"

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const now = Date.parse("2026-10-26T10:00:00Z")
const base: AutomationTask = {
  id: "old-1", name: "日报", description: "整理日报", frequency: "每天", time: "19:00", enabled: true,
  nextRunAt: "2026-10-26T11:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
  agent: "当前 Agent", skill: "暂不选择", delivery: { mode: "inbox", desktopNotification: false, notifyOnSuccess: true, notifyOnFailure: true },
}
async function fixture(tasks = [base]) {
  const dir = await mkdtemp(join(tmpdir(), "tokens-migrate-")); dirs.push(dir)
  const file = join(dir, "ledger-v1.json")
  const raw = JSON.stringify({ version: 1, revision: 2, tasks, runs: [{ id: "history", result: "保留原始历史" }] })
  await writeFile(file, raw)
  const rows: NativeTask[] = []
  const target: MigrationTarget = {
    catalog: vi.fn(async () => rows), ensureSession: vi.fn(async (_task, id) => id),
    create: vi.fn(async (sessionId, request) => {
      // The original scheduler must already be durably frozen here.
      expect(JSON.parse(await readFile(file, "utf8")).tasks.every((t: AutomationTask) => !t.enabled)).toBe(true)
      const row = { id: `native-${rows.length}`, sessionId, prompt: request.prompt }; rows.push(row); return row
    }),
  }
  const run = () => migrateAutomation(file, target, { now, timeZone: "Asia/Shanghai" })
  return { file, raw, rows, target, run }
}

describe("one-time native migration", () => {
  it("backs up exact bytes, freezes the old ledger, migrates only enabled tasks, and never recreates after completion", async () => {
    const h = await fixture([base, { ...base, id: "paused", enabled: false, nextRunAt: undefined }])
    const report = (await h.run())!
    expect(report.complete).toBe(true)
    expect(Object.values(report.entries).map(e => e.state)).toEqual(["migrated", "archived"])
    expect(await readFile(`${h.file}.pre-native.bak`, "utf8")).toBe(h.raw)
    expect(JSON.parse(await readFile(h.file, "utf8")).runs).toEqual(JSON.parse(h.raw).runs)
    await h.run(); expect(h.target.create).toHaveBeenCalledTimes(1)
    // User deletion after completed migration must never resurrect a task.
    h.rows.splice(0); await h.run(); expect(h.target.create).toHaveBeenCalledTimes(1)
  })

  it("recovers a native commit whose reply was lost, including an already-delivered one-shot", async () => {
    const h = await fixture([{ ...base, frequency: "仅一次" }])
    const create = h.target.create
    h.target.create = vi.fn(async (...args) => { await create(...args); throw new Error("lost response") })
    expect((await h.run())!.complete).toBe(false)
    expect((await h.run())!.complete).toBe(true)
    expect(h.target.create).toHaveBeenCalledTimes(1)
  })

  it("never blindly retries an ambiguous creation with no catalog match", async () => {
    const h = await fixture()
    h.target.create = vi.fn(async () => { throw new Error("connection lost") })
    await h.run(); const result = (await h.run())!
    expect(result.complete).toBe(false)
    expect(Object.values(result.entries)[0]!.error).toContain("无法确认")
    expect(h.target.create).toHaveBeenCalledTimes(1)
  })

  it("retries pre-create failures safely and keeps successful tasks from repeating", async () => {
    const h = await fixture([base, { ...base, id: "second" }])
    const ensure = h.target.ensureSession
    h.target.ensureSession = vi.fn().mockRejectedValueOnce(new Error("model unavailable")).mockImplementation(ensure)
    expect((await h.run())!.complete).toBe(false)
    expect((await h.run())!.complete).toBe(true)
    expect(h.target.create).toHaveBeenCalledTimes(2)
  })

  it("rejects malformed ledgers and externally modified source files instead of losing data", async () => {
    const h = await fixture()
    await writeFile(h.file, '{"version":1,"tasks":null}')
    await expect(h.run()).rejects.toThrow("格式无效")
    expect(h.target.create).not.toHaveBeenCalled()
    await writeFile(h.file, h.raw)
    h.target.create = vi.fn(async () => { throw new Error("unknown") })
    await h.run()
    await writeFile(h.file, h.raw.replace('"revision":2', '"revision":9'))
    await expect(h.run()).rejects.toThrow("发生变化")
  })

  it("does not read native services without a legacy file, and refuses a live lock", async () => {
    const h = await fixture()
    await expect(migrateAutomation(`${h.file}.missing`, h.target)).resolves.toBeUndefined()
    await writeFile(`${h.file}.migration.lock`, String(process.pid))
    await expect(h.run()).rejects.toThrow("另一个迁移")
    expect(h.target.catalog).not.toHaveBeenCalled()
  })
})

describe("native timing conversion", () => {
  const plan = (task: Partial<AutomationTask>) => planNativeTask({ ...base, ...task }, "marker", "Asia/Shanghai", now)
  it("uses explicit host timezone, anchor weekday and monthly date", () => {
    expect(plan({}).request.daily).toEqual({ time: "19:00:00", time_zone: "Asia/Shanghai" })
    expect(plan({ frequency: "每周" }).request.weekly?.weekdays).toEqual([1])
    expect(plan({ frequency: "每月" }).request.cron?.expression).toBe("0 19 26 * *")
    const monthly = plan({ frequency: "每月", nextRunAt: "2026-10-31T11:00:00.000Z" })
    expect(monthly.warnings.join()).toContain("月份跳过")
  })
  it("keeps future one-shots and explicitly reports overdue timing changes", () => {
    expect(plan({ frequency: "仅一次" }).request.at).toBe(base.nextRunAt)
    expect(plan({ frequency: "仅一次", nextRunAt: "2026-10-25T11:00:00Z" }).request.after_seconds).toBe(60)
    expect(plan({ nextRunAt: "2026-10-25T11:00:00Z" }).warnings.join()).toContain("不补跑")
  })
  it("does not guess invalid timing or silently truncate titles", () => {
    expect(() => plan({ nextRunAt: undefined })).toThrow("下次执行时间")
    expect(() => plan({ name: "a".repeat(121) })).toThrow("120")
    expect(() => plan({ time: "25:00" })).toThrow("时间无效")
  })
})
