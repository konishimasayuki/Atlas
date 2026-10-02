// api/_lib/ai.js ── Claude API 共通呼び出し
// APIキーはスーパー管理者コンソールで設定（Redis: atlas:_super:settings:ai）。
// キー未設定・無効化・通信エラー時は null を返し、呼び出し側はデモ応答にフォールバックする。
import { redis } from "./redis.js";

const AI_KEY = "atlas:_super:settings:ai";
export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const MODEL_CHOICES = ["claude-sonnet-5-5", "claude-haiku-4-5-20251001", "claude-opus-5-5"];

export async function getAiSettings() {
  return (await redis.get(AI_KEY)) || { apiKey: "", model: DEFAULT_MODEL, enabled: true };
}
export async function saveAiSettings(s) {
  await redis.set(AI_KEY, s);
}
export function maskKey(key) {
  if (!key) return "";
  return key.slice(0, 7) + "…" + key.slice(-4);
}

// Claude を呼ぶ。成功時は { text }、失敗時は { error }、未設定時は null
export async function callClaude({ system, messages, maxTokens = 1024, settings }) {
  const s = settings || (await getAiSettings());
  if (!s.apiKey || s.enabled === false) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 50000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": s.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: s.model || DEFAULT_MODEL,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: String(m.content) })),
      }),
    });
    const j = await r.json();
    if (!r.ok) return { error: j?.error?.message || `HTTP ${r.status}` };
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return text ? { text } : { error: "empty_response" };
  } catch (e) {
    return { error: e.name === "AbortError" ? "timeout" : String(e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}
