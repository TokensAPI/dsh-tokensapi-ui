import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, it, vi } from "vitest"
import { runStartupMigration } from "../src/automation-migration-startup.ts"
import type { MigrationTarget } from "../src/automation-migration.ts"

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function fixture(raw?: string) {
  const dir = await mkdtemp(join(tmpdir(), "tokens-startup-migration-")); dirs.push(dir)
  const file = join(dir, "ledger.json")
  await writeFile(file, raw ?? JSON.stringify({ version: 1, revision: 0, runs: [], tasks: [{
    id: "task", name: "Test", description: "Test", frequency: "每天", time: "12:00", enabled: true,
    nextRunAt: "2099-01-01T12:00:00.000Z",
  }] }))
  const target: MigrationTarget = {
    catalog: vi.fn(async () => []), ensureSession: vi.fn(async () => "session"), create: vi.fn(async () => ({ id: "native" })),
  }
  const factory = vi.fn(() => target)
  return { file, target, factory }
}

it("imports once and skips all subsequent startups", async () => {
  const h = await fixture()
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "complete" })
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "skipped" })
  expect(h.target.create).toHaveBeenCalledOnce()
})

it.each(["corrupt", "service", "create", "factory"])("contains %s failure and never retries it on restart", async failure => {
  const h = await fixture(failure === "corrupt" ? "{bad json" : undefined)
  if (failure === "service") vi.mocked(h.target.catalog).mockRejectedValue(new Error("service unavailable"))
  if (failure === "create") vi.mocked(h.target.create).mockRejectedValue(new Error("lost reply"))
  if (failure === "factory") h.factory.mockImplementation(() => { throw new Error("incompatible service") })
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "stopped" })
  for (let i = 0; i < 3; i++) expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "skipped" })
  expect(h.factory).toHaveBeenCalledOnce()
  expect(JSON.parse(await readFile(`${h.file}.migration-attempt.json`, "utf8")).state).toBe("stopped")
})

it("skips interrupted attempts even when their marker is incomplete", async () => {
  const h = await fixture()
  await writeFile(`${h.file}.migration-attempt.json`, "")
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "skipped" })
  expect(h.factory).not.toHaveBeenCalled()
})

it("bounds a hung service and does not create tasks after its late reply", async () => {
  const h = await fixture()
  let release!: (value: []) => void
  vi.mocked(h.target.catalog).mockImplementation(() => new Promise(resolve => { release = resolve }))
  expect(await runStartupMigration(h.file, h.factory, { timeoutMs: 100 })).toEqual({ state: "stopped" })
  release([])
  // Let the abandoned worker settle, including its diagnostic writes.
  await new Promise(resolve => setTimeout(resolve, 100))
  expect(h.target.ensureSession).not.toHaveBeenCalled()
  expect(h.target.create).not.toHaveBeenCalled()
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "skipped" })
})

it("runs only one worker under concurrent startup requests", async () => {
  const h = await fixture()
  const results = await Promise.all([runStartupMigration(h.file, h.factory), runStartupMigration(h.file, h.factory)])
  expect(results.map(r => r.state).sort()).toEqual(["complete", "skipped"])
  expect(h.factory).toHaveBeenCalledOnce()
})

it("skips missing source and an unwritable claim without calling services", async () => {
  const h = await fixture()
  expect(await runStartupMigration(`${h.file}/unavailable`, h.factory)).toEqual({ state: "skipped" })
  // A directory in place of the claim also simulates a failed exclusive write.
  const { mkdir } = await import("node:fs/promises")
  await mkdir(`${h.file}.migration-attempt.json`)
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "skipped" })
  expect(h.factory).not.toHaveBeenCalled()
})

const sampleTask = { name: "日报", description: "整理昨天的工作记录", frequency: "每天", time: "09:30", enabled: true, nextRunAt: "2099-01-31T01:30:00.000Z" }
const ledgerWith = (tasks: unknown[]) => JSON.stringify({ version: 1, revision: 7, tasks, runs: [{ id: "old-run", result: "旧结果不可丢失" }] })

it("migrates a mixed user ledger and preserves disabled tasks and historical results in the backup", async () => {
  const raw = ledgerWith([
    { ...sampleTask, id: "daily" },
    { ...sampleTask, id: "weekly", frequency: "每周" },
    { ...sampleTask, id: "monthly", frequency: "每月" },
    { ...sampleTask, id: "once", frequency: "仅一次" },
    { ...sampleTask, id: "paused", enabled: false },
    { ...sampleTask, id: "finished", enabled: false, frequency: "仅一次" },
  ])
  const h = await fixture(raw)
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "complete" })
  const requests = vi.mocked(h.target.create).mock.calls.map(([, request]) => request)
  expect(requests).toHaveLength(4)
  expect(requests[0]!.daily?.time).toBe("09:30:00")
  expect(requests[1]!.weekly?.weekdays).toHaveLength(1)
  expect(requests[2]!.cron?.expression).toMatch(/^30 9 \d+ \* \*$/)
  expect(requests[3]!.at).toBe(sampleTask.nextRunAt)
  expect(await readFile(`${h.file}.pre-native.bak`, "utf8")).toBe(raw)
  const frozen = JSON.parse(await readFile(h.file, "utf8"))
  expect(frozen.tasks.every((task: { enabled: boolean }) => !task.enabled)).toBe(true)
  expect(frozen.runs).toEqual(JSON.parse(raw).runs)
  const report = JSON.parse(await readFile(`${h.file}.migration.json`, "utf8"))
  expect(Object.values(report.entries).map((entry: any) => entry.state)).toEqual(["migrated", "migrated", "migrated", "migrated", "archived", "archived"])
})

it("isolates one invalid task between two valid tasks and skips the failed item on later startups", async () => {
  const h = await fixture(ledgerWith([
    { ...sampleTask, id: "first" }, { ...sampleTask, id: "broken", time: "25:99" }, { ...sampleTask, id: "last" },
  ]))
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "stopped" })
  expect(h.target.create).toHaveBeenCalledTimes(2)
  const report = JSON.parse(await readFile(`${h.file}.migration.json`, "utf8"))
  expect(Object.values(report.entries).map((entry: any) => entry.state)).toEqual(["migrated", "blocked", "migrated"])
  for (let i = 0; i < 5; i++) expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "skipped" })
  expect(h.target.create).toHaveBeenCalledTimes(2)
  expect(h.factory).toHaveBeenCalledOnce()
})

it("does not duplicate a committed native task when its creation response is lost", async () => {
  const h = await fixture()
  const committed: string[] = []
  vi.mocked(h.target.create).mockImplementation(async (_session, request) => {
    committed.push(request.prompt)
    throw new Error("native commit succeeded, transport disconnected")
  })
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "stopped" })
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "skipped" })
  expect(committed).toHaveLength(1)
})

it.each(["resolve", "reject"])("contains a late create %s after cancellation without starting the next task", async outcome => {
  const h = await fixture(ledgerWith([{ ...sampleTask, id: "first" }, { ...sampleTask, id: "second" }]))
  let finish!: () => void
  vi.mocked(h.target.create).mockImplementation(() => new Promise((resolve, reject) => {
    finish = () => outcome === "resolve" ? resolve({ id: "late-native" }) : reject(new Error("late transport failure"))
  }))
  const abort = new AbortController()
  const running = runStartupMigration(h.file, h.factory, { signal: abort.signal })
  await vi.waitFor(() => expect(h.target.create).toHaveBeenCalledOnce())
  abort.abort()
  expect(await running).toEqual({ state: "stopped" })
  finish()
  // The background worker must release its lock after the late result. Vitest
  // also fails this test if a late rejection escapes as an unhandled rejection.
  await vi.waitFor(async () => {
    await expect(stat(`${h.file}.migration.lock`)).rejects.toMatchObject({ code: "ENOENT" })
  })
  expect(h.target.create).toHaveBeenCalledOnce()
  expect(h.target.ensureSession).toHaveBeenCalledOnce()
  expect(await runStartupMigration(h.file, h.factory)).toEqual({ state: "skipped" })
})
