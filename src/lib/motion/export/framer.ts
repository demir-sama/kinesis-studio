import { r4, sampleEase } from "../easing";
import { shapeCss } from "../geometry";
import type { EaseSpec, Timeline } from "../types";
import { PROPS } from "../types";
import { pascal } from "./gsap";

function cssToReact(css: string): string {
  return "{ " + css.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(":");
    const k = d.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return `${k}: ${JSON.stringify(d.slice(i + 1).trim())}`;
  }).join(", ") + " }";
}

export function exportFramer(tl: Timeline): string {
  const helpers = new Map<string, string>();
  const ease = (e?: EaseSpec): string => {
    if (!e) return "[0.65, 0, 0.35, 1]";
    if (e.type === "linear") return `"linear"`;
    if (e.type === "bezier") return `[${[e.x1, e.y1, e.x2, e.y2].map(r4).join(", ")}]`;
    const table = JSON.stringify(sampleEase(e, 48).map((v) => r4(v)));
    if (!helpers.has(table)) helpers.set(table, `ease${helpers.size}`);
    return helpers.get(table)!;
  };
  const d = tl.duration;
  const layers = tl.layers.map((l) => {
    const animate: string[] = [], transition: string[] = [], initial: string[] = [];
    for (const p of PROPS) {
      initial.push(`${p}: ${r4(l.base[p])}`);
      const tr = l.tracks[p];
      if (!tr || tr.length < 2) continue;
      const vals: number[] = [], times: number[] = [], eases: string[] = [];
      if (tr[0].t > 0) { vals.push(tr[0].v); times.push(0); eases.push(`"linear"`); }
      tr.forEach((k, i) => { vals.push(k.v); times.push(k.t / d); if (i < tr.length - 1) eases.push(ease(k.ease)); });
      if (tr[tr.length - 1].t < d) { eases.push(`"linear"`); vals.push(tr[tr.length - 1].v); times.push(1); }
      animate.push(`${p}: [${vals.map(r4).join(", ")}]`);
      transition.push(`${p}: { duration: ${r4(d / 1000)}, times: [${times.map(r4).join(", ")}], ease: [${eases.join(", ")}]${tl.loop ? ", repeat: Infinity" : ""} }`);
    }
    const child = l.shape.kind === "text" ? `<span style={{ ...center, ...${cssToReact(shapeCss(l.shape, l.fill, l.stroke))} }}>${l.shape.text.replace(/[{}<>]/g, "")}</span>` : `<i style={{ ...center, ...${cssToReact(shapeCss(l.shape, l.fill, l.stroke))} }} />`;
    return `      {/* ${l.name} */}
      <motion.div
        style={pivot}
        transformTemplate={kinesisTransform}
        initial={{ ${initial.join(", ")} }}
        animate={{ ${animate.join(", ")} }}
        transition={{ ${transition.join(",\n          ")} }}
      >
        ${child}
      </motion.div>`;
  });
  return [
    `// ${tl.name} — exported by Kinesis Studio (motion / framer-motion v11+)`,
    `import { motion } from "motion/react";`,
    ``,
    ...(helpers.size ? [`// Springs and steps are baked into sampled easing functions so every runtime matches the preview.`, `const sampled = (t) => (p) => { const i = Math.min(t.length - 2, Math.floor(p * (t.length - 1))); const f = p * (t.length - 1) - i; return t[i] + (t[i + 1] - t[i]) * f; };`, ...[...helpers.entries()].map(([tab, id]) => `const ${id} = sampled(${tab});`), ``] : []),
    `const pivot = { position: "absolute", left: 0, top: 0, width: 0, height: 0 };`,
    `// Same order as the Kinesis preview, CSS and Lottie exports: translate → rotate → scale.`,
    `const u = (v, unit) => (typeof v === "number" ? v + unit : v ?? "0" + unit);`,
    `const kinesisTransform = (v) => \`translate(\${u(v.x, "px")}, \${u(v.y, "px")}) rotate(\${u(v.rotate, "deg")}) scale(\${v.scaleX ?? 1}, \${v.scaleY ?? 1})\`;`,
    `const center = { position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)" };`,
    ``,
    `export function ${pascal(tl.name)}() {`,
    `  return (`,
    `    <div style={{ position: "relative", width: ${tl.size.w}, height: ${tl.size.h}, background: "${tl.background}", overflow: "hidden" }}>`,
    layers.join("\n"),
    `    </div>`,
    `  );`,
    `}`,
  ].join("\n");
}
