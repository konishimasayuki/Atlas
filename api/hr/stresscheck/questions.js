// api/hr/stresscheck/questions.js ── 職業性ストレス簡易調査票(簡易版・23項目)の設問と採点
// 領域A:仕事のストレス要因 / 領域B:心身のストレス反応 / 領域C:周囲のサポート
// 回答は 1〜4 の4件法。逆転項目(reverse)は採点時に (5 - 値) で換算。

export const SC_QUESTIONS = [
  // --- A: 仕事のストレス要因（1=そうだ 〜 4=ちがう / 多くは逆転で「高いほど負担」に揃える）---
  { id: "a1", area: "A", text: "非常にたくさんの仕事をしなければならない", reverse: true },
  { id: "a2", area: "A", text: "時間内に仕事が処理しきれない", reverse: true },
  { id: "a3", area: "A", text: "かなり注意を集中する必要がある", reverse: true },
  { id: "a4", area: "A", text: "自分のペースで仕事ができる", reverse: false },
  { id: "a5", area: "A", text: "自分で仕事の順番・やり方を決めることができる", reverse: false },
  { id: "a6", area: "A", text: "職場の仕事の方針に自分の意見を反映できる", reverse: false },
  { id: "a7", area: "A", text: "働きがいのある仕事だ", reverse: false },
  // --- B: 心身のストレス反応（1=ほとんどなかった 〜 4=ほとんどいつもあった / 高いほど反応強い）---
  { id: "b1", area: "B", text: "活気がわいてくる", reverse: false, positive: true },
  { id: "b2", area: "B", text: "イライラしている", reverse: true },
  { id: "b3", area: "B", text: "ひどく疲れた", reverse: true },
  { id: "b4", area: "B", text: "不安だ", reverse: true },
  { id: "b5", area: "B", text: "ゆううつだ", reverse: true },
  { id: "b6", area: "B", text: "気がはりつめている", reverse: true },
  { id: "b7", area: "B", text: "眠れない（寝つきが悪い・途中で目が覚める）", reverse: true },
  { id: "b8", area: "B", text: "食欲がない", reverse: true },
  { id: "b9", area: "B", text: "よく眠れる／体調が良い", reverse: false, positive: true },
  // --- C: 周囲のサポート（1=非常に 〜 4=全くない / 高いほどサポート不足）---
  { id: "c1", area: "C", text: "上司はどのくらい気軽に話ができるか", reverse: false, support: true },
  { id: "c2", area: "C", text: "同僚はどのくらい気軽に話ができるか", reverse: false, support: true },
  { id: "c3", area: "C", text: "困ったとき上司はどのくらい頼りになるか", reverse: false, support: true },
  { id: "c4", area: "C", text: "困ったとき同僚はどのくらい頼りになるか", reverse: false, support: true },
  { id: "c5", area: "C", text: "個人的な問題を上司に相談できるか", reverse: false, support: true },
  { id: "c6", area: "C", text: "個人的な問題を同僚に相談できるか", reverse: false, support: true },
];

// 選択肢ラベル（領域ごとに文言が変わる）
export const SC_CHOICES = {
  A: ["そうだ", "まあそうだ", "ややちがう", "ちがう"],
  B: ["ほとんどなかった", "ときどきあった", "しばしばあった", "ほとんどいつもあった"],
  C: ["非常に", "かなり", "多少", "全くない"],
};

// 採点：領域ごとの負担スコア(高いほど要注意)を0〜100に正規化して返す
export function scoreAnswers(answers) {
  const per = { A: [], B: [], C: [] };
  for (const q of SC_QUESTIONS) {
    const raw = Number(answers[q.id]);
    if (!raw || raw < 1 || raw > 4) continue;
    // 「負担が高い＝点数が高い」に揃える
    let v;
    if (q.support) v = raw;            // Cはそのまま(高い=サポート不足)
    else if (q.positive) v = 5 - raw;  // ポジティブ項目は反転(高い=活気なし)
    else if (q.reverse) v = raw;       // 逆転項目(負担系)
    else v = 5 - raw;                  // 通常のポジ項目
    per[q.area].push(v);
  }
  const norm = (arr) => arr.length ? Math.round(((arr.reduce((s, x) => s + x, 0) / arr.length - 1) / 3) * 100) : 0;
  const A = norm(per.A), B = norm(per.B), C = norm(per.C);
  // 高ストレス判定(簡易)：心身反応Bが高い、または 仕事要因A+サポート不足Cが高い
  const highStress = B >= 63 || (A >= 55 && C >= 55);
  return { A, B, C, total: Math.round((A + B + C) / 3), highStress };
}
