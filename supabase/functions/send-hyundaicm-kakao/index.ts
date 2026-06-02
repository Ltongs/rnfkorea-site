// supabase/functions/send-hyundaicm-kakao/index.ts
// 발송 방식: 솔라피 SMS
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── 솔라피 환경변수 ─────────────────────────────────────────
const SOLAPI_API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
const SENDER_PHONE      = Deno.env.get("SOLAPI_SENDER")     ?? "01050549006";

// 현대건설기계 수신자
const RECIPIENTS_RAW = Deno.env.get("SMS_RECIPIENTS") ?? "01050549006,01095250707,01079310339";
const RECIPIENTS     = RECIPIENTS_RAW.split(",").map((n) => n.replace(/\D/g, ""));

// 수신자 ID → 전화번호 매핑 (보류 기능에서 선택적 발송에 사용)
const RECIPIENT_ID_MAP: Record<string, string> = {
  tongs:    RECIPIENTS[0] ?? "01050549006", // 이동수 (관리자)
  p2001103: RECIPIENTS[1] ?? "01095250707", // 현대CM 담당자
  nhcap:    RECIPIENTS[2] ?? "01079310339", // NH캐피탈 담당자
};

// 나르미 전용 수신자
const NARUMI_RECIPIENTS_RAW = Deno.env.get("NARUMI_SMS_RECIPIENTS") ?? "01050549006,01020793025";
const NARUMI_RECIPIENTS     = NARUMI_RECIPIENTS_RAW.split(",").map((n) => n.replace(/\D/g, ""));

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── 솔라피 HMAC-SHA256 인증 ─────────────────────────────────
async function getSolapiAuthHeader(): Promise<string> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const encoder   = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(SOLAPI_API_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(date + salt));
  const signature = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

// ─── SMS 발송 ────────────────────────────────────────────────
async function sendSms(text: string, recipients: string[] = RECIPIENTS): Promise<void> {
  const messages   = recipients.map((to) => ({ to, from: SENDER_PHONE, text }));
  const authHeader = await getSolapiAuthHeader();
  const res = await fetch("https://api.solapi.com/messages/v4/send-many", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("솔라피 오류:", err);
    throw new Error(`SMS 발송 실패: ${err}`);
  }
  console.log("솔라피 결과:", JSON.stringify(await res.json()));
}

// 수신자 ID 배열로 발송 (보류 기능용)
async function sendSmsToIds(text: string, recipientIds: string[]): Promise<void> {
  const phones = recipientIds
    .map((id) => RECIPIENT_ID_MAP[id])
    .filter(Boolean);
  if (phones.length === 0) throw new Error("유효한 수신자가 없습니다.");
  await sendSms(text, phones);
}

// ─────────────────────────────────────────────
// 메시지 포맷 빌더
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
      financeCompany ? `금융사: ${financeCompany}` : "",
      installmentPrincipal ? `할부원금: ${Number(installmentPrincipal).toLocaleString("ko-KR")}원` : "",
      `상태: ${prevStatus} → ${nextStatus}`,
      ...(isCreditStatus ? [
        // 승인/보완 공통
        ...(nextStatus !== "거절" ? [
          body.bizHistory      ? `업력: ${body.bizHistory}`               : "",
          body.niceScore       ? `NICE 점수: ${body.niceScore}점`         : "",
          body.creditRate      ? `적용금리: ${body.creditRate}%`          : "",
          body.creditIncentive ? `적용인센티브: ${body.creditIncentive}%` : "",
        ] : []),
        // 승인 전용
        ...(nextStatus === "승인" ? [
          body.loanLimit ? `대출한도: ${Number(body.loanLimit).toLocaleString("ko-KR")}원` : "",
          body.creditNote ? `특이사항: ${body.creditNote}` : "",
        ] : []),
        // 보완 전용
        ...(nextStatus === "보완" ? [
          body.creditNote ? `보완사항: ${body.creditNote}` : "",
        ] : []),
        // 거절 전용
        ...(nextStatus === "거절" ? [
          body.creditNote ? `거절사유: ${body.creditNote}` : "",
        ] : []),
      ] : []),
      `영업: ${salesRep ?? "-"}`,
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "edit") {
    return [
      "[HD현대(부산/경남) 할부 정보 수정]",
      "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `현재단계: ${prevStatus ?? "-"}`,
      `영업: ${salesRep ?? "-"}`,
      "",
      "── 변경사항 ──",
      body.changedSummary ?? "변경사항 없음",
      "",
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
      financeCompany ? `금융사: ${financeCompany}` : "",
      `영업: ${salesRep ?? "-"}`,
      "",
      "차량(굴삭기) 등록이 완료되었습니다.",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "tax_invoice_upload") {
    return [
      "[HD현대(부산/경남) 세금계산서 업로드]",
      "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      financeCompany ? `금융사: ${financeCompany}` : "",
      `영업: ${salesRep ?? "-"}`,
      "",
      "세금계산서가 업로드되었습니다.",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "incentive_paid") {
    return [
      "[HD현대(부산/경남) 인센티브 지급]",
      "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      financeCompany ? `금융사: ${financeCompany}` : "",
      `영업: ${salesRep ?? "-"}`,
      "",
      "✅ 인센티브 지급 완료",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  // ─── 나르미 메시지 타입 ───────────────────────────
  const statusKo: Record<string, string> = {
    todo: "보류", insurance: "보험", docs: "등록서류",
    registered: "등록완료", completed: "차량등록증 완료",
  };

  if (type === "narumi_new") {
    return [
      "[나르미 신규 등록]", "",
      body.vin          ? `VIN: ${body.vin}`                    : "",
      customerName      ? `고객: ${customerName}`               : "",
      salesRep          ? `영업: ${salesRep}`                   : "",
      body.deliveryDate ? `출고일: ${body.deliveryDate}`        : "",
      body.specialNote  ? `특이사항: ${body.specialNote}`       : "",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "narumi_status") {
    return [
      "[나르미 단계 변경]", "",
      body.vin     ? `VIN: ${body.vin}`                                                          : "",
      customerName ? `고객: ${customerName}`                                                     : "",
      salesRep     ? `영업: ${salesRep}`                                                         : "",
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

  // ── 나르미 등록서류 수령 ────────────────────────────────
  if (type === "narumi_docs_ready") {
    return [
      "[나르미 등록서류 수령]", "",
      body.vin     ? `VIN: ${body.vin}`      : "",
      customerName ? `고객: ${customerName}` : "",
      salesRep     ? `영업: ${salesRep}`     : "",
      "", "📄 등록서류를 수령하였습니다.",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  // ── 나르미 우편발송 ─────────────────────────────────────
  if (type === "narumi_postal") {
    return [
      "[나르미 우편발송]", "",
      body.vin        ? `VIN: ${body.vin}`            : "",
      customerName    ? `고객: ${customerName}`        : "",
      salesRep        ? `영업: ${salesRep}`            : "",
      body.trackingNo ? `등기번호: ${body.trackingNo}` : "",
      body.sentDate   ? `발송일: ${body.sentDate}`     : "",
      "", "📮 등기우편이 발송되었습니다.",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "hold_registered") {
    // 보류 등록 즉시 → 전체 수신자에게 발송
    const scheduledDate = body.scheduledAt
      ? new Date(body.scheduledAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
      : "-";
    return [
      "[HD현대(부산/경남) 보류 등록]",
      "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      `영업: ${salesRep ?? "-"}`,
      "",
      `⏰ 재통화 예정: ${scheduledDate}`,
      body.holdNote       ? `메모: ${body.holdNote}`                   : "",
      body.recipientNames ? `알림 수신: ${body.recipientNames}` : "",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "hold_reminder") {
    // 예약 시간 도달 → 선택된 수신자에게만 발송
    return [
      "[HD현대(부산/경남) 재통화 알림]",
      "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      `영업: ${salesRep ?? "-"}`,
      `현재단계: ${body.currentStatus ?? "-"}`,
      "",
      "📞 재통화 예정 시간입니다.",
      body.holdNote ? `메모: ${body.holdNote}` : "",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  throw new Error(`알 수 없는 type: ${type}`);
}

// ─────────────────────────────────────────────
// 메인 서버
// ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body    = await req.json() as Record<string, string>;
    const message = buildMessage(body);
    console.log("[SMS 발송]:", message.slice(0, 80));

    // 나르미 타입은 나르미 전용 수신자로 발송
    const isNarumi = typeof body.type === "string" && body.type.startsWith("narumi");

    // hold_registered: 전체 수신자 발송
    // hold_reminder: 선택된 수신자(recipientIds)에만 발송
    if (body.type === "hold_reminder") {
      const ids: string[] = Array.isArray((body as any).recipientIds)
        ? (body as any).recipientIds
        : JSON.parse((body as any).recipientIds ?? "[]");
      await sendSmsToIds(message, ids);
      return new Response(
        JSON.stringify({ success: true, recipients: ids }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    await sendSms(message, isNarumi ? NARUMI_RECIPIENTS : RECIPIENTS);

    return new Response(
      JSON.stringify({ success: true, recipients: isNarumi ? NARUMI_RECIPIENTS : RECIPIENTS }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[SMS 오류]:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});