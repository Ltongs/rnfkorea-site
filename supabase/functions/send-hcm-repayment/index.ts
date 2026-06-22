// supabase/functions/send-hcm-repayment/index.ts
// 상환표 이미지를 SMS/MMS(Solapi)로 발송
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOLAPI_API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
const SOLAPI_SENDER     = Deno.env.get("SOLAPI_SENDER")     ?? "01050549006";

// ── Solapi HMAC 서명 생성 ──
async function buildSolapiAuth(): Promise<string> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(SOLAPI_API_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signatureBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(date + salt));
  const signature = Array.from(new Uint8Array(signatureBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

// base64 데이터 URL → 순수 base64 문자열 분리
function stripDataUrlPrefix(dataUrl: string): { base64: string; mime: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return { base64: dataUrl, mime: "image/png" };
  return { mime: match[1], base64: match[2] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // deno-lint-ignore no-explicit-any
    const db: any = createClient(sbUrl, sbKey);

    const body = await req.json();
    const {
      recipientPhone,
      recipientName: _recipientName,  // 표시용 (현재 미사용, 추후 본문 커스텀 시 활용)
      customerName,
      imageBase64,    // data:image/png;base64,... 형태
      taskId,         // hyundaicm_tasks.id (발송 이력 저장용, 선택)
      bodyText,       // SMS 본문 텍스트 (선택)
    } = body;

    if (!recipientPhone || !imageBase64) {
      return new Response(JSON.stringify({ error: "recipientPhone, imageBase64는 필수입니다." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET) {
      return new Response(JSON.stringify({ error: "Solapi 키가 설정되지 않았습니다." }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { base64, mime } = stripDataUrlPrefix(imageBase64);
    const auth = await buildSolapiAuth();

    // 1) Solapi 스토리지에 이미지 업로드 → fileId 발급
    const uploadRes = await fetch("https://api.solapi.com/storage/v1/files", {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: base64,
        type: "MMS",
        name: `repayment_${Date.now()}.${mime.includes("jpeg") ? "jpg" : "png"}`,
      }),
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.fileId) {
      return new Response(JSON.stringify({ error: uploadData?.errorMessage ?? "이미지 업로드 실패", raw: uploadData }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 2) MMS 발송 (이미지 fileId 첨부)
    const text = bodyText
      ?? `${customerName ?? "고객"}님 상환스케줄 안내드립니다.`;
    const sendRes = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          to: recipientPhone.replace(/[^0-9]/g, ""),
          from: SOLAPI_SENDER,
          text,
          type: "MMS",
          imageId: uploadData.fileId,
        },
      }),
    });
    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      return new Response(JSON.stringify({ error: sendData?.errorMessage ?? "SMS 발송 실패", raw: sendData }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (taskId) {
      await db.from("hyundaicm_tasks").update({
        repayment_sent_at: new Date().toISOString(),
        repayment_sent_channel: "sms",
        repayment_sent_to: recipientPhone,
      }).eq("id", taskId);
    }

    return new Response(JSON.stringify({ ok: true, channel: "sms", result: sendData }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});