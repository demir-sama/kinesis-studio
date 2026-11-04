# Setup

## Hosted Otari
1. Sign up at https://otari.ai and create a project.
2. Create an API key (`otk_…`). `OTARI_PER_USER=1` sends a per-visitor `user` id; with a plain project key the gateway rejects it and the app falls back to un-attributed calls. For real per-visitor budgets, the org owner must create a **service key** with an end-user budget (e.g. $0.05/day) and optionally a ceiling budget.
3. Check that the model IDs exist in your catalog (`GET /models`). Set `KINESIS_MODEL_DIRECTOR/ANIMATOR/CRITIC` if they differ.
4. Set these env vars (locally in `.env.local`, or in Vercel → Project → Settings → Environment Variables):
```
OTARI_BASE_URL=https://api.otari.ai/api/v1
OTARI_API_KEY=otk_...
OTARI_PER_USER=1
OTARI_END_USER_BUDGET=<budget id>       # optional
KINESIS_GUARDRAILS=<profile>:<mode>     # optional
KINESIS_PUBLIC_URL=https://<your-app>   # MCP callback URL = this + /api/mcp
KINESIS_MODEL_DIRECTOR / _ANIMATOR / _CRITIC  # optional; defaults deepseek/deepseek-v4-pro, deepseek/deepseek-v4-pro, deepseek/deepseek-v4.1-flash
KINESIS_ANIMATOR_TOOLS=on               # optional; give the animator the code-execution tool
```
5. Redeploy. `/api/status` should report `configured: true, reachable: true`.

## Self-hosted gateway (what we tested on)
```
cd otari-dev && ./up.sh        # Docker: otari, sandbox, searxng, ollama (host network)
```
`up.sh` writes `otari-dev/.env.local` (master key and service key; gitignored). Point `.env.local` at `http://127.0.0.1:8000/v1`, use the policy names `kinesis-director|animator|critic`, and set `KINESIS_MCP_URL=http://127.0.0.1:<port>/api/mcp`.

## Tests
`npm test` runs the engine tests; `npx tsc --noEmit` type-checks.
