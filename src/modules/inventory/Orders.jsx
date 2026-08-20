import { useEffect, useMemo, useState } from "react";

const ACCENT = "#9A5A0B";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const STATUS_CLASS = { "発注準備": "draft", "発注済": "prospect", "入荷済": "active", "キャンセル": "dormant" };

export default function Orders({ onBack }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("すべて");
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  async function fetchList() {
    const r = await fetch("/api/inventory/orders", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() { setLoading(true); setList(await fetchList()); setLoading(false); }
  useEffect(() => { init(); }, []);

  const tabs = ["すべて", "発注準備", "発注済", "入荷済"];
  const filtered = useMemo(() => tab === "すべて" ? list : list.filter((o) => o.status === tab), [list, tab]);

  if (creating) return <OrderEditor onBack={() => { setCreating(false); init(); }} />;
  if (openId) return <OrderDetail id={openId} onBack={() => { setOpenId(null); init(); }} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 在庫・供給管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>発注管理</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={() => setCreating(true)}>＋ 発注を作成</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : list.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>発注がまだありません。</b></p>
          <p className="muted">「AI需要予測」から推奨品をまとめて発注、または「＋ 発注を作成」で手動作成できます。</p>
        </div>
      ) : (
        <>
          <div className="tabs">
            {tabs.map((t) => (
              <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}
                style={tab === t ? { background: ACCENT, borderColor: ACCENT } : undefined}>{t}</button>
            ))}
          </div>
          <div className="cust-list">
            {filtered.map((o) => (
              <button key={o.id} className="cust-row" onClick={() => setOpenId(o.id)}>
                <div className="cust-main">
                  <span className="cust-code">{o.code}</span>
                  <span className="cust-name">{o.supplier}</span>
                  <span className={"status st-" + (STATUS_CLASS[o.status] || "prospect")}>{o.status}</span>
                </div>
                <div className="cust-sub">{o.lines.length}品目　{yen(o.total)}　{new Date(o.createdAt).toLocaleDateString("ja-JP")}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OrderEditor({ onBack }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState({}); // itemId -> {qty}
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/inventory/items", { credentials: "include" });
      const j = await r.json();
      setItems(j.ok ? j.data.filter((i) => i.status !== "取扱終了") : []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return items.filter((i) => !kw || [i.code, i.name, i.maker, i.supplier].join(" ").toLowerCase().includes(kw));
  }, [items, q]);

  function setQty(it, qty) {
    setPicked((p) => {
      const n = { ...p };
      if (!qty || qty <= 0) delete n[it.id];
      else n[it.id] = { itemId: it.id, code: it.code, name: it.name, qty, cost: it.cost, supplier: it.supplier };
      return n;
    });
  }

  async function save() {
    setBusy(true);
    const bySupplier = {};
    for (const l of Object.values(picked)) (bySupplier[l.supplier || "（仕入先未設定）"] = bySupplier[l.supplier || "（仕入先未設定）"] || []).push(l);
    for (const [supplier, lines] of Object.entries(bySupplier)) {
      await fetch("/api/inventory/orders", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ supplier, lines }) });
    }
    setBusy(false); onBack();
  }

  const count = Object.keys(picked).length;
  return (
    <div className="page ledger">
      <div className="ledger-top"><button className="back-btn" onClick={onBack}>← 一覧</button><h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>発注を作成</h2></div>
      <p className="muted" style={{ fontSize: 12 }}>数量を入れた商品が発注対象。仕入先ごとに発注書が分かれます。</p>
      <div className="ledger-tools"><input className="search" placeholder="商品・メーカー・仕入先で検索" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="cust-list">
        {filtered.slice(0, 60).map((i) => (
          <div key={i.id} className="bonus-row">
            <div className="bonus-info"><span className="cust-code">{i.code}</span>{i.name}<small className="muted"> 在庫{i.theoreticalStock}／{i.supplier}</small></div>
            <input className="st-input" inputMode="numeric" placeholder="数量" value={picked[i.id]?.qty ?? ""} onChange={(e) => setQty(i, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} />
          </div>
        ))}
      </div>
      {count > 0 && (
        <div className="st-actions">
          <button className="btn-primary" style={{ background: ACCENT }} disabled={busy} onClick={save}>{busy ? "作成中…" : `${count}品目で発注を作成`}</button>
        </div>
      )}
    </div>
  );
}

function OrderDetail({ id, onBack }) {
  const [o, setO] = useState(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch(`/api/inventory/orders/${id}`, { credentials: "include" });
    const j = await r.json();
    if (j.ok) setO(j.data);
  }
  useEffect(() => { load(); }, []);
  if (!o) return <div className="page"><p className="muted">読み込み中…</p></div>;

  async function transition(status, msg) {
    if (msg && !confirm(msg)) return;
    setBusy(true);
    await fetch(`/api/inventory/orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status }) });
    setBusy(false); load();
  }
  async function remove() {
    if (!confirm("この発注を削除しますか？")) return;
    setBusy(true);
    await fetch(`/api/inventory/orders/${id}`, { method: "DELETE", credentials: "include" });
    setBusy(false); onBack();
  }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>{o.code}</h2>
        <span className={"status st-" + (STATUS_CLASS[o.status] || "prospect")} style={{ marginLeft: "auto" }}>{o.status}</span>
      </div>
      <div className="cust-sub" style={{ marginBottom: 12 }}>仕入先: <b>{o.supplier}</b>　合計 <b>{yen(o.total)}</b></div>

      <div className="exp-detail-list">
        {o.lines.map((l, i) => (
          <div key={i} className="exp-detail-row">
            <div className="edr-main"><span className="cust-code">{l.code}</span><span className="edr-desc">{l.name}</span></div>
            <div className="edr-right"><span className="edr-amount">{l.qty} × {yen(l.cost)} = {yen(l.amount)}</span></div>
          </div>
        ))}
      </div>

      {o.history?.length > 0 && (
        <div className="exp-history">
          <div className="pb-label">履歴</div>
          {o.history.map((h, i) => <div key={i} className="hist-row">{new Date(h.at).toLocaleDateString("ja-JP")} — {h.by} が{h.action}</div>)}
        </div>
      )}

      <div className="st-actions">
        {o.status === "発注準備" && <button className="btn-ghost danger" disabled={busy} onClick={remove}>削除</button>}
        <span style={{ flex: 1 }} />
        {o.status === "発注準備" && <>
          <button className="btn-ghost" disabled={busy} onClick={() => transition("キャンセル", "この発注をキャンセルしますか？")}>キャンセル</button>
          <button className="btn-primary" style={{ background: ACCENT }} disabled={busy} onClick={() => transition("発注済", "仕入先へ発注を確定します。よろしいですか？")}>発注確定</button>
        </>}
        {o.status === "発注済" && <button className="btn-primary" style={{ background: "#0B6E52" }} disabled={busy} onClick={() => transition("入荷済", "入荷を登録します。数量が在庫に加算されます。よろしいですか？")}>入荷（在庫反映）</button>}
      </div>
      {o.status === "入荷済" && <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>入荷済み。数量は理論在庫に反映されました。</p>}
    </div>
  );
}
