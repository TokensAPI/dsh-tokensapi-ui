import { useMemo, useState } from "react";
import { ONLINE_TOOLS, type OnlineTool } from "./data.ts";
import styles from "./ToolsModule.module.css";

const CATEGORIES = ["全部", "金蝶", "吉客云", "数据处理"] as const;
type Category = (typeof CATEGORIES)[number];

export function ToolsModule(): React.JSX.Element {
  const [selected, setSelected] = useState<OnlineTool | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("全部");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const tools = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return ONLINE_TOOLS.filter((tool) => {
      if (category !== "全部" && tool.category !== category) return false;
      if (needle === "") return true;
      return [tool.name, tool.description, ...tool.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [category, query]);

  if (selected !== null) {
    return (
      <section className={`${styles.root} ${styles.detail}`}>
        <header className={styles.detailHead}>
          <button className={`theme-button-secondary ${styles.back}`} type="button" onClick={() => setSelected(null)}>
            ← 返回工具库
          </button>
          <div className={styles.detailCopy}>
            <h2 className={styles.detailTitle}>{selected.name}</h2>
            <p className={styles.detailDescription}>{selected.description}</p>
          </div>
        </header>
        {notice !== null ? (
          <div className={styles.notice} data-kind={notice.kind} role="status">
            {notice.text}
            <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button>
          </div>
        ) : null}
        <ToolFrame tool={selected} onError={(message) => setNotice({ kind: "error", text: message })} />
      </section>
    );
  }

  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <div>
          <div className={styles.crumb}><span /> ONLINE TOOLS <b>//</b> 在线工具</div>
          <h1 className={`theme-display ${styles.title}`}>开箱即用.</h1>
          <p className={styles.subtitle}>在客户端内直接使用粒刻现有在线工具。</p>
        </div>
        <input
          className={styles.search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索工具名称或用途"
          aria-label="搜索工具"
        />
      </header>

      {notice !== null ? (
        <div className={styles.notice} data-kind={notice.kind} role="status">
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button>
        </div>
      ) : null}

      <nav className={styles.filters} aria-label="工具分类">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            className={styles.filter}
            data-active={category === item || undefined}
            type="button"
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
        <span className={styles.count}>TOTAL {tools.length}</span>
      </nav>

      {tools.length === 0 ? (
        <div className={styles.empty}>没有匹配的工具，请调整分类或搜索词。</div>
      ) : (
        <div className={styles.grid}>
          {tools.map((tool, index) => (
            <article key={tool.id} className={`theme-card theme-corners ${styles.card}`} onClick={() => setSelected(tool)}>
              <div className={styles.cardTop}>
                <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.live}>● ONLINE</span>
              </div>
              <h2 className={styles.cardTitle}>{tool.name}</h2>
              <p className={styles.description}>{tool.description}</p>
              <div className={styles.tags}>
                {tool.tags.map((tag) => <span key={tag} className="theme-chip">{tag}</span>)}
              </div>
              <footer className={styles.footer}>
                <span className={styles.path}>/{tool.id}</span>
                <button
                  className={`theme-button-primary theme-cut-corner ${styles.action}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(tool);
                  }}
                >
                  立即使用 →
                </button>
              </footer>
              <i />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ToolFrame({ tool, onError }: { tool: OnlineTool; onError: (message: string) => void }): React.JSX.Element {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={styles.frameShell}>
      {!loaded ? <div className={styles.frameLoading}>正在加载在线工具…</div> : null}
      <iframe
        className={styles.toolFrame}
        src={tool.runUrl}
        title={tool.name}
        sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => onError("内嵌页面加载失败，请改用浏览器打开。")}
      />
      <a className={styles.externalLink} href={tool.runUrl} target="_blank" rel="noopener noreferrer">
        在浏览器中打开 ↗
      </a>
    </div>
  );
}
