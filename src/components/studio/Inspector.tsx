"use client";
import type { Layer, MotionReport, Prop, Timeline } from "@/lib/motion";
import { PROPS, PROP_META } from "@/lib/motion";
import { CurveEditor } from "./CurveEditor";
import type { Selection } from "./store";
import { currentValue } from "./store";

interface Props {
  tl: Timeline; sel: Selection; time: number; report: MotionReport;
  update: (fn: (tl: Timeline) => Timeline, coalesce?: string) => void;
  select: (s: Partial<Selection>) => void;
  addKeyAtPlayhead: (layer: string, prop: Prop) => void;
}

export function Inspector({ tl, sel, time, report, update, select, addKeyAtPlayhead }: Props) {
  const layer = tl.layers.find((l) => l.id === sel.layer);
  const edit = (fn: (l: Layer) => void, c?: string) => update((t) => { const l = t.layers.find((x) => x.id === sel.layer); if (l) fn(l); return t; }, c);
  return (
    <aside className="inspector">
      {!layer ? (
        <section className="insp-sec">
          <h4>Composition</h4>
          <div className="field-grid">
            <label><span>Name</span><input value={tl.name} onChange={(e) => update((t) => ({ ...t, name: e.target.value }), "comp-name")} /></label>
            <label><span>Duration</span><input className="mono" type="number" min={100} max={60000} step={50} value={tl.duration} onChange={(e) => update((t) => ({ ...t, duration: Math.max(100, +e.target.value || 100) }), "comp-dur")} /></label>
            <label><span>FPS</span><select value={tl.fps} onChange={(e) => update((t) => ({ ...t, fps: +e.target.value }))}>{[24, 30, 50, 60, 120].map((f) => <option key={f}>{f}</option>)}</select></label>
            <label><span>Background</span><input type="color" value={tl.background.slice(0, 7)} onChange={(e) => update((t) => ({ ...t, background: e.target.value }), "comp-bg")} /></label>
            <label><span>Width</span><input className="mono" type="number" value={tl.size.w} onChange={(e) => update((t) => ({ ...t, size: { ...t.size, w: Math.max(64, +e.target.value || 64) } }), "comp-w")} /></label>
            <label><span>Height</span><input className="mono" type="number" value={tl.size.h} onChange={(e) => update((t) => ({ ...t, size: { ...t.size, h: Math.max(64, +e.target.value || 64) } }), "comp-h")} /></label>
          </div>
          <label className="toggle"><input type="checkbox" checked={tl.loop !== false} onChange={(e) => update((t) => ({ ...t, loop: e.target.checked }))} /> Loop</label>
        </section>
      ) : (
        <>
          <section className="insp-sec">
            <h4>Layer <button className="link-btn" onClick={() => select({ layer: null, prop: null, key: null })}>composition ↗</button></h4>
            <div className="field-grid">
              <label className="span2"><span>Name</span><input value={layer.name} onChange={(e) => edit((l) => { l.name = e.target.value; }, `name-${layer.id}`)} /></label>
              <label><span>Fill</span><input type="color" value={layer.fill.slice(0, 7)} onChange={(e) => edit((l) => { l.fill = e.target.value; }, `fill-${layer.id}`)} /></label>
              <ShapeFields layer={layer} edit={edit} />
            </div>
          </section>
          <section className="insp-sec">
            <h4>Properties <span className="hint-inline">◆ adds a key at the playhead</span></h4>
            <div className="prop-list">
              {PROPS.map((p) => {
                const tr = layer.tracks[p];
                const v = currentValue(layer, p, time);
                return (
                  <div key={p} className={`prop-line ${sel.prop === p ? "on" : ""}`}>
                    <button className="prop-name" onClick={() => select({ prop: p, key: tr?.length ? Math.max(0, tr.findIndex((k, i) => k.t <= time && (tr[i + 1]?.t ?? Infinity) > time)) : null })}>{PROP_META[p].label}</button>
                    <input className="mono" type="number" step={p === "opacity" || p.startsWith("scale") ? 0.01 : 1} value={+v.toFixed(p === "opacity" || p.startsWith("scale") ? 3 : 1)}
                      onChange={(e) => edit((l) => { const val = +e.target.value; if (l.tracks[p]?.length) { const i = l.tracks[p]!.findIndex((k) => Math.abs(k.t - time) < 1000 / tl.fps / 2); if (i >= 0) l.tracks[p]![i].v = val; else addKeyLocal(l, p, time, val); } else l.base[p] = val; }, `val-${layer.id}-${p}`)} />
                    <button className={`key-btn ${tr?.some((k) => Math.abs(k.t - time) < 1000 / tl.fps / 2) ? "on" : ""}`} title="Add / update keyframe at playhead" onClick={() => addKeyAtPlayhead(layer.id, p)}>◆</button>
                  </div>
                );
              })}
            </div>
          </section>
          {sel.prop && layer.tracks[sel.prop]?.length ? (
            <section className="insp-sec">
              <h4>Curve · {PROP_META[sel.prop].label}</h4>
              <CurveEditor prop={sel.prop} track={layer.tracks[sel.prop]!} index={Math.min(sel.key ?? 0, layer.tracks[sel.prop]!.length - 1)} duration={tl.duration} time={time} base={layer.base[sel.prop]}
                onChange={(ease, c) => edit((l) => { const k = l.tracks[sel.prop!]![sel.key ?? 0]; if (k) k.ease = ease; }, c)}
                onKeyEdit={(patch) => edit((l) => { const tr = l.tracks[sel.prop!]!; const k = tr[sel.key ?? 0]; if (!k) return; Object.assign(k, patch); tr.sort((a, b) => a.t - b.t); }, `kf-${layer.id}-${sel.prop}-${sel.key}`)} />
            </section>
          ) : null}
        </>
      )}
      <section className="insp-sec">
        <h4>Motion review <span className={`tag ${report.ok ? "mint" : "rose"}`}>{report.ok ? "valid" : "errors"}</span></h4>
        <div className="stats mono">
          <span>{report.stats.layers} layers</span><span>{report.stats.keyframes} keys</span><span>{report.stats.frames} frames</span><span>peak {report.stats.peakSpeedPx}px/s</span><span>stagger {report.stats.staggerMs}ms</span>
        </div>
        {report.issues.length === 0 ? <p className="ok-line">No issues. Structure is valid and nothing trips the craft rules.</p> :
          <ul className="issues">{report.issues.slice(0, 8).map((i, n) => <li key={n} className={i.severity} onClick={() => i.layer && select({ layer: i.layer, prop: (i.prop as Prop) ?? null, key: 0 })}><b>{i.severity}</b>{i.message}</li>)}</ul>}
      </section>
    </aside>
  );
}

function addKeyLocal(l: Layer, p: Prop, t: number, v: number) {
  const tr = (l.tracks[p] ??= []);
  const prev = [...tr].reverse().find((k) => k.t < t);
  tr.push({ t: Math.round(t), v, ease: prev?.ease });
  tr.sort((a, b) => a.t - b.t);
}

function ShapeFields({ layer, edit }: { layer: Layer; edit: (fn: (l: Layer) => void, c?: string) => void }) {
  const s = layer.shape;
  const n = (label: string, key: string, val: number, min = 0) => (
    <label key={label}><span>{label}</span><input className="mono" type="number" value={val} onChange={(e) => { const v = Math.max(min, +e.target.value || 0); edit((l) => { (l.shape as unknown as Record<string, number>)[key] = key === "sides" ? Math.max(3, Math.round(v)) : v; }, `shape-${layer.id}-${key}`); }} /></label>
  );
  switch (s.kind) {
    case "rect": return <>{n("Width", "w", s.w, 1)}{n("Height", "h", s.h, 1)}{n("Radius", "r", s.r ?? 0)}</>;
    case "ellipse": return <>{n("Width", "w", s.w, 1)}{n("Height", "h", s.h, 1)}</>;
    case "polygon": return <>{n("Points", "sides", s.sides, 3)}{n("Radius", "radius", s.radius, 1)}</>;
    case "text": return <><label className="span2"><span>Text</span><input value={s.text} onChange={(e) => edit((l) => { (l.shape as typeof s).text = e.target.value; }, `text-${layer.id}`)} /></label>{n("Size", "size", s.size, 4)}</>;
  }
}
