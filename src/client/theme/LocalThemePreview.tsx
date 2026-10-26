import { useState } from "react";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import { getLocalThemeMode, getOrganizationSkin, setLocalThemeMode, type LocalThemeMode } from "./local-preview.ts";
import { setActiveSkin } from "./inject.ts";

export function LocalThemePreview(): React.JSX.Element {
  const [mode, setMode] = useState(getLocalThemeMode);
  return (
    <section aria-label="本地主题预览" style={{ padding: "12px 0" }}>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <span>本地主题预览</span>
        <select aria-label="本地主题预览" value={mode} onChange={(event) => {
          const next = event.target.value as LocalThemeMode;
          setLocalThemeMode(next);
          setMode(next);
          setActiveSkin(getOrganizationSkin());
        }}>
          <option value="auto">自动（按组织）</option>
          <option value="clean">基础主题</option>
          <option value="electrox">合作方主题</option>
        </select>
      </label>
      <p style={{ color: "var(--theme-fg-muted)", fontSize: 12 }}>仅本地构建可用。选择会保存在此客户端；切回自动即可恢复组织主题。</p>
    </section>
  );
}
