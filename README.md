# tokens-core

TokensHarness 的核心插件。**普通 DSH web-client 插件**（不是 Desktop 插件），所以能在 `dsh web` 里开发。TypeScript + tsdown 构建，样式走生态正统的 **CSS Modules + `--dsw-*` 设计令牌**。

## 结构

```
src/index.ts                   Host 侧 apply(ctx)             → 构建 → lib/index.js
src/client/index.tsx           Client 侧（React + slot）      → 构建 → lib/client.js
src/client/TokensCoreRow.module.css   CSS Modules + --dsw-* 令牌
src/dsh-client.d.ts            Client 类型 shim（ClientContext/slots）
src/css.d.ts                   `*.module.css` 导入为类名映射
tsdown.config.ts               两产物 + cssModulesPlugin（lightningcss 编译 + 自动注入 <style>）
cordis.patch.yml               insert 行，把插件挂进 profile 插件树
```

UI 通过 slot 接入：组件注册到 `sidebar.footer.action`（侧栏底部）。样式在构建期由 lightningcss 编译进 bundle、运行时自动注入 `<style>`（host 只服务这一个 JS）。

## 样式约定（重要）

`desktop/deepseek-harness/docs/web-styling.md` 明文规定，**禁止 Tailwind / 组件库**：
- `.module.css` + `clsx`；颜色/字体只用 `--dsw-alias-*` 语义令牌，不写字面量颜色 → 自动跟随明暗主题。
- 复杂 UI 复用 `@deepseek-ai/dsh-client-ui-primitives`（`Button`/`Modal`/`Menu`/`Tooltip`/`Toast`…）。

## 开发（在仓库根用 scripts/dev.sh）

```sh
scripts/dev.sh deps  tokens-core     # 首次：pnpm install（本插件 dev 依赖）
scripts/dev.sh build tokens-core     # 构建一次（tsdown）
scripts/dev.sh add   plugins/tokens-core   # 首次：link 进 web profile
# 日常：终端A 监听，终端B 起 web
scripts/dev.sh watch tokens-core     # tsdown --watch
scripts/dev.sh web                   # http://127.0.0.1:3080
```

- 改 `src/client/*.tsx` 或 `*.module.css` → 自动重建 → 浏览器热更。
- 改 `src/index.ts`（host）→ 重启 `dev.sh web`。
- 类型检查：`pnpm typecheck`（`tsc --noEmit`）。
- 卸载：`scripts/dev.sh remove tokens-core`。

## 注意

- Client 类型走本地 `src/dsh-client.d.ts` shim：npm 上的 `@deepseek-ai/dsh-client-*` rc 包会拉未发布依赖（`dsh-compact` 404）装不上；host 类型用 GA 的 `@deepseek-ai/cordis`。用到更多 client API 就扩这个 shim。
- `.npmrc` 关掉了 packageManager 强校验（本包嵌在 yarn 超项目下）。加依赖用 `pnpm install --no-frozen-lockfile`。
