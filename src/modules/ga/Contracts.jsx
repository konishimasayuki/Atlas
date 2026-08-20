import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#2A6F8E";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const TYPES = ["業務委託","NDA","賃貸借","保守","代理店","請負","リース","顧問","ライセンス","その他"];
const STATUS_CLASS = { "下書き":"draft", "送信済":"prospect", "締結済":"active", "却下":"low", "期限切れ":"dormant" };
const EMPTY = { title:"", type:"業務委託", counterparty:"", counterpartyEmail:"", startDate:"", endDate:"", autoRenew:false, amount:0, note:"", body:"" };

export default function Contracts({ onBack }) {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("すべて");
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  async function fetchList() {
    const r = await fetch("/api/ga/contracts", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() {
    setLoading(true);
    let data = await fetchList();
    if (data.length === 0 && user.company === "TEST") {
      await fetch("/api/ga/contracts/seed", { method: "POST", credentials: "include" });
      data = await fetchList();
    }
    setList(data); setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { setList(await fetchList()); }

  const tabs = ["すべて", "下書き", "送信済", "締結済", "却下"];
  const filtered = useMemo(() => tab === "すべて" ? list : list.filter((c) => c.status === tab), [list, tab]);
  const counts = useMemo(() => ({
    signed: list.filter((c) => c.status === "締結済").length,
    pending: list.filter((c) => c.status === "送信済").length,
  }), [list]);

  if (creating) return <ContractEditor onBack={() => { setCreating(false); reload(); }} />;
  if (openId) return <ContractDetail id={openId} onBack={() => { setOpenId(null); reload(); }} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 総務管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>電子契約</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={() => setCreating(true)}>＋ 契約を作成</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : (
        <>
          <div className="stat-pills">
            <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>{list.length}件</span>
            <span className="pill active">締結済 {counts.signed}</span>
            <span className="pill prospect">先方確認待ち {counts.pending}</span>
          </div>
          <div className="tabs">
            {tabs.map((t) => (
              <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}
                style={tab === t ? { background: ACCENT, borderColor: ACCENT } : undefined}>{t}</button>
            ))}
          </div>
          <div className="cust-list">
            {filtered.map((c) => (
              <button key={c.id} className="cust-row" onClick={() => setOpenId(c.id)}>
                <div className="cust-main">
                  <span className="cust-code">{c.code}</span>
                  <span className="cust-name">{c.title}</span>
                  <span className={"status st-" + (STATUS_CLASS[c.status] || "prospect")}>{c.status}</span>
                </div>
                <div className="cust-sub">{c.type}／{c.counterparty || "—"}　{c.startDate || "—"}〜{c.endDate || "—"}{c.autoRenew ? "・自動更新" : ""}{c.amount ? `　${yen(c.amount)}` : ""}</div>
              </button>
            ))}
            {filtered.length === 0 && <p className="muted">該当する契約がありません。</p>}
          </div>
        </>
      )}
    </div>
  );
}

function ContractEditor({ onBack }) {
  const [f, setF] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }
  async function save() {
    setBusy(true);
    await fetch("/api/ga/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(f) });
    setBusy(false); onBack();
  }
  return (
    <div className="page ledger">
      <div className="ledger-top"><button className="back-btn" onClick={onBack}>← 一覧</button><h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>契約を作成</h2></div>
      <div className="form2">
        <label className="fld wide-col"><span>契約タイトル</span><input value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label className="fld"><span>種別</span><select value={f.type} onChange={(e) => set("type", e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="fld"><span>契約金額</span><input inputMode="numeric" value={f.amount} onChange={(e) => set("amount", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} /></label>
        <label className="fld"><span>相手先</span><input value={f.counterparty} onChange={(e) => set("counterparty", e.target.value)} /></label>
        <label className="fld"><span>相手先メール</span><input value={f.counterpartyEmail} onChange={(e) => set("counterpartyEmail", e.target.value)} inputMode="email" /></label>
        <label className="fld"><span>開始日</span><input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></label>
        <label className="fld"><span>終了日</span><input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></label>
        <label className="chk-row" style={{ gridColumn: "1 / -1" }}><input type="checkbox" checked={f.autoRenew} onChange={(e) => set("autoRenew", e.target.checked)} /><span>自動更新あり</span></label>
        <label className="fld wide-col"><span>契約本文</span><textarea rows={5} value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="契約条項を入力…" /></label>
      </div>
      <div className="st-actions">
        <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || !f.title} onClick={save}>{busy ? "保存中…" : "下書きを保存"}</button>
      </div>
    </div>
  );
}

function ContractDetail({ id, onBack }) {
  const [c, setC] = useState(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch(`/api/ga/contracts/${id}`, { credentials: "include" });
    const j = await r.json();
    if (j.ok) setC(j.data);
  }
  useEffect(() => { load(); }, []);
  if (!c) return <div className="page"><p className="muted">読み込み中…</p></div>;

  async function transition(status, ok) {
    if (ok && !confirm(ok)) return;
    setBusy(true);
    await fetch(`/api/ga/contracts/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status }) });
    setBusy(false); load();
  }
  async function remove() {
    if (!confirm("この契約を削除しますか？")) return;
    setBusy(true);
    await fetch(`/api/ga/contracts/${id}`, { method: "DELETE", credentials: "include" });
    setBusy(false); onBack();
  }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>{c.code}</h2>
        <span className={"status st-" + (STATUS_CLASS[c.status] || "prospect")} style={{ marginLeft: "auto" }}>{c.status}</span>
      </div>

      <div className="payslip">
        <h3 style={{ margin: "0 0 6px" }}>{c.title}</h3>
        <div className="cust-sub" style={{ marginBottom: 12 }}>{c.type}／{c.counterparty}{c.amount ? `　${yen(c.amount)}` : ""}</div>
        <div className="ps-row"><span>相手先</span><span>{c.counterparty || "—"}</span></div>
        <div className="ps-row"><span>相手先メール</span><span>{c.counterpartyEmail || "—"}</span></div>
        <div className="ps-row"><span>契約期間</span><span>{c.startDate || "—"} 〜 {c.endDate || "—"}</span></div>
        <div className="ps-row"><span>自動更新</span><span>{c.autoRenew ? "あり" : "なし"}</span></div>
        {c.body && <div style={{ marginTop: 12 }}><div className="pb-label">契約本文</div><div className="contract-body">{c.body}</div></div>}
      </div>

      {c.history?.length > 0 && (
        <div className="exp-history">
          <div className="pb-label">締結の履歴</div>
          {c.history.map((h, i) => <div key={i} className="hist-row">{new Date(h.at).toLocaleDateString("ja-JP")} — {h.by} が{h.action}</div>)}
        </div>
      )}

      <div className="st-actions">
        {["下書き", "却下"].includes(c.status) && <button className="btn-ghost danger" disabled={busy} onClick={remove}>削除</button>}
        <span style={{ flex: 1 }} />
        {c.status === "下書き" && <button className="btn-primary" style={{ background: ACCENT }} disabled={busy} onClick={() => transition("送信済", "相手先へ契約書を送信します。よろしいですか？")}>先方へ送信</button>}
        {c.status === "送信済" && <>
          <button className="btn-ghost danger" disabled={busy} onClick={() => transition("却下", "却下として差し戻します。よろしいですか？")}>却下</button>
          <button className="btn-primary" style={{ background: "#0B6E52" }} disabled={busy} onClick={() => transition("締結済", "締結済みにします。よろしいですか？")}>締結する</button>
        </>}
        {c.status === "却下" && <button className="btn-primary" style={{ background: ACCENT }} disabled={busy} onClick={() => transition("下書き")}>下書きに戻す</button>}
        {c.status === "締結済" && <button className="btn-ghost" disabled={busy} onClick={() => transition("期限切れ", "期限切れにします。よろしいですか？")}>期限切れにする</button>}
      </div>
    </div>
  );
}
