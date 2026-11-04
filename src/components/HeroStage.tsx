"use client";
import { useEffect, useState } from "react";
import { PRESETS } from "@/lib/motion";
import { Stage } from "./studio/Stage";

export function HeroStage() {
  const [i, setI] = useState(3);
  const [t, setT] = useState(0);
  useEffect(() => {
    let r = 0; let start = performance.now(); let idx = 3; let loops = 0;
    const f = (n: number) => {
      const p = PRESETS[idx]; let e = n - start;
      if (e > p.duration) { loops++; start = n; e = 0; if (loops >= (p.duration < 1800 ? 3 : 2)) { loops = 0; idx = (idx + 1) % PRESETS.length; setI(idx); } }
      setT(e); r = requestAnimationFrame(f);
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setT(PRESETS[3].duration * 0.8); return; }
    r = requestAnimationFrame(f); return () => cancelAnimationFrame(r);
  }, []);
  const p = PRESETS[i];
  return (
    <div className="hero-stage">
      <div className="stage-head"><span>● {p.name}</span><span>{(t / 1000).toFixed(2)}s · {p.layers.length} layers · hand-keyed preset</span></div>
      <div style={{ position: "absolute", inset: "38px 0 70px" }}><Stage tl={p} time={t} selected={null} onion={false} paths={false} onSelect={() => {}} onDrag={() => {}} /></div>
      <div className="prompt-line">“{p.description}”</div>
    </div>
  );
}
