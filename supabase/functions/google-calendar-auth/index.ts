// supabase/functions/google-calendar-auth/index.ts
// 구글 OAuth 인증 처리 (인증 URL 생성 + 콜백 처리)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const REDIRECT_URI  = Deno.env.get("GOOGLE_REDIRECT_URI")!;
const SCOPES        = "https://www.googleapis.com/auth/calendar";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(sbUrl, sbKey);

  // ── GET /google-calendar-auth?action=url&user_id=xxx
  // 인증 URL 생성
  if (req.method === "GET" && url.searchParams.get("action") === "url") {
    const userId = url.searchParams.get("user_id") ?? "";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(userId)}`;
    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── GET /google-calendar-auth?code=xxx&state=userId
  // OAuth 콜백: code → access_token + refresh_token
  if (req.method === "GET" && url.searchParams.get("code")) {
    const code   = url.searchParams.get("code")!;
    const userId = url.searchParams.get("state") ?? "";

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();

    if (tokens.error) {
      return new Response(`<script>window.close();</script><p>오류: ${tokens.error_description}</p>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // refresh_token을 Supabase에 저장
    await db.from("google_calendar_tokens").upsert({
      user_id: userId,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: "user_id" });

    // 성공 후 AI비서 페이지로 리디렉션
    return new Response(
      `<html><body><script>
        window.opener?.postMessage('google-calendar-connected','*');
        window.close();
      </script><p>연동 완료! 이 창을 닫아주세요.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // ── POST /google-calendar-auth  { action: "disconnect", user_id }
  if (req.method === "POST") {
    const { action, user_id } = await req.json();
    if (action === "disconnect") {
      await db.from("google_calendar_tokens").delete().eq("user_id", user_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Not found", { status: 404 });
});