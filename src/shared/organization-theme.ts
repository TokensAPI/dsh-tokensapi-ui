/** Public theme state; credential values never cross this channel. */
export type SkinId = "clean" | "electrox";

export interface OrganizationTheme {
  readonly skin: SkinId;
  readonly organizationId: number | null;
}

export const DEFAULT_SKIN: SkinId = "clean";
export const DEFAULT_THEME: OrganizationTheme = { skin: DEFAULT_SKIN, organizationId: null };
export const THEME_CHANNEL = "/tokens-theme";
export const API_KEY_REF = "TOKENSAPI_API_KEY";
