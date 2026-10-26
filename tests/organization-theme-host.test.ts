import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationThemeHost } from "../src/organization-theme-host.ts";

const hosts: OrganizationThemeHost[] = [];
const clean = { skin: "clean", organizationId: null };
const partner = { skin: "electrox", organizationId: 3 };
const identity = (organization: unknown) => Response.json({ success: true, data: { organization } });
const deferred = <T>() => Promise.withResolvers<T>();

function mount(read: () => Promise<string>, fetch: typeof globalThis.fetch, onError = vi.fn()) {
  const host = new OrganizationThemeHost(read, { fetch, onError });
  hosts.push(host);
  return host;
}

afterEach(() => {
  for (const host of hosts.splice(0)) host.dispose();
  vi.useRealTimers();
});

describe("organization-selected theme Host", () => {
  it("uses the current Key to select organization 3 without exposing credential or user data", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({
      success: true,
      data: { organization: { id: 3, name: "Partner", status: 1 }, user: { id: 12, quota: 999 } },
    }));
    const host = mount(async () => "sk-partner-secret", fetch);
    expect(await host.snapshot()).toEqual(partner);
    expect(fetch).toHaveBeenCalledWith("https://tokensapi.ai/api/current/organization", {
      headers: { Authorization: "Bearer sk-partner-secret", Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: expect.any(AbortSignal),
    });
  });

  it.each([null, { id: 9, status: 1 }, { id: 3, status: 0 }])(
    "keeps the default for a personal, other or disabled organization: %j", async (organization) => {
      const host = mount(async () => "sk-personal", vi.fn(async () => identity(organization)));
      const result = await host.snapshot();
      expect(result.skin).toBe("clean");
    },
  );

  it("does not request identity without a usable Key", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    let key = "";
    const host = mount(async () => key, fetch);
    for (const invalid of ["", "not-a-key", "sk-a\nInjected: header"]) {
      key = invalid;
      expect(await host.snapshot()).toEqual(clean);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shares a single lookup across concurrent clients and repeated reads of the same Key", async () => {
    const response = deferred<Response>();
    const fetch = vi.fn<typeof globalThis.fetch>(() => response.promise);
    const host = mount(async () => "sk-shared", fetch);
    const first = host.snapshot();
    const second = host.snapshot();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    response.resolve(identity({ id: 3, status: 1 }));
    expect(await Promise.all([first, second])).toEqual([partner, partner]);
    expect(await host.snapshot()).toEqual(partner);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("aborts a previous Key and rejects its late partner response after switching", async () => {
    let key = "sk-old";
    const response = deferred<Response>();
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockImplementationOnce(() => response.promise)
      .mockResolvedValueOnce(identity({ id: 9, status: 1 }));
    const host = mount(async () => key, fetch);
    const old = host.snapshot();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const oldSignal = fetch.mock.calls[0]![1]!.signal!;
    key = "sk-new";
    expect(await host.snapshot()).toEqual({ skin: "clean", organizationId: 9 });
    expect(oldSignal.aborted).toBe(true);
    response.resolve(identity({ id: 3, status: 1 }));
    expect(await old).toEqual(clean);
    expect(await host.snapshot()).toEqual({ skin: "clean", organizationId: 9 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("clears partner identity when the Key is removed and queries again if it is restored", async () => {
    let key = "sk-partner";
    const fetch = vi.fn<typeof globalThis.fetch>(async () => identity({ id: 3, status: 1 }));
    const host = mount(async () => key, fetch);
    expect(await host.snapshot()).toEqual(partner);
    key = "";
    expect(await host.snapshot()).toEqual(clean);
    key = "sk-partner";
    expect(await host.snapshot()).toEqual(partner);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not let a slow credential read cancel or overwrite a newer Key's lookup", async () => {
    const oldKey = deferred<string>();
    const read = vi.fn<() => Promise<string>>()
      .mockReturnValueOnce(oldKey.promise).mockResolvedValue("sk-new");
    const fetch = vi.fn<typeof globalThis.fetch>(async () => identity({ id: 3, status: 1 }));
    const host = mount(read, fetch);
    const old = host.snapshot();
    expect(await host.snapshot()).toEqual(partner);
    oldKey.resolve("sk-old");
    expect(await old).toEqual(partner);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]![1]!.headers).toMatchObject({ Authorization: "Bearer sk-new" });
  });

  it.each([401, 403])("defaults a rejected Key (%s)", async (status) => {
    const host = mount(async () => "sk-rejected", vi.fn(async () => new Response("rejected", { status })));
    expect(await host.snapshot()).toEqual(clean);
  });

  it.each([
    () => new Response("unavailable", { status: 503 }),
    () => new Response("invalid JSON"),
    () => Response.json({ success: false, data: { organization: { id: 3, status: 1 } } }),
    () => identity({ id: "3", status: 1 }),
    () => identity({ id: 3 }),
  ])("defaults malformed or unavailable identity and permits a later recovery", async (reply) => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(reply()).mockResolvedValueOnce(identity({ id: 3, status: 1 }));
    const host = mount(async () => "sk-private", fetch, onError);
    expect(await host.snapshot()).toEqual(clean);
    expect(onError).toHaveBeenCalledExactlyOnceWith();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await host.snapshot()).toEqual(partner);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("caps failed same-Key lookups during a notification burst without delaying a different Key", async () => {
    vi.useFakeTimers();
    let key = "sk-offline";
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("still offline"))
      .mockResolvedValueOnce(identity({ id: 3, status: 1 }));
    const host = mount(async () => key, fetch);
    expect(await host.snapshot()).toEqual(clean);
    for (let index = 0; index < 100; index++) expect(await host.snapshot()).toEqual(clean);
    expect(fetch).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(await host.snapshot()).toEqual(clean);
    expect(fetch).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await host.snapshot()).toEqual(clean);
    expect(fetch).toHaveBeenCalledTimes(2);
    key = "sk-new-partner";
    expect(await host.snapshot()).toEqual(partner);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out a lookup, clears its timer, and allows retry after recovery", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>((_input, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const host = mount(async () => "sk-timeout", fetch);
    const first = host.snapshot();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await first).toEqual(clean);
    expect(vi.getTimerCount()).toBe(0);
    fetch.mockResolvedValueOnce(identity({ id: 3, status: 1 }));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await host.snapshot()).toEqual(partner);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops lookups on disposal even while a credential read is pending", async () => {
    const key = deferred<string>();
    const read = vi.fn(() => key.promise);
    const fetch = vi.fn<typeof globalThis.fetch>();
    const host = mount(read, fetch);
    const pending = host.snapshot();
    host.dispose();
    key.resolve("sk-partner");
    expect(await pending).toEqual(clean);
    expect(await host.snapshot()).toEqual(clean);
    expect(read).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("aborts an active request on disposal and never publishes its late identity", async () => {
    const response = deferred<Response>();
    const fetch = vi.fn<typeof globalThis.fetch>(() => response.promise);
    const host = mount(async () => "sk-partner", fetch);
    const pending = host.snapshot();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    host.dispose();
    expect(fetch.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    response.resolve(identity({ id: 3, status: 1 }));
    expect(await pending).toEqual(clean);
    expect(await host.snapshot()).toEqual(clean);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
