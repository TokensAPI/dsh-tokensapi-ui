// Real Electron regression probe. Start Desktop with --remote-debugging-port=9333.
// node scripts/profile-state-dot.mjs [--keep] [--fixture]
// Only the diagnostic stylesheet/animations are changed; --keep leaves the fix
// active until reload. Traces are written to a fresh OS temporary directory.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = "http://127.0.0.1:9333";
const pages = await (await fetch(`${base}/json/list`)).json();
const page = pages.find(p => p.type === "page" && p.url.includes("dsh-desktop-mode"));
if (!page) throw new Error("No Desktop page on port 9333");
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p?.reject(new Error(JSON.stringify(m.error)));
      else p?.resolve(m.result);
    } else listeners.get(m.method)?.(m.params);
  };
  return {
    send: (method, params = {}) => new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    listeners,
    close: () => ws.close(),
  };
}
const client = await connect(page.webSocketDebuggerUrl);
const version = await (await fetch(`${base}/json/version`)).json();
const browser = await connect(version.webSocketDebuggerUrl);
const evaluate = async expression => {
  const r = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const selector = 'svg[data-state="ongoing"]:has(> g[class*="_spinnerMotion"] > circle[class*="_spinnerArc"])';
const css = readFileSync(new URL("../src/client/theme/state-dot.css", import.meta.url), "utf8");
const out = mkdtempSync(join(tmpdir(), "state-dot-"));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [];
let layers = [];
client.listeners.set("LayerTree.layerTreeDidChange", p => { layers = p.layers ?? []; });
await client.send("LayerTree.enable");
await client.send("Performance.enable");
const snapshot = `JSON.stringify({visibility:document.visibilityState, dots:[...document.querySelectorAll(${JSON.stringify(selector)})].map(e=>({width:e.getAttribute('width'),color:getComputedStyle(e).color,arc:getComputedStyle(e.querySelector('circle:last-child')).strokeDasharray})),animations:document.getAnimations().filter(a=>a.effect.target.closest(${JSON.stringify(selector)})).map(a=>({name:a.animationName,state:a.playState,target:a.effect.target.tagName})),otherAnimations:document.getAnimations().filter(a=>!a.effect.target.closest(${JSON.stringify(selector)})).length})`;
try {
  await evaluate('document.getElementById("tokens-state-dot-profile")?.remove()');
  if (process.argv.includes("--fixture")) await evaluate(`(() => {
    const selectors=[];
    const visit=rules=>{for(const r of rules){if(r.selectorText)selectors.push(r.selectorText);if(r.cssRules)visit(r.cssRules)}};
    for(const s of document.styleSheets){try{visit(s.cssRules)}catch{}}
    const family=selectors.join(' ').match(/_spinnerMotion_([a-zA-Z0-9]+)_/)[1];
    const cls=name=>{const match=selectors.join(' ').match(new RegExp('\\\\.(_'+name+'_'+family+'_[a-zA-Z0-9_]+)'));if(!match)throw new Error('Missing native '+name);return match[1]};
    const classes=Object.fromEntries(['spinner','spinnerMotion','spinnerTrack','spinnerArc'].map(n=>[n,cls(n)]));
    const box=document.createElement('div');box.id='tokens-state-dot-fixture';box.style.cssText='position:fixed;left:20px;bottom:20px;display:flex;gap:18px;pointer-events:none;z-index:9999';
    box.innerHTML=Array.from({length:2},()=>'<svg data-state="ongoing" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" class="'+classes.spinner+'"><g class="'+classes.spinnerMotion+'"><circle class="'+classes.spinnerTrack+'" cx="12" cy="12" r="9.5"/><circle class="'+classes.spinnerArc+'" cx="12" cy="12" r="9.5"/></g></svg>').join('');
    document.body.append(box);
  })()`);
  const dotCount = await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
  if (!dotCount) throw new Error("No running StateDots; use --fixture for a controlled native-style reproduction");
  console.log("Before:", await evaluate(snapshot));
  for (const phase of ["baseline", "patched", "paused"]) {
    if (phase === "patched") await evaluate(`(() => { const s=document.createElement('style');s.id='tokens-state-dot-profile';s.textContent=${JSON.stringify(css)};document.head.append(s); })()`);
    if (phase === "paused") await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).forEach(e=>e.getAnimations().forEach(a=>a.pause()))`);
    await delay(1000);
    const events = [];
    client.listeners.set("Tracing.dataCollected", p => events.push(...p.value));
    await client.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] } });
    const m0 = await client.send("Performance.getMetrics");
    const p0 = await browser.send("SystemInfo.getProcessInfo");
    const start = performance.now();
    await delay(15000);
    const elapsed = (performance.now() - start) / 1000;
    const p1 = await browser.send("SystemInfo.getProcessInfo");
    const m1 = await client.send("Performance.getMetrics");
    const complete = new Promise(resolve => client.listeners.set("Tracing.tracingComplete", resolve));
    await client.send("Tracing.end");
    await complete;
    const counts = {};
    for (const e of events) if (e.ph === "X" && ["Layout", "Paint", "Commit", "UpdateLayoutTree"].includes(e.name)) counts[e.name] = (counts[e.name] ?? 0) + 1;
    const metrics = {};
    for (const key of ["TaskDuration", "LayoutDuration", "RecalcStyleDuration", "LayoutCount"]) metrics[key] = m1.metrics.find(m=>m.name===key).value - m0.metrics.find(m=>m.name===key).value;
    const cpu = p1.processInfo.map(p => ({ type:p.type, id:p.id, percent:100 * (p.cpuTime - (p0.processInfo.find(q=>q.id===p.id)?.cpuTime ?? p.cpuTime)) / elapsed }));
    const reasons = [];
    if (phase === "patched") for (const layer of layers) {
      try {
        const r = await client.send("LayerTree.compositingReasons", { layerId:layer.layerId });
        if (r.compositingReasons.some(s=>/transform|animation/i.test(s))) reasons.push(r.compositingReasons);
      } catch (error) {
        // A live session can finish and discard its layer between CDP calls.
        if (!error.message.includes("No layer matching")) throw error;
      }
    }
    const result = {phase, elapsed, counts, metrics, cpu, reasons, state:JSON.parse(await evaluate(snapshot))};
    result.dotCountChanged = result.state.dots.length !== dotCount;
    results.push(result);
    if (phase === "patched" && result.state.animations.some(a => a.target !== "svg" || a.name !== "tokens-state-dot-rotate")) throw new Error("An SVG descendant still animates");
    writeFileSync(join(out, `${phase}.json`), JSON.stringify({traceEvents:events}));
    console.log(JSON.stringify(result));
  }
  await client.send("Emulation.setEmulatedMedia", {features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  await delay(1000);
  const reduced = JSON.parse(await evaluate(snapshot));
  console.log("Reduced motion:", JSON.stringify(reduced));
  if (reduced.animations.some(a => a.name)) throw new Error("StateDot CSS animation remains under reduced motion");
} finally {
  await client.send("Emulation.setEmulatedMedia", {features:[]});
  if (process.argv.includes("--keep")) await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).forEach(e=>e.getAnimations().forEach(a=>a.play()))`);
  else await evaluate('document.getElementById("tokens-state-dot-profile")?.remove()');
  await evaluate('document.getElementById("tokens-state-dot-fixture")?.remove()');
  writeFileSync(join(out, "summary.json"), JSON.stringify(results, null, 2));
  console.log("Trace directory:", out);
  client.close();
  browser.close();
}
