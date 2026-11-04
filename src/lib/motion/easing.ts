import type { EaseSpec } from "./types";

/** Named curves a motion designer actually reaches for. Values are CSS cubic-bezier control points. */
export const NAMED_EASES: Record<string, { x1: number; y1: number; x2: number; y2: number; note: string }> = {
  "ease-in-out-sine": { x1: 0.37, y1: 0, x2: 0.63, y2: 1, note: "Gentle, breathing loops" },
  "ease-out-cubic": { x1: 0.33, y1: 1, x2: 0.68, y2: 1, note: "Default UI entrance" },
  "ease-in-cubic": { x1: 0.32, y1: 0, x2: 0.67, y2: 0, note: "Exits that leave the frame" },
  "ease-in-out-cubic": { x1: 0.65, y1: 0, x2: 0.35, y2: 1, note: "On-screen moves A→B" },
  "ease-out-quint": { x1: 0.22, y1: 1, x2: 0.36, y2: 1, note: "Confident, decisive arrivals" },
  "ease-out-expo": { x1: 0.16, y1: 1, x2: 0.3, y2: 1, note: "Fast launch, long settle — hero moments" },
  "ease-in-expo": { x1: 0.7, y1: 0, x2: 0.84, y2: 0, note: "Accelerating exits, whooshes" },
  "ease-in-out-expo": { x1: 0.87, y1: 0, x2: 0.13, y2: 1, note: "Dramatic transitions" },
  "ease-in-out-quart": { x1: 0.76, y1: 0, x2: 0.24, y2: 1, note: "Snappy page transitions" },
  "back-out": { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1, note: "Overshoot then settle — playful pops" },
  "back-in": { x1: 0.36, y1: 0, x2: 0.66, y2: -0.56, note: "Anticipation before an exit" },
  "anticipate": { x1: 0.68, y1: -0.6, x2: 0.32, y2: 1.6, note: "Wind-up, then overshoot" },
  "material-standard": { x1: 0.2, y1: 0, x2: 0, y2: 1, note: "Material 3 emphasized feel" },
  "apple-snap": { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1, note: "CSS 'ease' — familiar, neutral" },
};

export function namedBezier(name: string): EaseSpec | null {
  const n = NAMED_EASES[name];
  return n ? { type: "bezier", x1: n.x1, y1: n.y1, x2: n.x2, y2: n.y2, name } : null;
}

/** Cubic-bezier timing function solver (same maths as browsers: Newton-Raphson with bisection fallback). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-7) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-7) return t;
      if (x > v) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

/**
 * Damped harmonic oscillator from 0 → 1 with zero initial velocity.
 * The physical settle time is mapped onto the segment, so the spring always comes to rest
 * exactly at the next keyframe — the same contract every exporter bakes.
 */
export function springPosition(stiffness: number, damping: number, mass: number, time: number): number {
  const k = Math.max(stiffness, 0.01), c = Math.max(damping, 0), m = Math.max(mass, 0.01);
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * time) * (Math.cos(wd * time) + ((zeta * w0) / wd) * Math.sin(wd * time));
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * time) * (1 + w0 * time);
  const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1));
  const r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
  const c2 = -r1 / (r2 - r1);
  const c1 = -1 - c2;
  return 1 + c1 * Math.exp(r1 * time) + c2 * Math.exp(r2 * time);
}

const settleCache = new Map<string, number>();
export function springSettleTime(stiffness: number, damping: number, mass: number): number {
  const key = `${stiffness}|${damping}|${mass}`;
  const hit = settleCache.get(key);
  if (hit) return hit;
  const dt = 1 / 240;
  let last = 0;
  for (let t = 0; t < 30; t += dt) {
    if (Math.abs(springPosition(stiffness, damping, mass, t) - 1) > 0.0015) last = t;
  }
  const r = Math.max(last + dt, 0.05);
  settleCache.set(key, r);
  return r;
}

export function springEase(stiffness: number, damping: number, mass: number): (t: number) => number {
  const T = springSettleTime(stiffness, damping, mass);
  return (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : springPosition(stiffness, damping, mass, t * T));
}

export function easeFn(e?: EaseSpec): (t: number) => number {
  if (!e) return cubicBezier(0.65, 0, 0.35, 1);
  switch (e.type) {
    case "linear": return (t) => t;
    case "bezier": return cubicBezier(e.x1, e.y1, e.x2, e.y2);
    case "spring": return springEase(e.stiffness, e.damping, e.mass);
    case "steps": { const n = Math.max(1, Math.round(e.count)); return (t) => (t >= 1 ? 1 : Math.floor(t * n) / n); }
    case "hold": return (t) => (t >= 1 ? 1 : 0);
  }
}

/** Uniform samples of an ease — used to bake springs into CSS linear(), Lottie, GSAP CustomEase. */
export function sampleEase(e: EaseSpec | undefined, n = 40): number[] {
  const f = easeFn(e);
  return Array.from({ length: n + 1 }, (_, i) => f(i / n));
}

export function easeLabel(e?: EaseSpec): string {
  if (!e) return "ease-in-out-cubic";
  switch (e.type) {
    case "linear": return "linear";
    case "bezier": return e.name ?? `bezier(${[e.x1, e.y1, e.x2, e.y2].map((n) => +n.toFixed(2)).join(", ")})`;
    case "spring": return `spring(${e.stiffness}, ${e.damping}, ${e.mass})`;
    case "steps": return `steps(${e.count})`;
    case "hold": return "hold";
  }
}

export const r4 = (n: number) => Math.round(n * 10000) / 10000;
