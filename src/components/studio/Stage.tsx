"use client";
import { useRef } from "react";
import type { Layer, Timeline } from "@/lib/motion";
import { layerStateAt, shapeBox, valueAt } from "@/lib/motion";
import { ShapeEl } from "./Shape";

interface Props {
  tl: Timeline; time: number; selected: string | null; onion: boolean; paths: boolean;
  onSelect: (id: string | null) => void;
  onDrag: (id: string, x: number, y: number, phase: "start" | "move" | "end") => void;
}

function tf(s: ReturnType<typeof layerStateAt>) { return `translate(${s.x} ${s.y}) rotate(${s.rotate}) scale(${s.scaleX} ${s.scaleY})`; }

export function Stage({ tl, time, selected, onion, paths, onSelect, onDrag }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const toSvg = (e: React.PointerEvent) => {
    const pt = svg.current!.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.current!.getScreenCTM()!.inverse()); return { x: p.x, y: p.y };
  };
  const frame = 1000 / tl.fps;
  const sel = tl.layers.find((l) => l.id === selected);
  const pathPts = (l: Layer) => { const pts: string[] = []; for (let t = 0; t <= tl.duration; t += frame * 2) pts.push(`${valueAt(l.tracks.x, t, l.base.x).toFixed(1)},${valueAt(l.tracks.y, t, l.base.y).toFixed(1)}`); return pts.join(" "); };
  const keyTimes = (l: Layer) => [...new Set([...(l.tracks.x ?? []), ...(l.tracks.y ?? [])].map((k) => k.t))];

  return (
    <svg ref={svg} className="stage-svg" viewBox={`0 0 ${tl.size.w} ${tl.size.h}`} preserveAspectRatio="xMidYMid meet"
      onPointerDown={(e) => { if (e.target === svg.current || (e.target as Element).classList.contains("stage-bg")) onSelect(null); }}
      onPointerMove={(e) => { if (!drag.current) return; const p = toSvg(e); onDrag(drag.current.id, Math.round(p.x - drag.current.dx), Math.round(p.y - drag.current.dy), "move"); }}
      onPointerUp={(e) => { if (drag.current) { const p = toSvg(e); onDrag(drag.current.id, Math.round(p.x - drag.current.dx), Math.round(p.y - drag.current.dy), "end"); drag.current = null; } }}>
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" strokeOpacity="0.035" /></pattern>
      </defs>
      <rect className="stage-bg" width={tl.size.w} height={tl.size.h} fill={tl.background} />
      <rect className="stage-bg" width={tl.size.w} height={tl.size.h} fill="url(#grid)" pointerEvents="none" />
      {paths && sel && (sel.tracks.x?.length || sel.tracks.y?.length) ? (
        <g pointerEvents="none">
          <polyline points={pathPts(sel)} fill="none" stroke="var(--ember)" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
          {keyTimes(sel).map((t) => { const x = valueAt(sel.tracks.x, t, sel.base.x), y = valueAt(sel.tracks.y, t, sel.base.y); return <rect key={t} x={x - 4} y={y - 4} width="8" height="8" transform={`rotate(45 ${x} ${y})`} fill="var(--ink)" stroke="var(--ember)" strokeWidth="1.5" />; })}
        </g>
      ) : null}
      {onion && tl.layers.map((l) => (
        <g key={`onion-${l.id}`} pointerEvents="none">
          {[-3, -2, -1, 1, 2, 3].map((o) => {
            const t = time + o * frame * 4;
            if (t < 0 || t > tl.duration) return null;
            const s = layerStateAt(l, t);
            return <g key={o} transform={tf(s)} opacity={(0.42 - Math.abs(o) * 0.11) * Math.max(0.15, s.opacity)}><ShapeEl layer={l} ghost={o < 0 ? "#ff5b2e" : "#8ef0d0"} /></g>;
          })}
        </g>
      ))}
      {tl.layers.map((l) => {
        const s = layerStateAt(l, time);
        const box = shapeBox(l.shape);
        return (
          <g key={l.id} transform={tf(s)} opacity={s.opacity} className="stage-layer"
            onPointerDown={(e) => { e.stopPropagation(); onSelect(l.id); const p = toSvg(e); drag.current = { id: l.id, dx: p.x - s.x, dy: p.y - s.y }; (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId); onDrag(l.id, Math.round(s.x), Math.round(s.y), "start"); }}>
            <ShapeEl layer={l} />
            {l.id === selected && <rect x={-box.w / 2 - 6} y={-box.h / 2 - 6} width={box.w + 12} height={box.h + 12} rx="6" fill="none" stroke="var(--ember)" strokeWidth="1.25" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          </g>
        );
      })}
    </svg>
  );
}
