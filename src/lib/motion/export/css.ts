import { r4, sampleEase } from "../easing";
import { shapeCss } from "../geometry";
import type { EaseSpec, Keyframe, Timeline } from "../types";
import { PROPS } from "../types";

export function cssTiming(e?: EaseSpec): string {
  if (!e) return "cubic-bezier(0.65, 0, 0.35, 1)";
  switch (e.type) {
    case "linear": return "linear";
    case "bezier": return `cubic-bezier(${r4(e.x1)}, ${r4(e.y1)}, ${r4(e.x2)}, ${r4(e.y2)})`;
    case "steps": return `steps(${Math.max(1, Math.round(e.count))}, end)`;
    case "hold": return "steps(1, end)";
    case "spring": return `linear(${sampleEase(e, 48).map((v) => r4(v)).join(", ")})`;
  }
}

const pct = (t: number, d: number) => `${r4((t / d) * 100)}%`;

function frames(track: Keyframe[], d: number, varName: string): string {
  const rows: string[] = [];
  if (track[0].t > 0) rows.push(`  0% { ${varName}: ${r4(track[0].v)}; animation-timing-function: linear; }`);
  track.forEach((k, i) => {
    const tf = i < track.length - 1 ? ` animation-timing-function: ${cssTiming(k.ease)};` : "";
    rows.push(`  ${pct(k.t, d)} { ${varName}: ${r4(k.v)};${tf} }`);
  });
  if (track[track.length - 1].t < d) rows.push(`  100% { ${varName}: ${r4(track[track.length - 1].v)}; }`);
  return rows.join("\n");
}

/** Pure CSS: registered custom properties give every property its own keyframes and per-segment easing. */
export function exportCss(tl: Timeline): { css: string; html: string } {
  const iter = tl.loop ? "infinite" : "1";
  const out: string[] = [
    `/* ${tl.name} — exported by Kinesis Studio. ${tl.duration}ms @ ${tl.fps}fps */`,
    ...PROPS.map((p) => `@property --k-${p} { syntax: "<number>"; inherits: false; initial-value: ${p.startsWith("scale") || p === "opacity" ? 1 : 0}; }`),
    "",
    `.kinesis-stage { position: relative; width: ${tl.size.w}px; height: ${tl.size.h}px; background: ${tl.background}; overflow: hidden; }`,
    `.kinesis-stage .k-layer { position: absolute; left: 0; top: 0; width: 0; height: 0; opacity: var(--k-opacity);`,
    `  transform: translate(calc(var(--k-x) * 1px), calc(var(--k-y) * 1px)) rotate(calc(var(--k-rotate) * 1deg)) scale(var(--k-scaleX), var(--k-scaleY)); }`,
    `.kinesis-stage .k-layer > * { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); }`,
    "",
  ];
  for (const l of tl.layers) {
    const anims: string[] = [];
    const statics = PROPS.map((p) => `--k-${p}: ${r4(l.base[p])};`).join(" ");
    for (const p of PROPS) {
      const tr = l.tracks[p];
      if (!tr || tr.length < 2) continue;
      const name = `k-${l.id}-${p}`;
      anims.push(`${name} ${tl.duration}ms ${iter} both`);
      out.push(`@keyframes ${name} {\n${frames(tr, tl.duration, `--k-${p}`)}\n}`);
    }
    out.push(`.k-${l.id} { ${statics}${anims.length ? `\n  animation: ${anims.join(",\n    ")};` : ""} }`);
    out.push(`.k-${l.id} > * { ${shapeCss(l.shape, l.fill, l.stroke)} }`, "");
  }
  out.push(`@media (prefers-reduced-motion: reduce) { .kinesis-stage .k-layer { animation-duration: 1ms !important; animation-iteration-count: 1 !important; } }`);
  const html = `<div class="kinesis-stage">\n${[...tl.layers].map((l) => `  <div class="k-layer k-${l.id}"><${l.shape.kind === "text" ? "span" : "i"}>${l.shape.kind === "text" ? escapeHtml(l.shape.text) : ""}</${l.shape.kind === "text" ? "span" : "i"}></div>`).join("\n")}\n</div>`;
  return { css: out.join("\n"), html };
}

export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
