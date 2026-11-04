import { r4, sampleEase } from "../easing";
import type { EaseSpec, Timeline } from "../types";
import { PROPS } from "../types";
import { exportCss } from "./css";

const GSAP_PROP: Record<string, string> = { x: "x", y: "y", scaleX: "scaleX", scaleY: "scaleY", rotate: "rotation", opacity: "opacity" };

export function exportGsap(tl: Timeline): string {
  const eases = new Map<string, string>();
  const easeRef = (e?: EaseSpec): string => {
    if (e?.type === "linear") return `"none"`;
    if (e?.type === "hold") return `"steps(1)"`;
    if (e?.type === "steps") return `"steps(${Math.max(1, Math.round(e.count))})"`;
    let data: string;
    if (!e) data = "0.65,0,0.35,1";
    else if (e.type === "bezier") data = [e.x1, e.y1, e.x2, e.y2].map(r4).join(",");
    else data = "M0,0 " + sampleEase(e, 60).map((v, i) => `L${r4(i / 60)},${r4(v)}`).join(" ");
    if (!eases.has(data)) eases.set(data, `k${eases.size}`);
    return `"${eases.get(data)}"`;
  };
  const body: string[] = [];
  for (const l of tl.layers) {
    const sel = `"#k-${l.id}"`;
    const set = PROPS.map((p) => `${GSAP_PROP[p]}: ${r4(l.base[p])}`).join(", ");
    body.push(`  gsap.set(${sel}, { ${set} });`);
    for (const p of PROPS) {
      const tr = l.tracks[p];
      if (!tr || tr.length < 2) continue;
      body.push(`  // ${l.name} · ${p}`);
      body.push(`  tl.set(${sel}, { ${GSAP_PROP[p]}: ${r4(tr[0].v)} }, 0);`);
      for (let i = 0; i < tr.length - 1; i++) {
        const a = tr[i], b = tr[i + 1];
        body.push(`  tl.to(${sel}, { ${GSAP_PROP[p]}: ${r4(b.v)}, duration: ${r4((b.t - a.t) / 1000)}, ease: ${easeRef(a.ease)} }, ${r4(a.t / 1000)});`);
      }
    }
  }
  const { html } = exportCss(tl);
  const markup = html.replace(/class="k-layer k-([^"]+)"/g, 'class="k-layer" id="k-$1"');
  const lines = [
    `// ${tl.name} — exported by Kinesis Studio (GSAP 3.13+, CustomEase is free in the standard package)`,
    `import gsap from "gsap";`,
    `import { CustomEase } from "gsap/CustomEase";`,
    `gsap.registerPlugin(CustomEase);`,
    ``,
    ...[...eases.entries()].map(([data, id]) => `CustomEase.create("${id}", "${data}");`),
    ``,
    `/* Markup (each .k-layer is a zero-size pivot; its child is centred on it):`,
    markup.split("\n").map((s) => " * " + s).join("\n"),
    ` * .kinesis-stage { position: relative; width: ${tl.size.w}px; height: ${tl.size.h}px; background: ${tl.background}; overflow: hidden }`,
    ` * .k-layer { position: absolute; left: 0; top: 0 } .k-layer > * { position: absolute; transform: translate(-50%, -50%) }`,
    ` */`,
    `export function play${pascal(tl.name)}() {`,
    `  const tl = gsap.timeline({ repeat: ${tl.loop ? -1 : 0} });`,
    ...body,
    `  tl.set({}, {}, ${r4(tl.duration / 1000)}); // pad to the full ${tl.duration}ms`,
    `  return tl;`,
    `}`,
  ];
  return lines.join("\n");
}

export const pascal = (s: string) => (s.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^./, (c) => c.toUpperCase()) || "Motion").replace(/^[0-9]/, "M$&");
