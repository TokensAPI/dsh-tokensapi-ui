# dsh-tokensapi-ui (`tokens-core`)

TokensHarness 的核心 DSH 插件：把 DeepSeek Harness 的 Web/Desktop UI 重塑成
**ELECTRO X / 粒刻** 电竞主题，并提供技能库（真实 `skill.list` 目录 + 本地上传/内置精选安装）。

普通 DSH（cordis）插件，host + client 两半，随 `dsh web` 与 Desktop 一同加载。
npm 包名固定为 `tokens-core`（loader 按此名解析），GitHub 仓库名为 `dsh-tokensapi-ui`。

## 开发

```bash
pnpm install
pnpm build       # tsdown → lib/index.js (host) + lib/client.js (client)
pnpm typecheck
pnpm watch       # 改 src 自动重建
```

在 TokensHarness 主项目里，`plugins/tokens-core` 以 submodule 指向本仓库；
主项目的 `scripts/dev.sh` 驱动 dev web / 同步到桌面 `.build` 预览。

## 发布（GitHub Releases 交付）

打一个与 `package.json` `version` 匹配的 `v*` 标签即触发 `.github/workflows/release.yml`：

```bash
# 先 bump package.json 的 version 并提交
git tag v0.1.0
git push origin v0.1.0
```

CI 会：`pnpm build` → `node scripts/make-release.mjs` 打出
`dist/tokens-core-<version>.tgz` + `dist/manifest.json` → 发布为 GitHub Release。

`manifest.json` 供桌面「更新代理」读取，决定热更方式：

```jsonc
{
  "name": "tokens-core",
  "version": "0.1.0",
  "tarball": "tokens-core-0.1.0.tgz",
  "tarballSha256": "…",   // 下载完整性校验
  "clientSha256": "…",    // lib/client.js 哈希
  "hostSha256": "…",      // lib/index.js 哈希：与本地不同 → 需重启；相同 → 客户端静默热更
  "minHarness": "0.1.0-rc.6",
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
