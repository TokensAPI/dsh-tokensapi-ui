import { stat, writeFile } from "node:fs/promises"
import { migrateAutomation, type MigrationTarget } from "./automation-migration.ts"

export interface StartupMigrationResult {
  state: "skipped" | "complete" | "stopped"
}

/** Best-effort, once-ever startup import. A durable claim precedes ALL work.
 * A failed/interrupted attempt is never automatically replayed on the next boot.
 * The lower-level importer remains available for explicit diagnostic recovery.
 */
export async function runStartupMigration(file: string, target: () => MigrationTarget, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<StartupMigrationResult> {
  const attemptFile = `${file}.migration-attempt.json`
  try {
    if (!(await stat(file)).isFile() || options.signal?.aborted) return { state: "skipped" }
    await writeFile(attemptFile, JSON.stringify({ version: 1, state: "started", at: new Date().toISOString() }), { flag: "wx", mode: 0o600 })
  } catch {
    // No source, existing claim, or unwritable disk: do not migrate or spam logs.
    return { state: "skipped" }
  }
  const abort = new AbortController()
  const cancel = () => abort.abort(new Error("自动迁移已停止。"))
  options.signal?.addEventListener("abort", cancel, { once: true })
  if (options.signal?.aborted) cancel()
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectAbort: (() => void) | undefined
  let result: StartupMigrationResult
  let detail: string | undefined
  try {
    const stopped = new Promise<never>((_, reject) => {
      rejectAbort = () => reject(abort.signal.reason)
      abort.signal.addEventListener("abort", rejectAbort, { once: true })
      if (abort.signal.aborted) rejectAbort()
    })
    timer = setTimeout(cancel, options.timeoutMs ?? 30_000)
    timer.unref?.()
    const work = Promise.resolve().then(() => {
      abort.signal.throwIfAborted()
      return migrateAutomation(file, target(), { signal: abort.signal })
    })
    const report = await Promise.race([work, stopped])
    result = { state: report === undefined || report.complete ? "complete" : "stopped" }
    if (result.state === "stopped") detail = "部分任务未迁移，详情见 migration.json；不再自动重试。"
  } catch (error) {
    result = { state: "stopped" }
    detail = error instanceof Error ? error.message : String(error)
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener("abort", cancel)
    if (rejectAbort) abort.signal.removeEventListener("abort", rejectAbort)
  }
  // Even if this diagnostic update fails, the initial claim still prevents retry.
  try { await writeFile(attemptFile, JSON.stringify({ version: 1, state: result.state, detail, at: new Date().toISOString() }), { mode: 0o600 }) } catch { /* best effort */ }
  return result
}
