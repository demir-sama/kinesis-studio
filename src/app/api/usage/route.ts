import { getJson, OtariError } from "@/lib/otari/client";
import { otariConfig } from "@/lib/otari/config";
import { endUserId, getUid } from "@/lib/server/user";

export const dynamic = "force-dynamic";

/** This visitor's Otari end-user record: spend against their budget. */
export async function GET() {
  const cfg = otariConfig();
  if (!cfg.apiKey || !cfg.perUser) return Response.json({ available: false, reason: !cfg.apiKey ? "not_configured" : "per_user_off" });
  const { uid, fresh } = await getUid();
  if (fresh) return Response.json({ available: true, endUser: null });
  try {
    const list = await getJson<any[]>(cfg, `/end-users?external_id=${encodeURIComponent(endUserId(uid))}`);
    const eu = list[0] ?? null;
    let budget: { id: string; max_budget: number | null; budget_duration_sec?: number | null } | null = null;
    if (eu?.budget_id) { try { budget = await getJson(cfg, `/budgets/${encodeURIComponent(eu.budget_id)}`); } catch {} }
    return Response.json({ available: true, endUser: eu && { spend: eu.spend, requests: eu.current_requests, tokens: eu.current_tokens, blocked: eu.blocked, budgetId: eu.budget_id, nextReset: eu.next_budget_reset_at }, budget: budget && { max: budget.max_budget } });
  } catch (e) {
    return Response.json({ available: false, reason: e instanceof OtariError ? `${e.status} ${e.code ?? ""} ${e.message}`.trim() : String(e) });
  }
}
