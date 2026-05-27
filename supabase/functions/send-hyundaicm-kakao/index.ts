// supabase/functions/send-hyundaicm-kakao/index.ts
// 발송 방식: 솔라피 SMS (카카오 나에게 보내기 → SMS로 전환)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── 환경변수 ────────────────────────────────────────────────
const SOLAPI_API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
const SENDER_PHONE      = Deno.env.get("SOLAPI_SENDER")     ?? "01050549006";
const RECIPIENTS_RAW    = Deno.env.get("SMS_RECIPIENTS")    ?? "01050549006,01095250707,01079310339";
const RECIPIENTS        = RECIPIENTS_RAW.split(",").map((n) => n.replace(/\D/g, ""));

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── 솔라피 HMAC-SHA256 인증 헤더 ───────────────────────────
async function getSolapiAuthHeader(): Promise<string> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

  const encoder  = new TextEncoder();
  const keyData  = encoder.encode(SOLAPI_API_SECRET);
  const msgData  = encoder.encode(date + salt);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuffer  = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const signature  = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

// ─── SMS 발송 ────────────────────────────────────────────────
async function sendSms(text: string): Promise<void> {
  const messages = RECIPIENTS.map((to) => ({ to, from: SENDER_PHONE, text }));
  const authHeader = await getSolapiAuthHeader();

  const res = await fetch("https://api.solapi.com/messages/v4/send-many", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("솔라피 발송 오류:", err);
    throw new Error(`SMS 발송 실패: ${err}`);
  }
  const result = await res.json();
  console.log("솔라피 발송 결과:", JSON.stringify(result));
}

// ─── 메시지 포맷 빌더 (기존 카카오 포맷 완전 유지) ──────────
function buildMessage(body: Record<string, string>): string {
  const {
    type, caseNo, customerName, customerType, equipmentTon,
    financeCompany, salesRep, installmentPrincipal,
    purchaseAmount, interestRate, incentive,
    vatDeferredAmount, loanPeriod,
    prevStatus, nextStatus,
  } = body;
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  // ── HD현대 신규접수 ──────────────────────────────────────
  if (type === "new") {
    return [
      "[HD현대(부산/경남) 할부 신규 접수]", "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      `금융사: ${financeCompany ?? "-"}`,
      installmentPrincipal ? `할부원금: ${Number(installmentPrincipal).toLocaleString("ko-KR")}원` : "",
      `영업: ${salesRep ?? "-"}`,
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  // ── 확정 ────────────────────────────────────────────────
  if (type === "status_change" && nextStatus === "확정") {
    const purchase  = purchaseAmount       ? Number(purchaseAmount)       : null;
    const principal = installmentPrincipal ? Number(installmentPrincipal) : null;
    const downRate  = (purchase && principal)
      ? `${(((purchase - principal) / purchase) * 100).toFixed(1)}%` : null;
    return [
      "[HD현대(부산/경남) 할부 확정]", "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      `금융사: ${financeCompany ?? "-"}`,
      purchase    ? `차량가격: ${purchase.toLocaleString("ko-KR")}원`  : "",
      principal   ? `할부원금: ${principal.toLocaleString("ko-KR")}원` : "",
      downRate    ? `선수율: ${downRate}`                              : "",
      interestRate ? `금리: ${interestRate}%`                         : "",
      incentive    ? `인센티브: ${incentive}%`                        : "",
      vatDeferredAmount ? `부가세후불: ${Number(vatDeferredAmount).toLocaleString("ko-KR")}원` : "",
      loanPeriod   ? `대출기간: ${loanPeriod}개월`                    : "",
      `영업: ${salesRep ?? "-"}`,
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  // ── 단계 변경 (승인/보완/거절 포함) ─────────────────────
  if (type === "status_change") {
    const isCreditStatus = ["승인", "보완", "거절"].includes(nextStatus);
    return [
      "[HD현대(부산/경남) 할부 진행 알림]", "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      financeCompany ? `금융사: ${financeCompany}` : "",
      installmentPrincipal ? `할부원금: ${Number(installmentPrincipal).toLocaleString("ko-KR")}원` : "",
      `상태: ${prevStatus} → ${nextStatus}`,
      ...(isCreditStatus ? [
        ...(nextStatus !== "거절" ? [
          body.bizHistory      ? `업력: ${body.bizHistory}`               : "",
          body.niceScore       ? `NICE 점수: ${body.niceScore}점`         : "",
          body.creditRate      ? `적용금리: ${body.creditRate}%`          : "",
          body.creditIncentive ? `적용인센티브: ${body.creditIncentive}%` : "",
        ] : []),
        ...(nextStatus === "승인" ? [
          body.loanLimit  ? `대출한도: ${Number(body.loanLimit).toLocaleString("ko-KR")}원` : "",
          body.creditNote ? `특이사항: ${body.creditNote}` : "",
        ] : []),
        ...(nextStatus === "보완" ? [
          body.creditNote ? `보완사항: ${body.creditNote}` : "",
        ] : []),
        ...(nextStatus === "거절" ? [
          body.creditNote ? `거절사유: ${body.creditNote}` : "",
        ] : []),
      ] : []),
      `영업: ${salesRep ?? "-"}`,
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  // ── 정보 수정 ────────────────────────────────────────────
  if (type === "edit") {
    const purchase  = body.purchaseAmount       ? Number(body.purchaseAmount)       : null;
    const principal = body.installmentPrincipal ? Number(body.installmentPrincipal) : null;
    const downRate  = (purchase && principal)
      ? `${(((purchase - principal) / purchase) * 100).toFixed(1)}%` : null;
    return [
      "[HD현대(부산/경남) 할부 정보 수정]", "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      `금융사: ${financeCompany ?? "-"}`,
      purchase    ? `차량가격: ${purchase.toLocaleString("ko-KR")}원`  : "",
      principal   ? `할부원금: ${principal.toLocaleString("ko-KR")}원` : "",
      downRate    ? `선수율: ${downRate}`                              : "",
      body.interestRate     ? `금리: ${body.interestRate}%`           : "",
      body.incentive        ? `인센티브: ${body.incentive}%`          : "",
      body.vatDeferredAmount ? `부가세후불: ${Number(body.vatDeferredAmount).toLocaleString("ko-KR")}원` : "",
      body.loanPeriod       ? `대출기간: ${body.loanPeriod}개월`      : "",
      `영업: ${salesRep ?? "-"}`,
      `현재단계: ${prevStatus ?? "-"}`,
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  // ── 차량등록증 업로드 ─────────────────────────────────────
  if (type === "vehicle_reg_upload") {
    return [
      "[HD현대(부산/경남) 차량등록증 업로드]", "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      financeCompany ? `금융사: ${financeCompany}` : "",
      `영업: ${salesRep ?? "-"}`, "",
      "차량(굴삭기) 등록이 완료되었습니다.",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  // ── 세금계산서 업로드 ─────────────────────────────────────
  if (type === "tax_invoice_upload") {
    return [
      "[HD현대(부산/경남) 세금계산서 업로드]", "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      financeCompany ? `금융사: ${financeCompany}` : "",
      `영업: ${salesRep ?? "-"}`, "",
      "세금계산서가 업로드되었습니다.",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  // ── 인센티브 지급 ─────────────────────────────────────────
  if (type === "incentive_paid") {
    return [
      "[HD현대(부산/경남) 인센티브 지급]", "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      financeCompany ? `금융사: ${financeCompany}` : "",
      `영업: ${salesRep ?? "-"}`, "",
      "✅ 인센티브 지급 완료",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  // ─── 나르미 메시지 타입 ───────────────────────────────────
  const statusKo: Record<string, string> = {
    todo: "보류", insurance: "보험", docs: "등록서류",
    registered: "등록완료", completed: "차량등록증 완료",
  };

  if (type === "narumi_insurance_confirmed") {
    return [
      "[나르미 보험확인완료]", "",
      body.vin     ? `VIN: ${body.vin}`      : "",
      customerName ? `고객: ${customerName}` : "",
      salesRep     ? `영업: ${salesRep}`     : "",
      "", "✅ 보험확인완료",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "narumi_new") {
    return [
      "[나르미 신규 등록]", "",
      body.vin          ? `VIN: ${body.vin}`             : "",
      customerName      ? `고객: ${customerName}`         : "",
      salesRep          ? `영업: ${salesRep}`             : "",
      body.deliveryDate ? `출고일: ${body.deliveryDate}`  : "",
      body.specialNote  ? `특이사항: ${body.specialNote}` : "",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "narumi_status") {
    return [
      "[나르미 단계 변경]", "",
      body.vin     ? `VIN: ${body.vin}`      : "",
      customerName ? `고객: ${customerName}` : "",
      salesRep     ? `영업: ${salesRep}`     : "",
      `상태: ${statusKo[body.prevStatus] ?? body.prevStatus ?? "-"} → ${statusKo[body.nextStatus] ?? body.nextStatus ?? "-"}`,
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "narumi_vehicle_doc") {
    return [
      "[나르미 차량등록증 업로드]", "",
      body.vin     ? `VIN: ${body.vin}`      : "",
      customerName ? `고객: ${customerName}` : "",
      salesRep     ? `영업: ${salesRep}`     : "",
      "", "차량등록증이 업로드되었습니다.",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  throw new Error(`알 수 없는 type: ${type}`);
}

// ─── 메인 핸들러 ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body    = await req.json() as Record<string, string>;
    const message = buildMessage(body);
    console.log("[SMS 발송] 메시지 앞부분:", message.slice(0, 80));

    await sendSms(message);

    return new Response(
      JSON.stringify({ success: true, recipients: RECIPIENTS }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[SMS 발송 오류]:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});