import { homedir } from "node:os"
import { join, resolve } from "node:path"
import type { Context } from "@deepseek-ai/cordis"
import { type MigrationTarget, type NativeRequest, type NativeTask } from "./automation-migration.ts"

import { runStartupMigration } from "./automation-migration-startup.ts"

// Public DSH 0.2 service boundaries. Kept structural because the theme also
// builds against the 0.1 client SDK; never reach into private storage/runtime.
interface MigrationServices {
  schedule: { catalog(): Promise<NativeTask[]>; create(sessionId: string, request: NativeRequest): Promise<{ id: string }> }
  sessionPersistence: {
    stat(id: string): Promise<{ header: { origin?: string; cwd?: string }; formatStatus?: string } | undefined>
    flush(): Promise<void>
  }
  sessionController: {
    create(request: { sessionId: string; cwd?: string }): Promise<{ sessionId: string }>
    rename(request: { sessionId: string; title: string }): Promise<unknown>
  }
  workspaceRegistry: { archivedSessionIds: readonly string[] }
}

export function nativeMigrationTarget(ctx: Context): MigrationTarget {
  const services = Object.fromEntries(["schedule", "sessionPersistence", "sessionController", "workspaceRegistry"].map(key => [key, ctx.get(key)])) as unknown as MigrationServices
  const { schedule, sessionPersistence, sessionController, workspaceRegistry } = services
  const directoryKey = (path: string) => process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path)
  return {
    catalog: () => schedule.catalog(),
    create: (id, request) => schedule.create(id, request),
    async ensureSession(task, dedicatedId) {
      const usable = async (id: string): Promise<boolean> => {
        if (workspaceRegistry.archivedSessionIds.includes(id)) return false
        const stored = await sessionPersistence.stat(id)
        return stored !== undefined && stored.formatStatus !== "migration-required" && stored.header.origin !== "subagent"
          && (task.projectPath === undefined || (stored.header.cwd !== undefined && directoryKey(stored.header.cwd) === directoryKey(task.projectPath)))
      }
      if (task.originSessionId && await usable(task.originSessionId)) return task.originSessionId
      if (await usable(dedicatedId)) return dedicatedId
      // A pre-existing but unusable dedicated ID is not silently replaced on retry.
      if (await sessionPersistence.stat(dedicatedId)) throw new Error("迁移专用会话已归档或不可用，请检查会话后重试。")
      const created = await sessionController.create({ sessionId: dedicatedId, ...(task.projectPath ? { cwd: task.projectPath } : {}) })
      if (created.sessionId !== dedicatedId) throw new Error("客户端未采用迁移专用会话 ID，已停止以避免重复建会话。")
      await sessionController.rename({ sessionId: dedicatedId, title: `自动化 · ${task.name}`.slice(0, 120) })
      await sessionPersistence.flush()
      return dedicatedId
    },
  }
}

export function installAutomationMigration(ctx: Context): void {
  const file = join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "tokens-automation", "ledger-v1.json")
  ctx.inject(["schedule", "sessionPersistence", "sessionController", "workspaceRegistry"], scoped => {
    const abort = new AbortController()
    scoped.effect(() => () => abort.abort(), "tokens-core: stop automation migration")
    // Background only: never reject plugin startup, and never retry automatically.
    void runStartupMigration(file, () => nativeMigrationTarget(scoped), { signal: abort.signal }).then(result => {
      if (result.state === "stopped") scoped.logger.warn("旧自动化迁移已停止，不影响客户端使用，也不会自动重试。原始数据和诊断记录保留在 tokens-automation 目录。")
    }).catch(() => { /* Migration must never escape into plugin lifecycle. */ })
  })
}
