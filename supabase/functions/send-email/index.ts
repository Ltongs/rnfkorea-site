// supabase/functions/send-email/index.ts
// 범용 이메일 발송 (Resend API)
// body: { to, subject, text?, html? }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM    = Deno.env.get("FROM_EMAIL")     ?? "RNF Korea <noreply@rnfkorea.co.kr>";

// 일반 텍스트(줄바꿈 포함)를 최소한의 HTML로 변환 — text만 오고 html이 없을 때 사용
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:sans-serif;font-size:14px;white-space:pre-wrap;line-height:1.6;">${escaped}</div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY가 설정되지 않았습니다." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { to, subject, text, html } = body as {
      to?: string; subject?: string; text?: string; html?: string;
    };

    if (!to || !subject || (!text && !html)) {
      return new Response(
        JSON.stringify({ error: "to, subject, text(또는 html)는 필수입니다." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    RESEND_FROM,
        to:      [to],
        subject,
        text:    text ?? undefined,
        html:    html ?? (text ? textToHtml(text) : undefined),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[Resend 오류]:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: data?.message ?? "이메일 발송 실패", raw: data }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data?.id }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[오류]:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
