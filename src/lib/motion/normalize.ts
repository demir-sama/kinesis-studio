import { NAMED_EASES, namedBezier } from "./easing";
import type { EaseSpec, Keyframe, Layer, Prop, Shape, Timeline } from "./types";
import { PROPS, PROP_META } from "./types";

/**
 * Turns loosely-shaped JSON (model output, hand-written files, older versions) into a strict Timeline.
 * Every repair is reported, so nothing is silently "fixed" behind the user's back.
 */
export interface NormalizeResult { timeline: Timeline; repairs: string[] }

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(+v) ? +v : d);
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function parseEase(raw: unknown, repairs: string[], where: string): EaseSpec | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    if (s === "linear") return { type: "linear" };
    if (s === "hold" || s === "step-end") return { type: "hold" };
    const nb = namedBezier(s);
    if (nb) return nb;
    const m = s.match(/cubic-bezier\(([^)]+)\)/) ?? s.match(/bezier\(([^)]+)\)/);
    if (m) {
      const [x1, y1, x2, y2] = m[1].split(",").map((n) => +n);
      if ([x1, y1, x2, y2].every(Number.isFinite)) return { type: "bezier", x1: clamp(x1, 0, 1), y1, x2: clamp(x2, 0, 1), y2 };
    }
    const sp = s.match(/spring\(([^)]+)\)/);
    if (sp) {
      const [k, c, m2] = sp[1].split(",").map((n) => +n);
      return { type: "spring", stiffness: k || 180, damping: c || 14, mass: m2 || 1 };
    }
    const st = s.match(/steps\((\d+)/);
    if (st) return { type: "steps", count: +st[1] };
    const alias: Record<string, string> = {
      "ease-out": "ease-out-cubic", "ease-in": "ease-in-cubic", "ease-in-out": "ease-in-out-cubic", ease: "apple-snap",
      easeout: "ease-out-cubic", easein: "ease-in-cubic", easeinout: "ease-in-out-cubic", "expo-out": "ease-out-expo",
      "power2.out": "ease-out-cubic", "power3.out": "ease-out-quint", "power2.in": "ease-in-cubic", "power2.inout": "ease-in-out-cubic",
      "expo.out": "ease-out-expo", "back.out": "back-out", "back.in": "back-in", "sine.inout": "ease-in-out-sine", overshoot: "back-out",
    };
    const a = alias[s.replace(/_/g, "-")] ?? alias[s.replace(/[-_\s]/g, "")];
    if (a) { repairs.push(`${where}: mapped ease "${raw}" → ${a}`); return namedBezier(a)!; }
    repairs.push(`${where}: unknown ease "${raw}", used ease-in-out-cubic`);
    return namedBezier("ease-in-out-cubic")!;
  }
  if (Array.isArray(raw) && raw.length === 4 && raw.every((n) => typeof n === "number")) {
    return { type: "bezier", x1: clamp(raw[0], 0, 1), y1: raw[1], x2: clamp(raw[2], 0, 1), y2: raw[3] };
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const type = String(o.type ?? "").toLowerCase();
    if (type === "linear") return { type: "linear" };
    if (type === "hold") return { type: "hold" };
    if (type === "steps") return { type: "steps", count: Math.max(1, Math.round(num(o.count, 4))) };
    if (type === "spring") return { type: "spring", stiffness: clamp(num(o.stiffness, 180), 1, 2000), damping: clamp(num(o.damping, 14), 0.5, 400), mass: clamp(num(o.mass, 1), 0.05, 50) };
    if (type === "bezier" || "x1" in o) {
      if (typeof o.name === "string" && NAMED_EASES[o.name] && !("x1" in o)) return namedBezier(o.name)!;
      return { type: "bezier", x1: clamp(num(o.x1, 0.65), 0, 1), y1: num(o.y1, 0), x2: clamp(num(o.x2, 0.35), 0, 1), y2: num(o.y2, 1), ...(typeof o.name === "string" ? { name: o.name } : {}) };
    }
    if (typeof o.name === "string") return parseEase(o.name, repairs, where);
  }
  repairs.push(`${where}: unreadable ease, used ease-in-out-cubic`);
  return namedBezier("ease-in-out-cubic")!;
}

function clamp(n: number, a: number, b: number) { return Math.min(b, Math.max(a, n)); }

function parseShape(raw: unknown, repairs: string[], where: string): Shape {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind = String(o.kind ?? o.type ?? "rect").toLowerCase();
  if (kind === "ellipse" || kind === "circle") {
    const d = num(o.size ?? o.diameter, 0) || num(o.r, 0) * 2 || 80;
    return { kind: "ellipse", w: num(o.w ?? o.width, d), h: num(o.h ?? o.height, d) };
  }
  if (kind === "polygon" || kind === "star" || kind === "triangle") {
    return { kind: "polygon", sides: Math.max(3, Math.round(num(o.sides ?? o.points, kind === "triangle" ? 3 : 5))), radius: num(o.radius ?? o.r, 50), star: kind === "star" || o.star === true, inner: clamp(num(o.inner, 0.45), 0.05, 0.95) };
  }
  if (kind === "text") {
    return { kind: "text", text: String(o.text ?? o.content ?? "Text").slice(0, 120), size: clamp(num(o.size ?? o.fontSize, 48), 4, 600), weight: clamp(num(o.weight ?? o.fontWeight, 600), 100, 900) };
  }
  if (kind !== "rect" && kind !== "square" && kind !== "rectangle") repairs.push(`${where}: unknown shape "${kind}", drew a rect`);
  const s = num(o.size, 0) || 100;
  return { kind: "rect", w: num(o.w ?? o.width, s), h: num(o.h ?? o.height, s), r: num(o.r ?? o.radius ?? o.cornerRadius, 0) };
}

export function normalizeTimeline(input: unknown): NormalizeResult {
  const repairs: string[] = [];
  let raw = input as Record<string, unknown>;
  if (typeof input === "string") raw = JSON.parse(input);
  if (raw && typeof raw === "object" && "timeline" in raw && typeof raw.timeline === "object") raw = raw.timeline as Record<string, unknown>;
  if (!raw || typeof raw !== "object") throw new Error("Timeline must be a JSON object");

  let duration = num(raw.duration ?? raw.durationMs, 2000);
  const secondsHint = duration > 0 && duration <= 30;
  if (secondsHint) { repairs.push(`duration ${duration} looked like seconds → ${duration * 1000}ms`); duration *= 1000; }
  duration = clamp(Math.round(duration), 100, 60000);
  const sizeRaw = (raw.size ?? raw.canvas ?? {}) as Record<string, unknown>;
  const size = { w: clamp(Math.round(num(sizeRaw.w ?? sizeRaw.width, 800)), 64, 4096), h: clamp(Math.round(num(sizeRaw.h ?? sizeRaw.height, 450)), 64, 4096) };
  const layersRaw = Array.isArray(raw.layers) ? raw.layers : [];
  if (layersRaw.length === 0) repairs.push("timeline had no layers");
  const ids = new Set<string>();

  const layers: Layer[] = layersRaw.slice(0, 40).map((lr: unknown, i: number) => {
    const l = (lr ?? {}) as Record<string, unknown>;
    let id = String(l.id ?? `layer-${i + 1}`).toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 40) || `layer-${i + 1}`;
    while (ids.has(id)) id = `${id}-${i}`;
    ids.add(id);
    const where = `layer "${id}"`;
    const fill = typeof l.fill === "string" && HEX.test(l.fill) ? l.fill : typeof l.color === "string" && HEX.test(l.color) ? (l.color as string) : "#f4efe6";
    if (fill !== l.fill && l.fill !== undefined) repairs.push(`${where}: fill "${String(l.fill)}" is not hex, used ${fill}`);
    const baseRaw = (l.base ?? l.initial ?? {}) as Record<string, unknown>;
    const base = {} as Record<Prop, number>;
    for (const p of PROPS) base[p] = num(baseRaw[p], p === "x" ? size.w / 2 : p === "y" ? size.h / 2 : PROP_META[p].def);
    if (baseRaw.scale !== undefined) { base.scaleX = base.scaleY = num(baseRaw.scale, 1); }
    const tracksRaw = (l.tracks ?? l.keyframes ?? {}) as Record<string, unknown>;
    const tracks: Partial<Record<Prop, Keyframe[]>> = {};
    const aliases: Record<string, Prop[]> = { x: ["x"], y: ["y"], scale: ["scaleX", "scaleY"], scalex: ["scaleX"], scaley: ["scaleY"], rotate: ["rotate"], rotation: ["rotate"], opacity: ["opacity"], alpha: ["opacity"] };
    for (const [key, value] of Object.entries(tracksRaw)) {
      const targets = aliases[key.toLowerCase()];
      if (!targets) { repairs.push(`${where}: dropped unsupported track "${key}"`); continue; }
      if (!Array.isArray(value)) continue;
      let kfs: Keyframe[] = value
        .map((k: unknown, j: number) => {
          const ko = (k ?? {}) as Record<string, unknown>;
          let t = num(ko.t ?? ko.time ?? ko.at, NaN);
          if (!Number.isFinite(t)) return null;
          if (secondsHint && t <= duration / 1000 + 0.001) t *= 1000;
          let v = num(ko.v ?? ko.value, NaN);
          if (!Number.isFinite(v)) return null;
          if (targets[0] === "opacity" && v > 1 && v <= 100) { v = v / 100; }
          return { t: clamp(Math.round(t), 0, duration), v, ease: parseEase(ko.ease ?? ko.easing, repairs, `${where}.${key}[${j}]`) } as Keyframe;
        })
        .filter((k): k is Keyframe => k !== null)
        .sort((a, b) => a.t - b.t);
      const dedup: Keyframe[] = [];
      for (const k of kfs) { if (dedup.length && dedup[dedup.length - 1].t === k.t) { dedup[dedup.length - 1] = k; repairs.push(`${where}.${key}: merged keyframes at ${k.t}ms`); } else dedup.push(k); }
      kfs = dedup;
      for (const p of targets) {
        const m = PROP_META[p];
        tracks[p] = kfs.map((k) => ({ ...k, v: clamp(k.v, m.min, m.max) }));
        if (kfs.length) base[p] = kfs[0].v;
      }
    }
    return { id, name: String(l.name ?? id).slice(0, 60), shape: parseShape(l.shape ?? l, repairs, where), fill, ...(l.stroke && typeof l.stroke === "object" ? { stroke: { color: String((l.stroke as Record<string, unknown>).color ?? "#000000"), width: num((l.stroke as Record<string, unknown>).width, 2) } } : {}), base, tracks };
  });

  return {
    timeline: {
      version: 1,
      name: String(raw.name ?? "Untitled motion").slice(0, 80),
      description: typeof raw.description === "string" ? raw.description.slice(0, 400) : undefined,
      duration,
      fps: clamp(Math.round(num(raw.fps, 60)), 12, 120),
      size,
      background: typeof raw.background === "string" && HEX.test(raw.background) ? raw.background : "#101014",
      loop: raw.loop === undefined ? true : Boolean(raw.loop),
      layers,
    },
    repairs,
  };
}
