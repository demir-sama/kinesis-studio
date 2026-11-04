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

**Hosted gateway findings (Nov 4, 2026)**
11. Hosted responses return `usage.cost_usd: null` for every model we used (DeepSeek, GLM), so per-call spend has to be estimated from `/models` pricing.
12. A regular project key rejects the `user` field (`'user' field does not match the authenticated API key's user`). Per-user budgets need a service key; we fall back to unattributed calls.
13. `otari_web_search` is disabled by default on a new workspace (403 "web search is not enabled for this workspace"); nothing in onboarding says so.
14. Reasoning models like `z-ai/glm-5.3` can burn the whole `max_tokens` budget thinking and return empty content, still billed. A hint in `/models` would help.

**Tempted to skip Otari:** when we wanted to validate JSON. It was simpler to do locally, but the sandbox gave an independent check that's worth having.
**What we built that Otari could provide:** per-call metadata aggregation for a run, and a JSON-schema repair loop.
**Possible issues/PRs (not opened):** document `OTARI_WEB_SEARCH_URL`; publish a multi-arch guardrail image; emit a guardrail event in SSE; validate key formats with clear errors.
