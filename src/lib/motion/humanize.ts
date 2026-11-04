import type { Keyframe, Layer, Prop, Timeline } from "./types";

const sig = (l: Layer) => (Object.keys(l.tracks) as Prop[]).filter((p) => l.tracks[p]?.length).sort().map((p) => `${p}:${l.tracks[p]!.length}`).join("|");
const start = (l: Layer) => Math.min(...Object.values(l.tracks).filter((t): t is Keyframe[] => !!t?.length).map((t) => t[0].t));

/**
 * Break up mechanical staggers. For 3+ sibling layers keyed the same way (same props, same key counts) whose start
 * offsets form a uniform cadence (or all start on the same frame), re-space the offsets on a gentle
 * decelerating curve and vary each sibling's duration by a few percent, the way an animator would hand-key it.
 */
export function humanizeStagger(tl: Timeline): { timeline: Timeline; notes: string[] } {
  const groups = new Map<string, number[]>();
  tl.layers.forEach((l, i) => { const s = sig(l); if (s && Object.values(l.tracks).some((t) => (t?.length ?? 0) >= 2)) groups.set(s, [...(groups.get(s) ?? []), i]); });
  const layers = tl.layers.map((l) => ({ ...l, tracks: { ...l.tracks } }));
  const notes: string[] = [];
  let duration = tl.duration;
  for (const idx of groups.values()) {
    if (idx.length < 3) continue;
    const order = [...idx].sort((a, b) => start(tl.layers[a]) - start(tl.layers[b]));
    const starts = order.map((i) => start(tl.layers[i]));
    const diffs = starts.slice(1).map((s, k) => s - starts[k]);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    if (diffs.some((d) => Math.abs(d - mean) > 12)) continue; // already varied
    const step = Math.max(mean, 45);
    const weights = diffs.map((_, k) => 0.75 + 0.22 * k); // 0.75, 0.97, 1.19, … — decelerating cascade
    const wsum = weights.reduce((a, b) => a + b, 0);
    let acc = starts[0];
    const newStarts = [starts[0], ...weights.map((w) => (acc += (step * diffs.length * w) / wsum))];
    const stretch = [1, 1.07, 0.95, 1.04, 0.97, 1.06];
    order.forEach((li, k) => {
      const l = layers[li], s0 = starts[k], ns = Math.round(newStarts[k]), f = stretch[k % stretch.length];
      for (const p of Object.keys(l.tracks) as Prop[]) {
        l.tracks[p] = l.tracks[p]!.map((kf) => ({ ...kf, t: Math.round(ns + (kf.t - s0) * f) }));
        const last = l.tracks[p]![l.tracks[p]!.length - 1].t; if (last > duration) duration = last;
      }
    });
    notes.push(`timing: re-spaced a uniform ${Math.round(mean)} ms stagger across ${order.length} layers into a varied cascade (${newStarts.slice(1).map((s, k) => Math.round(s - newStarts[k])).join("/")} ms)`);
  }
  if (!notes.length) return { timeline: tl, notes };
  const end = Math.max(duration, tl.duration);
  return { timeline: { ...tl, duration: end === tl.duration ? end : Math.ceil((end + 250) / 50) * 50, layers }, notes };
}
