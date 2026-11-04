import { shapeBox } from "./geometry";
import type { Layer, Prop, Shape, Timeline } from "./types";

const rest = (l: Layer, p: Prop) => { const tr = l.tracks[p]; return tr && tr.length ? tr[tr.length - 1].v : l.base[p]; };

function scaleShape(s: Shape, f: number): Shape {
  const r = (n: number) => Math.round(n * f * 10) / 10;
  switch (s.kind) {
    case "rect": return { ...s, w: r(s.w), h: r(s.h), ...(s.r != null ? { r: r(s.r) } : {}) };
    case "ellipse": return { ...s, w: r(s.w), h: r(s.h) };
    case "polygon": return { ...s, radius: r(s.radius) };
    case "text": return { ...s, size: r(s.size) };
  }
}

/** Bounding box of every visible layer in its resting (final) state. */
export function restingBounds(tl: Timeline) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of tl.layers) {
    if (rest(l, "opacity") < 0.05) continue;
    const b = shapeBox(l.shape);
    const hw = (b.w * Math.abs(rest(l, "scaleX"))) / 2, hh = (b.h * Math.abs(rest(l, "scaleY"))) / 2;
    const cx = rest(l, "x"), cy = rest(l, "y");
    x0 = Math.min(x0, cx - hw); x1 = Math.max(x1, cx + hw); y0 = Math.min(y0, cy - hh); y1 = Math.max(y1, cy + hh);
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

/**
 * Deterministic composition fix: if the resting layout spills outside the frame's safe area, uniformly scale the
 * whole composition (shapes + positions, including off-screen entrance keys) and shift it back inside.
 * Motion timing is untouched, so the animation keeps its character.
 */
export function fitToFrame(tl: Timeline, margin = 40): { timeline: Timeline; notes: string[] } {
  const b = restingBounds(tl);
  if (!b) return { timeline: tl, notes: [] };
  const W = tl.size.w, H = tl.size.h, eps = 0.5;
  if (b.x0 >= margin - eps && b.y0 >= margin - eps && b.x1 <= W - margin + eps && b.y1 <= H - margin + eps) return { timeline: tl, notes: [] };
  const notes: string[] = [];
  const f = Math.min(1, (W - 2 * margin) / (b.x1 - b.x0), (H - 2 * margin) / (b.y1 - b.y0));
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const nx0 = cx - ((cx - b.x0) * f), nx1 = cx + ((b.x1 - cx) * f), ny0 = cy - ((cy - b.y0) * f), ny1 = cy + ((b.y1 - cy) * f);
  const dx = nx0 < margin ? margin - nx0 : nx1 > W - margin ? W - margin - nx1 : 0;
  const dy = ny0 < margin ? margin - ny0 : ny1 > H - margin ? H - margin - ny1 : 0;
  const mapX = (v: number) => Math.round((cx + (v - cx) * f + dx) * 10) / 10;
  const mapY = (v: number) => Math.round((cy + (v - cy) * f + dy) * 10) / 10;
  if (f < 0.999) notes.push(`frame: scaled composition to ${Math.round(f * 100)}% to fit the safe area`);
  if (Math.abs(dx) > eps || Math.abs(dy) > eps) notes.push(`frame: shifted composition by (${Math.round(dx)}, ${Math.round(dy)}) px to stay inside the frame`);
  const layers = tl.layers.map((l) => ({
    ...l,
    shape: f < 0.999 ? scaleShape(l.shape, f) : l.shape,
    base: { ...l.base, x: mapX(l.base.x), y: mapY(l.base.y) },
    tracks: { ...l.tracks, ...(l.tracks.x ? { x: l.tracks.x.map((k) => ({ ...k, v: mapX(k.v) })) } : {}), ...(l.tracks.y ? { y: l.tracks.y.map((k) => ({ ...k, v: mapY(k.v) })) } : {}) },
  }));
  return { timeline: { ...tl, layers }, notes };
}
