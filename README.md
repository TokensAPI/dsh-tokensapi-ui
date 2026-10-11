# dsh-tokensapi-ui

TokensHarness 的核心 DSH 插件：为 DeepSeek Harness Web/Desktop 提供两套产品主题：

- TokensAPI 基础主题：Lake View 深色与浅色方案，面板使用不透明背景。
- ELECTRO X / 粒刻合作方主题。

插件同时提供技能库、工具库和自动化页面。技能库使用真实 `skill.list` 目录，
支持本地上传、内置精选安装、详情查看和当前任务调用。TokensAPI 账号登录与 AIGC
入口当前暂不随插件启用。

玻璃面板实验实现保留在 `src/client/theme/disabled/`：`glass-panels.css` 保存
材质和文字效果，`GlassPanelOptions.tsx` 保存开关、持久化和显式样式注入代码。
当前主题不导入该模块、不注入这些样式，也不挂载设置入口；旧开关记录不会启用效果。
为玻璃样式识别浮层的动态 DOM 监控也保留在该目录的 `floating-surfaces.ts`，当前不注册。

普通 DSH（cordis）插件，host + client 两半，随 `dsh web` 与 Desktop 一同加载。
包名和注册名均为 `dsh-tokensapi-ui`。本机 Desktop 覆盖包使用独立别名
`dsh-tokensapi-ui-local`，host 与 client 必须使用相同别名。

## 开发

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build       # tsdown → lib/index.js (host) + lib/client.js (client)
pnpm typecheck
pnpm watch       # 改 src 自动重建
```

产品源码以本仓库为准，不要修改 TokensHarness 中的只读副本。
`pnpm build` / `pnpm watch` 只更新 `lib/`，不会更新客户端使用的覆盖包。

```bash
pnpm dev:local      # 构建并同步 dist/local-profile-override，保留旧 lib 备份
pnpm doctor:local   # 只读检查 profile 的解析路径、别名、exports 和产物哈希
```

本机 profile 需已安装并启用 `dsh-tokensapi-ui-local`，关闭内置同名产品插件；
同步脚本不会替你修改 profile。默认检查 `~/.dsh/profiles/desktop`，其他 profile
可运行 `pnpm doctor:local -- <profile目录>`。同步后退出并重新打开 Desktop。
诊断证明磁盘加载链路一致，不能证明正在运行的进程已经重新加载。

样式职责、拆分等价性证明和实机验收范围见 [架构与验证约定](docs/architecture.md)。

## 发布（GitHub Releases 交付）

发布前在本地运行 `pnpm test`、`pnpm typecheck`、`pnpm build` 和 `git diff --check`。
CI 保持仅构建和打包，以缩短发布耗时。

打一个与 `package.json` `version` 匹配的 `v*` 标签即触发 `.github/workflows/release.yml`：

```bash
# 先 bump package.json 的 version 并提交
git tag v<version>
git push origin v<version>
```

CI 会：`pnpm build` → `node scripts/make-release.mjs` 打出
`dist/dsh-tokensapi-ui-<version>.tgz` + `dist/manifest.json` → 发布为 GitHub Release。

`manifest.json` 供桌面「更新代理」读取，决定热更方式：

```jsonc
{
  "name": "dsh-tokensapi-ui",
  "version": "<version>",
  "tarball": "dsh-tokensapi-ui-<version>.tgz",
  "tarballSha256": "…",   // 下载完整性校验
  "clientSha256": "…",    // lib/client.js 哈希
  "hostSha256": "…",      // lib/index.js 哈希：与本地不同 → 需重启；相同 → 客户端静默热更
  "minHarness": "0.1.1-rc.2",
  "yanked": false,        // 急停开关
  "publishedAt": "…"
}
```

## 更新模型（概览）

- 安装包内置一份**基线**作为地板与安全网；运行时从**可写的 profile** 加载。
- 更新代理查 `releases/latest`，比对 `version`（取 `max(bundle, profile)`，绝不降级）。
- 纯客户端改动（`hostSha256` 未变）→ 覆盖 `lib/client.js` → 前端刷新，静默生效。
- host 改动（`hostSha256` 变）→ 提示重启。
- 载入失败或不兼容（`minHarness` 不满足）→ 回退到基线。
