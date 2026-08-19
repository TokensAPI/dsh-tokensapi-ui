// Post-install celebration + onboarding modal. Shown after a successful upload
// or bundled install: confirms the skill landed, teaches the 3-step usage, and
// its primary CTA returns to the current conversation with `/name ` prefilled so
// the user can start immediately.
import { useEffect } from "react";
import clsx from "clsx";
import styles from "./InstallSuccessDialog.module.css";

export function InstallSuccessDialog({
  name,
  onClose,
  onGoUse,
}: {
  name: string;
  onClose: () => void;
  onGoUse: () => void;
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
      if (event.key === "Enter") onGoUse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onGoUse]);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="安装完成" onClick={onClose}>
      <div className={clsx("theme-card", styles.card)} onClick={(event) => event.stopPropagation()}>
        <div className={styles.badge} aria-hidden="true">
          ✓
        </div>
        <h2 className={styles.title}>安装完成</h2>
        <p className={styles.lead}>
          <code className={styles.cmd}>/{name}</code> 已加入你的技能库，可在任意对话中调用。
        </p>

        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            返回一个对话（有当前对话就回到它，否则新建）。
          </li>
          <li>
            <span className={styles.stepNum}>2</span>
            在输入框输入 <code className={styles.inline}>/{name}</code>（点下方按钮已自动为你填好）。
          </li>
          <li>
            <span className={styles.stepNum}>3</span>
            补充你的具体需求，按回车发送即可调用该技能。
          </li>
        </ol>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            留在技能库
          </button>
          <button type="button" className={clsx("theme-button-primary", "theme-cut-corner", styles.primary)} onClick={onGoUse}>
            返回对话并填入 /{name} →
          </button>
        </div>
      </div>
    </div>
  );
}
