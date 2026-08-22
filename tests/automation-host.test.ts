import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AutomationHost, type AutomationDelivery, type AutomationExecutor, type AutomationTask } from "../src/automation-host.ts"

const dirs: string[] = []
afterEach(async () => { vi.useRealTimers(); await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

async function harness(executor: AutomationExecutor): Promise<{ host: AutomationHost; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), "tokens-automation-test-")); dirs.push(dir)
  const file = join(dir, "ledger.json")
  const host = new AutomationHost(executor, { file }); await host.start()
  return { host, file }
}

async function deliveryHarness(executor: AutomationExecutor, delivery: AutomationDelivery): Promise<{ host: AutomationHost; file: string }> {
  const dir = await mkdtemp(join(tmpdir(), "tokens-automation-delivery-test-")); dirs.push(dir)
  const file = join(dir, "ledger.json")
  const host = new AutomationHost(executor, { file }, delivery); await host.start()
  return { host, file }
}

const success: AutomationExecutor = { execute: async () => ({ status: "成功", result: "真实 Agent 输出" }) }
const createInput = { name: "BTC 价格", description: "查询当前 BTC 价格", frequency: "每天", time: "08:30", agent: "当前 Agent", skill: "暂不选择" }

describe("AutomationHost", () => {
  it("persists created tasks and restores them after restart", async () => {
    const { host, file } = await harness(success)
    const created = await host.dispatch("create", createInput); expect(created.ok).toBe(true)
    host.dispose()
    const restored = new AutomationHost(success, { file }); await restored.start()
    const snapshot = await restored.dispatch("snapshot", {})
    expect(snapshot.ok && (snapshot.value as { tasks: AutomationTask[] }).tasks[0]?.name).toBe("BTC 价格")
    expect(JSON.parse(await readFile(file, "utf8")).revision).toBeGreaterThan(0)
    restored.dispose()
  })

  it("records the executor output instead of a synthetic success", async () => {
    const { host } = await harness(success)
    const created = await host.dispatch("create", createInput)
    const id = created.ok ? (created.value as AutomationTask).id : ""
    const result = await host.dispatch("run-now", { id })
    expect(result.ok).toBe(true)
    expect(result.ok && (result.value as { status: string }).status).toBe("成功")
    const snapshot = await host.dispatch("snapshot", {})
    expect(snapshot.ok && (snapshot.value as { runs: { result: string }[] }).runs[0]?.result).toBe("真实 Agent 输出")
    host.dispose()
  })

  it("dispatches a due schedule without a browser request", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tokens-automation-schedule-")); dirs.push(dir)
    let now = new Date(2026, 7, 22, 8, 0, 0).getTime()
    const execute = vi.fn(async () => ({ status: "成功" as const, result: "scheduled output" }))
    const host = new AutomationHost({ execute }, { file: join(dir, "ledger.json"), now: () => now, pollIntervalMs: 5 })
    await host.start()
    await host.dispatch("create", { ...createInput, time: "08:01" })
    now = new Date(2026, 7, 22, 8, 1, 1).getTime()
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1), { timeout: 1_000 })
    const snapshot = await host.dispatch("snapshot", {})
    expect(snapshot.ok && (snapshot.value as { runs: { result: string }[] }).runs[0]?.result).toBe("scheduled output")
    host.dispose()
  })

  it("exposes running state and rejects overlapping runs of one task", async () => {
    let release!: () => void
    const executor: AutomationExecutor = { execute: () => new Promise((resolve) => { release = () => resolve({ status: "成功", result: "done" }) }) }
    const { host } = await harness(executor)
    const created = await host.dispatch("create", createInput)
    const id = created.ok ? (created.value as AutomationTask).id : ""
    const first = host.dispatch("run-now", { id })
    await vi.waitFor(async () => {
      const snapshot = await host.dispatch("snapshot", {})
      expect(snapshot.ok && (snapshot.value as { runs: { status: string }[] }).runs[0]?.status).toBe("运行中")
    })
    const overlap = await host.dispatch("run-now", { id })
    expect(overlap.ok).toBe(false)
    if (!overlap.ok) expect(overlap.error.code).toBe("task-busy")
    await vi.waitFor(() => expect(typeof release).toBe("function"))
    release(); await first; host.dispose()
  })

  it("stores executor failures as failed runs", async () => {
    const { host } = await harness({ execute: async () => { throw new Error("model unavailable") } })
    const created = await host.dispatch("create", createInput)
    const id = created.ok ? (created.value as AutomationTask).id : ""
    const result = await host.dispatch("run-now", { id })
    expect(result.ok && (result.value as { status: string }).status).toBe("失败")
    expect(result.ok && (result.value as { result: string }).result).toContain("model unavailable")
    host.dispose()
  })

  it("records execution and delivery outcomes independently", async () => {
    const deliver = vi.fn(async () => ({ status: "failed" as const, error: "origin session unavailable" }))
    const { host } = await deliveryHarness(success, { deliver })
    const created = await host.dispatch("create", { ...createInput, originSessionId: "chat-1" })
    const id = created.ok ? (created.value as AutomationTask).id : ""
    const result = await host.dispatch("run-now", { id })
    expect(result.ok && result.value).toMatchObject({
      status: "成功",
      executionStatus: "succeeded",
      deliveryStatus: "failed",
      deliveryError: "origin session unavailable",
    })
    expect(deliver).toHaveBeenCalledOnce()
    host.dispose()
  })

  it("defaults conversation-created tasks to origin chat delivery", async () => {
    const { host } = await harness(success)
    const created = await host.dispatch("create", { ...createInput, originSessionId: "chat-1" })
    expect(created.ok && created.value).toMatchObject({ originSessionId: "chat-1", delivery: { mode: "origin_chat" } })
    host.dispose()
  })
})
