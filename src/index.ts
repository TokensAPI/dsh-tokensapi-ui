// tokens-core host half.
//
// An ordinary DSH (Cordis) function plugin — NOT a Desktop plugin: it stays on
// official DSH contracts so it loads under `dsh web` as well as inside Desktop.
// The Loader imports this module for the entry `name: tokens-core` and calls
// apply(ctx) once at load.
//
// It owns the '/tokens-skills' RPC channel: the write plane behind the browser
// 技能库 (install/read/delete over the user skill root `<dshHome>/skills`, plus
// one-click install of the skills bundled with this plugin). The catalog READ
// stays on the official skill.list RPC (client side). This logic is ported from
// the reference skill-plaza host (plugins/tokens_DshSkillsUI_code/index.js),
// self-contained here so tokens-core needs no companion plugin.
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-tokensapi-ui'
export const inject = ['connection']

/** RpcResult shape the Connection transport expects (subset we produce). */
type RpcResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; details: Record<string, unknown> } }

/** Minimal host connection face we use (avoids depending on the connection package). */
interface HostConnection {
  rpc: {
    handle(
      channel: string,
      handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult>,
      options: { authority: "trusted-host" | "loopback" },
    ): () => Promise<void>
  }
}

/** DSH's own skill-name rule (skill/src SKILL_NAME): lowercase kebab-case. */
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Windows reserved device names: a directory named `con` wedges the fs layer. */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/
/** Uploads above this size are refused (mirrors the reference 10 MB cap). */
const MAX_UPLOAD_BYTES = 10 << 20
/** Curated skills shipped beside this plugin (../skills relative to lib/index.js). */
const BUNDLED_DIR = fileURLToPath(new URL("../skills/", import.meta.url))

/** The user-root skill directory this plugin writes to. */
function skillRoot(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), ".dsh")
  return join(home, "skills")
}

/** Business failure in the RpcResult error branch ('internal' is the catch-all). */
function fail(message: string): RpcResult<never> {
  return { ok: false, error: { code: "internal", message, details: {} } }
}

function validName(name: string): boolean {
  return typeof name === "string" && NAME_PATTERN.test(name) && !RESERVED_NAMES.test(name)
}

/** Best-effort kebab-case normalization of a fallback name source (file stem). */
function kebabize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

/** Rewrite the frontmatter `name:` so the discovered command matches the dir. */
function withFrontmatterName(content: string, name: string): string {
  const lines = content.split("\n")
  const start = lines.findIndex((line) => line.trim() === "---")
  if (start < 0) return content
  const end = lines.findIndex((line, i) => i > start && line.trim() === "---")
  if (end < 0) return content
  for (let i = start + 1; i < end; i++) {
    if (/^name\s*:/.test((lines[i] ?? "").trim())) {
      lines[i] = `name: ${name}`
      return lines.join("\n")
    }
  }
  lines.splice(start + 1, 0, `name: ${name}`)
  return lines.join("\n")
}

/** Resolve a validated skill directory, refusing anything escaping the root. */
function skillDir(root: string, name: string): string | undefined {
  const dir = resolve(join(root, name))
  if (dir !== resolve(root) + sep + name) return undefined
  return dir
}

/** Minimal frontmatter reader: { name, description } or undefined. Line-based. */
function readFrontmatter(content: string): { name?: string; description?: string } | undefined {
  const lines = content.split(/\r?\n/)
  let start = 0
  while (start < lines.length && (lines[start] ?? "").trim() === "") start++
  if ((lines[start] ?? "").trim() !== "---") return undefined
  const end = lines.findIndex((line, i) => i > start && line.trim() === "---")
  if (end < 0) return undefined
  const fields: { name?: string; description?: string } = {}
  for (const line of lines.slice(start + 1, end)) {
    const idx = line.indexOf(":")
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    if (key !== "name" && key !== "description") continue
    fields[key] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "")
  }
  return fields
}

/** Locate SKILL.md inside an unzipped table; return the prefix-stripped bundle. */
function bundleOf(files: Record<string, Uint8Array>): Record<string, Uint8Array> | undefined {
  const normalized: Record<string, Uint8Array> = {}
  for (const [rawName, data] of Object.entries(files)) {
    const clean = rawName.replace(/\\/g, "/").replace(/^(\.\/)+/, "")
    normalized[clean] = data
  }
  const names = Object.keys(normalized)
  const marker = names.find((n) => n.toLowerCase() === "skill.md") ?? names.find((n) => /(^|\/)skill\.md$/i.test(n))
  if (marker === undefined) return undefined
  const slash = marker.lastIndexOf("/")
  const prefix = slash < 0 ? "" : marker.slice(0, slash + 1)
  const bundle: Record<string, Uint8Array> = {}
  for (const [zipName, data] of Object.entries(normalized)) {
    if (!zipName.startsWith(prefix) || zipName.endsWith("/")) continue
    let rel = zipName.slice(prefix.length)
    if (rel === "" || rel.split("/").some((part) => part === ".." || part === "" || part === ".")) continue
    if (zipName === marker) rel = "SKILL.md"
    bundle[rel] = data
  }
  return bundle
}

/** Write a validated bundle to `<root>/<name>/`, aligning the frontmatter name. */
async function writeSkill(
  root: string,
  name: string,
  bundle: Record<string, Uint8Array>,
  skillMd: string,
  overwrite: boolean,
): Promise<RpcResult<{ installed: true; name: string }>> {
  const dir = skillDir(root, name)
  if (dir === undefined) return fail("invalid-name")
  if (!overwrite) {
    try {
      await stat(join(dir, "SKILL.md"))
      return fail("exists")
    } catch {
      // Absent skill: the install path.
    }
  }
  await rm(dir, { recursive: true, force: true })
  for (const [rel, data] of Object.entries(bundle)) {
    const dest = resolve(join(dir, rel))
    if (dest !== dir && !dest.startsWith(dir + sep)) continue
    await mkdir(dirname(dest), { recursive: true })
    const body =
      rel === "SKILL.md" ? Buffer.from(withFrontmatterName(skillMd, name), "utf8") : Buffer.from(data)
    await writeFile(dest, body)
  }
  return { ok: true, value: { installed: true, name } }
}

async function inventory(root: string): Promise<RpcResult<{ skills: { name: string }[] }>> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return { ok: true, value: { skills: [] } }
  }
  const skills: { name: string }[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !validName(entry.name)) continue
    try {
      await stat(join(root, entry.name, "SKILL.md"))
      skills.push({ name: entry.name })
    } catch {
      // A directory without SKILL.md is not a skill of ours to report.
    }
  }
  return { ok: true, value: { skills } }
}

async function upload(root: string, payload: unknown): Promise<RpcResult<{ installed: true; name: string }>> {
  const input = (payload ?? {}) as { fileName?: unknown; data?: unknown; name?: unknown; overwrite?: unknown }
  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : ""
  if (typeof input.data !== "string" || input.data === "") return fail("missing-file")
  let bytes: Buffer
  try {
    bytes = Buffer.from(input.data, "base64")
  } catch {
    return fail("invalid-encoding")
  }
  if (bytes.length === 0) return fail("missing-file")
  if (bytes.length > MAX_UPLOAD_BYTES) return fail("too-large")

  const isZip = /\.zip$/i.test(fileName) || (bytes[0] === 0x50 && bytes[1] === 0x4b)
  let bundle: Record<string, Uint8Array> | undefined
  if (isZip) {
    let files: Record<string, Uint8Array>
    try {
      files = unzipSync(new Uint8Array(bytes))
    } catch {
      return fail("invalid-zip")
    }
    bundle = bundleOf(files)
    if (bundle === undefined) return fail("zip-missing-skill-md")
  } else {
    bundle = { "SKILL.md": new Uint8Array(bytes) }
  }

  const skillMd = Buffer.from(bundle["SKILL.md"] as Uint8Array).toString("utf8")
  const frontmatter = readFrontmatter(skillMd)
  if (frontmatter === undefined) return fail("missing-frontmatter")
  if ((frontmatter.description ?? "").trim() === "") return fail("missing-description")

  const resolveOne = (candidate: string): string | undefined => {
    if (candidate === "") return undefined
    if (validName(candidate)) return candidate
    const normalized = kebabize(candidate)
    return validName(normalized) ? normalized : undefined
  }
  const explicit = typeof input.name === "string" ? input.name.trim() : ""
  const stem = fileName.replace(/\.(zip|md)$/i, "").split(/[\\/]/).pop() ?? ""
  let installName: string | undefined
  if (explicit !== "") installName = resolveOne(explicit)
  else installName = resolveOne(frontmatter.name ?? "") ?? resolveOne(stem)
  if (installName === undefined) return fail("invalid-name")

  return writeSkill(root, installName, bundle, skillMd, input.overwrite === true)
}

/** List one installed skill's SKILL.md body plus its bundled resource paths. */
async function read(root: string, payload: unknown): Promise<RpcResult<{ content: string; files: string[] }>> {
  const name = typeof (payload as { name?: unknown })?.name === "string" ? ((payload as { name: string }).name).trim() : ""
  if (!validName(name)) return fail("invalid-name")
  const dir = skillDir(root, name)
  if (dir === undefined) return fail("invalid-name")
  let content: string
  try {
    content = await readFile(join(dir, "SKILL.md"), "utf8")
  } catch {
    return fail("not-found")
  }
  const files: string[] = []
  const walk = async (sub: string): Promise<void> => {
    const entries = await readdir(join(dir, sub), { withFileTypes: true })
    for (const entry of entries) {
      const rel = sub === "" ? entry.name : `${sub}/${entry.name}`
      if (entry.isDirectory()) await walk(rel)
      else if (rel !== "SKILL.md") files.push(rel)
    }
  }
  try {
    await walk("")
  } catch {
    // Resource listing is best-effort; the body is the point.
  }
  return { ok: true, value: { content, files } }
}

async function remove(root: string, payload: unknown): Promise<RpcResult<{ deleted: true }>> {
  const name = typeof (payload as { name?: unknown })?.name === "string" ? ((payload as { name: string }).name).trim() : ""
  if (!validName(name)) return fail("invalid-name")
  const dir = skillDir(root, name)
  if (dir === undefined) return fail("invalid-name")
  try {
    await stat(join(dir, "SKILL.md"))
  } catch {
    return fail("not-found")
  }
  await rm(dir, { recursive: true, force: true })
  return { ok: true, value: { deleted: true } }
}

/** Curated skills shipped with the plugin: name + description + installed flag. */
async function bundledList(
  root: string,
): Promise<RpcResult<{ skills: { name: string; description: string; installed: boolean }[] }>> {
  let entries
  try {
    entries = await readdir(BUNDLED_DIR, { withFileTypes: true })
  } catch {
    return { ok: true, value: { skills: [] } }
  }
  const skills: { name: string; description: string; installed: boolean }[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !validName(entry.name)) continue
    let content: string
    try {
      content = await readFile(join(BUNDLED_DIR, entry.name, "SKILL.md"), "utf8")
    } catch {
      continue
    }
    const fm = readFrontmatter(content)
    let installed = false
    try {
      await stat(join(root, entry.name, "SKILL.md"))
      installed = true
    } catch {
      // not installed
    }
    skills.push({ name: entry.name, description: (fm?.description ?? "").trim(), installed })
  }
  return { ok: true, value: { skills } }
}

/** Copy one bundled skill directory into the user skill root. */
async function bundledInstall(root: string, payload: unknown): Promise<RpcResult<{ installed: true; name: string }>> {
  const name = typeof (payload as { name?: unknown })?.name === "string" ? ((payload as { name: string }).name).trim() : ""
  const overwrite = (payload as { overwrite?: unknown })?.overwrite === true
  if (!validName(name)) return fail("invalid-name")
  const source = skillDir(BUNDLED_DIR, name)
  const dir = skillDir(root, name)
  if (source === undefined || dir === undefined) return fail("invalid-name")
  let skillMd: string
  try {
    skillMd = await readFile(join(source, "SKILL.md"), "utf8")
  } catch {
    return fail("not-found")
  }
  if (!overwrite) {
    try {
      await stat(join(dir, "SKILL.md"))
      return fail("exists")
    } catch {
      // install path
    }
  }
  await rm(dir, { recursive: true, force: true })
  await mkdir(dirname(dir), { recursive: true })
  await cp(source, dir, { recursive: true })
  // Keep the discovered command aligned with the directory name.
  await writeFile(join(dir, "SKILL.md"), Buffer.from(withFrontmatterName(skillMd, name), "utf8"))
  return { ok: true, value: { installed: true, name } }
}

/** Route one '/tokens-skills' endpoint over the user skill root. */
async function dispatch(endpoint: string, payload: unknown): Promise<RpcResult> {
  const root = skillRoot()
  try {
    if (endpoint === "skills/inventory") return await inventory(root)
    if (endpoint === "skills/read") return await read(root, payload)
    if (endpoint === "skills/upload") return await upload(root, payload)
    if (endpoint === "skills/delete") return await remove(root, payload)
    if (endpoint === "bundled/list") return await bundledList(root)
    if (endpoint === "bundled/install") return await bundledInstall(root, payload)
    return fail(`unknown endpoint ${endpoint}`)
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}

export function apply(ctx: Context): void {
  ctx.logger.info("[dsh-tokensapi-ui] host loaded")
  // Mount the channel only when the Connection service is present (headless
  // compositions load the plugin but expose no transport).
  ctx.inject(["connection"], (scoped) => {
    const connection = (scoped as unknown as { connection: HostConnection }).connection
    scoped.effect(
      () => connection.rpc.handle("/tokens-skills", dispatch, { authority: "trusted-host" }),
      "tokens-core: skills rpc channel",
    )
  })
}
