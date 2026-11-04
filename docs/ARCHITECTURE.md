# Architecture

```
browser ── Studio (React 19, client store, live renderer, exporters)
   │  POST /api/generate  (NDJSON stream of step/tool/usage/brief/timeline/critique/done)
   ▼
Next.js route ── runPipeline() ──► Otari gateway (OpenAI-compatible /chat/completions)
   │                 director  ─ otari_web_search · MCP(kinesis: get_easing, motion_principles) · guardrails
   │                 animator  ─ otari_code_execution
   │                 validate  ─ normalize + lint (TS) + POST /code/execute (Python twin)
   │                 repair    ─ response_format json_object (only if needed)
   │                 critic    ─ response_format json_object
   ├─ /api/mcp      Streamable-HTTP MCP server that Otari calls back into
   ├─ /api/status   config + GET /tools + GET /models
   ├─ /api/usage    GET /end-users?external_id=kinesis:<cookie uid> + /budgets/{id}
   └─ /api/validate lint + sandbox
```

## Motion engine (`src/lib/motion`)
- `types.ts`: the KTL format. A composition holds layers; each layer has a shape and per-property tracks of keyframes `{t, v, ease}`.
- `easing.ts`: cubic-bézier (Newton–Raphson solving), springs (analytic damped oscillator, with settle time), steps, and named curves.
- `evaluate.ts`: samples any property at time t, handling parenting and stagger.
- `normalize.ts`: makes untrusted JSON (from models or imports) safe. It clamps, sorts and dedupes keys and reports each repair.
- `lint.ts`: craft rules such as duration bands per size, peak velocity, overshoot, simultaneous starts, and loop seams.
- `export/*`: Lottie (bodymovin v5 with bézier tangents), CSS keyframes, GSAP timelines and Framer Motion variants.

## Why the sandbox step?
LLMs make arithmetic mistakes. The timeline is re-validated by independent Python code that runs inside Otari's code-execution sandbox. That gives a second, unprivileged check, and its stdout is shown to the user.

## Identity and budgets
Each visitor gets an anonymous `kinesis_uid` cookie. Each request sends `user: "kinesis:<uid>"` under a service key whose `end_user_budget_id` gives every visitor their own daily budget. A `ceiling` budget caps the whole app. The app also applies a small in-memory throttle.
