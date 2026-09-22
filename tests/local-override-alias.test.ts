import { describe, expect, it } from "vitest";
import {
  rewriteClientModuleId,
  rewriteHostAlias,
} from "../scripts/sync-local-override.mjs";

const OVERRIDE_NAME = "dsh-tokensapi-ui-local";

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
});
