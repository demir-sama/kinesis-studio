"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { EaseSpec, Keyframe, Layer, Prop, Timeline } from "@/lib/motion";
import { valueAt } from "@/lib/motion";

export type SourceKind = "preset" | "ai" | "import" | "edited" | "blank";
export interface Selection { layer: string | null; prop: Prop | null; key: number | null }
interface State { tl: Timeline; past: Timeline[]; future: Timeline[]; sel: Selection; source: { kind: SourceKind; label: string }; lastCoalesce: string | null }

type Action =
  | { type: "load"; tl: Timeline; source: { kind: SourceKind; label: string } }
  | { type: "update"; fn: (tl: Timeline) => Timeline; coalesce?: string }
  | { type: "undo" } | { type: "redo" }
  | { type: "select"; sel: Partial<Selection> };

const clone = (t: Timeline): Timeline => structuredClone(t);

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "load": return { tl: clone(a.tl), past: [...s.past, s.tl].slice(-80), future: [], sel: { layer: a.tl.layers[a.tl.layers.length - 1]?.id ?? null, prop: null, key: null }, source: a.source, lastCoalesce: null };
    case "update": {
      const next = a.fn(clone(s.tl));
      const coalesced = a.coalesce && a.coalesce === s.lastCoalesce;
      return { ...s, tl: next, past: coalesced ? s.past : [...s.past, s.tl].slice(-80), future: [], lastCoalesce: a.coalesce ?? null, source: s.source.kind === "edited" ? s.source : { kind: "edited", label: `${s.source.label} · edited` } };
    }
    case "undo": { if (!s.past.length) return s; const prev = s.past[s.past.length - 1]; return { ...s, tl: prev, past: s.past.slice(0, -1), future: [s.tl, ...s.future], lastCoalesce: null }; }
    case "redo": { if (!s.future.length) return s; const [n, ...rest] = s.future; return { ...s, tl: n, past: [...s.past, s.tl], future: rest, lastCoalesce: null }; }
    case "select": return { ...s, sel: { ...s.sel, ...a.sel } };
  }
}

export function useStudioStore(initial: Timeline) {
  const [state, dispatch] = useReducer(reducer, { tl: initial, past: [], future: [], sel: { layer: initial.layers[initial.layers.length - 1]?.id ?? null, prop: null, key: null }, source: { kind: "preset", label: initial.name }, lastCoalesce: null });
  const api = {
    load: useCallback((tl: Timeline, source: { kind: SourceKind; label: string }) => dispatch({ type: "load", tl, source }), []),
    update: useCallback((fn: (tl: Timeline) => Timeline, coalesce?: string) => dispatch({ type: "update", fn, coalesce }), []),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
    select: useCallback((sel: Partial<Selection>) => dispatch({ type: "select", sel }), []),
  };
  return { ...state, canUndo: state.past.length > 0, canRedo: state.future.length > 0, ...api };
}

/* ---------- Timeline mutations ---------- */
export function findLayer(tl: Timeline, id: string | null): Layer | undefined { return tl.layers.find((l) => l.id === id); }

/** Set (or insert) a keyframe at time t. Returns the keyframe index. */
export function setKey(layer: Layer, prop: Prop, t: number, v: number, frameMs: number): number {
  const tr = (layer.tracks[prop] ??= []);
  const hit = tr.findIndex((k) => Math.abs(k.t - t) < frameMs / 2);
  if (hit >= 0) { tr[hit].v = v; return hit; }
  const prev = [...tr].reverse().find((k) => k.t < t);
  const ease: EaseSpec | undefined = prev?.ease ?? { type: "bezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1, name: "ease-out-expo" };
  tr.push({ t: Math.round(t), v, ease });
  tr.sort((a, b) => a.t - b.t);
  if (tr.length === 1) layer.base[prop] = v;
  return tr.findIndex((k) => k.t === Math.round(t));
}

export function currentValue(layer: Layer, prop: Prop, t: number) { return valueAt(layer.tracks[prop], t, layer.base[prop]); }

export function moveKey(tr: Keyframe[], index: number, t: number, duration: number): number {
  const k = tr[index];
  const lo = index > 0 ? tr[index - 1].t + 1 : 0;
  const hi = index < tr.length - 1 ? tr[index + 1].t - 1 : duration;
  k.t = Math.round(Math.min(hi, Math.max(lo, t)));
  return index;
}

/* ---------- Playback ---------- */
export function usePlayback(duration: number, loop: boolean) {
  const [time, setTimeState] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const tRef = useRef(0);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const setTime = useCallback((t: number) => { tRef.current = Math.max(0, Math.min(duration, t)); setTimeState(tRef.current); }, [duration]);
  useEffect(() => { if (tRef.current > duration) setTime(0); }, [duration, setTime]);
  useEffect(() => {
    if (!playing) { last.current = null; return; }
    const step = (now: number) => {
      if (last.current != null) {
        let t = tRef.current + (now - last.current) * speed;
        if (t >= duration) { if (loop) t = t % duration; else { t = duration; setPlaying(false); } }
        tRef.current = t; setTimeState(t);
      }
      last.current = now;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = null; };
  }, [playing, speed, duration, loop]);
  return { time, setTime, playing, setPlaying, toggle: () => setPlaying((p) => { if (!p && tRef.current >= duration) setTime(0); return !p; }), speed, setSpeed };
}
