import { useEffect, useState } from "react";
import { openNativeSchedule } from "./native-schedule.ts";

export function NativeAutomation(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const open = () => {
    try { openNativeSchedule(); }
    catch { setError("原生自动化页面暂不可用，请确认客户端已启用 DSH 自动化任务组件。"); }
  };
  useEffect(open, []);
  return <section style={{ padding: 24 }}>
    <h1>自动化任务</h1>
    <p>新任务由 DSH 原生自动化管理，在会话中描述需要定时执行的工作即可创建。</p>
    {error !== null ? <p role="alert">{error}</p> : null}
    <button type="button" className="theme-button-primary" onClick={open}>打开自动化任务</button>
  </section>;
}
