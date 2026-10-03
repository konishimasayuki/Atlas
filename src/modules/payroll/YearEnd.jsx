import { useEffect, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#B23A48";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const thisYear = () => String(new Date().getFullYear());

export default function YearEnd({ onBack }) {
  const { user } = useAuth();
  const [year, setYear] = useState(thisYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  async function fetchYear(y) {
    const r = await fetch(`/api/payroll/nencho?year=${y}`, { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : null;
  }
  async function init() {
    setLoading(true);
    let d = await fetchYear(year);
    // デモ(TEST)：当年データが無ければ1年分を自動生成
    if (user.company === "TEST" && (!d || d.count === 0)) {
      await fetch("/api/payroll/salary/seedyear", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ year }) });
      d = await fetchYear(year);
    }
    setData(d);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);

  async function openDetail(empId) {
    const r = await fetch(`/api/payroll/nencho?year=${year}&empId=${empId}`, { credentials: "include" });
    const j = await r.json();
    if (j.ok) setDetail({ ...j.data, empId });
  }

  if (detail) return <YearEndDetail d={detail} onBack={() => { setDetail(null); fetchYear(year); }} onReload={() => openDetail(detail.empId)} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 労務管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>年末調整 {year}年</h2>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : !data || data.count === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>{year}年の給与データがありません。</b></p>
          <p className="muted">給与計算を実施すると、その実績をもとに年末調整を計算します。</p>
        </div>
      ) : (
        <>
          <div className="pay-totals" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="pt-item"><span className="pt-l">還付 合計</span><span className="pt-v" style={{ color: "#0B6E52" }}>{yen(data.totalRefund)}</span></div>
            <div className="pt-item"><span className="pt-l">追徴 合計</span><span className="pt-v" style={{ color: "#B23A48" }}>{yen(data.totalCollect)}</span></div>
          </div>
          <p className="muted" style={{ fontSize: 11.5, margin: "0 0 12px" }}>{data.count}名・社会保険料/生命保険料/地震保険料/配偶者/基礎/扶養控除・住宅ローン控除・復興特別所得税を反映。各社員を開いて「控除の申告を入力」から申告内容を登録してください。</p>

          <div className="cust-list">
            {data.rows.map((r) => (
              <button key={r.empId} className="cust-row" onClick={() => openDetail(r.empId)}>
                <div className="cust-main">
                  <span className="cust-code">{r.code}</span>
                  <span className="cust-name">{r.name}</span>
                  <span className={"status " + (r.settlement >= 0 ? "st-active" : "st-low")} style={{ marginLeft: "auto" }}>
                    {r.settlement >= 0 ? `還付 ${yen(r.settlement)}` : `追徴 ${yen(-r.settlement)}`}
                  </span>
                </div>
                <div className="cust-sub">給与収入 {yen(r.salaryIncome)}　年税額 {yen(r.yearTax)}　源泉済 {yen(r.taxWithheld)}{r.hasInput ? "　✓申告入力済" : "　申告未入力"}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function YearEndDetail({ d, onBack, onReload }) {
  const r = d.result;
  const [editing, setEditing] = useState(false);
  const Row = ({ l, v, sign, note }) => (
    <div className="ps-row"><span>{l}{note ? <small className="muted">　{note}</small> : null}</span><span>{sign === "-" ? "− " : ""}{yen(v)}</span></div>
  );
  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>{d.emp.name} の年末調整</h2>
        <button className="btn-primary sm" style={{ background: ACCENT, marginLeft: "auto" }} onClick={() => setEditing(true)}>控除の申告を入力</button>
      </div>
      <div className="payslip">
        <div className="ps-head"><div><b>{d.emp.name}</b> <span className="muted">{d.emp.code}・{d.emp.department}</span></div><div className="ps-ym">{d.year}年</div></div>
        <div className="ps-sec">課税所得の計算</div>
        <Row l="給与収入（年間総支給）" v={r.salaryIncome} />
        <Row l="給与所得控除" v={r.empDeduction} sign="-" />
        <div className="ps-row strong"><span>給与所得</span><span>{yen(r.incomeAfterEmp)}</span></div>
        <Row l="社会保険料控除" v={r.socialPaid} sign="-" />
        <Row l="生命保険料控除" v={r.lifeInsurance} sign="-" />
        <Row l="地震保険料控除" v={r.earthquake} sign="-" />
        <Row l="配偶者（特別）控除" v={r.spouse} sign="-" note={r.spouseKind !== "なし" ? r.spouseKind : ""} />
        <Row l="基礎控除" v={r.basic} sign="-" />
        <Row l="扶養控除" v={r.dependentDeduction} sign="-" />
        <div className="ps-row strong"><span>課税所得</span><span>{yen(r.taxableIncome)}</span></div>
        <div className="ps-sec">税額と精算</div>
        <Row l="算出所得税額" v={r.computedTax} />
        <Row l="住宅借入金等特別控除" v={r.housingLoan} sign="-" />
        <Row l="年調年税額（復興税込・100円未満切捨）" v={r.yearTax} />
        <Row l="源泉徴収済み" v={r.taxWithheld} />
        <div className="ps-net" style={{ background: r.settlement >= 0 ? "#0B6E52" : "#B23A48" }}>
          <span>{r.settlement >= 0 ? "還付額" : "追徴額"}</span>
          <span>{yen(Math.abs(r.settlement))}</span>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 11.5 }}>
        ※ 生命保険料控除は新制度で計算。扶養控除は一般（38万円/人）で計算しています。
        {Number(d.year) >= 2025 ? "令和7年度税制改正（基礎控除・給与所得控除・配偶者の所得要件）を反映。" : ""}
        最終的な税額は源泉徴収票の作成前に必ずご確認ください。
      </p>
      {editing && <NenchoInput d={d} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onReload(); }} />}
    </div>
  );
}

function NenchoInput({ d, onClose, onSaved }) {
  const i = d.input || {};
  const [f, setF] = useState({
    lifeGeneral: i.lifeGeneral || "", lifeMedical: i.lifeMedical || "", lifePension: i.lifePension || "",
    earthquake: i.earthquake || "", hasSpouse: !!i.hasSpouse, spouseIncome: i.spouseIncome || "",
    spouseElderly: !!i.spouseElderly, housingLoanCredit: i.housingLoanCredit || "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const num = (k, label, hint) => (
    <label className="fld"><span>{label}{hint ? <small className="muted">　{hint}</small> : null}</span>
      <input type="number" inputMode="numeric" min="0" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder="0" /></label>
  );

  async function save() {
    setBusy(true);
    await fetch("/api/payroll/nencho/input", {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ year: d.year, empId: d.empId, ...f }),
    });
    setBusy(false); onSaved();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>{d.emp.name}　{d.year}年分 年末調整の申告</h3>
        <div className="sub-sep">保険料控除申告書（年間の支払保険料）</div>
        <div className="form2">
          {num("lifeGeneral", "一般生命保険料", "新制度")}
          {num("lifeMedical", "介護医療保険料")}
          {num("lifePension", "個人年金保険料", "新制度")}
          {num("earthquake", "地震保険料", "上限5万円")}
        </div>
        <div className="sub-sep">配偶者控除等申告書</div>
        <label className="chk-row"><input type="checkbox" checked={f.hasSpouse} onChange={(e) => set("hasSpouse", e.target.checked)} /><span>控除対象の配偶者がいる</span></label>
        {f.hasSpouse && (
          <div className="form2">
            {num("spouseIncome", "配偶者の合計所得金額（見積額）", "給与のみなら 給与収入−給与所得控除")}
            <label className="chk-row" style={{ alignSelf: "end" }}><input type="checkbox" checked={f.spouseElderly} onChange={(e) => set("spouseElderly", e.target.checked)} /><span>配偶者が年末時点で70歳以上</span></label>
          </div>
        )}
        <div className="sub-sep">住宅借入金等特別控除申告書</div>
        {num("housingLoanCredit", "住宅借入金等特別控除額", "申告書の「控除額」をそのまま入力（税額から直接差し引き）")}
        <div className="modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存して再計算"}</button>
        </div>
      </div>
    </div>
  );
}
