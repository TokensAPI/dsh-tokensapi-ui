import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Context } from "@deepseek-ai/cordis";

const ORIGIN = "https://tokensapi.ai";
const CURRENT_KEY = "TOKENSAPI_API_KEY";
const CURRENT_FINGERPRINT = "TOKENSAPI_API_KEY_VERIFIED_SHA256";
const MANUAL_KEY = "TOKENSHARNESS_MANUAL_API_KEY_BACKUP";
const MANUAL_FINGERPRINT = "TOKENSHARNESS_MANUAL_API_KEY_VERIFIED_BACKUP";
const STATE_FILE = "tokens-account/state.json";

type Mode = "manual-key" | "account";
type RpcResult<T = unknown> = { ok: true; value: T } | { ok: false; error: { code: string; message: string; details: Record<string, unknown> } };
interface Credentials { resolve(ref: string): Promise<{ value: string } | undefined>; set(ref: string, value: string): Promise<void>; unset(ref: string): Promise<void> }
interface TokenRow { id: number; name?: string; status: number; expired_time: number; unlimited_quota?: boolean; remain_quota?: number; org_id?: number; group?: string; accessed_time?: number }
interface State { mode: Mode; preferredTokenId?: number; userId?: number }
interface AccountView { webContents: { isDestroyed(): boolean; close(): void; loadURL(url: string): Promise<void>; on(event: string, listener: (event: { preventDefault(): void }, url: string) => void): void; setWindowOpenHandler(handler: (details: { url: string }) => { action: "deny" }): void }; setBounds(bounds: { x: number; y: number; width: number; height: number }): void }
interface AccountWindow { isDestroyed(): boolean; close(): void; loadURL(url: string): Promise<void>; once(event: string, listener: () => void): void; webContents: { executeJavaScript<T>(code: string, userGesture?: boolean): Promise<T> }; contentView: { addChildView(view: AccountView): void; removeChildView(view: AccountView): void } }
interface ElectronApi { app: { getPath(name: string): string }; session: { defaultSession: { fetch(input: string, init: RequestInit): Promise<Response>; cookies: { get(filter: { url: string }): Promise<Array<{ name: string; value: string }>>; set(details: { url: string; name: string; value: string; path?: string; secure?: boolean; httpOnly?: boolean; sameSite?: "unspecified" | "no_restriction" | "lax" | "strict" }): Promise<void> } } }; shell: { openExternal(url: string): Promise<void> }; BrowserWindow: { new(options: Record<string, unknown>): AccountWindow; getFocusedWindow(): AccountWindow | null; getAllWindows(): AccountWindow[] }; WebContentsView: new(options: Record<string, unknown>) => AccountView }

export function tokensAccountViewBounds(payload: unknown): { x: number; y: number; width: number; height: number } | undefined {
  const raw = (payload as { bounds?: Record<string, unknown> } | null)?.bounds;
  if (raw === undefined) return undefined;
  const values = [raw.x, raw.y, raw.width, raw.height];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return undefined;
  return {
    x: Math.max(0, Math.round(raw.x as number)),
    y: Math.max(0, Math.round(raw.y as number)),
    width: Math.max(320, Math.round(raw.width as number)),
    height: Math.max(320, Math.round(raw.height as number)),
  };
}

function failure(error: unknown): RpcResult<never> {
  return { ok: false, error: { code: "internal", message: error instanceof Error ? error.message : String(error), details: {} } };
}
function externalUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function fingerprint(key: string): string { return `sha256:${createHash("sha256").update(key).digest("hex")}`; }
export function resolvedCredentialValue(result: { value: string } | undefined): string { return result?.value ?? ""; }
function usable(token: TokenRow): boolean {
  return Number.isInteger(token.id) && token.id > 0 && token.status === 1 && token.expired_time !== 0
    && (token.expired_time === -1 || token.expired_time > Math.floor(Date.now() / 1000))
    && (token.unlimited_quota === true || Number(token.remain_quota) > 0);
}
export function selectTokensApiDshToken(tokens: TokenRow[], preferred?: number): TokenRow | undefined {
  const rows = tokens.filter(usable);
  const selected = rows.find((token) => token.id === preferred);
  if (selected !== undefined) return selected;
  return rows.sort((a, b) => Number(b.org_id! > 0) - Number(a.org_id! > 0)
    || Number(b.accessed_time ?? 0) - Number(a.accessed_time ?? 0) || b.id - a.id)[0];
}

export function installTokensAccount(ctx: Context, connection: { rpc: { handle(channel: string, handler: (endpoint: string, payload: unknown) => Promise<RpcResult>, options: { authority: "trusted-host" }): () => Promise<void> } }): void {
  let credentials: Credentials | undefined;
  let initialized: Promise<void> = Promise.resolve();
  let electron: ElectronApi | undefined;
  let state: State = { mode: "manual-key" };
  let user: Record<string, unknown> | undefined;
  let active: TokenRow | undefined;
  let aigc: AccountView | undefined;
  let parent: AccountWindow | undefined;
  let apiWindow: AccountWindow | undefined;

  const ensureElectron = async (): Promise<ElectronApi> => { if (electron !== undefined) return electron; electron = await import("electron") as unknown as ElectronApi; return electron; };
  const ensureApiWindow = async (): Promise<AccountWindow> => {
    if (apiWindow !== undefined && !apiWindow.isDestroyed()) return apiWindow;
    const e = await ensureElectron();
    apiWindow = new e.BrowserWindow({
      show: false,
      width: 1,
      height: 1,
      skipTaskbar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        session: e.session.defaultSession,
      },
    });
    await apiWindow.loadURL(`${ORIGIN}/`);
    const loadedOrigin = await apiWindow.webContents.executeJavaScript<string>("location.origin", false);
    if (loadedOrigin !== ORIGIN) throw new Error(`TokensAPI 同源认证上下文无效 (${loadedOrigin})`);
    return apiWindow;
  };
  const statePath = async (): Promise<string> => join((await ensureElectron()).app.getPath("userData"), STATE_FILE);
  const save = async (): Promise<void> => { const path = await statePath(); await mkdir(dirname(path), { recursive: true }); const tmp = `${path}.tmp`; await writeFile(tmp, `${JSON.stringify(state)}\n`, { mode: 0o600 }); await rename(tmp, path); };
  const load = async (): Promise<void> => { try { const raw = JSON.parse(await readFile(await statePath(), "utf8")) as State; state = { mode: raw.mode === "account" ? "account" : "manual-key", preferredTokenId: Number.isInteger(raw.preferredTokenId) ? raw.preferredTokenId : undefined, userId: Number.isInteger(raw.userId) && Number(raw.userId) > 0 ? Number(raw.userId) : undefined }; } catch {} };
  const api = async (path: string, init: RequestInit = {}, anonymous = false): Promise<unknown> => {
    const window = await ensureApiWindow();
    const url = new URL(path, ORIGIN).href;
    const request = {
      method: init.method ?? "GET",
      body: typeof init.body === "string" ? init.body : undefined,
      headers: { accept: "application/json", ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...(state.userId === undefined ? {} : { "New-Api-User": String(state.userId) }) },
    };
    const response = await window.webContents.executeJavaScript<{ status: number; contentType: string; text: string }>(`(async () => {
      const response = await fetch(${JSON.stringify(url)}, { ...${JSON.stringify(request)}, credentials: "include", redirect: "error" });
      return { status: response.status, contentType: response.headers.get("content-type") || "", text: await response.text() };
    })()`, false);
    if (anonymous && response.status === 401) return undefined;
    if (!response.contentType.toLowerCase().startsWith("application/json")) throw new Error(`TokensAPI 返回了非 JSON 响应 (${response.status})`);
    const text = response.text; if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new Error("TokensAPI 响应过大");
    const body = JSON.parse(text) as { success?: boolean; message?: string; data?: unknown };
    if (response.status < 200 || response.status >= 300 || body.success !== true) throw new Error(body.message || `TokensAPI 请求失败 (${response.status})`);
    return body.data;
  };
  const tokens = async (): Promise<TokenRow[]> => { const data = await api("/api/token/?p=0&page_size=100") as { items?: TokenRow[] }; if (!Array.isArray(data?.items)) throw new Error("TokensAPI Key 列表无效"); return data.items; };
  const store = async (ref: string, value: string): Promise<void> => { if (credentials === undefined) throw new Error("当前运行环境不支持桌面凭据"); if (value === "") await credentials.unset(ref); else await credentials.set(ref, value); };
  const resolve = async (ref: string): Promise<string> => credentials === undefined ? "" : resolvedCredentialValue(await credentials.resolve(ref));
  const activate = async (token: TokenRow): Promise<void> => { const data = await api(`/api/token/${token.id}/key`, { method: "POST", body: "{}" }) as { key?: string }; if (!data.key) throw new Error("TokensAPI Key 内容无效"); await store(CURRENT_KEY, data.key); await store(CURRENT_FINGERPRINT, fingerprint(data.key)); active = token; state.preferredTokenId = token.id; await save(); };
  const restoreManual = async (): Promise<void> => { await store(CURRENT_KEY, await resolve(MANUAL_KEY)); await store(CURRENT_FINGERPRINT, await resolve(MANUAL_FINGERPRINT)); active = undefined; user = undefined; };
  const snapshot = async () => ({ available: credentials !== undefined, mode: state.mode, authenticated: user !== undefined, user: user === undefined ? undefined : { id: user.id, username: user.username, displayName: user.display_name || user.username, group: user.group || "", role: user.role, quota: user.quota }, dshToken: active === undefined ? undefined : { id: active.id, name: active.name || "", orgId: active.org_id || 0, group: active.group || "" }, manualConfigured: state.mode === "manual-key" && (await resolve(CURRENT_KEY)) !== "", aigcVisible: state.mode === "account" && user !== undefined });
  const restore = async (): Promise<void> => { if (state.mode !== "account" || credentials === undefined) return; user = await api("/api/user/self", {}, true) as Record<string, unknown> | undefined; if (user === undefined) { if (state.userId !== undefined) { state.userId = undefined; await save(); } await restoreManual(); return; } const restoredUserId = Number(user.id); if (Number.isInteger(restoredUserId) && restoredUserId > 0 && state.userId !== restoredUserId) { state.userId = restoredUserId; await save(); } let rows = await tokens(); let selected = selectTokensApiDshToken(rows, state.preferredTokenId); if (selected === undefined) { await api("/api/token/", { method: "POST", body: JSON.stringify({ name: "TokensHarness", expired_time: -1, unlimited_quota: true, remain_quota: 0, model_limits_enabled: false, model_limits: "", allow_ips: "", group: "", cross_group_retry: false }) }); rows = await tokens(); selected = selectTokensApiDshToken(rows); } if (selected !== undefined) await activate(selected); };
  const hideAigc = (): void => { if (aigc !== undefined && parent !== undefined && !parent.isDestroyed()) parent.contentView.removeChildView(aigc); parent = undefined; };
  const showAigc = async (payload: unknown): Promise<void> => { if (user === undefined || state.mode !== "account") throw new Error("请先登录 TokensAPI"); const e = await ensureElectron(); const bounds = tokensAccountViewBounds(payload); if (bounds === undefined) throw new Error("AIGC 区域无效"); const win = e.BrowserWindow.getFocusedWindow() ?? e.BrowserWindow.getAllWindows()[0]; if (win === undefined) throw new Error("桌面窗口不可用"); if (aigc === undefined || aigc.webContents.isDestroyed()) { aigc = new e.WebContentsView({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, session: e.session.defaultSession } }); aigc.webContents.on("will-navigate", (event, url) => { let sameOrigin = false; try { sameOrigin = new URL(url).origin === ORIGIN; } catch {} if (!sameOrigin) { event.preventDefault(); const target = externalUrl(url); if (target !== undefined) void e.shell.openExternal(target); } }); aigc.webContents.setWindowOpenHandler(({ url }) => { const target = externalUrl(url); if (target !== undefined) void e.shell.openExternal(target); return { action: "deny" }; }); await aigc.webContents.loadURL(`${ORIGIN}/aigc`); } hideAigc(); win.contentView.addChildView(aigc); parent = win; aigc.setBounds(bounds); };

  // Cordis intentionally hides services that were not injected into the
  // current scope. Use an optional nested injection so Desktop can expose its
  // credential vault while an ordinary `dsh web` composition stays loadable.
  ctx.inject(["credentials"], (scoped) => {
    credentials = (scoped as unknown as { credentials: Credentials }).credentials;
    initialized = load().then(restore).catch((error) => {
      scoped.logger.warn(`tokens account restore failed: ${String(error)}`);
    });
    scoped.effect(() => () => { credentials = undefined; }, "tokens-core: desktop credentials");
  });
  const dispatch = async (endpoint: string, payload: unknown): Promise<RpcResult> => { try {
    await initialized;
    if (endpoint === "state") return { ok: true, value: await snapshot() };
    if (credentials === undefined) throw new Error("TokensAPI 账号模式仅在桌面客户端可用");
    if (endpoint === "mode") { const next = (payload as { mode?: Mode }).mode; if (next !== "manual-key" && next !== "account") throw new Error("登录模式无效"); if (next === "account" && state.mode !== "account") { await store(MANUAL_KEY, await resolve(CURRENT_KEY)); await store(MANUAL_FINGERPRINT, await resolve(CURRENT_FINGERPRINT)); } state.mode = next; await save(); if (next === "account") await restore(); else { hideAigc(); await restoreManual(); } return { ok: true, value: await snapshot() }; }
    if (endpoint === "manual-key") { const key = (payload as { key?: unknown }).key; if (typeof key !== "string" || key.trim() === "") throw new Error("请输入 API Key"); const normalized = key.trim(); state.mode = "manual-key"; state.userId = undefined; await store(MANUAL_KEY, normalized); await store(MANUAL_FINGERPRINT, fingerprint(normalized)); await store(CURRENT_KEY, normalized); await store(CURRENT_FINGERPRINT, fingerprint(normalized)); active = undefined; user = undefined; hideAigc(); await save(); return { ok: true, value: await snapshot() }; }
    if (endpoint === "password-login") { const input = payload as { username?: unknown; password?: unknown }; if (typeof input.username !== "string" || input.username.trim() === "" || typeof input.password !== "string" || input.password === "") throw new Error("请输入用户名和密码"); state.mode = "account"; await save(); const result = await api("/api/user/login?turnstile=", { method: "POST", body: JSON.stringify({ username: input.username.trim(), password: input.password }) }) as { require_2fa?: boolean; id?: number } | undefined; const loginUserId = Number(result?.id); if (Number.isInteger(loginUserId) && loginUserId > 0) { state.userId = loginUserId; await save(); } if (result?.require_2fa === true) return { ok: true, value: { requiresTwoFactor: true } }; await new Promise((resolveDelay) => setTimeout(resolveDelay, 50)); await restore(); if (user === undefined) throw new Error("登录成功，但未能读取账号信息，请重试"); return { ok: true, value: { requiresTwoFactor: false, snapshot: await snapshot() } }; }
    if (endpoint === "two-factor-login") { const code = (payload as { code?: unknown }).code; if (typeof code !== "string" || !/^\d{6}$/u.test(code.trim())) throw new Error("请输入 6 位验证码"); const result = await api("/api/user/login/2fa", { method: "POST", body: JSON.stringify({ code: code.trim() }) }) as { id?: number } | undefined; const loginUserId = Number(result?.id); if (Number.isInteger(loginUserId) && loginUserId > 0) { state.userId = loginUserId; await save(); } await restore(); if (user === undefined) throw new Error("二次验证成功，但未能读取账号信息，请重试"); return { ok: true, value: { snapshot: await snapshot() } }; }
    if (endpoint === "logout") { await api("/api/user/logout"); hideAigc(); state.userId = undefined; await save(); await restoreManual(); return { ok: true, value: await snapshot() }; }
    if (endpoint === "tokens") return { ok: true, value: (await tokens()).filter(usable).map((t) => ({ id: t.id, name: t.name || "", orgId: t.org_id || 0, group: t.group || "" })) };
    if (endpoint === "select-token") { const selected = (await tokens()).find((t) => t.id === Number((payload as { id?: number }).id) && usable(t)); if (selected === undefined) throw new Error("所选 Key 不可用"); await activate(selected); return { ok: true, value: await snapshot() }; }
    if (endpoint === "create-token") { const before = new Set((await tokens()).map((token) => token.id)); await api("/api/token/", { method: "POST", body: JSON.stringify({ name: "TokensHarness", expired_time: -1, unlimited_quota: true, remain_quota: 0, model_limits_enabled: false, model_limits: "", allow_ips: "", group: "", cross_group_retry: false }) }); const selected = (await tokens()).filter((token) => !before.has(token.id)).sort((a, b) => b.id - a.id)[0]; if (selected === undefined) throw new Error("未找到新建的 Key"); await activate(selected); return { ok: true, value: await snapshot() }; }
    if (endpoint === "aigc-mount") { await showAigc(payload); return { ok: true, value: { mounted: true } }; }
    if (endpoint === "aigc-hide") { hideAigc(); return { ok: true, value: { hidden: true } }; }
    throw new Error(`unknown account endpoint ${endpoint}`);
  } catch (error) { return failure(error); } };
  ctx.effect(() => connection.rpc.handle("/tokens-account", dispatch, { authority: "trusted-host" }), "tokens-core: account rpc channel");
  ctx.effect(() => () => { hideAigc(); aigc?.webContents.close(); apiWindow?.close(); apiWindow = undefined; }, "tokens-core: account native views");
}
