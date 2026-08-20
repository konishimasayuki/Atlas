import { useEffect, useMemo, useState } from "react";

const ACCENT = "#1657B0";
const RANKS = ["A", "B", "C"];
const STATUSES = ["取引中", "見込み", "休眠"];

export default function Campaigns({ onBack }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);

  async function fetchList() {
    const r = await fetch("/api/sales/campaigns", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() { setLoading(true); setList(await fetchList()); setLoading(false); }
  useEffect(() => { init(); }, []);

  if (creating) return <CampaignEditor onBack={() => { setCreating(false); init(); }} />;
  if (openId) return <CampaignDetail id={openId} onBack={() => { setOpenId(null); init(); }} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 営業管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>販促メール</h2>
        <button className="btn-primary sm" onClick={() => setCreating(true)}>＋ 配信を作成</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : list.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>配信がまだありません。</b></p>
          <p className="muted">「＋ 配信を作成」から、宛先セグメントと本文を設定します。</p>
        </div>
      ) : (
        <div className="cust-list">
          {list.map((c) => (
            <button key={c.id} className="cust-row" onClick={() => setOpenId(c.id)}>
              <div className="cust-main">
                <span className="cust-code">{c.code}</span>
                <span className="cust-name">{c.title}</span>
                <span className={"status " + (c.status === "配信済" ? "st-active" : "st-draft")}>{c.status}</span>
              </div>
              <div className="cust-sub">件名: {c.subject}　宛先 {c.recipientCount} 件{c.sentAt ? `　配信: ${new Date(c.sentAt).toLocaleDateString("ja-JP")}` : ""}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignEditor({ onBack }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("{name} 様\n\nいつもお世話になっております。\n");
  const [ranks, setRanks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [preview, setPreview] = useState([]);
  const [busy, setBusy] = useState(false);

  function toggle(setter, arr, v) { setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]); }

  // 宛先プレビュー（顧客台帳から絞り込み）
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/sales/customers", { credentials: "include" });
      const j = await r.json();
      let cs = (j.ok ? j.data : []).filter((c) => c.email);
      if (ranks.length) cs = cs.filter((c) => ranks.includes(c.rank));
      if (statuses.length) cs = cs.filter((c) => statuses.includes(c.status));
      setPreview(cs);
    })();
  }, [ranks, statuses]);

  async function save(send) {
    setBusy(true);
    await fetch("/api/sales/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title: title || subject, subject, body, ranks, statuses, send }) });
    setBusy(false); onBack();
  }

  const sample = preview[0];
  const rendered = sample ? body.replace(/\{name\}/g, sample.name) : body.replace(/\{name\}/g, "○○");

  return (
    <div className="page ledger">
      <div className="ledger-top"><button className="back-btn" onClick={onBack}>← 一覧</button><h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>配信を作成</h2></div>

      <label className="fld"><span>配信名（管理用）</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="春の新商品案内 など" /></label>
      <label className="fld"><span>件名</span><input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <label className="fld"><span>本文（{"{name}"} で顧客名を差し込み）</span><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></label>

      <div className="sub-sep">宛先セグメント（顧客台帳から抽出）</div>
      <div className="fld"><span>ランク</span>
        <div className="modgrid">
          {RANKS.map((r) => <label key={r} className={"modchk" + (ranks.includes(r) ? " on" : "")} style={{ "--mc": ACCENT }}><input type="checkbox" checked={ranks.includes(r)} onChange={() => toggle(setRanks, ranks, r)} /><span>ランク{r}</span></label>)}
        </div>
      </div>
      <div className="fld"><span>ステータス</span>
        <div className="modgrid">
          {STATUSES.map((s) => <label key={s} className={"modchk" + (statuses.includes(s) ? " on" : "")} style={{ "--mc": ACCENT }}><input type="checkbox" checked={statuses.includes(s)} onChange={() => toggle(setStatuses, statuses, s)} /><span>{s}</span></label>)}
        </div>
      </div>

      <div className="camp-preview">
        <div className="pb-label">配信プレビュー（宛先 {preview.length} 件）</div>
        <div className="camp-mail">
          <div className="camp-subj">{subject || "（件名未入力）"}</div>
          <div className="camp-body">{rendered}</div>
        </div>
        {preview.length > 0 && <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>例: {preview.slice(0, 3).map((c) => c.name).join("、")}{preview.length > 3 ? " ほか" : ""}</div>}
      </div>

      <div className="st-actions">
        <button className="btn-ghost" disabled={busy || !subject} onClick={() => save(false)}>下書き保存</button>
        <button className="btn-primary" disabled={busy || !subject || preview.length === 0} onClick={() => save(true)}>配信する（{preview.length}件）</button>
      </div>
      <p className="muted" style={{ fontSize: 11.5 }}>※ デモのため実際のメール送信は行わず、配信リストと記録のみ作成します。</p>
    </div>
  );
}

function CampaignDetail({ id, onBack }) {
  const [c, setC] = useState(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch(`/api/sales/campaigns/${id}`, { credentials: "include" });
    const j = await r.json();
    if (j.ok) setC(j.data);
  }
  useEffect(() => { load(); }, []);
  if (!c) return <div className="page"><p className="muted">読み込み中…</p></div>;

  async function send() {
    if (!confirm(`${c.recipients.length}件に配信します（デモ・記録のみ）。よろしいですか？`)) return;
    setBusy(true);
    await fetch(`/api/sales/campaigns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: "send" }) });
    setBusy(false); load();
  }
  async function remove() {
    if (!confirm("この配信を削除しますか？")) return;
    setBusy(true);
    await fetch(`/api/sales/campaigns/${id}`, { method: "DELETE", credentials: "include" });
    setBusy(false); onBack();
  }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>{c.title}</h2>
        <span className={"status " + (c.status === "配信済" ? "st-active" : "st-draft")} style={{ marginLeft: "auto" }}>{c.status}</span>
      </div>

      <div className="camp-mail">
        <div className="camp-subj">{c.subject}</div>
        <div className="camp-body">{c.body}</div>
      </div>

      <div className="pb-label" style={{ marginTop: 14 }}>宛先リスト（{c.recipients.length}件）</div>
      <div className="cust-list">
        {c.recipients.slice(0, 100).map((r) => (
          <div key={r.id} className="cust-row" style={{ cursor: "default" }}>
            <div className="cust-main"><span className="cust-name">{r.name}</span><span className={"rank rank-" + r.rank}>{r.rank}</span></div>
            <div className="cust-sub">{r.email}　{r.status}</div>
          </div>
        ))}
      </div>

      <div className="st-actions">
        {c.status !== "配信済" && <button className="btn-ghost danger" disabled={busy} onClick={remove}>削除</button>}
        <span style={{ flex: 1 }} />
        {c.status !== "配信済" && <button className="btn-primary" disabled={busy} onClick={send}>配信する</button>}
      </div>
    </div>
  );
}
