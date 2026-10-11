// Read-only diagnosis of the package resolved by a Desktop profile.
import { readFileSync, realpathSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteClientModuleId, rewriteHostAlias, verifyOverride } from "./sync-local-override.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = resolve(process.argv[2] ?? join(homedir(), ".dsh", "profiles", "desktop"));
const alias = "dsh-tokensapi-ui-local";
const sha256 = (body) => createHash("sha256").update(body).digest("hex");

try {
  const profileManifest = JSON.parse(readFileSync(join(profile, "package.json"), "utf8"));
  const dependency = profileManifest.dependencies?.[alias];
  if (!dependency) throw new Error(`Profile has no ${alias} dependency`);
  const require = createRequire(join(profile, "package.json"));
  const manifestPath = require.resolve(`${alias}/package.json`);
  const packageRoot = dirname(manifestPath);
  const expectedRoot = join(root, "dist", "local-profile-override");
  console.log(`profile: ${profile}`);
  console.log(`dependency: ${dependency}`);
  console.log(`resolved package: ${realpathSync(packageRoot)}`);
  if (realpathSync(packageRoot) !== realpathSync(expectedRoot)) {
    throw new Error("Profile resolves a different override directory");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const source = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (manifest.name !== alias || manifest.version !== source.version) {
    throw new Error("Override name/version differs from source");
  }
  if (!manifest.dsh?.client || manifest.exports?.["./package.json"] !== "./package.json") {
    throw new Error("Override client metadata or package.json export is missing");
  }
  verifyOverride(join(packageRoot, "lib"));
  for (const [file, rewrite] of [["index.js", rewriteHostAlias], ["client.js", rewriteClientModuleId]]) {
    const built = readFileSync(join(root, "lib", file), "utf8");
    const installedPath = join(packageRoot, "lib", file);
    const installed = readFileSync(installedPath, "utf8");
    if (installed !== rewrite(built)) throw new Error(`${file} is stale; run pnpm dev:local`);
    console.log(`${file}: ${sha256(installed)} (${statSync(installedPath).mtime.toISOString()})`);
  }
  console.log(`version: ${manifest.version}; host/client aliases and disk bundles match.`);
  console.log("Restart Desktop before testing. This checks disk resolution, not the running renderer or profile enablement.");
} catch (error) {
  console.error(`doctor-local: ${error.message}`);
  process.exitCode = 1;
}
