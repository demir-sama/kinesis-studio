/** Pull the first balanced JSON object out of model text (code fences, prose, think tags tolerated). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fence?.[1], cleaned].filter(Boolean) as string[];
  for (const c of candidates) {
    const start = c.indexOf("{");
    if (start < 0) continue;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < c.length; i++) {
      const ch = c[i];
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { const s = c.slice(start, i + 1); try { return JSON.parse(s); } catch { try { return JSON.parse(s.replace(/,\s*([}\]])/g, "$1")); } catch { break; } } } }
    }
  }
  throw new Error("The model did not return parseable JSON");
}
