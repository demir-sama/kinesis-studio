/**
 * Python twin of the structural validator. It runs inside Otari's code-execution sandbox
 * (POST /code/execute), so the check is independent of the TypeScript linter that produced the repairs.
 */
export const VALIDATOR_PY = String.raw`
import json, math, sys
tl = json.loads(TIMELINE_JSON)
errors, warnings = [], []
PROPS = {"x","y","scaleX","scaleY","rotate","opacity"}
EASES = {"linear","bezier","spring","steps","hold"}
dur = tl.get("duration", 0)
if tl.get("version") != 1: errors.append("version must be 1")
if not (50 <= dur <= 60000): errors.append(f"duration {dur} out of range")
layers = tl.get("layers", [])
if not layers: errors.append("no layers")
ids = [l.get("id") for l in layers]
if len(ids) != len(set(ids)): errors.append("duplicate layer ids")
W, H = tl.get("size", {}).get("w", 800), tl.get("size", {}).get("h", 450)
peak = 0.0; keys = 0; starts = []
for l in layers:
    lid = l.get("id")
    tracks = l.get("tracks", {})
    first = None
    for p, tr in tracks.items():
        if p not in PROPS: errors.append(f"{lid}: unknown prop {p}"); continue
        ts = [k.get("t") for k in tr]
        if ts != sorted(ts): errors.append(f"{lid}.{p}: keys not sorted")
        for i, k in enumerate(tr):
            keys += 1
            t, v = k.get("t"), k.get("v")
            if not isinstance(t, (int, float)) or t < 0 or t > dur: errors.append(f"{lid}.{p}[{i}]: time {t} outside 0..{dur}")
            if not isinstance(v, (int, float)) or not math.isfinite(v): errors.append(f"{lid}.{p}[{i}]: bad value")
            e = k.get("ease")
            if e is not None:
                if e.get("type") not in EASES: errors.append(f"{lid}.{p}[{i}]: unknown ease {e.get('type')}")
                if e.get("type") == "bezier" and not (0 <= e.get("x1", 0) <= 1 and 0 <= e.get("x2", 0) <= 1): errors.append(f"{lid}.{p}[{i}]: bezier x outside 0..1")
                if e.get("type") == "spring" and min(e.get("stiffness", 1), e.get("damping", 1), e.get("mass", 1)) <= 0: errors.append(f"{lid}.{p}[{i}]: spring params must be > 0")
            if i and p in ("x", "y"):
                dt = (t - tr[i-1]["t"]) / 1000.0
                if dt > 0: peak = max(peak, abs(v - tr[i-1]["v"]) / dt)
        if p == "opacity" and any(not (0 <= k["v"] <= 1) for k in tr): errors.append(f"{lid}.opacity outside 0..1")
        if tr and (first is None or tr[0]["t"] < first) and len(tr) > 1: first = tr[0]["t"]
    if first is not None: starts.append(first)
    b = l.get("base", {})
    if not (-W <= b.get("x", 0) <= 2 * W and -H <= b.get("y", 0) <= 2 * H): warnings.append(f"{lid}: base position far off canvas")
if peak > 12000: warnings.append(f"peak average speed {peak:.0f}px/s is very fast")
if len(starts) > 2 and len(set(starts)) == 1: warnings.append("every layer starts on the same frame (no stagger)")
print(json.dumps({"ok": not errors, "errors": errors[:20], "warnings": warnings[:20], "stats": {"layers": len(layers), "keys": keys, "peak_avg_speed": round(peak), "python": sys.version.split()[0]}}))
`;

export function validatorProgram(timelineJson: string): string {
  return `TIMELINE_JSON = ${JSON.stringify(timelineJson)}\n${VALIDATOR_PY}`;
}
