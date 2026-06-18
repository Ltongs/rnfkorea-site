import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type TabKey = "chat"|"schedule"|"todo"|"consults"|"policies"|"claims"|"customers"|"narumi";
type Schedule = {
  id:number; title:string; description:string|null; schedule_date:string;
  start_time:string|null; end_time:string|null;
  category:"meeting"|"call"|"task"|"followup";
  location:string|null; related_type:string|null; is_done:boolean; consultation_id:number|null;
  progress_memo:string|null; next_schedule_date:string|null; next_schedule_time:string|null;
  gcal_event_id:string|null;
};
type Todo = {
  id:number; title:string; description:string|null;
  priority:"urgent"|"normal"|"low"; category:string|null;
  due_date:string|null; is_done:boolean; done_at:string|null; consultation_id:number|null;
};
type Order = {
  id:number; created_at:string;
  customer_key:string; customer_name:string;
  channel:"kakao"|"phone"|"visit"|"web"; work_type:string|null;
  summary:string; detail:string|null; status:"new"|"pending"|"processing"|"done";
  consultation_id:number|null;
};
type Consult = {
  id:number; customer_key:string|null; customer_name:string; phone:string;
  telecom_provider:string|null; work_type:string; status:string; summary:string;
  followup_needed:boolean; next_followup_date:string|null; created_at:string;
};
type PendingUpdate = {
  action:Record<string,unknown>;
  candidates:{id:number;customer_name:string;work_type:string;status:string;summary:string;detail_memo:string|null}[];
  bestMatch:{id:number;customer_name:string;work_type:string;status:string;summary:string;detail_memo:string|null}|null;
};
type PendingCustomerSelect = {
  action:Record<string,unknown>;
  candidates:{customer_key:string;customer_name:string;phone?:string;isNew?:boolean}[];
};
// 일정 등록 후 고객 상담이력 기록 전 확인용
type PendingScheduleConsult = {
  schedTitle:string;
  schedDate:string;
  startTime:string|null;
  location:string|null;
  schedId:number;
  candidates:{customer_key:string;customer_name:string;phone?:string}[];
};
type ChatMsg = {
  role:"user"|"assistant"; content:string;
  ts?:string;
  saved?:{type:string;id:number;consultation_id?:number}[];
  actions?:Record<string,unknown>[];
  pendingUpdates?:PendingUpdate[];
  pendingCustomerSelects?:PendingCustomerSelect[];
  pendingScheduleConsults?:PendingScheduleConsult[];
};
type Policy = {
  id:number; customer_key:string; customer_name:string;
  product_name:string; start_date:string; expiry_date:string|null;
  memo:string|null; created_at:string;
};
type Claim = {
  id:number; customer_key:string; customer_name:string;
  product_name:string; claim_date:string;
  claim_type:"inpatient"|"outpatient"|"surgery"|"death"|"other";
  status:"requested"|"processing"|"completed";
  memo:string|null; created_at:string;
};
type InsuranceDetail = {
  id:number; consultation_id:number;
  vehicle_no:string|null; vehicle_model:string|null; vehicle_use:string|null;
  insurance_type:string|null; insurance_request:string|null;
  insurer_name:string|null; insurance_company:string|null;
  insurance_start_date:string|null; insurance_end_date:string|null;
  design_requested:boolean; application_issued:boolean;
  payment_completed:boolean; policy_issued:boolean;
  finance_product:string|null; finance_company:string|null;
  finance_amount:number|null; finance_period:number|null;
  finance_interest_rate:number|null; finance_stage:string|null;
  finance_aftercare:boolean;
  job_title:string|null; job:string|null; note:string|null;
  urgency:string|null; process_status:string|null;
};
// 고객 조회용 — customer_key 기준 통합 프로필
type CustomerProfile = {
  customer_key: string;
  customer_name: string;
  policies: Policy[];
  consults: Consult[];
  claims: Claim[];
  insuranceDetails: InsuranceDetail[];
};
type CustomerInfo = {
  id?: number;
  customer_key: string;
  phone: string;
  bank_name: string;
  bank_account: string;
  card_company: string;
  card_number: string;
  card_expiry: string;
  memo: string;
};
type NarumiTask = {
  id:number; customer_name:string|null; memo:string|null;
  status:string|null; is_urgent:boolean; docs_ready:boolean;
  delivery_date:string|null; created_at:string; vin:string|null;
  sales_rep:string|null; special_note:string|null;
};

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const WL:Record<string,string> = {
  insurance:"보험",registration_insurance:"보험",
};
const CAT_LBL:Record<string,string> = {meeting:"미팅",call:"통화",task:"업무",followup:"사후관리"};
const STS_LBL:Record<string,string> = {new:"신규",pending:"대기",processing:"진행중",done:"완료",in_progress:"진행중",completed:"완료",closed:"종결",waiting_customer:"고객대기",on_hold:"보류",forwarded:"진흥전달",invoiced:"계산서발행",confirmed:"확정",approved:"승인",rejected:"거절",cancelled:"취소"};
const PRI_LBL:Record<string,string> = {urgent:"긴급",normal:"일반",low:"낮음"};
const ACT_LBL:Record<string,string> = {todo:"✅ 할일",schedule:"📅 일정",order:"💬 상담접수",claim:"🏥 청구접수",consult_update:"🔄 상담 업데이트"};
const CAT_CLR:Record<string,string> = {meeting:"#60a5fa",call:"#fb923c",followup:"#c084fc",task:"#34d399"};
const CLAIM_TYPE_LBL:Record<string,string> = {inpatient:"입원",outpatient:"통원",surgery:"수술",death:"사망",other:"기타"};
const CLAIM_STS_LBL:Record<string,string> = {requested:"청구요청",processing:"청구중",completed:"청구완료"};
const CLAIM_STS_CLR:Record<string,string> = {requested:"bg-yellow-50 text-yellow-700",processing:"bg-blue-50 text-blue-700",completed:"bg-emerald-50 text-emerald-700"};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
// 한국 시간 기준 오늘 날짜 YYYY-MM-DD
const todayStr = () => { const d=new Date(); d.setHours(d.getHours()+9); return d.toISOString().slice(0,10); };
const addDays = (base:string, n:number) => { const d=new Date(base+"T00:00:00"); d.setDate(d.getDate()+n); d.setHours(d.getHours()+9); return d.toISOString().slice(0,10); };
// 이름 + 전화번호 → customer_key (예: 홍길동_1234)
// phone 은 전체번호 저장, customer_key 는 끝4자리 기반
const makeCustomerKey = (name:string, phone:string) => {
  const digits = phone.replace(/\D/g,"");
  const last4 = digits.slice(-4);
  return last4 ? `${name.trim()}_${last4}` : name.trim();
};
const nowTs = () => new Date().toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(". ","월 ").replace(". ","일 ");
const pad2 = (n:number) => String(n).padStart(2,"0");
const fmtDate = (d:string) => { const dt=new Date(d+(d.includes("T")?"":"T00:00:00")); return `${dt.getMonth()+1}월 ${dt.getDate()}일`; };
const fmtDT = (d:string) => new Date(d).toLocaleDateString("ko-KR",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtTime = (t:string|null) => t?t.slice(0,5):"";
const md2html = (s:string) => s.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\[(.*?)\]/g,'<span style="color:#f97316;font-weight:600">[$1]</span>').replace(/\n/g,"<br/>");

// ─── 스타일 ───────────────────────────────────────────────────────────────────
const TB  = "px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all";
const TA  = "bg-[#0f172a] text-white border-[#0f172a]";
const TI  = "bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-600";
const CARD = "border border-gray-200 rounded-2xl bg-white shadow-sm";
const LBL = "block text-xs font-medium text-gray-500 mb-1";
const CTRL = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 transition-all";
const TA2  = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0f172a] bg-white resize-none focus:outline-none focus:border-orange-400 transition-all";
const BTP = "px-3 py-1.5 rounded-xl bg-[#0f172a] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40";
const BTS = "px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-gray-300 transition-all";
const BTO = "px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-all";
const BTG = "px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-gray-300 transition-all";
const BTE = "px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all";

// ─── 작은 컴포넌트들 ───────────────────────────────────────────────────────────
const PriBadge = ({p}:{p:string}) => {
  const c = p==="urgent"?"bg-red-50 text-red-600":p==="normal"?"bg-blue-50 text-blue-600":"bg-gray-100 text-gray-500";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c}`}>{PRI_LBL[p]??p}</span>;
};
const StsBadge = ({s}:{s:string}) => {
  const c = s==="new"?"bg-blue-50 text-blue-600":s==="pending"?"bg-amber-50 text-amber-600":s==="processing"||s==="in_progress"?"bg-orange-50 text-orange-600":"bg-emerald-50 text-emerald-600";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c}`}>{STS_LBL[s]??s}</span>;
};
const CatDot = ({c}:{c:string}) => {
  const cls = c==="meeting"?"bg-blue-500":c==="call"?"bg-orange-500":c==="followup"?"bg-purple-500":"bg-emerald-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${cls} flex-shrink-0 mt-1.5`}/>;
};
const LinkBadge = ({id,onClick}:{id:number|null;onClick:()=>void}) => id ? (
  <button onClick={onClick} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100">
    🔗 상담#{id}
  </button>
) : null;

// ─── 저장 결과 카드 ────────────────────────────────────────────────────────────
function SavedCard({actions,saved,onNav}:{actions:Record<string,unknown>[];saved:{type:string;id:number;consultation_id?:number}[];onNav:(p:string)=>void}) {
  if (!actions?.length) return null;
  return (
    <div className="mt-2 border border-emerald-200 rounded-xl bg-emerald-50 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-emerald-700 mb-1">✅ 자동 저장 완료 — {saved.length}건</p>
      {actions.map((a,i)=>{
        const s=saved[i];
        return (
          <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 border border-emerald-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-emerald-600 flex-shrink-0">{ACT_LBL[a.type as string]??a.type}</span>
              <span className="text-xs text-gray-700 truncate">{a.type==="order"?`${a.customer_name} — ${a.summary}`:a.title as string}</span>
              {a.type==="order"&&s?.consultation_id&&(
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">상담#{s.consultation_id}</span>
              )}
            </div>
            {a.type==="order"&&s?.consultation_id&&(
              <button className="text-xs text-emerald-600 hover:underline ml-2 flex-shrink-0" onClick={()=>onNav(`/work/call-management?id=${s.consultation_id}`)}>열기→</button>
            )}
            {a.type==="consult_update"&&s?.id&&(
              <button className="text-xs text-emerald-600 hover:underline ml-2 flex-shrink-0" onClick={()=>onNav(`/work/call-management?id=${s.id}`)}>상담관리→</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 상담 업데이트 확인 카드 ───────────────────────────────────────────────────
function PendingCard({pu,onConfirm,onReject}:{pu:PendingUpdate[];onConfirm:(id:number,a:Record<string,unknown>)=>void;onReject:(i:number)=>void}) {
  if (!pu?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {pu.map((p,idx)=>{
        const a=p.action;
        const m=a.match as Record<string,unknown>;
        return (
          <div key={idx} className="border border-amber-200 rounded-xl bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700 mb-2">🔍 기존 상담 업데이트 확인</p>
            <div className="bg-white rounded-lg p-2 mb-2 border border-amber-100">
              <p className="text-xs text-gray-500 mb-0.5">업데이트 내용</p>
              <p className="text-sm text-gray-800">{a.update_memo as string}</p>
            </div>
            {p.bestMatch ? (
              <div className="bg-white rounded-lg p-2 mb-2 border border-emerald-200">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs font-medium text-emerald-700">✅ 매칭 상담 #{p.bestMatch.id}</p>
                  <span className="text-xs text-gray-400">{WL[p.bestMatch.work_type]??p.bestMatch.work_type}</span>
                </div>
                <p className="text-sm font-semibold text-[#0f172a]">{p.bestMatch.customer_name}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{p.bestMatch.summary}</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg p-2 mb-2 border border-red-200">
                <p className="text-xs text-red-600">❌ "{m.customer_name as string}" 상담 건을 찾지 못했습니다</p>
              </div>
            )}
            {p.candidates.length>1&&<p className="text-xs text-amber-600 mb-2">⚠️ {p.candidates.length}건 발견 — 최적 건 자동 선택</p>}
            <div className="flex gap-2">
              {p.bestMatch&&<button className={BTE} onClick={()=>onConfirm(p.bestMatch!.id,a)}>✅ 이 건에 업데이트</button>}
              <button className={BTG} onClick={()=>onReject(idx)}>취소</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 동명이인 고객 선택 카드 ─────────────────────────────────────────────────
function PendingCustomerSelectCard({
  pcs, onConfirm, onReject
}:{
  pcs:PendingCustomerSelect[];
  onConfirm:(customerKey:string, action:Record<string,unknown>)=>void;
  onReject:(i:number)=>void;
}) {
  if(!pcs?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {pcs.map((p,idx)=>{
        const a = p.action;
        const actionLabel = a.type==="customer_info_update"?"고객 정보 업데이트":a.type==="policy"?"계약 등록":"작업";
        return (
          <div key={idx} className="border border-blue-200 rounded-xl bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-700 mb-2">👥 동명이인 확인 — {actionLabel}</p>
            <div className="bg-white rounded-lg p-2 mb-2 border border-blue-100">
              <p className="text-xs text-gray-500 mb-0.5">작업 내용</p>
              <p className="text-sm text-gray-800">
                {a.type==="customer_info_update"
                  ? `전화번호: ${a.phone??"-"}`
                  : a.type==="policy"
                  ? `${a.product_name??"-"} 계약 등록`
                  : JSON.stringify(a)}
              </p>
            </div>
            <p className="text-xs text-gray-500 mb-2">어느 고객인지 선택해주세요:</p>
            <div className="space-y-1.5 mb-2">
              {p.candidates.map(c=>(
                <button key={c.customer_key}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${c.isNew?"border-emerald-300 bg-emerald-50 hover:border-emerald-500":"border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50"}`}
                  onClick={()=>onConfirm(c.customer_key, a)}>
                  <div className="flex items-center gap-2">
                    {c.isNew&&<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-semibold">신규</span>}
                    <span className="text-sm font-semibold text-[#0f172a]">{c.customer_name}</span>
                    {c.phone&&<span className="text-xs text-gray-500">📞 {c.phone}</span>}
                    {!c.isNew&&<span className="text-xs text-gray-300">{c.customer_key}</span>}
                  </div>
                </button>
              ))}
            </div>
            <button className={BTG} onClick={()=>onReject(idx)}>취소</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── 일정→고객 상담이력 확인 카드 ──────────────────────────────────────────────
function ScheduleConsultConfirmCard({
  psc, onConfirm, onReject
}:{
  psc:PendingScheduleConsult[];
  onConfirm:(idx:number, customerKey:string)=>void;
  onReject:(idx:number)=>void;
}) {
  if(!psc?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {psc.map((p,idx)=>(
        <div key={idx} className="border border-blue-200 rounded-xl bg-blue-50 p-3">
          <p className="text-xs font-semibold text-blue-700 mb-2">👤 상담이력 고객 확인</p>
          <div className="bg-white rounded-lg p-2 mb-2 border border-blue-100">
            <p className="text-xs text-gray-500 mb-0.5">등록할 일정</p>
            <p className="text-sm font-medium text-[#0f172a]">{p.schedTitle}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {p.schedDate}{p.startTime?" "+p.startTime.slice(0,5):""}{p.location?" · "+p.location:""}
            </p>
          </div>
          {p.candidates.length===1 ? (
            <>
              <p className="text-xs text-gray-600 mb-2">
                아래 고객의 상담이력에 기록할까요?
              </p>
              <div className="bg-white rounded-lg px-3 py-2 border border-gray-200 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
                  {p.candidates[0].customer_name.slice(0,1)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">{p.candidates[0].customer_name}</p>
                  <p className="text-xs text-gray-400">{p.candidates[0].customer_key}{p.candidates[0].phone?" · "+p.candidates[0].phone:""}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all"
                  onClick={()=>onConfirm(idx, p.candidates[0].customer_key)}>✅ 맞습니다</button>
                <button className="px-3 py-1.5 rounded-xl border border-orange-300 text-xs text-orange-600 hover:bg-orange-50 transition-all"
                  onClick={()=>onReject(idx)}>아닙니다 (신규 등록)</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-600 mb-2">
                동명이인이 {p.candidates.length}명 있습니다. 해당 고객을 선택해주세요:
              </p>
              <div className="space-y-1.5 mb-2">
                {p.candidates.map(c=>(
                  <button key={c.customer_key}
                    className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-all"
                    onClick={()=>onConfirm(idx, c.customer_key)}>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
                        {c.customer_name.slice(0,1)}
                      </span>
                      <span className="text-sm font-semibold text-[#0f172a]">{c.customer_name}</span>
                      {c.phone&&<span className="text-xs text-gray-400">📞 {c.phone}</span>}
                      <span className="text-xs text-gray-300 ml-auto">{c.customer_key}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button className="px-3 py-1.5 rounded-xl border border-orange-300 text-xs text-orange-600 hover:bg-orange-50 transition-all"
                onClick={()=>onReject(idx)}>목록에 없음 (신규 등록)</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 미니 캘린더 ──────────────────────────────────────────────────────────────
type CalSch = {id:number;title:string;schedule_date:string;start_time:string|null;category:string;is_done:boolean};
type CalTdo = {id:number;title:string;due_date:string;priority:string};

type PopupData = {
  x:number; y:number;
  schedules:CalSch[];
  todos:CalTdo[];
  gcalEvents?:{id:string;title:string;color:string}[];
  dateLabel:string;
};

// 전역 팝업 상태 (body에 Portal로 렌더)
let _setPopup: ((p:PopupData|null)=>void)|null = null;

function CalPopupPortal() {
  const [popup, setPopup] = useState<PopupData|null>(null);
  // 렌더링 중 직접 할당 (useEffect 지연 없이 즉시 사용 가능)
  _setPopup = setPopup;
  useEffect(()=>{ return ()=>{ _setPopup=null; }; },[]);
  const CAT_COLOR:Record<string,string> = {meeting:"#60a5fa",call:"#fb923c",followup:"#c084fc",task:"#34d399"};
  if(!popup) return null;
  // 화면 오른쪽 넘치면 왼쪽에 표시
  const left = popup.x + 230 > window.innerWidth ? popup.x - 240 : popup.x + 10;
  const top  = Math.min(popup.y, window.innerHeight - 280);
  return ReactDOM.createPortal(
    <div style={{position:"fixed",top,left,zIndex:99999,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:14,boxShadow:"0 8px 32px rgba(15,23,42,.2)",padding:14,width:226,pointerEvents:"none"}}>
      <p style={{fontSize:10,fontWeight:600,color:"#94a3b8",marginBottom:10}}>{popup.dateLabel}</p>
      {popup.schedules.length>0&&(
        <div style={{marginBottom:popup.todos.length>0?10:0}}>
          <p style={{fontSize:10,color:"#94a3b8",marginBottom:4}}>📅 일정</p>
          {popup.schedules.map(s=>(
            <div key={s.id} style={{display:"flex",gap:6,padding:"3px 0",opacity:s.is_done?.35:1}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:CAT_COLOR[s.category]??"#94a3b8",flexShrink:0,marginTop:4}}/>
              <div>
                <p style={{fontSize:12,color:"#1e293b",textDecoration:s.is_done?"line-through":"none",lineHeight:1.4}}>{s.title}</p>
                {s.start_time&&<p style={{fontSize:10,color:"#94a3b8"}}>{s.start_time.slice(0,5)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {popup.todos.length>0&&(
        <div style={popup.schedules.length>0?{paddingTop:8,borderTop:"1px solid #f1f5f9"}:{}}>
          <p style={{fontSize:10,color:"#94a3b8",marginBottom:4}}>✅ 할일 마감</p>
          {popup.todos.map(t=>(
            <div key={t.id} style={{display:"flex",gap:6,padding:"3px 0"}}>
              <span style={{fontSize:11,fontWeight:700,color:t.priority==="urgent"?"#ef4444":"#3b82f6",flexShrink:0}}>{t.priority==="urgent"?"!":"·"}</span>
              <p style={{fontSize:12,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</p>
            </div>
          ))}
        </div>
      )}
      {(popup.gcalEvents?.length??0)>0&&(
        <div style={{paddingTop:8,borderTop:"1px solid #f1f5f9"}}>
          <p style={{fontSize:10,color:"#94a3b8",marginBottom:4}}>📅 구글 캘린더</p>
          {popup.gcalEvents!.map(e=>(
            <div key={e.id} style={{display:"flex",gap:6,padding:"3px 0"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:e.color,flexShrink:0,marginTop:4}}/>
              <p style={{fontSize:12,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

function MiniCalendar({
  onDateSelect, selectedDate, calSchedules, calTodos, gcalEvents, onMonthChange,
}:{
  onDateSelect:(d:string)=>void;
  selectedDate:string;
  calSchedules:CalSch[];
  calTodos:CalTdo[];
  gcalEvents?:{id:string;title:string;start:string;color?:string}[];
  onMonthChange:(yr:number,mo:number)=>void;
}) {
  const [yr,setYr] = useState(()=>new Date().getFullYear());
  const [mo,setMo] = useState(()=>new Date().getMonth());
  const hideTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  // 월 변경 시 부모에 알림 (useEffect 제거 → 버튼 클릭 시 직접 호출)

  const T = todayStr();
  const first = new Date(yr,mo,1).getDay();
  const days_in = new Date(yr,mo+1,0).getDate();
  const ds = (d:number) => `${yr}-${pad2(mo+1)}-${pad2(d)}`;

  // 세 맵 모두 ref로 관리 (showPopup 클로저에서 최신값 참조)
  const schMapRef = useRef(new Map<string,CalSch[]>());
  const tdoMapRef = useRef(new Map<string,CalTdo[]>());
  const gcalMapRef = useRef(new Map<string,{id:string;title:string;color:string}[]>());

  const schMap = new Map<string,CalSch[]>();
  for(const s of calSchedules){
    if(!schMap.has(s.schedule_date))schMap.set(s.schedule_date,[]);
    schMap.get(s.schedule_date)!.push(s);
  }
  schMapRef.current = schMap;

  const tdoMap = new Map<string,CalTdo[]>();
  for(const t of calTodos){
    if(!tdoMap.has(t.due_date))tdoMap.set(t.due_date,[]);
    tdoMap.get(t.due_date)!.push(t);
  }
  tdoMapRef.current = tdoMap;

  const gcalMap = new Map<string,{id:string;title:string;color:string}[]>();
  for(const e of (gcalEvents??[])){
    if(!e.start) continue;
    if(!gcalMap.has(e.start))gcalMap.set(e.start,[]);
    gcalMap.get(e.start)!.push({id:e.id,title:e.title,color:e.color??"#4285f4"});
  }
  gcalMapRef.current = gcalMap;

  const days:(number|null)[] = [];
  for(let i=0;i<first;i++)days.push(null);
  for(let d=1;d<=days_in;d++)days.push(d);

  const todaySch = (schMapRef.current.get(T)??[]).filter(s=>!s.is_done);
  const CAT_COLOR:Record<string,string> = {meeting:"#60a5fa",call:"#fb923c",followup:"#c084fc",task:"#34d399"};

  function showPopup(d:number, e:React.MouseEvent){
    const dt = ds(d);
    const sc = schMapRef.current.get(dt)??[];
    const tc = tdoMapRef.current.get(dt)??[];
    // DB 일정과 제목이 같은 구글 캘린더 이벤트는 중복 제외
    const scTitles = new Set(sc.map((s:any)=>s.title));
    const gc = (gcalMapRef.current.get(dt)??[]).filter((g:any)=>!scTitles.has(g.title));
    if(sc.length===0 && tc.length===0 && gc.length===0) return;
    if(hideTimer.current){clearTimeout(hideTimer.current);hideTimer.current=null;}
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    _setPopup?.({
      x: r.right,
      y: r.top,
      schedules: sc,
      todos: tc,
      gcalEvents: gc,
      dateLabel: `${parseInt(dt.slice(5,7))}월 ${parseInt(dt.slice(8))}일`,
    });
  }
  function hidePopup(){
    hideTimer.current = setTimeout(()=>{ _setPopup?.(null); }, 150);
  }

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={()=>{const ny=mo===0?yr-1:yr,nm=mo===0?11:mo-1;setYr(ny);setMo(nm);onMonthChange(ny,nm);}}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-base font-bold">‹</button>
        <span className="text-xs font-bold text-[#0f172a]">{yr}. {mo+1}월</span>
        <button onClick={()=>{const ny=mo===11?yr+1:yr,nm=mo===11?0:mo+1;setYr(ny);setMo(nm);onMonthChange(ny,nm);}}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-base font-bold">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {["일","월","화","수","목","금","토"].map((d,i)=>(
          <div key={d} className={`text-center text-[10px] font-medium pb-1 ${i===0?"text-red-400":i===6?"text-blue-400":"text-gray-400"}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d,i)=>{
          if(!d)return <div key={`e${i}`}/>;
          const dt=ds(d);
          const isT=dt===T, isSel=dt===selectedDate;
          const sc=schMapRef.current.get(dt)??[], tc=tdoMapRef.current.get(dt)??[];
          const _scTitles=new Set(sc.map((s:any)=>s.title));
          const gc=(gcalMapRef.current.get(dt)??[]).filter((g:any)=>!_scTitles.has(g.title));
          const hasData=sc.length>0||tc.length>0||gc.length>0;
          const dow=(first+d-1)%7;
          const txtCls=isSel?"text-white":isT?"text-orange-500 font-bold":dow===0?"text-red-400":dow===6?"text-blue-400":"text-gray-700";
          const bgCls=isSel?"bg-[#0f172a]":isT?"bg-orange-50":"hover:bg-gray-100";
          return (
            <button key={d}
              onClick={()=>onDateSelect(dt)}
              onMouseEnter={(e)=>showPopup(d,e)}
              onMouseLeave={hidePopup}
              className={`relative flex flex-col items-center justify-center h-9 w-full rounded-lg text-[12px] font-medium transition-all ${bgCls} ${txtCls}`}>
              {d}
              {hasData&&(
                <span className="absolute bottom-0.5 flex gap-[2px]">
                  {sc.length>0&&<span className={`w-1 h-1 rounded-full ${isSel?"bg-orange-300":"bg-orange-400"}`}/>}
                  {tc.length>0&&<span className={`w-1 h-1 rounded-full ${isSel?"bg-blue-300":"bg-blue-400"}`}/>}
                  {gc.length>0&&<span className="w-1 h-1 rounded-full" style={{background:isSel?"#93c5fd":"#4285f4"}}/>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {todaySch.length>0&&(
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-1.5">오늘 일정</p>
          {todaySch.slice(0,3).map(s=>(
            <div key={s.id} className="flex items-center gap-1.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:CAT_COLOR[s.category]??"#94a3b8"}}/>
              <span className="text-[11px] text-gray-600 truncate">{s.title}</span>
            </div>
          ))}
          {todaySch.length>3&&<p className="text-[10px] text-gray-400 mt-0.5">+{todaySch.length-3}건 더</p>}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
const SecretaryInsPage:React.FC = () => {
  const {user,isInsAI,logout} = useAuth() as any;
  const navigate = useNavigate();

  const [tab,setTab] = useState<TabKey>("chat");

  // 일정
  const [schedules,setSchedules]     = useState<Schedule[]>([]);
  const [schedLoading,setSchedLoading] = useState(false);
  const [schedDate,setSchedDate]     = useState(todayStr);
  const [showSchedForm,setShowSchedForm] = useState(false);
  const [schedViewMode,setSchedViewMode] = useState<"day"|"week"|"all">("day");
  const [schedShowDone,setSchedShowDone] = useState(false);
  const [allSchedules,setAllSchedules] = useState<Schedule[]>([]);
  const [allSchedLoading,setAllSchedLoading] = useState(false);
  const [schedModal,setSchedModal] = useState<{s:Schedule}|null>(null);
  const [schedProgress,setSchedProgress] = useState({memo:"",next_date:"",next_time:""});
  const [newSched,setNewSched] = useState({title:"",description:"",schedule_date:todayStr(),start_time:"",end_time:"",category:"meeting" as Schedule["category"],location:"",related_type:"",consultation_id:""});

  // 할일
  const [todos,setTodos]             = useState<Todo[]>([]);
  const [todoLoading,setTodoLoading] = useState(false);
  const [tdFilter,setTdFilter]       = useState<"active"|"all"|"done">("active");
  const [showTodoForm,setShowTodoForm] = useState(false);
  const [newTodo,setNewTodo] = useState({title:"",description:"",priority:"normal" as Todo["priority"],category:"",due_date:"",consultation_id:""});

  // 주문
  const [orders,setOrders]           = useState<Order[]>([]);
  const [orderLoading,setOrderLoading] = useState(false);
  const [ordFilter,setOrdFilter]     = useState("active");
  const [showOrderForm,setShowOrderForm] = useState(false);
  const [expandedOrder,setExpandedOrder] = useState<number|null>(null);
  const [syncConsult,setSyncConsult] = useState(true);
  const [newOrder,setNewOrder] = useState({customer_name:"",phone:"",channel:"kakao" as Order["channel"],work_type:"",summary:"",detail:"",telecom_provider:"",region:""});

  // 상담
  const [followups,setFollowups]     = useState<Consult[]>([]);
  const [recentC,setRecentC]         = useState<Consult[]>([]);
  const [cLoading,setCLoading]       = useState(false);

  // 나르미
  const [narumiList,setNarumiList]       = useState<NarumiTask[]>([]);
  const [narumiLoading,setNarumiLoading] = useState(false);
  const [narumiConsults,setNarumiConsults] = useState<Consult[]>([]);

  // 채팅
  const [msgs,setMsgs]               = useState<ChatMsg[]>([]);
  const [histLoading,setHistLoading] = useState(true);
  const [chatInput,setChatInput]     = useState("");
  const [chatLoading,setChatLoading] = useState(false);
  const [autoSave,setAutoSave]       = useState(true);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<ChatMsg[]>([]);
  useEffect(()=>{
    msgsRef.current = msgs;
    // 새 메시지 추가 시 자동 스크롤
    if(msgs.length > 0){
      setTimeout(()=>{
        const c = chatContainerRef.current;
        if(c) c.scrollTop = c.scrollHeight;
      }, 50);
    }
  },[msgs]);

  // 계약 관리
  const [policies,setPolicies]               = useState<Policy[]>([]);
  const [policyLoading,setPolicyLoading]     = useState(false);
  const [expiringPolicies,setExpiringPolicies] = useState<Policy[]>([]);
  const [showPolicyForm,setShowPolicyForm]   = useState(false);
  const [newPolicy,setNewPolicy]             = useState({customer_name:"",phone:"",product_name:"",start_date:"",expiry_date:"",memo:""});
  const [policySearch,setPolicySearch]       = useState("");

  // 청구 관리
  const [claims,setClaims]                   = useState<Claim[]>([]);
  const [claimLoading,setClaimLoading]       = useState(false);
  const [showClaimForm,setShowClaimForm]     = useState(false);
  const [claimSearch,setClaimSearch]         = useState("");
  const [claimFilter,setClaimFilter]         = useState<"all"|"active"|"completed">("active");
  const [newClaim,setNewClaim]               = useState({customer_name:"",phone:"",product_name:"",claim_date:todayStr(),claim_type:"outpatient" as Claim["claim_type"],memo:""});

  // 상세/편집 확장 상태
  const [expandedClaim,setExpandedClaim]     = useState<number|null>(null);
  const [editingClaim,setEditingClaim]       = useState<Partial<Claim>|null>(null);
  const [expandedPolicy,setExpandedPolicy]   = useState<number|null>(null);
  const [editingPolicy,setEditingPolicy]     = useState<Partial<Policy>|null>(null);
  const [expandedConsult,setExpandedConsult] = useState<number|null>(null);
  const [editingConsult,setEditingConsult]   = useState<Partial<Consult>|null>(null);

  // 고객 조회
  const [custSearch,setCustSearch]           = useState("");
  const [custResults,setCustResults]         = useState<{customer_key:string;customer_name:string}[]>([]);
  const [custLoading,setCustLoading]         = useState(false);
  const [selectedCust,setSelectedCust]       = useState<CustomerProfile|null>(null);
  const [custDetailLoading,setCustDetailLoading] = useState(false);
  // 전체 고객 목록
  const [allCusts,setAllCusts]               = useState<{customer_key:string;customer_name:string}[]>([]);
  const [allCustsLoading,setAllCustsLoading] = useState(false);
  const [showAllCusts,setShowAllCusts]       = useState(false);
  // 고객 정보 (계좌/카드/메모)
  const [custInfo,setCustInfo]               = useState<CustomerInfo|null>(null);
  const [editingCustInfo,setEditingCustInfo] = useState(false);
  const [custInfoForm,setCustInfoForm]       = useState<CustomerInfo>({customer_key:"",phone:"",bank_name:"",bank_account:"",card_company:"",card_number:"",card_expiry:"",memo:""});
  // 최근 변경 고객 (DB 기반, 상담·계약·청구 최신순 5명)
  const [recentChanged,setRecentChanged]     = useState<{customer_key:string;customer_name:string;changed_at:string;change_type:"상담"|"계약"|"청구"}[]>([]);
  const [recentChangedLoading,setRecentChangedLoading] = useState(false);

  // 엑셀 업로드
  const [showUpload,setShowUpload]           = useState(false);
  const [uploadLoading,setUploadLoading]     = useState(false);
  const [uploadResult,setUploadResult]       = useState<{ok:number;skip:number;err:string[]}|null>(null);
  const uploadRef                            = useRef<HTMLInputElement>(null);

  // 달력 데이터
  const [calSch,setCalSch] = useState<CalSch[]>([]);
  const [calTdo,setCalTdo] = useState<CalTdo[]>([]);
  // 현재 캘린더가 보고 있는 연/월 추적
  const [calViewYear,setCalViewYear]   = useState(new Date().getFullYear());
  const [calViewMonth,setCalViewMonth] = useState(new Date().getMonth());
  // 구글 캘린더
  const [gcalConnected,setGcalConnected] = useState(false);
  const [gcalEvents,setGcalEvents] = useState<{id:string;title:string;start:string;color?:string}[]>([]);
  const [gcalImporting,setGcalImporting] = useState(false);
  const [gcalBulkSyncing,setGcalBulkSyncing] = useState(false);
  const [gcalBulkResult,setGcalBulkResult] = useState<string|null>(null);

  // 통계
  const [stats,setStats] = useState({todaySch:0,activeTodo:0,urgentTodo:0,newOrders:0,todayFollowup:0,newConsult:0,expiringCount:0,activeClaims:0});

  // 토스트
  const [toast,setToast] = useState<{msg:string;type:"ok"|"err"}|null>(null);
  const showToast = (msg:string,type:"ok"|"err"="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  // ─── PWA manifest 교체 (보험 AI 비서 전용) ────────────────────────────────────
  useEffect(()=>{
    const el = document.querySelector('link[rel="manifest"]');
    if(el) el.setAttribute("href","/manifest-ins.json");
    return ()=>{ if(el) el.setAttribute("href","/manifest.json"); };
  },[]);

  // ─── PWA standalone 모드 감지 ─────────────────────────────────────────────
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;

  // ─── 권한 체크 (모든 훅 선언 이후) ───────────────────────────────────────────
  if(!user||!isInsAI)return <Navigate to="/" replace/>;

  // ─── 데이터 로드 ────────────────────────────────────────────────────────────
  const loadCalData = useCallback(async(yr:number,mo:number)=>{
    const from=`${yr}-${String(mo+1).padStart(2,"0")}-01`;
    const lastDay = new Date(yr, mo + 1, 0).getDate();
    const to=`${yr}-${String(mo+1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    // localStorage에서 직접 토큰 읽기 (세션 초기화 타이밍 문제 우회)
    let token = "";
    try {
      const raw = localStorage.getItem("sb-nfwtsptqloefsbpjvdyu-auth-token");
      if(raw) token = JSON.parse(raw).access_token ?? "";
    } catch{}
    if(!token) {
      const {data:{session}} = await supabase.auth.getSession();
      token = session?.access_token ?? "";
    }
    if(!token) return;
    const [sr,tr] = await Promise.all([
      supabase.from("ins_schedules").select("id,title,schedule_date,start_time,category,is_done").gte("schedule_date",from).lte("schedule_date",to),
      supabase.from("ins_todos").select("id,title,due_date,priority,is_done").gte("due_date",from).lte("due_date",to).eq("is_done",false),
    ]);
    if(sr.data) setCalSch(sr.data as CalSch[]);
    if(tr.data) setCalTdo(tr.data as CalTdo[]);
  },[]);

  // ─── 구글 캘린더 ─────────────────────────────────────────────────────────────
  const checkGcalConnection = useCallback(async()=>{
    if(!user) return;
    const {data} = await supabase.from("google_calendar_tokens").select("user_id").eq("user_id",user.id).maybeSingle();
    setGcalConnected(!!data);
    if(data) void loadGcalEvents(new Date().getFullYear(),new Date().getMonth());
  },[user]);

  const loadGcalEvents = useCallback(async(yr:number,mo:number)=>{
    if(!user) return;
    try{
      const {data:{session}} = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({action:"list",user_id:user.id,year:yr,month:mo}),
      });
      const d = await res.json();
      if(d.events){
        // 중복 제거는 MiniCalendar 컴포넌트 내 localTitles에서 처리
        setGcalEvents(d.events.map((e:any)=>({
          id:e.id,
          title:e.summary??"(제목없음)",
          start:e.start?.date||e.start?.dateTime?.slice(0,10)||"",
          color:"#4285f4",
        })));
      }
    }catch(e){console.error("gcal load error",e);}
  },[user]);

  async function connectGcal(){
    if(!user) return;
    const {data:{session}} = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?action=url&user_id=${user.id}`,
      {headers:{"Authorization":`Bearer ${session?.access_token??""}`}}
    );
    const d = await res.json();
    if(d.url){
      const w = window.open(d.url,"_blank","width=600,height=700");
      // 연동 완료 메시지 수신
      const handler = (e:MessageEvent)=>{
        if(e.data==="google-calendar-connected"){
          window.removeEventListener("message",handler);
          setGcalConnected(true);
          void loadGcalEvents(new Date().getFullYear(),new Date().getMonth());
          showToast("구글 캘린더 연동 완료! 🎉");
        }
      };
      window.addEventListener("message",handler);
    }
  }

  async function disconnectGcal(){
    if(!user) return;
    const {data:{session}} = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth`,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${session?.access_token??""}`},
      body:JSON.stringify({action:"disconnect",user_id:user.id}),
    });
    setGcalConnected(false);
    setGcalEvents([]);
    showToast("구글 캘린더 연동 해제");
  }

  // 일정 저장 후 구글 캘린더에도 동기화
  async function syncToGcal(schedule:{id:number;title:string;description:string|null;schedule_date:string;start_time:string|null;end_time:string|null;location:string|null}){
    if(!user||!gcalConnected) return;
    try{
      const {data:{session}} = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({action:"create",user_id:user.id,event:{...schedule,schedule_id:schedule.id}}),
      });
      const d = await res.json();
      if(d.event){
        const newEvt = {
          id: d.event.id ?? String(Date.now()),
          title: d.event.summary ?? schedule.title,
          start: d.event.start?.date || d.event.start?.dateTime?.slice(0,10) || schedule.schedule_date,
          color: "#4285f4",
        };
        setGcalEvents(prev=>[...prev, newEvt]);
        void loadCalData(calViewYear, calViewMonth);
      } else {
        await new Promise(r=>setTimeout(r,1500));
        void loadGcalEvents(calViewYear, calViewMonth);
      }
    }catch(e){console.error("gcal sync error",e);}
  }

  // ─── 구글 캘린더 → AI비서(Ins) 역방향 가져오기 ────────────────────────────
  async function importGcalToLocal(yr:number, mo:number){
    if(!user || !gcalConnected) return;
    setGcalImporting(true);
    try {
      const {data:{session}} = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({action:"list",user_id:user.id,year:yr,month:mo}),
      });
      const d = await res.json();
      if(!d.events?.length){ showToast("가져올 새 일정이 없습니다"); return; }
      const from = `${yr}-${String(mo+1).padStart(2,"0")}-01`;
      const lastDay = new Date(yr, mo+1, 0).getDate();
      const to = `${yr}-${String(mo+1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      const {data:localScheds} = await supabase.from("ins_schedules")
        .select("title,schedule_date").gte("schedule_date",from).lte("schedule_date",to);
      const localSet = new Set(
        (localScheds??[]).map((s:any)=>`${s.schedule_date}||${s.title.trim().toLowerCase()}`)
      );
      const toInsert = (d.events as any[]).filter(e=>{
        const date = e.start?.date || e.start?.dateTime?.slice(0,10) || "";
        if(!date) return false;
        const title = (e.summary??"(제목없음)").trim().toLowerCase();
        return !localSet.has(`${date}||${title}`);
      });
      if(toInsert.length === 0){ showToast("이미 모든 일정이 동기화되어 있습니다 ✅"); return; }
      const rows = toInsert.map((e:any)=>({
        title: e.summary ?? "(제목없음)",
        description: e.description ?? null,
        schedule_date: e.start?.date || e.start?.dateTime?.slice(0,10),
        start_time: e.start?.dateTime ? e.start.dateTime.slice(11,16) : null,
        end_time:   e.end?.dateTime   ? e.end.dateTime.slice(11,16)   : null,
        location:   e.location ?? null,
        category:   "task" as Schedule["category"],
        related_type: "google_calendar",
        consultation_id: null,
        is_done: false,
      }));
      const {error} = await supabase.from("ins_schedules").insert(rows);
      if(error){ showToast("가져오기 실패: " + error.message, "err"); return; }
      showToast(`구글 캘린더 ${toInsert.length}건 AI비서에 추가됨 ✅`);
      void loadCalData(yr, mo);
      void loadSchedules();
    } catch(e:any){
      showToast("가져오기 오류: " + String(e?.message??e), "err");
    } finally {
      setGcalImporting(false);
    }
  }

  // ─── 기존 항목 구글 캘린더 일괄 동기화 ────────────────────────────────────
  async function bulkSyncToGcal(){
    if(!user||!gcalConnected) return;
    setGcalBulkSyncing(true);
    setGcalBulkResult(null);
    try{
      const today = todayStr();
      const {data:scheds} = await supabase.from("ins_schedules")
        .select("id,title,description,schedule_date,start_time,end_time,location")
        .gte("schedule_date", today).is("gcal_event_id", null).eq("is_done", false);
      const {data:todos} = await supabase.from("ins_todos")
        .select("id,title,description,due_date")
        .gte("due_date", today).eq("is_done", false);
      const schedList = scheds ?? [];
      const todoList  = todos  ?? [];
      let ok = 0, fail = 0;
      for(const s of schedList){
        try{
          await syncToGcal({id:s.id,title:s.title,description:s.description??null,schedule_date:s.schedule_date,start_time:s.start_time??null,end_time:s.end_time??null,location:s.location??null});
          ok++;
          await new Promise(r=>setTimeout(r,200));
        }catch{ fail++; }
      }
      for(const t of todoList){
        try{
          await syncToGcal({id:t.id,title:`✅ ${t.title}`,description:t.description??null,schedule_date:t.due_date,start_time:null,end_time:null,location:null});
          ok++;
          await new Promise(r=>setTimeout(r,200));
        }catch{ fail++; }
      }
      setGcalBulkResult(`완료: 일정 ${schedList.length}건 + 할일 ${todoList.length}건 → 성공 ${ok}건${fail>0?` / 실패 ${fail}건`:""}`);
      void loadGcalEvents(calViewYear, calViewMonth);
    }catch(e:any){
      setGcalBulkResult("오류: " + String(e?.message??e));
    }finally{
      setGcalBulkSyncing(false);
    }
  }

  // ─── 주간/전체 일정 로드 ──────────────────────────────────────────────────
  const loadAllSchedules = useCallback(async(mode:"week"|"all", baseDate:string, showDone:boolean)=>{
    setAllSchedLoading(true);
    const from = mode==="week" ? baseDate : todayStr();
    const to   = mode==="week" ? addDays(baseDate,6) : addDays(todayStr(),90);
    const q = supabase.from("ins_schedules").select("*").gte("schedule_date",from).lte("schedule_date",to).order("schedule_date").order("start_time");
    const {data} = showDone ? await q : await q.eq("is_done",false);
    setAllSchedules((data??[]) as Schedule[]);
    setAllSchedLoading(false);
  },[]);

  // ─── 일정 경과 기록 저장 ──────────────────────────────────────────────────
  async function saveSchedProgress(s:Schedule){
    const today = todayStr();
    const appendText = schedProgress.memo ? "["+today+"] "+schedProgress.memo : null;
    const newMemo = appendText ? (s.progress_memo ? s.progress_memo+"\n"+appendText : appendText) : s.progress_memo;
    const patch: Record<string,unknown> = { progress_memo: newMemo };
    if (schedProgress.next_date) {
      patch.next_schedule_date = schedProgress.next_date;
      patch.next_schedule_time = schedProgress.next_time || null;
      patch.is_done = true;
      const {data:newSchedData} = await supabase.from("ins_schedules").insert({
        title: s.title,
        description: newMemo,
        schedule_date: schedProgress.next_date,
        start_time: schedProgress.next_time || null,
        category: s.category,
        location: s.location,
        related_type: s.related_type,
        consultation_id: s.consultation_id,
      }).select("id").single();
      if(gcalConnected && newSchedData){
        void syncToGcal({id:newSchedData.id,title:s.title,description:newMemo,schedule_date:schedProgress.next_date,start_time:schedProgress.next_time||null,end_time:null,location:s.location});
      }
    }
    await supabase.from("ins_schedules").update(patch).eq("id",s.id);
    setSchedModal(null);
    setSchedProgress({memo:"",next_date:"",next_time:""});
    showToast("경과 저장 완료" + (schedProgress.next_date ? " + 다음 일정 등록" : ""));
    void loadSchedules();
    void loadCalData(calViewYear, calViewMonth);
  }

  const loadStats = useCallback(async()=>{
    const d30str = addDays(todayStr(), 30);
    const [a,b,c,d,e,f,g,h] = await Promise.all([
      supabase.from("ins_schedules").select("id",{count:"exact"}).eq("schedule_date",todayStr()).eq("is_done",false),
      supabase.from("ins_todos").select("id",{count:"exact"}).eq("is_done",false),
      supabase.from("ins_todos").select("id",{count:"exact"}).eq("is_done",false).eq("priority","urgent"),
      supabase.from("ins_orders").select("id",{count:"exact"}).eq("status","new"),
      supabase.from("ins_consultation_cases").select("id",{count:"exact"}).eq("work_type","registration_insurance").eq("followup_needed",true).eq("next_followup_date",todayStr()),
      supabase.from("ins_consultation_cases").select("id",{count:"exact"}).eq("work_type","registration_insurance").gte("created_at",todayStr()+"T00:00:00").lte("created_at",todayStr()+"T23:59:59"),
      supabase.from("ins_policies").select("id",{count:"exact"}).gte("expiry_date",todayStr()).lte("expiry_date",d30str),
      supabase.from("ins_claims").select("id",{count:"exact"}).in("status",["requested","processing"]),
    ]);
    setStats({todaySch:a.count??0,activeTodo:b.count??0,urgentTodo:c.count??0,newOrders:d.count??0,todayFollowup:e.count??0,newConsult:f.count??0,expiringCount:g.count??0,activeClaims:h.count??0});
  },[]);

  const loadChatHist = useCallback(async(initial=false)=>{
    if(initial) setHistLoading(true);
    // 최신 200개를 내림차순으로 가져온 뒤 역순 정렬 → 항상 최신 대화 포함
    const {data} = await supabase.from("ins_chat_logs").select("role,content,created_at").order("created_at",{ascending:false}).limit(200);
    const mapped = (data??[]).reverse().map(r=>({
      role:r.role as "user"|"assistant",
      content:r.content,
      ts:new Date(r.created_at).toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(". ","월 ").replace(". ","일 "),
    }));
    setMsgs(mapped);
    if(initial) setHistLoading(false);
    [50,200,500].forEach(ms=>setTimeout(()=>{
      const c = chatContainerRef.current;
      if(c) c.scrollTop = c.scrollHeight;
    }, ms));
  },[]);

  const loadSchedules = useCallback(async()=>{
    setSchedLoading(true);
    const tomorrow = new Date(schedDate+"T00:00:00");
    tomorrow.setDate(tomorrow.getDate()+1);
    const tomorrowStr = addDays(schedDate, 1);
    const {data} = await supabase.from("ins_schedules").select("*")
      .gte("schedule_date", schedDate)
      .lte("schedule_date", tomorrowStr)
      .order("schedule_date",{ascending:true})
      .order("start_time",{ascending:true});
    if(data)setSchedules(data as Schedule[]);
    setSchedLoading(false);
  },[schedDate]);

  const loadTodos = useCallback(async()=>{
    setTodoLoading(true);
    let q = supabase.from("ins_todos").select("*").order("priority").order("created_at",{ascending:false});
    if(tdFilter==="active")q=q.eq("is_done",false);
    if(tdFilter==="done")q=q.eq("is_done",true);
    const {data} = await q;
    if(data)setTodos(data as Todo[]);
    setTodoLoading(false);
  },[tdFilter]);

  const loadOrders = useCallback(async()=>{
    setOrderLoading(true);
    let q = supabase.from("ins_orders").select("*").order("created_at",{ascending:false});
    if(ordFilter==="active")q=q.in("status",["new","pending","processing"]);
    if(ordFilter==="done")q=q.eq("status","done");
    const {data} = await q;
    if(data)setOrders(data as Order[]);
    setOrderLoading(false);
  },[ordFilter]);

  const loadConsults = useCallback(async()=>{
    setCLoading(true);
    const [fr,rr] = await Promise.all([
      supabase.from("ins_consultation_cases")
        .select("id,customer_key,customer_name,phone,telecom_provider,work_type,status,summary,followup_needed,next_followup_date,created_at")
        .eq("work_type","registration_insurance")
        .eq("followup_needed",true).eq("next_followup_date",todayStr())
        .order("created_at",{ascending:false}).limit(10),
      supabase.from("ins_consultation_cases")
        .select("id,customer_key,customer_name,phone,telecom_provider,work_type,status,summary,followup_needed,next_followup_date,created_at")
        .eq("work_type","registration_insurance")
        .order("created_at",{ascending:false}).limit(20),
    ]);
    if(fr.data)setFollowups(fr.data as Consult[]);
    if(rr.data)setRecentC(rr.data as Consult[]);
    setCLoading(false);
  },[]);

  useEffect(()=>{
    // 세션 준비 완료 후 모든 데이터 로드
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event, session)=>{
      if((event==="SIGNED_IN"||event==="TOKEN_REFRESHED"||event==="INITIAL_SESSION") && session){
        void loadStats();
        void loadChatHist(true);
        void loadCalData(calViewYear, calViewMonth);
        void checkGcalConnection();
        void syncExpiryTodos();
      }
    });
    return ()=>subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const prevMsgLen = useRef(0);
  useEffect(()=>{
    if(msgs.length > 0 && msgs.length !== prevMsgLen.current){
      if(prevMsgLen.current > 0){
        const c = chatContainerRef.current;
        if(c) c.scrollTop = c.scrollHeight;
      }
      prevMsgLen.current = msgs.length;
    }
  },[msgs]);
  useEffect(()=>{
    if(tab==="schedule"){
      const today = todayStr();
      const tomorrowStr = addDays(today, 1);
      setSchedDate(today);
      setSchedViewMode("day");
      setSchedLoading(true);
      Promise.all([
        supabase.from("ins_schedules").select("*")
          .gte("schedule_date",today).lte("schedule_date",tomorrowStr)
          .order("schedule_date",{ascending:true}).order("start_time",{ascending:true}),
        supabase.from("ins_todos").select("*").eq("is_done",false).order("priority").order("created_at",{ascending:false}),
      ]).then(([sr,tr])=>{
        if(sr.data) setSchedules(sr.data as Schedule[]);
        if(tr.data) setTodos(tr.data as Todo[]);
        setSchedLoading(false);
      });
      // 구글 캘린더 → AI비서(Ins) 자동 역방향 동기화
      if(gcalConnected) void importGcalToLocal(calViewYear, calViewMonth);
    }
    if(tab==="todo") void loadTodos();
    if(tab==="chat"){ setTimeout(()=>{ const c=chatContainerRef.current; if(c)c.scrollTop=c.scrollHeight; },100); }
  },[tab, loadTodos]);
  // ─── 상담 → 고객 등록 ────────────────────────────────────────────────────────
  const [regLoading,setRegLoading] = useState<number|"all"|null>(null); // 등록 중인 consult id 또는 "all"

  async function registerCustomerFromConsult(c:Consult){
    const phone = c.phone?.replace(/\D/g,"")||"";
    const cKey = c.customer_key || makeCustomerKey(c.customer_name, phone);
    const {error} = await supabase.from("ins_customer_info").upsert({
      customer_key: cKey,
      customer_name: c.customer_name,
      phone: phone || null,
    },{onConflict:"customer_key"});
    return error ? null : cKey;
  }

  async function registerOneCustomer(c:Consult){
    setRegLoading(c.id);
    const cKey = await registerCustomerFromConsult(c);
    setRegLoading(null);
    if(cKey) showToast(`👤 ${c.customer_name} 고객 등록 완료 (${cKey})`);
    else showToast("고객 등록 실패","err");
  }

  async function registerAllCustomers(){
    if(!recentC.length) return;
    setRegLoading("all");
    let ok=0, skip=0;
    for(const c of recentC){
      if(!c.customer_name){ skip++; continue; }
      const cKey = await registerCustomerFromConsult(c);
      if(cKey) ok++; else skip++;
    }
    setRegLoading(null);
    showToast(`👤 고객 등록 완료 ${ok}건${skip>0?" (건너뜀 "+skip+"건)":""}`);
    void loadRecentChanged();
  }

  // 전체 consultation_cases + ins_consultation_cases → ins_customer_info 일괄 등록
  const [regAllLoading,setRegAllLoading] = useState(false);
  const [regAllResult,setRegAllResult]   = useState<{ok:number;skip:number}|null>(null);

  async function registerAllFromDB(){
    if(!window.confirm("기존 상담 고객(갈미건설 등) + 보험 상담 고객 전체를 고객으로 등록합니다.\n이미 등록된 고객은 건너뜁니다. 계속하시겠습니까?")) return;
    setRegAllLoading(true);
    setRegAllResult(null);
    let ok = 0, skip = 0;

    for(const tbl of ["consultation_cases","ins_consultation_cases"] as const){
      let page = 0;
      while(true){
        const {data} = await (supabase.from(tbl) as any)
          .select("customer_key,customer_name,phone")
          .order("id",{ascending:true})
          .range(page*100, page*100+99);
        if(!data || data.length===0) break;
        for(const r of data){
          if(!r.customer_name){ skip++; continue; }
          const phone = (r.phone||"").replace(/\D/g,"");
          const cKey = r.customer_key || makeCustomerKey(r.customer_name, phone);
          const {error} = await supabase.from("ins_customer_info").upsert(
            {customer_key:cKey, customer_name:r.customer_name, phone:phone||null},
            {onConflict:"customer_key", ignoreDuplicates:true}
          );
          if(error) skip++; else ok++;
        }
        if(data.length < 100) break;
        page++;
      }
    }

    setRegAllLoading(false);
    setRegAllResult({ok,skip});
    showToast(`👤 전체 등록 완료 — 신규 ${ok}건, 건너뜀 ${skip}건`);
    void loadRecentChanged();
  }

  useEffect(()=>{if(tab==="consults"){void loadOrders();void loadConsults();void syncExpiryTodos();}},[tab,loadOrders,loadConsults]);

  // ─── 만기일 할일 일괄 동기화 ─────────────────────────────────────────────────
  // 앱 초기화 시 + 상담 탭 진입 시 자동 실행
  // consultation_insurance_details 전체에서 만기일 있는 건 → ins_todos 자동 등록
  async function syncExpiryTodos(){
    // consultation_insurance_details에서 만기일 있는 건 전체 조회
    const {data:details} = await supabase
      .from("consultation_insurance_details")
      .select("id,consultation_id,insurance_type,insurance_company,insurance_end_date,vehicle_no")
      .not("insurance_end_date","is",null);
    if(!details||details.length===0) return;

    // consultation_id → customer_name 매핑
    const consultIds = details.map(d=>d.consultation_id).filter(Boolean);
    const {data:cases} = await supabase
      .from("consultation_cases")
      .select("id,customer_name")
      .in("id",consultIds);
    const nameMap = new Map((cases??[]).map((c:any)=>[c.id, c.customer_name]));

    let added = 0;
    for(const d of details){
      if(!d.insurance_end_date) continue;
      const custName = nameMap.get(d.consultation_id) || "고객";
      const insType = d.insurance_type==="automobile"?"자동차보험":d.insurance_type||"보험";
      const todoTitle = `[만기임박] ${custName} ${insType} 만기 ${d.insurance_end_date}`;
      const {data:exist} = await supabase.from("ins_todos")
        .select("id").eq("title",todoTitle).maybeSingle();
      if(!exist){
        await supabase.from("ins_todos").insert({
          title: todoTitle,
          description: `${custName} 고객의 ${insType} 만기일: ${d.insurance_end_date}${d.vehicle_no?"\n차량번호: "+d.vehicle_no:""}\n만기 30일 전 갱신 안내 필요`,
          priority: "urgent",
          category: "보험만기",
          due_date: d.insurance_end_date,
        });
        added++;
      }
    }
    if(added>0){
      void loadTodos();
      void loadStats();
      void loadCalData(calViewYear, calViewMonth);
      showToast(`📅 만기일 할일 ${added}건 자동 등록`);
    }
  }
  // 달력 날짜 클릭 시 자동 갱신
  useEffect(()=>{ if(tab==="schedule") void loadSchedules(); },[schedDate, loadSchedules]);

  // ─── 계약 CRUD ──────────────────────────────────────────────────────────────
  const loadPolicies = useCallback(async()=>{
    setPolicyLoading(true);
    const d30str = addDays(todayStr(), 30);
    const [all,exp] = await Promise.all([
      supabase.from("ins_policies").select("*").order("expiry_date",{ascending:true}),
      supabase.from("ins_policies").select("*").gte("expiry_date",todayStr()).lte("expiry_date",d30str).order("expiry_date",{ascending:true}),
    ]);
    if(all.data) setPolicies(all.data as Policy[]);
    if(exp.data) setExpiringPolicies(exp.data as Policy[]);
    setPolicyLoading(false);
  },[]);

  async function addPolicy(){
    if(!newPolicy.customer_name||!newPolicy.product_name||!newPolicy.start_date)return;
    const cKey = makeCustomerKey(newPolicy.customer_name, newPolicy.phone);
    const {error}=await supabase.from("ins_policies").insert({
      customer_key:cKey,
      customer_name:newPolicy.customer_name,
      product_name:newPolicy.product_name,
      start_date:newPolicy.start_date,
      expiry_date:newPolicy.expiry_date||null,
      memo:newPolicy.memo||null,
    });
    if(!error){
      showToast("계약 등록 완료");
      setShowPolicyForm(false);
      setNewPolicy({customer_name:"",phone:"",product_name:"",start_date:"",expiry_date:"",memo:""});
      void loadPolicies(); void loadStats();
    }
  }

  async function delPolicy(id:number){
    await supabase.from("ins_policies").delete().eq("id",id);
    setPolicies(p=>p.filter(x=>x.id!==id));
    setExpiringPolicies(p=>p.filter(x=>x.id!==id));
    void loadStats();
  }

  // 만기까지 남은 일수
  const daysUntilExpiry = (expiry:string|null) => {
    if(!expiry) return null;
    const diff = Math.ceil((new Date(expiry).getTime()-new Date(todayStr()).getTime())/(1000*60*60*24));
    return diff;
  };

  useEffect(()=>{if(tab==="policies"){void loadPolicies();}},[tab,loadPolicies]);

  // ─── 청구 CRUD ──────────────────────────────────────────────────────────────
  const loadClaims = useCallback(async()=>{
    setClaimLoading(true);
    let q = supabase.from("ins_claims").select("*").order("claim_date",{ascending:false});
    if(claimFilter==="active") q = q.in("status",["requested","processing"]);
    else if(claimFilter==="completed") q = q.eq("status","completed");
    const {data} = await q.limit(60);
    if(data) setClaims(data as Claim[]);
    setClaimLoading(false);
  },[claimFilter]);

  async function saveClaim(id:number){
    if(!editingClaim)return;
    await supabase.from("ins_claims").update({
      product_name:editingClaim.product_name,
      claim_date:editingClaim.claim_date,
      claim_type:editingClaim.claim_type,
      status:editingClaim.status,
      memo:editingClaim.memo??null,
    }).eq("id",id);
    setEditingClaim(null); setExpandedClaim(null);
    void loadClaims(); showToast("청구 수정 완료");
  }

  async function savePolicy(id:number){
    if(!editingPolicy)return;
    await supabase.from("ins_policies").update({
      product_name:editingPolicy.product_name,
      start_date:editingPolicy.start_date,
      expiry_date:editingPolicy.expiry_date??null,
      memo:editingPolicy.memo??null,
    }).eq("id",id);
    setEditingPolicy(null); setExpandedPolicy(null);
    void loadPolicies(); showToast("계약 수정 완료");
  }

  async function saveConsult(id:number){
    if(!editingConsult)return;
    await supabase.from("ins_consultation_cases").update({
      status:editingConsult.status,
      summary:editingConsult.summary,
      followup_needed:editingConsult.followup_needed,
      next_followup_date:editingConsult.next_followup_date??null,
    }).eq("id",id);
    setEditingConsult(null); setExpandedConsult(null);
    void loadConsults(); showToast("상담 수정 완료");
  }

  // ─── 청구 등록 ──────────────────────────────────────────────────────────────
  async function addClaim(){
    if(!newClaim.customer_name||!newClaim.product_name||!newClaim.claim_date)return;
    const cKey = makeCustomerKey(newClaim.customer_name, newClaim.phone);
    const {error}=await supabase.from("ins_claims").insert({
      customer_key:cKey,
      customer_name:newClaim.customer_name,
      product_name:newClaim.product_name,
      claim_date:newClaim.claim_date,
      claim_type:newClaim.claim_type,
      status:"requested",
      memo:newClaim.memo||null,
    });
    if(!error){
      showToast("청구 등록 완료");
      setShowClaimForm(false);
      setNewClaim({customer_name:"",phone:"",product_name:"",claim_date:todayStr(),claim_type:"outpatient",memo:""});
      void loadClaims(); void loadStats();
    }
  }

  async function setClaimStatus(id:number, status:Claim["status"]){
    await supabase.from("ins_claims").update({status}).eq("id",id);
    void loadClaims(); void loadStats();
    showToast(CLAIM_STS_LBL[status]+"으로 변경");
  }

  async function delClaim(id:number){
    await supabase.from("ins_claims").delete().eq("id",id);
    setClaims(p=>p.filter(c=>c.id!==id)); void loadStats();
  }

  useEffect(()=>{if(tab==="claims"){void loadClaims();}},[tab,loadClaims]);

  // ─── 고객 조회 ──────────────────────────────────────────────────────────────
  const searchCustomers = useCallback(async(name:string)=>{
    if(!name.trim()){setCustResults([]);return;}
    setCustLoading(true);
    const [pr,cr,cr2,clr,ir] = await Promise.all([
      supabase.from("ins_policies").select("customer_key,customer_name").ilike("customer_name",`%${name}%`),
      supabase.from("ins_consultation_cases").select("customer_key,customer_name").ilike("customer_name",`%${name}%`),
      // consultation_cases — customer_key 없으므로 id,name,phone 조회 후 직접 생성
      supabase.from("consultation_cases").select("id,customer_name,phone").ilike("customer_name",`%${name}%`).limit(20),
      supabase.from("ins_claims").select("customer_key,customer_name").ilike("customer_name",`%${name}%`),
      supabase.from("ins_customer_info").select("customer_key,customer_name").or(`customer_name.ilike.%${name}%,customer_key.ilike.%${name}%`),
    ]);
    const map = new Map<string,string>();
    for(const row of [...(pr.data??[]),...(cr.data??[]),...(clr.data??[])]) {
      if(row.customer_key && !map.has(row.customer_key))
        map.set(row.customer_key, row.customer_name);
    }
    // consultation_cases — phone으로 customer_key 생성
    for(const row of (cr2.data??[])) {
      if(!row.customer_name) continue;
      const phone = (row.phone||"").replace(/\D/g,"");
      const cKey = phone ? `${row.customer_name}_${phone.slice(-4)}` : row.customer_name;
      if(!map.has(cKey)) map.set(cKey, row.customer_name);
    }
    // ins_customer_info
    for(const row of (ir.data??[])) {
      if(row.customer_key && !map.has(row.customer_key)) {
        const customerName = row.customer_name || row.customer_key.replace(/_\d{4}$/, "");
        map.set(row.customer_key, customerName);
      }
    }
    setCustResults(Array.from(map.entries()).map(([k,n])=>({customer_key:k,customer_name:n})));
    setCustLoading(false);
  },[]);

  async function saveCustInfo(){
    if(!selectedCust) return;
    const payload = {...custInfoForm, customer_key:selectedCust.customer_key};
    if(custInfo?.id){
      await supabase.from("ins_customer_info").update(payload).eq("id",custInfo.id);
    } else {
      const {data} = await supabase.from("ins_customer_info").insert(payload).select("*").single();
      if(data) setCustInfo(data as CustomerInfo);
    }
    setCustInfo(payload as CustomerInfo);
    setEditingCustInfo(false);
    showToast("고객 정보 저장 완료");
  }

  // ─── 엑셀 업로드 ────────────────────────────────────────────────────────────
  async function handleUpload(e:React.ChangeEvent<HTMLInputElement>){
    const file = e.target.files?.[0];
    if(!file) return;
    setUploadLoading(true);
    setUploadResult(null);
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs" as any);
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, {type:"array", cellDates:true});

      // "고객정보" 시트 우선, 없으면 첫 번째 시트
      const sheetName = wb.SheetNames.includes("고객정보") ? "고객정보" : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      if(!ws){ showToast("시트를 찾을 수 없습니다","err"); setUploadLoading(false); return; }

      const rows:any[][] = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
      // 3행 = 컬럼키(숨김), 4행 = 헤더, 5행부터 데이터
      let ok=0, skip=0;
      const errs:string[] = [];

      for(let i=4; i<rows.length; i++){
        const r = rows[i];
        const name    = String(r[0]??"").trim();
        const phone   = String(r[1]??"").replace(/[^0-9]/g,""); // 전체번호 숫자만
        const product = String(r[2]??"").trim();
        const start   = r[3] instanceof Date ? r[3].toISOString().slice(0,10) : String(r[3]??"").trim();
        const expiry  = r[4] instanceof Date ? r[4].toISOString().slice(0,10) : String(r[4]??"").trim();
        const bankName    = String(r[5]??"").trim();
        const bankAccount = String(r[6]??"").trim();
        const cardCompany = String(r[7]??"").trim();
        const cardNumber  = String(r[8]??"").trim();
        const cardExpiry  = String(r[9]??"").trim();
        const memo        = String(r[10]??"").trim();

        if(!name||!product||!start){ skip++; continue; }
        const last4 = phone.slice(-4);
        const cKey  = last4 ? `${name}_${last4}` : name;

        // ① ins_policies 저장
        const {error:pe} = await supabase.from("ins_policies").insert({
          customer_key:cKey, customer_name:name,
          product_name:product, start_date:start,
          expiry_date:expiry||null, memo:memo||null,
        });
        if(pe){ errs.push(`계약[${i-3}행] ${name}: ${pe.message}`); continue; }

        // ② ins_customer_info upsert (계좌/카드 중 하나라도 있으면)
        if(bankName||bankAccount||cardCompany||cardNumber||cardExpiry||phone){
          await supabase.from("ins_customer_info").upsert({
            customer_key:cKey,
            phone:phone||null,
            bank_name:bankName||null, bank_account:bankAccount||null,
            card_company:cardCompany||null, card_number:cardNumber||null,
            card_expiry:cardExpiry||null,
            memo:memo||null,
          },{onConflict:"customer_key"});
        }
        ok++;
      }

      setUploadResult({ok, skip, err:errs});
      if(ok>0) showToast(`${ok}건 업로드 완료`);
    } catch(err:any){
      showToast(`업로드 오류: ${err.message}`,"err");
    }
    setUploadLoading(false);
    if(uploadRef.current) uploadRef.current.value="";
  }

  // ─── 최근 변경 고객 로드 ────────────────────────────────────────────────────
  const loadRecentChanged = useCallback(async()=>{
    setRecentChangedLoading(true);
    const [cr,pr,clr] = await Promise.all([
      supabase.from("ins_consultation_cases").select("customer_key,customer_name,created_at").order("created_at",{ascending:false}).limit(20),
      supabase.from("ins_policies").select("customer_key,customer_name,created_at").order("created_at",{ascending:false}).limit(20),
      supabase.from("ins_claims").select("customer_key,customer_name,created_at").order("created_at",{ascending:false}).limit(20),
    ]);
    type Row = {customer_key:string;customer_name:string;created_at:string;change_type:"상담"|"계약"|"청구"};
    const rows:Row[] = [
      ...(cr.data??[]).map((r:any)=>({...r,change_type:"상담" as const})),
      ...(pr.data??[]).map((r:any)=>({...r,change_type:"계약" as const})),
      ...(clr.data??[]).map((r:any)=>({...r,change_type:"청구" as const})),
    ];
    rows.sort((a,b)=>b.created_at.localeCompare(a.created_at));
    const seen = new Set<string>();
    const deduped:{customer_key:string;customer_name:string;changed_at:string;change_type:"상담"|"계약"|"청구"}[] = [];
    for(const r of rows){
      if(!r.customer_key||seen.has(r.customer_key)) continue;
      seen.add(r.customer_key);
      deduped.push({customer_key:r.customer_key,customer_name:r.customer_name,changed_at:r.created_at,change_type:r.change_type});
      if(deduped.length>=10) break;
    }
    setRecentChanged(deduped);
    setRecentChangedLoading(false);
  },[]);
  useEffect(()=>{if(tab==="customers"){void loadRecentChanged();}},[tab,loadRecentChanged]);

  // 나르미 데이터 로드
  useEffect(()=>{
    if(tab!=="narumi") return;
    setNarumiLoading(true);
    Promise.all([
      supabase.from("narumi_tasks").select("*").order("created_at",{ascending:false}).limit(60),
      supabase.from("consultation_cases").select("id,customer_name,work_type,status,summary,created_at,phone").eq("work_type","narumi").order("created_at",{ascending:false}).limit(30),
    ]).then(([nRes, cRes])=>{
      setNarumiList((nRes.data??[]) as NarumiTask[]);
      setNarumiConsults((cRes.data??[]) as Consult[]);
      setNarumiLoading(false);
    });
  },[tab]);

  // 전체 고객 로드 — ins_customer_info 전체 + consultation_cases 이름 목록 병합
  const loadAllCustomers = useCallback(async()=>{
    setAllCustsLoading(true);
    const [ir, cr] = await Promise.all([
      supabase.from("ins_customer_info").select("customer_key,customer_name").order("customer_name"),
      supabase.from("consultation_cases").select("customer_name,phone").eq("work_type","registration_insurance").order("customer_name"),
    ]);
    const map = new Map<string,string>();
    for(const r of (ir.data??[])){
      if(r.customer_key) map.set(r.customer_key, r.customer_name||r.customer_key.replace(/_\d{4}$/,""));
    }
    for(const r of (cr.data??[])){
      if(!r.customer_name) continue;
      const phone = (r.phone||"").replace(/\D/g,"");
      const cKey = phone ? `${r.customer_name}_${phone.slice(-4)}` : r.customer_name;
      if(!map.has(cKey)) map.set(cKey, r.customer_name);
    }
    const sorted = Array.from(map.entries())
      .map(([k,n])=>({customer_key:k,customer_name:n}))
      .sort((a,b)=>a.customer_name.localeCompare(b.customer_name,"ko"));
    setAllCusts(sorted);
    setAllCustsLoading(false);
  },[]);

  const loadCustomerProfile = useCallback(async(key:string, name:string)=>{
    setCustDetailLoading(true);
    setSelectedCust(null);
    setCustInfo(null);
    setCustSearch("");
    setCustResults([]);
    const nameFromKey = key.replace(/_\d{4}$/, "");

    const [pr,cr,cr2,clr,ir] = await Promise.all([
      supabase.from("ins_policies").select("*").eq("customer_key",key).order("start_date",{ascending:false}),
      supabase.from("ins_consultation_cases").select("*").eq("customer_key",key).order("created_at",{ascending:false}),
      // consultation_cases — customer_key 컬럼 없으므로 이름으로만 조회, work_type 무관
      supabase.from("consultation_cases").select("*")
        .ilike("customer_name", nameFromKey)
        .order("created_at",{ascending:false}).limit(30),
      supabase.from("ins_claims").select("*").eq("customer_key",key).order("claim_date",{ascending:false}),
      supabase.from("ins_customer_info").select("*").eq("customer_key",key).maybeSingle(),
    ]);

    // consultation_insurance_details — consultation_cases id 목록으로 조회
    const consultIds = (cr2.data??[]).map((c:any)=>c.id).filter(Boolean);
    const {data:insDetailsRaw} = consultIds.length > 0
      ? await supabase.from("consultation_insurance_details").select("*").in("consultation_id", consultIds)
      : {data:[]};
    const insDetails = (insDetailsRaw??[]) as InsuranceDetail[];

    // 메인 consultation_cases 완료건 → ins_policies 자동 upsert
    const completedCases = (cr2.data??[]).filter((c:any)=>c.status==="completed"||c.status==="done"||c.status==="closed");
    for(const c of completedCases){
      const detail = insDetails.find(d=>d.consultation_id===c.id);
      const startDate = detail?.insurance_start_date || c.completed_at?.slice(0,10) || c.updated_at?.slice(0,10) || c.created_at?.slice(0,10) || todayStr();
      const endDate = detail?.insurance_end_date || null;
      const insType = detail?.insurance_type==="automobile"?"자동차보험":detail?.insurance_type||null;
      const productName = insType || detail?.insurance_company || detail?.insurer_name || c.summary?.slice(0,50) || "보험";
      await supabase.from("ins_policies").upsert({
        customer_key: key, customer_name: name,
        product_name: productName,
        start_date: startDate,
        expiry_date: endDate,
        memo: `[자동등록] ${c.summary||""}`.slice(0,200),
      },{onConflict:"customer_key,start_date,product_name",ignoreDuplicates:true});

      // 만기일 → ins_todos 자동 등록 (만기일 당일을 due_date로, 중복 방지)
      if(endDate){
        const todoTitle = `[만기임박] ${name} ${productName} 만기 ${endDate}`;
        const {data:existTodo} = await supabase.from("ins_todos")
          .select("id").eq("title",todoTitle).maybeSingle();
        if(!existTodo){
          await supabase.from("ins_todos").insert({
            title: todoTitle,
            description: `${name} 고객의 ${productName} 만기일: ${endDate}\n만기 30일 전 갱신 안내 필요`,
            priority: "urgent",
            category: "보험만기",
            due_date: endDate, // 만기일 당일 → 해당 월 캘린더에 표시
          });
        }
      }
    }

    // consultation_insurance_details 만기일도 todos 등록
    for(const d of insDetails){
      if(!d.insurance_end_date) continue;
      const insType = d.insurance_type==="automobile"?"자동차보험":d.insurance_type||"보험";
      const todoTitle = `[만기임박] ${name} ${insType} 만기 ${d.insurance_end_date}`;
      const {data:existTodo} = await supabase.from("ins_todos")
        .select("id").eq("title",todoTitle).maybeSingle();
      if(!existTodo){
        await supabase.from("ins_todos").insert({
          title: todoTitle,
          description: `${name} 고객의 ${insType} 만기일: ${d.insurance_end_date}${d.vehicle_no?"\n차량번호: "+d.vehicle_no:""}\n만기 30일 전 갱신 안내 필요`,
          priority: "urgent",
          category: "보험만기",
          due_date: d.insurance_end_date, // 만기일 당일 → 해당 월 캘린더에 표시
        });
      }
    }

    // 할일 등록 후 캘린더·할일 갱신
    void loadTodos();
    void loadStats();
    void loadCalData(calViewYear, calViewMonth);

    const {data:prRefresh} = await supabase.from("ins_policies").select("*").eq("customer_key",key).order("start_date",{ascending:false});

    // 상담이력 병합
    const seen = new Set<string>();
    const mergedConsults = [...(cr.data??[]),...(cr2.data??[])].filter(r=>{
      const k = `${r.customer_name}_${r.created_at}`;
      if(seen.has(k)) return false;
      seen.add(k); return true;
    }).sort((a:any,b:any)=>b.created_at.localeCompare(a.created_at));

    setSelectedCust({
      customer_key:key, customer_name:name,
      policies:(prRefresh??pr.data??[]) as Policy[],
      consults:mergedConsults as Consult[],
      claims:(clr.data??[]) as Claim[],
      insuranceDetails: insDetails,
    });
    if(ir.data){
      setCustInfo(ir.data as CustomerInfo);
      setCustInfoForm(ir.data as CustomerInfo);
    } else {
      const casePhoneFull = mergedConsults.find((c:any)=>c.phone&&c.phone.replace(/\D/g,"").length>=10)?.phone ?? "";
      const casePhone4 = mergedConsults.find((c:any)=>c.phone&&c.phone!=="미입력")?.phone ?? "";
      const autoPhone = casePhoneFull || casePhone4;
      setCustInfoForm({customer_key:key,phone:autoPhone,bank_name:"",bank_account:"",card_company:"",card_number:"",card_expiry:"",memo:""});
    }
    setCustDetailLoading(false);
  },[loadTodos, loadStats, loadCalData, calViewYear, calViewMonth]);

  // ─── 일정 CRUD ──────────────────────────────────────────────────────────────
  async function addSchedule(){
    if(!newSched.title)return;
    if(newSched.category==="followup"&&newSched.consultation_id){
      await supabase.from("ins_consultation_cases").update({next_followup_date:newSched.schedule_date,followup_needed:true}).eq("id",Number(newSched.consultation_id));
    }
    const {data:schedData,error}=await supabase.from("ins_schedules").insert({
      title:newSched.title,description:newSched.description||null,schedule_date:newSched.schedule_date,
      start_time:newSched.start_time||null,end_time:newSched.end_time||null,category:newSched.category,
      location:newSched.location||null,related_type:newSched.related_type||null,
      consultation_id:newSched.consultation_id?Number(newSched.consultation_id):null,
    }).select("id").single();
    if(!error){
      showToast("일정 저장 완료");
      setShowSchedForm(false);
      setNewSched({title:"",description:"",schedule_date:todayStr(),start_time:"",end_time:"",category:"meeting",location:"",related_type:"",consultation_id:""});
      void loadSchedules(); void loadStats();
      void loadCalData(calViewYear, calViewMonth);
      // 구글 캘린더 동기화
      if(gcalConnected && schedData) void syncToGcal({
        id:schedData.id, title:newSched.title, description:newSched.description||null,
        schedule_date:newSched.schedule_date, start_time:newSched.start_time||null,
        end_time:newSched.end_time||null, location:newSched.location||null,
      });
    }
  }
  async function toggleSched(id:number,done:boolean){
    await supabase.from("ins_schedules").update({is_done:!done}).eq("id",id);
    setSchedules(p=>p.map(s=>s.id===id?{...s,is_done:!done}:s));
  }
  async function delSched(id:number){
    await supabase.from("ins_schedules").delete().eq("id",id);
    setSchedules(p=>p.filter(s=>s.id!==id)); void loadStats();
  }

  // ─── 할일 CRUD ──────────────────────────────────────────────────────────────
  async function addTodo(){
    if(!newTodo.title)return;
    const {error}=await supabase.from("ins_todos").insert({
      title:newTodo.title,description:newTodo.description||null,priority:newTodo.priority,
      category:newTodo.category||null,due_date:newTodo.due_date||null,
      consultation_id:newTodo.consultation_id?Number(newTodo.consultation_id):null,
    });
    if(!error){showToast("할일 저장 완료");setShowTodoForm(false);setNewTodo({title:"",description:"",priority:"normal",category:"",due_date:"",consultation_id:""});void loadTodos();void loadStats();void loadCalData(calViewYear, calViewMonth);}
  }
  async function toggleTodo(id:number,done:boolean){
    await supabase.from("ins_todos").update({is_done:!done,done_at:!done?new Date().toISOString():null}).eq("id",id);
    void loadTodos(); void loadStats();
  }
  async function delTodo(id:number){
    await supabase.from("ins_todos").delete().eq("id",id);
    setTodos(p=>p.filter(t=>t.id!==id)); void loadStats();
  }

  // ─── 상담 CRUD ──────────────────────────────────────────────────────────────
  async function addOrder(){
    if(!newOrder.customer_name||!newOrder.summary)return;
    const cKey = makeCustomerKey(newOrder.customer_name, newOrder.phone);
    let cid:number|null=null;
    if(syncConsult){
      const {data:cd,error:ce}=await supabase.from("ins_consultation_cases").insert({
        customer_key:cKey,
        customer_name:newOrder.customer_name,phone:newOrder.phone||"미입력",telecom_provider:newOrder.telecom_provider||null,
        work_type:"registration_insurance",status:"new",
        summary:`[AI비서(Ins) ${newOrder.channel==="kakao"?"카카오":newOrder.channel} 접수] ${newOrder.summary}`,
        detail_memo:newOrder.detail||null,followup_needed:false,call_datetime:new Date().toISOString(),
      }).select("id").single();
      if(ce){showToast("상담관리 연동 실패","err");return;}
      if(cd)cid=cd.id;
    }
    const {error}=await supabase.from("ins_orders").insert({
      customer_key:cKey,
      customer_name:newOrder.customer_name,channel:newOrder.channel,
      work_type:"insurance",summary:newOrder.summary,detail:newOrder.detail||null,status:"new",consultation_id:cid,
    });
    if(!error){
      showToast(cid?`상담 등록 완료 (상담#${cid})`:"상담 등록 완료");
      setShowOrderForm(false);
      setNewOrder({customer_name:"",phone:"",channel:"kakao",work_type:"",summary:"",detail:"",telecom_provider:"",region:""});
      void loadOrders(); void loadStats();
    }
  }
  async function setOrderStatus(id:number,status:Order["status"]){
    await supabase.from("ins_orders").update({status,...(status==="done"?{completed_at:new Date().toISOString()}:{})}).eq("id",id);
    const o=orders.find(x=>x.id===id);
    if(o?.consultation_id){
      const m:Record<string,string>={done:"completed",processing:"in_progress",new:"new",pending:"pending"};
      await supabase.from("ins_consultation_cases").update({status:m[status]??status}).eq("id",o.consultation_id);
      showToast("상태 변경 + 상담관리 동기화");
    }
    void loadOrders(); void loadStats();
  }
  async function delOrder(id:number){
    await supabase.from("ins_orders").delete().eq("id",id);
    setOrders(p=>p.filter(o=>o.id!==id)); void loadStats();
  }

  // ─── 일정 저장 후 고객 상담이력 자동 기록 ──────────────────────────────────
  // 1) 고객 검색 → 확인 카드를 채팅 메시지로 삽입 (직접 저장하지 않음)
  // 2) 사용자가 "맞습니다" 확인 후에 ins_consultation_cases 에 insert
  async function addConsultFromSchedule(schedTitle:string, schedDate:string, startTime:string|null, location:string|null, schedId:number){
    const summary = `[일정등록] ${schedTitle}`;
    const logTs = new Date().toISOString();

    // 제목에서 고객명 후보 추출 (가장 첫 번째 한글 단어)
    const firstWord = schedTitle.trim().split(/[\s,·]/)[0].replace(/[^가-힣]/g,"");
    if(!firstWord || firstWord.length < 2) return;

    // DB에서 해당 이름 고객 검색
    const [pr,cr] = await Promise.all([
      supabase.from("ins_consultation_cases").select("customer_key,customer_name,phone").ilike("customer_name",`%${firstWord}%`).limit(5),
      supabase.from("ins_policies").select("customer_key,customer_name").ilike("customer_name",`%${firstWord}%`).limit(5),
    ]);
    const map = new Map<string,{customer_key:string;customer_name:string;phone?:string}>();
    for(const r of [...(pr.data??[]),...(cr.data??[])]) {
      if(r.customer_key && !map.has(r.customer_key)) map.set(r.customer_key, r);
    }
    const candidates = Array.from(map.values());

    if(candidates.length === 0){
      // 고객 없음 → 연락처 요청
      const promptMsg = `"${firstWord}" 고객 정보가 없습니다. 고객 등록을 위해 연락처를 알려주세요. (예: 장미희 010-1234-5678)`;
      setMsgs(p=>[...p,{role:"assistant",content:promptMsg,ts:nowTs()}]);
      setTab("chat");
      await supabase.from("ins_chat_logs").insert([{role:"assistant",content:promptMsg,session_id:"main"}]);
      return;
    }

    // 후보가 1명이든 여러 명이든 → 확인 카드를 채팅에 삽입
    const confirmMsg:ChatMsg = {
      role:"assistant",
      content: candidates.length===1
        ? `📋 "${firstWord}" 고객의 상담이력에 이번 일정을 기록하겠습니다. 아래 고객이 맞는지 확인해주세요.`
        : `📋 "${firstWord}" 동명이인이 ${candidates.length}명 있습니다. 상담이력을 기록할 고객을 선택해주세요.`,
      ts: nowTs(),
      pendingScheduleConsults:[{
        schedTitle, schedDate, startTime, location, schedId,
        candidates,
      }],
      // summary/logTs 는 확인 후 insert 시 사용하기 위해 별도 클로저로 처리
    };
    setMsgs(p=>[...p, confirmMsg]);
    setTab("chat");
    await supabase.from("ins_chat_logs").insert([{role:"assistant",content:confirmMsg.content,session_id:"main"}]);

    // summary/logTs 를 클로저에 담아 pendingScheduleConsults 에 첨부 (타입 확장 대신 WeakMap 사용)
    _pendingConsultMeta.set(confirmMsg, {summary, logTs});
  }

  // 일정→상담이력 메타 저장소 (WeakMap: confirmMsg 객체가 GC되면 자동 해제)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _pendingConsultMetaRef = useRef(new WeakMap<any,{summary:string;logTs:string}>());
  const _pendingConsultMeta = _pendingConsultMetaRef.current;

  async function confirmScheduleConsult(msgIdx:number, pscIdx:number, customerKey:string){
    const msg = msgsRef.current[msgIdx];
    const psc = msg.pendingScheduleConsults?.[pscIdx];
    if(!psc) return;
    const meta = _pendingConsultMeta.get(msg) ?? {
      summary:`[일정등록] ${psc.schedTitle}`,
      logTs: new Date().toISOString(),
    };
    const candidate = psc.candidates.find(c=>c.customer_key===customerKey);
    if(!candidate) return;

    const {error} = await supabase.from("ins_consultation_cases").insert({
      customer_key: candidate.customer_key,
      customer_name: candidate.customer_name,
      phone: candidate.phone ?? "미입력",
      work_type: "registration_insurance",
      status: "in_progress",
      summary: meta.summary,
      detail_memo: `📅 일정: ${psc.schedDate}${psc.startTime?" "+psc.startTime.slice(0,5):""}${psc.location?" / "+psc.location:""}\n🔗 일정ID: ins_schedule#${psc.schedId}\n📝 등록일시: ${new Date(meta.logTs).toLocaleString("ko-KR")}`,
      followup_needed: false,
      call_datetime: meta.logTs,
    });
    if(error){ showToast("상담이력 저장 실패","err"); return; }

    // 확인 카드 제거 + 완료 메시지 삽입
    setMsgs(p=>p.map((m,i)=>{
      if(i!==msgIdx) return m;
      const remaining = (m.pendingScheduleConsults??[]).filter((_,j)=>j!==pscIdx);
      return {...m, pendingScheduleConsults:remaining};
    }));
    const doneMsg = `✅ ${candidate.customer_name}(${candidate.customer_key}) 상담이력 기록 완료`;
    setMsgs(p=>[...p,{role:"assistant",content:doneMsg,ts:nowTs()}]);
    showToast(`📋 ${candidate.customer_name} 상담이력 저장`);
    await supabase.from("ins_chat_logs").insert([{role:"assistant",content:doneMsg,session_id:"main"}]);
  }

  async function rejectScheduleConsult(msgIdx:number, pscIdx:number){
    const msg = msgsRef.current[msgIdx];
    const psc = msg.pendingScheduleConsults?.[pscIdx];
    // 확인 카드 제거
    setMsgs(p=>p.map((m,i)=>{
      if(i!==msgIdx) return m;
      const remaining = (m.pendingScheduleConsults??[]).filter((_,j)=>j!==pscIdx);
      return {...m, pendingScheduleConsults:remaining};
    }));
    // 신규 고객 등록을 위한 연락처 요청 메시지 삽입
    const custName = psc?.schedTitle.trim().split(/[\s,·]/)[0].replace(/[^가-힣]/g,"") ?? "고객";
    const promptMsg = `"${custName}" 신규 고객으로 등록하겠습니다. 연락처를 알려주세요.\n(예: ${custName} 010-1234-5678)`;
    setMsgs(p=>[...p,{role:"assistant",content:promptMsg,ts:nowTs()}]);
    setTab("chat");
    await supabase.from("ins_chat_logs").insert([{role:"assistant",content:promptMsg,session_id:"main"}]);
  }

  // ─── AI 채팅 ────────────────────────────────────────────────────────────────
  async function sendChat(){
    const text=chatInput.trim();
    if(!text||chatLoading)return;
    setChatInput("");
    const next:ChatMsg[]=[...msgsRef.current,{role:"user",content:text,ts:nowTs()}];
    setMsgs(next);
    setChatLoading(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secretary-ai-ins`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({messages:[{role:"user",content:text}],autoSave}),
      });
      const d=await res.json();
      const reply:string=d.reply??d.content?.[0]?.text??"응답을 받지 못했습니다.";
      const saved=d.saved??[], actions=d.actions??[], pendingUpdates=d.pendingUpdates??[], pendingCustomerSelects=d.pendingCustomerSelects??[];
      setMsgs(p=>[...p,{role:"assistant",content:reply,saved,actions,pendingUpdates,pendingCustomerSelects,ts:nowTs()}]);
      // 고객 선택이 필요하면 채팅 탭으로 자동 이동
      if(pendingCustomerSelects.length>0){ setTab("chat"); setTimeout(()=>{ const c=chatContainerRef.current; if(c)c.scrollTop=c.scrollHeight; },150); }
      if(saved.length>0){
        void loadStats();
        // 저장된 타입에 따라 해당 탭 데이터 즉시 갱신
        if(saved.some((s:any)=>["schedule","schedule_edit"].includes(s.type))){
          void loadSchedules();
          void loadCalData(calViewYear, calViewMonth);
          // 구글 캘린더 동기화 — 저장된 일정 ID로 DB에서 상세 조회 후 Push
          if(gcalConnected){
            const schedIds = saved.filter((s:any)=>s.type==="schedule").map((s:any)=>s.id);
            for(const sid of schedIds){
              const {data:sd} = await supabase.from("ins_schedules").select("*").eq("id",sid).single();
              if(sd) void syncToGcal({
                id:sd.id, title:sd.title, description:sd.description??null,
                schedule_date:sd.schedule_date, start_time:sd.start_time??null,
                end_time:sd.end_time??null, location:sd.location??null,
              });
            }
          }
          // 일정 저장 후 고객 상담이력 자동 기록
          {
            const newScheds = saved.filter((s:any)=>s.type==="schedule");
            for(const ns of newScheds){
              const {data:sd} = await supabase.from("ins_schedules").select("*").eq("id",ns.id).single();
              if(sd) void addConsultFromSchedule(sd.title, sd.schedule_date, sd.start_time??null, sd.location??null, sd.id);
            }
          }
        }
        if(saved.some((s:any)=>s.type==="todo"))  { void loadTodos();  void loadCalData(calViewYear, calViewMonth); }
        if(saved.some((s:any)=>s.type==="order"))   void loadOrders();
        if(saved.some((s:any)=>s.type==="claim"))   void loadClaims();
        const cc=saved.filter((s:any)=>s.consultation_id).length;
        showToast(`${saved.length}건 저장${cc>0?` + 상담관리 ${cc}건`:""}`);
      }
      if(pendingUpdates.length>0)showToast(`상담 업데이트 ${pendingUpdates.length}건 확인 필요`,"err");
      await supabase.from("ins_chat_logs").insert([
        {role:"user",content:text,session_id:"main"},
        {role:"assistant",content:reply,session_id:"main"},
      ]);
    }catch{
      setMsgs(p=>[...p,{role:"assistant",content:"⚠️ 연결 오류가 발생했습니다."}]);
    }
    setChatLoading(false);
  }

  function chatKey(e:React.KeyboardEvent<HTMLTextAreaElement>){
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();e.stopPropagation();void sendChat();}
  }

  function quickChat(t:string){setTab("chat");setChatInput(t);setTimeout(()=>chatInputRef.current?.focus(),80);}

  // ─── 상담 업데이트 ────────────────────────────────────────────────────────────
  async function confirmUpdate(msgIdx:number,cid:number,action:Record<string,unknown>){
    setChatLoading(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secretary-ai-ins`,{
      });
      const d=await res.json();
      setMsgs(p=>p.map((m,i)=>i!==msgIdx?m:{...m,pendingUpdates:[],saved:[...(m.saved??[]),...(d.saved??[])]}));
      showToast(`상담#${cid} 업데이트 완료`);
    }catch{showToast("업데이트 실패","err");}
    setChatLoading(false);
  }
  function rejectUpdate(msgIdx:number,uidx:number){
    setMsgs(p=>p.map((m,i)=>i!==msgIdx?m:{...m,pendingUpdates:(m.pendingUpdates??[]).filter((_,j)=>j!==uidx)}));
  }

  async function confirmCustomerSelect(msgIdx:number, customerKey:string, action:Record<string,unknown>){
    setChatLoading(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secretary-ai-ins`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({messages:[{role:"user",content:"confirm_customer_action"}],autoSave:false,confirmCustomerAction:{customer_key:customerKey,action}}),
      });
      const d=await res.json();
      setMsgs(p=>p.map((m,i)=>i!==msgIdx?m:{...m,pendingCustomerSelects:[],saved:[...(m.saved??[]),...(d.saved??[])]}));
      showToast("저장 완료");
      void loadStats();
    }catch{showToast("저장 실패","err");}
    setChatLoading(false);
  }
  function rejectCustomerSelect(msgIdx:number,uidx:number){
    setMsgs(p=>p.map((m,i)=>i!==msgIdx?m:{...m,pendingCustomerSelects:(m.pendingCustomerSelects??[]).filter((_,j)=>j!==uidx)}));
  }

  async function deleteCustomer(key:string, name:string){
    if(!window.confirm(`"${name}" 고객의 모든 데이터를 삭제합니다.
(계약, 상담, 청구, 고객정보 전체)

정말 삭제하시겠습니까?`)) return;
    await Promise.all([
      supabase.from("ins_customer_info").delete().eq("customer_key",key),
      supabase.from("ins_policies").delete().eq("customer_key",key),
      supabase.from("ins_claims").delete().eq("customer_key",key),
      supabase.from("ins_consultation_cases").delete().eq("customer_key",key),
      supabase.from("ins_orders").delete().eq("customer_key",key),
    ]);
    setSelectedCust(null);
    setCustInfo(null);
    setCustSearch("");
    setCustResults([]);
    showToast(`"${name}" 고객 삭제 완료`);
  }

  // 푸터 숨기기 + standalone 모드에서 네비 숨기기
  useEffect(()=>{
    const footer = document.querySelector('footer') as HTMLElement|null;
    if(footer) footer.style.display='none';
    // PWA standalone 모드에서 상단 네비게이션 숨기기
    if(isStandalone){
      const nav = document.querySelector('nav') as HTMLElement|null;
      const header = document.querySelector('header') as HTMLElement|null;
      if(nav) nav.style.display='none';
      if(header) header.style.display='none';
    }
    return ()=>{
      if(footer) footer.style.display='';
      if(isStandalone){
        const nav = document.querySelector('nav') as HTMLElement|null;
        const header = document.querySelector('header') as HTMLElement|null;
        if(nav) nav.style.display='';
        if(header) header.style.display='';
      }
    };
  },[]);

  // 세션 자동 갱신 — 5분마다 체크, 만료 10분 전이면 갱신
  useEffect(()=>{
    const refresh = async()=>{
      const {data:{session}} = await supabase.auth.getSession();
      if(!session) return;
      const expiresAt = session.expires_at ?? 0;
      const now = Math.floor(Date.now()/1000);
      if(expiresAt - now < 600){
        await supabase.auth.refreshSession();
      }
    };
    void refresh();
    const timer = setInterval(()=>void refresh(), 5*60*1000);
    return ()=>clearInterval(timer);
  },[]);

  // ─── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-gray-50">
      <CalPopupPortal/>

      {/* 토스트 */}
      {toast&&ReactDOM.createPortal(
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[99998] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white ${toast.type==="ok"?"bg-emerald-600":"bg-red-500"}`}>
          {toast.type==="ok"?"✅":"⚠️"} {toast.msg}
        </div>,
        document.body
      )}

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#0f172a] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
            <div>
              <h1 className="text-sm font-bold text-[#0f172a]">AI 비서 (Ins)</h1>

            </div>
            {!isStandalone&&(
              <button
                onClick={()=>void logout()}
                className="ml-2 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
              >
                로그아웃
              </button>
            )}
            {isStandalone&&(
              <button
                onClick={()=>window.location.reload()}
                className="ml-2 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-all"
                title="새로고침"
              >
                🔄
              </button>
            )}
          </div>
          {/* 통계 배지 */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">📅 {stats.todaySch}</span>
            <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 font-medium">✅ {stats.activeTodo}</span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">💬 신규 {stats.newOrders}</span>
            {stats.todayFollowup>0&&<span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 font-medium">📞 사후관리 {stats.todayFollowup}</span>}
            {stats.newConsult>0&&<span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">🛡 오늘보험상담 {stats.newConsult}</span>}
            {stats.expiringCount>0&&(
              <button onClick={()=>setTab("policies")} className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium animate-pulse hover:bg-red-100 transition-all">
                ⚠️ 만기임박 {stats.expiringCount}건
              </button>
            )}
            {stats.activeClaims>0&&(
              <button onClick={()=>setTab("claims")} className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium hover:bg-indigo-100 transition-all">
                📋 청구진행 {stats.activeClaims}건
              </button>
            )}
          </div>
          {/* 탭 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["chat","schedule","todo","consults","policies","claims","customers","narumi"] as TabKey[]).map(t=>(
              <button key={t} className={`${TB} ${tab===t?TA:TI} relative`} onClick={()=>setTab(t)}>
                {{chat:"💬 채팅",schedule:"📅 일정",todo:"✅ 할일",consults:"🛡 상담",policies:"📋 계약",claims:"🏥 청구",customers:"👤 고객조회",narumi:"🚛 나르미"}[t]}
                {t==="policies"&&stats.expiringCount>0&&(
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{stats.expiringCount}</span>
                )}
                {t==="claims"&&stats.activeClaims>0&&(
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center">{stats.activeClaims}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 바디 */}
      <div className="flex max-w-6xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-4 gap-5 pb-32 sm:pb-6" style={{minHeight:600}}>

        {/* 사이드바 */}
        <aside className="w-56 flex-shrink-0 hidden lg:flex flex-col gap-3 self-start sticky top-4">
          <MiniCalendar
            onDateSelect={(d)=>{setSchedDate(d);setTab("schedule");}}
            selectedDate={schedDate}
            calSchedules={calSch}
            calTodos={calTdo}
            gcalEvents={gcalEvents}
            onMonthChange={(yr,mo)=>{setCalViewYear(yr);setCalViewMonth(mo);void loadCalData(yr,mo); if(gcalConnected) void loadGcalEvents(yr,mo);}}
          />
          <div className="flex gap-2">
            <button onClick={()=>setTab("consults")} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl border border-gray-200 text-xs text-[#0f172a] font-semibold hover:bg-gray-50 transition-all">🛡 보험상담</button>
            <button onClick={()=>setTab("schedule")} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all">📅 일정</button>
          </div>
          {/* 구글 캘린더 연동 */}
          <div className={`${CARD} p-3`}>
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5C3.9 4 3 4.9 3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" fill="#4285f4"/>
              </svg>
              <span className="text-xs font-semibold text-[#0f172a]">구글 캘린더</span>
              {gcalConnected&&<span className="ml-auto w-2 h-2 rounded-full bg-emerald-500"/>}
            </div>
            {gcalConnected ? (
              <div className="space-y-1.5">
                <p className="text-[10px] text-emerald-600 mb-1.5">✅ 연동됨 — 일정 자동 동기화 중</p>
                <button
                  onClick={()=>void importGcalToLocal(calViewYear, calViewMonth)}
                  disabled={gcalImporting}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition-all disabled:opacity-40"
                >
                  {gcalImporting ? "가져오는 중..." : "📥 구글 → AI비서 가져오기"}
                </button>
                <button
                  onClick={()=>void bulkSyncToGcal()}
                  disabled={gcalBulkSyncing}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-600 hover:bg-orange-100 transition-all disabled:opacity-40"
                >
                  {gcalBulkSyncing ? "동기화 중..." : "📤 AI비서 → 구글 일괄전송"}
                </button>
                {gcalBulkResult && (
                  <p className="text-[10px] text-gray-500 mt-1 text-center">{gcalBulkResult}</p>
                )}
                <button onClick={()=>void disconnectGcal()}
                  className="w-full text-xs text-gray-500 hover:text-red-500 py-1 transition-all">
                  연동 해제
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[10px] text-gray-400 mb-1.5">연동하면 일정이 구글 캘린더와 양방향 동기화됩니다</p>
                <button onClick={()=>void connectGcal()}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-[#4285f4] text-white text-xs font-semibold hover:bg-[#3367d6] transition-all">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M19 4h-1V2h-2v2H8V2H6v2H5C3.9 4 3 4.9 3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>
                  구글 캘린더 연동
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              void loadCalData(calViewYear, calViewMonth);
              if(gcalConnected) void loadGcalEvents(calViewYear, calViewMonth);
              void loadSchedules();
            }}
            className="w-full flex items-center justify-center gap-1 px-2 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all"
          >
            🔄 캘린더 새로고침
          </button>
        </aside>

        {/* 메인 */}
        <main className="flex-1 min-w-0 flex flex-col">

          {/* ══ 일정 ══ */}
          {tab==="schedule"&&(
            <div className="space-y-3 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1">
                  {(["day","week","all"] as const).map(m=>(
                    <button key={m} className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${schedViewMode===m?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-orange-300"}`}
                      onClick={()=>{ setSchedViewMode(m); if(m!=="day") void loadAllSchedules(m as "week"|"all", schedDate, schedShowDone); }}>
                      {{day:"일별",week:"주간",all:"전체"}[m]}
                    </button>
                  ))}
                </div>
                {schedViewMode==="day"&&<input type="date" className={`${CTRL} w-36`} value={schedDate} onChange={e=>setSchedDate(e.target.value)}/>}
                {schedViewMode!=="day"&&(
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={schedShowDone} onChange={e=>{setSchedShowDone(e.target.checked);void loadAllSchedules(schedViewMode as "week"|"all",schedDate,e.target.checked);}}/> 완료 포함
                  </label>
                )}
                <button className={BTS} onClick={()=>{ if(schedViewMode==="day") void loadSchedules(); else void loadAllSchedules(schedViewMode as "week"|"all",schedDate,schedShowDone); }}>새로고침</button>
                <button className={BTP} onClick={()=>setShowSchedForm(v=>!v)}>{showSchedForm?"닫기":"+ 일정 추가"}</button>
                <button className="ml-auto text-xs text-orange-500 hover:underline" onClick={()=>quickChat("오늘 일정 브리핑해줘")}>AI 브리핑 →</button>
              </div>
              {showSchedForm&&(
                <div className={`${CARD} p-4`}>
                  <p className="text-sm font-semibold text-[#0f172a] mb-3">새 일정</p>
                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    <div className="col-span-2"><label className={LBL}>제목 *</label><input className={CTRL} value={newSched.title} onChange={e=>setNewSched(p=>({...p,title:e.target.value}))} placeholder="일정 제목"/></div>
                    <div><label className={LBL}>날짜</label><input type="date" className={CTRL} value={newSched.schedule_date} onChange={e=>setNewSched(p=>({...p,schedule_date:e.target.value}))}/></div>
                    <div><label className={LBL}>구분</label>
                      <select className={CTRL} value={newSched.category} onChange={e=>setNewSched(p=>({...p,category:e.target.value as any}))}>
                        <option value="meeting">미팅</option><option value="call">통화</option><option value="task">업무</option><option value="followup">사후관리</option>
                      </select>
                    </div>
                    <div><label className={LBL}>시작</label><input type="time" className={CTRL} value={newSched.start_time} onChange={e=>setNewSched(p=>({...p,start_time:e.target.value}))}/></div>
                    <div><label className={LBL}>종료</label><input type="time" className={CTRL} value={newSched.end_time} onChange={e=>setNewSched(p=>({...p,end_time:e.target.value}))}/></div>
                    <div><label className={LBL}>장소</label><input className={CTRL} value={newSched.location} onChange={e=>setNewSched(p=>({...p,location:e.target.value}))} placeholder="장소"/></div>
                    <div><label className={LBL}>업무 분류</label>
                      <select className={CTRL} value={newSched.related_type} onChange={e=>setNewSched(p=>({...p,related_type:e.target.value}))}>
                        <option value="">선택 안함</option><option value="insurance">보험</option>
                      </select>
                    </div>
                    <div className="col-span-2"><label className={LBL}>🔗 상담 ID</label><input className={CTRL} value={newSched.consultation_id} onChange={e=>setNewSched(p=>({...p,consultation_id:e.target.value.replace(/\D/g,"")}))} placeholder="숫자만"/></div>
                    <div className="col-span-2"><label className={LBL}>메모</label><textarea className={TA2} rows={2} value={newSched.description} onChange={e=>setNewSched(p=>({...p,description:e.target.value}))}/></div>
                  </div>
                  <div className="flex gap-2"><button className={BTP} onClick={()=>void addSchedule()}>저장</button><button className={BTS} onClick={()=>setShowSchedForm(false)}>취소</button></div>
                </div>
              )}
              {/* 주간/전체 뷰 */}
              {schedViewMode!=="day"&&(
                allSchedLoading?<p className="text-sm text-gray-400 p-4">불러오는 중...</p>
                :allSchedules.length===0?<div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>일정이 없습니다</div>
                :(()=>{
                  const groups = new Map<string,Schedule[]>();
                  allSchedules.forEach(s=>{ if(!groups.has(s.schedule_date)) groups.set(s.schedule_date,[]); groups.get(s.schedule_date)!.push(s); });
                  return Array.from(groups.entries()).map(([date,list])=>(
                    <div key={date} className="space-y-2">
                      <div className="flex items-center gap-2 pt-1">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${date===todayStr()?"bg-[#0f172a] text-white":"bg-blue-50 text-blue-600"}`}>{fmtDate(date)}</span>
                        <span className="text-xs text-gray-400">{list.length}건</span>
                        <div className="flex-1 h-px bg-gray-100"/>
                      </div>
                      {list.map(s=>(
                        <div key={s.id} className={`${CARD} p-4 flex items-start gap-3 ${s.is_done?"opacity-60":""}`}>
                          <CatDot c={s.category}/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold text-[#0f172a] ${s.is_done?"line-through":""}`}>{s.title}</span>
                              <span className="text-xs text-gray-400">{CAT_LBL[s.category]}</span>
                              {s.related_type&&<span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{WL[s.related_type]??s.related_type}</span>}
                            </div>
                            {(s.start_time||s.location)&&<p className="text-xs text-gray-400 mt-0.5">{[s.start_time?fmtTime(s.start_time):null,s.location].filter(Boolean).join(" · ")}</p>}
                            {s.progress_memo&&<p className="text-xs text-blue-500 mt-1 line-clamp-1">📝 {s.progress_memo.split("\n").slice(-1)[0]}</p>}
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button className={BTG} onClick={()=>{setSchedModal({s});setSchedProgress({memo:"",next_date:"",next_time:""});}}>경과</button>
                            <button className={BTG} onClick={()=>void toggleSched(s.id,s.is_done)}>{s.is_done?"되돌리기":"완료"}</button>
                            <button className="text-xs text-red-400 hover:text-red-600 px-1" onClick={()=>void delSched(s.id)}>삭제</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()
              )}
              {/* 일별 뷰 */}
              {schedViewMode==="day"&&(schedLoading?<p className="text-sm text-gray-400 p-4">불러오는 중...</p>
                :schedules.length===0?<div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>오늘·내일 일정이 없습니다</div>
                :(()=>{
                  const groups = new Map<string,Schedule[]>();
                  schedules.forEach(s=>{ if(!groups.has(s.schedule_date)) groups.set(s.schedule_date,[]); groups.get(s.schedule_date)!.push(s); });
                  const today = todayStr();
                  return Array.from(groups.entries()).map(([date,list])=>(
                    <div key={date} className="space-y-2">
                      <div className="flex items-center gap-2 pt-1">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${date===today?"bg-[#0f172a] text-white":"bg-blue-50 text-blue-600"}`}>
                          {date===today?"📅 오늘 D-day":"📅 내일 D+1"}
                        </span>
                        <span className="text-xs text-gray-400">{fmtDate(date)} · {list.length}건</span>
                        <div className="flex-1 h-px bg-gray-100"/>
                      </div>
                      {list.map(s=>(
                        <div key={s.id} className={`${CARD} p-4 flex items-start gap-3 ${s.is_done?"opacity-60":""}`}>
                          <CatDot c={s.category}/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold text-[#0f172a] ${s.is_done?"line-through":""}`}>{s.title}</span>
                              <span className="text-xs text-gray-400">{CAT_LBL[s.category]}</span>
                              {s.related_type&&<span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{WL[s.related_type]??s.related_type}</span>}
                              <LinkBadge id={s.consultation_id} onClick={()=>navigate(`/work/call-management?id=${s.consultation_id}`)}/>
                            </div>
                            {(s.start_time||s.location)&&<p className="text-xs text-gray-400 mt-0.5">{[s.start_time?fmtTime(s.start_time):null,s.location].filter(Boolean).join(" · ")}</p>}
                            {s.description&&<p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                            {s.progress_memo&&<p className="text-xs text-blue-500 mt-1 line-clamp-1">📝 {s.progress_memo.split("\n").slice(-1)[0]}</p>}
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button className={BTG} onClick={()=>{setSchedModal({s});setSchedProgress({memo:"",next_date:"",next_time:""});}}>경과</button>
                            <button className={BTG} onClick={()=>void toggleSched(s.id,s.is_done)}>{s.is_done?"되돌리기":"완료"}</button>
                            <button className={BTG} onClick={()=>quickChat(`"${s.title}" 미팅 내용 정리해줘. 메모: `)}>AI요약</button>
                            <button className="text-xs text-red-400 hover:text-red-600 px-1" onClick={()=>void delSched(s.id)}>삭제</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()
              )}
              {/* 당일 마감 할일 */}
              {schedViewMode==="day"&&(()=>{
                const dueTodos = todos.filter(t=>t.due_date===schedDate&&!t.is_done);
                if(dueTodos.length===0) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold text-orange-500 px-1 mb-2 mt-1">🔥 오늘 마감 할일 — {dueTodos.length}건</p>
                    {dueTodos.map(t=>(
                      <div key={t.id} className={`${CARD} p-3.5 flex items-center gap-3 border-l-4 border-orange-400`}>
                        <button className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${t.is_done?"bg-emerald-500 border-emerald-500":"border-gray-300 hover:border-orange-400"}`}
                          onClick={()=>void toggleTodo(t.id,t.is_done)}>
                          {t.is_done&&<span className="text-white text-[10px]">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#0f172a]">{t.title}</span>
                            {t.priority==="urgent"&&<span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">긴급</span>}
                            {t.category&&<span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{WL[t.category]??t.category}</span>}
                          </div>
                          {t.description&&<p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
                        </div>
                        <button className="text-xs text-red-400 hover:text-red-600 flex-shrink-0" onClick={()=>void delTodo(t.id)}>삭제</button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── 일정 경과 기록 모달 ── */}
          {schedModal&&ReactDOM.createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={()=>setSchedModal(null)}>
              <div className={`${CARD} p-5 w-full max-w-md`} onClick={e=>e.stopPropagation()}>
                <p className="text-base font-semibold text-[#0f172a] mb-3">📝 일정 경과 기록</p>
                <p className="text-sm text-gray-600 mb-3 font-medium">{schedModal.s.title}</p>
                {schedModal.s.progress_memo&&(
                  <div className="mb-3 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                    <p className="text-xs text-gray-500 mb-1 font-medium">이전 경과</p>
                    {schedModal.s.progress_memo.split("\n").map((line,i)=>(
                      <p key={i} className="text-xs text-blue-700">{line}</p>
                    ))}
                  </div>
                )}
                <div className="space-y-3 mb-4">
                  <div><label className={LBL}>오늘 경과 메모</label>
                    <textarea className={TA2} rows={3} placeholder="오늘 진행 내용, 결과, 특이사항..."
                      value={schedProgress.memo} onChange={e=>setSchedProgress(p=>({...p,memo:e.target.value}))}/></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={LBL}>다음 일정 날짜</label>
                      <input type="date" className={CTRL} value={schedProgress.next_date} onChange={e=>setSchedProgress(p=>({...p,next_date:e.target.value}))}/></div>
                    <div><label className={LBL}>다음 일정 시간</label>
                      <input type="time" className={CTRL} value={schedProgress.next_time} onChange={e=>setSchedProgress(p=>({...p,next_time:e.target.value}))}/></div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className={BTP} onClick={()=>void saveSchedProgress(schedModal.s)} disabled={!schedProgress.memo&&!schedProgress.next_date}>
                    {schedProgress.next_date?"저장 + 다음 일정":"경과 저장"}
                  </button>
                  <button className={BTS} onClick={()=>setSchedModal(null)}>취소</button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* ══ 할일 ══ */}
          {tab==="todo"&&(
            <div className="space-y-3 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1.5">
                  {(["active","all","done"] as const).map(f=>(
                    <button key={f} className={`${TB} ${tdFilter===f?TA:TI}`} onClick={()=>setTdFilter(f)}>{{active:"진행중",all:"전체",done:"완료"}[f]}</button>
                  ))}
                </div>
                <button className={BTS} onClick={()=>void loadTodos()}>새로고침</button>
                <button className={BTP} onClick={()=>setShowTodoForm(v=>!v)}>{showTodoForm?"닫기":"+ 할일 추가"}</button>
              </div>
              {showTodoForm&&(
                <div className={`${CARD} p-4`}>
                  <p className="text-sm font-semibold text-[#0f172a] mb-3">새 할일</p>
                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    <div className="col-span-2"><label className={LBL}>제목 *</label><input className={CTRL} value={newTodo.title} onChange={e=>setNewTodo(p=>({...p,title:e.target.value}))} placeholder="할일 제목"/></div>
                    <div><label className={LBL}>우선순위</label>
                      <select className={CTRL} value={newTodo.priority} onChange={e=>setNewTodo(p=>({...p,priority:e.target.value as any}))}>
                        <option value="urgent">긴급</option><option value="normal">일반</option><option value="low">낮음</option>
                      </select>
                    </div>
                    <div><label className={LBL}>업무 분류</label>
                      <select className={CTRL} value={newTodo.category} onChange={e=>setNewTodo(p=>({...p,category:e.target.value}))}>
                        <option value="">선택 안함</option><option value="insurance">보험</option><option value="admin">관리</option>
                      </select>
                    </div>
                    <div><label className={LBL}>마감일</label><input type="date" className={CTRL} value={newTodo.due_date} onChange={e=>setNewTodo(p=>({...p,due_date:e.target.value}))}/></div>
                    <div><label className={LBL}>🔗 상담 ID</label><input className={CTRL} value={newTodo.consultation_id} onChange={e=>setNewTodo(p=>({...p,consultation_id:e.target.value.replace(/\D/g,"")}))} placeholder="숫자만 (선택)"/></div>
                    <div className="col-span-2"><label className={LBL}>메모</label><input className={CTRL} value={newTodo.description} onChange={e=>setNewTodo(p=>({...p,description:e.target.value}))} placeholder="상세 내용"/></div>
                  </div>
                  <div className="flex gap-2"><button className={BTP} onClick={()=>void addTodo()}>저장</button><button className={BTS} onClick={()=>setShowTodoForm(false)}>취소</button></div>
                </div>
              )}
              {todoLoading?<p className="text-sm text-gray-400 p-4">불러오는 중...</p>
                :todos.length===0?<div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>할일이 없습니다</div>
                :(
                  <div className="space-y-2">
                    {todos.filter(t=>t.priority==="urgent"&&!t.is_done).length>0&&<p className="text-xs font-semibold text-red-500 uppercase tracking-widest px-1">🔴 긴급</p>}
                    {todos.map(t=>(
                      <div key={t.id} className={`${CARD} p-4 flex items-start gap-3 ${t.is_done?"opacity-50":""}`}>
                        <button className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${t.is_done?"bg-emerald-500 border-emerald-500":"border-gray-300 hover:border-emerald-400"}`}
                          onClick={()=>void toggleTodo(t.id,t.is_done)}>
                          {t.is_done&&<span className="text-white text-[10px]">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium text-[#0f172a] ${t.is_done?"line-through":""}`}>{t.title}</span>
                            
                            {t.category&&<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{WL[t.category]??t.category}</span>}
                            <LinkBadge id={t.consultation_id} onClick={()=>navigate(`/work/call-management?id=${t.consultation_id}`)}/>
                          </div>
                          {t.description&&<p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
                          {t.due_date&&<p className="text-xs text-gray-400 mt-0.5">마감: {fmtDate(t.due_date)}</p>}
                        </div>
                        <button className="text-xs text-red-400 hover:text-red-600 px-1 flex-shrink-0" onClick={()=>void delTodo(t.id)}>삭제</button>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* ══ 주문·상담 ══ */}
          {tab==="consults"&&(
            <div className="space-y-4 pb-4">
              {/* 사후관리 */}
              {followups.length>0&&(
                <div className={`${CARD} p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block animate-pulse"/>
                      📞 오늘 사후관리 — {followups.length}건
                    </p>
                    <button className={BTG} onClick={()=>navigate("/work/call-management?tab=followups")}>전체 보기 →</button>
                  </div>
                  <div className="space-y-2">
                    {followups.map(c=>(
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#0f172a]">{c.customer_name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white text-purple-600 border border-purple-200">{WL[c.work_type]??c.work_type}</span>
                            <StsBadge s={c.status}/>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5 truncate">{c.summary}</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          {c.phone&&<a href={`tel:${c.phone.replace(/-/g,"")}`} className={BTO}>전화</a>}
                          <button className={BTG} onClick={()=>quickChat(`"${c.customer_name}" 사후관리 준비해줘: ${c.summary}`)}>AI준비</button>
                          <button className={BTG} onClick={()=>navigate(`/work/call-management?id=${c.id}`)}>열기</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 전체 DB 고객등록 + 만기 30일 관리 */}
              <div className={`${CARD} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#0f172a]">👤 고객 일괄 등록</p>
                  <button
                    className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-all disabled:opacity-40 flex items-center gap-1.5"
                    disabled={regAllLoading}
                    onClick={()=>void registerAllFromDB()}>
                    {regAllLoading
                      ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>등록 중...</>
                      : "📥 전체 상담고객 → 고객등록"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-2">ins_consultation_cases 의 모든 고객을 ins_customer_info에 등록합니다. 이미 등록된 고객은 건너뜁니다.</p>
                {regAllResult&&(
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <span className="text-emerald-700 font-semibold">✅ 신규 등록 {regAllResult.ok}건</span>
                    {regAllResult.skip>0&&<span className="text-gray-400">건너뜀 {regAllResult.skip}건</span>}
                  </div>
                )}
              </div>

              {/* 만기 30일 이내 고객 */}
              {expiringPolicies.length>0&&(
                <div className={`${CARD} p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[#0f172a] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse"/>
                      ⚠️ 만기 30일 이내 — {expiringPolicies.length}건
                    </p>
                    <button className={BTG} onClick={()=>setTab("policies")}>계약 탭 →</button>
                  </div>
                  <div className="space-y-2">
                    {expiringPolicies.map(p=>{
                      const days = Math.ceil((new Date(p.expiry_date!).getTime()-Date.now())/(1000*60*60*24));
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-[#0f172a]">{p.customer_name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{p.product_name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">D-{days}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">만기 {p.expiry_date}</p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button className={BTO} onClick={()=>quickChat(`"${p.customer_name}" ${p.product_name} 만기 ${days}일 전 갱신 안내 메시지 작성해줘`)}>AI문자초안</button>
                            <button className={BTG} onClick={()=>{setCustSearch(p.customer_name);setTab("customers");void searchCustomers(p.customer_name);}}>고객조회</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 최근 상담 */}
              <div className={`${CARD} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#0f172a]">💬 최근 상담</p>
                  <div className="flex gap-2">
                    <button className={BTG} onClick={()=>void loadConsults()}>새로고침</button>
                    {recentC.length>0&&(
                      <button
                        className={`${BTP} text-xs`}
                        disabled={regLoading==="all"}
                        onClick={()=>void registerAllCustomers()}>
                        {regLoading==="all"
                          ? <span className="flex items-center gap-1"><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>등록 중...</span>
                          : `👤 화면고객 등록 (${recentC.length}건)`}
                      </button>
                    )}
                  </div>
                </div>
                {cLoading?<p className="text-xs text-gray-400">불러오는 중...</p>
                  :recentC.length===0?<p className="text-sm text-gray-400 text-center py-4">최근 상담이 없습니다</p>
                  :(
                    <div className="space-y-2">
                      {recentC.map(c=>(
                        <div key={c.id} className={`${CARD} overflow-hidden`}>
                          {/* 요약 행 */}
                          <div className="p-3 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-all"
                            onClick={()=>{
                              if(expandedConsult===c.id){setExpandedConsult(null);setEditingConsult(null);}
                              else{setExpandedConsult(c.id);setEditingConsult({...c});}
                            }}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-[#0f172a]">{c.customer_name}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{WL[c.work_type]??c.work_type}</span>
                                <StsBadge s={c.status}/>
                                <span className="text-xs text-gray-400">{fmtDT(c.created_at)}</span>
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5 truncate">{c.summary}</p>
                              {c.followup_needed&&c.next_followup_date&&(
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 mt-1 inline-block">📞 사후관리 {fmtDate(c.next_followup_date)}</span>
                              )}
                            </div>
                            <span className="text-gray-300 text-xs flex-shrink-0">{expandedConsult===c.id?"▲":"▼"}</span>
                          </div>
                          {/* 상세/수정 패널 */}
                          {expandedConsult===c.id&&editingConsult&&(
                            <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">상세 수정</p>
                              <div className="grid grid-cols-2 gap-2.5">
                                <div><label className={LBL}>상태</label>
                                  <select className={CTRL} value={editingConsult.status??""} onChange={e=>setEditingConsult(p=>({...p,status:e.target.value}))}>
                                    <option value="new">신규</option><option value="pending">대기</option>
                                    <option value="in_progress">진행중</option><option value="completed">완료</option>
                                  </select>
                                </div>
                                <div><label className={LBL}>사후관리</label>
                                  <select className={CTRL} value={editingConsult.followup_needed?"true":"false"} onChange={e=>setEditingConsult(p=>({...p,followup_needed:e.target.value==="true"}))}>
                                    <option value="false">없음</option><option value="true">필요</option>
                                  </select>
                                </div>
                                {editingConsult.followup_needed&&(
                                  <div><label className={LBL}>사후관리 날짜</label><input type="date" className={CTRL} value={editingConsult.next_followup_date??""} onChange={e=>setEditingConsult(p=>({...p,next_followup_date:e.target.value}))}/></div>
                                )}
                                <div className="col-span-2"><label className={LBL}>요약</label><textarea className={TA2} rows={2} value={editingConsult.summary??""} onChange={e=>setEditingConsult(p=>({...p,summary:e.target.value}))}/></div>
                              </div>
                              <div className="flex gap-2">
                                <button className={BTP} onClick={()=>void saveConsult(c.id)}>저장</button>
                                <button className={BTS} onClick={()=>{setExpandedConsult(null);setEditingConsult(null);}}>취소</button>
                                <button className={BTG} onClick={()=>quickChat(`"${c.customer_name}" ${WL[c.work_type]??""} 후속 조치: ${c.summary}`)}>AI</button>
                                <button
                                  className="ml-auto px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-all disabled:opacity-40"
                                  disabled={regLoading===c.id}
                                  onClick={()=>void registerOneCustomer(c)}>
                                  {regLoading===c.id
                                    ? <span className="flex items-center gap-1"><span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>등록 중</span>
                                    : "👤 고객등록"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
              {/* 카카오·상담 접수 */}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <p className="text-sm font-semibold text-[#0f172a]">🛡 보험 상담 접수</p>
                  <div className="flex gap-1.5 ml-auto flex-wrap">
                    {(["active","all","done"] as const).map(f=>(
                      <button key={f} className={`${TB} text-xs py-1 px-2.5 ${ordFilter===f?TA:TI}`} onClick={()=>setOrdFilter(f)}>{{active:"진행중",all:"전체",done:"완료"}[f]}</button>
                    ))}
                    <button className={BTP} onClick={()=>setShowOrderForm(v=>!v)}>{showOrderForm?"닫기":"+ 상담등록"}</button>
                  </div>
                </div>
                {showOrderForm&&(
                  <div className={`${CARD} p-4 mb-3`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-[#0f172a]">새 보험 상담 등록</p>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <div className={`w-9 h-5 rounded-full transition-colors relative ${syncConsult?"bg-emerald-500":"bg-gray-300"}`} onClick={()=>setSyncConsult(v=>!v)}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${syncConsult?"translate-x-4":"translate-x-0.5"}`}/>
                        </div>
                        <span className="text-xs text-gray-600">{syncConsult?"🔗 상담관리 자동등록":"연동 OFF"}</span>
                      </label>
                    </div>
                    {syncConsult&&<div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">✅ 보험 상담으로 ins_consultation_cases에 자동 등록됩니다</div>}
                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                      <div><label className={LBL}>고객명 *</label><input className={CTRL} value={newOrder.customer_name} onChange={e=>setNewOrder(p=>({...p,customer_name:e.target.value}))} placeholder="고객명"/></div>
                      <div><label className={LBL}>전화번호</label><input className={CTRL} value={newOrder.phone} onChange={e=>setNewOrder(p=>({...p,phone:e.target.value}))} placeholder="010-0000-0000"/></div>
                      <div><label className={LBL}>접수 채널</label>
                        <select className={CTRL} value={newOrder.channel} onChange={e=>setNewOrder(p=>({...p,channel:e.target.value as any}))}>
                          <option value="kakao">카카오톡</option><option value="phone">전화</option><option value="visit">방문</option><option value="web">홈페이지</option>
                        </select>
                      </div>
                      <div><label className={LBL}>통신사</label><input className={CTRL} value={newOrder.telecom_provider} onChange={e=>setNewOrder(p=>({...p,telecom_provider:e.target.value}))} placeholder="SKT/KT/LG"/></div>
                      <div className="col-span-2"><label className={LBL}>상담 내용 요약 *</label><input className={CTRL} value={newOrder.summary} onChange={e=>setNewOrder(p=>({...p,summary:e.target.value}))} placeholder="보험 상담 내용 요약"/></div>
                      <div className="col-span-2"><label className={LBL}>상세 메모</label><textarea className={TA2} rows={2} value={newOrder.detail} onChange={e=>setNewOrder(p=>({...p,detail:e.target.value}))}/></div>
                    </div>
                    <div className="flex gap-2"><button className={BTP} onClick={()=>void addOrder()}>저장{syncConsult?" + 상담관리":""}</button><button className={BTS} onClick={()=>setShowOrderForm(false)}>취소</button></div>
                  </div>
                )}
                {orderLoading?<p className="text-sm text-gray-400 p-4">불러오는 중...</p>
                  :orders.length===0?<div className={`${CARD} p-6 text-center text-gray-400 text-sm`}>등록된 상담이 없습니다</div>
                  :(
                    <div className="space-y-2">
                      {orders.map(o=>(
                        <div key={o.id} className={`${CARD} p-4`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${o.channel==="kakao"?"bg-yellow-100":"bg-blue-50"}`}>
                              {{kakao:"💬",phone:"📞",visit:"🏢",web:"🌐"}[o.channel]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-[#0f172a]">{o.customer_name}</span>
                                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{o.customer_key}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">🛡 보험</span>
                                <StsBadge s={o.status}/>
                                <LinkBadge id={o.consultation_id} onClick={()=>navigate(`/work/call-management?id=${o.consultation_id}`)}/>
                              </div>
                              <p className="text-sm text-gray-700 mt-0.5">{o.summary}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{fmtDT(o.created_at)}</p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                              {o.status!=="done"&&<>
                                {o.status==="new"&&<button className={BTO} onClick={()=>void setOrderStatus(o.id,"processing")}>진행중</button>}
                                <button className={BTE} onClick={()=>void setOrderStatus(o.id,"done")}>완료</button>
                              </>}
                              <button className={BTG} onClick={()=>setExpandedOrder(expandedOrder===o.id?null:o.id)}>{expandedOrder===o.id?"접기":"상세"}</button>
                              <button className={BTG} onClick={()=>quickChat(`"${o.customer_name}" 보험 상담 처리: ${o.summary}`)}>AI</button>
                            </div>
                          </div>
                          {expandedOrder===o.id&&(
                            <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                              {o.detail&&<p className="text-sm text-gray-600 mb-1.5">{o.detail}</p>}
                              {o.consultation_id&&<button className="text-xs text-emerald-600 hover:underline mr-3" onClick={()=>navigate(`/work/call-management?id=${o.consultation_id}`)}>🔗 상담관리 #{o.consultation_id}</button>}
                              <button className="text-xs text-red-400 hover:text-red-600" onClick={()=>void delOrder(o.id)}>삭제</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            </div>
          )}

          {/* ══ 계약 관리 ══ */}
          {tab==="policies"&&(
            <div className="space-y-4 pb-4">

              {/* 만기 임박 알람 */}
              {expiringPolicies.length>0&&(
                <div className={`${CARD} p-4 border-red-200 bg-red-50`}>
                  <p className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse"/>
                    ⚠️ 만기 30일 이내 — {expiringPolicies.length}건
                  </p>
                  <div className="space-y-2">
                    {expiringPolicies.map(p=>{
                      const days=daysUntilExpiry(p.expiry_date);
                      return(
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-red-200">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-[#0f172a]">{p.customer_name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{p.product_name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${days!==null&&days<=7?"bg-red-100 text-red-700":"bg-orange-50 text-orange-600"}`}>
                                {days===0?"오늘 만기":days!==null?`D-${days}`:"만기일 미정"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-gray-500">가입 {fmtDate(p.start_date)}</span>
                              {p.expiry_date&&<span className="text-xs text-red-500 font-medium">만기 {fmtDate(p.expiry_date)}</span>}
                              <span className="font-mono text-xs text-gray-400">{p.customer_key}</span>
                            </div>
                          </div>
                          <button className={BTO} onClick={()=>quickChat(`"${p.customer_name}" ${p.product_name} 만기 ${days}일 남음 — 갱신 상담 준비해줘`)}>AI준비</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 계약 목록 */}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <p className="text-sm font-semibold text-[#0f172a]">📋 계약 목록</p>
                  <div className="flex gap-2 ml-auto flex-wrap items-center">
                    <input
                      className="h-8 rounded-xl border border-gray-200 px-3 text-xs text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 w-36"
                      placeholder="고객명·상품명 검색"
                      value={policySearch}
                      onChange={e=>setPolicySearch(e.target.value)}
                    />
                    <button className={BTG} onClick={()=>void loadPolicies()}>새로고침</button>
                    <button className={BTP} onClick={()=>setShowPolicyForm(v=>!v)}>{showPolicyForm?"닫기":"+ 계약등록"}</button>
                  </div>
                </div>

                {/* 등록 폼 */}
                {showPolicyForm&&(
                  <div className={`${CARD} p-4 mb-3`}>
                    <p className="text-sm font-semibold text-[#0f172a] mb-3">새 계약 등록</p>
                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                      <div><label className={LBL}>고객명 *</label><input className={CTRL} value={newPolicy.customer_name} onChange={e=>setNewPolicy(p=>({...p,customer_name:e.target.value}))} placeholder="고객명"/></div>
                      <div><label className={LBL}>전화번호</label><input className={CTRL} value={newPolicy.phone} onChange={e=>setNewPolicy(p=>({...p,phone:e.target.value}))} placeholder="010-0000-0000"/></div>
                      {newPolicy.customer_name&&newPolicy.phone&&(
                        <div className="col-span-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-500">
                          고객 키: <span className="font-mono font-semibold text-[#0f172a]">{makeCustomerKey(newPolicy.customer_name,newPolicy.phone)}</span>
                        </div>
                      )}
                      <div className="col-span-2"><label className={LBL}>상품명 *</label><input className={CTRL} value={newPolicy.product_name} onChange={e=>setNewPolicy(p=>({...p,product_name:e.target.value}))} placeholder="예: 무배당종신보험, 실손의료비보험"/></div>
                      <div><label className={LBL}>가입일 *</label><input type="date" className={CTRL} value={newPolicy.start_date} onChange={e=>setNewPolicy(p=>({...p,start_date:e.target.value}))}/></div>
                      <div><label className={LBL}>만기일</label><input type="date" className={CTRL} value={newPolicy.expiry_date} onChange={e=>setNewPolicy(p=>({...p,expiry_date:e.target.value}))}/></div>
                      <div className="col-span-2"><label className={LBL}>메모</label><input className={CTRL} value={newPolicy.memo} onChange={e=>setNewPolicy(p=>({...p,memo:e.target.value}))} placeholder="특이사항, 갱신 조건 등"/></div>
                    </div>
                    <div className="flex gap-2">
                      <button className={BTP} onClick={()=>void addPolicy()}>저장</button>
                      <button className={BTS} onClick={()=>setShowPolicyForm(false)}>취소</button>
                    </div>
                  </div>
                )}

                {policyLoading?<p className="text-sm text-gray-400 p-4">불러오는 중...</p>
                  :policies.filter(p=>!policySearch||p.customer_name.includes(policySearch)||p.product_name.includes(policySearch)).length===0
                    ?<div className={`${CARD} p-6 text-center text-gray-400 text-sm`}>등록된 계약이 없습니다</div>
                    :(
                      <div className="space-y-2">
                        {policies
                          .filter(p=>!policySearch||p.customer_name.includes(policySearch)||p.product_name.includes(policySearch))
                          .map(p=>{
                            const days=daysUntilExpiry(p.expiry_date);
                            const isExpiring=days!==null&&days<=30&&days>=0;
                            return(
                              <div key={p.id} className={`${CARD} overflow-hidden`}>
                                {/* 요약 행 */}
                                <div className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-all ${isExpiring?"bg-red-50/40":""}`}
                                  onClick={()=>{
                                    if(expandedPolicy===p.id){setExpandedPolicy(null);setEditingPolicy(null);}
                                    else{setExpandedPolicy(p.id);setEditingPolicy({...p});}
                                  }}>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-semibold text-[#0f172a]">{p.customer_name}</span>
                                      <span className="font-mono text-xs text-gray-400">{p.customer_key}</span>
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{p.product_name}</span>
                                      {isExpiring&&<span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${days===0?"bg-red-100 text-red-700":"bg-orange-50 text-orange-600"}`}>{days===0?"오늘만기":`D-${days}`}</span>}
                                    </div>
                                    <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                                      <span>가입 {fmtDate(p.start_date)}</span>
                                      {p.expiry_date&&<span className={isExpiring?"text-red-500 font-medium":""}>만기 {fmtDate(p.expiry_date)}</span>}
                                      {p.memo&&<span className="truncate max-w-[150px]">{p.memo}</span>}
                                    </div>
                                  </div>
                                  <span className="text-gray-300 text-xs flex-shrink-0">{expandedPolicy===p.id?"▲":"▼"}</span>
                                </div>
                                {/* 상세/수정 패널 */}
                                {expandedPolicy===p.id&&editingPolicy&&(
                                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">상세 수정</p>
                                    <div className="grid grid-cols-2 gap-2.5">
                                      <div className="col-span-2"><label className={LBL}>상품명</label><input className={CTRL} value={editingPolicy.product_name??""} onChange={e=>setEditingPolicy(p=>({...p,product_name:e.target.value}))}/></div>
                                      <div><label className={LBL}>가입일</label><input type="date" className={CTRL} value={editingPolicy.start_date??""} onChange={e=>setEditingPolicy(p=>({...p,start_date:e.target.value}))}/></div>
                                      <div><label className={LBL}>만기일</label><input type="date" className={CTRL} value={editingPolicy.expiry_date??""} onChange={e=>setEditingPolicy(p=>({...p,expiry_date:e.target.value}))}/></div>
                                      <div className="col-span-2"><label className={LBL}>메모</label><textarea className={TA2} rows={2} value={editingPolicy.memo??""} onChange={e=>setEditingPolicy(p=>({...p,memo:e.target.value}))}/></div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button className={BTP} onClick={()=>void savePolicy(p.id)}>저장</button>
                                      <button className={BTS} onClick={()=>{setExpandedPolicy(null);setEditingPolicy(null);}}>취소</button>
                                      <button className={BTG} onClick={()=>quickChat(`"${p.customer_name}" ${p.product_name}${p.expiry_date?` 만기 ${days}일 남음`:""} — 갱신 상담 준비해줘`)}>AI</button>
                                      <button className="ml-auto text-xs text-red-400 hover:text-red-600" onClick={()=>void delPolicy(p.id)}>삭제</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )
                }
              </div>
            </div>
          )}

          {/* ══ 청구 관리 ══ */}
          {tab==="claims"&&(
            <div className="space-y-4 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <p className="text-sm font-semibold text-[#0f172a]">🏥 보험금 청구 관리</p>
                  <div className="flex gap-1.5 ml-auto flex-wrap items-center">
                    {(["active","completed","all"] as const).map(f=>(
                      <button key={f} className={`${TB} text-xs py-1 px-2.5 ${claimFilter===f?TA:TI}`} onClick={()=>setClaimFilter(f)}>
                        {{active:"진행중",completed:"청구완료",all:"전체"}[f]}
                      </button>
                    ))}
                    <input className="h-8 rounded-xl border border-gray-200 px-3 text-xs bg-white focus:outline-none focus:border-orange-400 w-32" placeholder="고객명·상품 검색" value={claimSearch} onChange={e=>setClaimSearch(e.target.value)}/>
                    <button className={BTG} onClick={()=>void loadClaims()}>새로고침</button>
                    <button className={BTP} onClick={()=>setShowClaimForm(v=>!v)}>{showClaimForm?"닫기":"+ 청구등록"}</button>
                  </div>
                </div>

                {/* 등록 폼 */}
                {showClaimForm&&(
                  <div className={`${CARD} p-4 mb-3`}>
                    <p className="text-sm font-semibold text-[#0f172a] mb-3">새 청구 등록</p>
                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                      <div><label className={LBL}>고객명 *</label><input className={CTRL} value={newClaim.customer_name} onChange={e=>setNewClaim(p=>({...p,customer_name:e.target.value}))} placeholder="고객명"/></div>
                      <div><label className={LBL}>전화번호</label><input className={CTRL} value={newClaim.phone} onChange={e=>setNewClaim(p=>({...p,phone:e.target.value}))} placeholder="010-0000-0000"/></div>
                      {newClaim.customer_name&&newClaim.phone&&(
                        <div className="col-span-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-500">
                          고객 키: <span className="font-mono font-semibold text-[#0f172a]">{makeCustomerKey(newClaim.customer_name,newClaim.phone)}</span>
                        </div>
                      )}
                      <div className="col-span-2"><label className={LBL}>보험 상품명 *</label><input className={CTRL} value={newClaim.product_name} onChange={e=>setNewClaim(p=>({...p,product_name:e.target.value}))} placeholder="예: 실손의료비보험"/></div>
                      <div><label className={LBL}>청구 요청일 *</label><input type="date" className={CTRL} value={newClaim.claim_date} onChange={e=>setNewClaim(p=>({...p,claim_date:e.target.value}))}/></div>
                      <div><label className={LBL}>청구 유형</label>
                        <select className={CTRL} value={newClaim.claim_type} onChange={e=>setNewClaim(p=>({...p,claim_type:e.target.value as Claim["claim_type"]}))}>
                          <option value="outpatient">통원</option>
                          <option value="inpatient">입원</option>
                          <option value="surgery">수술</option>
                          <option value="death">사망</option>
                          <option value="other">기타</option>
                        </select>
                      </div>
                      <div className="col-span-2"><label className={LBL}>메모</label><input className={CTRL} value={newClaim.memo} onChange={e=>setNewClaim(p=>({...p,memo:e.target.value}))} placeholder="특이사항, 서류 준비 현황 등"/></div>
                    </div>
                    <div className="flex gap-2">
                      <button className={BTP} onClick={()=>void addClaim()}>저장</button>
                      <button className={BTS} onClick={()=>setShowClaimForm(false)}>취소</button>
                    </div>
                  </div>
                )}

                {/* 청구 목록 */}
                {claimLoading?<p className="text-sm text-gray-400 p-4">불러오는 중...</p>
                  :claims.filter(c=>!claimSearch||c.customer_name.includes(claimSearch)||c.product_name.includes(claimSearch)).length===0
                    ?<div className={`${CARD} p-6 text-center text-gray-400 text-sm`}>청구 내역이 없습니다</div>
                    :(
                      <div className="space-y-2">
                        {claims
                          .filter(c=>!claimSearch||c.customer_name.includes(claimSearch)||c.product_name.includes(claimSearch))
                          .map(c=>(
                            <div key={c.id} className={`${CARD} overflow-hidden`}>
                              {/* 요약 행 — 클릭으로 펼침 */}
                              <div className="p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-all"
                                onClick={()=>{
                                  if(expandedClaim===c.id){setExpandedClaim(null);setEditingClaim(null);}
                                  else{setExpandedClaim(c.id);setEditingClaim({...c});}
                                }}>
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-lg flex-shrink-0">
                                  {{inpatient:"🏥",outpatient:"🩺",surgery:"🔬",death:"🕊️",other:"📄"}[c.claim_type]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-[#0f172a]">{c.customer_name}</span>
                                    <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{c.customer_key}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{CLAIM_TYPE_LBL[c.claim_type]}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${CLAIM_STS_CLR[c.status]}`}>{CLAIM_STS_LBL[c.status]}</span>
                                  </div>
                                  <p className="text-sm text-gray-700 mt-0.5">{c.product_name}</p>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-xs text-gray-400">청구일 {fmtDate(c.claim_date)}</span>
                                    {c.memo&&<span className="text-xs text-gray-500 truncate max-w-[200px]">{c.memo}</span>}
                                  </div>
                                </div>
                                <span className="text-gray-300 text-xs flex-shrink-0">{expandedClaim===c.id?"▲":"▼"}</span>
                              </div>
                              {/* 상세/수정 패널 */}
                              {expandedClaim===c.id&&editingClaim&&(
                                <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">상세 수정</p>
                                  <div className="grid grid-cols-2 gap-2.5">
                                    <div><label className={LBL}>상품명</label><input className={CTRL} value={editingClaim.product_name??""} onChange={e=>setEditingClaim(p=>({...p,product_name:e.target.value}))}/></div>
                                    <div><label className={LBL}>청구일</label><input type="date" className={CTRL} value={editingClaim.claim_date??""} onChange={e=>setEditingClaim(p=>({...p,claim_date:e.target.value}))}/></div>
                                    <div><label className={LBL}>청구 유형</label>
                                      <select className={CTRL} value={editingClaim.claim_type??""} onChange={e=>setEditingClaim(p=>({...p,claim_type:e.target.value as Claim["claim_type"]}))}>
                                        <option value="outpatient">통원</option><option value="inpatient">입원</option>
                                        <option value="surgery">수술</option><option value="death">사망</option><option value="other">기타</option>
                                      </select>
                                    </div>
                                    <div><label className={LBL}>진행 상태</label>
                                      <select className={CTRL} value={editingClaim.status??""} onChange={e=>setEditingClaim(p=>({...p,status:e.target.value as Claim["status"]}))}>
                                        <option value="requested">청구요청</option><option value="processing">청구중</option>
                                        <option value="completed">청구완료</option>
                                      </select>
                                    </div>
                                    <div className="col-span-2"><label className={LBL}>메모</label><textarea className={TA2} rows={2} value={editingClaim.memo??""} onChange={e=>setEditingClaim(p=>({...p,memo:e.target.value}))}/></div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button className={BTP} onClick={()=>void saveClaim(c.id)}>저장</button>
                                    <button className={BTS} onClick={()=>{setExpandedClaim(null);setEditingClaim(null);}}>취소</button>
                                    <button className={BTG} onClick={()=>quickChat(`"${c.customer_name}" ${c.product_name} ${CLAIM_TYPE_LBL[c.claim_type]} 청구 진행 상황 정리해줘`)}>AI</button>
                                    <button className="ml-auto text-xs text-red-400 hover:text-red-600" onClick={()=>void delClaim(c.id)}>삭제</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )
                }
              </div>
            </div>
          )}

          {/* ══ 고객 조회 ══ */}
          {tab==="customers"&&(
            <div className="space-y-4 pb-4">

              {/* 검색창 */}
              <div className={`${CARD} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#0f172a]">👤 고객 조회</p>
                  <div className="flex gap-2">
                    <button className={BTG} onClick={()=>setShowUpload(v=>!v)}>
                      📥 엑셀 업로드
                    </button>
                    <a
                      href="/고객정보_업로드_템플릿.xlsx"
                      download
                      className={`${BTG} no-underline`}
                      onClick={async(e)=>{
                        // Supabase Storage에서 다운로드 (또는 public 경로)
                        // 여기서는 안내만
                        e.preventDefault();
                        showToast("템플릿은 채팅에서 다운로드하세요");
                      }}
                    >
                      📄 템플릿 다운로드
                    </a>
                  </div>
                </div>

                {/* 업로드 패널 */}
                {showUpload&&(
                  <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-xs font-semibold text-blue-700 mb-2">📥 엑셀 파일 업로드</p>
                    <p className="text-xs text-blue-600 mb-3">
                      템플릿의 <strong>고객정보</strong> 시트에 데이터를 입력하고 업로드하세요.
                      계약 정보와 고객 기본 정보(계좌·카드)를 한 행에 입력하면 자동으로 각각 저장됩니다.
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        ref={uploadRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={e=>void handleUpload(e)}
                        className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0f172a] file:text-white hover:file:opacity-90 cursor-pointer"
                        disabled={uploadLoading}
                      />
                      {uploadLoading&&<span className="text-xs text-blue-600 animate-pulse">업로드 중...</span>}
                    </div>
                    {uploadResult&&(
                      <div className="mt-3 p-3 rounded-lg bg-white border border-blue-100 text-xs space-y-1">
                        <p className="text-emerald-600 font-semibold">✅ 성공: {uploadResult.ok}건</p>
                        {uploadResult.skip>0&&<p className="text-gray-400">⏭ 건너뜀: {uploadResult.skip}건 (필수값 누락)</p>}
                        {uploadResult.err.map((e,i)=>(
                          <p key={i} className="text-red-500">❌ {e}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    className={`${CTRL} flex-1`}
                    placeholder="고객 이름 입력 (동명이인 모두 표시)"
                    value={custSearch}
                    onChange={e=>{setCustSearch(e.target.value); void searchCustomers(e.target.value);}}
                    onKeyDown={e=>{if(e.key==="Enter") void searchCustomers(custSearch);}}
                  />
                  <button className={BTP} onClick={()=>void searchCustomers(custSearch)}>검색</button>
                  <button className={BTS} onClick={()=>{
                    setShowAllCusts(v=>{
                      if(!v) void loadAllCustomers();
                      return !v;
                    });
                    setCustSearch(""); setCustResults([]);
                  }}>{showAllCusts?"목록 닫기":"전체 고객"}</button>
                  {selectedCust&&<button className={BTS} onClick={()=>{setSelectedCust(null);setCustSearch("");setCustResults([]);setShowAllCusts(false);}}>초기화</button>}
                </div>

                {/* 전체 고객 목록 */}
                {showAllCusts&&(
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400">
                        {allCustsLoading?"불러오는 중...":`전체 ${allCusts.length}명`}
                      </p>
                      <button onClick={()=>void loadAllCustomers()} className="text-[10px] text-gray-400 hover:text-blue-500">새로고침</button>
                    </div>
                    {!allCustsLoading&&(
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 max-h-64 overflow-y-auto pr-1">
                        {allCusts.map(c=>(
                          <button key={c.customer_key}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-white hover:border-orange-300 hover:bg-orange-50 transition-all text-left"
                            onClick={()=>{setShowAllCusts(false); void loadCustomerProfile(c.customer_key,c.customer_name);}}>
                            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                              {c.customer_name.slice(0,1)}
                            </span>
                            <span className="text-xs font-medium text-[#0f172a] truncate">{c.customer_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 검색 결과 — 고객 카드 목록 */}
                {custLoading&&<p className="text-xs text-gray-400 mt-3">검색 중...</p>}
                {!custLoading&&custResults.length===0&&custSearch.trim()&&(
                  <p className="text-sm text-gray-400 mt-3 text-center py-4">"{custSearch}" 검색 결과가 없습니다</p>
                )}

                {/* 최근 변경 고객 — 검색어 없을 때 항상 표시 */}
                {!custSearch.trim()&&custResults.length===0&&(
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">🔔 최근 변경 고객</p>
                      <button onClick={()=>void loadRecentChanged()} className="text-[10px] text-gray-400 hover:text-blue-500 transition-all">새로고침</button>
                    </div>
                    {recentChangedLoading
                      ? <p className="text-xs text-gray-300 py-2">불러오는 중...</p>
                      : recentChanged.length===0
                        ? <p className="text-xs text-gray-300 py-2">변경 이력이 없습니다</p>
                        : <div className="flex items-center gap-2 overflow-hidden">
                          {recentChanged.slice(0,10).map((r,i,arr)=>{
                            const typeClr = r.change_type==="상담"?"bg-blue-50 text-blue-600 border-blue-200":r.change_type==="계약"?"bg-emerald-50 text-emerald-600 border-emerald-200":"bg-indigo-50 text-indigo-600 border-indigo-200";
                            const ago = (()=>{
                              const diff = Date.now() - new Date(r.changed_at).getTime();
                              const m = Math.floor(diff/60000);
                              if(m<60) return `${m}분 전`;
                              const h = Math.floor(m/60);
                              if(h<24) return `${h}시간 전`;
                              return `${Math.floor(h/24)}일 전`;
                            })();
                            // 마지막 배지는 flex-shrink 허용하되 min-w-0 + truncate
                            const isLast = i===arr.length-1;
                            return (
                              <button key={r.customer_key}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all hover:shadow-sm hover:scale-105 flex-shrink-0 whitespace-nowrap ${typeClr}`}
                                style={isLast?{minWidth:0,flexShrink:1}:{}}
                                onClick={()=>void loadCustomerProfile(r.customer_key, r.customer_name)}>
                                <span className={`font-semibold${isLast?" truncate max-w-[60px]":""}`}>{r.customer_name}</span>
                                <span className="opacity-60 text-[10px] flex-shrink-0">{ago}</span>
                              </button>
                            );
                          })}
                          {recentChanged.length>10&&(
                            <span className="text-xs text-gray-400 flex-shrink-0">...</span>
                          )}
                        </div>
                    }
                  </div>
                )}

                {custResults.length>0&&(
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 mb-2">{custResults.length}명 검색됨 — 고객을 선택하세요</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {custResults.map(c=>(
                        <div key={c.customer_key} className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedCust?.customer_key===c.customer_key?"border-orange-400 bg-orange-50":"border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50"}`}>
                          <button className="flex items-center gap-3 flex-1 text-left"
                            onClick={()=>void loadCustomerProfile(c.customer_key, c.customer_name)}
                          >
                            <div className="w-9 h-9 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                              {c.customer_name.slice(0,1)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#0f172a]">{c.customer_name}</p>
                              <p className="font-mono text-xs text-gray-400">{c.customer_key}</p>
                            </div>
                          </button>
                          <button className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-all flex-shrink-0"
                            onClick={e=>{e.stopPropagation();void deleteCustomer(c.customer_key,c.customer_name);}}>
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 고객 상세 프로필 */}
              {custDetailLoading&&(
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"0ms"}}/>
                  <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"150ms"}}/>
                  <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"300ms"}}/>
                  <span className="text-sm">불러오는 중...</span>
                </div>
              )}

              {selectedCust&&!custDetailLoading&&(
                <div className="space-y-4">

                  {/* 고객 헤더 */}
                  <div className={`${CARD} p-4`}>
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-base font-bold flex-shrink-0">
                        {selectedCust.customer_name.slice(0,1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-base font-bold text-[#0f172a] truncate">{selectedCust.customer_name}</h2>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button className={BTG} onClick={()=>quickChat(`고객 "${selectedCust.customer_name}"(${selectedCust.customer_key}) 전체 현황 정리해줘`)}>AI 요약</button>
                            <button className="px-3 py-1.5 rounded-xl border border-red-200 text-xs text-red-500 hover:bg-red-50 transition-all"
                              onClick={()=>void deleteCustomer(selectedCust.customer_key, selectedCust.customer_name)}>
                              삭제
                            </button>
                          </div>
                        </div>
                        <p className="font-mono text-xs text-gray-400 mt-0.5 truncate">{selectedCust.customer_key}</p>
                        {custInfo?.phone&&(
                          <a href={`tel:${custInfo.phone.replace(/-/g,"")}`} className="text-xs text-orange-500 hover:underline mt-0.5 inline-block">
                            📞 {custInfo.phone}
                          </a>
                        )}
                        <div className="flex gap-3 mt-1.5 text-xs flex-wrap">
                          <span className="text-blue-600">📋 계약 {selectedCust.policies.length}건</span>
                          <span className="text-emerald-600">🛡 상담 {selectedCust.consults.length}건</span>
                          <span className="text-indigo-600">🏥 청구 {selectedCust.claims.length}건</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 고객 기본 정보 */}
                  <div className={`${CARD} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-[#0f172a]">💳 고객 정보</p>
                      <button className={BTG} onClick={()=>setEditingCustInfo(v=>!v)}>
                        {editingCustInfo?"닫기":"수정"}
                      </button>
                    </div>
                    {!editingCustInfo?(
                      <div className="space-y-2.5">
                        {/* 전화번호 */}
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <span className="text-base flex-shrink-0">📞</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-400 mb-0.5">전화번호</p>
                            {custInfo?.phone
                              ?<a href={`tel:${custInfo.phone.replace(/-/g,"")}`} className="text-sm text-orange-500 hover:underline">{custInfo.phone}</a>
                              :<p className="text-xs text-gray-300">미등록</p>
                            }
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <span className="text-base flex-shrink-0">🏦</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-400 mb-0.5">계좌번호</p>
                            {custInfo?.bank_name||custInfo?.bank_account
                              ?<p className="text-sm text-[#0f172a]">{[custInfo.bank_name,custInfo.bank_account].filter(Boolean).join(" · ")}</p>
                              :<p className="text-xs text-gray-300">미등록</p>
                            }
                          </div>
                        </div>
                        {/* 카드 */}
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <span className="text-base flex-shrink-0">💳</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-400 mb-0.5">카드번호</p>
                            {custInfo?.card_company||custInfo?.card_number
                              ?<p className="text-sm text-[#0f172a]">{[custInfo.card_company,custInfo.card_number,custInfo.card_expiry].filter(Boolean).join(" · ")}</p>
                              :<p className="text-xs text-gray-300">미등록</p>
                            }
                          </div>
                        </div>
                        {/* 메모 */}
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <span className="text-base flex-shrink-0">📝</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-400 mb-0.5">메모</p>
                            {custInfo?.memo
                              ?<p className="text-sm text-[#0f172a] whitespace-pre-wrap">{custInfo.memo}</p>
                              :<p className="text-xs text-gray-300">없음</p>
                            }
                          </div>
                        </div>
                      </div>
                    ):(
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="col-span-2"><label className={LBL}>📞 전화번호</label><input className={CTRL} value={custInfoForm.phone} onChange={e=>setCustInfoForm(p=>({...p,phone:e.target.value}))} placeholder="010-0000-0000"/></div>
                          <div><label className={LBL}>🏦 은행명</label><input className={CTRL} value={custInfoForm.bank_name} onChange={e=>setCustInfoForm(p=>({...p,bank_name:e.target.value}))} placeholder="예: 우리은행"/></div>
                          <div><label className={LBL}>계좌번호</label><input className={CTRL} value={custInfoForm.bank_account} onChange={e=>setCustInfoForm(p=>({...p,bank_account:e.target.value}))} placeholder="000-000-000000"/></div>
                          <div><label className={LBL}>💳 카드사</label><input className={CTRL} value={custInfoForm.card_company} onChange={e=>setCustInfoForm(p=>({...p,card_company:e.target.value}))} placeholder="예: 신한카드"/></div>
                          <div><label className={LBL}>카드번호</label><input className={CTRL} value={custInfoForm.card_number} onChange={e=>setCustInfoForm(p=>({...p,card_number:e.target.value}))} placeholder="0000-0000-0000-0000"/></div>
                          <div><label className={LBL}>유효기간</label><input className={CTRL} value={custInfoForm.card_expiry} onChange={e=>setCustInfoForm(p=>({...p,card_expiry:e.target.value}))} placeholder="MM/YY"/></div>
                        </div>
                        <div><label className={LBL}>📝 메모</label><textarea className={TA2} rows={3} value={custInfoForm.memo} onChange={e=>setCustInfoForm(p=>({...p,memo:e.target.value}))} placeholder="특이사항, 청구 관련 메모 등"/></div>
                        <div className="flex gap-2">
                          <button className={BTP} onClick={()=>void saveCustInfo()}>저장</button>
                          <button className={BTS} onClick={()=>setEditingCustInfo(false)}>취소</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 계약 목록 — ins_policies + consultation_insurance_details 통합 */}
                  <div className={`${CARD} p-4`}>
                    <p className="text-sm font-semibold text-[#0f172a] mb-3">📋 가입 계약</p>
                    {selectedCust.policies.length===0 && selectedCust.insuranceDetails.length===0
                      ? <p className="text-xs text-gray-400 text-center py-3">계약 없음</p>
                      : <div className="space-y-3">
                          {/* ins_policies */}
                          {selectedCust.policies.map(p=>{
                            const days=daysUntilExpiry(p.expiry_date);
                            const isExpiring=days!==null&&days<=30&&days>=0;
                            return(
                              <div key={p.id} className={`p-3 rounded-xl border ${isExpiring?"border-red-200 bg-red-50":"border-gray-100 bg-gray-50"}`}>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-xs font-semibold text-blue-600 px-2 py-0.5 rounded-full bg-blue-50">{p.product_name}</span>
                                  {isExpiring&&<span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">D-{days}</span>}
                                </div>
                                <div className="flex flex-wrap gap-x-4 text-xs text-gray-500">
                                  <span>가입 {fmtDate(p.start_date)}</span>
                                  {p.expiry_date&&<span className={isExpiring?"text-red-500 font-semibold":""}>만기 {fmtDate(p.expiry_date)}</span>}
                                </div>
                                {p.memo&&!p.memo.startsWith("[자동등록]")&&<p className="text-xs text-gray-400 mt-0.5 truncate">{p.memo}</p>}
                              </div>
                            );
                          })}
                          {/* consultation_insurance_details (나르미 상세) */}
                          {selectedCust.insuranceDetails.map(d=>(
                            <div key={d.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50 space-y-1.5">
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-700">
                                {d.insurance_type&&<span>🛡 <strong>{d.insurance_type==="automobile"?"자동차보험":d.insurance_type}</strong></span>}
                                {d.insurance_company&&<span>보험사: <strong>{d.insurance_company}</strong></span>}
                                {d.insurer_name&&<span>가입자: {d.insurer_name}</span>}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600">
                                {d.insurance_start_date&&<span>가입일: <strong className="text-blue-600">{d.insurance_start_date}</strong></span>}
                                {d.insurance_end_date&&<span>만기일: <strong className="text-red-500">{d.insurance_end_date}</strong></span>}
                              </div>
                              {(d.vehicle_no||d.vehicle_model)&&(
                                <div className="flex flex-wrap gap-x-4 text-xs text-gray-500">
                                  {d.vehicle_no&&<span>🚘 {d.vehicle_no}</span>}
                                  {d.vehicle_model&&<span>{d.vehicle_model}</span>}
                                  {d.vehicle_use&&<span>{d.vehicle_use}</span>}
                                </div>
                              )}
                              {d.note&&<p className="text-xs text-gray-400">📝 {d.note}</p>}
                            </div>
                          ))}
                        </div>
                    }
                  </div>

                  {/* 상담 이력 */}
                  <div className={`${CARD} p-4`}>
                    <p className="text-sm font-semibold text-[#0f172a] mb-3">🛡 상담 이력</p>
                    {selectedCust.consults.length===0
                      ?<p className="text-xs text-gray-400 text-center py-3">상담 이력 없음</p>
                      :<div className="space-y-2">
                        {selectedCust.consults.map(c=>(
                          <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <StsBadge s={c.status}/>
                                <span className="text-xs text-gray-400">{fmtDT(c.created_at)}</span>
                                {c.followup_needed&&c.next_followup_date&&(
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">사후관리 {fmtDate(c.next_followup_date)}</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-700 mt-1 line-clamp-2">{c.summary}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    }
                  </div>

                  {/* 청구 이력 */}
                  <div className={`${CARD} p-4`}>
                    <p className="text-sm font-semibold text-[#0f172a] mb-3">🏥 청구 이력</p>
                    {selectedCust.claims.length===0
                      ?<p className="text-xs text-gray-400 text-center py-3">청구 이력 없음</p>
                      :<div className="space-y-2">
                        {selectedCust.claims.map(c=>(
                          <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                            <div className="text-lg flex-shrink-0">
                              {{inpatient:"🏥",outpatient:"🩺",surgery:"🔬",death:"🕊️",other:"📄"}[c.claim_type]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-gray-700">{c.product_name}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{CLAIM_TYPE_LBL[c.claim_type]}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${CLAIM_STS_CLR[c.status]}`}>{CLAIM_STS_LBL[c.status]}</span>
                              </div>
                              <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                                <span>청구일 {fmtDate(c.claim_date)}</span>
                                {c.memo&&<span className="truncate max-w-[180px]">{c.memo}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    }
                  </div>

                </div>
              )}
            </div>
          )}

          {/* ══ 나르미 ══ */}
          {tab==="narumi"&&(
            <div className="space-y-3 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-semibold text-[#0f172a]">🚛 나르미 업무</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button className={BTG} onClick={()=>{
                    setNarumiLoading(true);
                    Promise.all([
                      supabase.from("narumi_tasks").select("*").order("created_at",{ascending:false}).limit(60),
                      supabase.from("consultation_cases").select("id,customer_name,work_type,status,summary,created_at,phone").eq("work_type","narumi").order("created_at",{ascending:false}).limit(30),
                    ]).then(([nRes,cRes])=>{
                      setNarumiList((nRes.data??[]) as NarumiTask[]);
                      setNarumiConsults((cRes.data??[]) as Consult[]);
                      setNarumiLoading(false);
                    });
                  }}>새로고침</button>
                  <button className={BTO} onClick={()=>navigate("/narumi")}>전체 페이지 →</button>
                </div>
              </div>
              {narumiLoading
                ? <p className="text-sm text-gray-400 p-4 text-center">불러오는 중...</p>
                : narumiList.length===0
                ? <div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>등록된 차량이 없습니다</div>
                : (
                  <div className="space-y-2">
                    {narumiList.map((t:any)=>(
                      <div key={t.id} className={`${CARD} p-3.5`}>
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {t.is_urgent&&<span className="text-xs font-bold text-red-500 flex-shrink-0">긴급</span>}
                              <span className="text-sm font-semibold text-[#0f172a]">{t.customer_name||"미확인"}</span>
                              {t.vin&&<span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-mono">{t.vin}</span>}
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                t.status==="completed"?"bg-emerald-50 text-emerald-600 border-emerald-100":
                                t.status==="registered"?"bg-blue-50 text-blue-600 border-blue-100":
                                t.status==="docs"?"bg-purple-50 text-purple-600 border-purple-100":
                                "bg-orange-50 text-orange-600 border-orange-100"}`}>
                                {t.status==="completed"?"완료":t.status==="registered"?"등록완료":t.status==="docs"?"서류준비":t.status==="insurance"?"보험확인":"진행중"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                              {t.sales_rep&&<span>영업: {t.sales_rep}</span>}
                              {t.delivery_date&&<span>출고: {t.delivery_date}</span>}
                              {t.memo&&<span className="truncate max-w-[160px]">{t.memo}</span>}
                              {t.special_note&&<span className="text-orange-500 truncate max-w-[140px]">{t.special_note}</span>}
                              {!t.docs_ready&&<span className="text-amber-600">서류미비</span>}
                              <span className="ml-auto text-gray-300">{String(t.created_at||"").slice(0,10)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button className={BTO} onClick={()=>navigate("/narumi")}>이동</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
              {narumiConsults.length>0&&(
                <div className={`${CARD} p-3.5`}>
                  <p className="text-xs font-semibold text-gray-400 mb-2">📋 나르미 상담내역 ({narumiConsults.length}건)</p>
                  <div className="space-y-2">
                    {narumiConsults.map((c:any)=>(
                      <div key={c.id} className={`${CARD} p-3.5`}>
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-[#0f172a]">{c.customer_name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100 font-medium">{STS_LBL[c.status]??c.status}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                              {c.summary&&<span className="truncate max-w-[200px]">{c.summary}</span>}
                              <span className="ml-auto text-gray-300">{String(c.created_at||"").slice(0,10)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button className={BTO} onClick={()=>navigate(`/work/call-management?id=${c.id}`)}>상담관리 →</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==="chat"&&(
            <div className={`${CARD} p-4`} style={{height:"calc(100vh - 320px)",minHeight:300,display:"flex",flexDirection:"column"}}>
              {histLoading&&(
                <div className="flex items-center justify-center h-20 gap-2 text-xs text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"0ms"}}/>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"150ms"}}/>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"300ms"}}/>
                  <span>대화 이력 불러오는 중...</span>
                </div>
              )}
              {!histLoading&&msgs.length===0&&(
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
                  <span className="text-3xl">💬</span>
                  <p className="text-sm font-medium text-gray-500">무엇이든 말씀해 주세요</p>
                  <p className="text-xs">할일·일정·고객 문의를 자동으로 분류·저장합니다</p>
                </div>
              )}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
                {msgs.map((m,i)=>(
                  <div key={i} className={`flex gap-2.5 ${m.role==="user"?"flex-row-reverse":""}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${m.role==="assistant"?"bg-[#0f172a] text-white":"bg-orange-500 text-white"}`}>
                      {m.role==="assistant"?"AI":"나"}
                    </div>
                    <div className={`${m.role==="assistant"?"flex-1":""} max-w-[80%]`}>
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role==="assistant"?"bg-gray-50 border border-gray-200 text-gray-800 rounded-tl-sm":"bg-[#0f172a] text-white rounded-tr-sm"}`}>
                        <span dangerouslySetInnerHTML={{__html:md2html(m.content)}}/>
                      </div>
                      {m.ts&&(
                        <p className={`text-[10px] text-gray-400 mt-1 ${m.role==="user"?"text-right":"text-left"}`}>{m.ts}</p>
                      )}
                      {m.role==="assistant"&&m.saved&&m.saved.length>0&&m.actions&&(
                        <SavedCard actions={m.actions} saved={m.saved} onNav={navigate}/>
                      )}
                      {m.role==="assistant"&&m.pendingUpdates&&m.pendingUpdates.length>0&&(
                        <PendingCard pu={m.pendingUpdates} onConfirm={(cid,a)=>void confirmUpdate(i,cid,a)} onReject={(ui)=>rejectUpdate(i,ui)}/>
                      )}
                      {m.role==="assistant"&&m.pendingCustomerSelects&&m.pendingCustomerSelects.length>0&&(
                        <PendingCustomerSelectCard pcs={m.pendingCustomerSelects} onConfirm={(key,a)=>void confirmCustomerSelect(i,key,a)} onReject={(ui)=>rejectCustomerSelect(i,ui)}/>
                      )}
                      {m.role==="assistant"&&m.pendingScheduleConsults&&m.pendingScheduleConsults.length>0&&(
                        <ScheduleConsultConfirmCard
                          psc={m.pendingScheduleConsults}
                          onConfirm={(pscIdx,key)=>void confirmScheduleConsult(i,pscIdx,key)}
                          onReject={(pscIdx)=>rejectScheduleConsult(i,pscIdx)}
                        />
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading&&(
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#0f172a] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">AI</div>
                    <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-200 flex gap-1.5 items-center">
                      {[0,150,300].map(d=><span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{animationDelay:`${d}ms`}}/>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ 입력창 — 모바일: fixed 하단 고정 / 데스크탑: 일반 흐름 ══ */}
          <div className="flex-shrink-0 pt-2 fixed bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 px-3 py-2 z-50 sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pt-2">
            <div className="flex flex-wrap gap-1 mb-1.5 sm:gap-1.5 sm:mb-2">
              {["오늘 상담 요약","긴급 할일","오늘 사후관리","방금 보험 통화 저장","고객 미팅 메모 정리"].map(c=>(
                <button key={c} onClick={()=>quickChat(c.includes("저장")||c.includes("정리")?c+". ":c+" 알려줘")}
                  className="px-2 py-0.5 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-blue-300 hover:text-blue-500 bg-white transition-all sm:px-2.5 sm:py-1">
                  {c}
                </button>
              ))}
            </div>
            <div className={`${CARD} py-2 px-3`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400 hidden sm:block">보험 상담 내용을 말씀하시면 AI가 자동 분류·저장합니다</p>
                <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 ml-auto">
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${autoSave?"bg-emerald-500":"bg-gray-300"}`} onClick={()=>setAutoSave(v=>!v)}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${autoSave?"translate-x-4":"translate-x-0.5"}`}/>
                  </div>
                  <span className="text-xs text-gray-500">{autoSave?"자동저장 ON":"OFF"}</span>
                </label>
              </div>
              <div className="flex gap-2 items-end">
                <textarea ref={chatInputRef} className={`${TA2} flex-1 min-h-[38px] max-h-24`} rows={1}
                  placeholder="보험 상담 내용, 고객 정보, 할일, 일정... 자동 저장됩니다"
                  value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={chatKey}/>
                <button className={`${BTP} h-9 px-4 flex-shrink-0`} onClick={()=>void sendChat()} disabled={chatLoading||!chatInput.trim()}>전송</button>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
};

export default SecretaryInsPage;