/** Server-only Otari configuration, read from the environment (never committed). */
export interface OtariConfig {
  baseUrl: string;
  apiKey: string | null;
  models: { director: string; animator: string; critic: string };
  perUser: boolean;
  endUserBudget: string | null;
  guardrails: { profile: string; mode: "block" | "monitor" }[];
  mcpUrl: string | null;
  research: boolean;
  codeExecution: boolean;
}

function parseGuardrails(raw: string | undefined): OtariConfig["guardrails"] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    const [profile, mode] = s.split(":");
    return { profile, mode: mode === "monitor" ? "monitor" : "block" };
  });
}

export function otariConfig(): OtariConfig {
  const e = process.env;
  const publicUrl = e.KINESIS_PUBLIC_URL || (e.VERCEL_PROJECT_PRODUCTION_URL ? `https://${e.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const mcpUrl = e.KINESIS_MCP_URL === "off" ? null : e.KINESIS_MCP_URL || (publicUrl ? `${publicUrl.replace(/\/$/, "")}/api/mcp` : null);
  return {
    baseUrl: (e.OTARI_BASE_URL || "https://api.otari.ai/api/v1").replace(/\/$/, ""),
    apiKey: e.OTARI_API_KEY?.trim() || null,
    models: {
      director: e.KINESIS_MODEL_DIRECTOR || "deepseek/deepseek-v4.1-flash",
      animator: e.KINESIS_MODEL_ANIMATOR || "z-ai/glm-5.3",
      critic: e.KINESIS_MODEL_CRITIC || "deepseek/deepseek-v4.1-flash",
    },
    perUser: e.OTARI_PER_USER === "1" || e.OTARI_PER_USER === "true",
    endUserBudget: e.OTARI_END_USER_BUDGET || null,
    guardrails: parseGuardrails(e.KINESIS_GUARDRAILS),
    mcpUrl,
    research: e.KINESIS_RESEARCH !== "off",
    codeExecution: e.KINESIS_CODE_EXECUTION !== "off",
  };
}
