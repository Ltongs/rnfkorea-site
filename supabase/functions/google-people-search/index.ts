// @ts-nocheck -- Deno Edge Function: npm/Deno 환경 타입 충돌 회피용
// supabase/functions/google-people-search/index.ts
// 견적서 이메일 자동완성(QuotationPage)이 쓰던 Google People API 연락처 조회용.
// 기존엔 프론트엔드가 google_calendar_tokens.access_token을 직접 select해서 썼는데,
// 그 원시 OAuth 토큰이 로그인 계정 전체에 노출되는 정책(auth_all_gcal_tokens) 위에서만
// 동작하던 코드였다. 보안 점검(2026-07-12)에서 그 정책을 제거했으므로, 이제 이 엣지함수가
// service_role로 admin 계정의 토큰만 서버 측에서 읽어 Google API를 호출하고 결과(이름/이메일)만
// 클라이언트로 돌려준다 — 원시 access_token은 브라우저에 절대 전달되지 않는다.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const ADMIN_GCAL_EMAIL = "admin@rnfkorea.co.kr";

// deno-lint-ignore no-explicit-any
async function getValidAdminToken(db: any) {
  const { data } = await db.from("google_calendar_tokens")
    .select("user_id,access_token,refresh_token,expires_at")
    .eq("gcal_email", ADMIN_GCAL_EMAIL)
    .maybeSingle();

  if (!data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) return data.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: data.refresh_token, grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  if (tokens.error) return null;

  await db.from("google_calendar_tokens").update({
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq("user_id", data.user_id);

  return tokens.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(sbUrl, sbKey);

    const { mode, query } = await req.json();
    const token = await getValidAdminToken(db);
    if (!token) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (mode === "search") {
      const res = await fetch(
        `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(query ?? "")}&readMask=names,emailAddresses&pageSize=8`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return new Response(JSON.stringify({ results: [] }), { headers: { ...CORS, "Content-Type": "application/json" } });
      const d = await res.json();
      const results: { name: string; email: string }[] = [];
      for (const p of d.results ?? []) {
        const name = p.person?.names?.[0]?.displayName ?? "";
        for (const e of (p.person?.emailAddresses ?? [])) {
          if (e.value) results.push({ name, email: e.value });
        }
      }
      return new Response(JSON.stringify({ results }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (mode === "list") {
      const res = await fetch(
        "https://people.googleapis.com/v1/people/me/connections?personFields=emailAddresses,names&pageSize=200&sortOrder=LAST_MODIFIED_DESCENDING",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return new Response(JSON.stringify({ emails: [] }), { headers: { ...CORS, "Content-Type": "application/json" } });
      const d = await res.json();
      const emails = (d.connections ?? [])
        .flatMap((p: any) => (p.emailAddresses ?? []).map((e: any) => e.value))
        .filter(Boolean);
      return new Response(JSON.stringify({ emails }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown mode" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
