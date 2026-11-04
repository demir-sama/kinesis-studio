"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Timeline } from "@/lib/motion";
import { exportCss, exportFramer, exportGsap, exportLottie } from "@/lib/motion";

type Tab = "css" | "gsap" | "framer" | "lottie" | "ktl";
const TABS: { id: Tab; label: string; file: (n: string) => string; note: string }[] = [
  { id: "css", label: "CSS", file: (n) => `${n}.html`, note: "Zero-dependency. Registered custom properties give each property its own keyframes and per-segment easing; springs become linear()." },
  { id: "gsap", label: "GSAP", file: (n) => `${n}.gsap.js`, note: "GSAP 3.13+ timeline. Béziers and baked springs ship as CustomEase curves." },
  { id: "framer", label: "Motion / Framer", file: (n) => `${n}.motion.jsx`, note: "React component for motion/react. Per-value keyframes with times and per-segment easing." },
  { id: "lottie", label: "Lottie", file: (n) => `${n}.lottie.json`, note: "Bodymovin 5.x JSON. Béziers map 1:1 onto Lottie tangents; springs and steps are baked per frame." },
  { id: "ktl", label: "Kinesis JSON", file: (n) => `${n}.kinesis.json`, note: "The source timeline. Re-import it into Kinesis Studio any time." },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "motion";

function cssDoc(tl: Timeline) {
  const { css, html } = exportCss(tl);
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#0b0b0f;overflow:hidden}.fit{transform-origin:center;}\n${css}</style></head><body><div class="fit">${html}</div><script>const f=document.querySelector('.fit');const s=()=>{const k=Math.min(innerWidth/${tl.size.w},innerHeight/${tl.size.h});f.style.transform='scale('+k+')'};s();addEventListener('resize',s)</script></body></html>`;
}

function gsapDoc(tl: Timeline) {
  const code = exportGsap(tl).replace(/^import .*$/gm, "").replace("export function", "function");
  const { html } = exportCss(tl);
  const markup = html.replace(/class="k-layer k-([^"]+)"/g, 'class="k-layer" id="k-$1"');
  const inner = tl.layers.map((l) => `#k-${l.id}>*{${(exportCss(tl).css.match(new RegExp(`\\.k-${l.id} > \\* \\{ ([^}]*) \\}`)) ?? [])[1] ?? ""}}`).join("\n");
  const fn = (code.match(/function (\w+)\(/) ?? [])[1];
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#0b0b0f;overflow:hidden}.kinesis-stage{position:relative;width:${tl.size.w}px;height:${tl.size.h}px;background:${tl.background};overflow:hidden}.k-layer{position:absolute;left:0;top:0;width:0;height:0}.k-layer>*{position:absolute;left:0;top:0;transform:translate(-50%,-50%)}${inner}</style>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script><script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/CustomEase.min.js"></script></head><body><div class="fit">${markup}</div>
<script>const f=document.querySelector('.fit');const s=()=>{const k=Math.min(innerWidth/${tl.size.w},innerHeight/${tl.size.h});f.style.transform='scale('+k+')'};s();addEventListener('resize',s);\n${code}\n${fn}();</script></body></html>`;
}

function LottiePreview({ data }: { data: Record<string, unknown> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let anim: { destroy: () => void } | null = null; let dead = false;
    import("lottie-web").then(({ default: lottie }) => {
      if (dead || !ref.current) return;
      try { anim = lottie.loadAnimation({ container: ref.current, renderer: "svg", loop: true, autoplay: true, animationData: structuredClone(data) }); }
      catch (e) { setErr(String(e)); }
    });
    return () => { dead = true; anim?.destroy(); };
  }, [data]);
  return <div className="preview-frame lottie" ref={ref}>{err && <p className="err">{err}</p>}</div>;
}

export function ExportPanel({ tl, onClose }: { tl: Timeline; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("css");
  const [copied, setCopied] = useState(false);
  const lottie = useMemo(() => exportLottie(tl), [tl]);
  const code = useMemo(() => {
    switch (tab) {
      case "css": { const { css, html } = exportCss(tl); return `<!-- ${tl.name} · Kinesis Studio -->\n<style>\n${css}\n</style>\n\n${html}\n`; }
      case "gsap": return exportGsap(tl);
      case "framer": return exportFramer(tl);
      case "lottie": return JSON.stringify(lottie.json, null, 2);
      case "ktl": return JSON.stringify(tl, null, 2);
    }
  }, [tab, tl, lottie]);
  const meta = TABS.find((t) => t.id === tab)!;
  const download = () => {
    const blob = new Blob([code], { type: tab === "lottie" || tab === "ktl" ? "application/json" : "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = meta.file(slug(tl.name)); a.click(); URL.revokeObjectURL(a.href);
  };
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="modal-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal export-modal" role="dialog" aria-label="Export">
        <header>
          <div><h3 className="display">Export “{tl.name}”</h3><p>{meta.note}</p></div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="tabs">{TABS.map((t) => <button key={t.id} className={`tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
        <div className="export-body">
          <div className="code-wrap">
            <div className="code-actions">
              <span className="mono">{meta.file(slug(tl.name))} · {(code.length / 1024).toFixed(1)} KB</span>
              <span><button className="btn sm" onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); }}>{copied ? "Copied" : "Copy"}</button> <button className="btn sm primary" onClick={download}>Download</button></span>
            </div>
            <pre className="code mono"><code>{code}</code></pre>
          </div>
          <div className="preview-col">
            <div className="preview-label mono">{tab === "css" ? "Live: exported CSS in an isolated iframe" : tab === "gsap" ? "Live: exported GSAP code running in an isolated iframe" : tab === "lottie" ? "Live: exported JSON in lottie-web" : "Preview"}</div>
            {tab === "css" && <iframe className="preview-frame" sandbox="allow-scripts" srcDoc={cssDoc(tl)} title="CSS preview" />}
            {tab === "gsap" && <iframe className="preview-frame" sandbox="allow-scripts" srcDoc={gsapDoc(tl)} title="GSAP preview" />}
            {tab === "lottie" && <><LottiePreview data={lottie.json} />{lottie.warnings.map((w, i) => <p key={i} className="warn-line">⚠ {w}</p>)}</>}
            {(tab === "framer" || tab === "ktl") && <div className="preview-frame note"><p>{tab === "framer" ? "Drop the component into any React app with `npm i motion`. It uses the same curves, times and transform order as the studio preview." : "Load this file back with Import, or feed it to the Kinesis agent to refine."}</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
