// @ts-nocheck -- Deno Edge Function
// supabase/functions/refresh-fax-status/index.ts
// 팩스는 비동기 발송이라 send-fax-campaign이 기록하는 "sent"는 Solapi 접수 확인일 뿐
// 실제 수신 성공/실패가 아니다. 이 함수가 Solapi에 최종 상태를 물어봐서 fax_send_log를
// 실제 결과(success/failed)로 갱신한다. 새로 발송하지 않는 순수 조회+DB 갱신 함수.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SOLAPI_API_KEY = Deno.env.get("SOLAPI_API_KEY") ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function authHeader(): string {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const hmac = createHmac("sha256", SOLAPI_API_SECRET);
  hmac.update(`${date}${salt}`);
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${hmac.digest("hex")}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET) {
      throw new Error("Solapi 환경변수가 설정되지 않았습니다.");
    }

    const { campaignId } = await req.json().catch(() => ({ campaignId: undefined }));

    let query = supabase
      .from("fax_send_log")
      .select("id, solapi_message_id")
      .eq("status", "sent")
      .not("solapi_message_id", "is", null);
    if (campaignId) query = query.eq("campaign_id", campaignId);

    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) throw rowsErr;

    let success = 0;
    let failed = 0;
    let stillPending = 0;
    let notFound = 0;

    for (const row of rows ?? []) {
      try {
        const res = await fetch(
          `https://api.solapi.com/messages/v4/list?messageId=${row.solapi_message_id}`,
          { headers: { Authorization: authHeader() } },
        );
        const data = await res.json();
        const info = data?.messageList?.[row.solapi_message_id];

        if (!info) {
          notFound += 1;
          await sleep(250);
          continue;
        }

        if (info.status !== "COMPLETE") {
          // 아직 전송 중 — 다음 새로고침 때 다시 확인
          stillPending += 1;
          await supabase.from("fax_send_log").update({ status_checked_at: new Date().toISOString() }).eq("id", row.id);
          await sleep(250);
          continue;
        }

        const failureLog = (info.log ?? []).find((l: { message?: string }) => l.message?.includes("실패"));
        if (failureLog) {
          failed += 1;
          await supabase.from("fax_send_log").update({
            status: "failed",
            solapi_status_code: info.statusCode ?? null,
            error_message: failureLog.message,
            status_checked_at: new Date().toISOString(),
          }).eq("id", row.id);
        } else {
          success += 1;
          await supabase.from("fax_send_log").update({
            status: "success",
            solapi_status_code: info.statusCode ?? null,
            status_checked_at: new Date().toISOString(),
          }).eq("id", row.id);
        }
      } catch (e) {
        console.error(`[refresh-fax-status] id=${row.id} 조회 실패:`, (e as Error).message);
      }
      await sleep(250);
    }

    return new Response(
      JSON.stringify({ checked: (rows ?? []).length, success, failed, stillPending, notFound }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
