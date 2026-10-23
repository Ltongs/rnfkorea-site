// supabase/functions/send-narumi-customer-docs/index.ts
//
// 나르미 고객 서류(차량등록증·영수증·정산서) MMS 발송 Edge Function — 관리자·everyasset 전용
// send-transaction-statement-sms와 동일한 방식(Solapi 이미지 업로드 → MMS 발송)이며,
// MMS는 이미지 1장만 실을 수 있어 서류마다 MMS 1건씩 보낸다.
// 이미지는 클라이언트(pages/Narumi)에서 JPEG(200KB 이하)로 변환해 전달한다.
//
// 필요한 Supabase Secrets: SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER (기존 문자 함수와 공용)

import { createHmac } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_EMAILS   = ["admin@rnfkorea.co.kr", "everyasset.fc@gmail.com"];

function makeSignature(apiSecret: string): { date: string; salt: string; signature: string } {
  const date      = new Date().toISOString();
  const salt      = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const hmac      = createHmac("sha256", apiSecret);
  hmac.update(`${date}${salt}`);
  const signature = hmac.digest("hex");
  return { date, salt, signature };
}

function authHeader(apiKey: string, apiSecret: string) {
  const s = makeSignature(apiSecret);
  return `HMAC-SHA256 apiKey=${apiKey}, date=${s.date}, salt=${s.salt}, signature=${s.signature}`;
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type DocImage = { label: string; imageBase64: string };

type Payload = {
  taskId?: string | number;
  recipientPhone: string;
  customerName?: string;
  docs: DocImage[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonError("POST만 지원합니다.", 405);

  // 허용된 계정 토큰으로 호출된 경우만 허용 (고객에게 직접 나가는 문자라 남용 방지)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await supabase.auth.getUser(token);
  if (!ALLOWED_EMAILS.includes(userData?.user?.email ?? "")) return jsonError("발송 권한이 없습니다.", 403);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return jsonError("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const { taskId, recipientPhone, customerName, docs } = body;
  const phone = (recipientPhone ?? "").replace(/[^0-9]/g, "");
  if (phone.length < 10) return jsonError("수신 번호가 올바르지 않습니다.");
  if (!Array.isArray(docs) || docs.length === 0) return jsonError("보낼 서류가 없습니다.");

  const API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
  const API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
  const SENDER     = Deno.env.get("SOLAPI_SENDER")     ?? "";
  if (!API_KEY || !API_SECRET || !SENDER) {
    return jsonError("Solapi 환경변수가 설정되지 않았습니다.", 500);
  }

  const nameLine = customerName ? `${customerName} 고객님\n` : "";
  const results: { label: string; ok: boolean; error?: string }[] = [];

  for (const doc of docs) {
    try {
      const pureBase64 = doc.imageBase64.includes(",") ? doc.imageBase64.split(",")[1] : doc.imageBase64;

      const uploadRes = await fetch("https://api.solapi.com/storage/v1/files", {
        method: "POST",
        headers: { "Authorization": authHeader(API_KEY, API_SECRET), "Content-Type": "application/json" },
        body: JSON.stringify({ file: pureBase64, type: "MMS", name: `narumi_${Date.now()}.jpg` }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.fileId) throw new Error(`이미지 업로드 실패: ${JSON.stringify(uploadData)}`);

      const sendRes = await fetch("https://api.solapi.com/messages/v4/send", {
        method: "POST",
        headers: { "Authorization": authHeader(API_KEY, API_SECRET), "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            to:      phone,
            from:    SENDER,
            type:    "MMS",
            subject: `[나르미] ${doc.label}`,
            text:    `[나르미 차량등록] ${nameLine}${doc.label}을(를) 보내드립니다.\n문의: 1551-1873`,
            imageId: uploadData.fileId,
          },
        }),
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok || sendData.errorCode) throw new Error(`MMS 발송 실패: ${JSON.stringify(sendData)}`);

      results.push({ label: doc.label, ok: true });
    } catch (e: any) {
      results.push({ label: doc.label, ok: false, error: e?.message ?? "알 수 없는 오류" });
    }
  }

  if (taskId != null && results.some(r => r.ok)) {
    await supabase
      .from("narumi_tasks")
      .update({ customer_docs_sent_at: new Date().toISOString() })
      .eq("id", taskId);
  }

  return new Response(JSON.stringify({ success: results.every(r => r.ok), results }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
