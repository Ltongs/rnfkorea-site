// @ts-nocheck -- Deno Edge Function: npm/Deno 환경 타입 충돌 회피용
// supabase/functions/send-rentalos-kakao/index.ts
// Rental_O/S 신규 딜 등록 시 카카오톡 알림톡(+실패 시 SMS 폴백) 발송.
// 신규 알림톡 템플릿 승인 절차 없이, 태산통운과 동일하게 기존 현대건설기계 채널의
// 승인된 템플릿(hcm_new)을 그대로 재사용한다. 이 템플릿의 항목명(예: "금융사",
// "할부원금")은 할부금융 업무 기준이라 렌탈 딜 아웃소싱과 완전히 들어맞지는 않지만,
// 문자 발송 자체는 정상 동작한다 (전용 템플릿 승인 후 교체 가능).
//
// 업무시간(09~19시 KST) 외, 또는 주말/공휴일에 발생한 건은 즉시 보내지 않고
// pending_kakao_queue 테이블에 channel:"rentalos"로 쌓아두고, pg_cron이 매일 09:00 KST에
// {type:"flush_queue"}로 이 함수를 호출하면 그때 업무일 여부를 다시 확인해 일괄 발송한다.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOLAPI_API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
const SENDER_PHONE      = Deno.env.get("SOLAPI_SENDER")     ?? "01050549006";

const RECIPIENTS_RAW = Deno.env.get("RENTALOS_SMS_RECIPIENTS") ?? "01050549006,01086521222";
const RECIPIENTS     = RECIPIENTS_RAW.split(",").map((n) => n.replace(/\D/g, "")).filter(Boolean);

// 현대건설기계와 동일 채널(@주식회사알앤에프코리아) + 승인된 신규접수 템플릿 재사용
const PF_ID       = "KA01PF2606081346516718bsSRTnA56x";
const TEMPLATE_ID = "KA01TP260609091445221AOdtfTbbsGO"; // hcm_new
const PAGE_URL    = "https://rnfkorea.co.kr/rental-os";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function dbClient() {
  const sbUrl = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
  const sbKey = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(sbUrl, sbKey);
}

// ── 업무일(평일 + 공휴일 아님) 판정 ────────────────────────────
// kr_holidays 테이블에 없는 미래 연도는 주말 판정만 적용됨(매년 초 다음 해 공휴일 추가 필요).
const kstDateStr = (d: Date) => {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}-${String(k.getUTCDate()).padStart(2, "0")}`;
};
const isWeekendKST = (d: Date) => {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const day = k.getUTCDay(); // 0=일, 6=토
  return day === 0 || day === 6;
};
async function isHolidayKST(db: ReturnType<typeof createClient>, d: Date) {
  const { data } = await db.from("kr_holidays").select("holiday_date").eq("holiday_date", kstDateStr(d)).maybeSingle();
  return !!data;
}
async function isBusinessDay(db: ReturnType<typeof createClient>, d: Date) {
  if (isWeekendKST(d)) return false;
  return !(await isHolidayKST(db, d));
}
function isOffHoursKST(d: Date) {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const hour = k.getUTCHours();
  return hour >= 19 || hour < 9;
}

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
}

async function sendAlimtalk(
  to: string,
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
          pfId: PF_ID,
          templateId: TEMPLATE_ID,
          variables,
          disableSms: false,
          buttons: [{
            buttonType: "WL",
            buttonName: "업무 페이지 열기",
            linkMo: PAGE_URL,
            linkPc: PAGE_URL,
          }],
        },
        text: fallbackText,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Rental_O/S 알림톡 오류 (${to}):`, err);
    throw new Error(`알림톡 발송 실패: ${err}`);
  }
}

function buildVariables(body: Record<string, string>): Record<string, string> {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  return {
    "#{케이스번호}": body.dealNo ?? "-",
    "#{고객명}":     body.customerName ?? "-",
    "#{고객유형}":   body.companyName || "Rental_O/S",
    "#{장비톤수}":   [body.equipmentType, body.equipmentSpec].filter(Boolean).join(" ") || "-",
    "#{금융사}":     body.outsourcingPartner || "-",
    "#{할부원금}":   body.amount ? `${Number(body.amount).toLocaleString("ko-KR")}원` : "-",
    "#{영업사원}":   body.salesRep ?? "-",
    "#{시간}":       now,
  };
}

// 파일 업로드 알림 — 신규접수용 승인 템플릿(hcm_new)엔 이 상황에 맞는 문구/변수가 없어
// 알림톡 대신 자유 문구가 가능한 SMS로 발송한다(전용 템플릿 승인 후 알림톡으로 교체 가능).
function buildFileUploadSmsText(body: Record<string, string>): string {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  return [
    "[Rental_O/S 파일 업로드]", "",
    `케이스: ${body.dealNo ?? "-"}`,
    `고객: ${body.customerName ?? "-"}${body.companyName ? ` (${body.companyName})` : ""}`,
    `파일: ${body.fileName ?? "-"}`,
    `업로드: ${body.uploadedBy ?? "-"}`,
    `시간: ${now}`,
  ].filter(Boolean).join("\n");
}

function buildFallbackText(body: Record<string, string>): string {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  return [
    "[Rental_O/S 신규 딜 접수]", "",
    `케이스: ${body.dealNo ?? "-"}`,
    `고객: ${body.customerName ?? "-"}${body.companyName ? ` (${body.companyName})` : ""}`,
    [body.equipmentType, body.equipmentSpec].filter(Boolean).join(" ") ? `장비: ${[body.equipmentType, body.equipmentSpec].filter(Boolean).join(" ")}` : "",
    body.outsourcingPartner ? `아웃소싱처: ${body.outsourcingPartner}` : "",
    body.amount ? `금액: ${Number(body.amount).toLocaleString("ko-KR")}원` : "",
    `담당자: ${body.salesRep ?? "-"}`,
    `시간: ${now}`,
  ].filter(Boolean).join("\n");
}

async function sendNow(body: Record<string, string>): Promise<void> {
  const fallbackText = buildFallbackText(body);
  try {
    const variables = buildVariables(body);
    await Promise.all(RECIPIENTS.map((to) => sendAlimtalk(to, variables, fallbackText)));
    console.log("[Rental_O/S 알림톡 발송 완료]:", body.dealNo);
  } catch (e) {
    console.warn("[Rental_O/S 알림톡 실패 → SMS 폴백]:", (e as Error).message);
    await sendSms(fallbackText, RECIPIENTS);
  }
}

// body.type에 따라 신규접수(알림톡+SMS 폴백)인지 파일업로드(SMS 전용)인지 갈라서 실제 발송한다.
async function dispatchNow(body: Record<string, string>): Promise<void> {
  if (body.type === "file_uploaded") {
    await sendSms(buildFileUploadSmsText(body), RECIPIENTS);
    console.log("[Rental_O/S 파일업로드 SMS 발송 완료]:", body.dealNo, body.fileName);
    return;
  }
  await sendNow(body);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  try {
    const body = await req.json() as Record<string, string>;
    const db = dbClient();

    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET) {
      throw new Error("SOLAPI 환경변수 미설정");
    }

    // ── flush_queue: pg_cron이 매일 09:00 KST에 호출 → 큐 일괄 발송 ──
    // 오늘이 주말/공휴일이면 발송하지 않고 큐에 그대로 남겨둠(다음 영업일 09:00에 재시도).
    if (body.type === "flush_queue") {
      if (!(await isBusinessDay(db, new Date()))) {
        return new Response(
          JSON.stringify({ flushed: 0, message: "오늘은 영업일이 아니라 다음 영업일 09:00에 발송됩니다." }),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      const { data: items, error } = await db
        .from("pending_kakao_queue")
        .select("*")
        .eq("payload->>channel", "rentalos")
        .order("created_at", { ascending: true });
      if (error) throw new Error(`큐 조회 실패: ${error.message}`);
      let flushed = 0;
      for (const item of items ?? []) {
        try {
          await dispatchNow(item.payload as Record<string, string>);
          await db.from("pending_kakao_queue").delete().eq("id", item.id);
          flushed++;
        } catch (e) {
          console.error(`[Rental_O/S 큐 발송 실패] id=${item.id}:`, (e as Error).message);
        }
      }
      return new Response(
        JSON.stringify({ flushed, total: (items ?? []).length }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ── 업무시간/업무일 체크 → 큐에 저장 ─────────────────────────
    const now = new Date();
    const shouldQueue = isOffHoursKST(now) || !(await isBusinessDay(db, now));
    if (shouldQueue) {
      const { error: qErr } = await db
        .from("pending_kakao_queue")
        .insert({ payload: { ...body, channel: "rentalos" } });
      if (qErr) {
        console.error("[Rental_O/S 큐 저장 실패]:", qErr.message);
        // 큐 저장 실패 시 즉시 발송으로 fall-through
      } else {
        console.log("[Rental_O/S 큐 저장]:", body.dealNo, "→ 다음 영업일 09:00 KST 발송 예정");
        return new Response(
          JSON.stringify({ queued: true, send_at: "다음 영업일 09:00 KST" }),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }

    await dispatchNow(body);

    return new Response(
      JSON.stringify({ success: true, recipients: RECIPIENTS }),
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
