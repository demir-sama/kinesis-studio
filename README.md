# Kinesis Studio

**Describe a motion in plain words and get a production-ready animation timeline**, with real keyframes, real easing curves and layered tracks. It renders live in a professional editor and exports to **Lottie, CSS @keyframes, GSAP and Framer Motion**.

Built for *MozFest Developers Wilding* on the [Otari](https://otari.ai) gateway. Every model call, web search, sandboxed code run, MCP tool call and per-visitor budget goes through Otari.

## What it does
- **Studio editor**: a stage with onion-skinning and motion paths, a dopesheet, a cubic-bézier curve editor, an inspector with keyframe buttons, undo/redo and keyboard shortcuts. It autosaves locally.
- **Motion engine** (`src/lib/motion`): the KTL timeline format, spring and bézier easing solvers, a normalizer that repairs bad input, and a motion "lint" that checks craft rules such as duration bands, overshoot and stagger. It has four exporters.
- **AI agent via Otari** (`src/lib/ai`):
  1. A **Director** model researches references with `otari_web_search` and consults Kinesis's own **MCP server** (`/api/mcp`). It writes a motion brief.
  2. An **Animator** model keys the timeline and can check its maths with `otari_code_execution`.
  3. The server normalizes and lints the result, then validates it in **Otari's sandbox** (`/code/execute`) using a Python twin of the validator. If anything fails, it runs one repair pass.
  4. A **Critic** model scores the result and proposes a refine prompt, which you can apply with one click.
- **Transparency**: every step, tool call, source, model, provider, fallback, token count, latency and cost is shown in the run log. Each visitor's Otari budget appears as a meter.
- Six hand-keyed presets are always available. They're labelled as presets, never as AI output.

## Quick start
```bash
npm install
cp .env.example .env.local   # set OTARI_API_KEY (see docs/SETUP.md)
npm run dev                  # http://localhost:3000
npm test
```
Without a key, the editor, presets and exports all work. The Agent tab shows an "offline" state instead of faking output.

## Docs
- [docs/SETUP.md](docs/SETUP.md): hosted Otari, a self-hosted gateway, and Vercel
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/OTARI.md](docs/OTARI.md): which Otari features are used, and where
- [docs/OTARI_FEEDBACK.md](docs/OTARI_FEEDBACK.md): a candid builder log

MIT licensed.
