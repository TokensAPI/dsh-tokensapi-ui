import { useState, useSyncExternalStore } from "react";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import { getLocalThemeMode, getOrganizationSkin, setLocalThemeMode } from "./local-preview.ts";
import { setActiveSkin } from "./inject.ts";
import { ThemeChoices } from "./ThemeChoices.tsx";

import { getDebugThemeState, subscribeDebugTheme } from "./debug-preview.ts";

export function LocalThemePreview(): React.JSX.Element | null {
  const [mode, setMode] = useState(getLocalThemeMode);
  const { userId } = useSyncExternalStore(subscribeDebugTheme, getDebugThemeState);
  if (userId !== null) return null;
  return (
    <ThemeChoices label="本地主题预览" value={mode} onChange={(next) => {
      setLocalThemeMode(next);
      setMode(next);
      setActiveSkin(getOrganizationSkin());
    }} description="仅本地构建可用。选择会保存在此客户端；切回自动即可恢复组织主题。" />
  );
}
