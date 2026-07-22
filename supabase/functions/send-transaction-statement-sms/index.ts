// supabase/functions/send-transaction-statement-sms/index.ts
//
// 거래명세서 MMS 발송 Edge Function
// send-quote-sms와 동일한 방식(Solapi 이미지 업로드 → MMS 발송)으로,
// 클라이언트(TransactionStatementPage.tsx)에서 html2canvas로 캡처한 거래명세서 이미지를 발송합니다.
//
// 필요한 Supabase Secrets (send-quote-sms가 이미 쓰는 것과 동일 — 그대로 재사용됨):
//   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER

import { createHmac } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function makeSignature(apiSecret: string): { date: string; salt: string; signature: string } {
  const date      = new Date().toISOString();
  const salt      = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const hmac      = createHmac("sha256", apiSecret);
  hmac.update(`${date}${salt}`);
  const signature = hmac.digest("hex");
  return { date, salt, signature };
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Payload = {
  docNo?: string;
  recipientPhone: string;
  recipientName?: string;
  imageBase64: string;
  grandTotal?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonError("POST만 지원합니다.", 405);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return jsonError("요청 본문이 올바른 JSON이 아닙니다.");
  }

  const { docNo, recipientPhone, recipientName, imageBase64, grandTotal } = body;

  if (!recipientPhone?.trim()) return jsonError("recipientPhone(수신 연락처)이 필요합니다.");
  if (!imageBase64?.trim())    return jsonError("imageBase64(거래명세서 이미지)가 필요합니다.");

  const API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
  const API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
  const SENDER     = Deno.env.get("SOLAPI_SENDER")     ?? "";
  if (!API_KEY || !API_SECRET || !SENDER) {
    return jsonError("Solapi 환경변수가 설정되지 않았습니다.", 500);
  }

  const pureBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

  try {
    // 1. 이미지 업로드
    const sig1 = makeSignature(API_SECRET);
    const uploadRes = await fetch("https://api.solapi.com/storage/v1/files", {
      method: "POST",
      headers: {
        "Authorization": `HMAC-SHA256 apiKey=${API_KEY}, date=${sig1.date}, salt=${sig1.salt}, signature=${sig1.signature}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ file: pureBase64, type: "MMS", name: `statement_${Date.now()}.jpg` }),
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.fileId) {
      return jsonError(`이미지 업로드 실패: ${JSON.stringify(uploadData)}`, 502);
    }

    // 2. MMS 발송
    const sig2 = makeSignature(API_SECRET);
    const phone = recipientPhone.replace(/-/g, "");
    const amountText = typeof grandTotal === "number" ? `\n청구 합계: ${grandTotal.toLocaleString()}원` : "";
    const sendRes = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Authorization": `HMAC-SHA256 apiKey=${API_KEY}, date=${sig2.date}, salt=${sig2.salt}, signature=${sig2.signature}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        message: {
          to:      phone,
          from:    SENDER,
          type:    "MMS",
          subject: "RNF KOREA 거래명세서",
          text:    `[RNF KOREA] ${recipientName ? recipientName + " 귀중\n" : ""}거래명세서를 첨부해 드립니다.${amountText}\n문의: 1551-1873`,
          imageId: uploadData.fileId,
        },
      }),
    });
    const sendData = await sendRes.json();
    if (!sendRes.ok || sendData.errorCode) {
      return jsonError(`MMS 발송 실패: ${JSON.stringify(sendData)}`, 502);
    }

    // 발송 성공 로그 보강 (이메일 발송 함수와 동일하게 sent_at을 남김)
    if (docNo) {
      try {
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        await supabase
          .from("tb_transaction_statements")
          .update({ sent_at: new Date().toISOString() })
          .eq("doc_no", docNo);
      } catch (e) {
        console.error("sent_at 업데이트 실패:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, messageId: sendData.messageId }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return jsonError(e.message ?? "알 수 없는 오류", 500);
  }
});
