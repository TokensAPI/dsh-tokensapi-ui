import { workspace } from "../../shell/workspace-store.ts";

/** Minimal public face of DSH 0.2's layout service (no private DOM clicks). */
interface ScheduleLayout { selectPanel(panel: string): void }
let layout: ScheduleLayout | undefined;
let owner: symbol | undefined;

export function setNativeScheduleLayout(value: unknown): () => void {
  const token = Symbol();
  owner = token;
  layout = typeof (value as Partial<ScheduleLayout> | null)?.selectPanel === "function"
    ? value as ScheduleLayout : undefined;
  return () => { if (owner === token) { layout = undefined; owner = undefined; } };
}

export function openNativeSchedule(): void {
  if (layout === undefined) throw new Error("当前客户端不支持原生自动化页面，请更新客户端。");
  // selectPanel rejects unregistered panels without changing navigation.
  layout.selectPanel("schedules");
  workspace.close();
}
