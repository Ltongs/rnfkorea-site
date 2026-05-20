import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KAKAO_REST_API_KEY   = Deno.env.get("KAKAO_REST_API_KEY")  ?? "";
const KAKAO_CLIENT_SECRET  = Deno.env.get("KAKAO_CLIENT_SECRET") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")        ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")    ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", client_id: KAKAO_REST_API_KEY,
      client_secret: KAKAO_CLIENT_SECRET, refresh_token: refreshToken,
    }),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(`토큰 갱신 실패: ${err.error_description}`); }
  const data = await res.json();
  return { access_token: data.access_token, refresh_token: data.refresh_token ?? refreshToken };
}

async function sendKakaoMe(userRole: string, accessToken: string, refreshToken: string, text: string, supabase: ReturnType<typeof createClient>) {
  const doSend = async (token: string) => fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ template_object: JSON.stringify({ object_type: "text", text, link: { web_url: "https://www.rnfkorea.co.kr/narumi" }, button_title: "나르미 업무 열기" }) }),
  });

  let res = await doSend(accessToken);
  if (res.status === 401 && refreshToken) {
    const newTokens = await refreshAccessToken(refreshToken);
    await supabase.from("kakao_tokens").upsert({ user_role: userRole, access_token: newTokens.access_token, refresh_token: newTokens.refresh_token, updated_at: new Date().toISOString() }, { onConflict: "user_role" });
    res = await doSend(newTokens.access_token);
  }
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

function buildMessage(body: Record<string, string>): string {
  const { type, vin, customerName, salesRep, deliveryDate, prevStatus, nextStatus, specialNote } = body;
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const vinDisplay = vin ? `VIN: ${vin}` : "";
  const statusKo: Record<string, string> = { todo: "보류", insurance: "보험", docs: "등록서류", registered: "등록완료", completed: "차량등록증 완료" };

  if (type === "new") return [
    "[나르미 신규 등록]", "",
    vinDisplay,
    customerName ? `고객: ${customerName}` : "",
    salesRep ? `영업: ${salesRep}` : "",
    deliveryDate ? `출고일: ${deliveryDate}` : "",
    specialNote ? `특이사항: ${specialNote}` : "",
    `시간: ${now}`,
  ].filter(Boolean).join("\n");

  if (type === "status_change") return [
    "[나르미 단계 변경]", "",
    vinDisplay,
    customerName ? `고객: ${customerName}` : "",
    salesRep ? `영업: ${salesRep}` : "",
    `상태: ${statusKo[prevStatus] ?? prevStatus ?? "-"} → ${statusKo[nextStatus] ?? nextStatus ?? "-"}`,
    `시간: ${now}`,
  ].filter(Boolean).join("\n");

  if (type === "vehicle_doc_upload") return [
    "[나르미 차량등록증 업로드]", "",
    vinDisplay,
    customerName ? `고객: ${customerName}` : "",
    salesRep ? `영업: ${salesRep}` : "",
    "", "차량등록증이 업로드되었습니다.",
    `시간: ${now}`,
  ].filter(Boolean).join("\n");

  throw new Error("알 수 없는 type: " + type);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json();
    const message = buildMessage(body);
    const { data: tokens, error: dbErr } = await supabase.from("kakao_tokens").select("user_role, access_token, refresh_token");
    if (dbErr) throw new Error(`DB 조회 실패: ${dbErr.message}`);
    if (!tokens || tokens.length === 0) return new Response(JSON.stringify({ warning: "등록된 카카오 토큰이 없습니다." }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    const results = [];
    for (const t of tokens) {
      const result = await sendKakaoMe(t.user_role, t.access_token, t.refresh_token ?? "", message, supabase);
      results.push({ role: t.user_role, ...result });
    }
    return new Response(JSON.stringify({ success: results.every(r => r.ok), results }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
});
