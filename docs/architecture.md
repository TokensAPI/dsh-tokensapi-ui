# 架构与验证约定

## 修改入口

产品改动在本仓库完成。host 入口是 `src/index.ts`，client 入口是
`src/client/index.tsx`。`src/shared/automation-contract.ts` 只存跨端类型，
不得引入 Node、DOM 或宿主 runtime。自动化 endpoint 的返回类型由共享 map
推导，现有中文存储枚举保持不变；改存储值必须另做迁移。

运行时绑定和能力注册返回 disposer，由 client 的 `ctx.effect` 管理。
清理函数只清理本次绑定，旧 owner 不得清理 replacement。scheduler 卸载后
不接受新请求、不建立新 timer；已进入执行器的任务完成执行和落盘。
写入失败向调用方返回错误，不阻断后续写入队列；调度错误由 host logger 报告。

## 样式层次

注入顺序固定：`theme-contract.css` → 已注册 skin → `dsh-bridge.css` →
`chrome.css`。前者定义语义 token 和 recipe，skin 提供产品值，bridge 对接
宿主 token。模块自己的布局放在相应 `*.module.css`。

`chrome.css` 是宿主适配的有序清单，按原始连续区间拆成：

1. `chrome/shell-composer.css`：壳层、Desktop 兼容与 composer 基础规则。
2. `chrome/questions-clean.css`：clean 问题卡片。
3. `chrome/questions-partner.css`：合作方问题卡片。
4. `chrome/settings-controls.css`：设置弹窗与控件。
5. `chrome/composer-paint.css`：后置 composer 外观覆盖。
6. `chrome/popovers.css`：菜单、浮层和焦点规则。

顺序是现有 cascade 的一部分。某些 composer 规则分在前后两处是为了保留
覆盖顺序；本次不合并重复规则，也不修改选择器。宿主生成 class 子串和文案
选择器是兼容回退，新增规则需注明触发 DOM 和适用范围。clean 不接管宿主
窗口几何，合作方仅在产品 bar 挂载时保留 72px。interactive ancestor 不加滤镜。
玻璃效果及其 observer 在 `theme/disabled/` 保存，活动入口不导入、不注册。

plain CSS 清单只使用独立行的 `@import "./relative.css";`，不使用 media/layer
import。`scripts/read-css.mjs` 在构建时递归内联并登记 watch 输入；缺失文件和
循环引用直接报错。这里的 import 不依赖浏览器运行时请求。

## 拆分的一致性证明

基线是 `3097cad` 的完整 `chrome.css`。`tests/fixtures/chrome-baseline.json`
记录源码（统一换行）及 LightningCSS 压缩结果的 SHA-256。
`tests/theme-css-equivalence.test.ts` 检查两个哈希，并检查所有拆分文件进入
watch 集合。这保证本次机械拆分没有丢失、更改或重排任何规则。

以后有意改样式时，哈希测试应先失败。review 具体样式差异并做对应行为验证后，
才更新 fixture 的 baseline 说明和两个哈希；不能为消除失败盲目刷新基线。
无需有意修改样式的生命周期重构必须继续满足原基线。

## 验证范围

发布前本地执行测试、类型检查、构建和 diff check；发布 CI 不重复这些步骤。
DOM 行为测试覆盖焦点、observer 收敛、注册替换与卸载等可观察行为。
保留必要的静态隔离和安全约束，避免断言内部类名或局部变量名。

浏览器及 Happy DOM 无法验收 native material、Electron 合成和 hit testing。
实机记录 Desktop 版本、插件版本、OS、主题、窗口材质和 advanced mode。
检查设置打开/关闭后的鼠标与键盘焦点、弹窗边界及文字清晰度。Mac 无法重现
只能证明当前组合未触发问题，不能倒推所有旧版本或用户配置都正常。

`doctor:local` 检查磁盘上的 profile 加载链路；重新启动后才验收运行效果。
