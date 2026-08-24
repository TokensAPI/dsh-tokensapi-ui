// Package the built plugin into a release tarball + manifest.
//
// Produces (under dist/):
//   - <name>-<version>.tgz   — an npm-shaped tarball (files under `package/`)
//     containing exactly the runtime payload: lib/ + skills/ + licenses/ +
//     package.json + cordis.patch.yml + README.md. Built explicitly (not `npm pack`) to dodge
//     the "files field vs .gitignore" gotcha that would drop the gitignored lib/.
//   - manifest.json          — what the desktop update agent reads to decide
//     between a silent client hot-swap and a restart:
//       { name, version, tarball, tarballSha256, clientSha256, hostSha256,
//         minHarness, yanked, publishedAt }
//     The agent compares hostSha256 against the installed copy: same → client
//     hot-swap; different → restart required.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const { name, version } = pkg;

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

for (const required of ["lib/index.js", "lib/client.js"]) {
  if (!existsSync(required)) {
    console.error(`make-release: missing built artifact ${required} (run pnpm build first)`);
    process.exit(1);
  }
}

// Stage the runtime payload under dist/package/ (npm tarball convention).
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/package", { recursive: true });
for (const item of ["lib", "skills", "licenses", "package.json", "cordis.patch.yml", "README.md"]) {
  if (existsSync(item)) cpSync(item, join("dist/package", item), { recursive: true });
}

const tarball = `${name}-${version}.tgz`;
execFileSync("tar", ["-czf", join("dist", tarball), "-C", "dist", "package"]);

const manifest = {
  name,
  version,
  tarball,
  tarballSha256: sha256(join("dist", tarball)),
  clientSha256: sha256("lib/client.js"),
  hostSha256: sha256("lib/index.js"),
  minHarness: pkg.dsh?.minHarness ?? null,
  yanked: false,
  publishedAt: new Date().toISOString(),
};
writeFileSync("dist/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`make-release: ${tarball} (client ${manifest.clientSha256.slice(0, 12)}, host ${manifest.hostSha256.slice(0, 12)})`);
