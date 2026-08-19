// 技能库 list skeleton: category rail + action bar + three-column card grid over
// mock data. Cards use the design-system recipe classes (.theme-card /
// .theme-chip / .theme-button-primary) plus local layout. Detail page and the
// add-to-agent closure are a later iteration.
import { useMemo, useState } from "react";
import clsx from "clsx";
import { SKILL_CATEGORIES, SKILLS, type SkillCategoryId } from "./mock.ts";
import styles from "./SkillsList.module.css";

export function SkillsList(): React.JSX.Element {
  const [category, setCategory] = useState<SkillCategoryId>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SKILLS.filter((skill) => {
      const inCategory = category === "all" || skill.category === category;
      const inQuery =
        q === "" ||
        skill.name.toLowerCase().includes(q) ||
        skill.summary.toLowerCase().includes(q) ||
        skill.tags.some((tag) => tag.toLowerCase().includes(q));
      return inCategory && inQuery;
    });
  }, [category, query]);

  const addedCount = SKILLS.filter((skill) => skill.added).length;

  const countFor = (id: SkillCategoryId): number =>
    id === "all" ? SKILLS.length : SKILLS.filter((skill) => skill.category === id).length;

  return (
    <div className={styles.layout}>
      <aside className={styles.rail} aria-label="技能分类">
        {SKILL_CATEGORIES.map((item) => (
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
        <header className={styles.head}>
          <div>
            <h2 className={clsx("theme-display", styles.title)}>技能库</h2>
            <p className={styles.subtitle}>为当前 Agent 添加能力，随对话一起使用。</p>
          </div>
          <div className={styles.actions}>
            <input
              className={styles.search}
              type="search"
              placeholder="搜索技能名称、描述或标签"
              aria-label="搜索技能"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className={styles.added} title="已添加技能数量">
              已添加 {addedCount}
            </span>
            <button type="button" className={clsx("theme-button-primary", styles.add)}>
              新增技能
            </button>
          </div>
        </header>

        {visible.length === 0 ? (
          <p className={styles.empty}>没有匹配的技能。换个分类或搜索词试试。</p>
        ) : (
          <div className={styles.grid}>
            {visible.map((skill) => (
              <article key={skill.id} className={clsx("theme-card", "theme-corners", styles.card)}>
                <i aria-hidden="true" />
                <div className={styles.cardTop}>
                  <span className="theme-chip" data-active={skill.status === "live" || undefined}>
                    {skill.status === "live" ? "LIVE" : "BETA"}
                  </span>
                  <span className={styles.meta}>SKILL / v{skill.version}</span>
                </div>
                <h3 className={styles.cardTitle}>{skill.name}</h3>
                <p className={styles.cardSummary}>{skill.summary}</p>
                <div className={styles.tags}>
                  {skill.tags.map((tag) => (
                    <span key={tag} className="theme-chip">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className={styles.cardFoot}>
                  <span className={styles.usage}>USED {skill.usage.toLocaleString()}×</span>
                  <button
                    type="button"
                    className={clsx(
                      skill.added ? "theme-button-secondary" : "theme-button-primary",
                      styles.cardAction,
                    )}
                    disabled={skill.added}
                  >
                    {skill.added ? "已添加" : "添加到 Agent"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
