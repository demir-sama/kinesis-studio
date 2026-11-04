import { runPipeline } from "@/lib/ai/pipeline";
import { normalizeTimeline } from "@/lib/motion";
import { otariConfig } from "@/lib/otari/config";
import { endUserId, getUid, throttle, uidCookie } from "@/lib/server/user";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cfg = otariConfig();
  const { uid, fresh } = await getUid();
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...(fresh ? { "Set-Cookie": uidCookie(uid) } : {}) } });
  if (!cfg.apiKey) return json(503, { error: { code: "not_configured", message: "AI generation is offline: this deployment has no OTARI_API_KEY. Presets and manual editing still work." } });
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: { code: "bad_request", message: "Invalid JSON body" } }); }
  const prompt = String(body?.prompt ?? "").trim();
  if (prompt.length < 3 || prompt.length > 800) return json(400, { error: { code: "bad_request", message: "Describe the motion in 3–800 characters." } });
  if (!throttle(uid)) return json(429, { error: { code: "rate_limited", message: "Easy, animator — too many runs in ten minutes. Try again shortly." } });
  const mode = body?.mode === "refine" ? "refine" : "generate";
  const current = mode === "refine" && body?.current ? normalizeTimeline(body.current).timeline : undefined;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      // Heartbeat: a blank line every 8 s keeps proxies from dropping a quiet stream during long model calls (the client skips blank lines).
      const beat = setInterval(() => { try { ctrl.enqueue(enc.encode("\n")); } catch {} }, 8000);
      try {
        for await (const ev of runPipeline(cfg, { prompt, mode, current, research: body?.research !== false, critique: body?.critique !== false, userId: endUserId(uid) }, req.signal)) {
          ctrl.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
        }
      } catch (e) { ctrl.enqueue(enc.encode(JSON.stringify({ type: "error", message: (e as Error).message, code: null, status: 500 }) + "\n")); }
      clearInterval(beat);
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no", ...(fresh ? { "Set-Cookie": uidCookie(uid) } : {}) } });
}
