import Link from "next/link";
import { HeroStage } from "@/components/HeroStage";
import { Reveal, SiteFooter, SiteNav } from "@/components/Site";

const words = ["Describe", "the", "motion."];
export default function Home() {
  return (
    <>
      <SiteNav />
      <Reveal />
      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">AI motion design studio</span>
            <h1>{words.map((w, i) => <span key={i} className="word" style={{ animationDelay: `${0.08 * i}s` }}>{w}&nbsp;</span>)}<br /><span className="word accent" style={{ animationDelay: "0.3s" }}>Ship the timeline.</span></h1>
            <p className="lede">Kinesis turns a sentence like “a card that lifts, overshoots and settles” into real keyframes, easing curves and layered tracks. Edit it like a motion designer would, then export Lottie, CSS, GSAP or Framer Motion.</p>
            <div className="hero-cta"><Link href="/studio" className="btn primary">Open the Studio →</Link><Link href="/about" className="btn">How it works</Link></div>
          </div>
          <HeroStage />
        </div>
        <div className="marquee" aria-hidden><div className="marquee-track">{[0, 1].map((k) => ["Keyframes", "Cubic-bezier", "Springs", "Overshoot", "Stagger", "Squash & stretch", "Lottie JSON", "CSS @keyframes", "GSAP", "Framer Motion", "Onion skin", "Motion paths"].map((s) => <span key={k + s}><i />{s}</span>))}</div></div>
      </section>

      <section className="section">
        <span className="eyebrow reveal">Not a gimmick, a timeline</span>
        <h2 className="reveal">Real motion data, in an editor that respects craft.</h2>
        <p className="sub reveal">Every result is a structured Kinesis timeline. Nothing is a video or a black box. You can drag keyframes, bend curves and scrub frames, and every export comes from the same source of truth.</p>
        <div className="feature-grid">
          {[
            ["Curve editor", "Drag bezier handles, dial in physical springs, or pick from 14 named eases. A puck previews the feel live.", "#ff5b2e"],
            ["Dopesheet", "Layered tracks with ease-coloured segments. Drag keys, snap with ⇧, double-click to add.", "#ffb547"],
            ["Stage", "Direct manipulation with auto-key, motion paths, onion skin and frame-accurate transport.", "#8ef0d0"],
            ["Motion review", "A lint pass flags linear moves, missing stagger, impossible speeds and invisible layers.", "#a99bff"],
            ["Four exports", "Lottie (Bodymovin 5.12), CSS with @property, GSAP with CustomEase, Framer Motion. Each one previews live.", "#ff6b8b"],
            ["Agentic generation", "A director, an animator and a critic run on open-weight models through Otari, with search and sandboxed validation.", "#f4efe6"],
          ].map(([h, p, c], i) => (
            <div className="feature reveal" key={h} style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="glyph"><svg width="22" height="22" viewBox="0 0 22 22"><path d={["M2 18 C 8 18, 9 4, 20 4", "M3 11h16M7 6v10M15 6v10", "M4 17 Q 11 2 18 12", "M4 11l5 5 9-10", "M3 6h16M3 11h10M3 16h13", "M11 2l2.5 6.5L20 11l-6.5 2.5L11 20l-2.5-6.5L2 11l6.5-2.5z"][i]} stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
              <h3>{h}</h3><p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <span className="eyebrow reveal">The pipeline</span>
        <h2 className="reveal">Three models, one sandbox, zero guesswork.</h2>
        <div className="pipeline reveal">
          {[
            ["01", "Guard", "Every prompt passes Otari guardrails before a model sees it.", ["guardrails"]],
            ["02", "Direct", "An open-weight director researches references with web search and our MCP motion toolkit, then writes a motion brief.", ["web search", "MCP", "open-weight"]],
            ["03", "Animate", "A second open-weight model keys the timeline and checks it in Otari's code-execution sandbox.", ["code execution", "routing"]],
            ["04", "Critique", "A critic scores the result, and you can refine it in place. Spend is tracked per user against a budget.", ["per-user budgets", "usage"]],
          ].map(([n, h, p, tags]) => (
            <div className="pipe-step" key={n as string}><span className="n">{n}</span><h4>{h}</h4><p>{p}</p><div className="tags">{(tags as string[]).map((t) => <span className="tag" key={t}>{t}</span>)}</div></div>
          ))}
        </div>
        <div className="export-strip reveal"><Link href="/studio" className="btn primary">Try it in the Studio</Link><Link href="/docs" className="btn">Read the docs</Link></div>
      </section>
      <SiteFooter />
    </>
  );
}
