import { test } from "node:test";
import assert from "node:assert/strict";
import { cubicBezier, springEase } from "../src/lib/motion/easing";
import { normalizeTimeline } from "../src/lib/motion/normalize";
import { valueAt } from "../src/lib/motion/evaluate";
import { lintTimeline } from "../src/lib/motion/lint";
import { exportCss } from "../src/lib/motion/export/css";
import { exportLottie } from "../src/lib/motion/export/lottie";
import { exportGsap } from "../src/lib/motion/export/gsap";
import { exportFramer } from "../src/lib/motion/export/framer";
import { PRESETS } from "../src/lib/motion/presets";

test("cubic-bezier matches browser reference points", () => {
  const ease = cubicBezier(0.25, 0.1, 0.25, 1); // CSS "ease"
  assert.ok(Math.abs(ease(0.5) - 0.8024) < 0.002);
  assert.equal(cubicBezier(0, 0, 1, 1)(0.3).toFixed(4), "0.3000");
});

test("spring starts at 0, overshoots when underdamped, rests at 1", () => {
  const s = springEase(300, 10, 1);
  assert.equal(s(0), 0);
  assert.equal(s(1), 1);
  let max = 0; for (let i = 0; i <= 100; i++) max = Math.max(max, s(i / 100));
  assert.ok(max > 1.05);
  assert.ok(Math.abs(s(0.98) - 1) < 0.01);
});

test("normalizer repairs loose model output and reports every repair", () => {
  const { timeline, repairs } = normalizeTimeline({ duration: 1.5, layers: [{ id: "A b", shape: { type: "circle", size: 40 }, tracks: { scale: [{ t: 0, v: 0, ease: "back.out" }, { t: 1, v: 1 }], opacity: [{ t: 0, v: 0 }, { t: 0.5, v: 100 }] } }] });
  assert.equal(timeline.duration, 1500);
  assert.equal(timeline.layers[0].id, "a-b");
  assert.equal(timeline.layers[0].tracks.scaleX?.[1].t, 1000);
  assert.equal(timeline.layers[0].tracks.opacity?.[1].v, 1);
  assert.ok(repairs.length >= 2);
});

test("evaluator holds before first and after last keyframe", () => {
  const tr = [{ t: 100, v: 10, ease: { type: "linear" as const } }, { t: 200, v: 20 }];
  assert.equal(valueAt(tr, 0, 0), 10);
  assert.equal(valueAt(tr, 150, 0), 15);
  assert.equal(valueAt(tr, 999, 0), 20);
});

test("every preset lints clean and exports to all four targets", () => {
  for (const p of PRESETS) {
    const r = lintTimeline(p);
    assert.ok(r.ok, `${p.name}: ${JSON.stringify(r.issues.filter((i) => i.severity === "error"))}`);
    assert.ok(exportCss(p).css.includes("@keyframes"));
    const l = exportLottie(p).json as { layers: unknown[]; op: number };
    assert.ok(l.layers.length >= 1 && l.op > 0);
    assert.ok(exportGsap(p).includes("gsap.timeline"));
    assert.ok(exportFramer(p).includes("motion.div"));
  }
});

import { fitToFrame, restingBounds } from "../src/lib/motion/frame";
test("fitToFrame pulls a spilling composition inside the safe area", () => {
  const card = (id: string, x: number) => ({ id, name: id, fill: "#ffffff", shape: { kind: "rect" as const, w: 180, h: 120 }, base: { x, y: 225, scaleX: 1, scaleY: 1, rotate: 0, opacity: 1 }, tracks: { x: [{ t: 0, v: -200 }, { t: 400, v: x }] } });
  const tl: any = { version: 1, name: "t", duration: 1000, fps: 60, size: { w: 800, h: 450 }, background: "#000000", layers: [card("a", 140), card("b", 340), card("c", 540), card("d", 740)] };
  const { timeline, notes } = fitToFrame(tl);
  const b = restingBounds(timeline)!;
  assert.ok(notes.length > 0);
  assert.ok(b.x0 >= 39.5 && b.x1 <= 760.5, JSON.stringify(b));
});

import { humanizeStagger } from "../src/lib/motion/humanize";
test("humanizeStagger varies a uniform cadence", () => {
  const card = (id: string, t0: number) => ({ id, name: id, fill: "#ffffff", shape: { kind: "rect" as const, w: 100, h: 80 }, base: { x: 400, y: 225, scaleX: 1, scaleY: 1, rotate: 0, opacity: 1 }, tracks: { x: [{ t: t0, v: -200 }, { t: t0 + 400, v: 400 }] } });
  const tl: any = { version: 1, name: "t", duration: 1400, fps: 60, size: { w: 800, h: 450 }, background: "#000000", layers: [0, 80, 160, 240].map((t, i) => card("c" + i, t)) };
  const { timeline, notes } = humanizeStagger(tl);
  const st = timeline.layers.map((l: any) => l.tracks.x[0].t);
  const d = st.slice(1).map((s: number, i: number) => s - st[i]);
  assert.equal(notes.length, 1);
  assert.ok(new Set(d).size > 1, JSON.stringify(d));
});
