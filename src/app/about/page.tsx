import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { SiteFooter, SiteNav } from "@/components/Site";
export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <>
      <SiteNav />
      <article className="prose-page">
        <LogoMark size={72} animated />
        <span className="eyebrow" style={{ display: "flex", marginTop: 24 }}>About</span>
        <h1>Motion is a language. Kinesis writes it down.</h1>
        <p>Most AI animation tools give you a video, or a block of code you can't really art-direct. Motion designers think in keyframes, curves, timing and spacing. Kinesis Studio works in those same terms. You describe a motion and get back a layered, editable timeline. You can refine it by hand or in words, and export it to the formats production teams already use.</p>
        <h2>What makes it different</h2>
        <ul>
          <li><b>One source of truth.</b> Everything is a small, documented JSON format (KTL) with per-segment easing. The editor, the linter and all four exporters read that same data.</li>
          <li><b>Craft-aware.</b> Spring physics are time-normalized so they land on the next keyframe. Overshoot, anticipation and stagger are first-class. A motion-review pass flags the mistakes a senior animator would catch.</li>
          <li><b>Honest AI.</b> Generated timelines are marked as AI and come with the run log: which models ran, which tools they called, what they cost. Presets are hand-keyed and labelled that way. Without a configured gateway the app says so instead of pretending.</li>
          <li><b>Open models first.</b> The director and animator run on open-weight models through <a href="https://otari.ai">Otari</a>, with routing and fallback, per-user budgets, guardrails, web search, MCP tools and sandboxed code execution.</li>
        </ul>
        <h2>The name</h2>
        <p><i>Kinesis</i> is Greek for movement. The mark is a K whose upper arm is an ease-out curve that ends in a keyframe diamond, which is the smallest unit of motion we know.</p>
        <h2>Built for</h2>
        <p>Built for MozFest Developers Wilding, the Otari hackathon. It's open source under the MIT license. <Link href="/docs">Read the docs</Link> or <a href="https://github.com/demir-sama/kinesis-studio">browse the source</a>.</p>
        <p style={{ marginTop: 36 }}><Link href="/studio" className="btn primary">Open the Studio →</Link></p>
      </article>
      <SiteFooter />
    </>
  );
}
