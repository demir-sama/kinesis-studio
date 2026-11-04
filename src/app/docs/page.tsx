import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "@/components/Site";
export const metadata: Metadata = { title: "Docs" };

export default function Docs() {
  return (
    <>
      <SiteNav />
      <article className="prose-page">
        <span className="eyebrow">Documentation</span>
        <h1>Using Kinesis Studio</h1>
        <div className="toc">{["Studio", "Shortcuts", "Timeline format", "Exports", "AI generation", "Self-hosting"].map((s) => <a key={s} className="chip" href={`#${s.toLowerCase().replace(/\s/g, "-")}`}>{s}</a>)}</div>

        <h2 id="studio">The Studio</h2>
        <p><b>Left:</b> the Agent (describe or refine a motion) and the Library (hand-keyed presets, add layers, import JSON). <b>Centre:</b> the stage and transport. <b>Bottom:</b> the dopesheet. <b>Right:</b> the inspector, with composition and layer fields, properties, the curve editor and motion review.</p>
        <p>Drag a layer on the stage to move it. If the layer is already animated, or the playhead isn't at 0, this sets x/y keys at the playhead (auto-key). Select a keyframe to edit the curve of its <i>outgoing</i> segment.</p>

        <h2 id="shortcuts">Shortcuts</h2>
        <table><tbody>
          {[["Space", "Play / pause"], ["← / →", "Step one frame (⇧ for ten)"], ["Home", "Go to start"], ["K", "Key the selected property at the playhead"], ["Delete", "Delete the selected key, or the layer"], ["⌘Z / ⇧⌘Z", "Undo / redo"], ["O / P", "Onion skin / motion path"], ["E", "Export"], ["⇧ + drag key", "Snap to 50 ms"]].map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td>{v}</td></tr>)}
        </tbody></table>

        <h2 id="timeline-format">Timeline format (KTL v1)</h2>
        <pre><code>{`{
  "version": 1, "name": "Card Rise", "duration": 1200, "fps": 60,
  "size": { "w": 800, "h": 500 }, "background": "#0b0b0f", "loop": true,
  "layers": [{
    "id": "card", "name": "Card", "fill": "#ff5b2e",
    "shape": { "kind": "rect", "w": 220, "h": 140, "r": 18 },
    "base": { "x": 400, "y": 250, "scaleX": 1, "scaleY": 1, "rotate": 0, "opacity": 1 },
    "tracks": {
      "y": [ { "t": 0, "v": 330, "ease": { "type": "spring", "stiffness": 170, "damping": 14, "mass": 1 } },
             { "t": 700, "v": 250 } ],
      "opacity": [ { "t": 0, "v": 0, "ease": { "type": "bezier", "x1": 0.16, "y1": 1, "x2": 0.3, "y2": 1 } },
                   { "t": 300, "v": 1 } ]
    }
  }]
}`}</code></pre>
        <p>Times are in milliseconds. A keyframe's <code>ease</code> applies to the segment that <i>leaves</i> it. The available eases are <code>linear</code>, <code>bezier</code>, <code>spring</code> (settle-normalized), <code>steps</code> and <code>hold</code>. Properties are x, y, scaleX, scaleY, rotate (degrees) and opacity (0–1). Shapes are rect, ellipse, polygon/star and text. Loose input such as seconds, "ease-out" strings, a <code>scale</code> track or 0–100 opacity is repaired by the normalizer, and each repair is reported.</p>

        <h2 id="exports">Exports</h2>
        <table><thead><tr><th>Target</th><th>Notes</th></tr></thead><tbody>
          <tr><td>Lottie JSON</td><td>Bodymovin 5.12. Bezier eases map to native tangents; springs and steps are baked per frame. Text layers are skipped with a warning (Lottie text needs embedded fonts).</td></tr>
          <tr><td>CSS</td><td>One <code>@keyframes</code> per property via registered <code>@property</code> numbers. Springs become <code>linear()</code>. Includes a <code>prefers-reduced-motion</code> fallback.</td></tr>
          <tr><td>GSAP</td><td>A <code>gsap.timeline()</code> using CustomEase for exact curves and springs.</td></tr>
          <tr><td>Framer Motion</td><td>A <code>motion/react</code> component with keyframe arrays, <code>times</code> and per-segment eases.</td></tr>
        </tbody></table>

        <h2 id="ai-generation">AI generation</h2>
        <p>AI generation runs through the Otari gateway. See <a href="https://github.com/demir-sama/kinesis-studio/blob/main/docs/OTARI.md">docs/OTARI.md</a> for the full pipeline and <a href="https://github.com/demir-sama/kinesis-studio/blob/main/docs/SETUP.md">docs/SETUP.md</a> for keys, routing policies and budgets. Without <code>OTARI_API_KEY</code>, the Studio still works with presets and manual editing, and the Agent panel states clearly that it's offline.</p>

        <h2 id="self-hosting">Self-hosting</h2>
        <pre><code>{`git clone https://github.com/demir-sama/kinesis-studio && cd kinesis-studio
npm install
cp .env.example .env.local   # set OTARI_BASE_URL + OTARI_API_KEY
npm run dev`}</code></pre>
      </article>
      <SiteFooter />
    </>
  );
}
