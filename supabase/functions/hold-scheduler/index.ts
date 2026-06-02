// supabase/functions/hold-scheduler/index.ts
// pg_cron 또는 Supabase Scheduled Functions으로 1분마다 호출
// 역할: scheduled_at 시간이 지난 미발송 보류 건을 조회 → 리마인더 SMS 발송 → is_sent = true 처리

import { serve }       from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")        ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EDGE_FN_URL         = `${SUPABASE_URL}/functions/v1/send-hyundaicm-kakao`;
const ANON_KEY            = Deno.env.get("SUPABASE_ANON_KEY")   ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1) 현재 시각 이전이고 아직 미발송인 보류 건 조회
  const now = new Date().toISOString();
  const { data: holds, error } = await supabase
    .from("hcm_holds")
    .select("id, record_id, scheduled_at, note, recipients")
    .eq("is_sent", false)
    .lte("scheduled_at", now);

  if (error) {
    console.error("[hold-scheduler] 조회 오류:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!holds || holds.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let processed = 0;

  for (const hold of holds) {
    try {
      // 2) 해당 hyundaicm_tasks 건 조회 (메시지 내용용)
      const { data: task } = await supabase
        .from("hyundaicm_tasks")
        .select("customer_name, customer_type, equipment_ton, sales_rep, status")
        .eq("id", hold.record_id)
        .single();

      // 3) send-hyundaicm-kakao Edge Function 호출 (hold_reminder 타입, 선택 수신자만)
      const payload = {
        type:          "hold_reminder",
        caseNo:        hold.record_id,
        customerName:  task?.customer_name  ?? "-",
        customerType:  task?.customer_type  ?? "-",
        equipmentTon:  task?.equipment_ton  ?? "-",
        salesRep:      task?.sales_rep      ?? "-",
        currentStatus: task?.status         ?? "-",
        holdNote:      hold.note            ?? "",
        // recipientIds: 배열을 JSON 문자열로 전달
        recipientIds:  JSON.stringify(hold.recipients ?? []),
      };

      const res = await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[hold-scheduler] SMS 실패 (id=${hold.id}):`, errText);
        continue; // 발송 실패 시 is_sent 업데이트 안 함 → 다음 주기 재시도
      }

      // 4) 발송 완료 → is_sent = true
      await supabase
        .from("hcm_holds")
        .update({ is_sent: true })
        .eq("id", hold.id);

      processed++;
      console.log(`[hold-scheduler] 발송 완료 (id=${hold.id}, record=${hold.record_id})`);

    } catch (e) {
      console.error(`[hold-scheduler] 예외 (id=${hold.id}):`, e);
    }
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});