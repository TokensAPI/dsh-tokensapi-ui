import { API_KEY_REF, DEFAULT_SKIN, type SkinId } from "../../shared/organization-theme.ts";

export interface OrganizationThemeRuntime {
  read(): Promise<unknown>;
  onCredentialChange(listener: (ref: string) => void): () => void;
  onConnectionReset(listener: () => void): () => void;
}

let activeOwner: symbol | undefined;

/** Apply Host-selected branding on startup, Key changes and connection recovery. */
export function observeOrganizationTheme(
  runtime: OrganizationThemeRuntime,
  applySkin: (skin: SkinId) => void,
): () => void {
  const owner = Symbol();
  activeOwner = owner;
  let disposed = false;
  let revision = 0;
  const current = (): boolean => !disposed && activeOwner === owner;
  const refresh = (): void => {
    if (!current()) return;
    const request = ++revision;
    // Keep the resolved branding while refreshing. Notifications can repeat for
    // the same Key, and resetting first would flash clean -> partner each time.
    void runtime.read().then((value) => {
      if (!current() || request !== revision) return;
      const skin = (value as { skin?: unknown } | null)?.skin;
      applySkin(skin === "electrox" ? "electrox" : DEFAULT_SKIN);
    }).catch(() => {
      // A lost RPC connection is not a new identity. Keep the last result until
      // the Host can answer again; startup still uses the default.
    });
  };
  const stopCredentials = runtime.onCredentialChange((ref) => {
    if (ref === API_KEY_REF) refresh();
  });
  const stopConnection = runtime.onConnectionReset(refresh);
  applySkin(DEFAULT_SKIN);
  refresh();
  return () => {
    if (disposed) return;
    disposed = true;
    revision++;
    stopCredentials();
    stopConnection();
    if (activeOwner !== owner) return;
    activeOwner = undefined;
    applySkin(DEFAULT_SKIN);
  };
}
