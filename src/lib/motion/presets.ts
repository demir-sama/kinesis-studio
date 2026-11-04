import { namedBezier } from "./easing";
import { normalizeTimeline } from "./normalize";
import type { EaseSpec, Keyframe, Timeline } from "./types";

/* Hand-keyed starter timelines. These are authored presets — not AI output — and are labelled as such in the UI. */

const E = (n: string) => namedBezier(n)!;
const bz = (x1: number, y1: number, x2: number, y2: number): EaseSpec => ({ type: "bezier", x1, y1, x2, y2 });
const spring = (stiffness: number, damping: number, mass = 1): EaseSpec => ({ type: "spring", stiffness, damping, mass });
const k = (t: number, v: number, ease?: EaseSpec): Keyframe => ({ t, v, ease });
const gravityIn = bz(0.55, 0, 0.85, 0.36);
const gravityOut = bz(0.15, 0.64, 0.45, 1);

const raw: Record<string, unknown>[] = [
  {
    name: "Squash & Stretch",
    description: "A ball drops under gravity, squashes on contact, stretches on the rebound. Shadow tracks height.",
    duration: 1400, fps: 60, size: { w: 800, h: 450 }, background: "#0e0e12", loop: true,
    layers: [
      { id: "shadow", name: "Shadow", shape: { kind: "ellipse", w: 120, h: 18 }, fill: "#000000", base: { x: 400, y: 392 },
        tracks: { scaleX: [k(0, 0.45, gravityIn), k(560, 1.15, E("ease-out-cubic")), k(640, 1.15, gravityOut), k(1400, 0.45)], scaleY: [k(0, 0.45, gravityIn), k(560, 1, gravityOut), k(1400, 0.45)], opacity: [k(0, 0.18, gravityIn), k(560, 0.55, gravityOut), k(1400, 0.18)] } },
      { id: "ball", name: "Ball", shape: { kind: "ellipse", w: 96, h: 96 }, fill: "#ff5b2e", base: { x: 400 },
        tracks: {
          y: [k(0, 96, gravityIn), k(560, 340, { type: "linear" }), k(640, 352, gravityOut), k(1400, 96)],
          scaleX: [k(0, 1, gravityIn), k(520, 0.86, E("ease-out-cubic")), k(580, 1.36, spring(420, 18)), k(760, 0.88, E("ease-in-out-sine")), k(1000, 1, E("ease-in-out-sine")), k(1400, 1)],
          scaleY: [k(0, 1, gravityIn), k(520, 1.18, E("ease-out-cubic")), k(580, 0.66, spring(420, 18)), k(760, 1.14, E("ease-in-out-sine")), k(1000, 1, E("ease-in-out-sine")), k(1400, 1)],
        } },
    ],
  },
  {
    name: "Notification Pop",
    description: "A toast drops in on a spring, its icon pops with overshoot, copy lines stagger, then it leaves with intent.",
    duration: 3200, fps: 60, size: { w: 800, h: 450 }, background: "#f1ede4", loop: true,
    layers: [
      { id: "card", name: "Card", shape: { kind: "rect", w: 420, h: 112, r: 22 }, fill: "#16161d", base: { x: 400, y: 160 },
        tracks: { y: [k(0, -90, spring(210, 20)), k(700, 160, E("ease-in-out-cubic")), k(2500, 160, E("anticipate")), k(3000, -120)], scaleX: [k(0, 0.92, spring(260, 22)), k(700, 1, E("back-in")), k(2500, 1), k(3000, 0.9)], opacity: [k(0, 0, E("ease-out-cubic")), k(260, 1, E("ease-in-out-cubic")), k(2780, 1, E("ease-in-cubic")), k(3000, 0)] } },
      { id: "icon", name: "Icon", shape: { kind: "ellipse", w: 56, h: 56 }, fill: "#ff5b2e", base: { x: 254, y: 160 },
        tracks: { scaleX: [k(0, 0), k(260, 0, E("back-out")), k(620, 1, E("ease-in-cubic")), k(2560, 1, E("ease-in-cubic")), k(2780, 0)], scaleY: [k(0, 0), k(260, 0, E("back-out")), k(620, 1, E("ease-in-cubic")), k(2560, 1, E("ease-in-cubic")), k(2780, 0)], y: [k(0, -90, spring(210, 20)), k(700, 160, E("ease-in-out-cubic")), k(2500, 160, E("anticipate")), k(3000, -120)] } },
      { id: "line-1", name: "Title line", shape: { kind: "rect", w: 220, h: 14, r: 7 }, fill: "#f1ede4", base: { y: 146 },
        tracks: { x: [k(0, 362), k(330, 362, E("ease-out-quint")), k(830, 412)], opacity: [k(0, 0), k(330, 0, E("ease-out-cubic")), k(700, 1, E("ease-in-cubic")), k(2560, 1, E("ease-in-cubic")), k(2760, 0)], y: [k(0, -104, spring(210, 20)), k(700, 146, E("ease-in-out-cubic")), k(2500, 146, E("anticipate")), k(3000, -134)] } },
      { id: "line-2", name: "Body line", shape: { kind: "rect", w: 150, h: 10, r: 5 }, fill: "#8a8794", base: { y: 176 },
        tracks: { x: [k(0, 340), k(400, 340, E("ease-out-quint")), k(900, 378)], opacity: [k(0, 0), k(400, 0, E("ease-out-cubic")), k(760, 1, E("ease-in-cubic")), k(2540, 1, E("ease-in-cubic")), k(2740, 0)], y: [k(0, -74, spring(210, 20)), k(700, 176, E("ease-in-out-cubic")), k(2500, 176, E("anticipate")), k(3000, -104)] } },
    ],
  },
  {
    name: "Breathing Loader",
    description: "Three dots hop in sequence with squash on landing and a sine-weighted breath — a loader that feels alive.",
    duration: 1200, fps: 60, size: { w: 800, h: 450 }, background: "#101014", loop: true,
    layers: [0, 1, 2].map((i) => {
      const o = i * 120;
      return { id: `dot-${i + 1}`, name: `Dot ${i + 1}`, shape: { kind: "ellipse", w: 34, h: 34 }, fill: ["#ff5b2e", "#ffb547", "#8ef0d0"][i], base: { x: 340 + i * 60 },
        tracks: {
          y: [k(0, 240), k(o, 240, E("ease-out-cubic")), k(o + 260, 180, E("ease-in-cubic")), k(o + 520, 240), k(1200, 240)],
          scaleY: [k(0, 1), k(o, 1, E("ease-out-cubic")), k(o + 80, 1.18, E("ease-in-out-sine")), k(o + 260, 1, E("ease-in-cubic")), k(o + 520, 0.74, spring(500, 16)), k(o + 680, 1), k(1200, 1)],
          scaleX: [k(0, 1), k(o, 1, E("ease-out-cubic")), k(o + 80, 0.86, E("ease-in-out-sine")), k(o + 260, 1, E("ease-in-cubic")), k(o + 520, 1.22, spring(500, 16)), k(o + 680, 1), k(1200, 1)],
        } };
    }),
  },
  {
    name: "Logo Sting",
    description: "A star mark whips in on an expo curve, an accent bar wipes under it, and the wordmark settles with a stagger.",
    duration: 2600, fps: 60, size: { w: 800, h: 450 }, background: "#0b0b0f", loop: true,
    layers: [
      { id: "bar", name: "Accent bar", shape: { kind: "rect", w: 300, h: 6, r: 3 }, fill: "#ff5b2e", base: { x: 400, y: 300 },
        tracks: { scaleX: [k(0, 0), k(380, 0, E("ease-in-out-expo")), k(1100, 1, E("ease-in-out-cubic")), k(2200, 1, E("ease-in-expo")), k(2550, 0)] } },
      { id: "mark", name: "Star mark", shape: { kind: "polygon", sides: 4, radius: 64, star: true, inner: 0.32 }, fill: "#f4efe6", base: { x: 400, y: 170 },
        tracks: { rotate: [k(0, -225, E("ease-out-expo")), k(1000, 0, E("ease-in-out-sine")), k(2200, 8, E("ease-in-expo")), k(2550, 135)], scaleX: [k(0, 0, spring(170, 11)), k(900, 1, E("ease-in-expo")), k(2200, 1), k(2550, 0)], scaleY: [k(0, 0, spring(170, 11)), k(900, 1, E("ease-in-expo")), k(2200, 1), k(2550, 0)] } },
      ...["K", "I", "N", "E", "S", "I", "S"].map((ch, i) => ({ id: `letter-${i}`, name: `Letter ${ch}`, shape: { kind: "text", text: ch, size: 44, weight: 800 }, fill: "#f4efe6", base: { x: 292 + i * 36 },
        tracks: { y: [k(0, 286), k(520 + i * 45, 286, E("ease-out-quint")), k(1180 + i * 45, 262, E("ease-in-cubic")), k(2200 + i * 18, 262, E("ease-in-cubic")), k(2440 + i * 18, 286)], opacity: [k(0, 0), k(520 + i * 45, 0, E("ease-out-cubic")), k(900 + i * 45, 1, E("ease-in-cubic")), k(2200 + i * 18, 1, E("ease-in-cubic")), k(2400 + i * 18, 0)] } })),
    ],
  },
  {
    name: "Elastic Toggle",
    description: "A switch knob travels on a spring, stretches mid-flight, and the track cross-fades its state.",
    duration: 2400, fps: 60, size: { w: 800, h: 450 }, background: "#e9e4da", loop: true,
    layers: [
      { id: "track-off", name: "Track off", shape: { kind: "rect", w: 200, h: 96, r: 48 }, fill: "#c9c3b7", base: { x: 400, y: 225 }, tracks: {} },
      { id: "track-on", name: "Track on", shape: { kind: "rect", w: 200, h: 96, r: 48 }, fill: "#ff5b2e", base: { x: 400, y: 225 },
        tracks: { opacity: [k(0, 0), k(300, 0, E("ease-out-cubic")), k(620, 1), k(1500, 1, E("ease-out-cubic")), k(1820, 0)] } },
      { id: "knob", name: "Knob", shape: { kind: "ellipse", w: 76, h: 76 }, fill: "#ffffff", base: { y: 225 },
        tracks: { x: [k(0, 350), k(300, 350, spring(260, 17)), k(1000, 450), k(1500, 450, spring(260, 17)), k(2200, 350)], scaleX: [k(0, 1), k(300, 1, E("ease-out-cubic")), k(420, 1.28, E("ease-in-out-sine")), k(640, 1, E("ease-in-out-sine")), k(1500, 1, E("ease-out-cubic")), k(1620, 1.28, E("ease-in-out-sine")), k(1840, 1)], scaleY: [k(0, 1), k(300, 1, E("ease-out-cubic")), k(420, 0.88, E("ease-in-out-sine")), k(640, 1, E("ease-in-out-sine")), k(1500, 1, E("ease-out-cubic")), k(1620, 0.88, E("ease-in-out-sine")), k(1840, 1)] } },
    ],
  },
  {
    name: "Card Stack Rise",
    description: "Three cards rise in a 70ms cascade on a quint curve, then settle their tilt on a soft spring.",
    duration: 2000, fps: 60, size: { w: 800, h: 450 }, background: "#14141a", loop: true,
    layers: [2, 1, 0].map((i) => ({ id: `card-${i + 1}`, name: `Card ${i + 1}`, shape: { kind: "rect", w: 240, h: 300, r: 26 }, fill: ["#f4efe6", "#ffb547", "#ff5b2e"][i], base: { x: 400 + (i - 1) * 34 },
      tracks: {
        y: [k(0, 640), k(i * 70, 640, E("ease-out-quint")), k(760 + i * 70, 225 + (1 - i) * 6), k(1600, 225 + (1 - i) * 6, E("ease-in-expo")), k(1950, 640)],
        rotate: [k(0, 18 - i * 9), k(i * 70, 18 - i * 9, spring(120, 9)), k(1100 + i * 70, (i - 1) * 6), k(1600, (i - 1) * 6, E("ease-in-cubic")), k(1950, -10)],
        opacity: [k(0, 0), k(i * 70, 0, E("ease-out-cubic")), k(260 + i * 70, 1), k(1800, 1, E("ease-in-cubic")), k(1950, 0)],
      } })),
  },
];

export const PRESETS: Timeline[] = raw.map((r) => normalizeTimeline(r).timeline);
