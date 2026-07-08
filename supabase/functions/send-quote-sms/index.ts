import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function makeSignature(apiKey: string, apiSecret: string): { date: string; salt: string; signature: string } {
  const date      = new Date().toISOString();
  const salt      = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const hmac      = createHmac("sha256", apiSecret);
  hmac.update(`${date}${salt}`);
  const signature = hmac.digest("hex");
  return { date, salt, signature };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const {
      recipientPhone,   // 수신 번호 (010-xxxx-xxxx)
      recipientName,    // 수신인 이름 (선택)
      imageBase64,      // data:image/jpeg;base64,... 또는 순수 base64
      quoteType,        // 'battery' | 'forklift' | 'installment'
    } = await req.json();

    if (!recipientPhone || !imageBase64) {
      return new Response(
        JSON.stringify({ error: "recipientPhone과 imageBase64는 필수입니다." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
    const API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
    const SENDER     = Deno.env.get("SOLAPI_SENDER")     ?? "";

    if (!API_KEY || !API_SECRET || !SENDER) {
      throw new Error("Solapi 환경변수가 설정되지 않았습니다.");
    }

    const { date, salt, signature } = makeSignature(API_KEY, API_SECRET);

    // base64에서 data URL prefix 제거
    const pureBase64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const typeLabel: Record<string, string> = {
      battery:     "배터리",
      forklift:    "지게차",
      installment: "할부",
    };
    const label = typeLabel[quoteType ?? ""] ?? "견적서";

    // 1. 이미지 업로드
    const uploadRes = await fetch("https://api.solapi.com/storage/v1/files", {
      method: "POST",
      headers: {
        "Authorization": `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        file: pureBase64,
        type: "MMS",
        name: `quote_${Date.now()}.jpg`,
      }),
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.fileId) {
      throw new Error(`이미지 업로드 실패: ${JSON.stringify(uploadData)}`);
    }

    // 서명 재생성 (메시지 발송용)
    const sig2 = makeSignature(API_KEY, API_SECRET);

    // 2. MMS 발송
    const phone = recipientPhone.replace(/-/g, "");
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
          subject: `RNF KOREA ${label} 견적서`,
          text:    `[RNF KOREA] ${recipientName ? recipientName + " 귀중\n" : ""}${label} 견적서를 첨부해 드립니다.\n문의: 1551-1873`,
          imageId: uploadData.fileId,
        },
      }),
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok || sendData.errorCode) {
      throw new Error(`MMS 발송 실패: ${JSON.stringify(sendData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: sendData.messageId }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});