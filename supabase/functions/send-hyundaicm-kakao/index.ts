// supabase/functions/send-hyundaicm-kakao/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KAKAO_REST_API_KEY  = Deno.env.get("KAKAO_REST_API_KEY")  ?? "";
const KAKAO_CLIENT_SECRET = Deno.env.get("KAKAO_CLIENT_SECRET") ?? "";
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")        ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─────────────────────────────────────────────
// 1. access_token 갱신
// ─────────────────────────────────────────────
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
}> {
  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     KAKAO_REST_API_KEY,
      client_secret: KAKAO_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`토큰 갱신 실패: ${err.error_description ?? JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    access_token:  data.access_token,
    // refresh_token은 갱신되지 않을 수도 있으므로 기존 값 유지
    refresh_token: data.refresh_token ?? refreshToken,
  };
}

// ─────────────────────────────────────────────
// 2. 카카오 나에게 보내기 (만료 시 자동 갱신)
// ─────────────────────────────────────────────
async function sendKakaoMe(
  userRole: string,
  accessToken: string,
  refreshToken: string,
  text: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ ok: boolean; status: number; body: string }> {

  const doSend = async (token: string) =>
    fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        template_object: JSON.stringify({
          object_type:  "text",
          text,
          link:         { web_url: "https://www.rnfkorea.co.kr/hyundaicm" },
          button_title: "업무 페이지 열기",
        }),
      }),
    });

  let res = await doSend(accessToken);

  // access_token 만료(401) → refresh_token으로 갱신 후 재시도
  if (res.status === 401 && refreshToken) {
    console.log(`[${userRole}] access_token 만료 → 자동 갱신 시도`);

    const newTokens = await refreshAccessToken(refreshToken);

    // DB에 새 토큰 저장
    await supabase.from("kakao_tokens").upsert(
      {
        user_role:     userRole,
        access_token:  newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: "user_role" }
    );

    console.log(`[${userRole}] 토큰 갱신 완료 → 재발송`);
    res = await doSend(newTokens.access_token);
  }

  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

// ─────────────────────────────────────────────
// 3. 메시지 포맷 빌더
// ─────────────────────────────────────────────
function buildMessage(body: Record<string, string>): string {
  const {
    type, caseNo, customerName, customerType, equipmentTon,
    financeCompany, salesRep, installmentPrincipal,
    purchaseAmount, interestRate, incentive,
    vatDeferredAmount, loanPeriod,
    prevStatus, nextStatus,
  } = body;
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  if (type === "new") {
    return [
      "[HD현대(부산/경남) 할부 신규 접수]",
      "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      `금융사: ${financeCompany ?? "-"}`,
      installmentPrincipal
        ? `할부원금: ${Number(installmentPrincipal).toLocaleString("ko-KR")}원` : "",
      `영업: ${salesRep ?? "-"}`,
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "status_change" && nextStatus === "확정") {
    const purchase  = purchaseAmount       ? Number(purchaseAmount)       : null;
    const principal = installmentPrincipal ? Number(installmentPrincipal) : null;
    const downRate  = (purchase && principal)
      ? `${(((purchase - principal) / purchase) * 100).toFixed(1)}%` : null;
    return [
      "[HD현대(부산/경남) 할부 확정]",
      "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      `금융사: ${financeCompany ?? "-"}`,
      purchase    ? `차량가격: ${purchase.toLocaleString("ko-KR")}원`  : "",
      principal   ? `할부원금: ${principal.toLocaleString("ko-KR")}원` : "",
      downRate    ? `선수율: ${downRate}`                              : "",
      interestRate ? `금리: ${interestRate}%`                         : "",
      incentive    ? `인센티브: ${incentive}%`                         : "",
      vatDeferredAmount ? `부가세후불: ${Number(vatDeferredAmount).toLocaleString("ko-KR")}원` : "",
      loanPeriod   ? `대출기간: ${loanPeriod}개월`                     : "",
      `영업: ${salesRep ?? "-"}`,
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "status_change") {
    const isCreditStatus = ["승인", "보완", "거절"].includes(nextStatus);
    return [
      "[HD현대(부산/경남) 할부 진행 알림]",
      "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      `상태: ${prevStatus} → ${nextStatus}`,
      ...(isCreditStatus ? [
        body.bizHistory      ? `업력: ${body.bizHistory}`               : "",
        body.niceScore       ? `NICE 점수: ${body.niceScore}점`         : "",
        body.creditRate      ? `적용금리: ${body.creditRate}%`          : "",
        body.creditIncentive ? `적용인센티브: ${body.creditIncentive}%` : "",
      ] : []),
      `영업: ${salesRep ?? "-"}`,
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "vehicle_reg_upload") {
    return [
      "[HD현대(부산/경남) 차량등록증 업로드]",
      "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      `영업: ${salesRep ?? "-"}`,
      "",
      "차량(굴삭기) 등록이 완료되었습니다.",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  throw new Error("type은 'new' 또는 'status_change' 이어야 합니다.");
}

// ─────────────────────────────────────────────
// 4. 메인 서버
// ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body     = await req.json();
    const message  = buildMessage(body);
    console.log("[send-hyundaicm-kakao] sending:", message.slice(0, 50));

    // DB에서 토큰 조회
    const { data: tokens, error: dbErr } = await supabase
      .from("kakao_tokens")
      .select("user_role, access_token, refresh_token");

    if (dbErr) throw new Error(`DB 조회 실패: ${dbErr.message}`);
    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ warning: "등록된 카카오 토큰이 없습니다. /hyundaicm/kakao-connect 에서 토큰을 등록해주세요." }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const results = [];
    for (const t of tokens) {
      const result = await sendKakaoMe(
        t.user_role,
        t.access_token,
        t.refresh_token ?? "",
        message,
        supabase
      );
      console.log(`[${t.user_role}] status=${result.status} body=${result.body}`);
      results.push({ role: t.user_role, ...result });
    }

    const allOk = results.every(r => r.ok);
    return new Response(
      JSON.stringify({ success: allOk, results }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[send-hyundaicm-kakao] error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});