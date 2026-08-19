// api/core/auth/me.js  ── 現在のログインユーザーと権限を返す
import { getCurrentUser } from "../../_lib/core.js";

export default async function handler(req, res) {
  const user = await getCurrentUser(req);
  return res.status(200).json({ ok: true, data: user || null });
}
