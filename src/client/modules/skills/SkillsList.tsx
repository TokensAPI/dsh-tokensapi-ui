// 技能库 list — the real session skill catalog (official skill.list RPC) plus the
// install plane (local upload + plugin-bundled curated skills, via the
// '/tokens-skills' host channel) in the ELECTRO X visual language.
import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  copySkillCommand,
  installBundled,
  insertSkillCommand,
  showSkillCoach,
  uploadSkillFile,
  useBundledSkills,
  useCurrentSessionId,
  useSkillCatalog,
  type SkillEntry,
} from "./data.ts";
import { workspace } from "../../shell/workspace-store.ts";
import { InstallSuccessDialog } from "./InstallSuccessDialog.tsx";
import styles from "./SkillsList.module.css";

type Category = "all" | "model" | "user" | "bundled";

const CATEGORIES: readonly { id: Category; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "model", label: "可被模型调用" },
  { id: "user", label: "仅用户可用" },
  { id: "bundled", label: "内置精选" },
];

const inCategory = (skill: SkillEntry, category: Category): boolean =>
  category === "all" ||
  (category === "model" ? skill.modelInvocable : category === "user" ? !skill.modelInvocable : false);

/** Host failure messages → friendly copy. */
function errorText(code: string): string {
  const map: Record<string, string> = {
    "missing-file": "没有读到文件内容。",
    "invalid-encoding": "文件编码异常。",
    "too-large": "文件过大（上限 10 MB）。",
    "invalid-zip": "无法解压该 zip。",
    "zip-missing-skill-md": "压缩包里没有找到 SKILL.md。",
    "missing-frontmatter": "SKILL.md 缺少 --- frontmatter。",
    "missing-description": "SKILL.md 的 frontmatter 缺少 description。",
    "invalid-name": "技能名不合法（需小写 kebab-case）。",
    "connection-unavailable": "连接不可用。",
  };
  return map[code] ?? `安装失败：${code}`;
}

type Notice =
  | { kind: "info" | "success" | "error"; text: string }
  | { kind: "confirm"; text: string; file: File };

export function SkillsList({ onOpen }: { onOpen: (skill: SkillEntry) => void }): React.JSX.Element {
  const sessionId = useCurrentSessionId();
  const { state, reload } = useSkillCatalog(sessionId);
  const bundled = useBundledSkills();
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [installed, setInstalled] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    id === "bundled" ? bundled.length : allSkills.filter((skill) => inCategory(skill, id)).length;

  const onCopy = async (name: string): Promise<void> => {
    const ok = await copySkillCommand(name);
    if (!ok) return;
    setCopied(name);
    window.setTimeout(() => setCopied((current) => (current === name ? null : current)), 1500);
  };

  const doUpload = async (file: File, overwrite: boolean): Promise<void> => {
    setNotice({ kind: "info", text: `正在安装 ${file.name}…` });
    const result = await uploadSkillFile(file, overwrite);
    if (result.ok) {
      setNotice(null);
      setInstalled(result.name);
    } else if (result.code === "exists") setNotice({ kind: "confirm", text: `已存在同名技能，覆盖安装？`, file });
    else setNotice({ kind: "error", text: errorText(result.code) });
  };

  const onFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file !== undefined) void doUpload(file, false);
  };

  const onInstallBundled = async (name: string): Promise<void> => {
    setNotice({ kind: "info", text: `正在安装 ${name}…` });
    const result = await installBundled(name);
    if (result.ok) {
      setNotice(null);
      setInstalled(result.name);
    } else setNotice({ kind: "error", text: errorText(result.code) });
  };

  // Return to the current conversation (or the new-chat surface) with the skill
  // command prefilled, then a coaching toast — the "去对话里直接用" path.
  const goUse = (): void => {
    const target = installed;
    setInstalled(null);
    workspace.close();
    window.setTimeout(() => {
      if (target === null) return;
      insertSkillCommand(target);
      showSkillCoach(`已为你填入 /${target}，补充需求后按回车即可调用`);
    }, 150);
  };

  const dialog =
    installed === null ? null : (
      <InstallSuccessDialog name={installed} onClose={() => setInstalled(null)} onGoUse={goUse} />
    );

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
          disabled={category === "bundled" || state.phase !== "ready"}
        />
        <input ref={fileRef} type="file" accept=".md,.zip" hidden onChange={onFile} aria-hidden="true" />
        <button
          type="button"
          className={clsx("theme-button-primary", "theme-cut-corner", styles.add)}
          onClick={() => fileRef.current?.click()}
          title="上传本地 SKILL.md 或 zip 安装到技能根"
        >
          新增技能
        </button>
      </div>
    </header>
  );

  const noticeBar =
    notice === null ? null : (
      <div className={clsx(styles.notice, styles[`notice_${notice.kind}`])} role="status">
        <span>{notice.text}</span>
        {notice.kind === "confirm" ? (
          <span className={styles.noticeActions}>
            <button type="button" className={styles.noticeBtn} onClick={() => void doUpload(notice.file, true)}>
              覆盖
            </button>
            <button type="button" className={styles.noticeBtn} onClick={() => setNotice(null)}>
              取消
            </button>
          </span>
        ) : (
          <button type="button" className={styles.noticeClose} aria-label="关闭" onClick={() => setNotice(null)}>
            ✕
          </button>
        )}
      </div>
    );

  const rail = (
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
  );

  // 内置精选: install cards, independent of the session catalog.
  if (category === "bundled") {
    return (
      <div className={styles.layout}>
        {dialog}
        {rail}
        <section className={styles.main}>
          {header}
          {noticeBar}
          <div className={styles.total}>
            <span className={styles.slash}>//</span> BUNDLED <span className={styles.totalNum}>{bundled.length}</span>
          </div>
          {bundled.length === 0 ? (
            <p className={styles.empty}>没有内置技能。</p>
          ) : (
            <div className={styles.grid}>
              {bundled.map((skill) => (
                <article key={skill.name} className={clsx("theme-card", "theme-corners", styles.card)}>
                  <i aria-hidden="true" />
                  <div className={styles.cardTop}>
                    <div className={styles.chips}>
                      <span className="theme-chip" data-active>内置</span>
                      <span className="theme-chip">SKILL</span>
                    </div>
                  </div>
                  <h3 className={styles.cardTitle}>{skill.name}</h3>
                  <p className={styles.cardSummary}>{skill.description}</p>
                  <div className={styles.divider} />
                  <div className={styles.cardMeta}>
                    <span className={styles.path}>/{skill.name}</span>
                  </div>
                  <button
                    type="button"
                    className={clsx(
                      skill.installed ? "theme-button-secondary" : "theme-button-primary",
                      skill.installed ? undefined : "theme-cut-corner",
                      styles.cardAction,
                    )}
                    disabled={skill.installed}
                    onClick={() => void onInstallBundled(skill.name)}
                  >
                    {skill.installed ? "✓ 已安装" : "安装"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Catalog phases (no-session / loading / error): a single centered placeholder.
  if (state.phase !== "ready") {
    return (
      <div className={styles.layout}>
        {dialog}
        {rail}
        <section className={styles.main}>
          {header}
          {noticeBar}
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
      {dialog}
      {rail}
      <section className={styles.main}>
        {header}
        {noticeBar}

        <div className={styles.total}>
          <span className={styles.slash}>//</span> TOTAL <span className={styles.totalNum}>{visible.length}</span>
        </div>

        {visible.length === 0 ? (
          <p className={styles.empty}>没有匹配的技能。换个分类或搜索词，或从「内置精选」安装。</p>
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
