import { useEffect, useRef, useState } from "react";

const ACCENT = "#1657B0";
const SUGGESTIONS = ["今の商談まとめて", "休眠顧客どうアプローチする？", "お礼メールの文面を作って", "何ができる？"];

export default function AiChat({ onBack }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "営業支援AIです。商談パイプラインの要約、顧客へのアプローチ方針、営業メールの文面作成などをお手伝いします。下の例から選ぶか、自由に入力してください。" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, busy]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/sales/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ messages: next.filter((m) => m.role !== "system") }),
      });
      const j = await r.json();
      setMessages((prev) => [...prev, { role: "assistant", content: j.ok ? j.data.content : "エラーが発生しました。もう一度お試しください。", demo: j?.data?.demo }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "通信エラーが発生しました。" }]);
    }
    setBusy(false);
  }

  return (
    <div className="page ledger chat-page">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 営業管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>営業支援AI</h2>
        <span className="pill" style={{ marginLeft: "auto" }}>デモ応答</span>
      </div>

      <div className="chat-scroll" ref={scroller}>
        {messages.map((m, i) => (
          <div key={i} className={"chat-row " + m.role}>
            {m.role === "assistant" && <div className="chat-avatar" style={{ background: ACCENT }}>AI</div>}
            <div className={"chat-bubble " + m.role}>{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="chat-row assistant">
            <div className="chat-avatar" style={{ background: ACCENT }}>AI</div>
            <div className="chat-bubble assistant typing"><span></span><span></span><span></span></div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="chat-suggest">
          {SUGGESTIONS.map((s) => <button key={s} className="chip-btn" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}

      <div className="chat-input">
        <textarea
          rows={1}
          value={input}
          placeholder="営業について相談する…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="chat-send" style={{ background: ACCENT }} disabled={busy || !input.trim()} onClick={() => send()}>送信</button>
      </div>
      <p className="muted" style={{ fontSize: 11, textAlign: "center", margin: "6px 0 0" }}>デモ応答です。今後クラウドAI（Claude API）接続で本格的な回答になります。</p>
    </div>
  );
}
