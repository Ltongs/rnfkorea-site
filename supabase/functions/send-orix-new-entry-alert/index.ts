// @ts-nocheck -- Deno Edge Function: npm/Deno 환경 타입 충돌 회피용
// supabase/functions/send-orix-new-entry-alert/index.ts
// ORIX 인센티브 신규등록 시 담당자 2명에게 Solapi SMS로 알림 발송.
// 새 카카오 알림톡 템플릿 승인 절차 없이 기존 Solapi 계정으로 바로 보낼 수 있도록 SMS로 발송한다.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SOLAPI_API_KEY = Deno.env.get("SOLAPI_API_KEY") ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
const SOLAPI_SENDER = Deno.env.get("SOLAPI_SENDER") ?? "01050549006";

const RECIPIENTS = ["01093659369", "01050549006"];

function authHeader(): string {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const hmac = createHmac("sha256", SOLAPI_API_SECRET);
  hmac.update(`${date}${salt}`);
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${hmac.digest("hex")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET) {
      throw new Error("Solapi 환경변수가 설정되지 않았습니다.");
    }

    const { customerName, loanPrincipal, productType, incentiveRate } = await req.json();

    const text = [
      "[ORIX 인센티브 신규등록]",
      `고객명: ${customerName ?? "-"}`,
      loanPrincipal ? `대출원금: ${Number(loanPrincipal).toLocaleString("ko-KR")}원` : "",
      productType ? `상품구분: ${productType}` : "",
      incentiveRate ? `인센티브율: ${incentiveRate}%` : "",
    ].filter(Boolean).join("\n");

    const messages = RECIPIENTS.map((to) => ({ to, from: SOLAPI_SENDER, text }));
    const res = await fetch("https://api.solapi.com/messages/v4/send-many", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({ messages }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`SMS 발송 실패: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, result: data }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-orix-new-entry-alert]", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
