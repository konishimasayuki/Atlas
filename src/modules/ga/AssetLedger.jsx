import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#2A6F8E";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const CATEGORIES = ["PC","モニター","スマホ","タブレット","複合機","デスク","椅子","車両","工具","その他"];
const STATUSES = ["使用中","保管中","修理中","廃棄"];
const STATUS_CLASS = { "使用中":"active", "保管中":"prospect", "修理中":"low", "廃棄":"draft" };
const EMPTY = { name:"", category:"PC", maker:"", model:"", serial:"", assetNo:"", purchaseDate:"", price:0, usefulLife:0, location:"", assignee:"", status:"使用中", note:"" };

// 定額法・残存0での現在簿価の目安（参考値）
function bookValue(a) {
  if (!a.purchaseDate || !a.price || !a.usefulLife) return null;
  const py = new Date(a.purchaseDate);
  if (Number.isNaN(py.getTime())) return null;
  const years = (Date.now() - py.getTime()) / (365.25 * 24 * 3600 * 1000);
  const dep = a.price / a.usefulLife;
  return Math.max(0, Math.round(a.price - dep * years));
}

export default function AssetLedger({ onBack }) {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("すべて");
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);

  async function fetchList() {
    const r = await fetch("/api/ga/assets", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() {
    setLoading(true);
    let data = await fetchList();
    if (data.length === 0 && user.company === "TEST") {
      await fetch("/api/ga/assets/seed", { method: "POST", credentials: "include" });
      data = await fetchList();
    }
    setList(data);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { setList(await fetchList()); }

  const cats = useMemo(() => ["すべて", ...Array.from(new Set(list.map((a) => a.category).filter(Boolean)))], [list]);
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return list.filter((a) => {
      if (cat !== "すべて" && a.category !== cat) return false;
      if (!kw) return true;
      return [a.assetNo, a.name, a.maker, a.model, a.serial, a.location, a.assignee].join(" ").toLowerCase().includes(kw);
    });
  }, [list, q, cat]);

  const totalCost = useMemo(() => list.reduce((s, a) => s + (a.price || 0), 0), [list]);
  const totalBook = useMemo(() => list.reduce((s, a) => s + (bookValue(a) || 0), 0), [list]);
  const inUse = useMemo(() => list.filter((a) => a.status === "使用中").length, [list]);

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); }
  function openEdit(a) { setEditing(a); setIsNew(false); }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 総務管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>資産・備品管理</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={openNew}>＋ 備品を登録</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : list.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>備品がまだ登録されていません。</b></p>
          <button className="btn-primary sm" style={{ background: ACCENT, marginTop: 10 }}
            onClick={async () => { await fetch("/api/ga/assets/seed", { method: "POST", credentials: "include" }); reload(); }}>
            サンプルを投入
          </button>
        </div>
      ) : (
        <>
          <div className="stat-pills">
            <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>{list.length}点</span>
            <span className="pill">使用中 {inUse}</span>
            <span className="pill">取得額 {yen(totalCost)}</span>
            <span className="pill">簿価目安 {yen(totalBook)}</span>
          </div>

          <div className="ledger-tools">
            <input className="search" placeholder="管理番号・品名・メーカー・型番・シリアル・使用者で検索" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="tabs">
            {cats.map((c) => (
              <button key={c} className={"tab" + (cat === c ? " on" : "")} onClick={() => setCat(c)}
                style={cat === c ? { background: ACCENT, borderColor: ACCENT } : undefined}>{c}</button>
            ))}
          </div>

          <div className="cust-list">
            {filtered.map((a) => {
              const bv = bookValue(a);
              return (
                <button key={a.id} className="cust-row" onClick={() => openEdit(a)}>
                  <div className="cust-main">
                    <span className="cust-code">{a.assetNo}</span>
                    <span className="cust-name">{a.name}</span>
                    <span className={"status st-" + (STATUS_CLASS[a.status] || "prospect")}>{a.status}</span>
                  </div>
                  <div className="cust-sub">
                    {a.category}／{a.maker} {a.model}　使用者 {a.assignee || "—"}／{a.location || "—"}　取得 {a.purchaseDate || "—"} {yen(a.price)}{bv !== null ? `（簿価目安 ${yen(bv)}）` : ""}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="muted">該当する備品がありません。</p>}
          </div>
        </>
      )}

      {editing && <AssetForm initial={editing} isNew={isNew} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function AssetForm({ initial, isNew, onClose, onDone }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }
  function setN(k, v) { setF((p) => ({ ...p, [k]: v === "" ? "" : Number(v) })); }
  const bv = bookValue(f);

  async function save() {
    setErr(""); setBusy(true);
    const url = isNew ? "/api/ga/assets" : `/api/ga/assets/${initial.id}`;
    const r = await fetch(url, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(f) });
    const j = await r.json(); setBusy(false);
    if (!j.ok) { setErr("保存に失敗しました"); return; }
    onDone();
  }
  async function remove() {
    if (!confirm(`${initial.name}（${initial.assetNo}）を削除しますか？`)) return;
    setBusy(true);
    await fetch(`/api/ga/assets/${initial.id}`, { method: "DELETE", credentials: "include" });
    setBusy(false); onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? "備品を登録" : `${initial.assetNo}　${initial.name}`}</h3>
        <div className="form2">
          <label className="fld"><span>品名</span><input value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="fld"><span>種別</span><select value={f.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="fld"><span>管理番号</span><input value={f.assetNo} onChange={(e) => set("assetNo", e.target.value)} placeholder={isNew ? "空欄で自動付番" : ""} /></label>
          <label className="fld"><span>ステータス</span><select value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="fld"><span>メーカー</span><input value={f.maker} onChange={(e) => set("maker", e.target.value)} /></label>
          <label className="fld"><span>型番</span><input value={f.model} onChange={(e) => set("model", e.target.value)} /></label>
          <label className="fld"><span>シリアル番号</span><input value={f.serial} onChange={(e) => set("serial", e.target.value)} /></label>
          <label className="fld"><span>購入日</span><input type="date" value={f.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></label>
          <label className="fld"><span>取得価額</span><input inputMode="numeric" value={f.price} onChange={(e) => setN("price", e.target.value)} /></label>
          <label className="fld"><span>耐用年数（年）</span><input inputMode="numeric" value={f.usefulLife} onChange={(e) => setN("usefulLife", e.target.value)} /></label>
          <label className="fld"><span>保管場所</span><input value={f.location} onChange={(e) => set("location", e.target.value)} /></label>
          <label className="fld"><span>使用者</span><input value={f.assignee} onChange={(e) => set("assignee", e.target.value)} /></label>
          <label className="fld wide-col"><span>備考</span><textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></label>
        </div>
        {bv !== null && (
          <div className="asset-bv">現在簿価の目安（定額法・残存0）：<b>{yen(bv)}</b><span className="muted"> ／ 取得 {yen(f.price)}・耐用 {f.usefulLife}年　※会計上の正確な償却額とは異なります</span></div>
        )}
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
