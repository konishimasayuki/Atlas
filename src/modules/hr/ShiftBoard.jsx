import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#6A34A0";
function thisYm() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
const DOW = ["日", "月", "火", "水", "木", "金", "土"];

export default function ShiftBoard({ onBack }) {
  const { user } = useAuth();
  const [ym, setYm] = useState(thisYm());
  const [board, setBoard] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null); // { empId, day }

  async function fetchBoard(m) {
    const r = await fetch(`/api/hr/shift?ym=${m}`, { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : null;
  }
  async function fetchEmployees() {
    const r = await fetch("/api/hr/employees", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() {
    setLoading(true);
    const emps = await fetchEmployees();
    setEmployees(emps);
    let b = await fetchBoard(ym);
    if (user.company === "TEST" && b && Object.keys(b.assignments).length === 0 && emps.length > 0) {
      await fetch("/api/hr/shift/seed", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ym }) });
      b = await fetchBoard(ym);
    }
    setBoard(b);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);

  async function changeMonth(m) { setLoading(true); setYm(m); setBoard(await fetchBoard(m)); setLoading(false); }

  async function setCell(empId, day, code) {
    setBoard((b) => {
      const nb = { ...b, assignments: { ...b.assignments, [empId]: { ...(b.assignments[empId] || {}) } } };
      if (code) nb.assignments[empId][day] = code; else delete nb.assignments[empId][day];
      return nb;
    });
    await fetch("/api/hr/shift", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ym, empId, day, code }) });
    setPicker(null);
  }

  const days = board?.days || 30;
  const codes = board?.codes || [];
  const codeMap = useMemo(() => { const m = {}; for (const c of codes) m[c.code] = c; return m; }, [codes]);

  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => i + 1), [days]);
  const summary = useMemo(() => {
    const s = {};
    for (const c of codes) s[c.code] = 0;
    for (const empId in (board?.assignments || {})) for (const d in board.assignments[empId]) {
      const code = board.assignments[empId][d]; s[code] = (s[code] || 0) + 1;
    }
    return s;
  }, [board, codes]);

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 人事管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>シフト管理</h2>
      </div>

      <div className="pay-runbar">
        <label className="fld" style={{ margin: 0 }}><span>対象年月</span><input type="month" value={ym} onChange={(e) => changeMonth(e.target.value)} /></label>
      </div>

      <div className="shift-legend">
        {codes.map((c) => <span key={c.code} className="shift-chip" style={{ background: c.color }}>{c.code} {c.label}（{summary[c.code] || 0}）</span>)}
      </div>

      {loading || !board ? <p className="muted">読み込み中…</p> : employees.length === 0 ? (
        <p className="muted">人事台帳に社員がいません。</p>
      ) : (
        <div className="shift-scroll">
          <table className="shift-table">
            <thead>
              <tr>
                <th className="shift-name-col">氏名</th>
                {dayList.map((d) => {
                  const dow = new Date(`${ym}-${String(d).padStart(2, "0")}`).getDay();
                  return <th key={d} className={dow === 0 ? "sun" : dow === 6 ? "sat" : ""}>{d}<small>{DOW[dow]}</small></th>;
                })}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="shift-name-col">{e.name}</td>
                  {dayList.map((d) => {
                    const code = board.assignments[e.id]?.[d];
                    const c = codeMap[code];
                    return (
                      <td key={d} className="shift-cell" onClick={() => setPicker({ empId: e.id, day: d })}
                        style={c ? { background: c.color + "22", color: c.color, fontWeight: 700 } : undefined}>
                        {code || ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {picker && (
        <div className="modal-back" onClick={() => setPicker(null)}>
          <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
            <h3>{employees.find((e) => e.id === picker.empId)?.name}　{picker.day}日</h3>
            <div className="shift-pick-grid">
              {codes.map((c) => (
                <button key={c.code} className="shift-pick-btn" style={{ borderColor: c.color, color: c.color }} onClick={() => setCell(picker.empId, picker.day, c.code)}>
                  {c.code}　{c.label}{c.time ? <small>（{c.time}）</small> : null}
                </button>
              ))}
              <button className="shift-pick-btn clear" onClick={() => setCell(picker.empId, picker.day, "")}>クリア</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
