// @ts-nocheck
// supabase/functions/check-fax-status/index.ts
// 팩스 발송 후 Solapi의 실제(최종) 전송 상태를 조회하는 읽기 전용 진단용 함수.
// send-fax-campaign의 "success"는 Solapi가 요청을 접수했다는 뜻일 뿐 실제 팩스 전송
// 완료를 보장하지 않으므로, messageId로 최종 상태를 확인한다. 새로 발송하지 않음.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SOLAPI_API_KEY = Deno.env.get("SOLAPI_API_KEY") ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";

function authHeader(): string {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const hmac = createHmac("sha256", SOLAPI_API_SECRET);
  hmac.update(`${date}${salt}`);
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${hmac.digest("hex")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { messageId } = await req.json();
    if (!messageId) {
      return new Response(JSON.stringify({ error: "messageId는 필수입니다." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const res = await fetch(`https://api.solapi.com/messages/v4/list?messageId=${messageId}`, {
      headers: { Authorization: authHeader() },
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
