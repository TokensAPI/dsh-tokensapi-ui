// 技能库 list — styled to the ELECTRO X visual language (electrox.cloud):
// breadcrumb + oversized display title + mono TOTAL counter, and cards with a
// LIVE chip, `v… · USED …×` meta, tag chips, a divider, a `/path · 详情 →` row,
// and a cut-corner green CTA. Recipe classes (.theme-card / .theme-chip /
// .theme-button-primary / .theme-cut-corner / .theme-display) come from the
// design system; --theme-* tokens drive the palette.
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
          <div className={styles.headLeft}>
            <div className={styles.crumb}>
              <span className={styles.dot} aria-hidden="true" /> SKILLS <span className={styles.slash}>//</span> 技能库
            </div>
            <h2 className={clsx("theme-display", styles.title)}>技能库</h2>
            <p className={styles.subtitle}>将技能添加到 Agent，赋能业务流程，提升执行能力。</p>
          </div>
          <div className={styles.actions}>
            <input
              className={styles.search}
              type="search"
              placeholder="搜索技能名称 / 描述 / 标签"
              aria-label="搜索技能"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className={styles.added} title="已添加技能数量">
              已添加 <span className={styles.addedNum}>{addedCount}</span>
            </span>
            <button type="button" className={clsx("theme-button-primary", "theme-cut-corner", styles.add)}>
              新增技能
            </button>
          </div>
        </header>

        <div className={styles.total}>
          <span className={styles.slash}>//</span> TOTAL <span className={styles.totalNum}>{visible.length}</span>
        </div>

        {visible.length === 0 ? (
          <p className={styles.empty}>没有匹配的技能。换个分类或搜索词试试。</p>
        ) : (
          <div className={styles.grid}>
            {visible.map((skill) => (
              <article key={skill.id} className={clsx("theme-card", "theme-corners", styles.card)}>
                <i aria-hidden="true" />
                <div className={styles.cardTop}>
                  <div className={styles.chips}>
                    <span className="theme-chip" data-active={skill.status === "live" || undefined}>
                      {skill.status === "live" ? "LIVE" : "BETA"}
                    </span>
                    <span className="theme-chip">SKILL</span>
                  </div>
                  <span className={styles.meta}>
                    v{skill.version} · USED {skill.usage.toLocaleString()}×
                  </span>
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

                <div className={styles.divider} />

                <div className={styles.cardMeta}>
                  <span className={styles.path}>/{skill.id}</span>
                  <span className={styles.detail}>详情 →</span>
                </div>

                <button
                  type="button"
                  className={clsx(
                    skill.added ? "theme-button-secondary" : "theme-button-primary",
                    skill.added ? undefined : "theme-cut-corner",
                    styles.cardAction,
                  )}
                  disabled={skill.added}
                >
                  {skill.added ? "✓ 已添加" : "添加到 Agent →"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
