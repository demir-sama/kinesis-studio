# Otari integration notes

| Otari feature | Where | How |
|---|---|---|
| Open-weight models, 2+ in distinct roles | `config.ts`, `pipeline.ts` | Director/Critic default `deepseek/deepseek-v4.1-flash`; Animator `z-ai/glm-5.3`; override with `KINESIS_MODEL_*` |
| Routing / fallbacks | `otari-dev/config.yml` | `kinesis-director` / `kinesis-animator` / `kinesis-critic` policies with `on_failure` fallbacks; the animator downgrades when `budget_used_pct >= 80`. The UI reads `Otari-Provider`, `Otari-Model`, `Otari-Fallback` and `Otari-Attempt-Count` |
| Web search | director | `otari_web_search` (max_uses 2); sources shown in the run log |
| Code execution | animator + validator | `otari_code_execution` tool + direct `POST /code/execute` validation |
| MCP | director | `mcp_servers:[{name:"kinesis", url:<app>/api/mcp, allowed_tools:[get_easing, motion_principles]}]` |
| Guardrails | all calls | `KINESIS_GUARDRAILS="profile:mode,..."` → `guardrails:[...]` |
| Budgets / per-user budgets | `user.ts`, `/api/usage` | service key + `user` field + `Otari-End-User-Budget`; spend read back from `/end-users` |
| Usage tracking | UI | per-call tokens, latency and `usage.cost_usd`, plus a visitor budget meter |

Verified end to end on a **self-hosted** gateway (Otari + sandbox + SearXNG + Ollama running qwen2.5:1.5b / llama3.2:1b). Web search, code execution, routing policies and per-user budgets were exercised; MCP was attached but the 1.5B model didn't call it. The hosted model IDs above come from the Otari docs and haven't been verified, because no hosted key was available.
