"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Timeline } from "@/lib/motion";
import type { AgentContext } from "../studio/Studio";

type Ev = Record<string, any> & { type: string };
interface Status { configured: boolean; reachable: boolean; gateway: string; models: Record<string, string>; perUser: boolean; guardrails: { profile: string; mode: string }[]; mcp: boolean; research: boolean; codeExecution: boolean; tools?: string[] | null; modelsAvailable?: Record<string, boolean | null>; error?: string | null }
interface Usage { available: boolean; reason?: string; endUser?: { spend: number; requests: number; tokens: number; blocked: boolean; budgetId: string | null; nextReset: string | null } | null; budget?: { max: number | null } | null }

const EXAMPLES = [
  "A notification card slides down from the top, overshoots slightly, and the icon inside does a small wiggle",
  "Three dots in a loader breathe in sequence like a calm heartbeat, looping seamlessly",
  "A logo sting: a star spins in with anticipation, then the word FLOW types on letter by letter with a stagger",
  "A ball drops, squashes on impact, bounces twice and settles — classic animation principles",
];

const ROLE_LABEL: Record<string, string> = { director: "Director", animator: "Animator", repair: "Repair", critic: "Critic", validator: "Sandbox" };
const fmtUsd = (n: number | null | undefined) => (n == null ? "unpriced" : n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(4)}`);

export function AgentPanel({ ctx }: { ctx: AgentContext }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [prompt, setPrompt] = useState("");
  const [research, setResearch] = useState(true);
  const [critique, setCritique] = useState(true);
  const [running, setRunning] = useState<null | "generate" | "refine">(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [lastRun, setLastRun] = useState<{ prompt: string; mode: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const tlRef = useRef<Timeline>(ctx.tl); tlRef.current = ctx.tl;

  const refreshUsage = useCallback(() => { fetch("/api/usage").then((r) => r.json()).then(setUsage).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus(null)); refreshUsage(); }, [refreshUsage]);

  const run = async (mode: "generate" | "refine", text = prompt) => {
    if (!text.trim() || running) return;
    setRunning(mode); setEvents([]); setLastRun({ prompt: text, mode });
    const ac = new AbortController(); abort.current = ac;
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text, mode, research, critique, current: mode === "refine" ? tlRef.current : undefined }), signal: ac.signal });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); setEvents([{ type: "error", message: j?.error?.message ?? `HTTP ${res.status}`, code: j?.error?.code, status: res.status }]); return; }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
          const ev = JSON.parse(line) as Ev;
          setEvents((e) => [...e, ev]);
          if (ev.type === "timeline") { ctx.load(ev.timeline, { kind: "ai", label: `${mode === "refine" ? "Refined" : "Generated"} by ${Object.values(ev.models as Record<string, string>).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" + ")}` }); ctx.toast(mode === "refine" ? "Refined timeline loaded" : "AI timeline loaded"); }
          if (ev.type === "error") ctx.toast(ev.message, "err");
        }
      }
    } catch (e) { if ((e as Error).name !== "AbortError") setEvents((x) => [...x, { type: "error", message: (e as Error).message, status: 0 }]); else setEvents((x) => [...x, { type: "step", id: "cancel", role: "director", label: "Cancelled", status: "fail" }]); }
    finally { setRunning(null); abort.current = null; refreshUsage(); }
  };

  // Collapse step events by id → latest status.
  const steps: Ev[] = []; const stepIdx: Record<string, number> = {};
  for (const e of events) if (e.type === "step") { if (e.id in stepIdx && steps[stepIdx[e.id]].status === "run") steps[stepIdx[e.id]] = e; else { stepIdx[e.id] = steps.length; steps.push(e); } }
  const tools = events.filter((e) => e.type === "tool");
  const calls = events.filter((e) => e.type === "usage");
  const brief = events.find((e) => e.type === "brief")?.brief;
  const crit = [...events].reverse().find((e) => e.type === "critique")?.critique;
  const done = events.find((e) => e.type === "done");
  const err = events.find((e) => e.type === "error");
  const tlEv = [...events].reverse().find((e) => e.type === "timeline");
  const offline = status && (!status.configured || !status.reachable);

  return (
    <div className="agent">
      <div className={`gw-card ${offline ? "off" : ""}`}>
        <div className="gw-head"><span className={`dot ${!status ? "" : offline ? "err" : "ok"}`} /><b>Otari gateway</b><span className="mono gw-host">{status?.gateway ?? "…"}</span></div>
        {status && !status.configured && <p className="gw-msg">AI generation is <b>offline</b> because this deployment has no <code>OTARI_API_KEY</code>. Presets, editing and every export still work. <a href="/docs#ai-generation">Set it up →</a></p>}
        {status?.configured && !status.reachable && <p className="gw-msg">The gateway is configured but can't be reached: {status.error}</p>}
        {status?.configured && status.reachable && (
          <div className="gw-roles">
            {(["director", "animator", "critic"] as const).map((r) => <div key={r} className="gw-role"><span>{ROLE_LABEL[r]}</span><code title={status.modelsAvailable?.[r] === false ? "Not in this gateway's /models list" : ""} className={status.modelsAvailable?.[r] === false ? "warn" : ""}>{status.models[r]}</code></div>)}
            <div className="gw-feats">{[["web search", status.research && status.tools?.includes("otari_web_search")], ["code exec", status.codeExecution && status.tools?.includes("otari_code_execution")], ["MCP", status.mcp], ["guardrails", status.guardrails.length > 0], ["per-user budget", status.perUser]].map(([l, on]) => <span key={l as string} className={`tag ${on ? "mint" : ""}`}>{on ? "●" : "○"} {l}</span>)}</div>
          </div>
        )}
      </div>

      <div className="prompt-box">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe a motion… e.g. “a card lifts, overshoots and settles, its shadow following 60 ms behind”" rows={4} maxLength={800}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run("generate"); }} disabled={!!running} />
        <div className="prompt-row">
          <label className="mini-toggle"><input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} /> research</label>
          <label className="mini-toggle"><input type="checkbox" checked={critique} onChange={(e) => setCritique(e.target.checked)} /> critic</label>
          <span style={{ flex: 1 }} />
          {running ? <button className="btn sm" onClick={() => abort.current?.abort()}>Cancel</button> : <>
            <button className="btn sm" disabled={!prompt.trim() || !!offline} onClick={() => run("refine")} title="Edit the current timeline with this instruction">Refine current</button>
            <button className="btn primary sm" disabled={!prompt.trim() || !!offline} onClick={() => run("generate")}>Generate ⌘↵</button></>}
        </div>
        {!events.length && !running && <div className="examples">{EXAMPLES.map((x) => <button key={x} className="example" onClick={() => setPrompt(x)}>{x}</button>)}</div>}
      </div>

      {(steps.length > 0 || err) && (
        <div className="run-log">
          <h5>Run log {running && <span className="spinner" />}{lastRun && <span className="hint-inline"> · {lastRun.mode}</span>}</h5>
          <ol className="steps">
            {steps.map((s, i) => <li key={i} className={`st ${s.status}`}><i />{s.label}{s.detail && <small>{s.detail}</small>}</li>)}
          </ol>
          {err && <div className="err-card"><b>{err.code ?? "error"}{err.status ? ` · ${err.status}` : ""}</b><p>{err.message}</p>{err.code === "budget_exceeded" && <p>Your visitor budget is used up{err.retryAfter ? `; it resets in ${err.retryAfter}s` : ""}.</p>}</div>}
          {tools.length > 0 && <div className="tool-list">{tools.map((t, i) => <ToolCard key={i} role={t.role} call={t.call} />)}</div>}
          {brief != null && <details className="brief"><summary>Director's motion brief</summary><pre className="mono">{JSON.stringify(brief, null, 2)}</pre></details>}
          {tlEv && (tlEv.repairs?.length > 0) && <details className="brief"><summary>{tlEv.repairs.length} auto-repairs by the normalizer</summary><ul>{tlEv.repairs.slice(0, 20).map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></details>}
        </div>
      )}

      {crit && (
        <div className="critique">
          <div className="score-ring" style={{ ["--p" as string]: crit.score / 10 }}><b>{crit.score}</b><span>/10</span></div>
          <div className="crit-body">
            <h5>Critic</h5>
            <p className="verdict">{crit.verdict}</p>
            {crit.fixes?.length > 0 && <ul>{crit.fixes.map((f: any, i: number) => <li key={i}><b>{f.issue}</b> {f.suggestion}</li>)}</ul>}
            {crit.refine_prompt && <button className="btn sm" disabled={!!running} onClick={() => { setPrompt(crit.refine_prompt); run("refine", crit.refine_prompt); }}>Apply: “{crit.refine_prompt.slice(0, 70)}{crit.refine_prompt.length > 70 ? "…" : ""}”</button>}
          </div>
        </div>
      )}

      {(calls.length > 0 || usage?.endUser) && (
        <div className="usage">
          <h5>Usage via Otari</h5>
          {calls.length > 0 && <table className="usage-table"><tbody>
            {calls.map((c, i) => <tr key={i}><td>{ROLE_LABEL[c.role]}</td><td className="mono" title={`requested ${c.requested}${c.meta.requestId ? ` · ${c.meta.requestId}` : ""}`}>{c.meta.model}<small>{c.meta.provider}{c.meta.fallback && c.meta.fallback !== "false" ? " · fallback" : ""}{c.meta.attempts > 1 ? ` · ${c.meta.attempts} attempts` : ""}</small></td><td className="mono r">{c.meta.promptTokens + c.meta.completionTokens}<small>tok</small></td><td className="mono r">{(c.meta.durationMs / 1000).toFixed(1)}s</td><td className="mono r">{fmtUsd(c.meta.costUsd)}</td></tr>)}
            {done && <tr className="total"><td colSpan={3}>{done.calls} model calls</td><td className="mono r">{(done.ms / 1000).toFixed(1)}s</td><td className="mono r">{fmtUsd(done.costUsd)}</td></tr>}
          </tbody></table>}
          {usage?.endUser && <BudgetMeter spend={usage.endUser.spend} max={usage.budget?.max ?? null} requests={usage.endUser.requests} reset={usage.endUser.nextReset} />}
          {usage && !usage.available && usage.reason === "per_user_off" && <p className="hint">Per-visitor budgets are off on this deployment.</p>}
        </div>
      )}
    </div>
  );
}

function ToolCard({ role, call }: { role: string; call: any }) {
  const kind = call.type?.includes("search") ? "search" : call.type?.includes("code") ? "code" : call.type?.includes("mcp") || call.server ? "mcp" : "tool";
  return (
    <details className={`tool-card ${kind}`}>
      <summary><span className="tag">{kind === "search" ? "web search" : kind === "code" ? "code execution" : kind === "mcp" ? `MCP · ${call.server ?? ""}` : call.type}</span><span className="tc-title">{call.query ?? call.name ?? call.code?.split("\n")[0]?.slice(0, 60) ?? ""}</span><small>{ROLE_LABEL[role]} · {call.status ?? ""}</small></summary>
      {call.sources?.length > 0 && <ul className="sources">{call.sources.map((s: any, i: number) => <li key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a></li>)}</ul>}
      {call.code && <pre className="mono">{call.code}</pre>}
      {call.stdout && <pre className="mono out">{call.stdout}</pre>}
      {call.output != null && <pre className="mono out">{typeof call.output === "string" ? call.output.slice(0, 800) : JSON.stringify(call.output).slice(0, 800)}</pre>}
      {call.error && <p className="err">{call.error}</p>}
    </details>
  );
}

function BudgetMeter({ spend, max, requests, reset }: { spend: number; max: number | null; requests: number; reset: string | null }) {
  const pct = max ? Math.min(1, spend / max) : 0;
  return (
    <div className="budget">
      <div className="budget-head"><span>Your budget</span><span className="mono">{fmtUsd(spend)}{max != null ? ` / $${max.toFixed(2)}` : ""}</span></div>
      <div className="bar"><i style={{ width: `${pct * 100}%`, background: pct > 0.8 ? "var(--rose)" : pct > 0.5 ? "var(--amber)" : "var(--mint)" }} /></div>
      <small>{requests} requests{reset ? ` · resets ${new Date(reset).toLocaleString()}` : ""} · tracked per visitor by Otari</small>
    </div>
  );
}
