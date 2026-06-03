// supabase/functions/secretary-ai-ins/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TODAY_ISO = new Date().toISOString().slice(0,10);
const TODAY_KR  = new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Seoul"})
  .replace(/\. /g,"-").replace(".","");

const SYSTEM = `You are a Korean AI secretary for an insurance consultant (보험설계사).
Today: ${TODAY_ISO}

CRITICAL: Output ONLY raw JSON. No markdown, no code blocks, no text before/after JSON.

Format:
{"reply":"한국어 답변","actions":[]}

Action types:

todo: {"type":"todo","title":"string","description":null,"priority":"urgent|normal|low","category":"insurance|followup|admin|null","due_date":"YYYY-MM-DD|null"}

schedule: {"type":"schedule","title":"string","description":null,"schedule_date":"YYYY-MM-DD","start_time":"HH:MM|null","category":"meeting|call|task|followup","location":null,"related_type":"insurance"}

order (NEW insurance consultation): {"type":"order","customer_name":"string","phone_last4":"string|null","channel":"kakao|phone|visit|web","work_type":"insurance","summary":"string","detail":null}

claim (insurance claim request): {"type":"claim","customer_name":"string","phone_last4":"string|null","product_name":"string","claim_date":"YYYY-MM-DD","claim_type":"inpatient|outpatient|surgery|death|other","memo":"string|null"}

consult_update (UPDATE existing customer insurance info): {"type":"consult_update","customer_name":"string","work_type":"insurance","keywords":["keyword1"],"update_memo":"string"}

CLAIM TYPE RULES:
- 치과, 내과, 외래, 통원 → "outpatient"
- 입원 → "inpatient"
- 수술 → "surgery"
- 사망 → "death"
- 기타 → "other"
- phone_last4: extract last 4 digits from phone number (e.g. "01050549006" → "9006")

RULES:
- Insurance claim request (보험청구, 청구요청, 청구대행) → claim
- New insurance inquiry → order
- Existing customer update → consult_update
- Task/reminder → todo
- Meeting/call schedule → schedule
- General question → actions:[]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const { messages, autoSave, confirmUpdate } = body;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY 없음");

    const sbUrl = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const sbKey = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const db = createClient(sbUrl, sbKey);

    // ── confirmUpdate ─────────────────────────────────────────────
    if (confirmUpdate) {
      const { consultation_id, update_memo } = confirmUpdate;
      const appendText = `[${TODAY_KR} AI비서(Ins)] ${update_memo}`;
      const { data: caseRow } = await db.from("ins_consultation_cases")
        .select("detail_memo").eq("id", consultation_id).single();
      const prev = caseRow?.detail_memo ?? "";
      await db.from("ins_consultation_cases").update({
        detail_memo: prev ? `${prev}\n${appendText}` : appendText,
      }).eq("id", consultation_id);
      return new Response(
        JSON.stringify({ reply:`✅ 상담#${consultation_id} 업데이트 완료`, actions:[], saved:[{type:"consult_update",id:consultation_id}], pendingUpdates:[] }),
        { headers: { ...CORS, "Content-Type":"application/json" } }
      );
    }

    if (!messages || !Array.isArray(messages)) throw new Error("messages 필요");

    // ── Claude 호출 ───────────────────────────────────────────────
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({ model:"claude-sonnet-4-5", max_tokens:2048, system:SYSTEM, messages }),
    });
    const aiData = await aiRes.json();
    if (aiData.error || !aiData.content) throw new Error(aiData.error?.message ?? JSON.stringify(aiData));

    const raw = (aiData.content?.[0]?.text ?? "{}").trim();
    let parsed: { reply:string; actions:Record<string,unknown>[] } = { reply:raw, actions:[] };
    try {
      const clean = raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```\s*$/i,"").trim();
      if (clean.startsWith("{")) parsed = JSON.parse(clean);
      else return new Response(JSON.stringify({reply:raw,actions:[],saved:[],pendingUpdates:[]}),{headers:{...CORS,"Content-Type":"application/json"}});
    } catch {
      return new Response(JSON.stringify({reply:raw,actions:[],saved:[],pendingUpdates:[]}),{headers:{...CORS,"Content-Type":"application/json"}});
    }

    const saved: {type:string;id:number;consultation_id?:number}[] = [];
    const pendingUpdates: {action:Record<string,unknown>;candidates:Record<string,unknown>[];bestMatch:Record<string,unknown>|null}[] = [];

    if (autoSave && parsed.actions?.length > 0) {
      for (const a of parsed.actions) {

        // ── 할일 ──────────────────────────────────────────────────
        if (a.type === "todo") {
          const {data,error} = await db.from("ins_todos").insert({
            title:a.title, description:a.description??null, priority:a.priority??"normal",
            category:a.category??null, due_date:a.due_date??null,
          }).select("id").single();
          if (!error && data) saved.push({type:"todo",id:data.id});
        }

        // ── 일정 ──────────────────────────────────────────────────
        if (a.type === "schedule") {
          const {data,error} = await db.from("ins_schedules").insert({
            title:a.title, description:a.description??null, schedule_date:a.schedule_date??TODAY_ISO,
            start_time:a.start_time??null, category:a.category??"meeting",
            location:a.location??null, related_type:"insurance",
          }).select("id").single();
          if (!error && data) saved.push({type:"schedule",id:data.id});
        }

        // ── 상담 접수 ──────────────────────────────────────────────
        if (a.type === "order") {
          const last4 = String(a.phone_last4??"").replace(/\D/g,"").slice(-4);
          const cKey = last4 ? `${String(a.customer_name).trim()}_${last4}` : String(a.customer_name).trim();
          let cid: number|null = null;
          const {data:cd} = await db.from("ins_consultation_cases").insert({
            customer_key:cKey, customer_name:a.customer_name, phone:last4||"미입력",
            work_type:"registration_insurance", status:"new",
            summary:`[AI비서(Ins) 자동접수] ${a.summary}`,
            detail_memo:a.detail??null, followup_needed:false,
            call_datetime:new Date().toISOString(),
          }).select("id").single();
          if (cd) cid = cd.id;
          const {data:od} = await db.from("ins_orders").insert({
            customer_key:cKey, customer_name:a.customer_name, channel:a.channel??"phone",
            work_type:"insurance", summary:a.summary, detail:a.detail??null,
            status:"new", consultation_id:cid,
          }).select("id").single();
          if (od) saved.push({type:"order",id:od.id,consultation_id:cid??undefined});
        }

        // ── 보험금 청구 ────────────────────────────────────────────
        if (a.type === "claim") {
          const last4 = String(a.phone_last4??"").replace(/\D/g,"").slice(-4);
          const cKey = last4 ? `${String(a.customer_name).trim()}_${last4}` : String(a.customer_name).trim();
          const {data,error} = await db.from("ins_claims").insert({
            customer_key:cKey,
            customer_name:a.customer_name,
            product_name:a.product_name??"미확인",
            claim_date:a.claim_date??TODAY_ISO,
            claim_type:a.claim_type??"other",
            status:"requested",
            memo:a.memo??null,
          }).select("id").single();
          if (!error && data) saved.push({type:"claim",id:data.id});
        }

        // ── 상담 업데이트 ──────────────────────────────────────────
        if (a.type === "consult_update") {
          const kws = (a.keywords as string[]) ?? [];
          const {data:cands} = await db.from("ins_consultation_cases")
            .select("id,customer_name,work_type,status,summary,detail_memo,created_at")
            .eq("customer_name", a.customer_name)
            .eq("work_type","registration_insurance")
            .order("created_at",{ascending:false}).limit(5);
          if (!cands || cands.length === 0) {
            pendingUpdates.push({action:a, candidates:[], bestMatch:null});
            continue;
          }
          let best = cands[0] as Record<string,unknown>;
          if (cands.length > 1) {
            let top = -1;
            for (const c of cands as Record<string,unknown>[]) {
              const txt = `${c.summary??""} ${c.detail_memo??""}`.toLowerCase();
              const score = kws.filter(k=>txt.includes(k.toLowerCase())).length;
              if (score > top) { top=score; best=c; }
            }
          }
          const appendText = `[${TODAY_KR} AI비서(Ins)] ${a.update_memo}`;
          const prev = (best.detail_memo as string) ?? "";
          await db.from("ins_consultation_cases").update({
            detail_memo: prev ? `${prev}\n${appendText}` : appendText,
          }).eq("id", best.id);
          saved.push({type:"consult_update", id:best.id as number});
        }
      }
    }

    return new Response(
      JSON.stringify({reply:parsed.reply, actions:parsed.actions, saved, pendingUpdates}),
      { headers:{...CORS,"Content-Type":"application/json"} }
    );

  } catch (err) {
    console.error("secretary-ai-ins error:", err);
    return new Response(
      JSON.stringify({reply:`오류: ${(err as Error).message}`, actions:[], saved:[], pendingUpdates:[]}),
      {status:500, headers:{...CORS,"Content-Type":"application/json"}}
    );
  }
});