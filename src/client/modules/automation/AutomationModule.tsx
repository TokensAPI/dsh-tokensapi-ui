import { useEffect, useState } from "react";
import styles from "./AutomationModule.module.css";
import { automationCall, type AutomationRun, type AutomationSnapshot, type AutomationTask } from "./data.ts";

type View = "tasks" | "runs";
type Page = "list" | "create";

interface Draft {
  readonly name: string;
  readonly description: string;
  readonly frequency: string;
  readonly time: string;
  readonly agent: string;
  readonly skill: string;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  frequency: "每天",
  time: "08:30",
  agent: "当前 Agent",
  skill: "暂不选择",
};

export function AutomationModule(): React.JSX.Element {
  const [view, setView] = useState<View>("tasks");
  const [page, setPage] = useState<Page>("list");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [store, setStore] = useState<AutomationSnapshot>({ version: 1, revision: 0, tasks: [], runs: [] });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const refresh = async (): Promise<void> => {
      try {
        const snapshot = await automationCall<AutomationSnapshot>("snapshot");
        if (active) { setStore(snapshot); setError(null); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      } finally { if (active) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const refresh = async (): Promise<void> => setStore(await automationCall<AutomationSnapshot>("snapshot"));

  const openCreate = (): void => {
    setDraft(EMPTY_DRAFT);
    setPage("create");
  };

  const saveTask = async (next: Draft): Promise<void> => {
    try {
      const task = await automationCall<AutomationTask>("create", next);
      await refresh(); setPage("list"); setView("tasks"); setError(null);
      setNotice(`“${task.name}”已保存并交由 Host 调度。`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const toggleTask = async (id: string): Promise<void> => {
    const task = store.tasks.find((item) => item.id === id); if (task === undefined) return;
    try { await automationCall("toggle", { id, enabled: !task.enabled }); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const removeTask = async (id: string): Promise<void> => {
    try { await automationCall("delete", { id }); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const runNow = async (task: AutomationTask): Promise<void> => {
    try { await automationCall("run-now", { id: task.id }); await refresh(); setNotice(`“${task.name}”已触发。`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  if (page === "create") {
    return <AutomationCreate draft={draft} onChange={setDraft} onBack={() => setPage("list")} onSave={saveTask} />;
  }

  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <div>
          <div className={styles.crumb}><span /> AUTOMATION <b>//</b> 自动化</div>
          <h1 className={`theme-display ${styles.title}`}>让工作自动发生.</h1>
          <p className={styles.subtitle}>创建计划任务，由本机 Host 持久化并负责调度。</p>
        </div>
        <button className={`theme-button-primary theme-cut-corner ${styles.primary}`} type="button" onClick={() => openCreate()}>
          ＋ 添加自动化
        </button>
      </header>

      <div className={styles.toolbar}>
        <nav className={styles.tabs} aria-label="自动化内容" role="tablist">
          <button type="button" role="tab" aria-selected={view === "tasks"} data-active={view === "tasks" || undefined} onClick={() => setView("tasks")}>定时任务 <small>{store.tasks.length}</small></button>
          <button type="button" role="tab" aria-selected={view === "runs"} data-active={view === "runs" || undefined} onClick={() => setView("runs")}>运行记录 <small>{store.runs.length}</small></button>
        </nav>
        <div className={styles.localBadge}><i /> 本机运行模式 <span>客户端需保持在线</span></div>
      </div>

      {notice !== null ? <div className={styles.notice} role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button></div> : null}
      {error !== null ? <div className={styles.notice} role="alert"><span>自动化服务：{error}</span><button type="button" onClick={() => setError(null)} aria-label="关闭错误">×</button></div> : null}
      {loading ? <div className={styles.noMatch}>正在连接自动化服务…</div> : null}

      {view === "runs" ? (
        store.runs.length === 0 ? <EmptyRuns /> : <RunList runs={store.runs} />
      ) : (
        <>
          {!loading && store.tasks.length === 0 ? <section className={`theme-card theme-corners ${styles.hero}`}>
            <div className={styles.heroSignal} aria-hidden="true"><span>00</span><i /><span>01</span><i /><span>RUN</span></div>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>NO ACTIVE AUTOMATIONS</span>
              <h2>开启你的第一个自动化任务吧</h2>
              <p>从空白任务开始，填写名称、描述和执行时间。</p>
            </div>
            <button className={`theme-button-primary theme-cut-corner ${styles.heroAction}`} type="button" onClick={() => openCreate()}>
              创建第一个任务 →
            </button>
            <i className={styles.heroLine} />
          </section> : !loading ? <TaskList tasks={store.tasks} onToggle={toggleTask} onRun={runNow} onRemove={removeTask} /> : null}
        </>
      )}
    </section>
  );
}

function TaskList({ tasks, onToggle, onRun, onRemove }: { tasks: readonly AutomationTask[]; onToggle: (id: string) => void; onRun: (task: AutomationTask) => void; onRemove: (id: string) => void }): React.JSX.Element {
  return (
    <section className={styles.taskSection} aria-label="定时任务列表">
      <div className={styles.taskHeader}><span>任务</span><span>计划</span><span>运行方式</span><span>状态</span><span>操作</span></div>
      {tasks.map((task) => (
        <article key={task.id} className={styles.taskRow}>
          <div className={styles.taskIdentity}><span className={styles.taskMark}>{task.name.slice(0, 1).toUpperCase()}</span><div><h2>{task.name}</h2><p>{task.description || "未填写任务描述"}</p></div></div>
          <div className={styles.taskMeta}><strong>{task.frequency}</strong><span>{task.time}</span></div>
          <div className={styles.taskMeta}><strong>{task.agent}</strong><span>{task.skill}</span></div>
          <button className={styles.switch} type="button" role="switch" aria-checked={task.enabled} data-active={task.enabled || undefined} onClick={() => onToggle(task.id)}><i /><span>{task.enabled ? "已启用" : "已暂停"}</span></button>
          <div className={styles.rowActions}><button type="button" onClick={() => onRun(task)}>立即运行</button><button type="button" aria-label={`删除任务：${task.name}`} onClick={() => onRemove(task.id)}>删除</button></div>
        </article>
      ))}
    </section>
  );
}

function RunList({ runs }: { runs: readonly AutomationRun[] }): React.JSX.Element {
  const format = (value: string): string => new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
  return (
    <section className={styles.runList} aria-label="运行记录">
      <div className={styles.runHeader}><span>任务名称</span><span>运行时间</span><span>状态</span><span>结果</span></div>
      {runs.map((run) => <article key={run.id} className={styles.runRow}><strong>{run.taskName}</strong><time dateTime={run.ranAt}>{format(run.ranAt)}</time><span className={styles.runStatus} data-status={run.status}>{run.status}</span><p>{run.result}</p></article>)}
    </section>
  );
}

function EmptyRuns(): React.JSX.Element {
  return (
    <section className={styles.runsEmpty}>
      <div className={styles.radar} aria-hidden="true"><i /><i /><span>0</span></div>
      <span className={styles.eyebrow}>RUN HISTORY // EMPTY</span>
      <h2>还没有运行记录</h2>
      <p>任务开始运行后，时间、状态与结果摘要会显示在这里。</p>
      <div className={styles.runColumns}><span>任务名称</span><span>运行时间</span><span>状态</span><span>结果</span></div>
    </section>
  );
}

function AutomationCreate({ draft, onChange, onBack, onSave }: { draft: Draft; onChange: (draft: Draft) => void; onBack: () => void; onSave: (draft: Draft) => void | Promise<void> }): React.JSX.Element {
  const set = (key: keyof Draft, value: string): void => onChange({ ...draft, [key]: value });
  const [error, setError] = useState<string | null>(null);
  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (draft.name.trim() === "") {
      setError("请先填写任务名称。");
      return;
    }
    setError(null);
    void onSave({ ...draft, name: draft.name.trim(), description: draft.description.trim() });
  };
  return (
    <section className={`${styles.root} ${styles.create}`}>
      <header className={styles.createHead}>
        <button className={`theme-button-secondary ${styles.back}`} type="button" onClick={onBack}>← 返回自动化</button>
        <div>
          <div className={styles.crumb}><span /> AUTOMATION <b>//</b> 新建任务</div>
          <h1 className={`theme-display ${styles.createTitle}`}>配置自动化.</h1>
        </div>
        <span className={styles.previewTag}>UI PREVIEW</span>
      </header>

      <div className={styles.createGrid}>
        <form className={`theme-card theme-corners ${styles.form}`} onSubmit={submit}>
          {error !== null ? <div className={styles.formError} role="alert">{error}</div> : null}
          <div className={styles.formSection}><span>01</span><div><h2>任务内容</h2><p>告诉 Agent 在触发时需要完成什么。</p></div></div>
          <label className={styles.field}>任务名称<input value={draft.name} onChange={(event) => set("name", event.target.value)} placeholder="例如：每日 AI 新闻推送" required aria-invalid={error !== null || undefined} /></label>
          <label className={styles.field}>任务描述<textarea value={draft.description} onChange={(event) => set("description", event.target.value)} placeholder="描述任务目标和期望结果" rows={4} /></label>

          <div className={styles.formSection}><span>02</span><div><h2>执行计划</h2><p>保存后由本机 Host 计算并维护下一次触发时间。</p></div></div>
          <div className={styles.fieldRow}>
            <label className={styles.field}>执行频率<select value={draft.frequency} onChange={(event) => set("frequency", event.target.value)}><option>仅一次</option><option>每天</option><option>每周</option><option>每月</option></select></label>
            <label className={styles.field}>执行时间<input type="time" value={draft.time} onChange={(event) => set("time", event.target.value)} /></label>
          </div>

          <div className={styles.formSection}><span>03</span><div><h2>运行方式</h2><p>选择负责执行任务的 Agent 与可选技能。</p></div></div>
          <div className={styles.fieldRow}>
            <label className={styles.field}>选择 Agent<select value={draft.agent} onChange={(event) => set("agent", event.target.value)}><option>当前 Agent</option><option>默认 Agent</option></select></label>
            <label className={styles.field}>选择技能<select value={draft.skill} onChange={(event) => set("skill", event.target.value)}><option>暂不选择</option><option>新闻摘要</option><option>报告生成</option></select></label>
          </div>
          <footer className={styles.formActions}><button className="theme-button-secondary" type="button" onClick={onBack}>取消</button><button className="theme-button-primary theme-cut-corner" type="submit">保存任务</button></footer>
        </form>

        <aside className={styles.summary}>
          <span className={styles.eyebrow}>TASK PREVIEW</span>
          <h2>{draft.name || "未命名自动化"}</h2>
          <p>{draft.description || "任务描述会显示在这里。"}</p>
          <dl><div><dt>频率</dt><dd>{draft.frequency}</dd></div><div><dt>时间</dt><dd>{draft.time}</dd></div><div><dt>Agent</dt><dd>{draft.agent}</dd></div><div><dt>技能</dt><dd>{draft.skill}</dd></div></dl>
          <div className={styles.warning}><strong>本机运行</strong><span>电脑关机、休眠或客户端退出时，任务无法按时执行。</span></div>
        </aside>
      </div>
    </section>
  );
}
