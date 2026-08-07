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

// 지역번호(0XX 또는 1XXX 대표번호) + 국번(3~4자리) + 번호(4자리) 패턴을 모두 추출한다.
// "031-672-6011, 033-573-0876"처럼 한 필드에 팩스번호가 여러 개 들어있으면 각각을
// 별도 발송 대상으로 인식해 전부 발송한다. 231곳 전체 데이터로 검증된 패턴.
const FAX_NUMBER_PATTERN = /(?:0\d{1,2}|1\d{3})[-.\s)]?\d{3,4}[-.\s]?\d{4}/g;

function parseFaxNumbers(raw: string): string[] {
  const matches = raw.match(FAX_NUMBER_PATTERN) ?? [];
  return matches.map((m) => m.replace(/[^0-9]/g, ""));
}

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

    // "success"뿐 아니라 "sent"(접수는 됐지만 최종 배송 확인 전)도 재발송 대상에서 제외해야
    // 한다 — 안 그러면 아직 확인 중인 번호에 똑같은 팩스가 중복으로 다시 나갈 수 있다.
    const { data: existingLogs, error: logsErr } = await supabase
      .from("fax_send_log")
      .select("contact_id, fax_number, status")
      .eq("campaign_id", campaignId)
      .in("status", ["success", "sent"]);
    if (logsErr) throw logsErr;
    const alreadySent = new Set(
      (existingLogs ?? []).map((l) => `${l.contact_id}|${l.fax_number}`),
    );

    // 골프장 1곳 = 발송 대상 1건이 아니라, 팩스번호 1개 = 발송 대상 1건이다.
    // 필드 하나에 번호가 여러 개 있으면(예: "031-1, 031-2") 파싱된 번호 수만큼 대상이 생긴다.
    type Target = { contactId: string; contactName: string; rawFax: string; faxNumber: string };
    const allTargets: Target[] = [];
    for (const contact of contacts ?? []) {
      const numbers = parseFaxNumbers(contact.fax);
      if (numbers.length === 0) {
        // 정규식으로 번호를 하나도 못 찾은 경우 — 원본 문자열 자체를 잘못된 번호로 기록해 남긴다.
        allTargets.push({ contactId: contact.id, contactName: contact.name, rawFax: contact.fax, faxNumber: contact.fax.replace(/[^0-9]/g, "") || contact.fax });
        continue;
      }
      for (const num of numbers) {
        allTargets.push({ contactId: contact.id, contactName: contact.name, rawFax: contact.fax, faxNumber: num });
      }
    }

    const targets = allTargets.filter((t) => !alreadySent.has(`${t.contactId}|${t.faxNumber}`));

    const results: { name: string; faxNumber: string; status: string }[] = [];
    for (const target of targets) {
      let status = "failed";
      let solapiMessageId: string | null = null;
      let errorMessage: string | null = null;

      // 자릿수가 비정상인 번호(파싱 실패 등)는 발송을 시도하지 않고 바로 실패 기록한다.
      if (target.faxNumber.length < 9 || target.faxNumber.length > 11) {
        await supabase.from("fax_send_log").upsert(
          {
            campaign_id: campaignId,
            contact_id: target.contactId,
            fax_number: target.faxNumber,
            status: "failed",
            error_message: `팩스번호 형식이 올바르지 않습니다 (원본: ${target.rawFax})`,
            sent_at: new Date().toISOString(),
          },
          { onConflict: "campaign_id,contact_id,fax_number" },
        );
        results.push({ name: target.contactName, faxNumber: target.faxNumber, status: "failed" });
        continue;
      }

      try {
        const res = await fetch("https://api.solapi.com/messages/v4/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(),
          },
          body: JSON.stringify({
            message: {
              to: target.faxNumber,
              from: SOLAPI_SENDER_NUMBER,
              type: "FAX",
              faxOptions: { fileIds: [campaign.file_id] },
            },
          }),
        });
        const data = await res.json();
        if (res.ok && !data.errorCode) {
          // 팩스는 비동기 발송이라 이 시점엔 Solapi가 "접수"했다는 것만 확인된 상태다.
          // 실제 수신 성공/실패는 몇 초~몇십 초 뒤에나 확정되므로, refresh-fax-status가
          // 나중에 최종 결과로 갱신하기 전까지는 "sent"(접수됨, 확인 전)로만 기록한다.
          status = "sent";
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
          contact_id: target.contactId,
          fax_number: target.faxNumber,
          solapi_message_id: solapiMessageId,
          status,
          error_message: errorMessage,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id,contact_id,fax_number" },
      );

      results.push({ name: target.contactName, faxNumber: target.faxNumber, status });
      await sleep(300);
    }

    await supabase.from("fax_campaigns").update({ status: "done" }).eq("id", campaignId);

    const acceptedCount = results.filter((r) => r.status === "sent").length;
    return new Response(
      JSON.stringify({
        attempted: results.length,
        accepted: acceptedCount, // Solapi 접수 완료 — 실제 배송 확인은 아직 안 됨(추후 상태 새로고침 필요)
        failed: results.length - acceptedCount, // 형식 오류 등으로 접수 자체가 안 된 건
        skipped: allTargets.length - targets.length,
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
