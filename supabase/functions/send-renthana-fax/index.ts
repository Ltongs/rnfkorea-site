// @ts-nocheck -- Deno Edge Function: npm/Deno 환경 타입 충돌 회피용
// supabase/functions/send-renthana-fax/index.ts
// 렌타나 업무페이지(/renthana/work)의 [장착점으로 팩스 발송] 버튼 — 화면에서 만든 장착확인서·품질보증 안내 PDF를
// 그 건의 장착점 팩스번호(renthana_rental_cases.install_shop_fax)로 솔라피 팩스 발송하고,
// 보낸 PDF는 케이스 첨부(기타)와 진행 이력에 남긴다.
//
// 받는 번호는 요청 본문이 아니라 DB에 저장된 장착점 팩스번호를 쓴다(화면에서 먼저 저장한 뒤 호출).
// 로그인한 RNF 관리자만 보낼 수 있다(요청자의 로그인 토큰으로 is_admin_level()을 확인).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOLAPI_API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
// 팩스 발신번호: 기존 팩스 캠페인과 같은 번호
const FAX_SENDER = (Deno.env.get("SOLAPI_SENDER_NUMBER") || Deno.env.get("SOLAPI_SENDER") || "").replace(/\D/g, "");

const SUPABASE_URL = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const BUCKET = "renthana_docs";
const MAX_PDF_BYTES = 8 * 1024 * 1024;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getSolapiAuthHeader(): Promise<string> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const encoder   = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(SOLAPI_API_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(date + salt));
  const signature = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

const fmtFax = (n: string) => n.replace(/^(02|0\d{2}|\d{4})(\d{3,4})(\d{4})$/, "$1-$2-$3");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

  try {
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !FAX_SENDER) throw new Error("SOLAPI 환경변수 미설정");

    // ── 권한: 로그인한 RNF 관리자만 ──
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const asUser = createClient(SUPABASE_URL, ANON_KEY || token, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData } = await asUser.auth.getUser(token);
    if (!userData?.user) return json({ error: "로그인이 필요합니다." }, 401);
    const { data: isAdmin } = await asUser.rpc("is_admin_level");
    if (isAdmin !== true) return json({ error: "설치확인서 팩스는 RNF 관리자만 보낼 수 있습니다." }, 403);

    const body = await req.json() as { caseId?: number; pdfBase64?: string };
    const caseId = Number(body.caseId);
    const pdfBase64 = String(body.pdfBase64 ?? "").replace(/^data:[^,]+,/, "");
    if (!caseId || !pdfBase64) return json({ error: "caseId, pdfBase64가 필요합니다." }, 400);
    if (pdfBase64.length * 0.75 > MAX_PDF_BYTES) return json({ error: "PDF가 너무 큽니다." }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: c } = await db.from("renthana_rental_cases").select("id, case_no, customer_name, install_shop, install_shop_fax").eq("id", caseId).maybeSingle();
    if (!c) return json({ error: "케이스가 없습니다." }, 404);

    const FAX_TO = String(c.install_shop_fax ?? "").replace(/\D/g, "");
    if (FAX_TO.length < 9 || FAX_TO.length > 11) return json({ error: "장착점 팩스번호를 입력해주세요." }, 400);
    // 솔라피 팩스는 050X(평생번호·안심번호) 대역으로 보낼 수 없다
    if (/^050\d/.test(FAX_TO)) return json({ error: "050으로 시작하는 팩스번호(인터넷팩스·안심번호)로는 보낼 수 없습니다. 지역번호 팩스번호를 입력해주세요." }, 400);

    // ── 솔라피: PDF 업로드 → 팩스 발송 ──
    const fileName = `장착확인서_${c.case_no ?? caseId}.pdf`;
    const upRes = await fetch("https://api.solapi.com/storage/v1/files", {
      method: "POST",
      headers: { Authorization: await getSolapiAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ file: pdfBase64, type: "FAX", name: fileName }),
    });
    const up = await upRes.json();
    if (!upRes.ok || !up.fileId) throw new Error(`팩스 파일 업로드 실패: ${JSON.stringify(up)}`);

    const sendRes = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: { Authorization: await getSolapiAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ message: { to: FAX_TO, from: FAX_SENDER, type: "FAX", faxOptions: { fileIds: [up.fileId] } } }),
    });
    const sent = await sendRes.json();
    if (!sendRes.ok || sent.errorCode) throw new Error(`팩스 발송 실패: ${JSON.stringify(sent)}`);

    // ── 기록: 보낸 PDF를 첨부(기타)로 보관 + 진행 이력 ──
    const email = userData.user.email ?? null;
    const path = `cases/${caseId}/etc/${Date.now()}_install_certificate.pdf`;
    const bytes = Uint8Array.from(atob(pdfBase64), (ch) => ch.charCodeAt(0));
    const { error: stErr } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf" });
    if (!stErr) {
      await db.from("renthana_case_files").insert({
        case_id: caseId, kind: "etc", file_name: fileName, storage_path: path,
        file_size: bytes.length, uploaded_by: email,
      });
    }
    await db.from("renthana_case_history").insert({
      case_id: caseId, event_type: "fax",
      note: `설치확인서 팩스 발송 → ${c.install_shop ?? "장착점"} ${fmtFax(FAX_TO)} (접수번호 ${sent.messageId ?? "-"})`,
      created_by: email,
    });

    // 팩스는 비동기라 이 시점엔 솔라피 "접수"까지만 확인된 상태
    return json({ success: true, to: fmtFax(FAX_TO), messageId: sent.messageId ?? null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[렌타나 팩스 오류]:", msg);
    return json({ error: msg }, 500);
  }
});
