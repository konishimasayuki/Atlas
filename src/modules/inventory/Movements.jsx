import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#9A5A0B";
const REASONS = [
  { id: "sale", label: "販売で出庫", color: "#1657B0" },
  { id: "consume", label: "消費して出庫", color: "#0B6E52" },
  { id: "transfer", label: "現場/部門へ持出", color: "#6A34A0" },
  { id: "disposal", label: "廃棄", color: "#B23A48" },
  { id: "adjust_in", label: "入庫調整（その他）", color: "#9A5A0B" },
];
const REASON_MAP = Object.fromEntries(REASONS.map((r) => [r.id, r]));

export default function Movements({ onBack }) {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("すべて");
  const [creating, setCreating] = useState(false);

  async function fetchList() {
    const r = await fetch("/api/inventory/movements", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() {
    setLoading(true);
    let data = await fetchList();
    if (data.length === 0 && user.company === "TEST") {
      await fetch("/api/inventory/movements/seed", { method: "POST", credentials: "include" });
      data = await fetchList();
    }
    setList(data); setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { setList(await fetchList()); }

  const tabs = ["すべて", ...REASONS.map((r) => r.label)];
  const filtered = useMemo(() => tab === "すべて" ? list : list.filter((m) => m.reasonLabel === tab), [list, tab]);

  const summary = useMemo(() => {
    const s = {}; for (const r of REASONS) s[r.id] = 0;
    for (const m of list) s[m.reason] = (s[m.reason] || 0) + m.qty;
    return s;
  }, [list]);

  if (creating) return <MovementEditor onBack={() => { setCreating(false); reload(); }} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 在庫・供給管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>入出庫管理</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={() => setCreating(true)}>＋ 記録する</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : (
        <>
          <div className="stat-pills">
            {REASONS.map((r) => <span key={r.id} className="pill" style={{ borderColor: r.color, color: r.color }}>{r.label} {summary[r.id]}</span>)}
          </div>

          <div className="tabs">
            {tabs.map((t) => (
              <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}
                style={tab === t ? { background: ACCENT, borderColor: ACCENT } : undefined}>{t}</button>
            ))}
          </div>

          <div className="cust-list">
            {filtered.map((m) => {
              const r = REASON_MAP[m.reason];
              return (
                <div key={m.id} className="cust-row" style={{ cursor: "default" }}>
                  <div className="cust-main">
                    <span className="cust-code">{m.itemCode}</span>
                    <span className="cust-name">{m.itemName}</span>
                    <span className="phase-tag" style={{ background: r?.color }}>{m.direction === "out" ? "−" : "＋"}{m.qty}　{m.reasonLabel}</span>
                  </div>
                  <div className="cust-sub">
                    {new Date(m.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {m.destination ? `　行先: ${m.destination}` : ""}　{m.createdBy}
                    {m.note ? `　${m.note}` : ""}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <p className="muted">記録がありません。</p>}
          </div>
        </>
      )}
    </div>
  );
}

function MovementEditor({ onBack }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [itemId, setItemId] = useState("");
  const [reason, setReason] = useState("sale");
  const [qty, setQty] = useState("1");
  const [destination, setDestination] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/inventory/items", { credentials: "include" });
      const j = await r.json();
      setItems(j.ok ? j.data.filter((i) => i.status !== "取扱終了") : []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return items.filter((i) => !kw || [i.code, i.name].join(" ").toLowerCase().includes(kw));
  }, [items, q]);
  const selected = items.find((i) => i.id === itemId);
  const isOut = reason !== "adjust_in";

  async function save() {
    setErr("");
    if (!itemId) { setErr("商品を選択してください。"); return; }
    if (!qty || Number(qty) <= 0) { setErr("数量を入力してください。"); return; }
    setBusy(true);
    const r = await fetch("/api/inventory/movements", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ itemId, reason, qty: Number(qty), destination, note }) });
    const j = await r.json(); setBusy(false);
    if (!j.ok) { setErr(j.error === "insufficient_stock" ? `在庫が不足しています（現在庫 ${j.stock}）` : "登録に失敗しました。"); return; }
    onBack();
  }

  return (
    <div className="page ledger">
      <div className="ledger-top"><button className="back-btn" onClick={onBack}>← 一覧</button><h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>入出庫を記録</h2></div>

      <div className="fld"><span>理由</span>
        <div className="modgrid">
          {REASONS.map((r) => (
            <label key={r.id} className={"modchk" + (reason === r.id ? " on" : "")} style={{ "--mc": r.color }}>
              <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="fld"><span>商品を検索</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="品名・管理コードで検索" /></label>
      <div className="cust-list" style={{ maxHeight: 220, overflowY: "auto" }}>
        {filtered.slice(0, 30).map((i) => (
          <button key={i.id} className={"cust-row" + (itemId === i.id ? " on" : "")} style={itemId === i.id ? { borderColor: ACCENT, background: "#FBF4E9" } : undefined} onClick={() => setItemId(i.id)}>
            <div className="cust-main"><span className="cust-code">{i.code}</span><span className="cust-name">{i.name}</span></div>
            <div className="cust-sub">在庫 {i.theoreticalStock}</div>
          </button>
        ))}
      </div>

      <div className="form2" style={{ marginTop: 10 }}>
        <label className="fld"><span>数量</span><input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))} /></label>
        {reason === "transfer" && <label className="fld"><span>行先（現場/部門）</span><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="例：福岡支店 / 施工現場A" /></label>}
        <label className="fld wide-col"><span>メモ</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>

      {selected && (
        <p className="muted" style={{ fontSize: 12 }}>
          {selected.name}：現在庫 {selected.theoreticalStock} → 記録後 {isOut ? Math.max(0, selected.theoreticalStock - (Number(qty) || 0)) : selected.theoreticalStock + (Number(qty) || 0)}
        </p>
      )}
      {err && <p className="login-err">{err}</p>}
      <div className="st-actions">
        <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || !itemId} onClick={save}>{busy ? "登録中…" : "記録する"}</button>
      </div>
    </div>
  );
}
