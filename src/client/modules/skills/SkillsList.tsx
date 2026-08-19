// 技能库 list — the real session skill catalog (official skill.list RPC) in the
// ELECTRO X visual language. Cards carry an invocability chip, the skill name +
// routing description, a `/name` command row, and a copy-command CTA (pasting +
// sending runs it through the slash pipeline). Category rail filters by
// model-invocability; the four request phases render dedicated placeholders.
import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  copySkillCommand,
  useCurrentSessionId,
  useSkillCatalog,
  type SkillEntry,
} from "./data.ts";
import styles from "./SkillsList.module.css";

type Category = "all" | "model" | "user";

const CATEGORIES: readonly { id: Category; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "model", label: "可被模型调用" },
  { id: "user", label: "仅用户可用" },
];

const inCategory = (skill: SkillEntry, category: Category): boolean =>
  category === "all" ||
  (category === "model" ? skill.modelInvocable : !skill.modelInvocable);

export function SkillsList({ onOpen }: { onOpen: (skill: SkillEntry) => void }): React.JSX.Element {
  const sessionId = useCurrentSessionId();
  const { state, reload } = useSkillCatalog(sessionId);
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const allSkills = state.phase === "ready" ? state.skills : [];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSkills.filter((skill) => {
      if (!inCategory(skill, category)) return false;
      if (q === "") return true;
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q) ||
        (skill.whenToUse?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allSkills, category, query]);

  const countFor = (id: Category): number =>
    allSkills.filter((skill) => inCategory(skill, id)).length;

  const onCopy = async (name: string): Promise<void> => {
    const ok = await copySkillCommand(name);
    if (!ok) return;
    setCopied(name);
    window.setTimeout(() => setCopied((current) => (current === name ? null : current)), 1500);
  };

  const header = (
    <header className={styles.head}>
      <div className={styles.headLeft}>
        <div className={styles.crumb}>
          <span className={styles.dot} aria-hidden="true" /> SKILLS <span className={styles.slash}>//</span> 技能库
        </div>
        <h2 className={clsx("theme-display", styles.title)}>技能库</h2>
        <p className={styles.subtitle}>会话当前可用的技能；复制 /命令 粘贴发送即可调用。</p>
      </div>
      <div className={styles.actions}>
        <input
          className={styles.search}
          type="search"
          placeholder="搜索技能名称 / 描述"
          aria-label="搜索技能"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={state.phase !== "ready"}
        />
        <button
          type="button"
          className={clsx("theme-button-secondary", styles.add)}
          disabled
          title="上传自有技能（即将支持，需 skill-plaza 通道）"
        >
          新增技能
        </button>
      </div>
    </header>
  );

  // Non-ready phases: a single centered placeholder under the header.
  if (state.phase !== "ready") {
    return (
      <div className={styles.layout}>
        <aside className={styles.rail} aria-hidden="true" />
        <section className={styles.main}>
          {header}
          <div className={styles.state} role="status">
            {state.phase === "no-session" && (
              <>
                <p className={styles.stateTitle}>未连接会话</p>
                <p className={styles.stateHint}>先在左侧开启或选择一个会话，这里会列出它可用的技能。</p>
              </>
            )}
            {state.phase === "loading" && (
              <>
                <div className={styles.loadingBar} aria-hidden="true" />
                <p className={styles.stateHint}>正在读取技能目录…</p>
              </>
            )}
            {state.phase === "error" && (
              <>
                <p className={styles.stateTitle}>读取失败</p>
                <p className={styles.stateHint}>{state.message}</p>
                <button type="button" className={clsx("theme-button-primary", "theme-cut-corner", styles.retry)} onClick={reload}>
                  重试
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.rail} aria-label="技能分类">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.railItem}
            data-active={item.id === category || undefined}
            aria-current={item.id === category ? "true" : undefined}
            onClick={() => setCategory(item.id)}
          >
            <span>{item.label}</span>
            <span className={styles.railCount}>{countFor(item.id)}</span>
          </button>
        ))}
      </aside>

      <section className={styles.main}>
        {header}

        <div className={styles.total}>
          <span className={styles.slash}>//</span> TOTAL <span className={styles.totalNum}>{visible.length}</span>
        </div>

        {visible.length === 0 ? (
          <p className={styles.empty}>没有匹配的技能。换个分类或搜索词试试。</p>
        ) : (
          <div className={styles.grid}>
            {visible.map((skill) => (
              <article key={skill.name} className={clsx("theme-card", "theme-corners", styles.card)}>
                <i aria-hidden="true" />
                <div className={styles.cardTop}>
                  <div className={styles.chips}>
                    <span className="theme-chip" data-active={skill.modelInvocable || undefined}>
                      {skill.modelInvocable ? "MODEL" : "USER-ONLY"}
                    </span>
                    <span className="theme-chip">SKILL</span>
                  </div>
                </div>

                <h3 className={styles.cardTitle}>{skill.name}</h3>
                <p className={styles.cardSummary}>{skill.description}</p>

                <div className={styles.divider} />

                <div className={styles.cardMeta}>
                  <span className={styles.path}>/{skill.name}</span>
                  <button type="button" className={styles.detailLink} onClick={() => onOpen(skill)}>
                    详情 →
                  </button>
                </div>

                <button
                  type="button"
                  className={clsx("theme-button-primary", "theme-cut-corner", styles.cardAction)}
                  onClick={() => onCopy(skill.name)}
                >
                  {copied === skill.name ? "✓ 已复制" : `复制命令 /${skill.name}`}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
