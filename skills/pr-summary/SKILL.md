---
name: pr-summary
description: 把已暂存的改动汇总成一份规范的 PR 标题与描述（含变更要点、动机、验证方式）。
---

# PR Summary

当用户需要生成 Pull Request 描述时：

1. 运行 `git diff --staged`（无暂存内容则用 `git diff`）与 `git log --oneline -n 10` 了解上下文。
2. 产出：
   - **标题**：一行，遵循 Conventional Commits（如 `feat(scope): ...`）。
   - **变更要点**：条目式列出关键改动（做了什么、影响面）。
   - **动机**：为什么改（解决的问题/需求）。
   - **验证方式**：如何测试/已验证的内容。
3. 语言与仓库既有 PR 风格保持一致；不臆造未发生的改动。

> 这是 tokens-core 附带的示例技能，可替换为你们自己的精选集。
