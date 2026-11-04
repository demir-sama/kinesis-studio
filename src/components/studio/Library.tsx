"use client";
import { useEffect, useRef, useState } from "react";
import type { Shape, Timeline } from "@/lib/motion";
import { normalizeTimeline, PRESETS } from "@/lib/motion";
import { Stage } from "./Stage";

function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => { let r = 0; const s = performance.now(); const f = (n: number) => { setT(n - s); r = requestAnimationFrame(f); }; r = requestAnimationFrame(f); return () => cancelAnimationFrame(r); }, []);
  return t;
}

export function Library({ onLoad, onAddLayer, onImportError }: { onLoad: (tl: Timeline, label: string, kind: "preset" | "import" | "blank") => void; onAddLayer: (s: Shape) => void; onImportError: (m: string) => void }) {
  const clock = useClock();
  const file = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const importText = (text: string, label: string) => {
    try { const { timeline, repairs } = normalizeTimeline(JSON.parse(text)); onLoad(timeline, `${label}${repairs.length ? ` · ${repairs.length} repairs` : ""}`, "import"); setPaste(""); }
    catch (e) { onImportError(`Could not import: ${(e as Error).message}`); }
  };
  return (
    <div className="library">
      <div className="lib-sec">
        <h5>Hand-keyed presets</h5>
        <p className="hint">Authored by hand as starting points — not AI output.</p>
        <div className="preset-grid">
          {PRESETS.map((p) => (
            <button key={p.name} className="preset" onClick={() => onLoad(p, p.name, "preset")} title={p.description}>
              <div className="thumb"><Stage tl={p} time={clock % p.duration} selected={null} onion={false} paths={false} onSelect={() => {}} onDrag={() => {}} /></div>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="lib-sec">
        <h5>Add layer</h5>
        <div className="add-row">
          <button className="chip" onClick={() => onAddLayer({ kind: "rect", w: 120, h: 120, r: 18 })}>▢ Rect</button>
          <button className="chip" onClick={() => onAddLayer({ kind: "ellipse", w: 100, h: 100 })}>◯ Ellipse</button>
          <button className="chip" onClick={() => onAddLayer({ kind: "polygon", sides: 5, radius: 60, star: true, inner: 0.45 })}>✦ Star</button>
          <button className="chip" onClick={() => onAddLayer({ kind: "text", text: "Motion", size: 56, weight: 700 })}>T Text</button>
        </div>
      </div>
      <div className="lib-sec">
        <h5>Import</h5>
        <div className="add-row">
          <button className="chip" onClick={() => file.current?.click()}>Upload .kinesis.json</button>
          <button className="chip" onClick={() => onLoad(normalizeTimeline({ name: "Blank", duration: 2000, layers: [] }).timeline, "Blank", "blank")}>New blank</button>
        </div>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) importText(await f.text(), f.name); e.target.value = ""; }} />
        <textarea className="paste mono" placeholder="…or paste timeline JSON" value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} />
        {paste && <button className="btn sm" onClick={() => importText(paste, "Pasted JSON")}>Import pasted JSON</button>}
      </div>
    </div>
  );
}
