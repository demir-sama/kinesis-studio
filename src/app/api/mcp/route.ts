import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { lintTimeline, NAMED_EASES, normalizeTimeline } from "@/lib/motion";

/** Kinesis motion toolkit, served as an MCP server that Otari attaches to the director model. */
const PRINCIPLES: Record<string, string> = {
  timing: "Timing is the number of frames a move takes. It sets weight and mood: 150–250 ms feels snappy, 300–500 ms deliberate, and over 700 ms cinematic.",
  spacing: "Spacing is how far an object moves each frame. Ease-out (big steps first) means arrival; ease-in means departure.",
  anticipation: "A small counter-move (5–15% of the main move, 80–150 ms) before the action prepares the eye.",
  overshoot: "Let energetic arrivals pass the target by 4–12% and settle. Use back-out cubic-bezier(0.34,1.56,0.64,1) or a spring with damping 10–16.",
  stagger: "Offset related elements by 40–120 ms so the eye reads hierarchy. Larger groups use smaller offsets.",
  squash: "Squash and stretch: on impact scaleY drops and scaleX grows by the inverse, preserving volume. Stretch along the direction of travel.",
  follow_through: "Secondary parts (shadows, labels) lag the primary by 30–80 ms and settle after it.",
  arcs: "Organic motion travels on arcs. Offset x and y eases so the path curves instead of running straight.",
  hold: "Hold the final pose for at least 200–400 ms so it reads before a loop restarts.",
};

const handler = createMcpHandler((server) => {
  server.registerTool("get_easing", {
    title: "Get easing curve",
    description: "Look up a named easing curve and return its exact cubic-bezier parameters. Call with no name to list all curves.",
    inputSchema: z.object({ name: z.string().optional().describe("e.g. ease-out-expo, back-out, anticipate, material-standard") }),
  }, async ({ name }) => {
    if (!name) return { content: [{ type: "text", text: JSON.stringify(Object.fromEntries(Object.entries(NAMED_EASES).map(([k, v]) => [k, [v.x1, v.y1, v.x2, v.y2]]))) }] };
    const key = name.toLowerCase().replace(/\s+/g, "-");
    const e = NAMED_EASES[key];
    return { content: [{ type: "text", text: e ? JSON.stringify({ name: key, cubicBezier: [e.x1, e.y1, e.x2, e.y2], ktl: { type: "bezier", x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 } }) : `Unknown curve "${name}". Known: ${Object.keys(NAMED_EASES).join(", ")}` }] };
  });
  server.registerTool("motion_principles", {
    title: "Motion principles",
    description: "Concrete, numeric motion-design guidance (timing, spacing, anticipation, overshoot, stagger, squash, follow_through, arcs, hold).",
    inputSchema: z.object({ topics: z.array(z.string()).optional() }),
  }, async ({ topics }) => {
    const keys = topics?.length ? topics.map((t) => t.toLowerCase().replace(/[\s-]+/g, "_")).filter((t) => PRINCIPLES[t]) : Object.keys(PRINCIPLES);
    return { content: [{ type: "text", text: (keys.length ? keys : Object.keys(PRINCIPLES)).map((k) => `${k}: ${PRINCIPLES[k]}`).join("\n") }] };
  });
  server.registerTool("validate_timeline", {
    title: "Validate a Kinesis timeline",
    description: "Normalize and lint a KTL v1 timeline JSON string. Returns the repairs applied and the motion-review issues.",
    inputSchema: z.object({ timeline_json: z.string() }),
  }, async ({ timeline_json }) => {
    try {
      const { timeline, repairs } = normalizeTimeline(JSON.parse(timeline_json));
      const r = lintTimeline(timeline);
      return { content: [{ type: "text", text: JSON.stringify({ ok: r.ok, repairs, issues: r.issues, stats: r.stats }) }] };
    } catch (e) { return { content: [{ type: "text", text: `Invalid JSON: ${(e as Error).message}` }], isError: true }; }
  });
});

export { handler as GET, handler as POST, handler as DELETE };
