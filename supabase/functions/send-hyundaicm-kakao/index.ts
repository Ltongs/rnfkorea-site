// @ts-nocheck -- Deno Edge Function: npm/Deno 환경 타입 충돌 회피용 (Deno.env, esm.sh 외부 모듈 등)
// supabase/functions/send-hyundaicm-kakao/index.ts
// 발송 방식: 솔라피 카카오 알림톡 (HCM + 나르미) + SMS fallback
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── 솔라피 환경변수 ─────────────────────────────────────────
const SOLAPI_API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
const SENDER_PHONE      = Deno.env.get("SOLAPI_SENDER")     ?? "01050549006";

// 현대건설기계 수신자
const RECIPIENTS_RAW = Deno.env.get("SMS_RECIPIENTS") ?? "01050549006,01095250707,01079310339";
const RECIPIENTS     = RECIPIENTS_RAW.split(",").map((n) => n.replace(/\D/g, ""));

// 나르미 전용 수신자
const NARUMI_RECIPIENTS_RAW = Deno.env.get("NARUMI_SMS_RECIPIENTS") ?? "01050549006,01020793025";
const NARUMI_RECIPIENTS     = NARUMI_RECIPIENTS_RAW.split(",").map((n) => n.replace(/\D/g, ""));

// ─── HCM 카카오 알림톡 설정 ──────────────────────────────────
const HCM_PF_ID = "KA01PF2606081346516718bsSRTnA56x";

const HCM_TEMPLATES: Record<string, string> = {
  hcm_new:           "KA01TP260609091445221AOdtfTbbsGO",
  hcm_status_change: "KA01TP260609091600912cEbCHAjsgUP",
  hcm_approved:      "KA01TP260609091806000Fwiohd73qph",
  hcm_supplement:    "KA01TP260609092113814wrSSmhagB3C",
  hcm_rejected:      "KA01TP2606090922333040QHg4njNmPe",
  hcm_confirmed:     "KA01TP2606090923441649N77jcSG6M5",
  hcm_edit:          "KA01TP260609092454633U0Fz7Y3y3w3",
  hcm_hold:          "KA01TP260609092613418qpVKMtVrWVU",
};

const HCM_PAGE_URL = "https://rnfkorea.co.kr/hyundaicm";

// ─── 나르미 카카오 알림톡 설정 ────────────────────────────────
const NARUMI_PF_ID = "KA01PF2606081346516718bsSRTnA56x"; // HCM과 동일 채널

const NARUMI_TEMPLATES: Record<string, string> = {
  narumi_new:         "KA01TP260610065002744WoXoJO3vP35",
  narumi_status:      "KA01TP260610070601887WFMBHMT7oV5",
  narumi_hold:        "KA01TP260610070700598AHO1bQh0PWS",
  narumi_vehicle_doc: "KA01TP260610070803879LDAIVfOpMcs",
};

const NARUMI_PAGE_URL = "https://rnfkorea.co.kr/narumi";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── 주문번호 포맷 (YYMMDD-순번) ─────────────────────────────
// tb_orders.id(uuid)를 받아서, 해당 주문이 등록된 날짜(KST 기준)와
// 그날 몇 번째로 등록된 주문인지를 조회해 "YYMMDD-001" 형식으로 변환한다.
// 조회에 실패하거나 uuid 형식이 아니면 원본 값을 그대로 반환한다.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function formatOrderNo(rawOrderNo: string | undefined | null): Promise<string> {
  const fallback = rawOrderNo ?? "-";
  if (!rawOrderNo || !UUID_RE.test(rawOrderNo)) return fallback;

  try {
    const sbUrl = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const sbKey = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const db = createClient(sbUrl, sbKey);

    const { data: orderRow, error: orderErr } = await db
      .from("tb_orders")
      .select("created_at")
      .eq("id", rawOrderNo)
      .maybeSingle();
    if (orderErr || !orderRow?.created_at) return fallback;

    const createdAt  = new Date(orderRow.created_at);
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const kst        = new Date(createdAt.getTime() + KST_OFFSET);

    const yy = String(kst.getUTCFullYear() % 100).padStart(2, "0");
    const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(kst.getUTCDate()).padStart(2, "0");

    // 해당 날짜(KST)의 00:00 ~ 24:00 구간을 UTC 범위로 환산
    const dayStartUTC = new Date(
      Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET
    );
    const dayEndUTC = new Date(dayStartUTC.getTime() + 24 * 60 * 60 * 1000);

    const { count, error: countErr } = await db
      .from("tb_orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayStartUTC.toISOString())
      .lt("created_at", dayEndUTC.toISOString())
      .lte("created_at", orderRow.created_at);
    if (countErr || !count) return `${yy}${mm}${dd}-001`;

    const seq = String(count).padStart(3, "0");
    return `${yy}${mm}${dd}-${seq}`;
  } catch {
    return fallback;
  }
}

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
    console.error("솔라피 SMS 오류:", err);
    throw new Error(`SMS 발송 실패: ${err}`);
  }
  console.log("솔라피 SMS 결과:", JSON.stringify(await res.json()));
}

// ─── HCM 알림톡 단건 발송 ────────────────────────────────────
async function sendHcmAlimtalk(
  to: string,
  templateId: string,
  variables: Record<string, string>,
  fallbackText: string,
): Promise<void> {
  const authHeader = await getSolapiAuthHeader();
  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      message: {
        to,
        from: SENDER_PHONE,
        kakaoOptions: {
          pfId:       HCM_PF_ID,
          templateId,
          variables,
          disableSms: false,
          buttons: [{
            buttonType: "WL",
            buttonName: "업무 페이지 열기",
            linkMo:     HCM_PAGE_URL,
            linkPc:     HCM_PAGE_URL,
          }],
        },
        text: fallbackText,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`HCM 알림톡 오류 (${to}):`, err);
    throw new Error(`알림톡 발송 실패: ${err}`);
  }
  console.log(`HCM 알림톡 발송 성공 (${to}):`, templateId);
}

// ─── HCM 알림톡 전체 수신자 발송 ─────────────────────────────
async function sendHcmAlimtalkToAll(
  templateKey: string,
  variables: Record<string, string>,
  fallbackText: string,
): Promise<void> {
  const templateId = HCM_TEMPLATES[templateKey];
  if (!templateId) throw new Error(`HCM 템플릿 키 없음: ${templateKey}`);
  await Promise.all(
    RECIPIENTS.map((to) => sendHcmAlimtalk(to, templateId, variables, fallbackText))
  );
}

// ─── 나르미 알림톡 단건 발송 ───────────────────────────────────
async function sendNarumiAlimtalk(
  to: string,
  templateId: string,
  variables: Record<string, string>,
  fallbackText: string,
): Promise<void> {
  const authHeader = await getSolapiAuthHeader();
  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      message: {
        to,
        from: SENDER_PHONE,
        kakaoOptions: {
          pfId:       NARUMI_PF_ID,
          templateId,
          variables,
          disableSms: false,
          buttons: [{
            buttonType: "WL",
            buttonName: "업무 페이지 열기",
            linkMo:     NARUMI_PAGE_URL,
            linkPc:     NARUMI_PAGE_URL,
          }],
        },
        text: fallbackText,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`나르미 알림톡 오류 (${to}):`, err);
    throw new Error(`나르미 알림톡 발송 실패: ${err}`);
  }
  console.log(`나르미 알림톡 발송 성공 (${to}):`, templateId);
}

// ─── 나르미 알림톡 전체 수신자 발송 ──────────────────────────
async function sendNarumiAlimtalkToAll(
  templateKey: string,
  variables: Record<string, string>,
  fallbackText: string,
): Promise<void> {
  const templateId = NARUMI_TEMPLATES[templateKey];
  if (!templateId) throw new Error(`나르미 템플릿 키 없음: ${templateKey}`);
  await Promise.all(
    NARUMI_RECIPIENTS.map((to) => sendNarumiAlimtalk(to, templateId, variables, fallbackText))
  );
}

// ─── 진흥 알림톡 단건 발송 (배송완료/휠반납 등 버튼 포함) ────
async function sendJinheungAlimtalk(
  to: string,
  templateId: string,
  variables: Record<string, string>,
  buttons: Array<Record<string, string>>,
): Promise<{ ok: boolean; err?: string }> {
  const authHeader = await getSolapiAuthHeader();
  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      message: {
        to,
        from: SENDER_PHONE,
        kakaoOptions: {
          pfId:       Deno.env.get("SOLAPI_PF_ID") ?? "",
          templateId,
          variables,
          disableSms: false,
          buttons,
        },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`진흥 알림톡 오류 (${to}):`, err);
    return { ok: false, err };
  }
  console.log(`진흥 알림톡 발송 성공 (${to})`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// 나르미 알림톡 변수 빌더
// ─────────────────────────────────────────────
function buildNarumiVariables(body: Record<string, string>): { templateKey: string; variables: Record<string, string> } {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const { type, customerName, salesRep } = body;

  if (type === "narumi_new") {
    return {
      templateKey: "narumi_new",
      variables: {
        "#{VIN}":      body.vin          ?? "-",
        "#{고객명}":   customerName      ?? "-",
        "#{영업사원}": salesRep          ?? "-",
        "#{출고일}":   body.deliveryDate ?? "-",
        "#{특이사항}": body.specialNote  ?? "-",
        "#{시간}":     now,
      },
    };
  }

  if (type === "narumi_status") {
    const isHold   = body.nextStatus === "보류";
    const isUnhold = body.nextStatus === "보류해제";
    const statusKo: Record<string, string> = {
      todo: "보류", insurance: "보험", docs: "등록서류",
      registered: "등록완료", completed: "차량등록증 완료",
    };

    if (isHold) {
      return {
        templateKey: "narumi_hold",
        variables: {
          "#{VIN}":      body.vin            ?? "-",
          "#{고객명}":   customerName        ?? "-",
          "#{보류사유}": body.holdReason     ?? "-",
          "#{재확인일}": body.nextFollowupDate ?? "-",
          "#{영업사원}": salesRep            ?? "-",
          "#{시간}":     now,
        },
      };
    }

    return {
      templateKey: "narumi_status",
      variables: {
        "#{VIN}":      body.vin ?? "-",
        "#{고객명}":   customerName ?? "-",
        "#{이전단계}": statusKo[body.prevStatus] ?? body.prevStatus ?? "-",
        "#{현재단계}": isUnhold ? "보류해제" : (statusKo[body.nextStatus] ?? body.nextStatus ?? "-"),
        "#{영업사원}": salesRep ?? "-",
        "#{시간}":     now,
      },
    };
  }

  if (type === "narumi_vehicle_doc") {
    return {
      templateKey: "narumi_vehicle_doc",
      variables: {
        "#{VIN}":      body.vin      ?? "-",
        "#{고객명}":   customerName  ?? "-",
        "#{영업사원}": salesRep      ?? "-",
        "#{시간}":     now,
      },
    };
  }

  // narumi_insurance_confirmed, narumi_postal → narumi_status 템플릿 재활용
  if (type === "narumi_insurance_confirmed") {
    return {
      templateKey: "narumi_status",
      variables: {
        "#{VIN}":      body.vin     ?? "-",
        "#{고객명}":   customerName ?? "-",
        "#{이전단계}": "-",
        "#{현재단계}": "보험확인완료",
        "#{영업사원}": salesRep ?? "-",
        "#{시간}":     now,
      },
    };
  }

  throw new Error(`나르미 알림톡 변수 빌더: 알 수 없는 type: ${type}`);
}

// ─────────────────────────────────────────────
// SMS fallback 메시지 빌더
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
          body.loanLimit && body.loanLimit !== "-"
            ? `대출한도: ${isNaN(Number(body.loanLimit)) ? body.loanLimit : Number(body.loanLimit).toLocaleString("ko-KR") + "원"}`
            : "",
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

  if (type === "edit") {
    return [
      "[HD현대(부산/경남) 할부 정보 수정]", "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `현재단계: ${prevStatus ?? "-"}`,
      `영업: ${salesRep ?? "-"}`, "",
      "── 변경사항 ──",
      body.changedSummary ?? "변경사항 없음", "",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "credit_condition_updated") {
    const v = body.vehicleAmount ? Number(body.vehicleAmount) : null;
    const a = body.attachAmount  ? Number(body.attachAmount)  : null;
    const totalVehicle = (v ?? 0) + (a ?? 0);
    const g = body.gracePeriod ?? null;
    const inst = body.installmentPeriod ?? null;
    return [
      "[HD현대(부산/경남) 승인조건 수정]", "",
      `번호: ${caseNo ?? "-"}`,
      `고객: ${customerName} (${customerType})`,
      `장비: ${equipmentTon ?? "-"}`,
      `영업: ${salesRep ?? "-"}`, "",
      "── 수정된 승인조건 ──",
      totalVehicle > 0 ? `차량가격: ${totalVehicle.toLocaleString("ko-KR")}원${v && a ? ` (차량 ${v.toLocaleString("ko-KR")} + 어태치 ${a.toLocaleString("ko-KR")})` : ""}` : null,
      body.loanLimit && body.loanLimit !== "-"
        ? `대출한도: ${isNaN(Number(body.loanLimit)) ? body.loanLimit : Number(body.loanLimit).toLocaleString("ko-KR") + "원"}`
        : null,
      `대출기간: ${body.loanPeriod ?? "-"}개월${g && inst ? ` (거치 ${g} + 할부 ${inst})` : ""}`,
      `적용금리: ${body.creditRate ?? "-"}%`,
      body.creditIncentive ? `인센티브: ${body.creditIncentive}%` : null,
      body.creditNote ? `특이사항: ${body.creditNote}` : null, "",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

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

  // ─── 나르미 메시지 타입 ───────────────────────────
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
      customerName      ? `고객: ${customerName}`        : "",
      salesRep          ? `영업: ${salesRep}`            : "",
      body.deliveryDate ? `출고일: ${body.deliveryDate}` : "",
      body.specialNote  ? `특이사항: ${body.specialNote}`: "",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "narumi_status") {
    const isHold   = body.nextStatus === "보류";
    const isUnhold = body.nextStatus === "보류해제";
    const header   = isHold ? "[나르미 보류]" : isUnhold ? "[나르미 보류해제]" : "[나르미 단계 변경]";
    return [
      header, "",
      body.vin     ? `VIN: ${body.vin}`     : "",
      customerName ? `고객: ${customerName}`: "",
      salesRep     ? `영업: ${salesRep}`    : "",
      !isHold && !isUnhold ? `상태: ${statusKo[body.prevStatus] ?? body.prevStatus ?? "-"} → ${statusKo[body.nextStatus] ?? body.nextStatus ?? "-"}` : "",
      isHold && body.holdReason       ? `사유: ${body.holdReason}`         : "",
      isHold && body.nextFollowupDate ? `재확인: ${body.nextFollowupDate}` : "",
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

  // ── 나르미 등록완료 ─────────────────────────────────────
  if (type === "narumi_status" && (body.nextStatus === "registered" || body.nextStatus === "등록완료")) {
    return [
      "[나르미 등록완료]", "",
      body.vin     ? `VIN: ${body.vin}`      : "",
      customerName ? `고객: ${customerName}` : "",
      salesRep     ? `영업: ${salesRep}`     : "",
      "", "✅ 차량 등록이 완료되었습니다.",
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

  // edit 타입 중복 방지용 (buildMessage 하단 도달 시)
  if (type === "order_forwarded") {
    return [
      "[담당자님, 사내 업무용 메시지]",
      "RNF 타이어 발주 전달 안내", "",
      `주문번호: ${body.orderNo ?? "-"}`,
      `고객사: ${body.customerName ?? "-"}`,
      `품목: ${body.productSpec ?? "-"}`,
      `수량: ${body.quantity ?? "-"}`,
      `전달시간: ${now}`, "",
      "담당자가 (주)진흥으로 발주 전달 시",
      "자동 발송되는 사내 업무 알림입니다.",
    ].filter(Boolean).join("\n");
  }

  throw new Error(`알 수 없는 type: ${type}`);
}

// ─────────────────────────────────────────────
// HCM 알림톡 변수 빌더
// ─────────────────────────────────────────────
function buildHcmVariables(body: Record<string, string>): { templateKey: string; variables: Record<string, string> } {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const {
    type, caseNo, customerName, customerType, equipmentTon,
    financeCompany, salesRep, installmentPrincipal,
    purchaseAmount, interestRate, incentive,
    vatDeferredAmount, loanPeriod, prevStatus, nextStatus,
  } = body;

  if (type === "new") {
    return {
      templateKey: "hcm_new",
      variables: {
        "#{케이스번호}": caseNo         ?? "-",
        "#{고객명}":     customerName   ?? "-",
        "#{고객유형}":   customerType   ?? "-",
        "#{장비톤수}":   equipmentTon   ?? "-",
        "#{금융사}":     financeCompany ?? "-",
        "#{할부원금}":   installmentPrincipal
          ? `${Number(installmentPrincipal).toLocaleString("ko-KR")}원` : "-",
        "#{영업사원}":   salesRep ?? "-",
        "#{시간}":       now,
      },
    };
  }

  if (type === "status_change" && nextStatus === "확정") {
    const purchase  = purchaseAmount       ? Number(purchaseAmount)       : null;
    const principal = installmentPrincipal ? Number(installmentPrincipal) : null;
    const downRate  = (purchase && principal)
      ? `${(((purchase - principal) / purchase) * 100).toFixed(1)}%` : "-";
    return {
      templateKey: "hcm_confirmed",
      variables: {
        "#{케이스번호}": caseNo         ?? "-",
        "#{고객명}":     customerName   ?? "-",
        "#{고객유형}":   customerType   ?? "-",
        "#{장비톤수}":   equipmentTon   ?? "-",
        "#{금융사}":     financeCompany ?? "-",
        "#{차량가격}":   purchase  ? purchase.toLocaleString("ko-KR")  : "-",
        "#{할부원금}":   principal ? principal.toLocaleString("ko-KR") : "-",
        "#{선수율}":     downRate,
        "#{금리}":       interestRate ?? "-",
        "#{인센티브}":   incentive    ?? "-",
        "#{부가세후불}": vatDeferredAmount
          ? Number(vatDeferredAmount).toLocaleString("ko-KR") : "-",
        "#{대출기간}":   loanPeriod   ?? "-",
        "#{영업사원}":   salesRep     ?? "-",
        "#{시간}":       now,
      },
    };
  }

  if (type === "status_change" && nextStatus === "승인") {
    return {
      templateKey: "hcm_approved",
      variables: {
        "#{케이스번호}":   caseNo         ?? "-",
        "#{고객명}":       customerName   ?? "-",
        "#{고객유형}":     customerType   ?? "-",
        "#{장비톤수}":     equipmentTon   ?? "-",
        "#{업력}":         body.bizHistory      ?? "-",
        "#{NICE점수}":     body.niceScore        ?? "-",
        "#{적용금리}":     body.creditRate        ?? "-",
        "#{적용인센티브}": body.creditIncentive   ?? "-",
        "#{대출한도}":     body.loanLimit && body.loanLimit !== "-"
          ? (isNaN(Number(body.loanLimit))
              // 이미 "174,240,000원" 형태 → 끝에 "원" 제거 후 반환 (템플릿에 원이 있는 경우 대비)
              ? body.loanLimit.replace(/원+$/, "")
              : Number(body.loanLimit).toLocaleString("ko-KR"))
          : "-",
        "#{특이사항}":     body.creditNote  ?? "-",
        "#{영업사원}":     salesRep         ?? "-",
        "#{시간}":         now,
      },
    };
  }

  if (type === "status_change" && nextStatus === "보완") {
    return {
      templateKey: "hcm_supplement",
      variables: {
        "#{케이스번호}": caseNo         ?? "-",
        "#{고객명}":     customerName   ?? "-",
        "#{고객유형}":   customerType   ?? "-",
        "#{장비톤수}":   equipmentTon   ?? "-",
        "#{업력}":       body.bizHistory  ?? "-",
        "#{NICE점수}":   body.niceScore    ?? "-",
        "#{적용금리}":   body.creditRate    ?? "-",
        "#{보완사항}":   body.creditNote    ?? "-",
        "#{영업사원}":   salesRep           ?? "-",
        "#{시간}":       now,
      },
    };
  }

  if (type === "status_change" && nextStatus === "거절") {
    return {
      templateKey: "hcm_rejected",
      variables: {
        "#{케이스번호}": caseNo       ?? "-",
        "#{고객명}":     customerName ?? "-",
        "#{고객유형}":   customerType ?? "-",
        "#{장비톤수}":   equipmentTon ?? "-",
        "#{거절사유}":   body.creditNote ?? "-",
        "#{영업사원}":   salesRep        ?? "-",
        "#{시간}":       now,
      },
    };
  }

  if (type === "status_change") {
    // 신용조회, 서류등록, 전자계약발송, 보류 등 일반 단계변경
    return {
      templateKey: "hcm_status_change",
      variables: {
        "#{케이스번호}": caseNo         ?? "-",
        "#{고객명}":     customerName   ?? "-",
        "#{고객유형}":   customerType   ?? "-",
        "#{장비톤수}":   equipmentTon   ?? "-",
        "#{금융사}":     financeCompany ?? "-",
        "#{할부원금}":   installmentPrincipal
          ? `${Number(installmentPrincipal).toLocaleString("ko-KR")}원` : "-",
        "#{이전단계}":   prevStatus ?? "-",
        "#{현재단계}":   nextStatus ?? "-",
        "#{영업사원}":   salesRep   ?? "-",
        "#{시간}":       now,
      },
    };
  }

  if (type === "edit") {
    return {
      templateKey: "hcm_edit",
      variables: {
        "#{케이스번호}": caseNo       ?? "-",
        "#{고객명}":     customerName ?? "-",
        "#{고객유형}":   customerType ?? "-",
        "#{현재단계}":   prevStatus   ?? "-",
        "#{영업사원}":   salesRep     ?? "-",
        "#{변경사항}":   body.changedSummary ?? "변경사항 없음",
        "#{시간}":       now,
      },
    };
  }

  if (type === "credit_condition_updated") {
    const v = body.vehicleAmount ? Number(body.vehicleAmount) : null;
    const a = body.attachAmount  ? Number(body.attachAmount)  : null;
    const totalVehicle = (v ?? 0) + (a ?? 0);
    const g = body.gracePeriod ?? null;
    const inst = body.installmentPeriod ?? null;
    const periodText = `${loanPeriod ?? "-"}개월${g && inst ? ` (거치${g}+할부${inst})` : ""}`;
    const summary = [
      totalVehicle > 0 ? `차량가격 ${totalVehicle.toLocaleString("ko-KR")}원${v && a ? `(차량${v.toLocaleString("ko-KR")}+어태치${a.toLocaleString("ko-KR")})` : ""}` : null,
      body.loanLimit ? `대출한도 ${Number(body.loanLimit).toLocaleString("ko-KR")}원` : null,
      `대출기간 ${periodText}`,
      `금리 ${body.creditRate ?? "-"}%`,
      body.creditIncentive ? `인센티브 ${body.creditIncentive}%` : null,
      body.creditNote ? `특이사항: ${body.creditNote}` : null,
    ].filter(Boolean).join(" / ");
    return {
      templateKey: "hcm_edit",
      variables: {
        "#{케이스번호}": caseNo       ?? "-",
        "#{고객명}":     customerName ?? "-",
        "#{고객유형}":   customerType ?? "-",
        "#{현재단계}":   "승인조건 수정",
        "#{영업사원}":   salesRep     ?? "-",
        "#{변경사항}":   summary || "변경사항 없음",
        "#{시간}":       now,
      },
    };
  }

  // vehicle_reg_upload / tax_invoice_upload / incentive_paid → hcm_status_change 재활용
  const typeLabel: Record<string, string> = {
    vehicle_reg_upload: "차량등록증 업로드",
    tax_invoice_upload: "세금계산서 업로드",
    incentive_paid:     "인센티브 지급",
  };
  if (typeLabel[type]) {
    return {
      templateKey: "hcm_status_change",
      variables: {
        "#{케이스번호}": caseNo         ?? "-",
        "#{고객명}":     customerName   ?? "-",
        "#{고객유형}":   customerType   ?? "-",
        "#{장비톤수}":   equipmentTon   ?? "-",
        "#{금융사}":     financeCompany ?? "-",
        "#{할부원금}":   installmentPrincipal
          ? `${Number(installmentPrincipal).toLocaleString("ko-KR")}원` : "-",
        "#{이전단계}":   prevStatus      ?? "-",
        "#{현재단계}":   typeLabel[type],
        "#{영업사원}":   salesRep        ?? "-",
        "#{시간}":       now,
      },
    };
  }

  throw new Error(`HCM 알림톡 변수 빌더: 알 수 없는 type: ${type}`);
}

// ─────────────────────────────────────────────
// 메인 서버
// ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json() as Record<string, string>;

    // ── Supabase 클라이언트 (큐 조작용) ──────────────────────────
    const sbUrl = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const sbKey = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const db = createClient(sbUrl, sbKey);

    // ── 진흥 알림톡 실제 발송 헬퍼 (flush_queue에서도 재사용) ────
    const sendJinheungNow = async (q: Record<string, string>) => {
      q.orderNo = await formatOrderNo(q.orderNo);
      const JINHEUNG_PHONES = (Deno.env.get("JINHEUNG_PHONE") ?? "")
        .split(",").map((n) => n.replace(/\D/g, "")).filter(Boolean);
      if (JINHEUNG_PHONES.length === 0) throw new Error("JINHEUNG_PHONE 미설정");

      if (q.type === "order_forwarded") {
        const TEMPLATE_ID = Deno.env.get("SOLAPI_TEMPLATE_ID_ORDER") ?? "";
        const variables = {
          "#{주문번호}": q.orderNo      ?? "-",
          "#{고객사}":   q.customerName ?? "-",
          "#{품목}":     q.productSpec  ?? "-",
          "#{수량}":     q.quantity     ?? "-",
          "#{전달시간}": new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        };
        const buttons = [
          ...(q.deliveredUrl ? [{ buttonType:"WL", buttonName:"배송완료", linkMo:q.deliveredUrl, linkPc:q.deliveredUrl }] : []),
          { buttonType:"WL", buttonName:"업무 페이지", linkMo:"https://rnfkorea.co.kr/work/secretary", linkPc:"https://rnfkorea.co.kr/work/secretary" },
        ];
        const results = await Promise.all(JINHEUNG_PHONES.map((to) => sendJinheungAlimtalk(to, TEMPLATE_ID, variables, buttons)));
        const failedPhones = JINHEUNG_PHONES.filter((_, i) => !results[i].ok);
        if (failedPhones.length > 0) await sendSms(buildMessage(q), failedPhones);
        console.log("진흥 발주 알림톡 발송:", q.orderNo, "→", JINHEUNG_PHONES.join(","));

      } else if (q.type === "wheel_return_request") {
        const TEMPLATE_ID = Deno.env.get("SOLAPI_TEMPLATE_ID_WHEEL_REQUEST") ?? "";
        const variables = {
          "#{주문번호}": q.orderNo      ?? "-",
          "#{고객사}":   q.customerName ?? "-",
          "#{품목}":     q.productSpec  ?? "-",
          "#{수량}":     q.quantity     ?? "-",
          "#{전달시간}": new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        };
        const buttons = [
          ...(q.wheelReturnedUrl ? [{ buttonType:"WL", buttonName:"휠반납 확인", linkMo:q.wheelReturnedUrl, linkPc:q.wheelReturnedUrl }] : []),
          { buttonType:"WL", buttonName:"업무 페이지", linkMo:"https://rnfkorea.co.kr/work/secretary", linkPc:"https://rnfkorea.co.kr/work/secretary" },
        ];
        const results = await Promise.all(JINHEUNG_PHONES.map((to) => sendJinheungAlimtalk(to, TEMPLATE_ID, variables, buttons)));
        const failedPhones = JINHEUNG_PHONES.filter((_, i) => !results[i].ok);
        if (failedPhones.length > 0) {
          const smsText = ["[담당자님, 사내 업무용 메시지]","RNF 타이어 휠반납 요청 안내","",
            `주문번호: ${q.orderNo ?? "-"}`,`고객사: ${q.customerName ?? "-"}`,
            `품목: ${q.productSpec ?? "-"}`,`수량: ${q.quantity ?? "-"}`,
            `시간: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
          ].join("\n");
          await sendSms(smsText, failedPhones);
        }
        console.log("휠반납 알림톡 발송:", q.orderNo, "→", JINHEUNG_PHONES.join(","));
      }
    };

    // ── flush_queue: pg_cron이 09:00 KST에 호출 → 큐 일괄 발송 ──
    if (body.type === "flush_queue") {
      const { data: items, error } = await db
        .from("pending_kakao_queue")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw new Error(`큐 조회 실패: ${error.message}`);
      if (!items || items.length === 0) {
        return new Response(
          JSON.stringify({ flushed: 0, message: "큐 비어있음" }),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      let flushed = 0;
      for (const item of items) {
        try {
          const q = item.payload as Record<string, string>;
          const qIsJinheung = q.type === "order_forwarded" || q.type === "wheel_return_request";
          const qIsNarumi   = typeof q.type === "string" && q.type.startsWith("narumi");

          if (qIsJinheung) {
            await sendJinheungNow(q);
          } else if (qIsNarumi) {
            if (q.type === "narumi_postal") {
              await sendSms(buildMessage(q), NARUMI_RECIPIENTS);
            } else {
              try {
                const { templateKey, variables } = buildNarumiVariables(q);
                await sendNarumiAlimtalkToAll(templateKey, variables, buildMessage(q));
              } catch {
                await sendSms(buildMessage(q), NARUMI_RECIPIENTS);
              }
            }
          } else {
            const { templateKey, variables } = buildHcmVariables(q);
            await sendHcmAlimtalkToAll(templateKey, variables, buildMessage(q));
          }
          await db.from("pending_kakao_queue").delete().eq("id", item.id);
          flushed++;
          console.log(`[큐 발송] id=${item.id} type=${q.type}`);
        } catch (e) {
          console.error(`[큐 발송 실패] id=${item.id}:`, (e as Error).message);
        }
      }

      return new Response(
        JSON.stringify({ flushed, total: items.length }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ── 업무시간 체크 (KST 09:00~19:00 외 → 큐에 저장) ─────────
    // 모든 타입(진흥 발주·휠반납·HCM·나르미) 동일 적용
    const nowKST  = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const hourKST = nowKST.getUTCHours(); // KST 기준 시각
    const isOffHours = hourKST >= 19 || hourKST < 9; // 19시~익일 09시 보류

    if (isOffHours) {
      const { error: qErr } = await db
        .from("pending_kakao_queue")
        .insert({ payload: body });

      if (qErr) {
        console.error("[큐 저장 실패]:", qErr.message);
        // 큐 저장 실패 시 아래 즉시 발송으로 fall-through
      } else {
        const sendAt = `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth()+1).padStart(2,"0")}-${String(nowKST.getUTCDate()).padStart(2,"0")} 09:00 KST`;
        console.log(`[큐 저장] type=${body.type} → ${sendAt} 발송 예정`);
        return new Response(
          JSON.stringify({ queued: true, send_at: sendAt }),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 업무시간 내 즉시 발송 ────────────────────────────────────
    const isJinheung = body.type === "order_forwarded" || body.type === "wheel_return_request";
    if (isJinheung) {
      await sendJinheungNow(body);
      return new Response(
        JSON.stringify({ success: true, type: body.type }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const isNarumi = typeof body.type === "string" && body.type.startsWith("narumi");

    // ── 나르미: 알림톡 발송 ──────────────────────────────────────
    if (isNarumi) {
      // narumi_postal은 템플릿 없으므로 SMS 유지
      if (body.type === "narumi_postal") {
        const smsText = buildMessage(body);
        console.log("[나르미 우편발송 SMS]:", smsText.slice(0, 80));
        await sendSms(smsText, NARUMI_RECIPIENTS);
      } else {
        try {
          const { templateKey, variables } = buildNarumiVariables(body);
          const fallbackText = buildMessage(body);
          console.log("[나르미 알림톡 발송]:", templateKey);
          await sendNarumiAlimtalkToAll(templateKey, variables, fallbackText);
        } catch (e) {
          // 템플릿 없는 타입은 SMS 폴백
          console.warn("[나르미 알림톡 폴백 SMS]:", (e as Error).message);
          const smsText = buildMessage(body);
          await sendSms(smsText, NARUMI_RECIPIENTS);
        }
      }
    }
    // ── HCM: 알림톡 발송 ─────────────────────────────────────
    else {
      const { templateKey, variables } = buildHcmVariables(body);
      const fallbackText = buildMessage(body);
      console.log("[HCM 알림톡 발송]:", templateKey);
      await sendHcmAlimtalkToAll(templateKey, variables, fallbackText);
    }

    // ── 신규 접수 시 자동 등록 ─────────────────────────────
    if (body.type === "new") {
      try {
        const sbUrl = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
        const sbKey = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const db = createClient(sbUrl, sbKey);

        const today    = new Date();
        const _todayIso = today.toISOString().slice(0, 10);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowIso = tomorrow.toISOString().slice(0, 10);

        const schedTitle = `${body.customerName} (신규접수)`;
        const schedDesc  = [
          `케이스번호: ${body.caseNo ?? "-"}`,
          `고객: ${body.customerName} (${body.customerType ?? "-"})`,
          `장비: ${body.equipmentTon ?? "-"}`,
          `금융사: ${body.financeCompany ?? "-"}`,
          body.installmentPrincipal ? `할부원금: ${Number(body.installmentPrincipal).toLocaleString("ko-KR")}원` : "",
          `영업: ${body.salesRep ?? "-"}`,
        ].filter(Boolean).join(" / ");

        await db.from("secretary_schedules").insert({
          title:         schedTitle,
          description:   schedDesc,
          schedule_date: tomorrowIso,
          start_time:    "09:00",
          category:      "followup",
          related_type:  "finance",
        });

        await db.from("secretary_todos").insert({
          title:       `${body.customerName} (신규접수)`,
          description: schedDesc,
          priority:    "urgent",
          category:    "finance",
          is_done:     false,
        });

        const chatMsg = [
          `🏗 **현대건설기계 신규 접수 알림**`, ``,
          `**${body.customerName}** (${body.customerType ?? "-"}) 고객이 신규 접수되었습니다.`,
          `케이스번호: ${body.caseNo ?? "-"}`,
          `장비: ${body.equipmentTon ?? "-"} / 금융사: ${body.financeCompany ?? "-"}`,
          body.installmentPrincipal ? `할부원금: ${Number(body.installmentPrincipal).toLocaleString("ko-KR")}원` : "",
          ``, `📅 내일(${tomorrowIso}) 팔로업 일정이 자동 등록되었습니다.`,
        ].filter(Boolean).join("\n");

        await db.from("secretary_chat_logs").insert({
          role: "assistant", content: chatMsg, session_id: "main",
        });

        console.log("[자동등록] 팔로업 일정 + 채팅 알림 등록 완료:", body.customerName);
      } catch (autoErr) {
        console.error("[자동등록 오류]:", autoErr);
      }
    }

    // ── 나르미 신규 등록 시 할일 자동 생성 ───────────────────────
    if (body.type === "narumi_new") {
      try {
        const sbUrl = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
        const sbKey = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const db = createClient(sbUrl, sbKey);

        const todoTitle = `${body.customerName ?? body.vin} (나르미 신규등록)`;
        const desc = [
          body.vin          ? `VIN: ${body.vin}`             : "",
          body.customerName ? `고객: ${body.customerName}`   : "",
          body.salesRep     ? `영업: ${body.salesRep}`       : "",
          body.deliveryDate ? `출고일: ${body.deliveryDate}` : "",
          body.specialNote  ? `특이사항: ${body.specialNote}`: "",
        ].filter(Boolean).join(" / ");

        await db.from("secretary_todos").insert({
          title:       todoTitle,
          description: desc,
          priority:    "normal",
          category:    "finance",
          is_done:     false,
        });

        await db.from("secretary_chat_logs").insert({
          role: "assistant",
          content: `🚛 **나르미 신규 등록**\n\n**${body.customerName ?? body.vin}** 신규 등록되었습니다.\nVIN: ${body.vin}\n할일이 자동 등록되었습니다.`,
          session_id: "main",
        });

        console.log("[나르미 할일 생성]:", body.customerName ?? body.vin);
      } catch (e) {
        console.error("[나르미 할일 생성 오류]:", e);
      }
    }

    // ── 나르미 단계 변경 시 할일 업데이트 ────────────────────────
    if (isNarumi && body.type === "narumi_status") {
      try {
        const sbUrl = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
        const sbKey = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const db = createClient(sbUrl, sbKey);

        const custName   = body.customerName ?? body.vin ?? "";
        const nextSt     = body.nextStatus ?? "";
        const stageKo: Record<string, string> = {
          todo: "신규등록", insurance: "보험완료", docs: "등록서류",
          registered: "등록완료", completed: "차량등록증 완료",
        };
        const stageLabel = stageKo[nextSt] ?? nextSt;
        const newTitle   = `${custName} (나르미 ${stageLabel})`;

        const { data: existing } = await db.from("secretary_todos")
          .select("id")
          .ilike("title", `%${custName}%나르미%`)
          .eq("is_done", false)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existing && existing.length > 0) {
          const isDone = nextSt === "completed";
          await db.from("secretary_todos").update({
            title:   newTitle,
            is_done: isDone,
          }).eq("id", existing[0].id);
        }

        console.log("[나르미 할일 업데이트]:", custName, "→", stageLabel);
      } catch (e) {
        console.error("[나르미 할일 업데이트 오류]:", e);
      }
    }

    // ── 상태 변경 시 할일 자동 업데이트 ─────────────────────────
    if (body.type === "status_change" && !isNarumi) {
      try {
        const sbUrl = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
        const sbKey = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const db = createClient(sbUrl, sbKey);

        const { nextStatus, customerName, caseNo } = body;

        if (nextStatus === "인센티브지급") {
          const { data: existingTodos } = await db.from("secretary_todos")
            .select("id").ilike("title", `%${customerName}%`).eq("is_done", false);
          if (existingTodos && existingTodos.length > 0) {
            await db.from("secretary_todos")
              .update({ is_done: true })
              .in("id", existingTodos.map((t: { id: string | number }) => t.id));
          }
        } else {
          const stageMap: Record<string, { title: string; priority: string }> = {
            "신용조회":     { title: "신용조회 중",          priority: "normal" },
            "보완":         { title: "보완서류 징구",         priority: "urgent" },
            "승인":         { title: "승인 - 서류등록 진행",  priority: "urgent" },
            "보류":         { title: "보류 - 재통화 예약",    priority: "normal" },
            "거절":         { title: "거절 - 고객 안내",      priority: "normal" },
            "서류등록":     { title: "서류등록 완료 확인",    priority: "normal" },
            "전자계약발송": { title: "전자계약 발송 완료",    priority: "normal" },
            "확정":         { title: "확정완료",              priority: "normal" },
          };
          const stage = stageMap[nextStatus];
          if (stage) {
            const newTitle = `${customerName} (${nextStatus})`;
            const desc     = `케이스: ${caseNo ?? "-"} / ${customerName} → ${nextStatus}`;

            const { data: existing } = await db.from("secretary_todos")
              .select("id").ilike("title", `%${customerName}%`)
              .eq("is_done", false).order("created_at", { ascending: false }).limit(1);

            if (existing && existing.length > 0) {
              await db.from("secretary_todos").update({
                title:       newTitle,
                description: desc,
                priority:    stage.priority,
              }).eq("id", existing[0].id);
            } else {
              await db.from("secretary_todos").insert({
                title:       newTitle,
                description: desc,
                priority:    stage.priority,
                category:    "finance",
                is_done:     false,
              });
            }

            const chatMsg = `🏗 **현대건설기계 단계 변경**\n\n**${customerName}** (${caseNo ?? "-"}) → **${nextStatus}**\n할일 업데이트: ${newTitle}`;
            await db.from("secretary_chat_logs").insert({
              role: "assistant", content: chatMsg, session_id: "main",
            });
          }
        }
        console.log("[할일 업데이트] 완료:", nextStatus, customerName);
      } catch (autoErr) {
        console.error("[할일 업데이트 오류]:", autoErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, recipients: isNarumi ? NARUMI_RECIPIENTS : RECIPIENTS }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[오류]:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});