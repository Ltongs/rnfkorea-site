// @ts-nocheck -- Deno Edge Function: npm/Deno 환경 타입 충돌 회피용
// supabase/functions/send-orix-new-entry-alert/index.ts
// ORIX 인센티브 신규등록 시 담당자 2명에게 카카오 알림톡으로 발송.
// 새 템플릿 승인 절차 없이, send-hyundaicm-kakao에서 이미 승인받아 쓰고 있는
// HCM 채널의 hcm_status_change 템플릿("incentive_paid" 유형이 이미 이 템플릿을
// 재사용 중)을 그대로 재사용한다. 알림톡 발송 실패 시 Solapi가 자동으로
// SMS로 대체 발송한다(kakaoOptions.disableSms: false).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SOLAPI_API_KEY = Deno.env.get("SOLAPI_API_KEY") ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
const SOLAPI_SENDER = Deno.env.get("SOLAPI_SENDER") ?? "01050549006";

const RECIPIENTS = ["01093659369", "01050549006"];

// HCM 카카오 채널 — send-hyundaicm-kakao(HCM_PF_ID / hcm_status_change)와 동일한
// 승인된 채널·템플릿을 재사용한다 (신규 템플릿 승인 불필요).
const HCM_PF_ID = "KA01PF2606081346516718bsSRTnA56x";
const HCM_STATUS_CHANGE_TEMPLATE_ID = "KA01TP260609091600912cEbCHAjsgUP";
const ORIX_PAGE_URL = "https://rnfkorea.co.kr/orix";

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

    const { customerName, loanPrincipal, productType, incentiveRate } = await req.json();
    const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    // 알림톡 발송 실패 시 Solapi가 대체발송하는 SMS 본문 (기존 SMS 문구 그대로 유지)
    const fallbackText = [
      "[ORIX 인센티브 신규등록]",
      `고객명: ${customerName ?? "-"}`,
      loanPrincipal ? `대출원금: ${Number(loanPrincipal).toLocaleString("ko-KR")}원` : "",
      productType ? `상품구분: ${productType}` : "",
      incentiveRate ? `인센티브율: ${incentiveRate}%` : "",
    ].filter(Boolean).join("\n");

    // hcm_status_change 템플릿 변수에 맞춰 매핑 (케이스번호/장비톤수/이전단계/영업사원은 해당 없음)
    const variables: Record<string, string> = {
      "#{케이스번호}": "-",
      "#{고객명}":     customerName ?? "-",
      "#{고객유형}":   productType  ?? "-",
      "#{장비톤수}":   "-",
      "#{금융사}":     "ORIX캐피탈",
      "#{할부원금}":   loanPrincipal ? `${Number(loanPrincipal).toLocaleString("ko-KR")}원` : "-",
      "#{이전단계}":   "-",
      "#{현재단계}":   `인센티브 신규등록${incentiveRate ? ` (${incentiveRate}%)` : ""}`,
      "#{영업사원}":   "-",
      "#{시간}":       now,
    };

    const results = await Promise.all(RECIPIENTS.map(async (to) => {
      const res = await fetch("https://api.solapi.com/messages/v4/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader() },
        body: JSON.stringify({
          message: {
            to,
            from: SOLAPI_SENDER,
            kakaoOptions: {
              pfId:       HCM_PF_ID,
              templateId: HCM_STATUS_CHANGE_TEMPLATE_ID,
              variables,
              disableSms: false,
              buttons: [{
                buttonType: "WL",
                buttonName: "ORIX 인센티브 관리 열기",
                linkMo:     ORIX_PAGE_URL,
                linkPc:     ORIX_PAGE_URL,
              }],
            },
            text: fallbackText,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`알림톡 발송 실패 (${to}): ${JSON.stringify(data)}`);
      return { to, data };
    }));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-orix-new-entry-alert]", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
