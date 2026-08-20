import { useEffect, useState } from "react";

const ACCENT = "#0B6E52";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();

export default function Financial({ onBack }) {
  const [tab, setTab] = useState("pl"); // pl | bs | cf
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/accounting/journal/report", { credentials: "include" });
    const j = await r.json();
    setReport(j.ok ? j.data : null);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 会計管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>財務三表</h2>
      </div>

      <div className="tabs">
        {[["pl", "損益計算書"], ["bs", "貸借対照表"], ["cf", "資金"]].map(([k, l]) => (
          <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)} style={tab === k ? { background: ACCENT, borderColor: ACCENT } : undefined}>{l}</button>
        ))}
      </div>

      {loading ? <p className="muted">読み込み中…</p> : !report || report.journalCount === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>仕訳データがありません。</b></p>
          <p className="muted">「仕訳・試算表」で仕訳を登録すると、財務三表が自動生成されます。</p>
        </div>
      ) : tab === "pl" ? <PL pl={report.pl} /> : tab === "bs" ? <BS bs={report.bs} /> : <CF report={report} />}
      <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>登録済みの仕訳から自動集計した概算です（決算整理・税効果等は未反映）。</p>
    </div>
  );
}

function Line({ l, v, strong, indent }) {
  return <div className={"fs-row" + (strong ? " strong" : "")} style={indent ? { paddingLeft: 20 } : undefined}><span>{l}</span><span>{yen(v)}</span></div>;
}

function PL({ pl }) {
  return (
    <div className="fs-sheet">
      <div className="fs-title">損益計算書</div>
      <Line l="売上高" v={pl.sales} />
      <Line l="売上原価" v={pl.cogs} indent />
      <Line l="売上総利益" v={pl.grossProfit} strong />
      <Line l="販売費及び一般管理費" v={pl.sga} indent />
      <Line l="営業利益" v={pl.operatingProfit} strong />
      {(pl.revenue - pl.sales) > 0 && <Line l="営業外収益" v={pl.revenue - pl.sales} indent />}
      <div className="fs-net"><span>当期純利益</span><span>{yen(pl.netIncome)}</span></div>

      <div className="pb-label" style={{ marginTop: 16 }}>内訳</div>
      <div className="acc-table-wrap">
        {pl.rows.map((r) => (
          <div key={r.code} className="fs-detail"><span>{r.name}<small className="muted">（{r.sub}）</small></span><span>{yen(r.balance)}</span></div>
        ))}
      </div>
    </div>
  );
}

function BS({ bs }) {
  return (
    <div className="fs-sheet">
      <div className="fs-title">貸借対照表</div>
      <div className="bs-cols">
        <div className="bs-col">
          <div className="bs-h">資産の部</div>
          {bs.asset.map((a) => <div key={a.code} className="fs-detail"><span>{a.name}</span><span>{yen(a.balance)}</span></div>)}
          <div className="fs-row strong"><span>資産合計</span><span>{yen(bs.assetTotal)}</span></div>
        </div>
        <div className="bs-col">
          <div className="bs-h">負債の部</div>
          {bs.liability.map((a) => <div key={a.code} className="fs-detail"><span>{a.name}</span><span>{yen(a.balance)}</span></div>)}
          <div className="fs-row"><span>負債合計</span><span>{yen(bs.liabTotal)}</span></div>
          <div className="bs-h" style={{ marginTop: 10 }}>純資産の部</div>
          {bs.equity.map((a) => <div key={a.code} className="fs-detail"><span>{a.name}</span><span>{yen(a.balance)}</span></div>)}
          <div className="fs-detail"><span>当期純利益</span><span>{yen(bs.netIncome)}</span></div>
          <div className="fs-row"><span>純資産合計</span><span>{yen(bs.equityTotal)}</span></div>
          <div className="fs-row strong"><span>負債・純資産合計</span><span>{yen(bs.liabTotal + bs.equityTotal)}</span></div>
        </div>
      </div>
      <div className={"bs-check " + (bs.balanced ? "ok" : "ng")}>{bs.balanced ? "✓ 貸借一致（資産 = 負債 + 純資産）" : "貸借不一致"}</div>
    </div>
  );
}

function CF({ report }) {
  const { pl, cf, bs } = report;
  return (
    <div className="fs-sheet">
      <div className="fs-title">資金の状況（簡易）</div>
      <Line l="当期純利益" v={pl.netIncome} />
      <div className="fs-net"><span>現金・預金 期末残高</span><span>{yen(cf.cashEnd)}</span></div>
      <p className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.7 }}>
        現金・普通預金の残高を仕訳から集計した簡易表示です。正式なキャッシュ・フロー計算書（営業/投資/財務活動の区分）は、期首残高と各活動の分類を加えて次段階で対応できます。
      </p>
    </div>
  );
}
