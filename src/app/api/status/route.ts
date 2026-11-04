import { getJson } from "@/lib/otari/client";
import { otariConfig } from "@/lib/otari/config";

export const dynamic = "force-dynamic";

/** What the gateway is configured to do, without leaking the key. */
export async function GET() {
  const cfg = otariConfig();
  const host = (() => { try { return new URL(cfg.baseUrl).host; } catch { return cfg.baseUrl; } })();
  const base = { configured: !!cfg.apiKey, gateway: host, models: cfg.models, perUser: cfg.perUser, endUserBudget: cfg.endUserBudget, guardrails: cfg.guardrails, mcp: !!cfg.mcpUrl, research: cfg.research, codeExecution: cfg.codeExecution };
  if (!cfg.apiKey) return Response.json({ ...base, reachable: false });
  const [tools, models] = await Promise.allSettled([getJson<{ data: { id?: string; type?: string; available?: boolean }[] }>(cfg, "/tools"), getJson<{ data: { id: string }[] }>(cfg, "/models")]);
  const ids = models.status === "fulfilled" ? models.value.data.map((m) => m.id) : [];
  return Response.json({
    ...base,
    reachable: tools.status === "fulfilled" || models.status === "fulfilled",
    tools: tools.status === "fulfilled" ? tools.value.data.filter((t) => t.available !== false).map((t) => t.id || t.type) : null,
    modelCount: ids.length || null,
    modelsAvailable: Object.fromEntries(Object.entries(cfg.models).map(([r, m]) => [r, ids.length ? ids.includes(m) : null])),
    error: tools.status === "rejected" && models.status === "rejected" ? String((tools.reason as Error).message) : null,
  });
}
