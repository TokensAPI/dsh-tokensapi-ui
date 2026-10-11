// Wire and persisted types shared by host and client. No Node or DOM dependencies.
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

export interface AutomationSnapshot { version: 1; revision: number; tasks: AutomationTask[]; runs: AutomationRun[] }
export interface AutomationResponses {
  snapshot: AutomationSnapshot
  create: AutomationTask
  get: AutomationTask
  update: AutomationTask
  toggle: AutomationTask
  delete: { id: string; deleted: true }
  "run-now": AutomationRun
}
