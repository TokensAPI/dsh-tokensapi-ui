// Empty-state placeholder for capability modules not yet built (knowledge /
// automation / tools). Proves the top-nav switch works this iteration.
import styles from "./ModulePlaceholder.module.css";

export function ModulePlaceholder({ title }: { title: string }): React.JSX.Element {
  return (
    <div className={styles.wrap}>
      <span className={styles.tag}>COMING SOON</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>该模块正在建设中。本轮先打通主题与外壳，随后按需求逐个补齐。</p>
    </div>
  );
}
