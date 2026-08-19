import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#9A5A0B";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const EMPTY = { name:"", maker:"", category:"", jan:"", supplier:"", location:"", unit:"台", cost:0, price:0, theoreticalStock:0, reorderPoint:0, status:"取扱中" };

export default function ItemMaster({ onBack }) {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("すべて");
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);

  async function fetchList() {
    const r = await fetch("/api/inventory/items", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() {
    setLoading(true);
    let data = await fetchList();
    if (data.length === 0 && user.company === "TEST") {
      await fetch("/api/inventory/items/seed", { method: "POST", credentials: "include" });
      data = await fetchList();
    }
    setList(data);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { setList(await fetchList()); }

  const cats = useMemo(() => ["すべて", ...Array.from(new Set(list.map((i) => i.category).filter(Boolean)))], [list]);
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return list.filter((i) => {
      if (cat !== "すべて" && i.category !== cat) return false;
      if (lowOnly && !(i.theoreticalStock <= i.reorderPoint)) return false;
      if (!kw) return true;
      return [i.code, i.name, i.maker, i.category, i.jan, i.supplier, i.location].join(" ").toLowerCase().includes(kw);
    });
  }, [list, q, cat, lowOnly]);

  const totalValue = useMemo(() => list.reduce((s, i) => s + (i.cost || 0) * (i.theoreticalStock || 0), 0), [list]);
  const lowCount = useMemo(() => list.filter((i) => i.theoreticalStock <= i.reorderPoint).length, [list]);

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); }
  function openEdit(i) { setEditing(i); setIsNew(false); }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 在庫・供給管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>商品マスタ</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={openNew}>＋ 商品を追加</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : list.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>商品がまだ登録されていません。</b></p>
          <button className="btn-primary sm" style={{ background: ACCENT, marginTop: 10 }}
            onClick={async () => { await fetch("/api/inventory/items/seed", { method: "POST", credentials: "include" }); reload(); }}>
            サンプル50点を投入
          </button>
        </div>
      ) : (
        <>
          <div className="stat-pills">
            <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>{list.length}点</span>
            <span className="pill">在庫金額 {yen(totalValue)}</span>
            <button className={"pill as-btn" + (lowOnly ? " on-warn" : "")} onClick={() => setLowOnly((v) => !v)}>発注点割れ {lowCount}</button>
          </div>

          <div className="ledger-tools">
            <input className="search" placeholder="商品名・メーカー・JAN・仕入先・棚番で検索" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="tabs">
            {cats.map((c) => (
              <button key={c} className={"tab" + (cat === c ? " on" : "")} onClick={() => setCat(c)}
                style={cat === c ? { background: ACCENT, borderColor: ACCENT } : undefined}>{c}</button>
            ))}
          </div>

          <div className="cust-list">
            {filtered.map((i) => {
              const low = i.theoreticalStock <= i.reorderPoint;
              return (
                <button key={i.id} className="cust-row" onClick={() => openEdit(i)}>
                  <div className="cust-main">
                    <span className="cust-code">{i.code}</span>
                    <span className="cust-name">{i.name}</span>
                    {i.status !== "取扱中" && <span className="status st-dormant">{i.status}</span>}
                    {low && <span className="status st-low">発注点割れ</span>}
                  </div>
                  <div className="cust-sub">
                    {i.category}／{i.maker}　在庫 <b className={low ? "stock-low" : ""}>{i.theoreticalStock}{i.unit}</b>（発注点{i.reorderPoint}）　売価 {yen(i.price)}　棚 {i.location}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="muted">該当する商品がありません。</p>}
          </div>
        </>
      )}

      {editing && <ItemForm initial={editing} isNew={isNew} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function ItemForm({ initial, isNew, onClose, onDone }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }
  function setN(k, v) { setF((p) => ({ ...p, [k]: v === "" ? "" : Number(v) })); }

  async function save() {
    setErr(""); setBusy(true);
    const url = isNew ? "/api/inventory/items" : `/api/inventory/items/${initial.id}`;
    const r = await fetch(url, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(f) });
    const j = await r.json(); setBusy(false);
    if (!j.ok) { setErr("保存に失敗しました"); return; }
    onDone();
  }
  async function remove() {
    if (!confirm(`${initial.name} を削除しますか？`)) return;
    setBusy(true);
    await fetch(`/api/inventory/items/${initial.id}`, { method: "DELETE", credentials: "include" });
    setBusy(false); onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? "商品を追加" : `${initial.code}　${initial.name}`}</h3>
        <div className="form2">
          <label className="fld wide-col"><span>商品名</span><input value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="fld"><span>メーカー</span><input value={f.maker} onChange={(e) => set("maker", e.target.value)} /></label>
          <label className="fld"><span>カテゴリ</span><input value={f.category} onChange={(e) => set("category", e.target.value)} /></label>
          <label className="fld"><span>JANコード</span><input value={f.jan} onChange={(e) => set("jan", e.target.value)} inputMode="numeric" /></label>
          <label className="fld"><span>仕入先</span><input value={f.supplier} onChange={(e) => set("supplier", e.target.value)} /></label>
          <label className="fld"><span>棚番（ロケーション）</span><input value={f.location} onChange={(e) => set("location", e.target.value)} /></label>
          <label className="fld"><span>単位</span><input value={f.unit} onChange={(e) => set("unit", e.target.value)} /></label>
          <label className="fld"><span>原価</span><input inputMode="numeric" value={f.cost} onChange={(e) => setN("cost", e.target.value)} /></label>
          <label className="fld"><span>売価</span><input inputMode="numeric" value={f.price} onChange={(e) => setN("price", e.target.value)} /></label>
          <label className="fld"><span>理論在庫</span><input inputMode="numeric" value={f.theoreticalStock} onChange={(e) => setN("theoreticalStock", e.target.value)} /></label>
          <label className="fld"><span>発注点</span><input inputMode="numeric" value={f.reorderPoint} onChange={(e) => setN("reorderPoint", e.target.value)} /></label>
          <label className="fld"><span>ステータス</span><select value={f.status} onChange={(e) => set("status", e.target.value)}><option>取扱中</option><option>取扱終了</option></select></label>
        </div>
        {err && <p className="login-err">{err}</p>}
        <div className="modal-actions">
          {!isNew && <button className="btn-ghost danger" onClick={remove} disabled={busy}>削除</button>}
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || !f.name} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
