# Otari feedback log (blunt)

**Friction**
1. The judging rubric only appears inside the SPA bundle, so it isn't readable as a page.
2. `/models` needs auth. You can't check catalog IDs before signing up, so we shipped defaults copied from the docs.
3. Streamed responses carry no guardrail result header or event, so guardrail outcomes are invisible when streaming.
4. Guardrail profile names and modes aren't listed anywhere obvious.
5. Per-user budgets need an **org-owner** service key. A solo hacker hits this late in the process.
6. The docs are dense. A single "agent with tools + budgets" end-to-end example would save hours.
7. Self-host: a `search_tools` SearXNG entry isn't used by the in-loop `otari_web_search`. Only `OTARI_WEB_SEARCH_URL` works, and that isn't documented.
8. The encoderfile guardrail image on Docker Hub is aarch64-only, so there are no guardrails on x86 self-host.
9. Unpriced local models give `cost_usd: null`, which leaves budgets toothless for local models. A per-token price override would help.
10. Config key secrets must match `tk-` followed by 47+ characters, and the error message doesn't say so.

**Tempted to skip Otari:** when we wanted to validate JSON. It was simpler to do locally, but the sandbox gave an independent check that's worth having.
**What we built that Otari could provide:** per-call metadata aggregation for a run, and a JSON-schema repair loop.
**Possible issues/PRs (not opened):** document `OTARI_WEB_SEARCH_URL`; publish a multi-arch guardrail image; emit a guardrail event in SSE; validate key formats with clear errors.
