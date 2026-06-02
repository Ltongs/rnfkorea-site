// supabase/functions/secretary-ai/index.ts
// 배포: supabase functions deploy secretary-ai --no-verify-jwt

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

const TODAY = new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).replace(/\. /g,"-").replace(".","");
const TODAY_ISO = new Date().toISOString().slice(0,10);

const SYSTEM = `You are a Korean AI secretary for RNF Korea company.
Today: ${TODAY_ISO}

CRITICAL: Output ONLY raw JSON. No markdown, no code blocks, no explanation before/after JSON.

Output format:
{"reply":"한국어 답변","actions":[]}

Action types:

todo: {"type":"todo","title":"string","description":null,"priority":"urgent|normal|low","category":"insurance|tire|finance|forklift|battery|admin|null","due_date":"YYYY-MM-DD|null"}

schedule: {"type":"schedule","title":"string","description":null,"schedule_date":"YYYY-MM-DD","start_time":"HH:MM|null","category":"meeting|call|task|followup","location":null,"related_type":"insurance|tire|finance|forklift|battery|null"}

order (NEW customer inquiry): {"type":"order","customer_name":"string","phone":null,"channel":"kakao|phone|visit|web","work_type":"insurance|tire|finance|forklift|battery|null","summary":"string","detail":null}

consult_update (UPDATE existing customer info): {"type":"consult_update","customer_name":"string","work_type":"finance|insurance|tire|forklift|battery","keywords":["keyword1"],"update_memo":"string","update_summary":null}

DECISION RULES:
- "성수연 한도 6720만원" or "성수연 금리 9%" or any existing customer info update → consult_update
- New customer inquiry → order
- Task to do → todo  
- Meeting/call/visit → schedule
- General question → reply only, actions:[]

If no action needed, return actions:[].`;

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

    // ── confirmUpdate: 사용자가 확인 카드에서 승인한 경우
    if (confirmUpdate) {
      const { consultation_id, update_memo } = confirmUpdate;
      const { data: cur } = await db.from("consultation_cases").select("detail_memo").eq("id", consultation_id).single();
      const now = TODAY;
      const newMemo = cur?.detail_memo
        ? `${cur.detail_memo}\n\n[${now} AI비서]\n${update_memo}`
        : `[${now} AI비서]\n${update_memo}`;
      const { error } = await db.from("consultation_cases").update({ detail_memo: newMemo }).eq("id", consultation_id);
      if (error) throw new Error(error.message);
      return new Response(
        JSON.stringify({ reply: `✅ 상담#${consultation_id} 업데이트 완료`, actions: [], saved: [{ type:"consult_update", id:consultation_id }], pendingUpdates: [] }),
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
    if (aiData.error || !aiData.content) {
      throw new Error(aiData.error?.message ?? JSON.stringify(aiData));
    }

    const raw = (aiData.content?.[0]?.text ?? "{}").trim();

    // JSON 파싱
    let parsed: { reply: string; actions: Record<string,unknown>[] } = { reply: raw, actions: [] };
    try {
      const clean = raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```\s*$/i,"").trim();
      if (clean.startsWith("{")) parsed = JSON.parse(clean);
      else return new Response(JSON.stringify({ reply:raw, actions:[], saved:[], pendingUpdates:[] }), { headers:{...CORS,"Content-Type":"application/json"} });
    } catch {
      return new Response(JSON.stringify({ reply:raw, actions:[], saved:[], pendingUpdates:[] }), { headers:{...CORS,"Content-Type":"application/json"} });
    }

    const saved: { type:string; id:number; consultation_id?:number }[] = [];
    const pendingUpdates: { action:Record<string,unknown>; candidates:Record<string,unknown>[]; bestMatch:Record<string,unknown>|null }[] = [];

    if (autoSave && parsed.actions?.length > 0) {
      for (const a of parsed.actions) {

        if (a.type === "todo") {
          const { data, error } = await db.from("secretary_todos").insert({
            title:a.title, description:a.description??null, priority:a.priority??"normal",
            category:a.category??null, due_date:a.due_date??null,
          }).select("id").single();
          if (!error && data) saved.push({ type:"todo", id:data.id });
        }

        if (a.type === "schedule") {
          const { data, error } = await db.from("secretary_schedules").insert({
            title:a.title, description:a.description??null, schedule_date:a.schedule_date??TODAY_ISO,
            start_time:a.start_time??null, category:a.category??"meeting",
            location:a.location??null, related_type:a.related_type??null,
          }).select("id").single();
          if (!error && data) saved.push({ type:"schedule", id:data.id });
        }

        if (a.type === "order") {
          const wt = a.work_type ? (WMAP[a.work_type as string] ?? a.work_type) : null;
          let cid: number|null = null;
          if (wt) {
            const { data: cd } = await db.from("consultation_cases").insert({
              customer_name:a.customer_name, phone:a.phone??"미입력",
              work_type:wt, status:"new",
              summary:`[AI비서 자동접수] ${a.summary}`,
              detail_memo:a.detail??null, followup_needed:false,
              call_datetime:new Date().toISOString(),
            }).select("id").single();
            if (cd) cid = cd.id;
          }
          const { data: od } = await db.from("secretary_orders").insert({
            customer_name:a.customer_name, phone:a.phone??null, channel:a.channel??"phone",
            work_type:a.work_type??null, summary:a.summary, detail:a.detail??null,
            status:"new", consultation_id:cid,
          }).select("id").single();
          if (od) saved.push({ type:"order", id:od.id, consultation_id:cid??undefined });
        }

        if (a.type === "consult_update") {
          // 고객명 + 업무유형으로 DB 검색
          const wt = WMAP[a.work_type as string] ?? a.work_type;
          const kws = (a.keywords as string[]) ?? [];

          const { data: cands } = await db.from("consultation_cases")
            .select("id,customer_name,phone,work_type,status,summary,detail_memo,created_at")
            .eq("customer_name", a.customer_name)
            .eq("work_type", wt)
            .order("created_at", { ascending:false })
            .limit(5);

          if (!cands || cands.length === 0) {
            // 매칭 건 없음 → pendingUpdates에 추가해서 프론트에 알림
            pendingUpdates.push({ action:a, candidates:[], bestMatch:null });
            continue;
          }

          // 1건이면 바로 업데이트, 여러 건이면 키워드 스코어링
          let best = cands[0] as Record<string,unknown>;
          if (cands.length > 1) {
            let top = -1;
            for (const c of cands as Record<string,unknown>[]) {
              const txt = `${c.summary??""} ${c.detail_memo??""}`.toLowerCase();
              const score = kws.filter(k => txt.includes(k.toLowerCase())).length;
              if (score > top) { top = score; best = c; }
            }
          }

          if (cands.length === 1) {
            // 단건 → 즉시 자동 업데이트 (확인 불필요)
            const cur = best;
            const now = TODAY;
            const newMemo = cur.detail_memo
              ? `${cur.detail_memo}\n\n[${now} AI비서]\n${a.update_memo}`
              : `[${now} AI비서]\n${a.update_memo}`;
            const upd: Record<string,unknown> = { detail_memo: newMemo };
            if (a.update_summary) upd.summary = a.update_summary;
            const { error } = await db.from("consultation_cases").update(upd).eq("id", cur.id);
            if (!error) saved.push({ type:"consult_update", id:cur.id as number });
          } else {
            // 복수 건 → 확인 필요 (pendingUpdates)
            pendingUpdates.push({ action:a, candidates:cands as Record<string,unknown>[], bestMatch:best });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ reply:parsed.reply, actions:parsed.actions, saved, pendingUpdates }),
      { headers: { ...CORS, "Content-Type":"application/json" } }
    );

  } catch (err) {
    console.error("secretary-ai error:", err);
    return new Response(
      JSON.stringify({ reply:`오류: ${(err as Error).message}`, actions:[], saved:[], pendingUpdates:[] }),
      { status:500, headers:{ ...CORS, "Content-Type":"application/json" } }
    );
  }
});