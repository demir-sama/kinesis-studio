import { easeLabel } from "./easing";
import { valueAt } from "./evaluate";
import type { Timeline } from "./types";
import { PROPS } from "./types";

export type Severity = "error" | "warn" | "tip";
export interface LintIssue { severity: Severity; layer?: string; prop?: string; message: string; rule: string }
export interface MotionReport {
  ok: boolean;
  issues: LintIssue[];
  stats: { layers: number; keyframes: number; tracks: number; frames: number; peakSpeedPx: number; overshoots: number; staggerMs: number };
}

/**
 * Motion lint: structural checks plus the craft rules a senior motion designer applies in review.
 * Mirrored in Python (src/lib/otari/validator.py.ts) so Otari's sandbox can verify independently.
 */
export function lintTimeline(tl: Timeline): MotionReport {
  const issues: LintIssue[] = [];
  let keyframes = 0, tracks = 0, peakSpeed = 0, overshoots = 0;
  const starts: number[] = [];
  const frames = Math.round((tl.duration / 1000) * tl.fps);
  const step = 1000 / tl.fps;

  if (tl.layers.length === 0) issues.push({ severity: "error", rule: "empty", message: "Timeline has no layers." });

  for (const l of tl.layers) {
    let first = Infinity;
    for (const p of PROPS) {
      const tr = l.tracks[p];
      if (!tr || tr.length === 0) continue;
      tracks++;
      keyframes += tr.length;
      first = Math.min(first, tr[0].t);
      if (tr.length === 1) issues.push({ severity: "warn", rule: "single-key", layer: l.id, prop: p, message: `${l.name} · ${p} has a single keyframe, so it never moves.` });
      for (let i = 0; i < tr.length - 1; i++) {
        const a = tr[i], b = tr[i + 1];
        if (b.t <= a.t) issues.push({ severity: "error", rule: "order", layer: l.id, prop: p, message: `${l.name} · ${p}: keyframes out of order at ${a.t}ms.` });
        const span = b.t - a.t;
        const delta = Math.abs(b.v - a.v);
        if ((p === "x" || p === "y") && a.ease?.type === "linear" && delta > 40) issues.push({ severity: "tip", rule: "linear-move", layer: l.id, prop: p, message: `${l.name} travels ${Math.round(delta)}px with linear easing between ${a.t}–${b.t}ms — reads mechanical. Try ease-out-quint or a spring.` });
        if (span > 0 && span < 60 && delta > 0 && a.ease?.type !== "hold" && a.ease?.type !== "steps") issues.push({ severity: "warn", rule: "too-fast", layer: l.id, prop: p, message: `${l.name} · ${p} changes in ${span}ms — under 4 frames at 60fps, it will strobe.` });
        if (a.ease?.type === "bezier" && (a.ease.y1 > 1 || a.ease.y2 > 1 || a.ease.y1 < 0 || a.ease.y2 < 0)) overshoots++;
        if (a.ease?.type === "spring") overshoots++;
      }
      if (p === "x" || p === "y") {
        for (let t = 0; t <= tl.duration; t += step) {
          const v1 = valueAt(tr, t, l.base[p]), v2 = valueAt(tr, t + step, l.base[p]);
          peakSpeed = Math.max(peakSpeed, Math.abs(v2 - v1) / (step / 1000));
        }
      }
      if (p === "opacity" && tr.some((k) => k.v < 0 || k.v > 1)) issues.push({ severity: "error", rule: "opacity-range", layer: l.id, prop: p, message: `${l.name} opacity must stay within 0–1.` });
      if (tr[tr.length - 1].t > tl.duration) issues.push({ severity: "error", rule: "past-end", layer: l.id, prop: p, message: `${l.name} · ${p} has keyframes after the timeline ends.` });
    }
    if (Number.isFinite(first)) starts.push(first);
    // Off-canvas for the whole duration → invisible layer.
    let visible = false;
    for (let t = 0; t <= tl.duration && !visible; t += step * 4) {
      const x = valueAt(l.tracks.x, t, l.base.x), y = valueAt(l.tracks.y, t, l.base.y), o = valueAt(l.tracks.opacity, t, l.base.opacity);
      if (x > -200 && x < tl.size.w + 200 && y > -200 && y < tl.size.h + 200 && o > 0.01) visible = true;
    }
    if (!visible) issues.push({ severity: "warn", rule: "never-visible", layer: l.id, message: `${l.name} is never visible on the canvas.` });
  }

  const sorted = [...starts].sort((a, b) => a - b);
  const staggerMs = sorted.length > 1 ? Math.round((sorted[sorted.length - 1] - sorted[0]) / (sorted.length - 1)) : 0;
  if (sorted.length >= 3 && staggerMs === 0) issues.push({ severity: "tip", rule: "no-stagger", message: "Every layer starts on the same frame. A 30–80ms stagger adds hierarchy and life." });
  const eases = new Set<string>();
  tl.layers.forEach((l) => PROPS.forEach((p) => l.tracks[p]?.forEach((k) => k.ease && eases.add(easeLabel(k.ease)))));
  if (keyframes > 6 && eases.size === 1 && eases.has("linear")) issues.push({ severity: "tip", rule: "all-linear", message: "Every segment is linear. Real objects accelerate and decelerate." });
  if (peakSpeed > 12000) issues.push({ severity: "warn", rule: "speed", message: `Peak speed ${Math.round(peakSpeed)}px/s — likely to motion-blur into nothing.` });

  return { ok: !issues.some((i) => i.severity === "error"), issues, stats: { layers: tl.layers.length, keyframes, tracks, frames, peakSpeedPx: Math.round(peakSpeed), overshoots, staggerMs } };
}
