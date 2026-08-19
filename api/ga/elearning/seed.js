// api/ga/elearning/seed.js ── eラーニングのサンプル講座（分野別）を投入
import { redis } from "../../_lib/redis.js";
import { requireGa, gaKey, pad4 } from "../_guard.js";

// レッスン: { id, title, body(テキスト), video(任意URL), quiz:[{q, choices[], answer(index)}] }
const COURSES = [
  {
    category: "会計", level: "初級", title: "簿記の基礎",
    description: "簿記とは何か、複式簿記の仕組みと5要素を学ぶ入門講座。",
    lessons: [
      { title: "簿記の目的と種類", body: "簿記は、日々の取引を帳簿に記録し、会社の財政状態と経営成績を明らかにするための技術です。単式簿記は現金の増減のみを記録しますが、複式簿記は1つの取引を『原因』と『結果』の2面から捉えて記録します。企業会計で使われるのは複式簿記です。",
        quiz: [{ q: "企業会計で用いられる簿記は？", choices: ["単式簿記", "複式簿記", "略式簿記"], answer: 1 }] },
      { title: "5つの要素（資産・負債・純資産・収益・費用）", body: "簿記では全ての勘定科目を5つに分類します。資産（現金・売掛金など持っているもの）、負債（借入金・買掛金など返すべきもの）、純資産（資本金など返さなくてよい元手）、収益（売上など儲けの源）、費用（仕入・給料など儲けを得るための犠牲）。この5要素の理解が全ての土台です。",
        quiz: [{ q: "借入金はどの要素？", choices: ["資産", "負債", "収益"], answer: 1 }, { q: "売上はどの要素？", choices: ["費用", "純資産", "収益"], answer: 2 }] },
      { title: "貸借対照表と損益計算書", body: "貸借対照表(B/S)は一時点の財政状態を『資産＝負債＋純資産』で表します。損益計算書(P/L)は一定期間の経営成績を『収益−費用＝利益』で表します。B/Sはストック、P/Lはフローと覚えましょう。",
        quiz: [{ q: "一定期間の利益を表すのは？", choices: ["貸借対照表(B/S)", "損益計算書(P/L)"], answer: 1 }] },
    ],
  },
  {
    category: "会計", level: "中級", title: "仕訳のルール",
    description: "借方・貸方の考え方と、取引を仕訳に落とす手順を身につける。",
    lessons: [
      { title: "借方・貸方の位置", body: "仕訳では左を借方(かりかた)、右を貸方(かしかた)と呼びます。各要素には『増えたときにどちら側に書くか』の定位置があります。資産・費用の増加は借方、負債・純資産・収益の増加は貸方。減少は逆側です。まずはこの定位置を暗記します。",
        quiz: [{ q: "現金（資産）が増えたら？", choices: ["借方", "貸方"], answer: 0 }] },
      { title: "取引を仕訳にする手順", body: "例：商品を10,000円で現金販売した。①要素を特定→現金(資産)が増え、売上(収益)が発生。②定位置→資産増加は借方、収益発生は貸方。③仕訳→(借)現金 10,000 /(貸)売上 10,000。借方合計と貸方合計は必ず一致します（貸借平均の原理）。",
        quiz: [{ q: "借方合計と貸方合計は？", choices: ["必ず一致する", "一致しなくてよい"], answer: 0 }] },
    ],
  },
  {
    category: "Excel", level: "初級", title: "関数入門（SUM・IF）",
    description: "業務で最も使う基本関数を、具体例で身につける。",
    lessons: [
      { title: "SUM関数で合計", body: "SUMは範囲内の数値を合計する関数です。=SUM(B2:B10) と書くと、B2からB10までの合計が出ます。連続しないセルは =SUM(B2,B5,B8) のようにカンマで区切ります。オートSUM（Σボタン）を使うと範囲を自動認識してくれます。",
        quiz: [{ q: "B2からB10の合計を出す式は？", choices: ["=SUM(B2:B10)", "=TOTAL(B2:B10)", "=ADD(B2-B10)"], answer: 0 }] },
      { title: "IF関数で条件分岐", body: "IFは条件によって表示を変える関数です。=IF(条件, 真の場合, 偽の場合)。例：=IF(B2>=60,\"合格\",\"不合格\") は、B2が60以上なら『合格』、そうでなければ『不合格』を表示します。条件には比較演算子(>= , <= , = , <> )が使えます。",
        quiz: [{ q: "IF関数の書式で正しいのは？", choices: ["=IF(条件,真,偽)", "=IF(真,偽,条件)", "=IF(条件→真)"], answer: 0 }] },
    ],
  },
  {
    category: "Excel", level: "中級", title: "VLOOKUPとピボットテーブル",
    description: "表からの検索と集計を自動化し、作業時間を大幅短縮する。",
    lessons: [
      { title: "VLOOKUPで表引き", body: "VLOOKUPは、指定した値を表の左端列から探し、同じ行の別列の値を返す関数です。=VLOOKUP(検索値, 範囲, 列番号, FALSE)。最後のFALSE（完全一致）を忘れると誤った値を拾うことがあるので必ず指定します。商品コードから商品名や単価を引くのが典型例です。",
        quiz: [{ q: "VLOOKUPの最後の引数、完全一致は？", choices: ["TRUE", "FALSE"], answer: 1 }] },
      { title: "ピボットテーブルで集計", body: "ピボットテーブルは、大量の明細データを『行・列・値』にドラッグするだけで集計表にできる機能です。例えば売上明細から『店舗別×月別の売上合計』を数クリックで作れます。関数を書かずに集計・分析ができるため、データ分析の第一歩として非常に強力です。",
        video: "https://www.example.com/video/pivot-intro",
        quiz: [{ q: "ピボットテーブルの主な用途は？", choices: ["画像編集", "明細データの集計・分析", "メール送信"], answer: 1 }] },
    ],
  },
  {
    category: "ビジネスマナー", level: "初級", title: "報連相の基本",
    description: "報告・連絡・相談の使い分けと、伝え方のコツ。",
    lessons: [
      { title: "報連相とは", body: "報連相は『報告・連絡・相談』の略で、組織で仕事を円滑に進める基本です。報告は指示に対する結果や経過を伝えること、連絡は情報を関係者に知らせること、相談は判断に迷ったとき上司や同僚の意見を求めることです。特に悪い情報ほど早く報告するのが鉄則です。",
        quiz: [{ q: "悪い情報の報告は？", choices: ["早く報告する", "解決してから報告する", "報告しない"], answer: 0 }] },
      { title: "結論から伝える", body: "ビジネスの伝え方は『結論→理由→詳細』の順が基本です（PREP法）。忙しい相手に対しては、まず結論を一言で述べ、次にその理由、必要なら詳細を補足します。だらだらと経緯から話すと要点が伝わりません。",
        quiz: [{ q: "ビジネスで伝える順序は？", choices: ["経緯→結論", "結論→理由→詳細", "詳細→結論"], answer: 1 }] },
    ],
  },
  {
    category: "情報セキュリティ", level: "初級", title: "情報セキュリティの基礎",
    description: "パスワード・メール・情報持ち出しの注意点を学ぶ全社必修。",
    lessons: [
      { title: "パスワード管理", body: "パスワードは長く複雑にし、他サービスと使い回さないのが基本です。推測されやすい誕生日や連続数字は避けます。付箋に書いてモニターに貼る、他人と共有するのは厳禁。可能なら二要素認証(2FA)を有効にしましょう。",
        quiz: [{ q: "安全なパスワード運用は？", choices: ["複数サービスで使い回す", "使い回さず複雑にする", "付箋に貼る"], answer: 1 }] },
      { title: "不審なメール・フィッシング", body: "実在の企業を装い、偽サイトへ誘導してID・パスワードを盗むのがフィッシングです。心当たりのない添付ファイルやリンクは開かない、送信元アドレスやURLをよく確認する、少しでも怪しければ情シスに確認する。急かす・脅す文面は危険信号です。",
        quiz: [{ q: "不審なメールを受けたら？", choices: ["すぐ添付を開く", "リンクを踏んで確認", "開かず情シスに確認"], answer: 2 }] },
    ],
  },
];

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const existing = await redis.scard(gaKey.courses(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  let n = 0;
  for (const c of COURSES) {
    const seq = await redis.incr(gaKey.courseSeq(tenant));
    const id = `crs${seq}`;
    const lessons = c.lessons.map((l, i) => ({
      id: `l${i + 1}`,
      title: l.title,
      body: l.body,
      video: l.video || "",
      quiz: l.quiz || [],
    }));
    const course = {
      id, code: `C${pad4(seq)}`,
      category: c.category, title: c.title, description: c.description, level: c.level,
      lessons, createdAt: Date.now(),
    };
    await redis.set(gaKey.course(tenant, id), course);
    await redis.sadd(gaKey.courses(tenant), id);
    n++;
  }
  return res.status(200).json({ ok: true, data: { created: n } });
}
