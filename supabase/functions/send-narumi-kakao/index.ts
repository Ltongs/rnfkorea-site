import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EventType = "created" | "docs_received" | "registered";

type RequestBody = {
  task_id?: number | string | null;
  event_type: EventType;
  vin: string;
  delivery_date_text?: string | null;
  is_lotte_autolease?: boolean | null;
  special_note?: string | null;
};

// ✅ Supabase 환경변수
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ✅ 카카오 (나중에 채울 부분)
const KAKAO_PROVIDER_URL = Deno.env.get("KAKAO_PROVIDER_URL") || "";
const KAKAO_PROVIDER_API_KEY = Deno.env.get("KAKAO_PROVIDER_API_KEY") || "";
const KAKAO_SENDER_KEY = Deno.env.get("KAKAO_SENDER_KEY") || "";

// ✅ 수신자 4명
const RECIPIENTS = [
  { name: "RNF1", phone: "01011112222" },
  { name: "RNF2", phone: "01033334444" },
  { name: "NARMI1", phone: "01055556666" },
  { name: "NARMI2", phone: "01077778888" },
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

// ✅ 메시지 생성
function buildMessage(body: RequestBody) {
  const yn = body.is_lotte_autolease ? "Y" : "N";
  const note = body.special_note?.trim() || "-";

  if (body.event_type === "created") {
    return `[RNF 나르미] 신규 접수 완료
차대번호: ${body.vin}
출고일자: ${body.delivery_date_text || "-"}
롯데오토리스: ${yn}
특이사항: ${note}`;
  }

  if (body.event_type === "docs_received") {
    return `[RNF 나르미] 등록서류 수령
차대번호: ${body.vin}
출고일자: ${body.delivery_date_text || "-"}
현재단계: 등록서류 수령
특이사항: ${note}`;
  }

  if (body.event_type === "registered") {
    return `[RNF 나르미] 등록완료
차대번호: ${body.vin}
출고일자: ${body.delivery_date_text || "-"}
현재단계: 등록완료
차량등록증 업로드 여부: 확인 필요`;
  }

  return `[RNF 나르미] 알림
차대번호: ${body.vin}`;
}

// ✅ 카카오 발송 (현재는 mock)
async function sendViaKakao(body: RequestBody) {
  const message = buildMessage(body);

  // 🔹 아직 카카오 API 없으면 mock 처리
  if (!KAKAO_PROVIDER_URL) {
    return {
      ok: true,
      provider: "mock",
      provider_message_id: `mock-${Date.now()}`,
      request: {
        message,
        recipients: RECIPIENTS,
      },
      response: { msg: "mock success" },
    };
  }

  const payload = {
    sender_key: KAKAO_SENDER_KEY,
    message,
    recipients: RECIPIENTS.map((r) => ({
      name: r.name,
      phone: normalizePhone(r.phone),
    })),
  };

  const res = await fetch(KAKAO_PROVIDER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KAKAO_PROVIDER_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (!res.ok) {
    return {
      ok: false,
      provider: "kakao",
      error: text,
      request: payload,
    };
  }

  return {
    ok: true,
    provider: "kakao",
    provider_message_id: Date.now().toString(),
    request: payload,
    response: text,
  };
}

// ✅ 메인 실행
serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "POST only" }, 405);
  }

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const body = await req.json() as RequestBody;

    if (!body.event_type || !body.vin) {
      return json({ ok: false, error: "invalid input" }, 400);
    }

    const sendResult = await sendViaKakao(body);

    // ✅ 로그 저장
    const { error } = await supabase
      .from("narumi_notification_logs")
      .insert({
        task_id: body.task_id ?? null,
        event_type: body.event_type,
        recipients: RECIPIENTS,
        payload: {
          input: body,
          message: buildMessage(body),
          provider: sendResult,
        },
        provider: sendResult.provider,
        provider_message_id: sendResult.provider_message_id ?? null,
        success: sendResult.ok,
        error_message: sendResult.ok ? null : (sendResult as any).error,
      });

    if (error) {
      return json({ ok: false, error: error.message }, 500);
    }

    return json({
      ok: true,
      provider: sendResult.provider,
    });

  } catch (e) {
    return json({
      ok: false,
      error: e instanceof Error ? e.message : "unknown error",
    }, 500);
  }
});