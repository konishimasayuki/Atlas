import { useEffect, useState } from "react";
import ItemMaster from "./ItemMaster.jsx";
import Stocktake from "./Stocktake.jsx";

const FEATURES = [
  { id: "stocktake", no: "1", label: "棚卸管理", desc: "実地棚卸・理論在庫との差異照合", ready: true },
  { id: "items",     no: "2", label: "商品マスタ", desc: "商品・在庫・発注点の管理", ready: true },
  { id: "receiving", no: "3", label: "入出庫", desc: "入荷・出荷・移動（近日）", ready: false },
  { id: "order",     no: "4", label: "発注管理", desc: "発注点割れの自動提案（近日）", ready: false },
];

const ACCENT = "#9A5A0B";

export default function InventoryModule() {
  const [view, setView] = useState("dashboard");
  const [itemCount, setItemCount] = useState(null);

  async function loadCount() {
    try {
      const r = await fetch("/api/inventory/items", { credentials: "include" });
      const j = await r.json();
      setItemCount(j.ok ? j.data.length : 0);
    } catch { setItemCount(0); }
  }
  useEffect(() => { loadCount(); }, []);

  if (view === "items") return <ItemMaster onBack={() => { setView("dashboard"); loadCount(); }} />;
  if (view === "stocktake") return <Stocktake onBack={() => { setView("dashboard"); loadCount(); }} />;

  return (
    <div className="page mod-dash">
      <h2 className="page-h" style={{ color: ACCENT }}>② 在庫・供給管理</h2>
      <p className="mod-dash-sub">使う機能を選んでください。</p>
      <div className="feat-grid">
        {FEATURES.map((f) => (
          <button key={f.id} className={"feat-card" + (f.ready ? "" : " soon")} style={{ "--fc": ACCENT }}
            disabled={!f.ready} onClick={() => f.ready && setView(f.id)}>
            <span className="feat-no">{f.no}</span>
            <span className="feat-body">
              <span className="feat-label">{f.label}</span>
              <span className="feat-desc">{f.desc}</span>
            </span>
            {f.id === "items" && itemCount !== null && (
              <span className="feat-count" style={{ color: ACCENT }}>{itemCount}<small>点</small></span>
            )}
            {!f.ready && <span className="feat-soon">近日</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
