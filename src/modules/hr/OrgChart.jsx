import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#6A34A0";

export default function OrgChart({ onBack }) {
  const { user } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // node being edited, or {parentId} for new
  const [collapsed, setCollapsed] = useState({});

  async function fetchNodes() {
    const r = await fetch("/api/hr/org", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() {
    setLoading(true);
    let data = await fetchNodes();
    if (data.length === 0) {
      await fetch("/api/hr/org", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ init: true }) });
      data = await fetchNodes();
    }
    setNodes(data);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { setNodes(await fetchNodes()); }

  const byParent = useMemo(() => {
    const m = {};
    for (const n of nodes) (m[n.parentId || "root"] = m[n.parentId || "root"] || []).push(n);
    for (const k in m) m[k].sort((a, b) => (a.order || 0) - (b.order || 0));
    return m;
  }, [nodes]);
  const root = nodes.find((n) => n.type === "company");

  function toggle(id) { setCollapsed((p) => ({ ...p, [id]: !p[id] })); }

  const personCount = nodes.filter((n) => n.type === "person").length;
  const deptCount = nodes.filter((n) => n.type === "dept").length;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 人事管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>組織図</h2>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : !root ? <p className="muted">データがありません。</p> : (
        <>
          <div className="stat-pills">
            <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>部署 {deptCount}</span>
            <span className="pill">所属人数 {personCount}</span>
          </div>
          <p className="muted" style={{ fontSize: 11.5, margin: "0 0 10px" }}>人事台帳の所属を元に自動生成された組織図です。部署の追加・異動・削除など自由に編集できます。</p>

          <div className="org-tree">
            <OrgNode node={root} byParent={byParent} nodes={nodes} collapsed={collapsed} toggle={toggle}
              onEdit={setEditing} onAddChild={(parentId) => setEditing({ isNew: true, parentId, type: "dept" })} depth={0} />
          </div>
        </>
      )}

      {editing && (
        <NodeEditor node={editing} nodes={nodes}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); reload(); }} />
      )}
    </div>
  );
}

function OrgNode({ node, byParent, nodes, collapsed, toggle, onEdit, onAddChild, depth }) {
  const children = byParent[node.id] || [];
  const isOpen = !collapsed[node.id];
  const color = node.type === "company" ? "#334155" : node.type === "dept" ? ACCENT : "#1657B0";

  return (
    <div className="org-branch">
      <div className="org-node" style={{ borderColor: color }}>
        {children.length > 0 && <button className="org-toggle" onClick={() => toggle(node.id)}>{isOpen ? "▾" : "▸"}</button>}
        <span className="org-label" style={{ color }}>{node.label}</span>
        <span className="org-tag" style={{ background: color }}>{node.type === "company" ? "会社" : node.type === "dept" ? "部署" : "所属"}</span>
        <button className="org-edit" onClick={() => onEdit(node)}>編集</button>
        {node.type !== "person" && <button className="org-add" onClick={() => onAddChild(node.id)}>＋</button>}
      </div>
      {isOpen && children.length > 0 && (
        <div className="org-children">
          {children.map((c) => (
            <OrgNode key={c.id} node={c} byParent={byParent} nodes={nodes} collapsed={collapsed} toggle={toggle} onEdit={onEdit} onAddChild={onAddChild} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeEditor({ node, nodes, onClose, onDone }) {
  const isNew = !!node.isNew;
  const [label, setLabel] = useState(isNew ? "" : node.label);
  const [type, setType] = useState(isNew ? node.type : node.type);
  const [parentId, setParentId] = useState(isNew ? node.parentId : node.parentId);
  const [busy, setBusy] = useState(false);

  const candidates = nodes.filter((n) => n.type !== "person" && n.id !== node.id);

  async function save() {
    setBusy(true);
    if (isNew) {
      await fetch("/api/hr/org", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ label, type, parentId }) });
    } else {
      await fetch(`/api/hr/org/${node.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ label, parentId }) });
    }
    setBusy(false); onDone();
  }
  async function remove() {
    if (!confirm(`「${node.label}」を削除しますか？（配下は上位に移動します）`)) return;
    setBusy(true);
    await fetch(`/api/hr/org/${node.id}`, { method: "DELETE", credentials: "include" });
    setBusy(false); onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? "ノードを追加" : `「${node.label}」を編集`}</h3>
        <div className="form2">
          <label className="fld wide-col"><span>名称</span><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例：営業部 / 第一営業課" /></label>
          {isNew && (
            <label className="fld"><span>種別</span><select value={type} onChange={(e) => setType(e.target.value)}><option value="dept">部署</option></select></label>
          )}
          <label className="fld wide-col"><span>所属先</span>
            <select value={parentId || ""} onChange={(e) => setParentId(e.target.value)}>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select></label>
        </div>
        <div className="modal-actions">
          {!isNew && node.type !== "company" && <button className="btn-ghost danger" onClick={remove} disabled={busy}>削除</button>}
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || !label} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
