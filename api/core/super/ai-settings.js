// api/core/super/ai-settings.js ── スーパー管理者専用：Claude APIキー設定
//  GET  → { hasKey, masked, model, enabled, models }（キー本体は返さない）
//  PUT  → { apiKey?, model?, enabled? } を保存（apiKey が空文字なら既存キーを維持）
//  POST → { action: "test" } 接続テスト / { action: "clear" } キー削除
import { getCurrentUser } from "../../_lib/core.js";
import { getAiSettings, saveAiSettings, maskKey, callClaude, MODEL_CHOICES } from "../../_lib/ai.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "super") return res.status(403).json({ ok: false, error: "forbidden" });

  const s = await getAiSettings();
  const view = (x) => ({ hasKey: !!x.apiKey, masked: maskKey(x.apiKey), model: x.model, enabled: x.enabled !== false, models: MODEL_CHOICES });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: view(s) });

  if (req.method === "PUT") {
    const b = req.body || {};
    const next = { ...s };
    if (typeof b.apiKey === "string" && b.apiKey.trim()) next.apiKey = b.apiKey.trim();
    if (b.model && MODEL_CHOICES.includes(b.model)) next.model = b.model;
    if (typeof b.enabled === "boolean") next.enabled = b.enabled;
    next.updatedAt = Date.now();
    await saveAiSettings(next);
    return res.status(200).json({ ok: true, data: view(next) });
  }

  if (req.method === "POST") {
    const { action } = req.body || {};
    if (action === "clear") {
      const next = { ...s, apiKey: "", updatedAt: Date.now() };
      await saveAiSettings(next);
      return res.status(200).json({ ok: true, data: view(next) });
    }
    if (action === "test") {
      const r = await callClaude({
        system: "あなたは接続テスト用のアシスタントです。",
        messages: [{ role: "user", content: "「接続OK」とだけ日本語で返してください。" }],
        maxTokens: 20,
        settings: { ...s, enabled: true },
      });
      if (!r) return res.status(200).json({ ok: false, error: "no_key" });
      if (r.error) return res.status(200).json({ ok: false, error: r.error });
      return res.status(200).json({ ok: true, data: { reply: r.text } });
    }
    return res.status(400).json({ ok: false, error: "bad_action" });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
