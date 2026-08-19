import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#0B6E52";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const STATUS_CLASS = { "下書き": "draft", "申請中": "prospect", "承認済": "active", "差戻": "low", "精算済": "settled" };

export default function Expenses({ onBack }) {
  const { user } = useAuth();
  const isApprover = user.canManageUsers;
  const [list, setList] = useState([]);
  const [settings, setSettings] = useState({ fuelUnitPrice: 15, categories: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("すべて");
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  async function fetchList() {
    const r = await fetch("/api/accounting/expenses", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function fetchSettings() {
    const r = await fetch("/api/accounting/expenses/settings", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : { fuelUnitPrice: 15, categories: [] };
  }
  async function init() {
    setLoading(true);
    let data = await fetchList();
    if (data.length === 0 && user.company === "TEST") {
      await fetch("/api/accounting/expenses/seed", { method: "POST", credentials: "include" });
      data = await fetchList();
    }
    setList(data);
    setSettings(await fetchSettings());
    setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { setList(await fetchList()); }

  const tabs = isApprover
    ? ["すべて", "申請中", "承認済", "精算済", "差戻"]
    : ["すべて", "下書き", "申請中", "承認済", "差戻", "精算済"];
  const filtered = useMemo(() => tab === "すべて" ? list : list.filter((e) => e.status === tab), [list, tab]);

  const summary = useMemo(() => {
    const approved = list.filter((e) => e.status === "承認済");
    return {
      pending: list.filter((e) => e.status === "申請中").length,
      toPay: approved.reduce((s, e) => s + e.total, 0),
      toPayCount: approved.length,
    };
  }, [list]);

  if (openId) return <ExpenseDetail id={openId} isApprover={isApprover} onBack={() => { setOpenId(null); reload(); }} />;
  if (creating) return <ExpenseEditor settings={settings} onBack={() => { setCreating(false); reload(); }} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 会計管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>経費精算</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={() => setCreating(true)}>＋ 経費を申請</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : (
        <>
          <div className="stat-pills">
            {isApprover && <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>未承認 {summary.pending}</span>}
            {isApprover && <span className="pill active">要精算 {yen(summary.toPay)}（{summary.toPayCount}件）</span>}
            <span className="pill">ガソリン {settings.fuelUnitPrice}円/km</span>
          </div>

          <div className="tabs">
            {tabs.map((t) => (
              <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}
                style={tab === t ? { background: ACCENT, borderColor: ACCENT } : undefined}>{t}</button>
            ))}
          </div>

          <div className="cust-list">
            {filtered.map((e) => (
              <button key={e.id} className="cust-row" onClick={() => setOpenId(e.id)}>
                <div className="cust-main">
                  <span className="cust-code">{e.code}</span>
                  <span className="cust-name">{e.title}</span>
                  <span className={"status st-" + (STATUS_CLASS[e.status] || "prospect")}>{e.status}</span>
                </div>
                <div className="cust-sub">
                  {isApprover ? `申請: ${e.applicantName}　` : ""}明細 {e.lines.length}件　<b>{yen(e.total)}</b>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="muted">該当する申請がありません。</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ---- 明細エディタ（新規申請） ----
function ExpenseEditor({ settings, onBack }) {
  const blank = () => ({ date: new Date().toISOString().slice(0, 10), category: settings.categories[0] || "旅費交通費", payee: "", description: "", isFuel: false, distance: "", amount: "", receipt: "" });
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState([blank()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function setLine(i, patch) { setLines((p) => p.map((l, idx) => idx === i ? { ...l, ...patch } : l)); }
  function calcAmount(l) { return l.isFuel ? Math.round((Number(l.distance) || 0) * settings.fuelUnitPrice) : (Number(l.amount) || 0); }
  const total = lines.reduce((s, l) => s + calcAmount(l), 0);

  async function onReceipt(i, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLine(i, { receipt: reader.result });
    reader.readAsDataURL(file);
  }

  async function save(submit) {
    setErr(""); setBusy(true);
    const payload = { title, submit, lines: lines.map((l) => ({ ...l, distance: Number(l.distance) || 0, amount: Number(l.amount) || 0 })) };
    const r = await fetch("/api/accounting/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    const j = await r.json(); setBusy(false);
    if (!j.ok) { setErr("保存に失敗しました"); return; }
    onBack();
  }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>経費を申請</h2>
      </div>

      <label className="fld"><span>件名</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="7月分 経費申請 など" /></label>

      <div className="exp-lines">
        {lines.map((l, i) => (
          <div key={i} className="exp-line">
            <div className="exp-line-head">
              <span className="exp-line-no">明細 {i + 1}</span>
              <label className="fuel-toggle">
                <input type="checkbox" checked={l.isFuel} onChange={(e) => setLine(i, { isFuel: e.target.checked, category: e.target.checked ? "ガソリン代" : (settings.categories[0] || "旅費交通費") })} />
                <span>ガソリン（距離入力）</span>
              </label>
              {lines.length > 1 && <button className="line-del" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}>×</button>}
            </div>
            <div className="form2">
              <label className="fld"><span>日付</span><input type="date" value={l.date} onChange={(e) => setLine(i, { date: e.target.value })} /></label>
              <label className="fld"><span>科目</span>
                <select value={l.category} onChange={(e) => setLine(i, { category: e.target.value })}>
                  {settings.categories.map((c) => <option key={c}>{c}</option>)}
                </select></label>
              <label className="fld"><span>支払先</span><input value={l.payee} onChange={(e) => setLine(i, { payee: e.target.value })} /></label>
              <label className="fld"><span>摘要</span><input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></label>
              {l.isFuel ? (
                <label className="fld"><span>走行距離 (km)</span><input inputMode="numeric" value={l.distance} onChange={(e) => setLine(i, { distance: e.target.value.replace(/[^0-9.]/g, "") })} /></label>
              ) : (
                <label className="fld"><span>金額</span><input inputMode="numeric" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value.replace(/[^0-9]/g, "") })} /></label>
              )}
              <div className="fld"><span>{l.isFuel ? `自動計算（${settings.fuelUnitPrice}円/km）` : "レシート"}</span>
                {l.isFuel ? <div className="calc-amount">{yen(calcAmount(l))}</div>
                  : <div className="receipt-cell">
                      <label className="receipt-btn">{l.receipt ? "画像を変更" : "レシート添付"}<input type="file" accept="image/*" hidden onChange={(e) => onReceipt(i, e.target.files[0])} /></label>
                      {l.receipt && <img className="receipt-thumb" src={l.receipt} alt="レシート" />}
                    </div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-ghost" style={{ width: "auto", marginTop: 6 }} onClick={() => setLines((p) => [...p, blank()])}>＋ 明細を追加</button>

      <div className="exp-total">合計 <b>{yen(total)}</b></div>
      {err && <p className="login-err">{err}</p>}
      <div className="st-actions">
        <button className="btn-ghost" disabled={busy} onClick={() => save(false)}>下書き保存</button>
        <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || total === 0} onClick={() => save(true)}>申請する</button>
      </div>
    </div>
  );
}

// ---- 詳細（承認/差戻/精算・履歴） ----
function ExpenseDetail({ id, isApprover, onBack }) {
  const [e, setE] = useState(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null);

  async function load() {
    const r = await fetch(`/api/accounting/expenses/${id}`, { credentials: "include" });
    const j = await r.json();
    if (j.ok) setE(j.data);
  }
  useEffect(() => { load(); }, []);
  if (!e) return <div className="page"><p className="muted">読み込み中…</p></div>;

  async function act(action, comment) {
    setBusy(true);
    await fetch(`/api/accounting/expenses/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action, comment }) });
    setBusy(false);
    load();
  }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>{e.code} {e.title}</h2>
        <span className={"status st-" + (STATUS_CLASS[e.status] || "prospect")} style={{ marginLeft: "auto" }}>{e.status}</span>
      </div>
      <div className="cust-sub" style={{ marginBottom: 14 }}>申請者: {e.applicantName}　合計 <b>{yen(e.total)}</b>{e.approvedBy ? `　承認: ${e.approvedBy}` : ""}</div>

      <div className="exp-detail-list">
        {e.lines.map((l, i) => (
          <div key={i} className="exp-detail-row">
            <div className="edr-main">
              <span className="edr-cat">{l.category}</span>
              <span className="edr-desc">{l.description || l.payee || "—"}</span>
              {l.isFuel && <span className="edr-fuel">{l.distance}km</span>}
            </div>
            <div className="edr-right">
              <span className="edr-amount">{yen(l.amount)}</span>
              {l.receipt && <img className="receipt-thumb sm" src={l.receipt} alt="R" onClick={() => setZoom(l.receipt)} />}
            </div>
          </div>
        ))}
      </div>

      {e.history?.length > 0 && (
        <div className="exp-history">
          <div className="pb-label">履歴</div>
          {e.history.map((h, i) => (
            <div key={i} className="hist-row">{new Date(h.at).toLocaleDateString("ja-JP")} — {h.by} が{h.action}{h.comment ? `（${h.comment}）` : ""}</div>
          ))}
        </div>
      )}

      {isApprover && (
        <div className="st-actions">
          {e.status === "申請中" && <>
            <button className="btn-ghost danger" disabled={busy} onClick={() => act("reject", prompt("差戻の理由（任意）") || "")}>差戻</button>
            <button className="btn-primary" style={{ background: ACCENT }} disabled={busy} onClick={() => act("approve")}>承認</button>
          </>}
          {e.status === "承認済" && <button className="btn-primary" style={{ background: ACCENT }} disabled={busy} onClick={() => act("settle")}>精算済にする</button>}
        </div>
      )}

      {zoom && <div className="modal-back" onClick={() => setZoom(null)}><img className="receipt-zoom" src={zoom} alt="レシート" /></div>}
    </div>
  );
}
