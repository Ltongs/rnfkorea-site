// supabase/functions/secretary-ai/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WMAP: Record<string,string> = {
  insurance:"registration_insurance", tire:"tire_sales", finance:"finance",
  forklift:"forklift_sales", battery:"battery_sales",
};

// 업무유형 → detail 테이블명 (상담관리 폼의 "상담내용" note 컬럼)
const DTABLE: Record<string,string> = {
  registration_insurance: "consultation_insurance_details",
  tire_sales:             "consultation_tire_details",
  finance:                "consultation_finance_details",
  forklift_sales:         "consultation_forklift_details",
  battery_sales:          "consultation_battery_details",
};

const TODAY_ISO = new Date().toISOString().slice(0,10);
const TODAY_KR  = new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"})
  .replace(/\. /g,"-").replace(".","");

const SYSTEM = `You are a Korean AI secretary for RNF Korea company.
Today: ${TODAY_ISO}

CRITICAL: Output ONLY raw JSON. No markdown, no code blocks, no text before/after JSON.

Format:
{"reply":"한국어 답변","actions":[]}

Action types:

todo: {"type":"todo","title":"string","description":null,"priority":"urgent|normal|low","category":"insurance|tire|finance|forklift|battery|admin|null","due_date":"YYYY-MM-DD|null"}

schedule: {"type":"schedule","title":"string","description":null,"schedule_date":"YYYY-MM-DD","start_time":"HH:MM|null","category":"meeting|call|task|followup","location":null,"related_type":"insurance|tire|finance|forklift|battery|null"}

order (NEW customer): {"type":"order","customer_name":"string","phone":null,"channel":"kakao|phone|visit|web","work_type":"insurance|tire|finance|forklift|battery|null","summary":"string","detail":null}

consult_update (UPDATE existing customer info): {"type":"consult_update","customer_name":"string","work_type":"finance|insurance|tire|forklift|battery","keywords":["keyword1"],"update_memo":"string","finance_fields":{"finance_amount":null,"finance_interest_rate":null,"finance_period":null,"finance_company":null,"finance_product":null,"finance_vehicle_model":null,"finance_incentive":null}}

finance_fields rules (only for finance type):
- "한도 6720만원" → finance_amount: 67200000
- "금리 9%" or "금리 9.0%" → finance_interest_rate: 9.0
- "36개월" or "기간 36" → finance_period: 36
- "인센티브 2.5%" → finance_incentive: 2.5
- null if not mentioned

RULES:
- Existing customer info update (한도, 금리, 조건, 차종 확인 등) → consult_update
- New customer inquiry → order
- Task → todo
- Meeting/schedule → schedule
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

    // ── confirmUpdate: 사용자 승인
    if (confirmUpdate) {
      const { consultation_id, update_memo } = confirmUpdate;
      const appendText = `[${TODAY_KR} AI비서] ${update_memo}`;

      const { data: caseRow } = await db.from("consultation_cases")
        .select("detail_memo,work_type").eq("id", consultation_id).single();

      // detail 테이블 note에 추가 (상담관리 폼 "상담내용")
      const dtable = DTABLE[caseRow?.work_type as string];
      if (dtable) {
        const { data: dr } = await db.from(dtable).select("note").eq("consultation_id", consultation_id).single();
        const newNote = dr?.note ? `${dr.note}\n${appendText}` : appendText;
        await db.from(dtable).update({ note: newNote }).eq("consultation_id", consultation_id);
      }

      // detail_memo에도 백업
      const prevMemo = caseRow?.detail_memo ?? "";
      await db.from("consultation_cases").update({
        detail_memo: prevMemo ? `${prevMemo}\n${appendText}` : appendText,
      }).eq("id", consultation_id);

      return new Response(
        JSON.stringify({ reply:`✅ 상담#${consultation_id} 업데이트 완료`, actions:[], saved:[{type:"consult_update",id:consultation_id}], pendingUpdates:[] }),
        { headers: { ...CORS, "Content-Type":"application/json" } }
      );
    }

    if (!messages || !Array.isArray(messages)) throw new Error("messages 필요");

    // ── Claude 호출
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

        if (a.type === "todo") {
          const {data,error} = await db.from("secretary_todos").insert({
            title:a.title, description:a.description??null, priority:a.priority??"normal",
            category:a.category??null, due_date:a.due_date??null,
          }).select("id").single();
          if (!error && data) saved.push({type:"todo",id:data.id});
        }

        if (a.type === "schedule") {
          const {data,error} = await db.from("secretary_schedules").insert({
            title:a.title, description:a.description??null, schedule_date:a.schedule_date??TODAY_ISO,
            start_time:a.start_time??null, category:a.category??"meeting",
            location:a.location??null, related_type:a.related_type??null,
          }).select("id").single();
          if (!error && data) saved.push({type:"schedule",id:data.id});
        }

        if (a.type === "order") {
          const wt = a.work_type ? (WMAP[a.work_type as string]??a.work_type) : null;
          let cid: number|null = null;
          if (wt) {
            const {data:cd} = await db.from("consultation_cases").insert({
              customer_name:a.customer_name, phone:a.phone??"미입력",
              work_type:wt, status:"new",
              summary:`[AI비서 자동접수] ${a.summary}`,
              detail_memo:a.detail??null, followup_needed:false,
              call_datetime:new Date().toISOString(),
            }).select("id").single();
            if (cd) cid = cd.id;
          }
          const {data:od} = await db.from("secretary_orders").insert({
            customer_name:a.customer_name, phone:a.phone??null, channel:a.channel??"phone",
            work_type:a.work_type??null, summary:a.summary, detail:a.detail??null,
            status:"new", consultation_id:cid,
          }).select("id").single();
          if (od) saved.push({type:"order",id:od.id,consultation_id:cid??undefined});
        }

        if (a.type === "consult_update") {
          const wt = WMAP[a.work_type as string] ?? a.work_type as string;
          const kws = (a.keywords as string[]) ?? [];

          const {data:cands} = await db.from("consultation_cases")
            .select("id,customer_name,work_type,status,summary,detail_memo,created_at")
            .eq("customer_name", a.customer_name).eq("work_type", wt)
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

          // 건수 관계없이 best 건에 즉시 업데이트
          const appendText = `[${TODAY_KR} AI비서] ${a.update_memo}`;
          const dtable = DTABLE[wt];

          if (dtable) {
            const {data:dr} = await db.from(dtable).select("note").eq("consultation_id", best.id).maybeSingle();
            const newNote = dr?.note ? `${dr.note}\n${appendText}` : appendText;

            // finance_fields: 금융 상세 컬럼 업데이트
            const ff = a.finance_fields as Record<string,unknown>|null;
            const financeExtra: Record<string,unknown> = {};
            if (wt === "finance" && ff) {
              if (ff.finance_amount != null)       financeExtra.finance_amount = ff.finance_amount;
              if (ff.finance_interest_rate != null) financeExtra.finance_interest_rate = ff.finance_interest_rate;
              if (ff.finance_period != null)        financeExtra.finance_period = ff.finance_period;
              if (ff.finance_company != null)       financeExtra.finance_company = ff.finance_company;
              if (ff.finance_product != null)       financeExtra.finance_product = ff.finance_product;
              if (ff.finance_vehicle_model != null) financeExtra.finance_vehicle_model = ff.finance_vehicle_model;
              if (ff.finance_incentive != null)     financeExtra.finance_incentive = ff.finance_incentive;
            }

            if (dr) {
              await db.from(dtable).update({note:newNote, ...financeExtra}).eq("consultation_id", best.id);
            } else {
              await db.from(dtable).insert({consultation_id: best.id, note:newNote, ...financeExtra});
            }
          }

          const prev = (best.detail_memo as string) ?? "";
          await db.from("consultation_cases").update({
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
    console.error("secretary-ai error:", err);
    return new Response(
      JSON.stringify({reply:`오류: ${(err as Error).message}`, actions:[], saved:[], pendingUpdates:[]}),
      {status:500, headers:{...CORS,"Content-Type":"application/json"}}
    );
  }
});