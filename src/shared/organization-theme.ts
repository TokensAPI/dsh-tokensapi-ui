/** Public theme state; credential values never cross this channel. */
export type SkinId = "clean" | "electrox" | "unififi";

export interface OrganizationTheme {
  readonly skin: SkinId;
  readonly organizationId: number | null;
  /** Only allowlisted accounts receive a debug identity; never an API Key. */
  readonly themeDebugUserId?: number;
}

export const DEFAULT_SKIN: SkinId = "clean";
export const DEFAULT_THEME: OrganizationTheme = { skin: DEFAULT_SKIN, organizationId: null };
export const THEME_CHANNEL = "/tokens-theme";
export const API_KEY_REF = "TOKENSAPI_API_KEY";
