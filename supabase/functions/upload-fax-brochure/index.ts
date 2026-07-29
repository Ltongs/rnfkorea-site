// @ts-nocheck -- Deno Edge Function: npm/Deno 환경 타입 충돌 회피용 (Deno.env, esm.sh 외부 모듈 등)
// supabase/functions/upload-fax-brochure/index.ts
// 팩스 캠페인용 브로셔(PDF) 업로드: Solapi 파일 업로드 API로 올리고 fileId를 반환한다.
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET) {
      throw new Error("Solapi 환경변수가 설정되지 않았습니다.");
    }

    const { fileBase64, fileName } = await req.json();
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "fileBase64는 필수입니다." }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const pureBase64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;

    const res = await fetch("https://api.solapi.com/storage/v1/files", {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: pureBase64,
        type: "FAX",
        name: fileName ?? `brochure_${Date.now()}.pdf`,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.fileId) {
      throw new Error(`브로셔 업로드 실패: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ fileId: data.fileId }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
