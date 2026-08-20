import { useEffect, useState } from "react";
import CustomerLedger from "./CustomerLedger.jsx";
import DealPipeline from "./DealPipeline.jsx";
import Campaigns from "./Campaigns.jsx";
import AiChat from "./AiChat.jsx";

// このモジュールが持つ機能（ダッシュボードに並ぶカード）
const FEATURES = [
  { id: "customers", no: "1", label: "顧客台帳", desc: "顧客情報・取引状況の管理", ready: true },
  { id: "deals",     no: "2", label: "商談管理", desc: "案件パイプライン・フェーズ・確度管理", ready: true },
  { id: "promo",     no: "3", label: "販促メール", desc: "顧客セグメント配信・キャンペーン管理", ready: true },
  { id: "aichat",    no: "4", label: "営業支援AI", desc: "商談・顧客を踏まえた助言・文面作成", ready: true },
];

const ACCENT = "#1657B0";

export default function SalesModule() {
  const [view, setView] = useState("dashboard");
  const [customerCount, setCustomerCount] = useState(null);

  async function loadCount() {
    try {
      const r = await fetch("/api/sales/customers", { credentials: "include" });
      const j = await r.json();
      setCustomerCount(j.ok ? j.data.length : 0);
    } catch {
      setCustomerCount(0);
    }
  }
  useEffect(() => { loadCount(); }, []);

  if (view === "customers") {
    return <CustomerLedger onBack={() => { setView("dashboard"); loadCount(); }} />;
  }
  if (view === "deals") return <DealPipeline onBack={() => setView("dashboard")} />;
  if (view === "promo") return <Campaigns onBack={() => setView("dashboard")} />;
  if (view === "aichat") return <AiChat onBack={() => setView("dashboard")} />;

  return (
    <div className="page mod-dash">
      <h2 className="page-h" style={{ color: ACCENT }}>① 営業管理</h2>
      <p className="mod-dash-sub">使う機能を選んでください。</p>
      <div className="feat-grid">
        {FEATURES.map((f) => (
          <button
            key={f.id}
            className={"feat-card" + (f.ready ? "" : " soon")}
            style={{ "--fc": ACCENT }}
            disabled={!f.ready}
            onClick={() => f.ready && setView(f.id)}
          >
            <span className="feat-no">{f.no}</span>
            <span className="feat-body">
              <span className="feat-label">{f.label}</span>
              <span className="feat-desc">{f.desc}</span>
            </span>
            {f.id === "customers" && customerCount !== null && (
              <span className="feat-count">{customerCount}<small>件</small></span>
            )}
            {!f.ready && <span className="feat-soon">近日</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
