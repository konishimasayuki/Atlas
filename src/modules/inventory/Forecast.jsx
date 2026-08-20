import { useEffect, useMemo, useState } from "react";

const ACCENT = "#9A5A0B";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const RISK_CLASS = { "欠品危険": "low", "要注意": "prospect", "安定": "active" };
const TREND_ICON = { "増加": "▲", "減少": "▼", "横ばい": "→" };

export default function Forecast({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("すべて");
  const [picked, setPicked] = useState({}); // itemId -> qty（発注へ送る選択）

  async function load() {
    setLoading(true);
    const r = await fetch("/api/inventory/forecast", { credentials: "include" });
    const j = await r.json();
    setData(j.ok ? j.data : null);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    if (filter === "要発注") return data.rows.filter((r) => r.recommend > 0);
    if (filter === "欠品危険") return data.rows.filter((r) => r.risk === "欠品危険");
    return data.rows;
  }, [data, filter]);

  function toggle(r) {
    setPicked((p) => {
      const n = { ...p };
      if (n[r.id]) delete n[r.id];
      else n[r.id] = r.recommend || 1;
      return n;
    });
  }

  async function createOrder() {
    // 選択品を仕入先ごとにまとめて発注作成
    const chosen = (data?.rows || []).filter((r) => picked[r.id]);
    const bySupplier = {};
    for (const r of chosen) {
      const key = r.supplier || "（仕入先未設定）";
      (bySupplier[key] = bySupplier[key] || []).push({ itemId: r.id, code: r.code, name: r.name, qty: picked[r.id], cost: r.cost });
    }
    for (const [supplier, lines] of Object.entries(bySupplier)) {
      await fetch("/api/inventory/orders", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ supplier, lines, note: "AI需要予測から作成" }) });
    }
    alert(`${Object.keys(bySupplier).length}件の発注(準備)を作成しました。発注管理で確認できます。`);
    setPicked({});
  }

  const pickedCount = Object.keys(picked).length;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 在庫・供給管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>AI需要予測</h2>
        <span className="pill" style={{ marginLeft: "auto" }}>デモ予測</span>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : !data ? <p className="muted">データがありません。</p> : (
        <>
          <div className="pay-totals">
            <div className="pt-item net" style={{ background: "#fbeef0", borderColor: "#e0b4ba" }}><span className="pt-l">欠品危険</span><span className="pt-v" style={{ color: "#B23A48" }}>{data.summary.danger}</span></div>
            <div className="pt-item"><span className="pt-l">要注意</span><span className="pt-v">{data.summary.warn}</span></div>
            <div className="pt-item"><span className="pt-l">推奨発注 品目</span><span className="pt-v">{data.summary.recommendItems}</span></div>
            <div className="pt-item"><span className="pt-l">推奨発注 金額</span><span className="pt-v">{yen(data.summary.recommendValue)}</span></div>
          </div>
          <p className="muted" style={{ fontSize: 11.5, margin: "0 0 10px" }}>カテゴリの季節性・発注点・在庫回転から算出した概算予測です（将来クラウドAIで高度化）。</p>

          <div className="tabs">
            {["すべて", "要発注", "欠品危険"].map((t) => (
              <button key={t} className={"tab" + (filter === t ? " on" : "")} onClick={() => setFilter(t)}
                style={filter === t ? { background: ACCENT, borderColor: ACCENT } : undefined}>{t}</button>
            ))}
          </div>

          <div className="cust-list">
            {rows.map((r) => (
              <div key={r.id} className={"fc-row" + (picked[r.id] ? " picked" : "")} onClick={() => r.recommend > 0 && toggle(r)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cust-main">
                    <span className="cust-code">{r.code}</span>
                    <span className="cust-name">{r.name}</span>
                    <span className={"status st-" + RISK_CLASS[r.risk]}>{r.risk}</span>
                  </div>
                  <div className="cust-sub">
                    在庫 {r.stock}（発注点{r.reorderPoint}）　需要予測 {r.forecastDemand}/月 {TREND_ICON[r.trend]}{r.trend}　残 約{r.daysLeft}日
                  </div>
                </div>
                {r.recommend > 0 && (
                  <div className="fc-reco">
                    <span className="fc-reco-l">推奨</span>
                    <span className="fc-reco-v">{r.recommend}</span>
                    <span className={"fc-check" + (picked[r.id] ? " on" : "")}>{picked[r.id] ? "✓" : "＋"}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {pickedCount > 0 && (
        <div className="st-actions">
          <button className="btn-primary" style={{ background: ACCENT }} onClick={createOrder}>選択した {pickedCount} 品目を発注する</button>
        </div>
      )}
    </div>
  );
}
