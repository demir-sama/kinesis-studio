"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Prop, Shape, Timeline } from "@/lib/motion";
import { lintTimeline, normalizeTimeline, PRESETS } from "@/lib/motion";
import { LogoMark } from "../Logo";
import { Dopesheet } from "./Dopesheet";
import { ExportPanel } from "./ExportPanel";
import { Inspector } from "./Inspector";
import { Library } from "./Library";
import { Stage } from "./Stage";
import { currentValue, moveKey, setKey, usePlayback, useStudioStore, type SourceKind } from "./store";

export interface AgentContext {
  tl: Timeline;
  load: (tl: Timeline, source: { kind: SourceKind; label: string }) => void;
  toast: (m: string, kind?: "ok" | "err") => void;
}

export function Studio({ agent, statusPill }: { agent?: (ctx: AgentContext) => ReactNode; statusPill?: ReactNode }) {
  const store = useStudioStore(PRESETS[0]);
  const { tl, sel, update, select, load } = store;
  const pb = usePlayback(tl.duration, tl.loop !== false);
  const [onion, setOnion] = useState(false);
  const [paths, setPaths] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [left, setLeft] = useState<"agent" | "library">(agent ? "agent" : "library");
  const [toastMsg, setToast] = useState<{ m: string; kind: "ok" | "err"; id: number } | null>(null);
  const toast = useCallback((m: string, kind: "ok" | "err" = "ok") => setToast({ m, kind, id: Date.now() }), []);
  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toastMsg]);
  const report = useMemo(() => lintTimeline(tl), [tl]);
  const frame = 1000 / tl.fps;
  const dragStart = useRef<{ playing: boolean } | null>(null);

  // Restore / autosave
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return; restored.current = true;
    try { const s = localStorage.getItem("kinesis:last"); if (s) { const { timeline } = normalizeTimeline(JSON.parse(s)); if (timeline.layers.length) load(timeline, { kind: "edited", label: `${timeline.name} · restored` }); } } catch {}
  }, [load]);
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem("kinesis:last", JSON.stringify(tl)); } catch {} }, 400); return () => clearTimeout(t); }, [tl]);

  const addKeyAtPlayhead = useCallback((layerId: string, prop: Prop) => {
    update((t) => { const l = t.layers.find((x) => x.id === layerId); if (l) { const idx = setKey(l, prop, pb.time, currentValue(l, prop, pb.time), frame); setTimeout(() => select({ layer: layerId, prop, key: idx }), 0); } return t; });
  }, [update, pb.time, frame, select]);

  const addLayer = (shape: Shape) => update((t) => {
    const n = t.layers.length + 1; const id = `${shape.kind}-${Date.now().toString(36).slice(-4)}`;
    t.layers.push({ id, name: `${shape.kind[0].toUpperCase()}${shape.kind.slice(1)} ${n}`, shape, fill: ["#ff5b2e", "#ffb547", "#8ef0d0", "#a99bff", "#f4efe6"][n % 5], base: { x: t.size.w / 2, y: t.size.h / 2, scaleX: 1, scaleY: 1, rotate: 0, opacity: 1 }, tracks: {} });
    setTimeout(() => select({ layer: id, prop: null, key: null }), 0); return t;
  });
  const deleteSelected = useCallback(() => {
    if (sel.layer && sel.prop != null && sel.key != null) {
      update((t) => { const tr = t.layers.find((l) => l.id === sel.layer)?.tracks[sel.prop!]; if (tr) { tr.splice(sel.key!, 1); if (!tr.length) delete t.layers.find((l) => l.id === sel.layer)!.tracks[sel.prop!]; } return t; });
      select({ key: null });
    } else if (sel.layer) { update((t) => ({ ...t, layers: t.layers.filter((l) => l.id !== sel.layer) })); select({ layer: null, prop: null, key: null }); }
  }, [sel, update, select]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); store.redo(); return; }
      if (e.key === " ") { e.preventDefault(); pb.toggle(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); pb.setPlaying(false); pb.setTime(pb.time + frame * (e.shiftKey ? 10 : 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); pb.setPlaying(false); pb.setTime(pb.time - frame * (e.shiftKey ? 10 : 1)); }
      else if (e.key === "Home") pb.setTime(0);
      else if (e.key === "o") setOnion((v) => !v);
      else if (e.key === "p") setPaths((v) => !v);
      else if (e.key === "k" && sel.layer && sel.prop) addKeyAtPlayhead(sel.layer, sel.prop);
      else if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      else if (e.key === "e" && !mod) setExporting(true);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [pb, frame, sel, addKeyAtPlayhead, deleteSelected, store]);

  const onDrag = (id: string, x: number, y: number, phase: "start" | "move" | "end") => {
    if (phase === "start") { dragStart.current = { playing: pb.playing }; pb.setPlaying(false); return; }
    const c = `drag-${id}-${dragStart.current ? "a" : "b"}`;
    update((t) => { const l = t.layers.find((q) => q.id === id); if (!l) return t;
      if (l.tracks.x?.length || l.tracks.y?.length || pb.time > 0) { setKey(l, "x", pb.time, x, frame); setKey(l, "y", pb.time, y, frame); } else { l.base.x = x; l.base.y = y; }
      return t; }, c);
    if (phase === "end") dragStart.current = null;
  };

  return (
    <div className="studio">
      <header className="studio-top">
        <Link href="/" className="wordmark" style={{ fontSize: 16 }}><LogoMark size={28} /><span className="wm-text">Kinesis<em>Studio</em></span></Link>
        <div className="comp-title">
          <input className="title-input display" value={tl.name} onChange={(e) => update((t) => ({ ...t, name: e.target.value }), "title")} aria-label="Composition name" />
          <span className={`tag ${store.source.kind === "ai" ? "ember" : store.source.kind === "preset" ? "amber" : ""}`}>{store.source.kind === "ai" ? "AI · via Otari" : store.source.kind}</span>
          <span className="src-label">{store.source.label}</span>
        </div>
        <div className="top-actions">
          {statusPill}
          <button className="icon-btn" onClick={store.undo} disabled={!store.canUndo} title="Undo (⌘Z)">↶</button>
          <button className="icon-btn" onClick={store.redo} disabled={!store.canRedo} title="Redo (⇧⌘Z)">↷</button>
          <button className="btn primary sm" onClick={() => setExporting(true)}>Export</button>
        </div>
      </header>

      <aside className="studio-left">
        <div className="left-tabs">
          {agent && <button className={`tab ${left === "agent" ? "on" : ""}`} onClick={() => setLeft("agent")}>Agent</button>}
          <button className={`tab ${left === "library" ? "on" : ""}`} onClick={() => setLeft("library")}>Library</button>
        </div>
        <div className="left-body">
          {agent && <div hidden={left !== "agent"} className="left-pane">{agent({ tl, load, toast })}</div>}
          <div hidden={left !== "library"} className="left-pane"><Library onLoad={(t, label, kind) => { load(t, { kind, label }); pb.setTime(0); pb.setPlaying(true); }} onAddLayer={addLayer} onImportError={(m) => toast(m, "err")} /></div>
        </div>
      </aside>

      <main className="studio-stage">
        <div className="stage-wrap" style={{ aspectRatio: `${tl.size.w} / ${tl.size.h}` }}>
          <Stage tl={tl} time={pb.time} selected={sel.layer} onion={onion} paths={paths} onSelect={(id) => select({ layer: id, prop: null, key: null })} onDrag={onDrag} />
        </div>
        <div className="transport">
          <button className="icon-btn" onClick={() => pb.setTime(0)} title="To start (Home)">⏮</button>
          <button className="icon-btn" onClick={() => { pb.setPlaying(false); pb.setTime(pb.time - frame); }} title="Previous frame (←)">‹</button>
          <button className="play-btn" onClick={pb.toggle} aria-label={pb.playing ? "Pause" : "Play"}>{pb.playing ? <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg> : <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor" /></svg>}</button>
          <button className="icon-btn" onClick={() => { pb.setPlaying(false); pb.setTime(pb.time + frame); }} title="Next frame (→)">›</button>
          <span className="timecode mono">{(pb.time / 1000).toFixed(3)}s <i>/ {(tl.duration / 1000).toFixed(2)}s</i></span>
          <span className="sep" />
          <div className="speed">{[0.25, 0.5, 1, 2].map((s) => <button key={s} className={`chip ${pb.speed === s ? "on" : ""}`} onClick={() => pb.setSpeed(s)}>{s}×</button>)}</div>
          <span className="sep" />
          <button className={`icon-btn ${onion ? "on" : ""}`} onClick={() => setOnion((v) => !v)} title="Onion skin (O)">◐</button>
          <button className={`icon-btn ${paths ? "on" : ""}`} onClick={() => setPaths((v) => !v)} title="Motion path (P)">⤳</button>
          <span className="fps mono">{tl.size.w}×{tl.size.h} · {tl.fps}fps</span>
        </div>
      </main>

      <section className="studio-sheet">
        <Dopesheet tl={tl} time={pb.time} sel={sel}
          onScrub={(t) => { pb.setPlaying(false); pb.setTime(t); }}
          onSelect={(s) => select(s)}
          onMoveKey={(layer, prop, index, t, phase) => update((d) => { const tr = d.layers.find((l) => l.id === layer)?.tracks[prop]; if (tr) moveKey(tr, index, t, d.duration); return d; }, `move-${layer}-${prop}-${index}`)}
          onAddKey={(layer, prop, t) => update((d) => { const l = d.layers.find((x) => x.id === layer); if (l) { const i = setKey(l, prop, t, currentValue(l, prop, t), frame); setTimeout(() => select({ layer, prop, key: i }), 0); } return d; })} />
      </section>

      <Inspector tl={tl} sel={sel} time={pb.time} report={report} update={update} select={select} addKeyAtPlayhead={addKeyAtPlayhead} />

      {exporting && <ExportPanel tl={tl} onClose={() => setExporting(false)} />}
      {toastMsg && <div key={toastMsg.id} className={`toast ${toastMsg.kind}`}>{toastMsg.m}</div>}
    </div>
  );
}
