import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#0B6E52";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const CATEGORIES_IN = ["売上入金", "売掛金回収", "現金売上入金", "受取利息", "雑収入"];
const CATEGORIES_OUT = ["仕入代金支払", "給与支払", "賞与支払", "家賃支払", "借入返済", "諸経費", "税金支払"];

export default function CashFlow({ onBack }) {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState("timeline");

  async function fetchAll() {
    const [rp, en] = await Promise.all([
      fetch("/api/accounting/cashflow/report", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/accounting/cashflow", { credentials: "include" }).then((r) => r.json()),
    ]);
    return { report: rp.ok ? rp.data : null, entries: en.ok ? en.data : [] };
  }
  async function init() {
    setLoading(true);
    let d = await fetchAll();
    if (user.company === "TEST" && d.entries.length === 0) {
      await fetch("/api/accounting/cashflow/seed", { method: "POST", credentials: "include" });
      d = await fetchAll();
    }
    setReport(d.report); setEntries(d.entries);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { const d = await fetchAll(); setReport(d.report); setEntries(d.entries); }

  if (creating) return <EntryEditor onBack={() => { setCreating(false); reload(); }} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 会計管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>資金繰り</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={() => setCreating(true)}>＋ 予定を登録</button>
      </div>

      {loading || !report ? <p className="muted">読み込み中…</p> : (
        <>
          <div className="pay-totals">
            <div className="pt-item"><span className="pt-l">現在の現金残高</span><span className="pt-v">{yen(report.startCash)}</span></div>
            <div className={"pt-item" + (report.warn ? "" : " net")} style={report.warn ? { background: "#fbeef0", borderColor: "#e0b4ba" } : undefined}>
              <span className="pt-l">今後の最低残高見込</span><span className="pt-v" style={{ color: report.warn ? "#B23A48" : "#0B6E52" }}>{yen(report.minBalance)}</span>
            </div>
          </div>
          {report.warn && <div className="jr-balance ng" style={{ marginBottom: 10 }}>資金が不足する見込みです。入金の前倒しや支払時期の調整を検討してください。</div>}

          <div className="pb-label">向こう3ヶ月の見込み</div>
          <div className="cf-months">
            {report.months.map((m) => (
              <div key={m.ym} className="cf-month-card">
                <div className="cf-month-ym">{m.ym}</div>
                <div className="cf-month-row in">入金 {yen(m.in)}</div>
                <div className="cf-month-row out">支払 {yen(m.out)}</div>
                <div className={"cf-month-net " + (m.net >= 0 ? "pos" : "neg")}>差引 {m.net >= 0 ? "+" : ""}{yen(m.net)}</div>
              </div>
            ))}
          </div>

          <div className="tabs" style={{ marginTop: 14 }}>
            <button className={"tab" + (tab === "timeline" ? " on" : "")} onClick={() => setTab("timeline")} style={tab === "timeline" ? { background: ACCENT, borderColor: ACCENT } : undefined}>資金推移</button>
            <button className={"tab" + (tab === "list" ? " on" : "")} onClick={() => setTab("list")} style={tab === "list" ? { background: ACCENT, borderColor: ACCENT } : undefined}>予定一覧</button>
          </div>

          {tab === "timeline" ? (
            report.timeline.length === 0 ? <p className="muted">今後の入出金予定はまだありません。</p> : (
              <div className="cust-list">
                {report.timeline.map((t) => (
                  <div key={t.id} className="cust-row" style={{ cursor: "default" }}>
                    <div className="cust-main">
                      <span className="cust-code">{t.date}</span>
                      <span className="cust-name">{t.category}</span>
                      <span className={"status " + (t.type === "in" ? "st-active" : "st-low")}>{t.type === "in" ? "入金" : "支払"}</span>
                    </div>
                    <div className="cust-sub">{t.partner}　{t.type === "in" ? "+" : "−"}{yen(t.amount)}　残高見込 <b>{yen(t.balanceAfter)}</b>{t.status === "予定" ? "（予定）" : ""}</div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <EntryList entries={entries} onChanged={reload} />
          )}
        </>
      )}
    </div>
  );
}

function EntryList({ entries, onChanged }) {
  async function del(id) {
    if (!confirm("この予定を削除しますか？")) return;
    await fetch(`/api/accounting/cashflow/${id}`, { method: "DELETE", credentials: "include" });
    onChanged();
  }
  if (entries.length === 0) return <p className="muted">登録がありません。</p>;
  return (
    <div className="cust-list">
      {entries.map((e) => (
        <div key={e.id} className="cust-row" style={{ cursor: "default" }}>
          <div className="cust-main">
            <span className="cust-code">{e.date}</span>
            <span className="cust-name">{e.category}</span>
            <span className={"status " + (e.type === "in" ? "st-active" : "st-low")}>{e.type === "in" ? "入金" : "支払"}</span>
            <span className="status st-draft">{e.status}</span>
            <button className="jr-del" style={{ marginLeft: "auto" }} onClick={() => del(e.id)}>×</button>
          </div>
          <div className="cust-sub">{e.partner}　{yen(e.amount)}</div>
        </div>
      ))}
    </div>
  );
}

function EntryEditor({ onBack }) {
  const [type, setType] = useState("in");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(CATEGORIES_IN[0]);
  const [partner, setPartner] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("予定");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function changeType(t) { setType(t); setCategory((t === "in" ? CATEGORIES_IN : CATEGORIES_OUT)[0]); }

  async function save() {
    setBusy(true);
    await fetch("/api/accounting/cashflow", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ type, date, category, partner, amount: Number(amount) || 0, status, note }) });
    setBusy(false); onBack();
  }

  return (
    <div className="page ledger">
      <div className="ledger-top"><button className="back-btn" onClick={onBack}>← 一覧</button><h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>入出金予定を登録</h2></div>
      <div className="tabs">
        <button className={"tab" + (type === "in" ? " on" : "")} onClick={() => changeType("in")} style={type === "in" ? { background: "#0B6E52", borderColor: "#0B6E52" } : undefined}>入金予定</button>
        <button className={"tab" + (type === "out" ? " on" : "")} onClick={() => changeType("out")} style={type === "out" ? { background: "#B23A48", borderColor: "#B23A48" } : undefined}>支払予定</button>
      </div>
      <div className="form2">
        <label className="fld"><span>予定日</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="fld"><span>科目</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{(type === "in" ? CATEGORIES_IN : CATEGORIES_OUT).map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="fld"><span>相手先</span><input value={partner} onChange={(e) => setPartner(e.target.value)} /></label>
        <label className="fld"><span>金額</span><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} /></label>
        <label className="fld"><span>確度</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="予定">予定</option><option value="確定">確定</option></select></label>
        <label className="fld wide-col"><span>メモ</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>
      <div className="st-actions">
        <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || !amount || !partner} onClick={save}>{busy ? "登録中…" : "登録する"}</button>
      </div>
    </div>
  );
}
