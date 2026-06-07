// supabase/functions/secretary-ai-ins/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TODAY_ISO / TODAY_KR 은 serve() 내부에서 요청마다 계산 (모듈 캐시 방지)

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // ── 요청마다 KST 기준 오늘 날짜 계산 ──────────────────────────
  // 한국 시간 기준 오늘 날짜 계산 (UTC+9)
  const _now = new Date();
  const _kst = new Date(_now.getTime() + 9*60*60*1000);
  const TODAY_ISO = _kst.toISOString().slice(0,10);
  const _DOW_KO = ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"];
  const _DOW_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const TODAY_DOW_KO = _DOW_KO[_kst.getUTCDay()];
  const TODAY_DOW_EN = _DOW_EN[_kst.getUTCDay()];
  const TODAY_KR = _kst.toISOString().slice(0,10);
  // 다음 주 해당 요일 (0=일,1=월..6=토)
  function getNextWeekday(baseDate: string, weekday: number): string {
    const d = new Date(baseDate);
    const day = d.getDay(); // 0=일,1=월..6=토
    const dayKr = day === 0 ? 7 : day;
    const targetKr = weekday === 0 ? 7 : weekday;
    let diff = targetKr - dayKr;
    if (diff < 0) diff += 7;  // 이번 주 해당 요일까지
    diff += 7;                 // 다음 주이므로 +7
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0,10);
  }
  // 이번 주 해당 요일 (오늘 포함, 과거도 허용)
  function getThisWeekday(baseDate: string, weekday: number): string {
    const d = new Date(baseDate);
    const day = d.getDay();
    const dayKr = day === 0 ? 7 : day;
    const targetKr = weekday === 0 ? 7 : weekday;
    let diff = targetKr - dayKr;
    if (diff < 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0,10);
  }

  const SYSTEM = `You are a Korean AI secretary for an insurance consultant (보험설계사).
Today: ${TODAY_ISO} (${TODAY_DOW_EN}, ${TODAY_DOW_KO})
Korean week starts Monday. "다음 주 월요일" = ${getNextWeekday(TODAY_ISO,1)}, "다음 주 화요일" = ${getNextWeekday(TODAY_ISO,2)}, "다음 주 수요일" = ${getNextWeekday(TODAY_ISO,3)}, "다음 주 목요일" = ${getNextWeekday(TODAY_ISO,4)}, "다음 주 금요일" = ${getNextWeekday(TODAY_ISO,5)}, "다음 주 토요일" = ${getNextWeekday(TODAY_ISO,6)}, "다음 주 일요일" = ${getNextWeekday(TODAY_ISO,0)}
"이번 주 월요일" = ${getThisWeekday(TODAY_ISO,1)}, "이번 주 화요일" = ${getThisWeekday(TODAY_ISO,2)}, "이번 주 수요일" = ${getThisWeekday(TODAY_ISO,3)}, "이번 주 목요일" = ${getThisWeekday(TODAY_ISO,4)}, "이번 주 금요일" = ${getThisWeekday(TODAY_ISO,5)}, "이번 주 토요일" = ${getThisWeekday(TODAY_ISO,6)}, "이번 주 일요일" = ${getThisWeekday(TODAY_ISO,0)}
Always calculate relative dates based on TODAY_ISO above. "월요일날", "이번 월요일" → 이번 주 월요일 = ${getThisWeekday(TODAY_ISO,1)}. "다음 월요일" → ${getNextWeekday(TODAY_ISO,1)}.

CRITICAL: Output ONLY raw JSON. No markdown, no code blocks, no text before/after JSON.

Format:
{"reply":"한국어 답변","actions":[]}

Action types:

todo: {"type":"todo","title":"string","description":null,"priority":"urgent|normal|low","category":"insurance|followup|admin|null","due_date":"YYYY-MM-DD|null"}

schedule: {"type":"schedule","title":"string","description":null,"schedule_date":"YYYY-MM-DD","start_time":"HH:MM|null","category":"meeting|call|task|followup","location":null,"related_type":"insurance"}

schedule_edit (EDIT existing schedule - change title/date/time): {"type":"schedule_edit","title_keyword":"string","new_title":"string|null","new_date":"YYYY-MM-DD|null","new_time":"HH:MM|null","new_location":"string|null"}

order (NEW insurance consultation): {"type":"order","customer_name":"string","phone_last4":"string|null","channel":"kakao|phone|visit|web","work_type":"insurance","summary":"string","detail":null}

claim (insurance claim request): {"type":"claim","customer_name":"string","phone_last4":"string|null","product_name":"string","claim_date":"YYYY-MM-DD","claim_type":"inpatient|outpatient|surgery|death|other","memo":"string|null"}

consult_update (UPDATE existing customer insurance info): {"type":"consult_update","customer_name":"string","work_type":"insurance","keywords":["keyword1"],"update_memo":"string"}

policy (register insurance policy/contract): {"type":"policy","customer_name":"string","phone_last4":"string|null","product_name":"string","start_date":"YYYY-MM-DD|null","expiry_date":"YYYY-MM-DD|null","memo":"string|null"}

customer_info_update (update customer contact/account info): {"type":"customer_info_update","customer_name":"string","phone_last4":"string|null","phone":"string|null","bank_name":"string|null","bank_account":"string|null","card_company":"string|null","card_number":"string|null","memo":"string|null"}

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
- Schedule title/date/time/location change (수정, 변경) → schedule_edit
- Customer phone/bank/card info update → customer_info_update
- Insurance policy/contract registration → policy
- General question → actions:[]

SCHEDULE_EDIT RULES:
- "오늘 태안 미팅을 장미희 고객 태안 미팅으로 변경" → schedule_edit {title_keyword:"태안", new_title:"장미희 고객 태안 미팅"}
- "태안 미팅 시간 15:30으로 변경" → schedule_edit {title_keyword:"태안", new_time:"15:30"}
- title_keyword: 기존 일정에서 찾을 핵심 키워드 (짧게)
- new_title/new_date/new_time/new_location: 변경할 내용만 입력, 나머지는 null`;

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

    // ── confirmCustomerAction ────────────────────────────────────
    const { confirmCustomerAction } = body;
    if (confirmCustomerAction) {
      const { customer_key, action } = confirmCustomerAction;
      const innerSaved: {type:string;id:number}[] = [];
      if (action.type === "customer_info_update") {
        await saveCustomerInfo(db, customer_key, action, innerSaved);
      } else if (action.type === "policy") {
        await savePolicy(db, customer_key, action, TODAY_ISO, innerSaved);
      }
      return new Response(
        JSON.stringify({reply:`✅ ${action.type==="policy"?"계약":"고객 정보"} 저장 완료`, actions:[], saved:innerSaved, pendingUpdates:[], pendingCustomerSelects:[]}),
        {headers:{...CORS,"Content-Type":"application/json"}}
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

    // ── helper 함수 ───────────────────────────────────────────────
    async function saveCustomerInfo(db: any, cKey: string, a: Record<string,unknown>, saved: {type:string;id:number}[]) {
      const {data:existing} = await db.from("ins_customer_info").select("*").eq("customer_key", cKey).maybeSingle();
      const upsertData: Record<string,unknown> = {
        customer_key: cKey,
        phone: a.phone ?? existing?.phone ?? "",
        bank_name: a.bank_name ?? existing?.bank_name ?? "",
        bank_account: a.bank_account ?? existing?.bank_account ?? "",
        card_company: a.card_company ?? existing?.card_company ?? "",
        card_number: a.card_number ?? existing?.card_number ?? "",
        card_expiry: a.card_expiry ?? existing?.card_expiry ?? "",
        memo: a.memo ?? existing?.memo ?? "",
      };
      if (existing?.id) {
        const {data} = await db.from("ins_customer_info").update(upsertData).eq("id", existing.id).select("id").single();
        if (data) saved.push({type:"customer_info_update", id:data.id});
      } else {
        const {data} = await db.from("ins_customer_info").insert(upsertData).select("id").single();
        if (data) saved.push({type:"customer_info_update", id:data.id});
      }
    }
    async function savePolicy(db: any, cKey: string, a: Record<string,unknown>, todayIso: string, saved: {type:string;id:number}[]) {
      const {data,error} = await db.from("ins_policies").insert({
        customer_key: cKey,
        customer_name: a.customer_name,
        product_name: a.product_name ?? "미확인",
        start_date: a.start_date ?? todayIso,
        expiry_date: a.expiry_date ?? null,
        memo: a.memo ?? null,
      }).select("id").single();
      if (!error && data) saved.push({type:"policy", id:data.id});
    }

    const saved: {type:string;id:number;consultation_id?:number}[] = [];
    const pendingUpdates: {action:Record<string,unknown>;candidates:Record<string,unknown>[];bestMatch:Record<string,unknown>|null}[] = [];
    const pendingCustomerSelects: {action:Record<string,unknown>;candidates:{customer_key:string;customer_name:string;phone?:string}[]}[] = [];

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

        // ── 일정 수정 ──────────────────────────────────────────────
        if (a.type === "schedule_edit") {
          const kw = (a.title_keyword as string ?? "").toLowerCase();
          const {data:rows} = await db.from("ins_schedules")
            .select("id,title,schedule_date,start_time")
            .ilike("title", `%${kw}%`)
            .order("schedule_date", {ascending:true}).limit(5);
          if (rows && rows.length > 0) {
            const row = rows[0] as Record<string,unknown>;
            const patch: Record<string,unknown> = {};
            if (a.new_date)     patch.schedule_date = a.new_date;
            if (a.new_title)    patch.title         = a.new_title;
            if (a.new_time)     patch.start_time    = a.new_time;
            if (a.new_location) patch.location      = a.new_location;
            const {error:upErr} = await db.from("ins_schedules").update(patch).eq("id", row.id);
            if (!upErr) saved.push({type:"schedule_edit", id:row.id as number});
          }
        }

        // ── 상담 접수 ──────────────────────────────────────────────
        if (a.type === "order") {
          const last4 = String(a.phone_last4??"").replace(/[^0-9]/g,"").slice(-4);
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
          // ins_customer_info에 전화번호 자동 저장 (없을 때만)
          if (a.phone || last4) {
            const phone = String(a.phone??"").trim() || last4;
            const {data:existingInfo} = await db.from("ins_customer_info")
              .select("id").eq("customer_key", cKey).maybeSingle();
            if (!existingInfo) {
              await db.from("ins_customer_info").insert({
                customer_key: cKey,
                phone: phone,
                bank_name: "", bank_account: "",
                card_company: "", card_number: "", card_expiry: "", memo: "",
              });
            }
          }
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

        // ── 계약(policy) 등록 ─────────────────────────────────────
        if (a.type === "policy") {
          const last4 = String(a.phone_last4??"").replace(/[^0-9]/g,"").slice(-4);
          const name = String(a.customer_name).trim();
          // 항상 동명이인 검색
          const candidateMap = new Map<string,{customer_key:string;customer_name:string;phone?:string}>();
          const {data:caseMatches} = await db.from("ins_consultation_cases")
            .select("customer_key,customer_name,phone").eq("customer_name", name)
            .order("created_at",{ascending:false}).limit(20);
          const {data:infoMatches} = await db.from("ins_customer_info")
            .select("customer_key,phone").ilike("customer_key", `${name}_%`);
          for(const r of (caseMatches??[])) if(!candidateMap.has(r.customer_key)) candidateMap.set(r.customer_key,{customer_key:r.customer_key,customer_name:r.customer_name,phone:r.phone});
          for(const r of (infoMatches??[])) if(!candidateMap.has(r.customer_key)) candidateMap.set(r.customer_key,{customer_key:r.customer_key,customer_name:name,phone:r.phone});
          const candidates = Array.from(candidateMap.values());
          if(candidates.length === 0) {
            const cKey = last4 ? `${name}_${last4}` : name;
            await savePolicy(db, cKey, a, TODAY_ISO, saved);
          } else if(last4 && candidates.some(c=>c.customer_key===`${name}_${last4}`)) {
            await savePolicy(db, `${name}_${last4}`, a, TODAY_ISO, saved);
          } else {
            const newOption = last4
              ? {customer_key:`${name}_${last4}`,customer_name:name,phone:last4,isNew:true}
              : null;
            const allCandidates = newOption ? [...candidates,{...newOption}] : candidates;
            pendingCustomerSelects.push({action:a, candidates:allCandidates});
          }
        }

        // ── 고객 정보 업데이트 ─────────────────────────────────────
        if (a.type === "customer_info_update") {
          const last4 = String(a.phone_last4??"").replace(/[^0-9]/g,"").slice(-4);
          const name = String(a.customer_name).trim();
          // 항상 동명이인 검색 (전화번호 유무 관계없이)
          const candidateMap = new Map<string,{customer_key:string;customer_name:string;phone?:string}>();
          const {data:infoMatches} = await db.from("ins_customer_info")
            .select("customer_key,phone").ilike("customer_key", `${name}_%`);
          const {data:caseMatches} = await db.from("ins_consultation_cases")
            .select("customer_key,customer_name,phone").eq("customer_name", name)
            .order("created_at",{ascending:false}).limit(20);
          for(const r of (infoMatches??[])) candidateMap.set(r.customer_key,{customer_key:r.customer_key,customer_name:name,phone:r.phone});
          for(const r of (caseMatches??[])) if(!candidateMap.has(r.customer_key)) candidateMap.set(r.customer_key,{customer_key:r.customer_key,customer_name:r.customer_name,phone:r.phone});
          const candidates = Array.from(candidateMap.values());
          if(candidates.length === 0) {
            // 완전 신규 → phone_last4 있으면 이름_끝4자리, 없으면 이름만
            const cKey = last4 ? `${name}_${last4}` : name;
            await saveCustomerInfo(db, cKey, a, saved);
          } else if(last4 && candidates.some(c=>c.customer_key===`${name}_${last4}`)) {
            // 전화번호로 정확히 매칭되는 기존 고객 → 바로 저장
            await saveCustomerInfo(db, `${name}_${last4}`, a, saved);
          } else {
            // 동명이인 존재 → 선택 요청 (신규 추가 옵션도 포함)
            const newOption = last4
              ? {customer_key:`${name}_${last4}`,customer_name:name,phone:last4,isNew:true}
              : null;
            const allCandidates = newOption
              ? [...candidates,{...newOption}]
              : candidates;
            pendingCustomerSelects.push({action:a, candidates:allCandidates});
          }
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
      JSON.stringify({reply:parsed.reply, actions:parsed.actions, saved, pendingUpdates, pendingCustomerSelects}),
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