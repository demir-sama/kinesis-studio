import type { MotionReport, Timeline } from "../motion";
import { lintTimeline, normalizeTimeline } from "../motion";
import { chat, executeCode, OtariError, type CallMeta, type ChatResult, type OtariToolCall } from "../otari/client";
import type { OtariConfig } from "../otari/config";
import { extractJson } from "./json";
import { ANIMATOR_SYSTEM, CRITIC_SYSTEM, DIRECTOR_SYSTEM, REFINE_SYSTEM } from "./prompts";
import { validatorProgram } from "./validator";

export type Role = "director" | "animator" | "repair" | "critic" | "validator";
export type StepStatus = "run" | "ok" | "fail" | "skip";

export type PipelineEvent =
  | { type: "step"; id: string; role: Role; label: string; status: StepStatus; detail?: string }
  | { type: "tool"; role: Role; call: ToolSummary }
  | { type: "usage"; role: Role; meta: CallMeta; requested: string }
  | { type: "brief"; brief: unknown }
  | { type: "timeline"; timeline: Timeline; repairs: string[]; report: MotionReport; validation: SandboxValidation | null; models: Record<string, string | null> }
  | { type: "critique"; critique: Critique }
  | { type: "error"; message: string; code: string | null; status: number; retryAfter?: string | null; scope?: string | null }
  | { type: "done"; ms: number; costUsd: number; calls: number };

export interface ToolSummary { type: string; status?: string; query?: string; sources?: { url?: string; title?: string }[]; code?: string; stdout?: string; exitCode?: number | null; server?: string; name?: string; error?: string }
export interface SandboxValidation { ok: boolean; errors: string[]; warnings: string[]; stats?: Record<string, unknown>; ms: number }
export interface Critique { score: number; verdict: string; strengths: string[]; fixes: { issue: string; suggestion: string }[]; refine_prompt: string }

export interface PipelineInput { prompt: string; mode: "generate" | "refine"; current?: Timeline; research?: boolean; critique?: boolean; userId: string }

function summarize(c: OtariToolCall): ToolSummary {
  const err = c.error == null ? undefined : typeof c.error === "string" ? c.error : JSON.stringify(c.error).slice(0, 200);
  return { type: c.type, status: c.status, query: c.query, sources: c.sources?.slice(0, 5).map((s) => ({ url: s.url, title: s.title })), code: c.code?.slice(0, 1600), stdout: c.stdout?.slice(0, 1200), exitCode: c.exit_code, server: c.server, name: c.name, error: err };
}

function describe(tl: Timeline): string {
  return tl.layers.map((l) => `${l.name} (${l.shape.kind}, ${l.fill}): ` + Object.entries(l.tracks).map(([p, tr]) => `${p} ${tr!.map((k) => `${k.t}ms=${+k.v.toFixed(2)}${k.ease ? `[${typeof k.ease === "object" ? k.ease.type === "bezier" ? `bez ${k.ease.x1},${k.ease.y1},${k.ease.x2},${k.ease.y2}` : k.ease.type : k.ease}]` : ""}`).join(" ")}`).join(" | ")).join("\n");
}

export async function* runPipeline(cfg: OtariConfig, input: PipelineInput, signal?: AbortSignal): AsyncGenerator<PipelineEvent> {
  const t0 = Date.now();
  let cost = 0, calls = 0;
  const user = cfg.perUser ? input.userId : undefined;
  const guard = cfg.guardrails.length ? { guardrails: cfg.guardrails } : {};
  const models: Record<string, string | null> = {};

  async function* call(role: Role, requested: string, body: Record<string, unknown>): AsyncGenerator<PipelineEvent, ChatResult> {
    const res = await chat(cfg, { model: requested, ...(user ? { user } : {}), ...body }, signal);
    calls++; cost += res.meta.costUsd ?? 0; models[role] = res.meta.model ?? requested;
    yield { type: "usage", role, meta: res.meta, requested };
    for (const tc of res.toolCalls) yield { type: "tool", role, call: summarize(tc) };
    return res;
  }

  try {
    let brief: unknown = null;
    let timeline: Timeline; let repairs: string[] = [];

    if (input.mode === "generate") {
      // 1 · Director — open-weight model, web search + Kinesis MCP, guardrails on the user's words.
      const tools: unknown[] = [];
      if (cfg.research && input.research !== false) tools.push({ type: "otari_web_search", max_uses: 2 });
      const mcp = cfg.mcpUrl ? { mcp_servers: [{ name: "kinesis", url: cfg.mcpUrl, purpose_hint: "Kinesis motion toolkit: exact named easing curves and motion-design principles.", allowed_tools: ["get_easing", "motion_principles"] }] } : {};
      yield { type: "step", id: "director", role: "director", label: "Director is writing the motion brief", status: "run", detail: [tools.length ? "web search" : null, cfg.mcpUrl ? "Kinesis MCP" : null, cfg.guardrails.length ? "guardrails" : null].filter(Boolean).join(" · ") };
      const d = yield* call("director", cfg.models.director, { messages: [{ role: "system", content: DIRECTOR_SYSTEM }, { role: "user", content: input.prompt }], temperature: 0.6, max_tokens: 1800, ...(tools.length ? { tools } : {}), ...mcp, ...guard });
      try { brief = extractJson(d.content); } catch { brief = { intent: d.content.slice(0, 1200) }; }
      yield { type: "brief", brief };
      yield { type: "step", id: "director", role: "director", label: "Motion brief ready", status: "ok" };

      // 2 · Animator — second open-weight model, with the code-execution sandbox.
      yield { type: "step", id: "animator", role: "animator", label: "Animator is keying the timeline", status: "run", detail: cfg.animatorTools && cfg.codeExecution ? "code execution available" : "structured JSON output" };
      const a = yield* call("animator", cfg.models.animator, { messages: [{ role: "system", content: ANIMATOR_SYSTEM }, { role: "user", content: `User request: ${input.prompt}\n\nMotion brief:\n${JSON.stringify(brief)}` }], temperature: 0.35, max_tokens: 8000, ...(cfg.animatorTools && cfg.codeExecution ? { tools: [{ type: "otari_code_execution" }] } : { response_format: { type: "json_object" } }) });
      ({ timeline, repairs } = normalizeTimeline(extractJson(a.content)));
    } else {
      if (!input.current) throw new OtariError("Nothing to refine yet", 400, "bad_request");
      yield { type: "step", id: "animator", role: "animator", label: "Animator is editing the timeline", status: "run" };
      const a = yield* call("animator", cfg.models.animator, { messages: [{ role: "system", content: REFINE_SYSTEM }, { role: "user", content: `CURRENT timeline:\n${JSON.stringify(input.current)}\n\nInstruction: ${input.prompt}` }], temperature: 0.3, max_tokens: 8000, response_format: { type: "json_object" }, ...guard });
      ({ timeline, repairs } = normalizeTimeline(extractJson(a.content)));
    }
    yield { type: "step", id: "animator", role: "animator", label: `Timeline keyed: ${timeline.layers.length} layers, ${repairs.length} auto-repairs`, status: "ok" };

    // 3 · Deterministic validation in Otari's sandbox, with one repair pass.
    let report = lintTimeline(timeline);
    let validation = yield* sandboxValidate(timeline);
    const errs = () => [...report.issues.filter((i) => i.severity === "error").map((i) => i.message), ...(validation?.errors ?? [])];
    if (errs().length) {
      yield { type: "step", id: "repair", role: "repair", label: `Repairing ${errs().length} problem(s)`, status: "run" };
      const r = yield* call("repair", cfg.models.animator, { messages: [{ role: "system", content: REFINE_SYSTEM }, { role: "user", content: `CURRENT timeline:\n${JSON.stringify(timeline)}\n\nThe validator found these problems; fix every one of them:\n- ${errs().join("\n- ")}` }], temperature: 0.2, max_tokens: 8000, response_format: { type: "json_object" } });
      try {
        const fixed = normalizeTimeline(extractJson(r.content));
        timeline = fixed.timeline; repairs = [...repairs, ...fixed.repairs];
        report = lintTimeline(timeline); validation = yield* sandboxValidate(timeline);
        yield { type: "step", id: "repair", role: "repair", label: errs().length ? `${errs().length} problem(s) remain after repair` : "Repaired", status: errs().length ? "fail" : "ok" };
      } catch (e) { yield { type: "step", id: "repair", role: "repair", label: "Repair failed; keeping the first timeline", status: "fail", detail: (e as Error).message }; }
    }
    timeline.name = timeline.name || "Untitled";
    yield { type: "timeline", timeline, repairs, report, validation, models: { ...models } };

    // 4 · Critic — a third model, a different role.
    if (input.critique !== false) {
      yield { type: "step", id: "critic", role: "critic", label: "Critic is reviewing the motion", status: "run" };
      try {
        const c = yield* call("critic", cfg.models.critic, { messages: [{ role: "system", content: CRITIC_SYSTEM }, { role: "user", content: `Request: ${input.prompt}\nDuration ${timeline.duration}ms, loop ${timeline.loop !== false}.\nTimeline:\n${describe(timeline)}\n\nLint: ${JSON.stringify(report.issues.slice(0, 10).map((i) => `${i.severity}: ${i.message}`))}` }], temperature: 0.3, max_tokens: 900, response_format: { type: "json_object" } });
        const j = extractJson(c.content) as Partial<Critique>;
        const critique: Critique = { score: Math.max(0, Math.min(10, Number(j.score) || 0)), verdict: String(j.verdict ?? ""), strengths: (j.strengths ?? []).map(String).slice(0, 3), fixes: (j.fixes ?? []).slice(0, 3).map((f: any) => ({ issue: String(f?.issue ?? f), suggestion: String(f?.suggestion ?? "") })), refine_prompt: String(j.refine_prompt ?? "") };
        yield { type: "critique", critique };
        yield { type: "step", id: "critic", role: "critic", label: `Critic scored it ${critique.score}/10`, status: "ok" };
      } catch (e) { yield { type: "step", id: "critic", role: "critic", label: "Critic unavailable", status: "fail", detail: (e as Error).message }; }
    }
    yield { type: "done", ms: Date.now() - t0, costUsd: cost, calls };
  } catch (e) {
    if (e instanceof OtariError) yield { type: "error", message: e.message, code: e.code, status: e.status, retryAfter: e.retryAfter, scope: e.scope };
    else yield { type: "error", message: (e as Error).message, code: null, status: 500 };
    yield { type: "done", ms: Date.now() - t0, costUsd: cost, calls };
  }

  async function* sandboxValidate(tl: Timeline): AsyncGenerator<PipelineEvent, SandboxValidation | null> {
    if (!cfg.codeExecution) return null;
    yield { type: "step", id: "validator", role: "validator", label: "Validating in the Otari sandbox", status: "run" };
    try {
      const r = await executeCode(cfg, validatorProgram(JSON.stringify(tl)), user, signal);
      const line = r.stdout.trim().split("\n").pop() || "{}";
      const v = { ...(JSON.parse(line) as Omit<SandboxValidation, "ms">), ms: r.ms };
      yield { type: "tool", role: "validator", call: { type: "code_execute", status: r.returnCode === 0 ? "completed" : "failed", code: "validate_timeline.py (Python twin of the motion linter)", stdout: line.slice(0, 1200), exitCode: r.returnCode } };
      yield { type: "step", id: "validator", role: "validator", label: v.ok ? `Sandbox validation passed (${v.warnings.length} warnings)` : `Sandbox found ${v.errors.length} error(s)`, status: v.ok ? "ok" : "fail" };
      return v;
    } catch (e) {
      yield { type: "step", id: "validator", role: "validator", label: "Sandbox validation unavailable", status: "skip", detail: (e as Error).message };
      return null;
    }
  }
}
