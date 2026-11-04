# Kinesis Studio

**Describe a motion in plain words and get a production-ready animation timeline**, with real keyframes, real easing curves and layered tracks. It renders live in a professional editor and exports to **Lottie, CSS @keyframes, GSAP and Framer Motion**.

Built for *MozFest Developers Wilding* on the [Otari](https://otari.ai) gateway. Every model call, web search, sandboxed code run, MCP tool call and per-visitor budget goes through Otari.

## What it does
- **Studio editor**: a stage with onion-skinning and motion paths, a dopesheet, a cubic-bézier curve editor, an inspector with keyframe buttons, undo/redo and keyboard shortcuts. It autosaves locally.
- **Motion engine** (`src/lib/motion`): the KTL timeline format, spring and bézier easing solvers, a normalizer that repairs bad input, and a motion "lint" that checks craft rules such as duration bands, overshoot and stagger. It has four exporters.
- **AI agent via Otari** (`src/lib/ai`):
  1. A **Director** (`deepseek/deepseek-v4-pro`) writes a motion brief. When the workspace allows it, it researches references with `otari_web_search` and consults Kinesis's own **MCP server** (`/api/mcp`); otherwise it falls back to a tool-free brief.
  2. An **Animator** (`deepseek/deepseek-v4-pro`, JSON mode) keys the timeline against a strict spec with a worked example and hand-keying rules.
  3. Deterministic craft passes: **humanize** (breaks up uniform staggers into a varied cascade) and **fit-to-frame** (keeps the resting layout inside a 40 px safe area). Then lint, and validation in **Otari's sandbox** (`/code/execute`) with a Python twin of the validator, plus one repair pass if needed.
  4. A **Critic** (`deepseek/deepseek-v4.1-flash`, a different model) scores the motion. Below 8/10, the animator runs up to two **polish passes** on the critic's notes, each re-validated and re-scored; a take is kept only if it scores at least as well.
- **Transparency**: every step, tool call, source, model, provider, fallback, token count, latency and cost is shown in the run log. Each visitor's Otari budget appears as a meter. When the gateway returns no `cost_usd`, cost is estimated from Otari's `/models` price list and labelled as an estimate.
- Six hand-keyed presets are always available. They're labelled as presets, never as AI output.

## Live
https://kinesis-studio-sama-5806.vercel.app (Studio at `/studio`).

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
