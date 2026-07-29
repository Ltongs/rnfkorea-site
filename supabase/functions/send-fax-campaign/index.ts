// @ts-nocheck -- Deno Edge Function: npm/Deno 환경 타입 충돌 회피용 (Deno.env, esm.sh 외부 모듈 등)
// supabase/functions/send-fax-campaign/index.ts
// 골프장 팩스 캠페인 발송: fax_campaigns의 대상 골프장에 순차적으로 Solapi 팩스 발송 후 fax_send_log에 기록
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
const SOLAPI_SENDER_NUMBER = Deno.env.get("SOLAPI_SENDER_NUMBER") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function makeSignature(): { date: string; salt: string; signature: string } {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const hmac = createHmac("sha256", SOLAPI_API_SECRET);
  hmac.update(`${date}${salt}`);
  return { date, salt, signature: hmac.digest("hex") };
}

function authHeader(): string {
  const { date, salt, signature } = makeSignature();
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SOLAPI_SENDER_NUMBER) {
      throw new Error("Solapi 환경변수가 설정되지 않았습니다.");
    }

    const { campaignId } = await req.json();
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId는 필수입니다." }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: campaign, error: campaignErr } = await supabase
      .from("fax_campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    if (campaignErr) throw campaignErr;
    if (!campaign) {
      return new Response(JSON.stringify({ error: "캠페인을 찾을 수 없습니다." }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (!campaign.file_id) {
      return new Response(JSON.stringify({ error: "캠페인에 브로셔 파일이 등록되지 않았습니다." }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    let contactsQuery = supabase
      .from("golf_course_contacts")
      .select("id, name, fax")
      .eq("is_active", true)
      .not("fax", "is", null);
    if (campaign.target_region) {
      contactsQuery = contactsQuery.eq("region", campaign.target_region);
    }
    const { data: contacts, error: contactsErr } = await contactsQuery;
    if (contactsErr) throw contactsErr;

    const { data: existingLogs, error: logsErr } = await supabase
      .from("fax_send_log")
      .select("contact_id, status")
      .eq("campaign_id", campaignId)
      .eq("status", "success");
    if (logsErr) throw logsErr;
    const alreadySent = new Set((existingLogs ?? []).map((l) => l.contact_id));

    const targets = (contacts ?? []).filter((c) => c.fax && !alreadySent.has(c.id));

    const results: { name: string; status: string }[] = [];
    for (const contact of targets) {
      const faxNumber = contact.fax.replace(/[^0-9]/g, "");
      let status = "failed";
      let solapiMessageId: string | null = null;
      let errorMessage: string | null = null;

      try {
        const res = await fetch("https://api.solapi.com/messages/v4/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(),
          },
          body: JSON.stringify({
            message: {
              to: faxNumber,
              from: SOLAPI_SENDER_NUMBER,
              type: "FAX",
              faxOptions: { fileIds: [campaign.file_id] },
            },
          }),
        });
        const data = await res.json();
        if (res.ok && !data.errorCode) {
          status = "success";
          solapiMessageId = data.messageId ?? null;
        } else {
          errorMessage = JSON.stringify(data);
        }
      } catch (e) {
        errorMessage = (e as Error).message;
      }

      await supabase.from("fax_send_log").upsert(
        {
          campaign_id: campaignId,
          contact_id: contact.id,
          fax_number: contact.fax,
          solapi_message_id: solapiMessageId,
          status,
          error_message: errorMessage,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id,contact_id" },
      );

      results.push({ name: contact.name, status });
      await sleep(300);
    }

    await supabase.from("fax_campaigns").update({ status: "done" }).eq("id", campaignId);

    const successCount = results.filter((r) => r.status === "success").length;
    return new Response(
      JSON.stringify({
        sent: results.length,
        success: successCount,
        failed: results.length - successCount,
        skipped: (contacts ?? []).length - targets.length,
        results,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
