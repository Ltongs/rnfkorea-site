// supabase/functions/send-hyundaicm-kakao/index.ts
// 발송 방식: 솔라피 SMS
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
      body.vin          ? `VIN: ${body.vin}`                    : "",
      customerName      ? `고객: ${customerName}`               : "",
      salesRep          ? `영업: ${salesRep}`                   : "",
      body.deliveryDate ? `출고일: ${body.deliveryDate}`        : "",
      body.specialNote  ? `특이사항: ${body.specialNote}`       : "",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "narumi_status") {
    const isHold   = body.nextStatus === "보류";
    const isUnhold = body.nextStatus === "보류해제";
    const header   = isHold ? "[나르미 보류]" : isUnhold ? "[나르미 보류해제]" : "[나르미 단계 변경]";
    return [
      header, "",
      body.vin     ? `VIN: ${body.vin}`           : "",
      customerName ? `고객: ${customerName}`       : "",
      salesRep     ? `영업: ${salesRep}`           : "",
      !isHold && !isUnhold ? `상태: ${statusKo[body.prevStatus] ?? body.prevStatus ?? "-"} → ${statusKo[body.nextStatus] ?? body.nextStatus ?? "-"}` : "",
      isHold && body.holdReason ? `사유: ${body.holdReason}` : "",
      isHold && body.nextFollowupDate ? `재확인: ${body.nextFollowupDate}` : "",
      `시간: ${now}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "narumi_vehicle_doc") {
    return [
      "[나르미 차량등록증 업로드]", "",
      body.vin     ? `VIN: ${body.vin}`   : "",
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

  // edit 타입 (변경사항 상세 포함)
  if (type === "edit") {
    return [
      "[HD현대(부산/경남) 할부 정보 수정]", "",
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

  // ── 타이어/배터리 발주 전달 (진흥 알림톡) ──────────────────
  if (type === "order_forwarded") {
    return [
      "[담당자님, 사내 업무용 메시지]",
      "RNF 타이어 발주 전달 안내",
      "",
      `주문번호: ${body.orderNo ?? "-"}`,
      `고객사: ${body.customerName ?? "-"}`,
      `품목: ${body.productSpec ?? "-"}`,
      `수량: ${body.quantity ?? "-"}`,
      `전달시간: ${now}`,
      "",
      "담당자가 (주)진흥으로 발주 전달 시",
      "자동 발송되는 사내 업무 알림입니다.",
    ].filter(Boolean).join("\n");
  }

  throw new Error("type은 'new' 또는 'status_change' 이어야 합니다.");
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

    // ── 타이어/배터리 발주 알림톡 (진흥 전용) ─────────────────
    if (body.type === "order_forwarded") {
      const JINHEUNG_PHONE = (Deno.env.get("JINHEUNG_PHONE") ?? "").replace(/\D/g, "");
      const PF_ID          = Deno.env.get("SOLAPI_PF_ID") ?? "";
      const TEMPLATE_ID    = Deno.env.get("SOLAPI_TEMPLATE_ID_ORDER") ?? "";

      if (!JINHEUNG_PHONE) {
        return new Response(JSON.stringify({ error: "JINHEUNG_PHONE 미설정" }), {
          status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const authHeader = await getSolapiAuthHeader();
      const alimRes = await fetch("https://api.solapi.com/messages/v4/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          message: {
            to:   JINHEUNG_PHONE,
            from: SENDER_PHONE,
            kakaoOptions: {
              pfId:       PF_ID,
              templateId: TEMPLATE_ID,
              variables: {
                "#{주문번호}": body.orderNo      ?? "-",
                "#{고객사}":   body.customerName ?? "-",
                "#{품목}":     body.productSpec  ?? "-",
                "#{수량}":     body.quantity     ?? "-",
                "#{전달시간}": new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
                "#{물품발송URL}": body.deliveredUrl ?? "",
              },
              buttons: body.deliveredUrl ? [
                {
                  buttonType: "WL",
                  buttonName: "물품발송",
                  linkMo:     body.deliveredUrl,
                  linkPc:     body.deliveredUrl,
                },
                {
                  buttonType: "WL",
                  buttonName: "업무 페이지 열기",
                  linkMo:     "https://rnfkorea.co.kr/work/secretary",
                  linkPc:     "https://rnfkorea.co.kr/work/secretary",
                },
              ] : undefined,
            },
          },
        }),
      });

      if (!alimRes.ok) {
        const err = await alimRes.text();
        console.error("알림톡 발송 오류:", err);
        // 알림톡 실패 시 SMS로 폴백
        const smsText = buildMessage(body);
        await sendSms(smsText, [JINHEUNG_PHONE]);
      } else {
        console.log("알림톡 발송 성공:", body.orderNo);
      }

      return new Response(
        JSON.stringify({ success: true, type: "order_forwarded" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const message = buildMessage(body);
    console.log("[SMS 발송]:", message.slice(0, 80));

    // 나르미 타입은 나르미 전용 수신자로 발송
    const isNarumi = typeof body.type === "string" && body.type.startsWith("narumi");
    await sendSms(message, isNarumi ? NARUMI_RECIPIENTS : RECIPIENTS);

    // ── 신규 접수 시 자동 등록 ─────────────────────────────
    if (body.type === "new") {
      try {
        const sbUrl = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
        const sbKey = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const db = createClient(sbUrl, sbKey);

        const today = new Date();
        const todayIso = today.toISOString().slice(0, 10);

        // 내일 날짜 계산 (팔로업 기본 D+1)
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

        // 1. secretary_schedules에 팔로업 일정 생성
        await db.from("secretary_schedules").insert({
          title:         schedTitle,
          description:   schedDesc,
          schedule_date: tomorrowIso,
          start_time:    "09:00",
          category:      "followup",
          related_type:  "finance",
        });

        // 1-2. secretary_todos에 할일 자동 생성
        await db.from("secretary_todos").insert({
          title:       `${body.customerName} (신규접수)`,
          description: schedDesc,
          priority:    "urgent",
          category:    "finance",
          is_done:     false,
        });

        // 2. secretary_chat_logs에 알림 메시지 추가
        const chatMsg = [
          `🏗 **현대건설기계 신규 접수 알림**`,
          ``,
          `**${body.customerName}** (${body.customerType ?? "-"}) 고객이 신규 접수되었습니다.`,
          `케이스번호: ${body.caseNo ?? "-"}`,
          `장비: ${body.equipmentTon ?? "-"} / 금융사: ${body.financeCompany ?? "-"}`,
          body.installmentPrincipal ? `할부원금: ${Number(body.installmentPrincipal).toLocaleString("ko-KR")}원` : "",
          ``,
          `📅 내일(${tomorrowIso}) 팔로업 일정이 자동 등록되었습니다.`,
        ].filter(Boolean).join("\n");

        await db.from("secretary_chat_logs").insert({
          role:       "assistant",
          content:    chatMsg,
          session_id: "main",
        });

        console.log("[자동등록] 팔로업 일정 + 채팅 알림 등록 완료:", body.customerName);
      } catch (autoErr) {
        console.error("[자동등록 오류]:", autoErr);
        // 자동 등록 실패해도 SMS 발송은 성공 처리
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
          body.vin          ? `VIN: ${body.vin}`              : "",
          body.customerName ? `고객: ${body.customerName}`     : "",
          body.salesRep     ? `영업: ${body.salesRep}`         : "",
          body.deliveryDate ? `출고일: ${body.deliveryDate}`   : "",
          body.specialNote  ? `특이사항: ${body.specialNote}`  : "",
        ].filter(Boolean).join(" / ");

        await db.from("secretary_todos").insert({
          title:    todoTitle,
          description: desc,
          priority: "normal",
          category: "finance",
          is_done:  false,
        });

        // 채팅 알림
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

        const custName = body.customerName ?? body.vin ?? "";
        const nextSt   = body.nextStatus ?? "";

        // 단계 한글 매핑
        const stageKo: Record<string,string> = {
          todo: "신규등록", insurance: "보험완료", docs: "등록서류",
          registered: "등록완료", completed: "차량등록증 완료",
        };
        const stageLabel = stageKo[nextSt] ?? nextSt;
        const newTitle   = `${custName} (나르미 ${stageLabel})`;

        // 기존 할일 찾기
        const { data: existing } = await db.from("secretary_todos")
          .select("id")
          .ilike("title", `%${custName}%나르미%`)
          .eq("is_done", false)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existing && existing.length > 0) {
          // 완료 단계면 할일 완료 처리, 아니면 제목 업데이트
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
        const today = new Date();

        if (nextStatus === "인센티브지급") {
          // 기존 할일 완료 처리
          const { data: existingTodos } = await db.from("secretary_todos")
            .select("id").ilike("title", `%${customerName}%`).eq("is_done", false);
          if (existingTodos && existingTodos.length > 0) {
            await db.from("secretary_todos")
              .update({ is_done: true })
              .in("id", existingTodos.map((t: any) => t.id));
          }
        } else {
          // 단계별 할일 제목/우선순위/마감일 정의
          const stageMap: Record<string, { title: string; priority: string }> = {
            "신용조회":    { title: "신용조회 중",           priority: "normal"  },
            "보완":        { title: "보완서류 징구",          priority: "urgent"  },
            "승인":        { title: "승인 - 서류등록 진행",   priority: "urgent"  },
            "보류":        { title: "보류 - 재통화 예약",     priority: "normal"  },
            "거절":        { title: "거절 - 고객 안내",       priority: "normal"  },
            "서류등록":    { title: "서류등록 완료 확인",     priority: "normal"  },
            "전자계약발송":{ title: "전자계약 발송 완료",     priority: "normal"  },
            "확정":        { title: "확정완료",               priority: "normal"  },
          };
          const stage = stageMap[nextStatus];
          if (stage) {
            const newTitle = `${customerName} (${nextStatus})`;
            const desc = `케이스: ${caseNo ?? "-"} / ${customerName} → ${nextStatus}`;

            // 기존 할일 찾기
            const { data: existing } = await db.from("secretary_todos")
              .select("id").ilike("title", `%${customerName}%`)
              .eq("is_done", false).order("created_at", { ascending: false }).limit(1);

            if (existing && existing.length > 0) {
              // 기존 할일 업데이트
              await db.from("secretary_todos").update({
                title:       newTitle,
                description: desc,
                priority:    stage.priority,
              }).eq("id", existing[0].id);
            } else {
              // 없으면 신규 생성
              await db.from("secretary_todos").insert({
                title:       newTitle,
                description: desc,
                priority:    stage.priority,
                category:    "finance",
                is_done:     false,
              });
            }

            // secretary_chat_logs에 알림
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
    console.error("[SMS 오류]:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});