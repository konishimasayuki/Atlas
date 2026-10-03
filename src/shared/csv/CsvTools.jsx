// src/shared/csv/CsvTools.jsx ── 台帳の CSV 書き出し・取り込み（共通部品）
//  書き出し：Excelで文字化けしないよう BOM付き UTF-8
//  取り込み：UTF-8 / Shift_JIS（Excel既定）を自動判別。1行目は見出し（項目名 or キー名）
//  取り込みは「新規追加」。コードは自動採番されるため、CSVのコード列は無視される
import { useState } from "react";

const esc = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const ARR_SEP = "／"; // 配列項目（スキル等）の区切り

export function toCsv(rows, columns) {
  const head = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => {
    const v = r[c.key];
    return esc(Array.isArray(v) ? v.join(ARR_SEP) : v);
  }).join(","));
  return "\uFEFF" + [head, ...body].join("\r\n");
}

export function parseCsv(text) {
  const rows = []; let row = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

async function readFileText(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^\uFEFF/, ""); }
  catch { return new TextDecoder("shift_jis").decode(buf); }
}

function download(name, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");

/**
 * props:
 *  rows      書き出す一覧データ
 *  columns   [{ key, label, type?: "number"|"array", required?, importable?: false }]
 *  name      ファイル名の頭（例：顧客台帳）
 *  endpoint  取り込み時に1件ずつ POST する API
 *  onImported 取り込み完了後のコールバック（一覧の再読み込み）
 *  accent    ボタン色
 */
export default function CsvTools({ rows, columns, name, endpoint, onImported, accent }) {
  const [preview, setPreview] = useState(null); // { records, errors, unknown }
  const [progress, setProgress] = useState(null); // { done, total, fail }

  function exportCsv() { download(`${name}_${today()}.csv`, toCsv(rows, columns)); }
  function template() { download(`${name}_取込テンプレート.csv`, toCsv([], columns.filter((c) => c.importable !== false))); }

  async function onFile(file) {
    if (!file) return;
    const table = parseCsv(await readFileText(file));
    if (table.length < 2) { setPreview({ records: [], errors: ["データ行がありません（1行目は見出し行）"], unknown: [] }); return; }
    const head = table[0].map((h) => h.trim());
    const map = head.map((h) => columns.find((c) => c.importable !== false && (c.label === h || c.key === h)) || null);
    const unknown = head.filter((h, i) => !map[i] && h);
    const errors = []; const records = [];
    table.slice(1).forEach((cells, idx) => {
      const rec = {};
      map.forEach((c, i) => {
        if (!c) return;
        const raw = (cells[i] ?? "").trim();
        if (c.type === "number") rec[c.key] = raw === "" ? 0 : Number(raw.replace(/[,¥円\s]/g, "")) || 0;
        else if (c.type === "array") rec[c.key] = raw ? raw.split(/[／/、,|]/).map((x) => x.trim()).filter(Boolean) : [];
        else rec[c.key] = raw;
      });
      const miss = columns.filter((c) => c.required && !rec[c.key]).map((c) => c.label);
      if (miss.length) errors.push(`${idx + 2}行目：${miss.join("・")}が空欄のためスキップ`);
      else records.push(rec);
    });
    setPreview({ records, errors, unknown });
  }

  async function runImport() {
    const recs = preview.records;
    setProgress({ done: 0, total: recs.length, fail: 0 });
    let done = 0, fail = 0;
    const queue = [...recs];
    const worker = async () => {
      while (queue.length) {
        const rec = queue.shift();
        try {
          const r = await fetch(endpoint, {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify(rec),
          });
          const j = await r.json();
          if (!j.ok) fail++;
        } catch { fail++; }
        done++;
        setProgress({ done, total: recs.length, fail });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]); // 4並列
    onImported && onImported();
  }

  function close() { setPreview(null); setProgress(null); }
  const shownCols = columns.filter((c) => c.importable !== false).slice(0, 5);

  return (
    <>
      <div className="csv-tools">
        <button className="btn-ghost sm" onClick={exportCsv}>CSV書き出し</button>
        <label className="btn-ghost sm" style={{ cursor: "pointer" }}>CSV取り込み
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files[0]); e.target.value = ""; }} />
        </label>
      </div>

      {preview && (
        <div className="modal-back" onClick={progress ? undefined : close}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h3>CSV取り込み（{name}）</h3>
            {!progress ? (
              <>
                <p>取り込み対象：<b>{preview.records.length}件</b>（新規として追加されます。コードは自動採番）</p>
                {preview.unknown.length > 0 && <p className="muted" style={{ fontSize: 12 }}>認識できない列（無視）：{preview.unknown.join("、")}</p>}
                {preview.errors.length > 0 && (
                  <div className="csv-errors">{preview.errors.slice(0, 8).map((e) => <div key={e}>{e}</div>)}{preview.errors.length > 8 && <div>…他{preview.errors.length - 8}件</div>}</div>
                )}
                {preview.records.length > 0 && (
                  <div className="table-wrap"><table className="utable">
                    <thead><tr>{shownCols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                    <tbody>{preview.records.slice(0, 5).map((r, i) => (
                      <tr key={i}>{shownCols.map((c) => <td key={c.key}>{Array.isArray(r[c.key]) ? r[c.key].join(ARR_SEP) : String(r[c.key] ?? "")}</td>)}</tr>
                    ))}</tbody>
                  </table></div>
                )}
                {preview.records.length > 5 && <p className="muted" style={{ fontSize: 12 }}>…先頭5件を表示</p>}
                <p className="muted" style={{ fontSize: 12 }}>
                  列の並びや項目名が分からない場合は <button className="linkbtn" onClick={template}>取り込み用テンプレート</button> をダウンロードしてください。
                </p>
                <div className="modal-actions">
                  <span style={{ flex: 1 }} />
                  <button className="btn-ghost" onClick={close}>キャンセル</button>
                  <button className="btn-primary" style={accent ? { background: accent } : undefined} disabled={!preview.records.length} onClick={runImport}>
                    {preview.records.length}件を取り込む
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="csv-bar"><div style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%`, background: accent || undefined }} /></div>
                <p>{progress.done} / {progress.total} 件 処理済{progress.fail ? `（失敗 ${progress.fail}件）` : ""}</p>
                {progress.done === progress.total && (
                  <>
                    <p className="login-ok">取り込み完了：{progress.total - progress.fail}件を追加しました。</p>
                    <div className="modal-actions"><span style={{ flex: 1 }} /><button className="btn-primary" onClick={close}>閉じる</button></div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
