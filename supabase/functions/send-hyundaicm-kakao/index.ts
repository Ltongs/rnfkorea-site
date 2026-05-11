// supabase/functions/send-hyundaicm-kakao/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const KAKAO_TOKEN_ADMIN   = Deno.env.get("KAKAO_TOKEN_ADMIN")   ?? "";
const KAKAO_TOKEN_HYUNDAI = Deno.env.get("KAKAO_TOKEN_HYUNDAI") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendKakaoMe(accessToken: string, text: string): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
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
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

function buildMessage(body: Record<string, string>): string {
  const {
    type, caseNo, customerName, customerType, equipmentTon,
    financeCompany, salesRep, installmentPrincipal,
    purchaseAmount, interestRate, incentive,
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
      installmentPrincipal ? `할부원금: ${Number(installmentPrincipal).toLocaleString("ko-KR")}원` : "",
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
      purchase    ? `차량가격: ${purchase.toLocaleString("ko-KR")}원`   : "",
      principal   ? `할부원금: ${principal.toLocaleString("ko-KR")}원`  : "",
      downRate    ? `선수율: ${downRate}`                               : "",
      interestRate ? `금리: ${interestRate}%`                          : "",
      incentive    ? `인센티브: ${incentive}%`                          : "",
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

  throw new Error("type은 'new' 또는 'status_change' 이어야 합니다.");
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body    = await req.json();
    const message = buildMessage(body);
    console.log("[send-hyundaicm-kakao] sending:", message.slice(0, 50));

    const tokens = [
      { role: "admin",   token: KAKAO_TOKEN_ADMIN },
      { role: "hyundai", token: KAKAO_TOKEN_HYUNDAI },
    ].filter(t => t.token);

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ warning: "KAKAO_TOKEN_ADMIN / KAKAO_TOKEN_HYUNDAI Secret 등록 필요" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const results = [];
    for (const { role, token } of tokens) {
      const result = await sendKakaoMe(token, message);
      console.log(`[send-hyundaicm-kakao] ${role}: status=${result.status} body=${result.body}`);
      results.push({ role, ...result });
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