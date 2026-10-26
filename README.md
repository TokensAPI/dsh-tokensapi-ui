# dsh-tokensapi-ui

TokensHarness 的核心 DSH 插件：为 DeepSeek Harness Web/Desktop 提供两套产品主题：

- TokensAPI 基础主题：Lake View 深色与浅色方案，面板使用不透明背景。
- ELECTRO X / 粒刻合作方主题。

主题根据当前 `TOKENSAPI_API_KEY` 所属组织自动应用：组织 ID 为 **3** 时使用
ELECTRO X，其余组织、个人 Key、未配置 Key 或查询失败时使用基础主题。
设置中不再提供主题选择，旧的本地主题选择记录也不再生效。

客户端启动及收到 `credentials/reference-updated` 的 Key 变更通知时，通过现有
连接向本插件 Host 请求主题快照。Host 使用凭据服务中的 Key 查询
`https://tokensapi.ai/api/current/organization`；同一 Key 的并发和重复请求共用内存结果。
Key 切换后重新查询，查询期间保留当前主题，结果明确后才切换，旧请求不能覆盖新 Key 的主题。
RPC 断线时保留已确认主题；组织查询失败则使用基础主题，并对同一 Key 冷却 30 秒，
之后遇到 Key 通知或连接重建才重试，不轮询。服务端单独调整组织归属需要重启应用后刷新。
Key 不发送给客户端，组织查询缓存不写入磁盘。未挂载凭据服务时使用基础主题。

无需真实组织 Key 即可验证：Node.js 24 下运行 `pnpm dev:theme-lab`，打开输出的本地地址，
点击“运行全部验证场景”。验证页复用实际 Host 和主题代码，使用虚构 Key 及模拟组织响应，
记录组织请求次数与 DOM 主题切换次数，覆盖重复通知、慢响应、快速换 Key、断线与失败冷却。
此页不会接触真实凭据或请求 TokensAPI；Desktop 原生窗口效果仍须在实际客户端验证。

从 v0.2.27 起要求 DSH / Harness 至少为 `0.2.1-rc.2`，运行时兼容范围为
`>=0.2.1-rc.2 <0.3.0-0`；已在 TokensCowork v0.7.6 验证。开发用的 0.1 SDK 类型
通过少量结构化接口适配 0.2 公共服务，不代表插件仍支持 0.1 运行时。

插件同时提供技能库、工具库和原生自动化入口。技能库使用真实 `skill.list` 目录，
支持本地上传、内置精选安装、详情查看和当前任务调用。TokensAPI 账号登录与 AIGC
入口当前暂不随插件启用。

DSH 0.2 中，合作方顶部的技能库、知识库、工具库注册到宿主 `main` 页面插槽，
自动化共用宿主 `schedules` 页面。顶部与左侧导航使用同一份页面选择状态，互相切换
不会残留覆盖层；重复点击当前顶部入口保持在该页。顶部品牌栏仍由主题提供，主内容
布局由宿主管理。旧客户端缺少该导航接口时保留原有覆盖层兼容路径。

自动化新任务统一使用 DSH 原生 `schedule_*` 工具，在原会话接收定时指令；合作方
导航的「自动化」直接打开宿主 `schedules` 页面，基础主题沿用宿主侧栏入口。
本插件不再包含旧 `automation_*` 工具、RPC、调度器或管理页面。首次启动会自动迁移
`$DSH_HOME/tokens-automation/ledger-v1.json`（默认 `~/.dsh`）中的启用任务：先保存
原始账本 `.pre-native.bak`，再停用旧任务，然后通过原生公开服务创建任务。历史运行
记录原样保存在账本和备份中；暂停、已结束的任务仅归档，不重新启用。

迁移优先使用可用的原会话；原会话不存在、已归档、属于子代理、需格式升级或工作目录
不匹配时，自动创建持久化的专用会话。迁移后固定会话承接执行与结果，旧版的独立执行
会话、结果回传和通知过滤语义不再保留。原版 agent/skill 展示字段仍在备份中。

每天、每周及每月的计划使用迁移时宿主时区，每周/每月从旧 `nextRunAt` 推导日期。
每月 29–31 日改用日历 cron，没有该日期的月份跳过；周期任务不补跑历史欠账。
已过期的一次性任务在迁移后约一分钟补执行。具体变更逐项写入 `.migration.json`。
迁移报告含旧任务 ID、名称、目标会话和原生任务 ID；提示词末尾的来源标记用于恢复
创建成功但响应丢失的情况。完成记录防止再次导入，包括用户后来主动删除原生任务时。

跨进程迁移锁、原子替换及逐项进度防止双调度和盲目重试。遇到不明创建结果、损坏数据
或外部改写时停止相关迁移。启动迁移在后台运行，最多等待 30 秒，开始前先独占写入
`.migration-attempt.json`。无论成功、失败、超时或进程中断，以后启动都不再自动尝试。
无法写入尝试标记时直接跳过。没有界面弹窗、状态轮询或反复错误日志；首次失败只记一条
警告，尽力保留本地诊断和原始备份，不阻塞客户端使用。已经提交的原生调用不能强制撤销，
超时后不会再发起后续任务；返回较晚的调用仍可能完成。
异常项仅供人工诊断恢复，必须先检查报告和原生任务，不能直接删除标记或报告并重跑。
迁移必须在停止旧客户端之后启动新版本；不要同时运行仍含旧调度器的旧客户端。

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

本地构建在「设置 → 通用」提供「本地主题预览」：自动（按组织）、基础主题、
合作方主题。选择仅保存在此客户端，重启后保留；切回自动立即恢复最新组织主题。
只要构建环境存在 `CI` 或 `GITHUB_ACTIONS` 标记，该入口和覆盖逻辑就会被编译移除，
旧的本地预览记录不影响 CI 包。发布流程额外检查最终 bundle，防止误带调试入口。

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
