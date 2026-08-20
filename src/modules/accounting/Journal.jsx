import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#0B6E52";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const TYPE_LABEL = { asset: "資産", liability: "負債", equity: "純資産", revenue: "収益", expense: "費用" };

export default function Journal({ onBack }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("journal"); // journal | trial
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function fetchAll() {
    const [jr, ac, rp] = await Promise.all([
      fetch("/api/accounting/journal", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/accounting/accounts", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/accounting/journal/report", { credentials: "include" }).then((r) => r.json()),
    ]);
    return { journals: jr.ok ? jr.data : [], accounts: ac.ok ? ac.data : [], report: rp.ok ? rp.data : null };
  }
  async function init() {
    setLoading(true);
    let d = await fetchAll();
    // 勘定科目が無ければ初期化。デモは仕訳もseed
    if (d.accounts.length === 0) {
      await fetch("/api/accounting/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ seed: true }) });
    }
    if (d.journals.length === 0 && user.company === "TEST") {
      await fetch("/api/accounting/journal/seed", { method: "POST", credentials: "include" });
    }
    d = await fetchAll();
    setJournals(d.journals); setAccounts(d.accounts); setReport(d.report);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);

  if (creating) return <JournalEditor accounts={accounts} onBack={() => { setCreating(false); init(); }} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 会計管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>仕訳・試算表</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={() => setCreating(true)}>＋ 仕訳を入力</button>
      </div>

      <div className="tabs">
        <button className={"tab" + (tab === "journal" ? " on" : "")} onClick={() => setTab("journal")} style={tab === "journal" ? { background: ACCENT, borderColor: ACCENT } : undefined}>仕訳帳</button>
        <button className={"tab" + (tab === "trial" ? " on" : "")} onClick={() => setTab("trial")} style={tab === "trial" ? { background: ACCENT, borderColor: ACCENT } : undefined}>試算表</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : tab === "journal" ? (
        <JournalList journals={journals} onChanged={init} />
      ) : (
        <TrialBalance report={report} />
      )}
    </div>
  );
}

function JournalList({ journals, onChanged }) {
  async function del(id) {
    if (!confirm("この仕訳を削除しますか？")) return;
    await fetch(`/api/accounting/journal/${id}`, { method: "DELETE", credentials: "include" });
    onChanged();
  }
  if (journals.length === 0) return <p className="muted">仕訳がありません。「＋ 仕訳を入力」から登録してください。</p>;
  return (
    <div className="jr-list">
      {journals.map((j) => (
        <div key={j.id} className="jr-card">
          <div className="jr-head">
            <span className="jr-date">{j.date}</span>
            <span className="jr-desc">{j.description || "（摘要なし）"}</span>
            <button className="jr-del" onClick={() => del(j.id)}>×</button>
          </div>
          <div className="jr-lines">
            <div className="jr-col">
              {j.lines.filter((l) => l.side === "debit").map((l, i) => (
                <div key={i} className="jr-line"><span>{l.accountName}</span><span>{yen(l.amount)}</span></div>
              ))}
            </div>
            <div className="jr-arrow">／</div>
            <div className="jr-col credit">
              {j.lines.filter((l) => l.side === "credit").map((l, i) => (
                <div key={i} className="jr-line"><span>{l.accountName}</span><span>{yen(l.amount)}</span></div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrialBalance({ report }) {
  if (!report || report.trial.rows.length === 0) return <p className="muted">仕訳がありません。</p>;
  const { rows, totalDebit, totalCredit, balanced } = report.trial;
  return (
    <div className="trial">
      <table className="acc-table">
        <thead><tr><th>科目</th><th className="num">借方</th><th className="num">貸方</th><th className="num">残高</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td><span className="acc-name">{r.name}</span><span className="acc-type">{TYPE_LABEL[r.type]}</span></td>
              <td className="num">{r.debit ? yen(r.debit) : "—"}</td>
              <td className="num">{r.credit ? yen(r.credit) : "—"}</td>
              <td className="num strong">{yen(r.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td>合計</td><td className="num">{yen(totalDebit)}</td><td className="num">{yen(totalCredit)}</td><td className="num">{balanced ? "✓ 一致" : "不一致"}</td></tr></tfoot>
      </table>
    </div>
  );
}

function JournalEditor({ accounts, onBack }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState([{ side: "debit", accountCode: "", amount: "" }, { side: "credit", accountCode: "", amount: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function setLine(i, patch) { setLines((p) => p.map((l, idx) => idx === i ? { ...l, ...patch } : l)); }
  const debit = lines.filter((l) => l.side === "debit").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const credit = lines.filter((l) => l.side === "credit").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const balanced = debit === credit && debit > 0;

  async function save() {
    setErr("");
    if (!balanced) { setErr("借方と貸方の合計が一致していません。"); return; }
    setBusy(true);
    const payload = {
      date, description,
      lines: lines.filter((l) => l.accountCode && Number(l.amount) > 0).map((l) => {
        const a = accounts.find((x) => x.code === l.accountCode);
        return { side: l.side, accountCode: l.accountCode, accountName: a?.name || "", amount: Number(l.amount) };
      }),
    };
    const r = await fetch("/api/accounting/journal", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    const j = await r.json(); setBusy(false);
    if (!j.ok) { setErr(j.error === "unbalanced" ? "貸借が一致していません。" : "登録に失敗しました。"); return; }
    onBack();
  }

  const grouped = useMemo(() => {
    const g = {}; for (const a of accounts) (g[a.type] = g[a.type] || []).push(a); return g;
  }, [accounts]);

  return (
    <div className="page ledger">
      <div className="ledger-top"><button className="back-btn" onClick={onBack}>← 一覧</button><h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>仕訳を入力</h2></div>
      <div className="form2">
        <label className="fld"><span>日付</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="fld wide-col"><span>摘要</span><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例：商品仕入（掛）" /></label>
      </div>

      <div className="jr-editor">
        <div className="jr-editor-head"><span>借方 {yen(debit)}</span><span>貸方 {yen(credit)}</span></div>
        {lines.map((l, i) => (
          <div key={i} className="jr-edit-row">
            <select className="jr-side" value={l.side} onChange={(e) => setLine(i, { side: e.target.value })}>
              <option value="debit">借方</option><option value="credit">貸方</option>
            </select>
            <select className="jr-acc" value={l.accountCode} onChange={(e) => setLine(i, { accountCode: e.target.value })}>
              <option value="">科目を選択</option>
              {Object.entries(grouped).map(([type, arr]) => (
                <optgroup key={type} label={TYPE_LABEL[type]}>
                  {arr.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                </optgroup>
              ))}
            </select>
            <input className="jr-amt" inputMode="numeric" placeholder="金額" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value.replace(/[^0-9]/g, "") })} />
            {lines.length > 2 && <button className="line-del" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}>×</button>}
          </div>
        ))}
        <button className="btn-ghost" style={{ width: "auto", marginTop: 6 }} onClick={() => setLines((p) => [...p, { side: "debit", accountCode: "", amount: "" }])}>＋ 行を追加</button>
      </div>

      <div className={"jr-balance " + (balanced ? "ok" : "ng")}>
        {balanced ? "✓ 貸借一致" : `貸借差額 ${yen(Math.abs(debit - credit))}`}
      </div>
      {err && <p className="login-err">{err}</p>}
      <div className="st-actions">
        <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || !balanced} onClick={save}>{busy ? "登録中…" : "仕訳を登録"}</button>
      </div>
    </div>
  );
}
