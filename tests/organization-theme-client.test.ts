// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeOrganizationTheme, type OrganizationThemeRuntime } from "../src/client/theme/organization-theme.ts";
import { injectTheme, setActiveSkin } from "../src/client/theme/inject.ts";
import { OrganizationThemeHost } from "../src/organization-theme-host.ts";

vi.mock("../src/client/theme/theme-contract.css", () => ({ default: "" }));
vi.mock("../src/client/theme/themes/clean.css", () => ({ default: "" }));
vi.mock("../src/client/theme/themes/electrox.css", () => ({ default: "" }));
vi.mock("../src/client/theme/dsh-bridge.css", () => ({ default: "" }));
vi.mock("../src/client/theme/chrome.css", () => ({ default: "" }));

const disposers: Array<() => void> = [];
const partner = { skin: "electrox", organizationId: 3 };
const clean = { skin: "clean", organizationId: null };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness(read = vi.fn<() => Promise<unknown>>(async () => clean)) {
  const credentials = new Set<(ref: string) => void>();
  const resets = new Set<() => void>();
  const runtime: OrganizationThemeRuntime = {
    read,
    onCredentialChange(listener) { credentials.add(listener); return () => { credentials.delete(listener); }; },
    onConnectionReset(listener) { resets.add(listener); return () => { resets.delete(listener); }; },
  };
  const dispose = observeOrganizationTheme(runtime, setActiveSkin);
  disposers.push(dispose);
  return {
    read, dispose, credentials, resets,
    change: (ref = "TOKENSAPI_API_KEY") => { for (const listener of credentials) listener(ref); },
    reset: () => { for (const listener of resets) listener(); },
  };
}

afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose();
  localStorage.clear();
  document.head.replaceChildren();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.colorScheme;
});

describe("automatic organization theme", () => {
  it("ignores a saved partner selection and never persists automatic choices", () => {
    localStorage.setItem("dsh-tokensapi-ui-skin", "electrox");
    disposers.push(injectTheme());
    expect(document.documentElement.dataset.theme).toBe("clean");
    setActiveSkin("electrox");
    setActiveSkin("clean");
    expect(localStorage.getItem("dsh-tokensapi-ui-skin")).toBe("electrox");
  });

  it("queries once on startup and refreshes only for the API Key or connection recovery", async () => {
    const app = harness(vi.fn(async () => partner));
    expect(document.documentElement.dataset.theme).toBe("clean");
    await settle();
    expect(document.documentElement.dataset.theme).toBe("electrox");
    expect(app.read).toHaveBeenCalledOnce();
    app.change("TOKENSAPI_API_KEY_VERIFIED_SHA256");
    app.change("TOKENSAPI_ACCESS_TOKEN");
    app.change("UNRELATED_KEY");
    expect(app.read).toHaveBeenCalledOnce();
    app.change();
    expect(document.documentElement.dataset.theme).toBe("electrox");
    await settle();
    expect(document.documentElement.dataset.theme).toBe("electrox");
    app.reset();
    await settle();
    expect(app.read).toHaveBeenCalledTimes(3);
  });

  it("ignores an old partner response when a later Key belongs to another organization", async () => {
    const old = Promise.withResolvers<unknown>();
    const read = vi.fn<() => Promise<unknown>>()
      .mockReturnValueOnce(old.promise).mockResolvedValueOnce(clean);
    const app = harness(read);
    app.change();
    await settle();
    expect(document.documentElement.dataset.theme).toBe("clean");
    old.resolve(partner);
    await settle();
    expect(document.documentElement.dataset.theme).toBe("clean");
  });

  it("falls back after Key removal or a failed lookup and recovers on reconnect", async () => {
    const app = harness(vi.fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(partner)
      .mockResolvedValueOnce(clean)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(partner));
    await settle();
    expect(document.documentElement.dataset.theme).toBe("electrox");
    app.change();
    await settle();
    expect(document.documentElement.dataset.theme).toBe("clean");
    app.change();
    await settle();
    expect(document.documentElement.dataset.theme).toBe("clean");
    app.reset();
    await settle();
    expect(document.documentElement.dataset.theme).toBe("electrox");
  });

  it("keeps the resolved theme when an RPC connection fails and ignores an outdated failure", async () => {
    const stale = Promise.withResolvers<unknown>();
    const app = harness(vi.fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(partner)
      .mockRejectedValueOnce(new Error("disconnected"))
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(clean));
    await settle();
    app.reset();
    await settle();
    expect(document.documentElement.dataset.theme).toBe("electrox");
    app.reset();
    app.change();
    await settle();
    expect(document.documentElement.dataset.theme).toBe("clean");
    stale.reject(new Error("old connection"));
    await settle();
    expect(document.documentElement.dataset.theme).toBe("clean");
  });

  it.each([null, undefined, { skin: "unknown" }, { organizationId: 3 }])(
    "keeps the default for an invalid Host snapshot: %j", async (value) => {
      harness(vi.fn(async () => value));
      await settle();
      expect(document.documentElement.dataset.theme).toBe("clean");
    },
  );

  it("removes subscriptions and ignores responses after disposal", async () => {
    const response = Promise.withResolvers<unknown>();
    const app = harness(vi.fn(() => response.promise));
    app.dispose();
    expect(app.credentials.size).toBe(0);
    expect(app.resets.size).toBe(0);
    response.resolve(partner);
    app.change(); app.reset();
    await settle();
    expect(document.documentElement.dataset.theme).toBe("clean");
    expect(app.read).toHaveBeenCalledOnce();
  });

  it("does not let a previous mount's cleanup or response reset its replacement", async () => {
    const oldResponse = Promise.withResolvers<unknown>();
    const old = harness(vi.fn(() => oldResponse.promise));
    harness(vi.fn(async () => partner));
    await settle();
    old.dispose();
    oldResponse.resolve(clean);
    await settle();
    expect(document.documentElement.dataset.theme).toBe("electrox");
  });

  it("does not repeat DOM mutations when the same skin is applied", async () => {
    let changes = 0;
    const observer = new MutationObserver((records) => { changes += records.length; });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    try {
      setActiveSkin("electrox");
      await settle();
      expect(changes).toBe(1);
      setActiveSkin("electrox");
      await settle();
      expect(changes).toBe(1);
    } finally { observer.disconnect(); }
  });

  it("keeps partner branding through 100 repeated Key notifications and connection resets with one organization query", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({
      success: true, data: { organization: { id: 3, status: 1 } },
    }));
    const host = new OrganizationThemeHost(async () => "sk-simulated-partner", { fetch });
    disposers.push(() => host.dispose());
    let changes = 0;
    const observer = new MutationObserver((records) => { changes += records.length; });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    try {
      const app = harness(vi.fn(() => host.snapshot()));
      await settle();
      const initialChanges = changes;
      expect(document.documentElement.dataset.theme).toBe("electrox");
      for (let index = 0; index < 100; index++) {
        if (index % 2 === 0) app.change();
        else app.reset();
        await settle();
      }
      expect(app.read).toHaveBeenCalledTimes(101);
      expect(fetch).toHaveBeenCalledOnce();
      expect(changes).toBe(initialChanges);
      expect(document.documentElement.dataset.theme).toBe("electrox");
    } finally { observer.disconnect(); }
  });

  it("waits for a changed Key's organization before changing the DOM theme once", async () => {
    let key = "sk-simulated-partner";
    const response = Promise.withResolvers<Response>();
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ success: true, data: { organization: { id: 3, status: 1 } } }))
      .mockReturnValueOnce(response.promise);
    const host = new OrganizationThemeHost(async () => key, { fetch });
    disposers.push(() => host.dispose());
    const app = harness(vi.fn(() => host.snapshot()));
    await settle();
    let changes = 0;
    const observer = new MutationObserver((records) => { changes += records.length; });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    try {
      key = "sk-simulated-other";
      app.change();
      await settle();
      expect(document.documentElement.dataset.theme).toBe("electrox");
      expect(changes).toBe(0);
      for (let index = 0; index < 20; index++) app.reset();
      await settle();
      expect(fetch).toHaveBeenCalledTimes(2);
      response.resolve(Response.json({ success: true, data: { organization: { id: 9, status: 1 } } }));
      await settle();
      expect(document.documentElement.dataset.theme).toBe("clean");
      await vi.waitFor(() => expect(changes).toBe(1));
    } finally { observer.disconnect(); }
  });
});
