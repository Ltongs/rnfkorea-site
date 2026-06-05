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

const DTABLE: Record<string,string> = {
  registration_insurance: "consultation_insurance_details",
  tire_sales:             "consultation_tire_details",
  finance:                "consultation_finance_details",
  forklift_sales:         "consultation_forklift_details",
  battery_sales:          "consultation_battery_details",
};

// 현대건설기계 유효 상태값
const HCM_STATUSES = ["접수","신용조회","승인","보완","거절","서류등록","전자계약발송","확정","보류"] as const;
type HCMStatus = typeof HCM_STATUSES[number];

const KAKAO_EDGE_URL = "https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/send-hyundaicm-kakao";

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

consult_update (UPDATE existing customer info):
{"type":"consult_update","customer_name":"string","work_type":"finance|insurance|tire|forklift|battery|null","keywords":["keyword1"],"update_memo":"string",
"direct_fields":{"phone":null,"status":null,"finance_stage":null,"followup_needed":null,"next_followup_date":null,"summary":null},
"finance_fields":{"finance_amount":null,"finance_interest_rate":null,"finance_period":null,"finance_company":null,"finance_product":null,"finance_vehicle_model":null,"finance_incentive":null}}

MULTIPLE customers: if message mentions 2+ customers with same update → generate one consult_update action per customer
Example: "성수연, 정부경 승인" → two separate consult_update actions, one for each

direct_fields rules:
- phone update: "전화번호 010-xxxx-xxxx" → direct_fields.phone = "010-xxxx-xxxx"
- status update (consultation_cases.status): general status
  - "승인" or "완료" → status: "completed"
  - "진행중" or "상담중" → status: "in_progress"
  - "대기" or "보류" → status: "pending"
  - "신규" → status: "new"
- finance_stage (consultation_finance_details.finance_stage): for finance work_type ONLY
  - "승인" or "승인완료" → finance_stage: "approved"
  - "확정" or "확정완료" → finance_stage: "confirmed"
  - "부결" or "거절" → finance_stage: "rejected"
  - "서류징구" or "서류요청" → finance_stage: "documents_requested"
  - "견적제출" → finance_stage: "quote_submitted"
  - "상담" or "상담중" → finance_stage: "consulting"
  - ALWAYS set finance_stage when work_type is finance and status change is mentioned
- followup: "사후관리 필요" → followup_needed: true, next_followup_date: "YYYY-MM-DD" if date mentioned
- null for fields not mentioned

hyundaicm_update (UPDATE hyundaicm_tasks status or credit result):
{"type":"hyundaicm_update","customer_name":"string","next_status":"접수|신용조회|승인|보완|거절|서류등록|전자계약발송|확정|보류","nice_score":null,"credit_rate":null,"credit_incentive":null,"loan_limit":null,"loan_period":null,"credit_note":null,"special_note":null}

hyundaicm_update rules:
- "승인" → include nice_score, credit_rate, credit_incentive, loan_limit if mentioned
- "보완" or "거절" → include credit_note (reason)
- "확정" → include loan_period if mentioned
- "보류" → include special_note if mentioned
- customer_name: extract the name from the message
- next_status must be one of the exact Korean values above

finance_fields rules (only for finance type):
- "한도 6720만원" → finance_amount: 67200000
- "금리 9%" or "금리 9.0%" → finance_interest_rate: 9.0
- "36개월" or "기간 36" → finance_period: 36
- "인센티브 2.5%" → finance_incentive: 2.5
- null if not mentioned

schedule_update (UPDATE existing schedule progress):
{"type":"schedule_update","title_keyword":"string","progress_memo":"string","next_schedule_date":"YYYY-MM-DD|null","next_schedule_time":"HH:MM|null"}
- Use when user mentions progress/result of a scheduled meeting or task
- title_keyword: key words from the schedule title to find it
- progress_memo: what happened, results, next actions

RULES (priority order — match the FIRST rule that fits):

KEY DISTINCTION — hyundaicm_update vs consult_update:
- hyundaicm_update: ONLY for customers in hyundaicm_tasks (건설기계 할부금융 심사 시스템)
  - Context clues: "현대건설기계", "심사", "할부", "서류등록", "전자계약", "신용조회"
  - "성수연 승인" alone is AMBIGUOUS — check context. If no hyundaicm context → consult_update
- consult_update: for customers in consultation_cases (금융/보험/타이어/지게차/배터리 상담관리)
  - Context clues: "금융상담", "보험", "타이어", "상담관리", "진행단계", or no specific system mentioned

1. ONLY use hyundaicm_update when message explicitly mentions 현대건설기계/심사/할부금융 context
   OR uses hyundaicm-specific terms: 서류등록, 전자계약발송, 신용조회, 보완요청
   - "보류입니다", "보류로 변경" with hyundaicm context → hyundaicm_update next_status="보류"
   - "승인났어요" with hyundaicm context → hyundaicm_update next_status="승인"
2. Status/info update for consultation_cases customers → consult_update
   - "승인으로 진행상태 변경", "진행중으로 변경", "전화번호 업데이트" → consult_update
   - Use direct_fields.status for status changes: 승인→"completed", 진행중→"in_progress", 대기→"pending"
3. New customer inquiry → order
4. Task → todo
5. Meeting/schedule → schedule
6. General question → actions:[]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const { messages, autoSave, confirmUpdate, confirmHyundaiUpdate } = body;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY 없음");

    const sbUrl = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const sbKey = Deno.env.get("APP_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const db = createClient(sbUrl, sbKey);

    // ── confirmUpdate: 기존 상담관리 업데이트 승인
    if (confirmUpdate) {
      const { consultation_id, update_memo, direct_fields } = confirmUpdate;
      const appendText = `[${TODAY_KR} AI비서] ${update_memo}`;

      const { data: caseRow } = await db.from("consultation_cases")
        .select("detail_memo,work_type").eq("id", consultation_id).single();

      const dtable = DTABLE[caseRow?.work_type as string];
      if (dtable) {
        const { data: dr } = await db.from(dtable).select("note").eq("consultation_id", consultation_id).single();
        const newNote = dr?.note ? `${dr.note}\n${appendText}` : appendText;
        await db.from(dtable).update({ note: newNote }).eq("consultation_id", consultation_id);
      }

      // direct_fields: 실제 컬럼 직접 업데이트
      const directCols: Record<string,unknown> = {};
      if (direct_fields) {
        if (direct_fields.phone != null)              directCols.phone              = direct_fields.phone;
        if (direct_fields.status != null)             directCols.status             = direct_fields.status;
        if (direct_fields.followup_needed != null)    directCols.followup_needed    = direct_fields.followup_needed;
        if (direct_fields.next_followup_date != null) directCols.next_followup_date = direct_fields.next_followup_date;
        if (direct_fields.summary != null)            directCols.summary            = direct_fields.summary;
      }

      const prevMemo = caseRow?.detail_memo ?? "";
      await db.from("consultation_cases").update({
        detail_memo: prevMemo ? `${prevMemo}\n${appendText}` : appendText,
        ...directCols,
      }).eq("id", consultation_id);

      return new Response(
        JSON.stringify({ reply:`✅ 상담#${consultation_id} 업데이트 완료`, actions:[], saved:[{type:"consult_update",id:consultation_id}], pendingUpdates:[] }),
        { headers: { ...CORS, "Content-Type":"application/json" } }
      );
    }

    // ── confirmHyundaiUpdate: 현대건설기계 상태 변경 최종 확인
    if (confirmHyundaiUpdate) {
      const { task_id, next_status, patch, caseNo, customerName, customerType, equipmentTon, financeCompany, salesRep, installmentPrincipal } = confirmHyundaiUpdate;

      // DB 업데이트
      const { error } = await db.from("hyundaicm_tasks").update({ status: next_status, ...patch }).eq("id", task_id);
      if (error) throw error;

      // 카카오 알림 발송 (기존 현대건설기계 페이지와 동일한 payload 구조)
      const kakaoPayload: Record<string, unknown> = {
        type:                 "status_change",
        caseNo,
        customerName,
        customerType,
        equipmentTon,
        financeCompany,
        salesRep,
        installmentPrincipal,
        prevStatus:           patch._prevStatus ?? "",
        nextStatus:           next_status,
        niceScore:            patch.nice_score ?? undefined,
        creditRate:           patch.credit_rate ?? undefined,
        creditIncentive:      patch.credit_incentive ?? undefined,
        bizHistory:           patch.biz_history ?? undefined,
        loanLimit:            patch.loan_limit ?? undefined,
        loanPeriod:           patch.loan_period ?? undefined,
      };

      // 카카오 알림 (실패해도 업무 영향 없음)
      try {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        await fetch(KAKAO_EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
          body: JSON.stringify(kakaoPayload),
        });
      } catch (e) { console.warn("[kakao] 발송 실패:", e); }

      return new Response(
        JSON.stringify({
          reply: `✅ **${customerName}** 건 → **${next_status}** 상태 변경 완료. 카카오 알림 발송됨.`,
          actions: [],
          saved: [{ type: "hyundaicm_update", id: task_id }],
          pendingUpdates: [],
          pendingHyundaiUpdates: [],
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
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
      else return new Response(JSON.stringify({reply:raw,actions:[],saved:[],pendingUpdates:[],pendingHyundaiUpdates:[]}),{headers:{...CORS,"Content-Type":"application/json"}});
    } catch {
      return new Response(JSON.stringify({reply:raw,actions:[],saved:[],pendingUpdates:[],pendingHyundaiUpdates:[]}),{headers:{...CORS,"Content-Type":"application/json"}});
    }

    const saved: {type:string;id:number;consultation_id?:number}[] = [];
    const pendingUpdates: {action:Record<string,unknown>;candidates:Record<string,unknown>[];bestMatch:Record<string,unknown>|null}[] = [];
    const pendingHyundaiUpdates: {action:Record<string,unknown>;matches:{id:number;customer_name:string;status:string;caseNo:string;equipment_ton:string|null;finance_company:string|null;customer_type:string;sales_rep:string|null;installment_principal:number|null}[]}[] = [];

    if (autoSave && parsed.actions?.length > 0) {
      for (const a of parsed.actions) {

        // ── hyundaicm_update 처리
        if (a.type === "hyundaicm_update") {
          const customerName = a.customer_name as string;
          const nextStatus   = a.next_status as string;

          if (!HCM_STATUSES.includes(nextStatus as HCMStatus)) {
            pendingHyundaiUpdates.push({ action: a, matches: [] });
            continue;
          }

          // 이름으로 후보 검색 (최근 10건, 완료/확정 제외 우선)
          const { data: candidates } = await db
            .from("hyundaicm_tasks")
            .select("id,customer_name,status,created_at,equipment_ton,finance_company,customer_type,sales_rep,installment_principal,company_name")
            .ilike("customer_name", `%${customerName}%`)
            .order("created_at", { ascending: false })
            .limit(10);

          if (!candidates || candidates.length === 0) {
            pendingHyundaiUpdates.push({ action: a, matches: [] });
            continue;
          }

          // 월별 케이스 번호 계산
          const { data: allRows } = await db
            .from("hyundaicm_tasks")
            .select("id,created_at")
            .order("created_at", { ascending: true });

          const caseNoMap: Record<string, string> = {};
          if (allRows) {
            const monthCount: Record<string, number> = {};
            for (const r of allRows) {
              const d  = new Date(r.created_at);
              const ym = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}`;
              monthCount[ym] = (monthCount[ym] ?? 0) + 1;
              caseNoMap[String(r.id)] = `${ym}-${String(monthCount[ym]).padStart(3,"0")}`;
            }
          }

          const matches = candidates.map((c: Record<string,unknown>) => ({
            id:                   c.id as number,
            customer_name:        c.customer_name as string,
            status:               c.status as string,
            caseNo:               caseNoMap[String(c.id)] ?? String(c.id),
            equipment_ton:        c.equipment_ton as string|null,
            finance_company:      c.finance_company as string|null,
            customer_type:        c.customer_type as string,
            sales_rep:            c.sales_rep as string|null,
            installment_principal:c.installment_principal as number|null,
          }));

          // patch 구성 (신용결과 필드 포함)
          const patch: Record<string, unknown> = { _prevStatus: matches[0]?.status };
          if (a.nice_score != null)       patch.nice_score        = a.nice_score;
          if (a.credit_rate != null)      patch.credit_rate       = a.credit_rate;
          if (a.credit_incentive != null) patch.credit_incentive  = a.credit_incentive;
          if (a.loan_limit != null)       patch.loan_limit        = a.loan_limit;
          if (a.loan_period != null)      patch.loan_period       = a.loan_period;
          if (a.credit_note != null)      patch.credit_note       = a.credit_note;
          if (a.special_note != null)     patch.special_note      = a.special_note;
          if (["승인","보완","거절"].includes(nextStatus)) {
            patch.interest_rate = a.credit_rate ?? null;
            patch.incentive     = a.credit_incentive ?? null;
          }

          pendingHyundaiUpdates.push({ action: { ...a, patch }, matches });
          continue;
        }

        if (a.type === "schedule_update") {
          const kw = (a.title_keyword as string ?? "").toLowerCase();
          const {data:schRows} = await db.from("secretary_schedules")
            .select("id,title,progress_memo")
            .ilike("title", `%${kw}%`)
            .order("schedule_date", {ascending:false}).limit(5);
          if (schRows && schRows.length > 0) {
            const today = new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).replace(/\. /g,"-").replace(".","");
            const appendText = `[${today} AI비서] ${a.progress_memo}`;
            const best = schRows[0] as Record<string,unknown>;
            const prev = (best.progress_memo as string) ?? "";
            const patch: Record<string,unknown> = {
              progress_memo: prev ? `${prev}\n${appendText}` : appendText,
            };
            if (a.next_schedule_date) {
              patch.next_schedule_date = a.next_schedule_date;
              patch.next_schedule_time = a.next_schedule_time ?? null;
              await db.from("secretary_schedules").insert({
                title: best.title,
                schedule_date: a.next_schedule_date,
                start_time: a.next_schedule_time ?? null,
                description: prev ? `${prev}\n${appendText}` : appendText,
              });
            }
            await db.from("secretary_schedules").update(patch).eq("id", best.id);
            saved.push({type:"schedule_update", id:best.id as number});
          }
        }

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

          // work_type 조건 없이 이름만으로 검색 (AI가 work_type을 잘못 추출하는 경우 대비)
          let query = db.from("consultation_cases")
            .select("id,customer_name,work_type,status,summary,detail_memo,created_at")
            .ilike("customer_name", `%${a.customer_name}%`)
            .order("created_at",{ascending:false}).limit(10);

          // work_type이 명확할 때만 필터 추가
          if (wt && wt !== "null" && wt !== "undefined") {
            query = db.from("consultation_cases")
              .select("id,customer_name,work_type,status,summary,detail_memo,created_at")
              .ilike("customer_name", `%${a.customer_name}%`)
              .eq("work_type", wt)
              .order("created_at",{ascending:false}).limit(10);
          }

          const {data:cands} = await query;

          // work_type 필터로 못 찾은 경우 work_type 조건 없이 재검색
          let finalCands = cands;
          if (!finalCands || finalCands.length === 0) {
            const {data:fallback} = await db.from("consultation_cases")
              .select("id,customer_name,work_type,status,summary,detail_memo,created_at")
              .ilike("customer_name", `%${a.customer_name}%`)
              .order("created_at",{ascending:false}).limit(10);
            finalCands = fallback;
          }

          if (!finalCands || finalCands.length === 0) {
            pendingUpdates.push({action:a, candidates:[], bestMatch:null});
            continue;
          }

          const cands2 = finalCands;

          let best = cands2[0] as Record<string,unknown>;
          if (cands2.length > 1) {
            let top = -1;
            for (const c of cands2 as Record<string,unknown>[]) {
              const txt = `${c.summary??""} ${c.detail_memo??""}`.toLowerCase();
              const score = kws.filter(k=>txt.includes(k.toLowerCase())).length;
              if (score > top) { top=score; best=c; }
            }
          }

          const appendText = `[${TODAY_KR} AI비서] ${a.update_memo}`;
          const dtable = DTABLE[wt];

          if (dtable) {
            const {data:dr} = await db.from(dtable).select("note").eq("consultation_id", best.id).maybeSingle();
            const newNote = dr?.note ? `${dr.note}\n${appendText}` : appendText;

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

          // direct_fields: consultation_cases 컬럼 직접 업데이트
          const df = a.direct_fields as Record<string,unknown>|null;
          const caseDirectUpdate: Record<string,unknown> = {};
          let financeStageValue: string|null = null;

          if (df) {
            if (df.phone != null)               caseDirectUpdate.phone               = df.phone;
            if (df.status != null)              caseDirectUpdate.status              = df.status;
            if (df.followup_needed != null)     caseDirectUpdate.followup_needed     = df.followup_needed;
            if (df.next_followup_date != null)  caseDirectUpdate.next_followup_date  = df.next_followup_date;
            if (df.summary != null)             caseDirectUpdate.summary             = df.summary;
            if (df.finance_stage != null)       financeStageValue = df.finance_stage as string;
          }

          // update_memo에서 상태/finance_stage 자동 추출 (AI가 direct_fields 누락 시 보완)
          const memoText = (a.update_memo as string ?? "").toLowerCase();
          if (!caseDirectUpdate.status) {
            if (memoText.includes("승인"))                                              caseDirectUpdate.status = "completed";
            else if (memoText.includes("진행중") || memoText.includes("상담중"))        caseDirectUpdate.status = "in_progress";
            else if (memoText.includes("대기") || memoText.includes("보류"))           caseDirectUpdate.status = "pending";
            else if (memoText.includes("완료"))                                        caseDirectUpdate.status = "completed";
          }
          if (!financeStageValue && wt === "finance") {
            if (memoText.includes("확정"))                    financeStageValue = "confirmed";
            else if (memoText.includes("승인"))               financeStageValue = "approved";
            else if (memoText.includes("부결") || memoText.includes("거절")) financeStageValue = "rejected";
            else if (memoText.includes("서류"))               financeStageValue = "documents_requested";
            else if (memoText.includes("견적"))               financeStageValue = "quote_submitted";
            else if (memoText.includes("상담"))               financeStageValue = "consulting";
          }
          // phone 자동 추출
          if (!caseDirectUpdate.phone) {
            const pm = memoText.match(/01[0-9]-?[0-9]{3,4}-?[0-9]{4}/);
            if (pm) caseDirectUpdate.phone = pm[0];
          }

          // finance_stage 업데이트 (consultation_finance_details 테이블)
          if (financeStageValue && wt === "finance") {
            const {data:fdr} = await db.from("consultation_finance_details")
              .select("consultation_id").eq("consultation_id", best.id).maybeSingle();
            if (fdr) {
              await db.from("consultation_finance_details")
                .update({ finance_stage: financeStageValue })
                .eq("consultation_id", best.id);
            } else {
              await db.from("consultation_finance_details")
                .insert({ consultation_id: best.id, finance_stage: financeStageValue });
            }
          }

          const prev = (best.detail_memo as string) ?? "";
          await db.from("consultation_cases").update({
            detail_memo: prev ? `${prev}\n${appendText}` : appendText,
            ...caseDirectUpdate,
          }).eq("id", best.id);

          saved.push({type:"consult_update", id:best.id as number});
        }
      }
    }

    return new Response(
      JSON.stringify({reply:parsed.reply, actions:parsed.actions, saved, pendingUpdates, pendingHyundaiUpdates}),
      { headers:{...CORS,"Content-Type":"application/json"} }
    );

  } catch (err) {
    console.error("secretary-ai error:", err);
    return new Response(
      JSON.stringify({reply:`오류: ${(err as Error).message}`, actions:[], saved:[], pendingUpdates:[], pendingHyundaiUpdates:[]}),
      {status:500, headers:{...CORS,"Content-Type":"application/json"}}
    );
  }
});