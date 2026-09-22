// Sync the built plugin into the desktop's "local profile override" package
// (dist/local-profile-override) and rewrite the module registration alias.
//
// WHY: the TokensCowork desktop client loads an independently named override
// package (`dsh-tokensapi-ui-local`) rather than the published `lib/` bundle.
// That override must register the SAME alias in BOTH its host (lib/index.js)
// and client (lib/client.js) bundles, otherwise the loader rejects the bundle
// or the embedded product plugin stays active — and editing src/ without
// re-syncing the override makes the running UI appear unchanged.
//
// See AGENTS.md → "Desktop UI debugging": before treating an unchanged client
// UI as a failed code change, prove which package is loaded (timestamp/hash,
// loader entry, module registration name).
//
// IMPORTANT rewrite scope (matches the host's own convention):
//   - index.js (host):   every `dsh-tokensapi-ui` identifier becomes
//                        `dsh-tokensapi-ui-local` (the Cordis `name`, the
//                        logger prefix, and the `*-refresh` registration).
//   - client.js (web):   ONLY the `__ModuleLoader__.load({ id: ... })` value.
//                        The skin/theme CSS-module tag ids and `data-plugin`
//                        markers intentionally keep the original name; they
//                        are not the module registration id.
//
// Usage:
//   pnpm build                              # emits lib/
//   pnpm sync:local                         # sync + rewrite alias
// Or in one go:
//   pnpm dev:local                          # build && sync-local-override
//
// The script never touches skills/, licenses/, package.json — it only stages
// the lib/ artifacts into the override, backing up any existing lib/ first.
//
// The rewrite helpers are exported as pure functions so the alias contract can
// be regression-tested (tests/local-override-alias.test.ts) without triggering
// any filesystem side effects. Run the sync only when executed directly.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const OVERRIDE_NAME = "dsh-tokensapi-ui-local";

const libDir = join(root, "lib");
const overrideDir = join(root, "dist", "local-profile-override", "lib");

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

function fail(msg) {
  console.error(`sync-local-override: ${msg}`);
  process.exit(1);
}

// Host bundle: rewrite every plugin identifier to the override alias.
export function rewriteHostAlias(source) {
  const before = "dsh-tokensapi-ui";
  const after = OVERRIDE_NAME;
  if (before === after) throw new Error("alias invariant");
  // `dsh-tokensapi-ui-refresh` -> `dsh-tokensapi-ui-local-refresh`:
  // do the -refresh form first so the suffix is not double-prefixed below.
  let out = source.replace(
    new RegExp(`${before}-refresh(?!-local)`, "g"),
    `${after}-refresh`,
  );
  // Any remaining bare identifier -> override name.
  out = out.replace(new RegExp(`${before}(?!-local|-)`, "g"), after);
  return out;
}

// Client bundle: only the ModuleLoader registration id is renamed.
export function rewriteClientModuleId(source) {
  const anchor = 'id: "dsh-tokensapi-ui"';
  const replacement = `id: "${OVERRIDE_NAME}"`;
  if (!source.includes(anchor)) {
    throw new Error("client bundle module-loader id anchor not found");
  }
  return source.replace(anchor, replacement);
}

// Verify the alias landed in both bundles and the client kept its other ids.
export function verifyOverride(overrideLibDir) {
  const host = readFileSync(join(overrideLibDir, "index.js"), "utf8");
  const client = readFileSync(join(overrideLibDir, "client.js"), "utf8");
  if (!host.includes(`name = "${OVERRIDE_NAME}"`)) {
    throw new Error(`host alias not applied (expected name = "${OVERRIDE_NAME}")`);
  }
  if (!client.includes(`id: "${OVERRIDE_NAME}"`)) {
    throw new Error(`client module id not applied (expected id: "${OVERRIDE_NAME}")`);
  }
  if (!client.includes('tag.dataset.plugin = "dsh-tokensapi-ui"')) {
    throw new Error("client data-plugin markers were unexpectedly rewritten");
  }
}

function writeAndReport(file, content) {
  const dest = join(overrideDir, file);
  writeFileSync(dest, content);
  console.log(`  ${file}  (${sha256(dest).slice(0, 16)})`);
}

function main() {
  for (const required of ["index.js", "client.js"]) {
    if (!existsSync(join(libDir, required))) {
      fail(`missing built artifact lib/${required} (run \`pnpm build\` first)`);
    }
  }

  console.log(`sync-local-override: staging lib/ into ${overrideDir}`);
  if (existsSync(overrideDir)) {
    // Keep a timestamped backup so a bad build can be reverted in place.
    const stamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
    const bakDir = join(root, "dist", "local-profile-override", `lib.bak-${stamp}`);
    cpSync(overrideDir, bakDir, { recursive: true });
    console.log(`  backed up previous override to ${basename(bakDir)}`);
    rmSync(overrideDir, { recursive: true, force: true });
  }
  cpSync(libDir, overrideDir, { recursive: true });

  const hostSrc = readFileSync(join(overrideDir, "index.js"), "utf8");
  const clientSrc = readFileSync(join(overrideDir, "client.js"), "utf8");
  writeAndReport("index.js", rewriteHostAlias(hostSrc));
  writeAndReport("client.js", rewriteClientModuleId(clientSrc));

  // Copy the sourcemaps so the override remains debuggable in the browser.
  for (const file of ["index.js.map", "client.js.map"]) {
    const src = join(libDir, file);
    if (existsSync(src)) cpSync(src, join(overrideDir, file));
  }

  try {
    verifyOverride(overrideDir);
  } catch (err) {
    fail(err.message);
  }

  console.log("sync-local-override: done.");
  console.log(`  override host name    : ${OVERRIDE_NAME}`);
  console.log(`  override client id    : ${OVERRIDE_NAME}`);
  console.log(
    `  host bundle sha256    : ${sha256(join(overrideDir, "index.js")).slice(0, 16)}`,
  );
  console.log(
    `  client bundle sha256  : ${sha256(join(overrideDir, "client.js")).slice(0, 16)}`,
  );
  console.log("  Reload / restart the client to pick up the override.");
}

// Run only when executed directly (not when imported by tests).
const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
