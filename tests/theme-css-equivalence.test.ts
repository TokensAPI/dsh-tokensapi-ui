import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";
import { readCss } from "../scripts/read-css.mjs";

const sha256 = (source: string | Uint8Array) => createHash("sha256").update(source).digest("hex");
const baseline = JSON.parse(readFileSync(new URL("./fixtures/chrome-baseline.json", import.meta.url), "utf8"));
const entry = fileURLToPath(new URL("../src/client/theme/chrome.css", import.meta.url));

describe("mechanical CSS split equivalence", () => {
  it("preserves every selector, declaration and source-order position", () => {
    const source = readCss(entry).replace(/\r\n/g, "\n");
    expect(sha256(source)).toBe(baseline.sourceSha256);
  });

  it("produces the same compiled stylesheet as the pre-split baseline", () => {
    const source = readCss(entry);
    const { code } = transform({ filename: "chrome.css", code: Buffer.from(source), minify: true });
    expect(sha256(code)).toBe(baseline.compiledSha256);
  });

  it("tracks all sheets for watch builds", () => {
    const inputs = new Set<string>();
    readCss(entry, (file: string) => inputs.add(file));
    expect(inputs.size).toBe(7);
    expect(inputs.has(entry)).toBe(true);
  });
});
