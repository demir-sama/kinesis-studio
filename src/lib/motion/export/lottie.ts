import { easeFn, r4 } from "../easing";
import { hexToRgb01, polygonPoints } from "../geometry";
import type { Keyframe, Layer, Prop, Timeline } from "../types";

/* Bodymovin / Lottie 5.x JSON. Beziers map 1:1 onto Lottie tangents; springs and steps are baked per frame. */

type LKey = { t: number; s: number[]; h?: 1; o?: { x: number[]; y: number[] }; i?: { x: number[]; y: number[] } };
type LProp = { a: 0; k: number | number[] } | { a: 1; k: LKey[] };

const scaleOf = (p: Prop) => (p === "scaleX" || p === "scaleY" || p === "opacity" ? 100 : 1);

function bakeTrack(track: Keyframe[], fps: number, mul: number): LKey[] {
  const f = (ms: number) => r4((ms / 1000) * fps);
  const keys: LKey[] = [];
  for (let i = 0; i < track.length; i++) {
    const a = track[i], b = track[i + 1];
    const s = [r4(a.v * mul)];
    if (!b) { keys.push({ t: f(a.t), s }); break; }
    const e = a.ease;
    if (!e || e.type === "bezier" || e.type === "linear") {
      const [x1, y1, x2, y2] = !e ? [0.65, 0, 0.35, 1] : e.type === "linear" ? [0, 0, 1, 1] : [e.x1, e.y1, e.x2, e.y2];
      keys.push({ t: f(a.t), s, o: { x: [r4(x1)], y: [r4(y1)] }, i: { x: [r4(x2)], y: [r4(y2)] } });
    } else if (e.type === "hold") {
      keys.push({ t: f(a.t), s, h: 1 });
    } else if (e.type === "steps") {
      const n = Math.max(1, Math.round(e.count));
      for (let j = 0; j < n; j++) keys.push({ t: f(a.t + ((b.t - a.t) * j) / n), s: [r4((a.v + ((b.v - a.v) * j) / n) * mul)], h: 1 });
    } else {
      const fn = easeFn(e);
      const frames = Math.max(2, Math.round(((b.t - a.t) / 1000) * fps));
      for (let j = 0; j < frames; j++) {
        const p = fn(j / frames);
        keys.push({ t: f(a.t + ((b.t - a.t) * j) / frames), s: [r4((a.v + (b.v - a.v) * p) * mul)], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } });
      }
    }
  }
  return keys;
}

function prop(layer: Layer, p: Prop, fps: number): LProp {
  const tr = layer.tracks[p];
  const mul = scaleOf(p);
  if (!tr || tr.length < 2) return { a: 0, k: r4((tr?.[0]?.v ?? layer.base[p]) * mul) };
  return { a: 1, k: bakeTrack(tr, fps, mul) };
}

/** Lottie needs scale as one [sx, sy] property: merge both tracks on a shared, per-frame key grid. */
function scaleProp(layer: Layer, fps: number, durationMs: number): LProp {
  const sx = layer.tracks.scaleX, sy = layer.tracks.scaleY;
  const animated = (sx && sx.length > 1) || (sy && sy.length > 1);
  if (!animated) return { a: 0, k: [r4(layer.base.scaleX * 100), r4(layer.base.scaleY * 100), 100] };
  const same = JSON.stringify(sx) === JSON.stringify(sy);
  if (same && sx) return { a: 1, k: bakeTrack(sx, fps, 100).map((k) => ({ ...k, s: [k.s[0], k.s[0], 100], ...(k.o ? { o: { x: [k.o.x[0], k.o.x[0], k.o.x[0]], y: [k.o.y[0], k.o.y[0], k.o.y[0]] }, i: { x: [k.i!.x[0], k.i!.x[0], k.i!.x[0]], y: [k.i!.y[0], k.i!.y[0], k.i!.y[0]] } } : {}) })) };
  // Independent X/Y scale timing (squash & stretch): sample every frame, linear between frames.
  const frames = Math.round((durationMs / 1000) * fps);
  const at = (tr: Keyframe[] | undefined, base: number, ms: number) => {
    if (!tr || tr.length === 0) return base;
    if (ms <= tr[0].t) return tr[0].v;
    for (let i = 0; i < tr.length - 1; i++) if (ms >= tr[i].t && ms < tr[i + 1].t) return tr[i].v + (tr[i + 1].v - tr[i].v) * easeFn(tr[i].ease)((ms - tr[i].t) / (tr[i + 1].t - tr[i].t));
    return tr[tr.length - 1].v;
  };
  const k: LKey[] = [];
  for (let fr = 0; fr <= frames; fr++) {
    const ms = (fr / fps) * 1000;
    k.push({ t: fr, s: [r4(at(sx, layer.base.scaleX, ms) * 100), r4(at(sy, layer.base.scaleY, ms) * 100), 100], o: { x: [0, 0, 0], y: [0, 0, 0] }, i: { x: [1, 1, 1], y: [1, 1, 1] } });
  }
  return { a: 1, k };
}

function shapeItems(l: Layer): unknown[] {
  const s = l.shape;
  const items: unknown[] = [];
  if (s.kind === "rect") items.push({ ty: "rc", nm: "Rect", d: 1, s: { a: 0, k: [s.w, s.h] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: s.r ?? 0 } });
  else if (s.kind === "ellipse") items.push({ ty: "el", nm: "Ellipse", d: 1, s: { a: 0, k: [s.w, s.h] }, p: { a: 0, k: [0, 0] } });
  else if (s.kind === "polygon") {
    // A path rather than "sr" so the outline is identical to the preview in every Lottie player.
    const pts = polygonPoints(s.sides, s.radius, s.star, s.inner);
    items.push({ ty: "sh", nm: "Polygon", d: 1, ks: { a: 0, k: { c: true, v: pts, i: pts.map(() => [0, 0]), o: pts.map(() => [0, 0]) } } });
  }
  items.push({ ty: "fl", nm: "Fill", c: { a: 0, k: hexToRgb01(l.fill) }, o: { a: 0, k: 100 }, r: 1 });
  if (l.stroke) items.push({ ty: "st", nm: "Stroke", c: { a: 0, k: hexToRgb01(l.stroke.color) }, o: { a: 0, k: 100 }, w: { a: 0, k: l.stroke.width }, lc: 2, lj: 2 });
  items.push({ ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } });
  return [{ ty: "gr", nm: l.name, it: items }];
}

export function exportLottie(tl: Timeline): { json: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  const op = Math.max(1, Math.round((tl.duration / 1000) * tl.fps));
  const drawable = tl.layers.filter((l) => {
    if (l.shape.kind === "text") { warnings.push(`"${l.name}" is a text layer: Lottie text needs embedded font glyphs, so it is omitted. Convert it to shapes in After Effects or use the CSS / GSAP / Framer export.`); return false; }
    return true;
  });
  const layers = [...drawable].reverse().map((l, i) => ({
    ddd: 0, ind: i + 1, ty: 4, nm: l.name, sr: 1, ao: 0, bm: 0, ip: 0, op, st: 0,
    ks: {
      o: prop(l, "opacity", tl.fps),
      r: prop(l, "rotate", tl.fps),
      p: { s: true, x: prop(l, "x", tl.fps), y: prop(l, "y", tl.fps) },
      a: { a: 0, k: [0, 0, 0] },
      s: scaleProp(l, tl.fps, tl.duration),
    },
    shapes: shapeItems(l),
  }));
  const [r, g, b] = hexToRgb01(tl.background);
  layers.push({
    ddd: 0, ind: layers.length + 1, ty: 4, nm: "Background", sr: 1, ao: 0, bm: 0, ip: 0, op, st: 0,
    ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { s: true, x: { a: 0, k: tl.size.w / 2 }, y: { a: 0, k: tl.size.h / 2 } }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
    shapes: [{ ty: "gr", nm: "bg", it: [{ ty: "rc", d: 1, s: { a: 0, k: [tl.size.w, tl.size.h] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 } }, { ty: "fl", c: { a: 0, k: [r, g, b, 1] }, o: { a: 0, k: 100 }, r: 1 }, { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }] }],
  });
  return { json: { v: "5.12.1", fr: tl.fps, ip: 0, op, w: tl.size.w, h: tl.size.h, nm: tl.name, ddd: 0, assets: [], layers, meta: { g: "Kinesis Studio" } }, warnings };
}
