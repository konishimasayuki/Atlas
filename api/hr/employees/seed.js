// api/hr/employees/seed.js ── サンプル社員50人を投入（既にあれば投入しない）
import { redis } from "../../_lib/redis.js";
import { requireHr, hrKey, pad4 } from "../_guard.js";

const SURNAME = ["佐藤","鈴木","高橋","田中","伊藤","渡辺","山本","中村","小林","加藤","吉田","山田","木村","林","斎藤","清水","松本","井上","中島","前田","藤田","岡田","後藤","長谷川","石川"];
const SURNAME_KANA = ["サトウ","スズキ","タカハシ","タナカ","イトウ","ワタナベ","ヤマモト","ナカムラ","コバヤシ","カトウ","ヨシダ","ヤマダ","キムラ","ハヤシ","サイトウ","シミズ","マツモト","イノウエ","ナカジマ","マエダ","フジタ","オカダ","ゴトウ","ハセガワ","イシカワ"];
const GIVEN_M = ["翔太","健一","大輔","直樹","拓也","健太","浩","誠","隆","徹","剛","亮","勇太","雄大","和也"];
const GIVEN_F2 = ["美咲","裕子","彩","真由美","陽子","恵","智子","愛","由美","彩香","麻衣","早紀","香織","奈々","舞"];
const GK_M = ["ショウタ","ケンイチ","ダイスケ","ナオキ","タクヤ","ケンタ","ヒロシ","マコト","タカシ","トオル","ツヨシ","リョウ","ユウタ","ユウダイ","カズヤ"];
const GK_F = ["ミサキ","ユウコ","アヤ","マユミ","ヨウコ","メグミ","トモコ","アイ","ユミ","アヤカ","マイ","サキ","カオリ","ナナ","マイ"];
const DEPT = ["営業部","開発部","製造部","管理部","総務部","人事部","経理部","カスタマーサポート部"];
const POS = ["部長","課長","係長","主任","一般","一般","一般","一般","リーダー","一般"];
const EMP = ["正社員","正社員","正社員","正社員","契約社員","パート"];
const LOC = ["本社","福岡支店","佐賀営業所","北九州支店","久留米営業所"];
const SKILLS = ["Excel","簿記","英語","Python","営業","マーケティング","デザイン","溶接","大型免許","品質管理","プレゼン","交渉","データ分析","経理","労務","採用","CAD","在庫管理"];
const QUAL = ["日商簿記2級","普通自動車免許","TOEIC 750","宅地建物取引士","基本情報技術者","フォークリフト運転技能","危険物取扱者乙4","第一種衛生管理者","社会保険労務士","電気工事士2種"];
const HOBBY = ["ゴルフ","釣り","登山","料理","読書","ランニング","カメラ","ゲーム","旅行","野球観戦","キャンプ","映画鑑賞","ドライブ","家庭菜園"];
const BIO = ["よろしくお願いします。","チームで成果を出すのが好きです。","現場改善に取り組んでいます。","新しいことに挑戦するのが得意です。","お客様目線を大切にしています。","数字に強いのが持ち味です。",""];

function pick(a, i) { return a[((i % a.length) + a.length) % a.length]; }
function picks(a, i, n) {
  const out = [];
  for (let j = 0; j < n; j++) {
    const v = a[(i * (j + 2) + j * 5) % a.length];
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const existing = await redis.scard(hrKey.employees(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  const now = Date.now();
  let created = 0;

  for (let n = 1; n <= 50; n++) {
    const female = n % 3 === 0;
    const sIdx = (n * 7) % SURNAME.length;
    const gIdx = (n * 5) % 15;
    const given = female ? GIVEN_F2[gIdx] : pick(GIVEN_M, gIdx);
    const gkana = female ? GK_F[gIdx] : GK_M[gIdx];

    const age = 24 + (n * 13) % 35;        // 24〜58
    const birthYear = 2026 - age;
    const bm = 1 + (n * 3) % 12;
    const bd = 1 + (n * 7) % 27;
    const joinYear = 2008 + (n * 11) % 18; // 2008〜2025
    const jm = 1 + (n * 5) % 12;

    const emp = {
      id: `e${n}`,
      code: `EMP${pad4(n)}`,
      name: `${SURNAME[sIdx]} ${given}`,
      kana: `${SURNAME_KANA[sIdx]} ${gkana}`,
      gender: female ? "女性" : "男性",
      department: pick(DEPT, n * 3),
      position: pick(POS, n),
      employmentType: pick(EMP, n),
      joinDate: `${joinYear}-${pad4(jm).slice(2)}-01`,
      birthDate: `${birthYear}-${pad4(bm).slice(2)}-${pad4(bd).slice(2)}`,
      email: `${["y","t","k","s","m"][n % 5]}.${["sato","suzuki","tanaka","ito","yamada"][n % 5]}${n}@example.co.jp`,
      phone: `0${92 + (n % 8)}-${pad4(1000 + (n * 37) % 8999)}-${pad4((n * 613) % 9999)}`,
      location: pick(LOC, n * 2),
      skills: picks(SKILLS, n, 2 + (n % 3)),
      qualifications: n % 2 === 0 ? picks(QUAL, n, 1 + (n % 2)) : [],
      hobbies: picks(HOBBY, n * 2, 1 + (n % 2)).join("・"),
      bio: pick(BIO, n),
      status: n % 12 === 0 ? "休職" : "在籍",
      createdAt: now - n * 86400000,
    };
    await redis.set(hrKey.employee(tenant, `e${n}`), emp);
    await redis.sadd(hrKey.employees(tenant), `e${n}`);
    created++;
  }

  await redis.set(hrKey.seq(tenant), 50);
  return res.status(200).json({ ok: true, data: { created } });
}
