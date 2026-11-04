"use client";
import { useEffect, useRef, useState } from "react";
import type { EaseSpec, Keyframe, Prop } from "@/lib/motion";
import { easeFn, easeLabel, NAMED_EASES, namedBezier, PROP_META, sampleEase, valueAt } from "@/lib/motion";

const W = 240, H = 300, PAD = 30;
const Y0 = -0.6, Y1 = 1.6;
const gx = (x: number) => PAD + x * (W - PAD * 2);
const gy = (y: number) => 10 + ((Y1 - y) / (Y1 - Y0)) * (H - 20);

function curvePath(e: EaseSpec | undefined, n = 80) {
  return sampleEase(e, n).map((v, i) => `${i ? "L" : "M"}${gx(i / n).toFixed(2)},${gy(v).toFixed(2)}`).join(" ");
}

export function MiniCurve({ ease, size = 34 }: { ease: EaseSpec; size?: number }) {
  const s = sampleEase(ease, 30);
  const d = s.map((v, i) => `${i ? "L" : "M"}${(3 + (i / 30) * (size - 6)).toFixed(1)},${(size - 8 - v * (size - 16)).toFixed(1)}`).join(" ");
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

/** Live preview: a puck runs the curve on a loop so the feel is visible, not just the shape. */
function EasePreview({ ease, ms }: { ease: EaseSpec | undefined; ms: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = easeFn(ease);
    const dur = Math.min(Math.max(ms, 300), 2200);
    let raf = 0; const start = performance.now();
    const tick = (now: number) => {
      const cyc = (now - start) % (dur + 500);
      const p = Math.min(1, cyc / dur);
      if (ref.current) ref.current.style.transform = `translateX(${f(p) * 100}%)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ease, ms]);
  return <div className="ease-preview"><div className="lane"><div ref={ref} className="puck-wrap"><i className="puck" /></div></div></div>;
}

interface Props { prop: Prop; track: Keyframe[]; index: number; onChange: (ease: EaseSpec, coalesce: string) => void; onKeyEdit: (patch: Partial<Keyframe>) => void; duration: number; time: number; base: number }

export function CurveEditor({ prop, track, index, onChange, onKeyEdit, duration, time, base }: Props) {
  const k = track[index];
  const next = track[index + 1];
  const ease = k?.ease;
  const svg = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<1 | 2 | null>(null);
  const bez = ease?.type === "bezier" ? ease : !ease ? { type: "bezier" as const, x1: 0.65, y1: 0, x2: 0.35, y2: 1 } : null;

  const toUnit = (e: React.PointerEvent | PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    return { x: Math.min(1, Math.max(0, (x - PAD) / (W - PAD * 2))), y: Math.min(Y1, Math.max(Y0, Y1 - ((y - 10) / (H - 20)) * (Y1 - Y0))) };
  };
  const startDrag = (h: 1 | 2) => (e: React.PointerEvent) => {
    e.preventDefault(); setDragging(h);
    const coalesce = `bez-${index}-${Date.now()}`;
    const move = (ev: PointerEvent) => {
      const u = toUnit(ev); const b = bez!;
      const r = (n: number) => Math.round(n * 1000) / 1000;
      onChange(h === 1 ? { type: "bezier", x1: r(u.x), y1: r(u.y), x2: b.x2, y2: b.y2 } : { type: "bezier", x1: b.x1, y1: b.y1, x2: r(u.x), y2: r(u.y) }, coalesce);
    };
    const up = () => { setDragging(null); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  if (!k) return <div className="panel-empty">Select a keyframe in the timeline to shape its curve.</div>;
  if (!next) return (
    <div className="curve-editor">
      <KeyFields k={k} prop={prop} onKeyEdit={onKeyEdit} duration={duration} />
      <div className="panel-empty">Last keyframe on this track — easing lives on the segment that leaves a keyframe. Select an earlier one.</div>
    </div>
  );
  const spring = ease?.type === "spring" ? ease : null;
  const type = ease?.type ?? "bezier";
  const setType = (t: EaseSpec["type"]) => {
    const map: Record<string, EaseSpec> = { bezier: namedBezier("ease-out-quint")!, spring: { type: "spring", stiffness: 220, damping: 16, mass: 1 }, linear: { type: "linear" }, steps: { type: "steps", count: 6 }, hold: { type: "hold" } };
    onChange(map[t], `type-${Date.now()}`);
  };
  // Value graph for the whole track.
  const vals: number[] = []; for (let i = 0; i <= 120; i++) vals.push(valueAt(track, (i / 120) * duration, base));
  const vmin = Math.min(...vals), vmax = Math.max(...vals), span = vmax - vmin || 1;
  const vg = vals.map((v, i) => `${i ? "L" : "M"}${((i / 120) * 300).toFixed(1)},${(66 - ((v - vmin) / span) * 56).toFixed(1)}`).join(" ");

  return (
    <div className="curve-editor">
      <KeyFields k={k} prop={prop} onKeyEdit={onKeyEdit} duration={duration} />
      <div className="seg-title mono">{k.t}ms → {next.t}ms · {next.t - k.t}ms</div>
      <div className="ease-types">
        {(["bezier", "spring", "linear", "steps", "hold"] as const).map((t) => <button key={t} className={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>{t}</button>)}
      </div>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className={`curve-svg ${dragging ? "dragging" : ""}`}>
        <rect x={PAD} y={gy(1)} width={W - PAD * 2} height={gy(0) - gy(1)} fill="#ffffff05" stroke="var(--line-2)" />
        {[0.25, 0.5, 0.75].map((g) => <g key={g}><line x1={gx(g)} x2={gx(g)} y1={gy(Y1)} y2={gy(Y0)} stroke="#ffffff08" /><line x1={gx(0)} x2={gx(1)} y1={gy(g)} y2={gy(g)} stroke="#ffffff08" /></g>)}
        <text x={gx(0) - 4} y={gy(0) + 14} className="axis">0</text><text x={gx(1) - 4} y={gy(0) + 14} className="axis">1</text><text x={8} y={gy(1) + 4} className="axis">v</text>
        <path d={curvePath(ease)} fill="none" stroke="var(--ember)" strokeWidth="2.5" strokeLinecap="round" />
        {bez && <>
          <line x1={gx(0)} y1={gy(0)} x2={gx(bez.x1)} y2={gy(bez.y1)} stroke="var(--bone-2)" strokeWidth="1" />
          <line x1={gx(1)} y1={gy(1)} x2={gx(bez.x2)} y2={gy(bez.y2)} stroke="var(--bone-2)" strokeWidth="1" />
          <circle cx={gx(bez.x1)} cy={gy(bez.y1)} r="7" className="handle" onPointerDown={startDrag(1)} />
          <circle cx={gx(bez.x2)} cy={gy(bez.y2)} r="7" className="handle" onPointerDown={startDrag(2)} />
        </>}
        <circle cx={gx(0)} cy={gy(0)} r="3.5" fill="var(--bone)" /><circle cx={gx(1)} cy={gy(1)} r="3.5" fill="var(--bone)" />
      </svg>
      <div className="ease-name mono">{easeLabel(ease)}</div>
      <EasePreview ease={ease} ms={next.t - k.t} />
      {spring && (
        <div className="spring-fields">
          {(["stiffness", "damping", "mass"] as const).map((f) => {
            const range = { stiffness: [20, 900, 1], damping: [1, 80, 0.5], mass: [0.2, 6, 0.1] }[f];
            return (
              <label key={f} className="slider">
                <span>{f}</span>
                <input type="range" min={range[0]} max={range[1]} step={range[2]} value={spring[f]} onChange={(e) => onChange({ ...spring, [f]: +e.target.value }, `spring-${f}-${index}`)} />
                <b className="mono">{spring[f]}</b>
              </label>
            );
          })}
          <p className="hint">The spring is time-normalised to this segment: it always comes to rest on the next keyframe, in every export.</p>
        </div>
      )}
      {ease?.type === "steps" && (
        <label className="slider"><span>steps</span><input type="range" min={1} max={24} value={ease.count} onChange={(e) => onChange({ type: "steps", count: +e.target.value }, `steps-${index}`)} /><b className="mono">{ease.count}</b></label>
      )}
      {(type === "bezier") && (
        <div className="ease-grid">
          {Object.entries(NAMED_EASES).map(([name, n]) => (
            <button key={name} className={`ease-cell ${ease?.type === "bezier" && ease.name === name ? "on" : ""}`} title={n.note} onClick={() => onChange(namedBezier(name)!, `preset-${Date.now()}`)}>
              <MiniCurve ease={namedBezier(name)!} /><span>{name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="value-graph">
        <div className="vg-head mono"><span>{PROP_META[prop].label} over time</span><span>{+vmin.toFixed(2)} → {+vmax.toFixed(2)}</span></div>
        <svg viewBox="0 0 300 72" preserveAspectRatio="none"><path d={vg} fill="none" stroke="var(--mint)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          <line x1={(time / duration) * 300} x2={(time / duration) * 300} y1="0" y2="72" stroke="var(--ember)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {track.map((kk, i) => <rect key={i} x={(kk.t / duration) * 300 - 3} y={66 - ((kk.v - vmin) / span) * 56 - 3} width="6" height="6" fill={i === index ? "var(--ember)" : "var(--bone)"} transform={`rotate(45 ${(kk.t / duration) * 300} ${66 - ((kk.v - vmin) / span) * 56})`} />)}
        </svg>
      </div>
    </div>
  );
}

function KeyFields({ k, prop, onKeyEdit, duration }: { k: Keyframe; prop: Prop; onKeyEdit: (p: Partial<Keyframe>) => void; duration: number }) {
  return (
    <div className="key-fields">
      <label><span>Time</span><input className="mono" type="number" min={0} max={duration} value={k.t} onChange={(e) => onKeyEdit({ t: +e.target.value })} /><em>ms</em></label>
      <label><span>Value</span><input className="mono" type="number" step={prop === "opacity" || prop.startsWith("scale") ? 0.01 : 1} value={+k.v.toFixed(4)} onChange={(e) => onKeyEdit({ v: +e.target.value })} /><em>{PROP_META[prop].unit}</em></label>
    </div>
  );
}
