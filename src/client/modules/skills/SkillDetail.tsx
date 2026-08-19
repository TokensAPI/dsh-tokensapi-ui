// 技能库 detail — one skill's routing metadata (from the already-fetched
// SkillEntry) in the ELECTRO X language: breadcrumb + name, invocability badge,
// description, optional whenToUse, and the `/name` command with a copy button.
// The full SKILL.md body needs the reference plugin's '/skill-plaza' host
// channel (deferred) — a placeholder marks where it will slot in.
import { useState } from "react";
import clsx from "clsx";
import { copySkillCommand, type SkillEntry } from "./data.ts";
import styles from "./SkillDetail.module.css";

export function SkillDetail({ skill, onBack }: { skill: SkillEntry; onBack: () => void }): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const onCopy = async (): Promise<void> => {
    const ok = await copySkillCommand(skill.name);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.page}>
      <div className={styles.crumb}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="返回技能库">
          ← 返回
        </button>
        <span className={styles.dot} aria-hidden="true" /> SKILLS <span className={styles.slash}>//</span> 详情
      </div>

      <header className={styles.head}>
        <h2 className={clsx("theme-display", styles.title)}>{skill.name}</h2>
        <span className="theme-chip" data-active={skill.modelInvocable || undefined}>
          {skill.modelInvocable ? "MODEL-INVOCABLE" : "USER-ONLY"}
        </span>
      </header>

      <section className={clsx("theme-card", styles.block)}>
        <div className={styles.blockLabel}>// DESCRIPTION</div>
        <p className={styles.body}>{skill.description}</p>
      </section>

      {skill.whenToUse !== undefined && skill.whenToUse.trim() !== "" ? (
        <section className={clsx("theme-card", styles.block)}>
          <div className={styles.blockLabel}>// WHEN TO USE</div>
          <p className={styles.body}>{skill.whenToUse}</p>
        </section>
      ) : null}

      <section className={clsx("theme-card", styles.block)}>
        <div className={styles.blockLabel}>// COMMAND</div>
        <div className={styles.commandRow}>
          <code className={styles.command}>/{skill.name}</code>
          <button
            type="button"
            className={clsx("theme-button-primary", "theme-cut-corner", styles.copy)}
            onClick={onCopy}
          >
            {copied ? "✓ 已复制" : "复制命令"}
          </button>
        </div>
        <p className={styles.hint}>粘贴到输入框并发送即可调用（走 slash 管线）。</p>
      </section>

      <p className={styles.deferred}>
        // SKILL.md 正文预览：需接入 skill-plaza 通道，后续版本提供。
      </p>
    </div>
  );
}
