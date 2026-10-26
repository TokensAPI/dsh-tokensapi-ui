import { DEFAULT_THEME, type OrganizationTheme } from "./shared/organization-theme.ts";

const ORGANIZATION_URL = "https://tokensapi.ai/api/current/organization";
const PARTNER_ORGANIZATION_ID = 3;
const REQUEST_TIMEOUT_MS = 8_000;
const FAILURE_COOLDOWN_MS = 30_000;

/** One in-memory lookup per current Key, shared by all connected clients. */
export class OrganizationThemeHost {
  private readonly fetch: typeof globalThis.fetch;
  private readonly onError: () => void;
  private key: string | undefined;
  private cached: Promise<OrganizationTheme> | undefined;
  private retryAfter = 0;
  private controller: AbortController | undefined;
  private readRevision = 0;
  private latest: Promise<OrganizationTheme> | undefined;
  private disposed = false;

  constructor(
    private readonly readApiKey: () => Promise<string>,
    options: { fetch?: typeof globalThis.fetch; onError?: () => void } = {},
  ) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.onError = options.onError ?? (() => {});
  }

  snapshot(): Promise<OrganizationTheme> {
    if (this.disposed) return Promise.resolve(DEFAULT_THEME);
    const request = this.resolve(++this.readRevision);
    this.latest = request;
    return request;
  }

  dispose(): void {
    this.disposed = true;
    this.readRevision++;
    this.controller?.abort();
    this.key = undefined;
    this.cached = undefined;
    this.retryAfter = 0;
  }

  private async resolve(revision: number): Promise<OrganizationTheme> {
    let key: string;
    try {
      key = (await this.readApiKey()).trim();
    } catch {
      // A credential provider failure must not retain another account's theme.
      if (!this.disposed && revision === this.readRevision) this.onError();
      return DEFAULT_THEME;
    }
    if (this.disposed) return DEFAULT_THEME;
    // A slow credential read cannot cancel a newer account's request.
    if (revision !== this.readRevision) return this.latest ?? DEFAULT_THEME;
    if (key === this.key && this.cached !== undefined &&
      (this.retryAfter === 0 || Date.now() < this.retryAfter)) return this.cached;

    this.controller?.abort();
    this.controller = undefined;
    this.key = key;
    this.retryAfter = 0;
    if (!/^sk-\S{1,509}$/u.test(key)) {
      this.cached = Promise.resolve(DEFAULT_THEME);
      return this.cached;
    }

    const controller = new AbortController();
    this.controller = controller;
    this.cached = this.lookup(key, controller).catch(() => {
      // Repeated notifications during an outage must not flood the endpoint.
      // A later event can retry after the cooldown; no timer or polling is used.
      if (!this.disposed && this.controller === controller) {
        this.retryAfter = Date.now() + FAILURE_COOLDOWN_MS;
        this.onError();
      }
      return DEFAULT_THEME;
    });
    return this.cached;
  }

  private async lookup(key: string, controller: AbortController): Promise<OrganizationTheme> {
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetch(ORGANIZATION_URL, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (this.disposed || controller.signal.aborted) return DEFAULT_THEME;
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) return DEFAULT_THEME;
        throw new Error("organization lookup unavailable");
      }
      const body = await response.json() as {
        success?: unknown;
        data?: { organization?: { id?: unknown; status?: unknown } | null };
      } | null;
      if (this.disposed || controller.signal.aborted) return DEFAULT_THEME;
      if (body?.success !== true || body.data?.organization === undefined) {
        throw new Error("invalid organization response");
      }
      const organization = body.data.organization;
      if (organization === null) return DEFAULT_THEME;
      if (typeof organization.status !== "number" || !Number.isInteger(organization.status)) {
        throw new Error("invalid organization status");
      }
      if (organization.status !== 1) return DEFAULT_THEME;
      if (typeof organization.id !== "number" || !Number.isSafeInteger(organization.id) || organization.id <= 0) {
        throw new Error("invalid organization id");
      }
      return {
        skin: organization.id === PARTNER_ORGANIZATION_ID ? "electrox" : "clean",
        organizationId: organization.id,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
