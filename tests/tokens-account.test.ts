import { describe, expect, it } from "vitest";
import { resolvedCredentialValue, selectTokensApiDshToken, tokensAccountViewBounds } from "../src/tokens-account.ts";

const token = (id: number, extra: Record<string, unknown> = {}) => ({ id, name: `key-${id}`, status: 1, expired_time: -1, unlimited_quota: true, remain_quota: 0, org_id: 0, accessed_time: id, ...extra });

describe("TokensAPI DSH Key selection", () => {
  it("keeps a usable explicit user selection", () => expect(selectTokensApiDshToken([token(1), token(2)], 1)?.id).toBe(1));
  it("prefers an organization key then recent use", () => expect(selectTokensApiDshToken([token(3), token(2, { org_id: 9 })])?.id).toBe(2));
  it("ignores disabled, expired and exhausted keys", () => expect(selectTokensApiDshToken([token(1, { status: 0 }), token(2, { expired_time: 1 }), token(3, { unlimited_quota: false, remain_quota: 0 }), token(4)])?.id).toBe(4));
});

describe("TokensAPI AIGC view bounds", () => {
  it("normalizes finite desktop bounds", () => expect(tokensAccountViewBounds({ bounds: { x: -3.4, y: 7.6, width: 10, height: 500.2 } })).toEqual({ x: 0, y: 8, width: 320, height: 500 }));
  it("rejects missing or non-finite bounds", () => {
    expect(tokensAccountViewBounds({})).toBeUndefined();
    expect(tokensAccountViewBounds({ bounds: { x: 0, y: 0, width: Number.NaN, height: 500 } })).toBeUndefined();
  });
});

describe("TokensAPI credential compatibility", () => {
  it("treats an unconfigured credential as empty", () => expect(resolvedCredentialValue(undefined)).toBe(""));
  it("reads the configured credential value", () => expect(resolvedCredentialValue({ value: "key" })).toBe("key"));
});
