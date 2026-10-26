import { describe, expect, it, vi } from "vitest"
import type { Context } from "@deepseek-ai/cordis"
import { nativeMigrationTarget } from "../src/automation-migration-host.ts"
import type { AutomationTask } from "../src/shared/automation-contract.ts"

const task = { name: "日报", originSessionId: "origin", projectPath: "C:/work" } as AutomationTask
function fixture() {
  const stored = new Map<string, { header: { origin?: string; cwd?: string }; formatStatus?: string }>()
  const services = {
    schedule: { catalog: vi.fn(async () => []), create: vi.fn(async () => ({ id: "schedule-1" })) },
    sessionPersistence: { stat: vi.fn(async (id: string) => stored.get(id)), flush: vi.fn(async () => {}) },
    sessionController: {
      create: vi.fn(async ({ sessionId }: { sessionId: string }) => { stored.set(sessionId, { header: { cwd: "C:/work" } }); return { sessionId } }),
      rename: vi.fn(async () => {}),
    },
    workspaceRegistry: { archivedSessionIds: [] as string[] },
  }
  const target = nativeMigrationTarget({ get: (key: keyof typeof services) => services[key] } as unknown as Context)
  return { stored, services, target }
}
describe("native migration session binding", () => {
  it("keeps an existing usable original session without activating it", async () => {
    const h = fixture(); h.stored.set("origin", { header: { cwd: "C:/work" } })
    expect(await h.target.ensureSession(task, "dedicated")).toBe("origin")
    expect(h.services.sessionController.create).not.toHaveBeenCalled()
  })
  it.skipIf(process.platform !== "win32")("accepts equivalent Windows directory spellings", async () => {
    const h = fixture(); h.stored.set("origin", { header: { cwd: "c:\\WORK" } })
    expect(await h.target.ensureSession(task, "dedicated")).toBe("origin")
    expect(h.services.sessionController.create).not.toHaveBeenCalled()
  })
  it.each(["missing", "archived", "subagent", "wrong-directory", "old-format"])("creates a named durable dedicated session for %s origins", async reason => {
    const h = fixture()
    if (reason !== "missing") h.stored.set("origin", { header: { cwd: reason === "wrong-directory" ? "C:/other" : "C:/work", origin: reason === "subagent" ? "subagent" : undefined }, formatStatus: reason === "old-format" ? "migration-required" : "current" })
    if (reason === "archived") h.services.workspaceRegistry.archivedSessionIds.push("origin")
    expect(await h.target.ensureSession(task, "dedicated")).toBe("dedicated")
    expect(h.services.sessionController.create).toHaveBeenCalledWith({ sessionId: "dedicated", cwd: "C:/work" })
    expect(h.services.sessionPersistence.flush).toHaveBeenCalledOnce()
    await h.target.ensureSession(task, "dedicated")
    expect(h.services.sessionController.create).toHaveBeenCalledOnce()
  })
  it("does not turn storage read errors into new sessions", async () => {
    const h = fixture(); h.services.sessionPersistence.stat.mockRejectedValue(new Error("disk unavailable"))
    await expect(h.target.ensureSession(task, "dedicated")).rejects.toThrow("disk unavailable")
    expect(h.services.sessionController.create).not.toHaveBeenCalled()
  })
})
