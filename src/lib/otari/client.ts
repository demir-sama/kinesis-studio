import type { OtariConfig } from "./config";

/** Thin, typed client for the parts of the Otari gateway Kinesis uses. */

export interface OtariToolCall {
  id?: string; type: string; status?: string; query?: string; sources?: { url?: string; title?: string }[];
  code?: string; stdout?: string; stderr?: string; exit_code?: number | null; server?: string; name?: string; output?: unknown; error?: unknown;
}

export interface CallMeta {
  requestId: string | null; provider: string | null; model: string | null; attempts: number | null; fallback: string | null;
  durationMs: number; costUsd: number | null; pricingSource: string | null; promptTokens: number; completionTokens: number; guardrails: string | null;
}

export class OtariError extends Error {
  constructor(message: string, public status: number, public code: string | null, public retryAfter: string | null = null, public scope: string | null = null) { super(message); }
}

export interface ChatResult { content: string; toolCalls: OtariToolCall[]; meta: CallMeta; raw: Record<string, unknown> }

function headers(cfg: OtariConfig, extra?: Record<string, string>): Record<string, string> {
  if (!cfg.apiKey) throw new OtariError("OTARI_API_KEY is not configured", 503, "not_configured");
  const h: Record<string, string> = { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", ...extra };
  if (cfg.perUser && cfg.endUserBudget) h["Otari-End-User-Budget"] = cfg.endUserBudget;
  return h;
}

async function fail(res: Response): Promise<never> {
  let code: string | null = null; let message = `${res.status} ${res.statusText}`;
  try {
    const j = await res.json();
    const err = j?.error ?? j?.detail ?? j;
    if (typeof err === "string") message = err;
    else if (err) { message = err.message || err.detail || JSON.stringify(err).slice(0, 400); code = err.code || err.type || null; }
  } catch {}
  throw new OtariError(message, res.status, code, res.headers.get("Retry-After"), res.headers.get("Otari-Budget-Scope"));
}

/**
 * Per-user attribution (`user` field) only works with an Otari *service* key. With a regular project key the
 * gateway answers 4xx "'user' field does not match the authenticated API key's user". When that happens we
 * drop the field for the rest of this server instance instead of failing every generation.
 */
let userFieldRejected = false;
export const userAttributionActive = () => !userFieldRejected;
const isUserMismatch = (status: number, text: string) => status >= 400 && status < 500 && /'user' field/i.test(text);

async function post(cfg: OtariConfig, path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const send = (b: Record<string, unknown>) => fetch(`${cfg.baseUrl}${path}`, { method: "POST", headers: headers(cfg), body: JSON.stringify(b), signal });
  const hasUser = "user" in body && body.user != null;
  const { user: _u, ...anon } = body;
  if (hasUser && userFieldRejected) return send(anon);
  const res = await send(body);
  if (!res.ok && hasUser) {
    const text = await res.clone().text().catch(() => "");
    if (isUserMismatch(res.status, text)) { userFieldRejected = true; return send(anon); }
  }
  return res;
}

export async function chat(cfg: OtariConfig, body: Record<string, unknown>, signal?: AbortSignal): Promise<ChatResult> {
  const t0 = Date.now();
  const res = await post(cfg, "/chat/completions", { stream: false, ...body }, signal);
  if (!res.ok) await fail(res);
  const j = (await res.json()) as Record<string, any>;
  const msg = j.choices?.[0]?.message ?? {};
  const h = res.headers;
  return {
    content: typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content.map((p: any) => p.text ?? "").join("") : "",
    toolCalls: Array.isArray(j.otari_tool_calls) ? j.otari_tool_calls : [],
    raw: j,
    meta: {
      requestId: h.get("Otari-Request-ID"), provider: h.get("Otari-Provider"), model: h.get("Otari-Model") || j.model || null,
      attempts: h.get("Otari-Attempt-Count") ? Number(h.get("Otari-Attempt-Count")) : null, fallback: h.get("Otari-Fallback"),
      durationMs: Number(h.get("Otari-Response-Duration-Ms")) || Date.now() - t0,
      costUsd: typeof j.usage?.cost_usd === "number" ? j.usage.cost_usd : null, pricingSource: j.usage?.pricing_source ?? null,
      promptTokens: j.usage?.prompt_tokens ?? 0, completionTokens: j.usage?.completion_tokens ?? 0, guardrails: h.get("Otari-Guardrails"),
    },
  };
}

export interface ExecResult { stdout: string; stderr: string; returnCode: number | null; ms: number }
export async function executeCode(cfg: OtariConfig, code: string, user?: string, signal?: AbortSignal): Promise<ExecResult> {
  const t0 = Date.now();
  const res = await post(cfg, "/code/execute", { code, timeout_seconds: 30, ...(user ? { user } : {}) }, signal);
  if (!res.ok) await fail(res);
  const j = await res.json();
  return { stdout: j.stdout ?? "", stderr: j.stderr ?? "", returnCode: j.return_code ?? null, ms: Date.now() - t0 };
}

export async function getJson<T = unknown>(cfg: OtariConfig, path: string): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, { headers: headers(cfg), cache: "no-store" });
  if (!res.ok) await fail(res);
  return res.json() as Promise<T>;
}
