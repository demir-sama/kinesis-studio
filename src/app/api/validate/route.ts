import { validatorProgram } from "@/lib/ai/validator";
import { lintTimeline, normalizeTimeline } from "@/lib/motion";
import { executeCode, OtariError } from "@/lib/otari/client";
import { otariConfig } from "@/lib/otari/config";
import { endUserId, getUid, throttle } from "@/lib/server/user";

export const dynamic = "force-dynamic";

/** Validate any timeline: local lint always, plus the Python twin in Otari's sandbox when configured. */
export async function POST(req: Request) {
  const cfg = otariConfig();
  const { timeline, repairs } = normalizeTimeline(await req.json().catch(() => ({})));
  const report = lintTimeline(timeline);
  if (!cfg.apiKey || !cfg.codeExecution) return Response.json({ report, repairs, sandbox: null });
  const { uid } = await getUid();
  if (!throttle(`v:${uid}`, 30)) return Response.json({ report, repairs, sandbox: { error: "rate limited" } });
  try {
    const r = await executeCode(cfg, validatorProgram(JSON.stringify(timeline)), cfg.perUser ? endUserId(uid) : undefined);
    return Response.json({ report, repairs, sandbox: { ...JSON.parse(r.stdout.trim().split("\n").pop() || "{}"), ms: r.ms } });
  } catch (e) {
    return Response.json({ report, repairs, sandbox: { error: e instanceof OtariError ? e.message : String(e) } });
  }
}
