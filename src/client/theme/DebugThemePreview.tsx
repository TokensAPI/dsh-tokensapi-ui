import { useSyncExternalStore } from "react";
import { getDebugOrganizationSkin, getDebugThemeState, setDebugThemeMode, subscribeDebugTheme } from "./debug-preview.ts";
import { setActiveSkin } from "./inject.ts";
import { ThemeChoices } from "./ThemeChoices.tsx";

/** Present in release builds, visible only after the Host confirms access. */
export function DebugThemePreview(): React.JSX.Element | null {
  const { userId, mode } = useSyncExternalStore(subscribeDebugTheme, getDebugThemeState);
  if (userId === null) return null;
  return (
    <ThemeChoices label="主题调试" value={mode} onChange={(next) => {
      setDebugThemeMode(next);
      setActiveSkin(getDebugOrganizationSkin());
    }} description="仅影响当前客户端，按账号保存；选择“自动”恢复组织主题。" />
  );
}
