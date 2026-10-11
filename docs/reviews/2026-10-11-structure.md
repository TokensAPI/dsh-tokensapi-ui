# 代码结构与持续迭代 review

审查基线：`3097cad`。该提交已经完成，未推送。本报告是提交后的独立审查记录，不包含以下问题的修复。

当前验证：55 项测试、`pnpm typecheck`、`pnpm build`、`git diff --check` 通过。Windows DOM 测试不能替代 macOS Electron 实机验收。

## 用户决策与本轮处理

本报告保留原审查结论，后续按主题执行，不按原报告编号推断用户回复中的编号。
发布 CI 不增加测试/类型检查，发布前由本地验证；本地不跑 release 打包，
打包目录清理方式保持现状。本轮不引入 formatter 或新增 CI。

已处理 scheduler 停止与写队列恢复、registration disposer 所有权、runtime
卸载清理、共享自动化返回契约、README 加载路径及只读 doctor。
CSS 按连续区间机械拆分，源码与压缩 CSS 两种哈希对照 `3097cad`；
构建产物确认完整内联展开后的原样 CSS。移除 error boundary 内部类名和
局部变量名的静态断言，保留现有 DOM 故障恢复行为测试。

大型 host 入口仍需后续按业务拆分；本轮优先避免把纯结构整理和技能文件
操作重写混在一起。现有中文存储枚举不迁移，宿主选择器不改写。
架构约定与后续等价基线更新方式见 `docs/architecture.md`。

## 发现（按优先级）

### 1. P1：发布打包会删除本地客户端加载的包及其备份

位置：`scripts/make-release.mjs:32`；`scripts/sync-local-override.mjs:47`。

打包脚本递归删除整个 `dist/`，而本地同步脚本把客户端加载包和回滚备份也放在这个目录。当前 desktop profile 的 dependency/link 已确认指向 `dist/local-profile-override`。因此 agent 在本机验证发布包时执行 `make-release.mjs`，会破坏客户端下一次启动所需的包，并同时删除回滚备份。这是脚本间资源所有权冲突，不只是目录命名问题。本次没有运行打包脚本。

建议：发布仅操作 `dist/release/`，本地包使用独立的 `dist/local-profile-override/`；打包脚本只能清理自己的 staging 目录，所有路径从脚本位置解析。验证方式是临时目录中打包，并确认本地包与备份完整保留。

### 2. P1：自动化调度器在卸载后可能重新启动

位置：`src/automation-host.ts:140`、`:142`。

`dispose()` 只清除当前 timer；timer callback 的 `tick().finally(() => this.arm())` 不检查 disposed 状态。如果卸载发生在 tick 执行中，tick 结束后仍会重新 arm。已经用受控 timer 复现：调用 dispose 后，tick 完成使定时器创建次数从 1 变为 2。开发过程中反复重载插件尤其容易触发。

同一文件还有生命周期相关的薄弱点：`:155` 的写入 Promise 链没有失败恢复，一次写入失败会使后续 `.then()` 持续跳过；`:184` 的初次 commit 在 executor 的 try/finally 外，失败后可能留下 inFlight 标记。这两项由代码路径确认，尚未做故障注入复现。

建议：显式维护 disposed 状态，停止后不 arm；定义正在运行的任务如何结束，持久化失败如何恢复；补充运行中卸载、一次写入失败后重试的行为测试。

### 3. P2：能力注册表的清理不属于某次注册

位置：`src/client/shell/capability-registry.ts:37`、`:41`；`src/client/shell/register-builtins.tsx:12`；`src/client/index.tsx:87`。

同一 id 注册 A 后替换为 B，再调用 A 的 disposer，会直接删除 B。已经执行小复现：清理前列表是 `['new']`，旧 disposer 调用后变为 `[]`。这使注册替换、热重载和第三方能力扩展的顺序变得脆弱。

内置能力又用全局 `registered` 阻止重复注册，入口不接收其 disposer；skills、automation、layout 的运行时服务引用也是全局 setter，没有所属上下文的清理契约。初始化、替换、卸载三种操作缺少统一规则。

建议：disposer 只清理它自己的注册实例；内置注册返回组合 disposer，由 `ctx.effect` 管理。运行时绑定也返回清理函数，或改为实例/context 注入。无需为此引入大型 DI 框架。

### 4. P2：仓库规范与自动化检查不一致

位置：`.github/workflows/release.yml:31`；`AGENTS.md`；`tsconfig.json:17`；`package.json`。

AGENTS 要求发布前执行测试、类型检查、构建和差异检查；release workflow 只安装、构建、打包，且安装使用 `--no-frozen-lockfile`。没有 PR/push 检查 workflow，发布可以绕过本地要求并重新解析依赖。

`typecheck` 只包含 src；tests 和构建配置没有对应类型检查。代码同时存在不同引号、分号和密集单行写法，没有 formatter/lint 命令。agent 容易让本次修改风格随自己的偏好变化，并把“测试执行成功”误认为“测试代码也通过类型检查”。

建议：一个统一 `pnpm check` 命令执行必要检查，PR 和发布复用；CI 使用 frozen lockfile；增加单独的测试/构建配置类型检查；选择一个轻量格式化工具，不用同时引入多个规范系统。DOM 测试使用的 happy-dom 目前通过 Vitest 的已锁定 peer 图提供，建议显式声明为测试依赖。

### 5. P2：宿主兼容补丁与主题样式没有清晰边界

位置：`src/client/theme/chrome.css:249`、`:1598`、`:1729`；`src/client/theme/inject.ts:83`。

chrome.css 当前有 1,791 行、454 处 `!important`，混合 Desktop 几何兼容、两套主题、composer、问题卡片、设置、菜单和焦点逻辑。对 `role=dialog` 的全局规则、生成 class 的子串和中文/英文 placeholder 都可能命中新组件。之前 `_panel` 误匹配设置弹窗，是这种边界缺失的实际例子。

注释称 chrome 是“structural adjustments (no colors)”，实现却包含大量颜色和主题分支。agent 难以根据文件职责判断补丁应该落在哪里，也难以确定后面的规则是否已覆盖前面的规则。

建议：保持 token contract → skin → DSH token bridge → host adapters 的顺序；把适配规则按宿主组件拆成少数文件，例如 desktop、composer/questions、settings/popovers。使用稳定语义 hook；不得避免的 class/placeholder 回退集中放在 adapter 中，注明适用宿主版本和验证样例。先拆边界，再减少重复规则，避免一轮重写所有 CSS。

### 6. P2：部分测试冻结了实现文字，而没有验证行为

位置：`tests/desktop-isolation.test.ts:28`；`tests/clean-theme.test.ts:104`；`tests/capability-workspace.test.tsx`。

静态测试既检查必要的安全约束，也检查类名、变量名、代码片段和具体 CSS 文本。无害的重命名、抽函数或换一种等价选择器会导致失败；反过来，匹配的文字存在也不证明 computed style、focus、hit testing 或 cleanup 正确。agent 因而容易为了通过测试继续堆叠补丁，或者改代码时机械同步断言。

已有 React DOM、原生 select observer 收敛和焦点行为测试是可继续沿用的方向，不需要推倒测试体系。

建议：保留“不得导入 Electron”“停用模块不得进入 bundle”等静态边界检查；其余尽量检查可观察行为。CSS 几何/级联用浏览器 computed style fixture，真实 Desktop material 留在明确的实机验收矩阵。扩充卸载、重载和替换测试，而非为每个内部函数补一份镜像测试。

### 7. P2：前后端业务契约重复，入口承担过多业务逻辑

位置：`src/automation-host.ts:5`；`src/client/modules/automation/data.ts:3`；`src/client/modules/automation/data.ts:20`；`src/index.ts:371`、`:421`、`:495`。

AutomationTask/Run 在两端分别定义，已经出现 host 的 projectPath/sessionId 字段没有进入 client 类型的差异。客户端以泛型 `automationCall<T>` 强制转换 RPC 返回值，不会在编译时验证 endpoint 与 response 是否匹配。频率和状态又直接使用中文展示文字作为存储值，改文案会触及调度与持久化。

Host 的 src/index.ts 同时包含技能包解析、文件写入、RPC 路由、catalog 通知、自动化工具声明和启动 wiring。其规模本身不是问题，问题是读一个 UI 变化往往必须追踪互相混合的协议、业务和宿主细节。

建议：增加不依赖 Node/DOM 的 `src/shared/automation-contract.ts`（类型和 endpoint map），边界校验集中处理；新增状态使用稳定标识并由 UI 映射文案，已有记录须有迁移。技能文件操作和 RPC 路由移到 host/skills，入口只负责组装。不要为了共享类型把 Node 模块导入 client runtime。

### 8. P2：开发文档会把 agent 引导到错误的包和加载路径

位置：`README.md:18`、`:29`；`src/client/index.tsx:1`；`src/client/shell/CapabilityWorkspace.tsx:1`；`src/client/theme/inject.ts:1`。

README 仍称 npm 包名固定为 tokens-core、superproject 子模块为 plugins/tokens-core，实际 manifest 是 dsh-tokensapi-ui，当前客户端使用 dsh-tokensapi-ui-local。多个入口注释还引用不存在的 theme/reskin.css，或称默认是 electrox，实际默认 clean。README 没有明确 `build` 与 `sync:local` 的区别；本次“编译后客户端无变化”就来自这条链路。

AGENTS 已记录很多有价值的故障经验，但这些信息尚未变成少量可执行检查，agent 每次仍要手工证明加载位置。

建议：README 给出唯一入口 `pnpm dev:local`，说明产物位置和何时刷新/重启；增加只读 `doctor:local`，检查 dependency/link、manifest exports、模块 alias、版本、时间/hash 和 bundle 内容。AGENTS 保留宿主所有权、observer 收敛、验证矩阵等长期不变量；操作步骤集中在开发文档，避免两处重复维护。

## 建议的整理顺序

1. 修复目录清理、scheduler dispose 和 registry disposer 三个有明确触发条件的问题，每项带最小行为回归测试。
2. 统一 check/CI、本地安装诊断和 README，先让每次改动可重复验证。
3. 抽共享 RPC 契约和宿主 adapter 边界，然后拆 CSS 与 Host 入口。
4. 逐步替换对实现文字敏感的测试，清理过时注释和未注册 skin 的归属。

不建议一口气引入全局状态框架、完整设计系统或大量抽象。当前 host/client 分离、语义 token、模块页、公开能力注册 API 和已有行为测试可以保留；主要需要明确资源所有权、生命周期和验证入口。
