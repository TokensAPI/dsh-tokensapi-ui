// 技能库 detail — one skill's routing metadata (from the already-fetched
// SkillEntry) in the ELECTRO X language: breadcrumb + name, invocability badge,
// description, optional whenToUse, and the `/name` command with a copy button.
// The full SKILL.md body needs the reference plugin's '/skill-plaza' host
// channel (deferred) — a placeholder marks where it will slot in.
import { useState } from "react";
import clsx from "clsx";
import { copySkillCommand, deleteSkill, useOwnedSkills, useSkillInCurrentTask, type SkillEntry } from "./data.ts";
import styles from "./SkillDetail.module.css";

export function SkillDetail({ skill, onBack }: { skill: SkillEntry; onBack: () => void }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const owned = useOwnedSkills();
  const isOwned = owned.has(skill.name);

  const onCopy = async (): Promise<void> => {
    const ok = await copySkillCommand(skill.name);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const onDelete = async (): Promise<void> => {
    setDeleting(true);
    setDelError(null);
    const result = await deleteSkill(skill.name);
    setDeleting(false);
    if (result.ok) onBack();
    else setDelError(result.code);
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
            onClick={() => void useSkillInCurrentTask(skill.name)}
          >
            在当前任务中使用
          </button>
          <button
            type="button"
            className={clsx("theme-button-secondary", styles.copy)}
            onClick={onCopy}
          >
            {copied ? "✓ 已复制" : "复制命令"}
          </button>
        </div>
        <p className={styles.hint}>粘贴到输入框并发送即可调用（走 slash 管线）。</p>
      </section>

      {isOwned ? (
        <section className={clsx("theme-card", styles.block, styles.danger)}>
          <div className={styles.blockLabel}>// 用户技能根</div>
          {!confirming ? (
            <div className={styles.commandRow}>
              <p className={styles.hint}>这是安装在本机技能根的技能，可以删除。</p>
              <button type="button" className={styles.deleteBtn} onClick={() => setConfirming(true)}>
                删除技能
              </button>
            </div>
          ) : (
            <div className={styles.commandRow}>
              <p className={styles.hint}>确认删除 /{skill.name}？此操作不可撤销。</p>
              <span className={styles.confirmActions}>
                <button type="button" className={styles.deleteBtn} disabled={deleting} onClick={() => void onDelete()}>
                  {deleting ? "删除中…" : "确认删除"}
                </button>
                <button type="button" className={styles.cancelBtn} disabled={deleting} onClick={() => setConfirming(false)}>
                  取消
                </button>
              </span>
            </div>
          )}
          {delError !== null ? <p className={styles.delError}>删除失败：{delError}</p> : null}
        </section>
      ) : null}

      <p className={styles.deferred}>
        // SKILL.md 正文预览：后续版本提供。
      </p>
    </div>
  );
}
