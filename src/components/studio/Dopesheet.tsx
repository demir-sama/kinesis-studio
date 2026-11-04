"use client";
import { useRef, useState } from "react";
import type { Prop, Timeline } from "@/lib/motion";
import { easeLabel, PROPS, PROP_META } from "@/lib/motion";
import type { Selection } from "./store";

interface Props {
  tl: Timeline; time: number; sel: Selection;
  onScrub: (t: number) => void;
  onSelect: (s: Partial<Selection>) => void;
  onMoveKey: (layer: string, prop: Prop, index: number, t: number, phase: "move" | "end") => void;
  onAddKey: (layer: string, prop: Prop, t: number) => void;
}

const EASE_COLOR: Record<string, string> = { bezier: "var(--ember)", spring: "var(--mint)", linear: "var(--muted)", steps: "var(--violet)", hold: "var(--dim)" };

export function Dopesheet({ tl, time, sel, onScrub, onSelect, onMoveKey, onAddKey }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const frame = 1000 / tl.fps;
  const pct = (t: number) => `${(t / tl.duration) * 100}%`;
  const tAt = (clientX: number, snap = true) => {
    const r = area.current!.getBoundingClientRect();
    const t = ((clientX - r.left) / r.width) * tl.duration;
    return Math.max(0, Math.min(tl.duration, snap ? Math.round(t / frame) * frame : t));
  };
  const scrubStart = (e: React.PointerEvent) => {
    onScrub(tAt(e.clientX));
    const move = (ev: PointerEvent) => onScrub(tAt(ev.clientX));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const keyDrag = (e: React.PointerEvent, layer: string, prop: Prop, index: number) => {
    e.stopPropagation();
    onSelect({ layer, prop, key: index });
    const startX = e.clientX; let moved = false;
    const move = (ev: PointerEvent) => { if (Math.abs(ev.clientX - startX) > 2) moved = true; if (moved) onMoveKey(layer, prop, index, ev.shiftKey ? Math.round(tAt(ev.clientX, false) / 50) * 50 : tAt(ev.clientX), "move"); };
    const up = (ev: PointerEvent) => { if (moved) onMoveKey(layer, prop, index, tAt(ev.clientX), "end"); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const ticks: number[] = [];
  const stepMs = tl.duration <= 1500 ? 100 : tl.duration <= 4000 ? 250 : 500;
  for (let t = 0; t <= tl.duration + 0.1; t += stepMs) ticks.push(t);

  return (
    <div className="dopesheet">
      <div className="ds-head">
        <div className="ds-label mono">{Math.round(time)}ms · f{Math.round(time / frame)}</div>
        <div className="ds-ruler" onPointerDown={scrubStart}>
          <div className="ds-ruler-in" ref={area}>
            {ticks.map((t) => <span key={t} className="tick" style={{ left: pct(t) }}><b className="mono">{t >= 1000 ? `${+(t / 1000).toFixed(2)}s` : `${t}`}</b></span>)}
            <div className="playhead" style={{ left: pct(time) }}><i /></div>
          </div>
        </div>
      </div>
      <div className="ds-body">
        {[...tl.layers].reverse().map((l) => {
          const props = PROPS.filter((p) => l.tracks[p]?.length);
          const isSel = sel.layer === l.id;
          return (
            <div key={l.id} className={`ds-layer ${isSel ? "sel" : ""}`}>
              <div className="ds-row layer-row">
                <button className="ds-label" onClick={() => onSelect({ layer: l.id, prop: null, key: null })}>
                  <span className={`caret ${collapsed[l.id] ? "" : "open"}`} onClick={(e) => { e.stopPropagation(); setCollapsed((c) => ({ ...c, [l.id]: !c[l.id] })); }}>▸</span>
                  <span className="swatch" style={{ background: l.fill }} />
                  <span className="name">{l.name}</span>
                  <span className="count mono">{props.length}</span>
                </button>
                <div className="ds-lane" onPointerDown={scrubStart}>
                  <div className="ds-lane-in">
                    {[...new Set(props.flatMap((p) => l.tracks[p]!.map((k) => k.t)))].map((t) => <i key={t} className="summary-key" style={{ left: pct(t) }} />)}
                    <div className="playline" style={{ left: pct(time) }} />
                  </div>
                </div>
              </div>
              {!collapsed[l.id] && props.map((p) => {
                const tr = l.tracks[p]!;
                return (
                  <div key={p} className={`ds-row prop-row ${isSel && sel.prop === p ? "sel" : ""}`}>
                    <button className="ds-label sub" onClick={() => onSelect({ layer: l.id, prop: p, key: sel.layer === l.id && sel.prop === p ? sel.key : 0 })}>{PROP_META[p].label}</button>
                    <div className="ds-lane" onDoubleClick={(e) => onAddKey(l.id, p, tAt(e.clientX))} onPointerDown={scrubStart} title="Double-click to add a keyframe">
                      <div className="ds-lane-in">
                        {tr.slice(0, -1).map((k, i) => (
                          <span key={`s${i}`} className="seg" title={easeLabel(k.ease)} style={{ left: pct(k.t), width: `calc(${pct(tr[i + 1].t - k.t)})`, background: EASE_COLOR[k.ease?.type ?? "bezier"] }} />
                        ))}
                        {tr.map((k, i) => (
                          <button key={i} className={`key ${isSel && sel.prop === p && sel.key === i ? "on" : ""} ${k.ease?.type ?? "bezier"}`} style={{ left: pct(k.t) }}
                            title={`${k.t}ms → ${+k.v.toFixed(3)} · ${easeLabel(k.ease)}`} onPointerDown={(e) => keyDrag(e, l.id, p, i)} />
                        ))}
                        <div className="playline" style={{ left: pct(time) }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
