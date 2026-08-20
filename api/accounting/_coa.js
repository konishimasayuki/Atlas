// api/accounting/_coa.js ── 標準勘定科目（中小企業向け・簡易セット）
// type: asset(資産) / liability(負債) / equity(純資産) / revenue(収益) / expense(費用)
// side: 借方が増加=debit（資産・費用） / 貸方が増加=credit（負債・純資産・収益）
// bs: 貸借対照表 / pl: 損益計算書
export const STANDARD_ACCOUNTS = [
  // 資産（BS）
  { code: "101", name: "現金", type: "asset", side: "debit", stmt: "bs", sub: "流動資産" },
  { code: "102", name: "普通預金", type: "asset", side: "debit", stmt: "bs", sub: "流動資産" },
  { code: "103", name: "売掛金", type: "asset", side: "debit", stmt: "bs", sub: "流動資産" },
  { code: "104", name: "商品", type: "asset", side: "debit", stmt: "bs", sub: "流動資産" },
  { code: "105", name: "前払費用", type: "asset", side: "debit", stmt: "bs", sub: "流動資産" },
  { code: "111", name: "建物", type: "asset", side: "debit", stmt: "bs", sub: "固定資産" },
  { code: "112", name: "車両運搬具", type: "asset", side: "debit", stmt: "bs", sub: "固定資産" },
  { code: "113", name: "工具器具備品", type: "asset", side: "debit", stmt: "bs", sub: "固定資産" },
  // 負債（BS）
  { code: "201", name: "買掛金", type: "liability", side: "credit", stmt: "bs", sub: "流動負債" },
  { code: "202", name: "未払金", type: "liability", side: "credit", stmt: "bs", sub: "流動負債" },
  { code: "203", name: "未払費用", type: "liability", side: "credit", stmt: "bs", sub: "流動負債" },
  { code: "204", name: "預り金", type: "liability", side: "credit", stmt: "bs", sub: "流動負債" },
  { code: "205", name: "短期借入金", type: "liability", side: "credit", stmt: "bs", sub: "流動負債" },
  { code: "211", name: "長期借入金", type: "liability", side: "credit", stmt: "bs", sub: "固定負債" },
  // 純資産（BS）
  { code: "301", name: "資本金", type: "equity", side: "credit", stmt: "bs", sub: "純資産" },
  { code: "302", name: "繰越利益剰余金", type: "equity", side: "credit", stmt: "bs", sub: "純資産" },
  // 収益（PL）
  { code: "401", name: "売上高", type: "revenue", side: "credit", stmt: "pl", sub: "売上高" },
  { code: "402", name: "受取利息", type: "revenue", side: "credit", stmt: "pl", sub: "営業外収益" },
  { code: "403", name: "雑収入", type: "revenue", side: "credit", stmt: "pl", sub: "営業外収益" },
  // 費用（PL）
  { code: "501", name: "仕入高", type: "expense", side: "debit", stmt: "pl", sub: "売上原価" },
  { code: "511", name: "給料手当", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "512", name: "法定福利費", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "513", name: "旅費交通費", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "514", name: "接待交際費", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "515", name: "会議費", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "516", name: "消耗品費", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "517", name: "通信費", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "518", name: "水道光熱費", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "519", name: "地代家賃", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "520", name: "減価償却費", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "521", name: "支払手数料", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "522", name: "雑費", type: "expense", side: "debit", stmt: "pl", sub: "販管費" },
  { code: "531", name: "支払利息", type: "expense", side: "debit", stmt: "pl", sub: "営業外費用" },
];

export const TYPE_LABEL = { asset: "資産", liability: "負債", equity: "純資産", revenue: "収益", expense: "費用" };
