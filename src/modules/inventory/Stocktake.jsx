import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#9A5A0B";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();

export default function Stocktake({ onBack }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [starting, setStarting] = useState(false);

  async function load() {
    const r = await fetch("/api/inventory/stocktake", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() {
    setLoading(true);
    // 商品が空(TEST)なら先に商品を入れておく（棚卸は商品スナップショットが必要）
    if (user.company === "TEST") {
      const ir = await fetch("/api/inventory/items", { credentials: "include" });
      const ij = await ir.json();
      if (ij.ok && ij.data.length === 0) {
        await fetch("/api/inventory/items/seed", { method: "POST", credentials: "include" });
      }
    }
    setSessions(await load());
    setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { setSessions(await load()); }

  async function start() {
    setStarting(true);
    const r = await fetch("/api/inventory/stocktake", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({}) });
    const j = await r.json();
    setStarting(false);
    if (j.ok) { await reload(); setOpenId(j.data.id); }
  }

  if (openId) return <StocktakeSession id={openId} onBack={() => { setOpenId(null); reload(); }} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 在庫・供給管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>棚卸管理</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} disabled={starting} onClick={start}>{starting ? "作成中…" : "＋ 棚卸を開始"}</button>
      </div>
      <p className="mod-dash-sub">「棚卸を開始」すると、その時点の商品リストで棚卸表を作成します。各商品の実地数を入力し、確定すると差異が在庫へ反映されます。</p>

      {loading ? <p className="muted">読み込み中…</p> : sessions.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>棚卸の記録がありません。</b></p>
          <p className="muted">「＋ 棚卸を開始」から始めてください。</p>
        </div>
      ) : (
        <div className="cust-list">
          {sessions.map((s) => (
            <button key={s.id} className="cust-row" onClick={() => setOpenId(s.id)}>
              <div className="cust-main">
                <span className="cust-code">{s.code}</span>
                <span className="cust-name">{s.name}</span>
                <span className={"status " + (s.status === "確定" ? "st-active" : "st-prospect")}>{s.status}</span>
              </div>
              <div className="cust-sub">{s.date}　対象 {s.itemCount} 品目</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StocktakeSession({ id, onBack }) {
  const [ses, setSes] = useState(null);
  const [counts, setCounts] = useState({});   // itemId -> string(入力中)
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);

  async function load() {
    const r = await fetch(`/api/inventory/stocktake/${id}`, { credentials: "include" });
    const j = await r.json();
    if (j.ok) {
      setSes(j.data);
      const init = {};
      for (const l of j.data.lines) init[l.itemId] = l.counted === null ? "" : String(l.counted);
      setCounts(init);
    }
  }
  useEffect(() => { load(); }, []);

  const fixed = ses?.status === "確定";

  const rows = useMemo(() => {
    if (!ses) return [];
    const kw = q.trim().toLowerCase();
    return ses.lines.filter((l) => {
      const c = counts[l.itemId];
      const diff = c === "" || c === undefined ? null : Number(c) - l.theoretical;
      if (onlyDiff && (diff === null || diff === 0)) return false;
      if (!kw) return true;
      return [l.code, l.name, l.maker, l.location].join(" ").toLowerCase().includes(kw);
    });
  }, [ses, counts, q, onlyDiff]);

  const summary = useMemo(() => {
    if (!ses) return { counted: 0, diffItems: 0, diffQty: 0, diffValue: 0 };
    let counted = 0, diffItems = 0, diffQty = 0, diffValue = 0;
    for (const l of ses.lines) {
      const c = counts[l.itemId];
      if (c === "" || c === undefined) continue;
      counted++;
      const d = Number(c) - l.theoretical;
      if (d !== 0) { diffItems++; diffQty += d; diffValue += d * (l.cost || 0); }
    }
    return { counted, diffItems, diffQty, diffValue };
  }, [ses, counts]);

  async function saveProgress() {
    setSaving(true);
    const payload = {};
    for (const [k, v] of Object.entries(counts)) payload[k] = v === "" ? null : Number(v);
    const r = await fetch(`/api/inventory/stocktake/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ counts: payload }) });
    await r.json(); setSaving(false);
    load();
  }

  async function finalize() {
    if (!confirm("棚卸を確定します。実地数を在庫に反映し、以降このセッションは編集できません。よろしいですか？")) return;
    setSaving(true);
    const payload = {};
    for (const [k, v] of Object.entries(counts)) payload[k] = v === "" ? null : Number(v);
    const r = await fetch(`/api/inventory/stocktake/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ counts: payload, finalize: true }) });
    await r.json(); setSaving(false);
    load();
  }

  if (!ses) return <div className="page"><p className="muted">読み込み中…</p></div>;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 棚卸一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>{ses.code} {ses.name}</h2>
        <span className={"status " + (fixed ? "st-active" : "st-prospect")} style={{ marginLeft: "auto" }}>{ses.status}</span>
      </div>

      <div className="stat-pills">
        <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>入力 {summary.counted}/{ses.lines.length}</span>
        <span className="pill">差異 {summary.diffItems}品目</span>
        <span className={"pill " + (summary.diffValue < 0 ? "dormant" : summary.diffValue > 0 ? "active" : "")}>差異金額 {yen(summary.diffValue)}</span>
      </div>

      <div className="ledger-tools">
        <input className="search" placeholder="商品名・棚番で検索" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="tabs">
        <button className={"tab" + (!onlyDiff ? " on" : "")} onClick={() => setOnlyDiff(false)} style={!onlyDiff ? { background: ACCENT, borderColor: ACCENT } : undefined}>すべて</button>
        <button className={"tab" + (onlyDiff ? " on" : "")} onClick={() => setOnlyDiff(true)} style={onlyDiff ? { background: ACCENT, borderColor: ACCENT } : undefined}>差異のみ</button>
      </div>

      <div className="st-list">
        {rows.map((l) => {
          const c = counts[l.itemId];
          const has = c !== "" && c !== undefined;
          const diff = has ? Number(c) - l.theoretical : null;
          return (
            <div key={l.itemId} className="st-row">
              <div className="st-info">
                <div className="st-name"><span className="cust-code">{l.code}</span>{l.name}</div>
                <div className="cust-sub">棚 {l.location}　理論 {l.theoretical}{l.unit}</div>
              </div>
              <div className="st-count">
                <input className="st-input" inputMode="numeric" disabled={fixed}
                  placeholder="実地数" value={c ?? ""} onChange={(e) => setCounts((p) => ({ ...p, [l.itemId]: e.target.value.replace(/[^0-9]/g, "") }))} />
                {diff !== null && diff !== 0 && (
                  <span className={"st-diff " + (diff < 0 ? "minus" : "plus")}>{diff > 0 ? "+" : ""}{diff}</span>
                )}
                {diff === 0 && <span className="st-diff zero">±0</span>}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="muted">該当なし。</p>}
      </div>

      {!fixed && (
        <div className="st-actions">
          <button className="btn-ghost" disabled={saving} onClick={saveProgress}>{saving ? "保存中…" : "途中保存"}</button>
          <button className="btn-primary" style={{ background: ACCENT }} disabled={saving} onClick={finalize}>棚卸を確定（在庫に反映）</button>
        </div>
      )}
      {fixed && <p className="muted" style={{ marginTop: 14 }}>この棚卸は確定済みです。差異は在庫へ反映されました。</p>}
    </div>
  );
}
