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

// 한국 시간 기준 오늘 날짜 계산 (UTC+9)
const _now = new Date();
const _kst = new Date(_now.getTime() + 9*60*60*1000);
const TODAY_ISO = _kst.toISOString().slice(0,10);
const _DOW_KO = ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"];
const _DOW_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TODAY_DOW_KO = _DOW_KO[_kst.getUTCDay()];
const TODAY_DOW_EN = _DOW_EN[_kst.getUTCDay()];
// 한국 요일 기준: 월요일=1, 화요일=2, 수요일=3, 목요일=4, 금요일=5, 토요일=6, 일요일=0
// "다음 주 월요일" = 이번 주 월요일 + 7일 (월요일 시작 기준)
function getNextWeekday(baseDate: string, weekday: number): string {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0=일,1=월,...,6=토
  const dayKr = day === 0 ? 7 : day; // 한국식: 월=1..일=7
  const targetKr = weekday === 0 ? 7 : weekday;
  let diff = targetKr - dayKr;
  if (diff <= 0) diff += 7; // 이미 지났으면 다음 주
  diff += 7; // "다음 주"이므로 +7
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0,10);
}
// 예: getNextWeekday(TODAY_ISO, 2) → 다음 주 화요일
const TODAY_KR  = new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"})
  .replace(/\. /g,"-").replace(".","");

const SYSTEM = `You are a Korean AI secretary for RNF Korea company.
Today: ${TODAY_ISO} (${TODAY_DOW_EN}, ${TODAY_DOW_KO})
Korean week starts Monday. "다음 주 월요일" = ${getNextWeekday(TODAY_ISO,1)}, "다음 주 화요일" = ${getNextWeekday(TODAY_ISO,2)}, "다음 주 수요일" = ${getNextWeekday(TODAY_ISO,3)}, "다음 주 목요일" = ${getNextWeekday(TODAY_ISO,4)}, "다음 주 금요일" = ${getNextWeekday(TODAY_ISO,5)}, "다음 주 토요일" = ${getNextWeekday(TODAY_ISO,6)}, "이번 주 일요일" = ${getNextWeekday(TODAY_ISO,0)}
"이번 주 일요일" and "다음 주 일요일" use weekday=0. Always calculate dates dynamically based on TODAY_ISO above.
"이번 주 월요일" means the Monday of the current week (may be in the past).
Always calculate relative dates based on Korean week (Monday=start).

CRITICAL: Output ONLY raw JSON. No markdown, no code blocks, no text before/after JSON.

Format:
{"reply":"한국어 답변","actions":[]}

Action types:

todo: {"type":"todo","title":"string","description":null,"priority":"urgent|normal|low","category":"insurance|tire|finance|forklift|battery|admin|null","due_date":"YYYY-MM-DD|null"}

schedule: {"type":"schedule","title":"string","description":null,"schedule_date":"YYYY-MM-DD","start_time":"HH:MM|null","category":"meeting|call|task|followup","location":null,"related_type":"insurance|tire|finance|forklift|battery|null"}

order (NEW customer): {"type":"order","customer_name":"string","phone":null,"channel":"kakao|phone|visit|web","work_type":"insurance|tire|finance|forklift|battery|null","summary":"string","detail":null,
"tire_fields":{"vehicle_info":"string|null","vehicle_type":"string|null","tire_size":"string|null","front_quantity":"number|null","rear_quantity":"number|null","process_status":"발주","region_detail":"string|null"}}

CRITICAL tire_fields rules — MUST FILL when work_type is "tire":
- ALWAYS include tire_fields object when work_type is "tire"
- vehicle_info: 메시지에서 차량 브랜드 추출 — "두산"→"두산", "현대"→"현대", "TCM"→"TCM", "도요타"→"도요타"
- vehicle_type: 메시지에서 차량 톤수/종류 추출 — "3톤"→"3톤", "5톤"→"5톤", "1톤"→"1톤"
- tire_size: 메시지에서 타이어 규격 추출 — "18*7-8"→"18*7-8", "250-15"→"250-15", "28*9-15"→"28*9-15"
- front_quantity: 전륜 수량 숫자 (없으면 null)
- rear_quantity: 후륜 수량 숫자 — "후륜 2개"→2, "2개"→2 (전/후 구분 없으면 rear에)
- process_status: 항상 "발주" (고정값, 절대 null 금지)
- MANDATORY EXAMPLE:
  Input: "형제중기 18*7-8 두산 3톤 후륜 2개 주문"
  Output tire_fields: {"vehicle_info":"두산","vehicle_type":"3톤","tire_size":"18*7-8","front_quantity":null,"rear_quantity":2,"process_status":"발주","region_detail":null}

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

order_update (UPDATE tb_orders status - tire/battery orders):
{"type":"order_update","customer_name":"string","product_keyword":"string|null","next_status":"forwarded|delivered|wheel_returned|invoiced","memo":"string|null","price_to_customer":null,"price_from_jinheung":null,"margin":null}
- next_status values:
  "forwarded"     → (주)진흥 전달 완료 (forwarded_at 자동 기록)
  "delivered"     → 납품 완료 (delivered_at 자동 기록)
  "wheel_returned"→ 휠 반납 완료 (wheel_returned_at 자동 기록)
  "invoiced"      → 계산서 발행 완료 → 주문 완료 처리 (invoiced_at 자동 기록)
- customer_name: 고객명 or 회사명
- product_keyword: 타이어 규격/품명 일부 (알 경우)
- price_to_customer: 고객 판매가 (원, "120만원" → 1200000)
- price_from_jinheung: 진흥 매입가
- margin: 마진 (직접 입력 또는 자동 계산)
- Use when: "형제중기 타이어 진흥 전달", "OO 납품완료", "OO 휠 반납", "OO 계산서 발행"

narumi_update (UPDATE narumi_tasks stage):
{"type":"narumi_update","customer_name":"string","vin_keyword":"string|null","next_stage":"보험|등록서류|등록완료|완료|보류|보류해제|우편발송","memo":"string|null","tracking_no":"string|null","hold_reason":"string|null","next_followup_date":"YYYY-MM-DD|null"}
- next_stage values:
  "보험"→has_insurance=true
  "등록서류"→docs_ready=true
  "등록완료"→is_registered=true
  "완료"→status=completed
  "보류"→on_hold=true (hold_reason, next_followup_date 포함)
  "보류해제"→on_hold=false
  "우편발송"→postal_tracking_no 업데이트 (tracking_no 필수)
- customer_name: 고객명 or 회사명
- vin_keyword: VIN 일부 (알 경우)
- tracking_no: 등기번호 (우편발송 시)
- hold_reason: 보류 사유
- next_followup_date: 보류 시 다음 확인 날짜

schedule_edit (EDIT existing schedule - change date/title/time):
{"type":"schedule_edit","title_keyword":"string","new_date":"YYYY-MM-DD|null","new_title":"string|null","new_time":"HH:MM|null","new_location":"string|null"}
- Use when user says "일정 수정", "날짜 변경", "XX일로 바꿔줘", "제목 변경"
- title_keyword: key words from the schedule title to find it
- Only set fields that need to change, leave others null
- Example: "14일 뉴질랜드 박람회 일정을 24일로 수정" → title_keyword:"뉴질랜드", new_date:"2026-06-24"

schedule_update (UPDATE existing schedule progress + optional next schedule/todo):
{"type":"schedule_update","title_keyword":"string","progress_memo":"string","next_schedule_date":"YYYY-MM-DD|null","next_schedule_time":"HH:MM|null","next_schedule_title":"string|null","create_todo":false,"todo_title":"string|null","mark_done":false}
- Use when user mentions progress/result of a scheduled meeting or task
- title_keyword: key words from the schedule title to find it (use most distinctive word)
- progress_memo: what happened, results, next actions
- next_schedule_date: if next meeting/visit/check is mentioned, set the date (use relative dates: "다음 주 화요일" → calculate actual date from today ${TODAY_ISO})
- next_schedule_title: title for the next schedule if different from original
- create_todo: true if a todo item should be created instead of schedule
- todo_title: title for the todo item
- mark_done: true if this schedule should be marked as completed

MULTIPLE schedules: if message mentions updates for 2+ different schedules → generate one schedule_update per item
Example: "형제중기 A/S 화요일 재장착, 라이즈리프트 완료, 아톰리프트 월요일 확인" → THREE schedule_update actions

CRITICAL schedule vs schedule_update distinction:
- schedule (NEW): 아직 일정이 없고 앞으로 할 일을 등록 → "반출 예정", "방문 예정", "확인 필요", "어레인지 완료" (새 일정 생성)
- schedule_update (UPDATE): 이미 등록된 일정의 진행상황 업데이트 → "완료됐습니다", "결과는", "미팅 후"

COMPLEX MESSAGE with multiple NEW schedules example:
Input: "형제중기 A/S는 일요일 반출후 다음 주 화요일 재장착할 예정입니다. 라이즈리프트와 삼우 방문일정은 어레인지 완료되었습니다. 아톰리프트는 다음 주 월요일 진행상황 확인이 필요합니다."
→ FOUR schedule actions:
  1. schedule {title:"형제중기 A/S 타이어 반출", schedule_date:"이번 주 일요일", category:"task"}
  2. schedule {title:"형제중기 A/S 타이어 재장착", schedule_date:"다음 주 화요일", category:"task"}
  3. schedule {title:"라이즈리프트/삼우 방문", schedule_date:"(언급된 날짜 또는 오늘)", category:"meeting"}
  4. schedule {title:"아톰리프트 진행상황 확인", schedule_date:"다음 주 월요일", category:"followup"}

"이번 주 일요일" = ${getNextWeekday(TODAY_ISO,0)} (this Sunday)
"예정", "할 예정", "필요합니다", "어레인지 완료" → NEW schedule action, NOT schedule_update

RULES (priority order — match the FIRST rule that fits):

KEY DISTINCTION — hyundaicm_update vs consult_update:
- hyundaicm_update: ONLY for customers in hyundaicm_tasks (건설기계 할부금융 심사 시스템)
  - Context clues: "현대건설기계", "심사", "할부", "서류등록", "전자계약", "신용조회"
  - "성수연 승인" alone is AMBIGUOUS — check context. If no hyundaicm context → consult_update
- consult_update: for customers in consultation_cases (금융/보험/타이어/지게차/배터리 상담관리)
  - Context clues: "금융상담", "보험", "타이어", "상담관리", "진행단계", or no specific system mentioned

0. FIRST CHECK: schedule date/title/time change → schedule_edit
   TRIGGER WORDS: "수정", "변경해줘", "바꿔줘", "로 변경", "로 수정", "날짜 바꿔", "옮겨줘"
   Examples:
   - "14일 뉴질랜드 박람회를 24일로 수정" → schedule_edit {title_keyword:"뉴질랜드", new_date:"2026-06-24"}
   - "제주 출장 일정 22일로 변경" → schedule_edit {title_keyword:"제주", new_date:"2026-06-22"}
   - "홍승점 미팅 시간 오후 3시로 변경" → schedule_edit {title_keyword:"홍승점", new_time:"15:00"}
   IMPORTANT: If message contains schedule name + new date/time + 수정/변경 → ALWAYS schedule_edit, NOT schedule_update

1. ONLY use hyundaicm_update when message explicitly mentions 현대건설기계/심사/할부금융 context
1-b. narumi stage change → narumi_update (나르미, 차량등록, 보험완료, 등록서류, 등록완료 언급 시)
1-c. tire/battery order status change → order_update (타이어/배터리 주문, 진흥 전달, 납품, 휠반납, 계산서 언급 시)
1-d. schedule date/title change → schedule_edit (see rule 0 above)
   OR uses hyundaicm-specific terms: 서류등록, 전자계약발송, 신용조회, 보완요청
   - "보류입니다", "보류로 변경" with hyundaicm context → hyundaicm_update next_status="보류"
   - "승인났어요" with hyundaicm context → hyundaicm_update next_status="승인"
2. Status/info update for consultation_cases customers → consult_update
   - "승인으로 진행상태 변경", "진행중으로 변경", "전화번호 업데이트" → consult_update
   - "확정완료", "확정 처리" for finance customers → consult_update with finance_stage: "confirmed"
   - Use direct_fields.status for status changes: 승인→"completed", 진행중→"in_progress", 대기→"pending"
   - IMPORTANT: customer names like "성수연", "정부경" without explicit hyundaicm context → consult_update
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

    // ── schedule_edit: autoSave 여부와 무관하게 항상 실행
    // 사용자 JWT (google-calendar-sync 호출 시 Authorization 헤더에 사용)
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    const userJwt = authHeader.replace(/^Bearer\s+/i, "").trim();

    // google_calendar_tokens 테이블에서 첫 번째 유효한 user_id 직접 조회 (JWT sub 불일치 우회)
    let gcalUserId = "";
    try {
      const { data: gcalTokenRow } = await db.from("google_calendar_tokens")
        .select("user_id").limit(1).single();
      gcalUserId = gcalTokenRow?.user_id ?? "";
    } catch { gcalUserId = ""; }
    console.log("[schedule_edit] gcalUserId:", gcalUserId);

    if (parsed.actions?.length > 0) {
      for (const a of parsed.actions) {
        if (a.type !== "schedule_edit") continue;

        const kw = (a.title_keyword as string ?? "").toLowerCase();
        const newDate     = a.new_date     as string|null ?? null;
        const newTitle    = a.new_title    as string|null ?? null;
        const newTime     = a.new_time     as string|null ?? null;
        const newLocation = a.new_location as string|null ?? null;

        console.log("[schedule_edit] keyword:", kw, "new_date:", newDate, "new_title:", newTitle, "new_time:", newTime);

        // ① 로컬 DB에서 먼저 검색
        const {data:editRows} = await db.from("secretary_schedules")
          .select("id,title,schedule_date,start_time,gcal_event_id")
          .ilike("title", `%${kw}%`)
          .order("schedule_date", {ascending:true}).limit(5);

        console.log("[schedule_edit] local rows:", editRows?.length ?? 0);

        if (editRows && editRows.length > 0) {
          // ── 로컬 DB 수정
          const row = editRows[0] as Record<string,unknown>;
          const patch: Record<string,unknown> = {};
          if (newDate)     patch.schedule_date = newDate;
          if (newTitle)    patch.title         = newTitle;
          if (newTime)     patch.start_time    = newTime;
          if (newLocation) patch.location      = newLocation;

          const {error:upErr} = await db.from("secretary_schedules").update(patch).eq("id", row.id);
          console.log("[schedule_edit] local update error:", upErr?.message ?? "none");

          if (!upErr) {
            saved.push({type:"schedule_edit", id:row.id as number});

            // ── 구글 캘린더에도 동기화 (gcal_event_id가 있는 경우)
            const gcalEventId = row.gcal_event_id as string|null;
            if (gcalEventId && userJwt) {
              try {
                // 수정된 최신 데이터 조회
                const {data:updRow} = await db.from("secretary_schedules")
                  .select("*").eq("id", row.id).single();
                if (updRow) {
                  await fetch(`${sbUrl}/functions/v1/google-calendar-sync`, {
                    method: "POST",
                    headers: {"Content-Type":"application/json","Authorization":`Bearer ${userJwt}`},
                    body: JSON.stringify({
                      action: "update",
                      user_id: gcalUserId,
                      event_id: gcalEventId,
                      event: {
                        id:            updRow.id,
                        title:         updRow.title,
                        description:   updRow.description ?? null,
                        schedule_date: updRow.schedule_date,
                        start_time:    updRow.start_time ?? null,
                        end_time:      updRow.end_time   ?? null,
                        location:      updRow.location   ?? null,
                        schedule_id:   updRow.id,
                      },
                    }),
                  });
                  console.log("[schedule_edit] gcal update sent for event:", gcalEventId);
                }
              } catch(e) { console.warn("[schedule_edit] gcal sync error:", e); }
            }

            await db.from("secretary_chat_logs").insert({
              role:"assistant",
              content:`📅 **일정 수정 완료**\n"${row.title}" → ${newDate ? `날짜: ${newDate}` : ""}${newTitle ? ` 제목: ${newTitle}` : ""}${newTime ? ` 시간: ${newTime}` : ""}`,
              session_id:"main",
            });
          }

        } else {
          // ② 로컬 DB에 없음 → 구글 캘린더에서 검색 후 수정
          console.log("[schedule_edit] not in local DB, trying Google Calendar...");

          if (userJwt) {
            try {
              // 구글 캘린더 이벤트 목록 조회 (현재 월 기준 ±2개월)
              const now = new Date();
              const yr  = now.getFullYear();
              const mo  = now.getMonth();
              const gcalListRes = await fetch(`${sbUrl}/functions/v1/google-calendar-sync`, {
                method: "POST",
                headers: {"Content-Type":"application/json","Authorization":`Bearer ${userJwt}`},
                body: JSON.stringify({ action:"list", user_id:gcalUserId, year:yr, month:mo }),
              });
              const gcalListData = await gcalListRes.json();
              const gcalEvents: {id:string;summary:string;start?:{date?:string;dateTime?:string}}[] = gcalListData.events ?? [];

              // 키워드로 이벤트 찾기
              const matched = gcalEvents.filter((e:any) =>
                (e.summary ?? "").toLowerCase().includes(kw)
              );
              console.log("[schedule_edit] gcal matched events:", matched.length);

              if (matched.length > 0) {
                const evt = matched[0];
                const evtDate = evt.start?.date || evt.start?.dateTime?.slice(0,10) || "";

                // ── 구글 캘린더 이벤트 수정
                const updatedSummary = newTitle ?? evt.summary;
                const updatedDate    = newDate  ?? evtDate;
                await fetch(`${sbUrl}/functions/v1/google-calendar-sync`, {
                  method: "POST",
                  headers: {"Content-Type":"application/json","Authorization":`Bearer ${userJwt}`},
                  body: JSON.stringify({
                    action: "update",
                    user_id: gcalUserId,
                    event_id: evt.id,
                    event: {
                      title:         updatedSummary,
                      schedule_date: updatedDate,
                      start_time:    newTime    ?? null,
                      location:      newLocation ?? null,
                      description:   null,
                    },
                  }),
                });

                // ── secretary_schedules에 새로 등록 (다음번 수정을 위해)
                const {data:newRow} = await db.from("secretary_schedules").insert({
                  title:         updatedSummary,
                  schedule_date: updatedDate,
                  start_time:    newTime ?? null,
                  location:      newLocation ?? null,
                  category:      "meeting",
                  gcal_event_id: evt.id,
                }).select("id").single();

                if (newRow) saved.push({type:"schedule_edit", id:newRow.id as number});

                await db.from("secretary_chat_logs").insert({
                  role:"assistant",
                  content:`📅 **일정 수정 완료 (구글 캘린더)**\n"${evt.summary}" → ${newDate ? `날짜: ${newDate}` : ""}${newTitle ? ` 제목: ${newTitle}` : ""}${newTime ? ` 시간: ${newTime}` : ""}`,
                  session_id:"main",
                });

                console.log("[schedule_edit] gcal event updated:", evt.id);
              } else {
                // ③ 어디에도 없음 → reply에 안내 메시지 주입
                console.log("[schedule_edit] event not found anywhere for keyword:", kw);
                parsed.reply = `"${kw}" 관련 일정을 찾지 못했습니다. 일정 탭에서 직접 등록 후 수정하시거나, 정확한 일정 제목의 일부를 다시 알려주세요.`;
              }
            } catch(e) {
              console.warn("[schedule_edit] gcal search error:", e);
              parsed.reply = `일정 검색 중 오류가 발생했습니다. 일정 탭에서 직접 수정해 주세요.`;
            }
          } else {
            parsed.reply = `"${kw}" 일정을 로컬에서 찾지 못했습니다. 구글 캘린더 연동 상태를 확인하거나 일정 탭에서 직접 수정해 주세요.`;
          }
        }
      }
    }

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

        if (a.type === "order_update") {
          const custName   = a.customer_name as string ?? "";
          const prodKw     = a.product_keyword as string|null;
          const nextStatus = a.next_status as string;
          const now        = new Date().toISOString();

          // 고객명 + 상품 키워드로 진행중인 주문 검색
          let q = db.from("tb_orders")
            .select("id,customer_name_raw,product_type,product_spec,status,memo")
            .ilike("customer_name_raw", `%${custName}%`)
            .not("status", "eq", "invoiced")
            .order("created_at", {ascending:false}).limit(10);

          if (prodKw) {
            q = db.from("tb_orders")
              .select("id,customer_name_raw,product_type,product_spec,status,memo")
              .ilike("customer_name_raw", `%${custName}%`)
              .or(`product_spec.ilike.%${prodKw}%,product_type.ilike.%${prodKw}%`)
              .not("status", "eq", "invoiced")
              .order("created_at", {ascending:false}).limit(5);
          }

          const {data:orderRows} = await q;
          if (orderRows && orderRows.length > 0) {
            const row = orderRows[0] as Record<string,unknown>;
            const patch: Record<string,unknown> = { status: nextStatus };

            // 단계별 타임스탬프 자동 기록
            if (nextStatus === "forwarded")      patch.forwarded_at      = now;
            else if (nextStatus === "delivered")  patch.delivered_at      = now;
            else if (nextStatus === "wheel_returned") patch.wheel_returned_at = now;
            else if (nextStatus === "invoiced") {
              patch.invoiced_at     = now;
              patch.invoice_issued  = true;
            }

            // 금액 정보
            if (a.price_to_customer != null)  patch.price_to_customer  = a.price_to_customer;
            if (a.price_from_jinheung != null) patch.price_from_jinheung = a.price_from_jinheung;
            if (a.margin != null)              patch.margin             = a.margin;
            else if (a.price_to_customer && a.price_from_jinheung) {
              patch.margin = Number(a.price_to_customer) - Number(a.price_from_jinheung);
            }

            // 메모
            if (a.memo) {
              const prevMemo = (row.memo as string) ?? "";
              patch.memo = prevMemo ? `${prevMemo}\n[${now.slice(0,10)} AI] ${a.memo}` : `[${now.slice(0,10)} AI] ${a.memo}`;
            }

            await db.from("tb_orders").update(patch).eq("id", row.id);

            // 계산서 발행(완료) 시 할일 완료 처리
            if (nextStatus === "invoiced") {
              const {data:todos} = await db.from("secretary_todos")
                .select("id").ilike("title", `%${custName}%`).eq("is_done", false);
              if (todos && todos.length > 0) {
                await db.from("secretary_todos").update({is_done:true})
                  .in("id", todos.map((t:any)=>t.id));
              }
            }

            // 채팅 알림
            const statusKoMap: Record<string,string> = {
              forwarded:"(주)진흥 전달", delivered:"납품 완료",
              wheel_returned:"휠 반납", invoiced:"계산서 발행 완료",
            };
            const chatMsg = [
              `📦 **타이어 주문 상태 변경**`,
              `**${row.customer_name_raw}** ${row.product_spec ?? row.product_type ?? ""} → **${statusKoMap[nextStatus] ?? nextStatus}**`,
              nextStatus === "invoiced" ? "✅ 주문 완료 처리됨" : "",
              a.memo ? `메모: ${a.memo}` : "",
            ].filter(Boolean).join("\n");

            await db.from("secretary_chat_logs").insert({
              role:"assistant", content:chatMsg, session_id:"main",
            });

            saved.push({type:"order_update", id:row.id as string});
          }
        }

        if (a.type === "narumi_update") {
          const custName = a.customer_name as string ?? "";
          const vinKw    = a.vin_keyword as string|null;
          const stage    = a.next_stage as string;

          // 후보 검색: 고객명 또는 VIN으로
          let query = db.from("narumi_tasks")
            .select("id,vin,vin_last6,customer_name,status,has_insurance,docs_ready,is_registered,vehicle_doc_path,sales_rep,customer_phone")
            .eq("is_registered", false)
            .order("created_at", {ascending:false}).limit(10);

          if (vinKw) {
            query = db.from("narumi_tasks")
              .select("id,vin,vin_last6,customer_name,status,has_insurance,docs_ready,is_registered,vehicle_doc_path,sales_rep,customer_phone")
              .ilike("vin", `%${vinKw}%`)
              .order("created_at", {ascending:false}).limit(5);
          } else if (custName) {
            query = db.from("narumi_tasks")
              .select("id,vin,vin_last6,customer_name,status,has_insurance,docs_ready,is_registered,vehicle_doc_path,sales_rep,customer_phone")
              .ilike("customer_name", `%${custName}%`)
              .order("created_at", {ascending:false}).limit(5);
          }

          const {data: narumiRows} = await query;
          if (narumiRows && narumiRows.length > 0) {
            const row = narumiRows[0] as Record<string,unknown>;
            const patch: Record<string,unknown> = {};

            const custDisplay = (row.customer_name ?? row.vin) as string;

            if (stage === "보험")        { patch.has_insurance = true; patch.status = "insurance"; }
            else if (stage === "등록서류") { patch.docs_ready = true;   patch.status = "docs"; }
            else if (stage === "등록완료") { patch.is_registered = true; patch.status = "registered"; }
            else if (stage === "완료")   { patch.status = "completed"; }
            else if (stage === "보류") {
              patch.on_hold = true;
              if (a.hold_reason) patch.special_note = a.hold_reason as string;
            }
            else if (stage === "보류해제") { patch.on_hold = false; }
            else if (stage === "우편발송") {
              if (a.tracking_no) {
                patch.postal_tracking_no = a.tracking_no as string;
                patch.postal_mail_sent   = true;
                patch.postal_sent_date   = new Date().toISOString().slice(0,10);
              }
            }
            if (a.memo) patch.special_note = a.memo as string;

            await db.from("narumi_tasks").update(patch).eq("id", row.id);

            // 보류 시 일정 자동 생성
            if (stage === "보류" && a.next_followup_date) {
              await db.from("secretary_schedules").insert({
                title:         `${custDisplay} 나르미 재확인`,
                description:   `보류 사유: ${a.hold_reason ?? ""}`,
                schedule_date: a.next_followup_date as string,
                category:      "followup",
                related_type:  "finance",
              });
              await db.from("secretary_todos").insert({
                title:       `${custDisplay} (나르미 보류 - 재확인)`,
                description: `보류 사유: ${a.hold_reason ?? ""}`,
                priority:    "normal",
                category:    "finance",
                is_done:     false,
              });
            }

            // SMS 알림 (보류/보류해제/우편발송도 발송)
            const sbUrl2 = Deno.env.get("APP_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
            const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
            const smsTypeMap: Record<string,string> = {
              "보험":"narumi_status", "등록서류":"narumi_status",
              "등록완료":"narumi_status", "완료":"narumi_status",
              "보류":"narumi_status", "보류해제":"narumi_status",
              "우편발송":"narumi_postal",
            };
            const smsType = smsTypeMap[stage];
            if (smsType) {
              try {
                await fetch(`${sbUrl2}/functions/v1/send-hyundaicm-kakao`, {
                  method: "POST",
                  headers: {"Content-Type":"application/json","Authorization":`Bearer ${anonKey}`},
                  body: JSON.stringify({
                    type:        smsType,
                    vin:         row.vin,
                    customerName:custDisplay,
                    salesRep:    row.sales_rep,
                    prevStatus:  row.status,
                    nextStatus:  stage,
                    trackingNo:  a.tracking_no ?? undefined,
                    sentDate:    new Date().toISOString().slice(0,10),
                  }),
                });
              } catch(e) { console.warn("[narumi sms]", e); }
            }

            // 채팅 알림
            const chatLines = [
              `🚛 **나르미 ${stage === "우편발송" ? "우편 발송" : stage === "보류" ? "보류 처리" : "단계 변경"}**`,
              `**${custDisplay}** → **${stage}**`,
              stage === "우편발송" && a.tracking_no ? `등기번호: ${a.tracking_no}` : "",
              stage === "보류" && a.hold_reason ? `사유: ${a.hold_reason}` : "",
              stage === "보류" && a.next_followup_date ? `재확인 일정: ${a.next_followup_date}` : "",
            ].filter(Boolean).join("\n");

            await db.from("secretary_chat_logs").insert({
              role: "assistant", content: chatLines, session_id: "main",
            });

            saved.push({type:"narumi_update", id:row.id as number});
          }
        }

        if (a.type === "schedule_update") {
          const kw = (a.title_keyword as string ?? "").toLowerCase();
          const {data:schRows} = await db.from("secretary_schedules")
            .select("id,title,progress_memo,category,related_type,location")
            .ilike("title", `%${kw}%`)
            .order("schedule_date", {ascending:false}).limit(5);
          if (schRows && schRows.length > 0) {
            const todayStr = new Date().toISOString().slice(0,10);
            const appendText = `[${todayStr} AI비서] ${a.progress_memo}`;
            const best = schRows[0] as Record<string,unknown>;
            const prev = (best.progress_memo as string) ?? "";
            const newMemo = prev ? `${prev}\n${appendText}` : appendText;
            const patch: Record<string,unknown> = { progress_memo: newMemo };

            // 완료 처리
            if (a.mark_done) patch.is_done = true;

            // 다음 일정 등록
            if (a.next_schedule_date) {
              patch.next_schedule_date = a.next_schedule_date;
              patch.next_schedule_time = a.next_schedule_time ?? null;
              const nextTitle = (a.next_schedule_title as string|null) ?? (best.title as string);
              await db.from("secretary_schedules").insert({
                title:         nextTitle,
                schedule_date: a.next_schedule_date,
                start_time:    a.next_schedule_time ?? null,
                description:   newMemo,
                category:      best.category ?? "followup",
                related_type:  best.related_type ?? null,
                location:      best.location ?? null,
              });
            }

            // 할일 등록 (next_schedule 대신)
            if (a.create_todo && a.todo_title) {
              await db.from("secretary_todos").insert({
                title:       a.todo_title as string,
                description: newMemo,
                priority:    "normal",
                is_done:     false,
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
            if (cd) {
              cid = cd.id;

              // 타이어 상세 필드 저장 (tire_sales이면 항상 insert, summary에서 파싱 보완)
              if (wt === "tire_sales") {
                const tf = a.tire_fields as Record<string,unknown>|null ?? {};
                const summary = (a.summary as string) ?? "";

                // summary 텍스트에서 직접 파싱 (AI가 tire_fields 누락 시 보완)
                const sizeMatch  = summary.match(/([0-9]+[*xX×][0-9]+-[0-9]+|[0-9]+\/[0-9]+R[0-9]+|[0-9]+\.[0-9]+-[0-9]+|[0-9]+-[0-9]+)/);
                const rearMatch  = summary.match(/후륜?\s*([0-9]+)개?/);
                const frontMatch = summary.match(/전륜?\s*([0-9]+)개?/);
                const tonMatch   = summary.match(/([0-9]+(?:\.[0-9]+)?)\s*톤/);
                const qtyMatch   = summary.match(/([0-9]+)\s*개/);

                // 브랜드 키워드 매칭
                const brandKws = ["두산","현대","기아","대우","TCM","도요타","볼보","클라크","닛산","한국","금호","넥센"];
                let brandFound = "";
                for (const bk of brandKws) {
                  if (summary.includes(bk)) { brandFound = bk; break; }
                }

                const tireInsert: Record<string,unknown> = { consultation_id: cid };
                tireInsert.vehicle_info   = (tf.vehicle_info as string|null) ?? (brandFound || null);
                tireInsert.vehicle_type   = (tf.vehicle_type   as string|null) ?? (tonMatch ? tonMatch[1]+"톤" : null);
                tireInsert.tire_size      = (tf.tire_size      as string|null) ?? (sizeMatch ? sizeMatch[0] : null);
                // process_status: DB constraint 허용값 매핑
                const psRaw = (tf.process_status as string|null) ?? "waiting_order";
                const psMap: Record<string,string> = {
                  "발주":"waiting_order", "발주대기":"waiting_order",
                  "문의접수":"inquiry_received", "규격확인중":"size_confirming",
                  "견적발송":"quote_sent", "납품":"delivery_or_replacement",
                  "교체중":"delivery_or_replacement", "완료":"completed", "보류":"hold",
                };
                tireInsert.process_status = psMap[psRaw] ?? "waiting_order";

                const fq = tf.front_quantity ? Number(tf.front_quantity) : (frontMatch ? Number(frontMatch[1]) : 0);
                const rq = tf.rear_quantity  ? Number(tf.rear_quantity)  : (rearMatch  ? Number(rearMatch[1])  : (qtyMatch ? Number(qtyMatch[1]) : 0));
                if (fq > 0) tireInsert.front_quantity = fq;
                if (rq > 0) tireInsert.rear_quantity  = rq;
                if (fq + rq > 0) tireInsert.quantity  = fq + rq;
                if (tf.region_detail != null) tireInsert.region_detail = tf.region_detail;

                console.log("[tire_insert] cid:", cid, "insert:", JSON.stringify(tireInsert));
                const {error: tireErr} = await db.from("consultation_tire_details").insert(tireInsert);
                console.log("[tire_insert] error:", tireErr?.message ?? "none");
              }
            }
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