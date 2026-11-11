// @ts-nocheck -- Deno Edge Function: npm/Deno 환경 타입 충돌 회피용
// supabase/functions/send-renthana-kakao/index.ts
// 렌타나 타이어렌탈 업무(/renthana/work) 단계 변경 알림 — 알림톡(+실패 시 문자 폴백).
//
// 호출: renthana_rental_cases 단계가 바뀌면 DB 트리거(notify_renthana_case)가 {caseId, event, resubmit}로 호출.
// 본문의 내용은 믿지 않고 caseId로 DB를 다시 읽어 현재 단계가 event와 같을 때만 발송한다
// (anon key로 이 함수를 직접 불러 임의 문구·임의 수신자로 보내는 것을 막기 위함).
//
// 수신자:
//   RNF → 렌타나: submitted(심사요청·재요청), installed(장착완료)  → RENTHANA_SMS_RECIPIENTS
//   렌타나 → RNF: approved / on_hold / rejected / paid             → RNF_SMS_RECIPIENTS
//
// 알림톡: 렌타나 전용 템플릿(renthana_notice) 하나를 모든 단계에 공통으로 쓴다.
//   변수: #{케이스번호} #{고객명} #{상호} #{진행단계} #{발신처} #{상세내용} #{시간}
//   버튼: 웹링크 "업무 페이지 열기" → https://rnfkorea.co.kr/renthana/work
// TEMPLATE_ID가 비어 있으면(카카오 승인 전) 같은 내용을 문자(LMS)로 보낸다.
// 알림톡이 거절되면(템플릿·버튼 불일치 등) 같은 내용이 문자로 자동 대체 발송된다.
// (2026-11-11 현대CM hcm_edit 템플릿 재사용을 시험했으나 제목이 "HD현대 할부 정보 수정 안내"로 떠서 쓰지 않기로 함)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOLAPI_API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
const SENDER_PHONE      = Deno.env.get("SOLAPI_SENDER")     ?? "01050549006";

const parsePhones = (raw: string) => [...new Set(raw.split(",").map((n) => n.replace(/\D/g, "")).filter(Boolean))];
// 렌타나 담당자: 조상현 대리, 정순용 팀장 (+ 관리자 참조)
const RENTHANA_RECIPIENTS = parsePhones(Deno.env.get("RENTHANA_SMS_RECIPIENTS") ?? "01090961914,01050971518,01050549006");
const RNF_RECIPIENTS      = parsePhones(Deno.env.get("RNF_RENTHANA_SMS_RECIPIENTS") ?? "01050549006");

const PF_ID    = "KA01PF2606081346516718bsSRTnA56x"; // @주식회사알앤에프코리아 (현대CM과 동일 채널)
const PAGE_URL = "https://rnfkorea.co.kr/renthana/work";

// TODO: 솔라피에서 renthana_notice 템플릿 승인 후 ID 입력 (예: "KA01TP...")
const TEMPLATE_ID = "";

const STAGE_LABEL: Record<string, string> = {
  submitted: "심사요청", approved: "승인", on_hold: "보류", rejected: "부결",
  installed: "장착완료", paid: "대금지급 완료",
};

const TO_RENTHANA = new Set(["submitted", "installed"]);

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

async function sendSms(text: string, recipients: string[]): Promise<void> {
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

async function sendAlimtalk(to: string, templateId: string, variables: Record<string, string>, fallbackText: string): Promise<void> {
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
          templateId,
          variables,
          disableSms: false,
          buttons: [{ buttonType: "WL", buttonName: "업무 페이지 열기", linkMo: PAGE_URL, linkPc: PAGE_URL }],
        },
        text: fallbackText,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`렌타나 알림톡 오류 (${to}):`, err);
    throw new Error(`알림톡 발송 실패: ${err}`);
  }
}

// 템플릿 변수 + 대체 문자 본문
function buildMessage(c: Record<string, any>, stage: string, sender: string, detail: string) {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const variables = {
    "#{케이스번호}": c.case_no ?? "-",
    "#{고객명}":     c.customer_name ?? "-",
    "#{상호}":       c.company_name || "-",
    "#{진행단계}":   stage,
    "#{발신처}":     sender,
    "#{상세내용}":   detail,
    "#{시간}":       now,
  };
  const text = [
    `[렌타나 타이어렌탈 ${stage}]`, "",
    `케이스: ${c.case_no ?? "-"}`,
    `고객: ${c.customer_name}${c.company_name ? ` (${c.company_name})` : ""}`,
    detail, "",
    `시간: ${now}`,
    PAGE_URL,
  ].join("\n");
  return { variables, text };
}

const won = (n: unknown) => (n == null || n === "" ? "-" : `${Math.round(Number(n)).toLocaleString("ko-KR")}원`);

// 단계별 본문 — 상대방이 다음에 무엇을 해야 하는지까지 적는다.
function buildDetail(event: string, c: Record<string, any>, resubmit: boolean, fileCount: Record<string, number>): string {
  if (event === "submitted") {
    return [
      resubmit ? "보류 건이 보완되어 다시 심사요청되었습니다." : "신규 타이어렌탈 심사요청입니다.",
      `연락처: ${c.customer_phone ?? "-"}`,
      c.vehicle_no ? `차량: ${c.vehicle_no}${c.vehicle_model ? ` (${c.vehicle_model})` : ""}` : "",
      c.tire_spec ? `타이어: ${c.tire_spec}` : "",
      c.tire_qty_front != null || c.tire_qty_rear != null ? `수량: 전륜 ${c.tire_qty_front ?? 0}본 · 후륜 ${c.tire_qty_rear ?? 0}본` : "",
      `공급가: ${won(c.supply_price)} / ${c.rental_months ?? "-"}개월 월 ${won(c.monthly_fee)}`,
      c.special_note ? `특이사항: ${c.special_note}` : "",
      "업무 페이지에서 승인·보류·부결을 선택해주세요.",
    ].filter(Boolean).join("\n");
  }
  if (event === "approved") {
    return [`렌타나 승인 완료${c.decision_note ? `\n조건: ${c.decision_note}` : ""}`, "장착 일정을 진행해주세요."].join("\n");
  }
  if (event === "on_hold") {
    return [`보류 사유: ${c.decision_note ?? "-"}`, "보완 후 업무 페이지에서 재요청해주세요."].join("\n");
  }
  if (event === "rejected") {
    return `부결 사유: ${c.decision_note ?? "-"}`;
  }
  if (event === "installed") {
    return [
      `장착일: ${c.install_date ?? "-"}${c.install_shop ? ` / ${c.install_shop}` : ""}`,
      `설치사진 ${fileCount.install_photo ?? 0}장, 보증서 ${fileCount.warranty ?? 0}건 첨부`,
      `지급 예정액(공급가): ${won(c.supply_price)}`,
      "확인 후 대금 지급 및 [대금지급] 처리 부탁드립니다.",
    ].join("\n");
  }
  if (event === "paid") {
    return [
      `지급액: ${won(c.paid_amount)}${c.paid_date ? ` (${c.paid_date})` : ""}`,
      c.payment_note ? `메모: ${c.payment_note}` : "",
      "건이 마무리되었습니다.",
    ].filter(Boolean).join("\n");
  }
  throw new Error(`알 수 없는 event: ${event}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

  try {
    const body = await req.json() as Record<string, unknown>;

    const caseId = Number(body.caseId);
    const event = String(body.event ?? "");
    if (!caseId || !STAGE_LABEL[event]) return json({ error: "caseId, event가 올바르지 않습니다." }, 400);
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET) throw new Error("SOLAPI 환경변수 미설정");

    const db = dbClient();
    const { data: c, error } = await db.from("renthana_rental_cases").select("*").eq("id", caseId).maybeSingle();
    if (error) throw new Error(`케이스 조회 실패: ${error.message}`);
    if (!c) return json({ error: "케이스가 없습니다." }, 404);
    if (c.status !== event) return json({ skipped: true, reason: `현재 단계(${c.status})와 이벤트(${event})가 다릅니다.` });

    const { data: files } = await db.from("renthana_case_files").select("kind").eq("case_id", caseId);
    const fileCount: Record<string, number> = {};
    for (const f of files ?? []) fileCount[f.kind] = (fileCount[f.kind] ?? 0) + 1;

    const stage = event === "submitted" && body.resubmit ? "재심사요청" : STAGE_LABEL[event];
    const detail = buildDetail(event, c, !!body.resubmit, fileCount);
    const { variables, text } = buildMessage(c, stage, TO_RENTHANA.has(event) ? "RNF" : "렌타나", detail);

    const recipients = TO_RENTHANA.has(event) ? RENTHANA_RECIPIENTS : RNF_RECIPIENTS;
    if (TEMPLATE_ID) {
      try {
        await Promise.all(recipients.map((to) => sendAlimtalk(to, TEMPLATE_ID, variables, text)));
      } catch (e) {
        console.warn("[렌타나 알림톡 실패 → 문자 폴백]:", (e as Error).message);
        await sendSms(text, recipients);
      }
    } else {
      await sendSms(text, recipients);
    }

    await db.from("renthana_case_history").insert({
      case_id: caseId, event_type: "notify", to_status: event,
      note: `${TO_RENTHANA.has(event) ? "렌타나" : "RNF"}에 알림 발송 (${recipients.length}명)`,
      created_by: "system",
    });

    return json({ success: true, event, recipients: recipients.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[오류]:", msg);
    return json({ error: msg }, 500);
  }
});
