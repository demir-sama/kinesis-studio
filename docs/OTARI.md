# Otari integration notes

| Otari feature | Where | How |
|---|---|---|
| Open-weight models, 2+ in distinct roles | `config.ts`, `pipeline.ts` | Director + Animator default `deepseek/deepseek-v4-pro`; Critic `deepseek/deepseek-v4.1-flash`; override with `KINESIS_MODEL_*` |
| Routing / fallbacks | `otari-dev/config.yml` | `kinesis-director` / `kinesis-animator` / `kinesis-critic` policies with `on_failure` fallbacks; the animator downgrades when `budget_used_pct >= 80`. The UI reads `Otari-Provider`, `Otari-Model`, `Otari-Fallback` and `Otari-Attempt-Count` |
| Web search | director | `otari_web_search` (max_uses 2); sources shown in the run log |
| Code execution | validator (+ animator opt-in) | direct `POST /code/execute` validation on every run; `otari_code_execution` tool for the animator with `KINESIS_ANIMATOR_TOOLS=on` (off by default, JSON mode is faster and more reliable) |
| MCP | director | `mcp_servers:[{name:"kinesis", url:<app>/api/mcp, allowed_tools:[get_easing, motion_principles]}]` |
| Guardrails | all calls | `KINESIS_GUARDRAILS="profile:mode,..."` → `guardrails:[...]` |
| Budgets / per-user budgets | `user.ts`, `/api/usage` | service key + `user` field + `Otari-End-User-Budget`; spend read back from `/end-users`. With a regular project key the gateway rejects `user`; the client then drops it automatically and keeps going |
| Usage tracking | UI | per-call tokens, latency and `usage.cost_usd`, plus a visitor budget meter |

Verified end to end on a **self-hosted** gateway (Otari + sandbox + SearXNG + Ollama running qwen2.5:1.5b / llama3.2:1b). Web search, code execution, routing policies and per-user budgets were exercised; MCP was attached but the 1.5B model didn't call it. 
**Hosted gateway (api.otari.ai), Nov 2026:** verified with a hosted key. Model choice was made by keying the same brief on several candidates:

| Animator model | Result |
|---|---|
| `z-ai/glm-5.3` (old default) | reasoning model; spent the whole 6–8k token budget thinking, returned no JSON (~$0.04 wasted per run) |
| `deepseek/deepseek-v4-pro` | valid KTL in ~10 s, 0 auto-repairs after the prompt update, sandbox validation passes, ~$0.007 per call |
| `moonshotai/kimi-k2.6`, `alibaba/qwen3.8-max` | timed out through the gateway |
| `xai/grok-4.7` | rejected with `response_format` |

A full generate run (director + animator + sandbox + critic) costs about $0.01 and takes ~25 s. Note: hosted responses currently return `usage.cost_usd = null`, so the in-app cost meter reads $0; estimate from `/models` pricing.
