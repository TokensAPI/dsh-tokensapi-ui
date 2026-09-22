import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  rewriteClientModuleId,
  rewriteHostAlias,
  rewritePatchName,
} from "../scripts/sync-local-override.mjs";

const OVERRIDE_NAME = "dsh-tokensapi-ui-local";
const OVERRIDE_DIR = join(process.cwd(), "dist", "local-profile-override");

describe("local-profile-override alias rewrite", () => {
  it("rewrites every host plugin identifier to the override alias", () => {
    const input = [
      'const name = "dsh-tokensapi-ui";',
      'ctx.logger.info("[dsh-tokensapi-ui] host loaded")',
      'name: "dsh-tokensapi-ui-refresh",',
    ].join("\n");

    const out = rewriteHostAlias(input);

    expect(out).toContain(`const name = "${OVERRIDE_NAME}";`);
    expect(out).toContain(`[${OVERRIDE_NAME}] host loaded`);
    expect(out).toContain(`name: "${OVERRIDE_NAME}-refresh",`);
    // The bare name must never survive when it is a full identifier.
    expect(out).not.toContain('name = "dsh-tokensapi-ui"');
    expect(out).not.toContain("[dsh-tokensapi-ui]");
  });

  it("rewrites only the client ModuleLoader registration id", () => {
    const input = [
      'window.__ModuleLoader__.load({',
      '\tid: "dsh-tokensapi-ui",',
      '\t factory: (require) => {',
      '});',
      'const STORAGE_KEY = "dsh-tokensapi-ui-skin";',
      'const tagId = "dsh-tokensapi-ui/StartupLoading.module.css";',
      'tag.dataset.plugin = "dsh-tokensapi-ui";',
    ].join("\n");

    const out = rewriteClientModuleId(input);

    expect(out).toContain(`id: "${OVERRIDE_NAME}"`);
    // Non-registration references (skin key, css-module tag id, data-plugin)
    // must keep the original plugin name.
    expect(out).toContain('"dsh-tokensapi-ui-skin"');
    expect(out).toContain('"dsh-tokensapi-ui/StartupLoading.module.css"');
    expect(out).toContain('tag.dataset.plugin = "dsh-tokensapi-ui"');
  });

  it("rejects a client bundle missing the module-loader id anchor", () => {
    expect(() => rewriteClientModuleId("some other text")).toThrow(
      /module-loader id anchor not found/,
    );
  });

  it("does not double-prefix an already overridden host name", () => {
    const input = 'const name = "dsh-tokensapi-ui-local-refresh";';
    const out = rewriteHostAlias(input);
    // `dsh-tokensapi-ui-local-refresh` must stay `dsh-tokensapi-ui-local-refresh`,
    // not become `dsh-tokensapi-ui-local-local-refresh`.
    expect(out).toContain(`${OVERRIDE_NAME}-refresh`);
    expect(out).not.toContain(`${OVERRIDE_NAME}-local-refresh`);
    expect(out).not.toContain("local-local");
  });

  it("rewrites the bundle patch self-insert id/name to the override alias", () => {
    const input = [
      "- insert:",
      "    - id: dsh-tokensapi-ui",
      "      name: dsh-tokensapi-ui",
    ].join("\n");

    const out = rewritePatchName(input);

    expect(out).toContain(`id: ${OVERRIDE_NAME}`);
    expect(out).toContain(`name: ${OVERRIDE_NAME}`);
    // The line must be the override alias, not the bare original name.
    expect(out).toContain(`- id: ${OVERRIDE_NAME}`);
    expect(out).not.toMatch(/- id: dsh-tokensapi-ui(?!-local)/);
    expect(out).not.toContain("name: dsh-tokensapi-ui\n");
  });

  it("rejects a bundle patch missing the id anchor", () => {
    expect(() => rewritePatchName("no insert here")).toThrow(
      /bundle patch id anchor not found/,
    );
  });
});

describe("staged override manifest for the Desktop client", () => {
  it("exposes ./package.json and declares dsh.client + dsh.bundle.patch (so client-modules mounts it)", () => {
    const manifestPath = join(OVERRIDE_DIR, "package.json");
    if (!existsSync(manifestPath)) return;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name: string;
      version?: string;
      exports?: Record<string, string>;
      dsh?: { client?: { platform: string }; bundle?: { patch: string } };
    };
    expect(manifest.name).toBe(OVERRIDE_NAME);
    // `client-modules` resolves `<pkg>/package.json` through createRequire; a
    // `exports` map that omits `./package.json` throws ERR_PACKAGE_PATH_NOT_EXPORTED
    // and the entry is dropped from the client plugin list.
    expect(manifest.exports?.["./package.json"]).toBe("./package.json");
    // The client loader only mounts a bundle whose dsh.client.platform is "web".
    expect(manifest.dsh?.client?.platform).toBe("web");
    // The host loader applies the bundle patch only when dsh.bundle.patch is set.
    expect(manifest.dsh?.bundle?.patch).toBe("./cordis.patch.yml");
  });
});
