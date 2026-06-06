import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type TabKey = "chat"|"schedule"|"status"|"orders";
type Schedule = {
  id:number; title:string; description:string|null; schedule_date:string;
  progress_memo:string|null; next_schedule_date:string|null; next_schedule_time:string|null;
  start_time:string|null; end_time:string|null;
  category:"meeting"|"call"|"task"|"followup";
  location:string|null; related_type:string|null; is_done:boolean; consultation_id:number|null;
};
type Todo = {
  id:number; title:string; description:string|null;
  priority:"urgent"|"normal"|"low"; category:string|null;
  due_date:string|null; is_done:boolean; done_at:string|null; consultation_id:number|null;
};
type Order = {
  id:number; created_at:string; customer_name:string; phone:string|null;
  channel:"kakao"|"phone"|"visit"|"web"; work_type:string|null;
  summary:string; detail:string|null; status:"new"|"pending"|"processing"|"done"|"forwarded"|"delivered"|"wheel_returned"|"invoiced";
  consultation_id:number|null;
};
type Consult = {
  id:number; customer_name:string; phone:string; telecom_provider:string|null;
  work_type:string; status:string; summary:string;
  followup_needed:boolean; next_followup_date:string|null; created_at:string;
  finance_stage?:string|null;
};
type HyundaiTask = {
  id:number; customer_name:string; company_name:string|null;
  status:string|null; purchase_amount:number|null; finance_company:string|null;
  created_at:string; equipment_ton:string|null;
};
type NarumiTask = {
  id:number; customer_name:string|null; memo:string|null;
  status:string|null; is_urgent:boolean; docs_ready:boolean;
  delivery_date:string|null; created_at:string; vin:string|null;
};
type PendingUpdate = {
  action:Record<string,unknown>;
  candidates:{id:number;customer_name:string;work_type:string;status:string;summary:string;detail_memo:string|null}[];
  bestMatch:{id:number;customer_name:string;work_type:string;status:string;summary:string;detail_memo:string|null}|null;
};
type ChatMsg = {
  role:"user"|"assistant"; content:string;
  ts?:string;
  saved?:{type:string;id:number;consultation_id?:number}[];
  actions?:Record<string,unknown>[];
  pendingUpdates?:PendingUpdate[];
  pendingHyundaiUpdates?:PendingHyundaiUpdate[];
};

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const WL:Record<string,string> = {
  insurance:"보험",tire:"타이어",finance:"금융",forklift:"지게차",battery:"배터리",
  registration_insurance:"보험",tire_sales:"타이어",forklift_sales:"지게차",battery_sales:"배터리",
};
const CAT_LBL:Record<string,string> = {meeting:"미팅",call:"통화",task:"업무",followup:"사후관리"};
const STS_LBL:Record<string,string> = {new:"신규",pending:"대기",processing:"진행중",done:"완료",in_progress:"진행중",completed:"완료",forwarded:"진흥전달",delivered:"납품완료",wheel_returned:"휠반납",invoiced:"계산서발행"};
const PRI_LBL:Record<string,string> = {urgent:"긴급",normal:"일반",low:"낮음"};
const ACT_LBL:Record<string,string> = {todo:"✅ 할일",schedule:"📅 일정",order:"📦 주문",consult_update:"🔄 상담 업데이트",hyundaicm_update:"🏗 현대건설기계 변경",narumi_update:"🚛 나르미 단계 변경",schedule_update:"📅 일정 업데이트",schedule_edit:"✏️ 일정 수정",order_update:"📦 주문 상태 변경"};
const CAT_CLR:Record<string,string> = {meeting:"#60a5fa",call:"#fb923c",followup:"#c084fc",task:"#34d399"};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
const todayStr = () => { const d=new Date(); d.setHours(d.getHours()+9); return d.toISOString().slice(0,10); };
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
              <button className="text-xs text-emerald-600 hover:underline ml-2 flex-shrink-0" onClick={()=>onNav(`/work/call-management?id=${s.id}`)}>상담내역→</button>
            )}
            {a.type==="hyundaicm_update"&&s?.id&&(
              <button className="text-xs text-blue-600 hover:underline ml-2 flex-shrink-0" onClick={()=>onNav(`/work/hyundaicm?id=${s.id}`)}>현대건설기계→</button>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ─── 업무현황 탭 컴포넌트 ──────────────────────────────────────────────────────
function StatusTabContent({
  hyundaiTasks, narumiTasks, recentC, statusLoading,
  chatInput, chatLoading,
  setChatInput, onRefresh, onNavigate, onSendChat, onTabChat,
  BTS, BTG, BTP, TA2, CARD, md2html, fmtDate,
}:any) {
  const thisMonth = new Date().getMonth();
  const thisYear  = new Date().getFullYear();
  const isMo = (d:string) => { const dt=new Date(d); return dt.getFullYear()===thisYear&&dt.getMonth()===thisMonth; };

  const hMo    = hyundaiTasks.filter((t:any)=>isMo(t.created_at)).length;
  const hTotal = hyundaiTasks.length;
  const nMo    = narumiTasks.filter((t:any)=>isMo(t.created_at)).length;
  const nTotal = narumiTasks.length;
  const isFinance = (wt:string) => wt==="finance";
  const isTire    = (wt:string) => wt==="tire"||wt==="tire_sales";
  const cFinance  = recentC.filter((c:any)=>isFinance(c.work_type));
  const cTire     = recentC.filter((c:any)=>isTire(c.work_type));
  const cOther    = recentC.filter((c:any)=>!isFinance(c.work_type)&&!isTire(c.work_type));
  const cFinanceMo= cFinance.filter((c:any)=>isMo(c.created_at)).length;
  const cTireMo   = cTire.filter((c:any)=>isMo(c.created_at)).length;
  const cOtherMo  = cOther.filter((c:any)=>isMo(c.created_at)).length;

  const STS_LBL_HCM:Record<string,string> = {new:"신규",pending:"대기",processing:"진행중",done:"완료",in_progress:"진행중",completed:"완료"};
  const FINANCE_STAGE_LBL:Record<string,string> = {consulting:"상담",quote_submitted:"견적제출",approved:"승인",rejected:"부결",documents_requested:"서류징구",confirmed:"확정"};
  const getConsultDisplayStatus = (c:any) => {
    if(c.work_type==="finance" && c.finance_stage) return c.finance_stage;
    return c.status;
  };
  const StsBadgeLocal = ({s,isFinance}:{s:string;isFinance?:boolean}) => {
    const lbl = isFinance ? (FINANCE_STAGE_LBL[s]??s) : (STS_LBL_HCM[s]??s);
    const cls = s==="approved"?"bg-emerald-50 text-emerald-700"
      :s==="confirmed"?"bg-[#0f172a] text-white"
      :s==="rejected"||s==="부결"?"bg-red-50 text-red-600"
      :s==="documents_requested"?"bg-violet-50 text-violet-700"
      :s==="quote_submitted"?"bg-cyan-50 text-cyan-700"
      :s==="new"?"bg-blue-50 text-blue-600"
      :s==="pending"?"bg-amber-50 text-amber-600"
      :s==="in_progress"||s==="processing"?"bg-orange-50 text-orange-600"
      :s==="completed"||s==="confirmed"?"bg-emerald-50 text-emerald-700"
      :"bg-gray-100 text-gray-500";
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{lbl}</span>;
  };
  const WL_LOCAL:Record<string,string> = {insurance:"보험",tire:"타이어",finance:"금융",forklift:"지게차",battery:"배터리",registration_insurance:"보험",tire_sales:"타이어",forklift_sales:"지게차",battery_sales:"배터리"};

  const ConsultPanel = ({title,emoji,items,moCount,bg,txt,hoverBg}:{title:string;emoji:string;items:any[];moCount:number;bg:string;txt:string;hoverBg:string}) => (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#0f172a]">{emoji} {title}</p>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${bg} ${txt} font-medium`}>당월 {moCount}건</span>
          <button className={BTG} onClick={()=>onNavigate("/work/call-management")}>전체 →</button>
        </div>
      </div>
      {statusLoading?<p className="text-xs text-gray-400">불러오는 중...</p>
      :items.length===0?<p className="text-xs text-gray-400 py-3 text-center">해당 상담이 없습니다</p>
      :(
        <div className="space-y-1.5">
          {items.slice(0,4).map((c:any)=>(
            <div key={c.id} className={`flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 ${hoverBg} transition-all cursor-pointer`} onClick={()=>onNavigate(`/work/call-management?id=${c.id}`)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#0f172a]">{c.customer_name}</span>
                  <StsBadgeLocal s={getConsultDisplayStatus(c)} isFinance={c.work_type==="finance"}/>
                  {c.followup_needed&&<span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">사후관리</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{c.summary}</p>
              </div>
              <button className={BTG} onClick={(e:any)=>{e.stopPropagation();onTabChat();setChatInput(`"${c.customer_name}" 상담 내용: ${c.summary} — 다음 대응 제안해줘`);setTimeout(onSendChat,50);}}>AI</button>
            </div>
          ))}
          {items.length>4&&<p className="text-xs text-gray-400 text-center pt-1">+{items.length-4}건 더 있음</p>}
        </div>
      )}
    </div>
  );

  const HCM_STS_CLR_LOCAL:Record<string,string> = {
    접수:"bg-gray-100 text-gray-500", 신용조회:"bg-blue-50 text-blue-700",
    승인:"bg-emerald-50 text-emerald-700", 보완:"bg-amber-50 text-amber-700",
    거절:"bg-red-50 text-red-600", 서류등록:"bg-violet-50 text-violet-700",
    전자계약발송:"bg-cyan-50 text-cyan-700", 확정:"bg-[#0f172a] text-white", 보류:"bg-orange-50 text-orange-700",
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <button className={BTS} onClick={onRefresh}>🔄 새로고침</button>
      </div>
      <div className="grid grid-cols-5 gap-2.5">
        {[
          {label:"현대건설기계",emoji:"🏗",mo:hMo,total:hTotal,bg:"bg-blue-50",txt:"text-blue-700"},
          {label:"나르미",       emoji:"🚛",mo:nMo,total:nTotal,bg:"bg-emerald-50",txt:"text-emerald-700"},
          {label:"금융상담",     emoji:"💰",mo:cFinanceMo,total:cFinance.length,bg:"bg-violet-50",txt:"text-violet-700"},
          {label:"타이어상담",   emoji:"🔘",mo:cTireMo,total:cTire.length,bg:"bg-amber-50",txt:"text-amber-700"},
          {label:"기타상담",     emoji:"💬",mo:cOtherMo,total:cOther.length,bg:"bg-orange-50",txt:"text-orange-700"},
        ].map(({label,emoji,mo,total,bg,txt})=>(
          <div key={label} className={`${CARD} p-3.5 ${bg} border-0`}>
            <p className={`text-[11px] font-semibold ${txt} mb-1.5`}>{emoji} {label}</p>
            <p className={`text-3xl font-bold ${txt} leading-none`}>{mo}</p>
            <p className={`text-[11px] ${txt} opacity-60 mt-1.5`}>누적 {total}건</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#0f172a]">🏗 현대건설기계 심사 현황</p>
            <button className={BTG} onClick={()=>onNavigate("/work/hyundaicm")}>전체 보기 →</button>
          </div>
          {statusLoading?<p className="text-xs text-gray-400">불러오는 중...</p>
          :hyundaiTasks.length===0?<p className="text-xs text-gray-400 py-4 text-center">데이터가 없습니다</p>
          :(
            <div className="space-y-2">
              {hyundaiTasks.slice(0,6).map((t:any)=>{
                const stsCls = HCM_STS_CLR_LOCAL[t.status]??"bg-gray-100 text-gray-500";
                return (
                  <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 hover:bg-blue-50 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[#0f172a] truncate">{t.customer_name}{t.company_name?` (${t.company_name})`:""}</span>
                        {t.equipment_ton&&<span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">{t.equipment_ton}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.finance_company&&<span className="text-xs text-gray-400">{t.finance_company}</span>}
                        {t.purchase_amount&&<span className="text-xs text-gray-400">{(t.purchase_amount/10000).toFixed(0)}만원</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${stsCls}`}>{t.status??"미분류"}</span>
                  </div>
                );
              })}
              {hyundaiTasks.length>6&&<p className="text-xs text-gray-400 text-center pt-1">+{hyundaiTasks.length-6}건 더 있음</p>}
            </div>
          )}
        </div>
        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#0f172a]">🚛 나르미 딜 현황</p>
            <button className={BTG} onClick={()=>onNavigate("/work/narumi")}>전체 보기 →</button>
          </div>
          {statusLoading?<p className="text-xs text-gray-400">불러오는 중...</p>
          :narumiTasks.length===0?<p className="text-xs text-gray-400 py-4 text-center">데이터가 없습니다</p>
          :(
            <div className="space-y-2">
              {narumiTasks.slice(0,6).map((t:any)=>{
                const stsCls = !t.status?"bg-gray-100 text-gray-500":t.status.includes("완료")?"bg-emerald-50 text-emerald-700":t.status.includes("대기")?"bg-amber-50 text-amber-700":"bg-blue-50 text-blue-700";
                return (
                  <div key={t.id} className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${t.is_urgent?"bg-red-50 hover:bg-red-100":"bg-gray-50 hover:bg-emerald-50"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {t.is_urgent&&<span className="text-xs font-bold text-red-500 flex-shrink-0">긴급</span>}
                        <span className="text-sm font-medium text-[#0f172a] truncate">{t.customer_name??"고객명 미입력"}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {t.memo&&<span className="text-xs text-gray-400 truncate max-w-[140px]">{t.memo}</span>}
                        {t.delivery_date&&<span className="text-xs text-gray-400">납기 {fmtDate(t.delivery_date)}</span>}
                        {!t.docs_ready&&<span className="text-xs text-amber-600">서류미비</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${stsCls}`}>{t.status??"진행중"}</span>
                  </div>
                );
              })}
              {narumiTasks.length>6&&<p className="text-xs text-gray-400 text-center pt-1">+{narumiTasks.length-6}건 더 있음</p>}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ConsultPanel title="금융상담" emoji="💰" items={cFinance} moCount={cFinanceMo} bg="bg-violet-50" txt="text-violet-700" hoverBg="hover:bg-violet-50"/>
        <ConsultPanel title="타이어상담" emoji="🔘" items={cTire} moCount={cTireMo} bg="bg-amber-50" txt="text-amber-700" hoverBg="hover:bg-amber-50"/>
        <ConsultPanel title="기타상담" emoji="💬" items={cOther} moCount={cOtherMo} bg="bg-orange-50" txt="text-orange-700" hoverBg="hover:bg-orange-50"/>
      </div>

      <div className={`${CARD} py-2.5 px-3`}>
        <p className="text-xs text-gray-400 mb-1.5">💬 AI에게 직접 지시 — 현대건설기계 상태 변경, 상담 업데이트 등</p>
        <div className="flex gap-2 items-end">
          <textarea
            className={`${TA2} flex-1 min-h-[38px] max-h-24`} rows={1}
            placeholder="예: 정덕수 건 승인, 금리 3.5%, 한도 2억"
            value={chatInput}
            onChange={(e:any)=>setChatInput(e.target.value)}
            onKeyDown={(e:any)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();onTabChat();setTimeout(onSendChat,50);}}}
          />
          <button
            className={`${BTP} h-9 px-4 flex-shrink-0`}
            onClick={()=>{onTabChat();setTimeout(onSendChat,50);}}
            disabled={chatLoading||!chatInput.trim()}
          >전송</button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {["현황 요약","긴급 업무","현대건설기계 상태 변경"].map((c:string)=>(
            <button key={c} onClick={()=>{setChatInput(c==="현대건설기계 상태 변경"?c+" — ":c+" 알려줘");onTabChat();setTimeout(onSendChat,80);}}
              className="px-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-orange-300 hover:text-orange-500 bg-white transition-all">
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
// ─── 현대건설기계 상태 변경 확인 카드 ──────────────────────────────────────────
type HyundaiMatch = {id:number;customer_name:string;status:string;caseNo:string;equipment_ton:string|null;finance_company:string|null;customer_type:string;sales_rep:string|null;installment_principal:number|null};
type PendingHyundaiUpdate = {action:Record<string,unknown>;matches:HyundaiMatch[]};

const HCM_STS_CLR:Record<string,string> = {
  접수:"bg-gray-100 text-gray-600", 신용조회:"bg-blue-50 text-blue-700",
  승인:"bg-emerald-50 text-emerald-700", 보완:"bg-amber-50 text-amber-700",
  거절:"bg-red-50 text-red-600", 서류등록:"bg-violet-50 text-violet-700",
  전자계약발송:"bg-cyan-50 text-cyan-700", 확정:"bg-[#0f172a] text-white",
  보류:"bg-orange-50 text-orange-700",
};

function PendingHyundaiCard({phu,onConfirm,onReject}:{phu:PendingHyundaiUpdate[];onConfirm:(match:HyundaiMatch,action:Record<string,unknown>)=>void;onReject:(i:number)=>void}) {
  if (!phu?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {phu.map((p,idx)=>{
        const a   = p.action;
        const next = a.next_status as string;
        const patch = a.patch as Record<string,unknown>|undefined;
        return (
          <div key={idx} className="border border-blue-200 rounded-xl bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-700 mb-2">🏗 현대건설기계 상태 변경 확인</p>
            {/* 변경 내용 */}
            <div className="bg-white rounded-lg p-2.5 mb-2 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500">고객명</span>
                <span className="text-sm font-semibold text-[#0f172a]">{a.customer_name as string}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">변경 상태</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${HCM_STS_CLR[next]??"bg-gray-100 text-gray-600"}`}>{next}</span>
              </div>
              {patch && (
                <div className="mt-1.5 space-y-0.5">
                  {patch.nice_score!=null&&<p className="text-xs text-gray-600">NICE 점수: <span className="font-medium">{String(patch.nice_score)}</span></p>}
                  {patch.credit_rate!=null&&<p className="text-xs text-gray-600">금리: <span className="font-medium">{String(patch.credit_rate)}%</span></p>}
                  {patch.credit_incentive!=null&&<p className="text-xs text-gray-600">인센티브: <span className="font-medium">{String(patch.credit_incentive)}%</span></p>}
                  {patch.loan_limit!=null&&<p className="text-xs text-gray-600">한도: <span className="font-medium">{Number(patch.loan_limit).toLocaleString()}원</span></p>}
                  {patch.loan_period!=null&&<p className="text-xs text-gray-600">기간: <span className="font-medium">{String(patch.loan_period)}개월</span></p>}
                  {patch.credit_note!=null&&<p className="text-xs text-gray-600">사유: <span className="font-medium">{String(patch.credit_note)}</span></p>}
                  {patch.special_note!=null&&<p className="text-xs text-gray-600">메모: <span className="font-medium">{String(patch.special_note)}</span></p>}
                </div>
              )}
            </div>
            {/* 매칭 건 목록 */}
            {p.matches.length === 0 ? (
              <div className="bg-white rounded-lg p-2 mb-2 border border-red-200">
                <p className="text-xs text-red-600">❌ "{a.customer_name as string}" 건을 찾지 못했습니다</p>
              </div>
            ) : (
              <div className="space-y-1.5 mb-2">
                {p.matches.slice(0,3).map(m=>(
                  <div key={m.id} className="bg-white rounded-lg px-2.5 py-2 border border-blue-100 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#0f172a]">{m.caseNo}</span>
                        <span className="text-sm font-semibold text-[#0f172a]">{m.customer_name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${HCM_STS_CLR[m.status]??"bg-gray-100 text-gray-600"}`}>{m.status}</span>
                      </div>
                      <div className="flex gap-2 mt-0.5">
                        {m.equipment_ton&&<span className="text-xs text-gray-400">{m.equipment_ton}</span>}
                        {m.finance_company&&<span className="text-xs text-gray-400">{m.finance_company}</span>}
                        {m.installment_principal&&<span className="text-xs text-gray-400">{(m.installment_principal/10000).toFixed(0)}만원</span>}
                      </div>
                    </div>
                    <button className={BTE} onClick={()=>onConfirm(m,{...a,patch})}>이 건으로 →</button>
                  </div>
                ))}
              </div>
            )}
            <button className={BTG} onClick={()=>onReject(idx)}>취소</button>
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
  useEffect(()=>{ _setPopup=setPopup; return ()=>{ _setPopup=null; }; },[]);
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
    const gc = gcalMapRef.current.get(dt)??[];
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
          const gc=gcalMapRef.current.get(dt)??[];
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
const SecretaryPage:React.FC = () => {
  const {user,isAdmin,isSubAdmin,logout} = useAuth() as any;
  const navigate = useNavigate();
  if(!user||(!isAdmin&&!isSubAdmin))return <Navigate to="/" replace/>;

  const [tab,setTab] = useState<TabKey>("schedule");

  // 일정
  const [schedules,setSchedules]     = useState<Schedule[]>([]);
  const [schedLoading,setSchedLoading] = useState(false);
  const [schedDate,setSchedDate]     = useState(todayStr);
  const [showSchedForm,setShowSchedForm] = useState(false);
  const [schedModal,setSchedModal] = useState<{s:Schedule}|null>(null);
  const [schedProgress,setSchedProgress] = useState({memo:"",next_date:"",next_time:""});
  const [newSched,setNewSched] = useState({title:"",description:"",schedule_date:todayStr(),start_time:"",end_time:"",category:"meeting" as Schedule["category"],location:"",related_type:"",consultation_id:""});

  // 할일
  const [todos,setTodos]             = useState<Todo[]>([]);
  const [todoLoading,setTodoLoading] = useState(false);
  const [tdFilter,setTdFilter]       = useState<"active"|"all"|"done">("active");
  const [showTodoForm,setShowTodoForm] = useState(false);
  const [newTodo,setNewTodo] = useState({title:"",description:"",priority:"normal" as Todo["priority"],category:"",due_date:"",consultation_id:""});

  // 업무현황
  const [hyundaiTasks,setHyundaiTasks] = useState<HyundaiTask[]>([]);
  const [narumiTasks,setNarumiTasks]   = useState<NarumiTask[]>([]);
  const [statusLoading,setStatusLoading] = useState(false);

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

  // 채팅
  const [msgs,setMsgs]               = useState<ChatMsg[]>([]);
  const [histLoading,setHistLoading] = useState(true);
  const [chatInput,setChatInput]     = useState("");
  const [chatLoading,setChatLoading] = useState(false);
  const [autoSave,setAutoSave]       = useState(true);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 달력 데이터
  const [calSch,setCalSch] = useState<CalSch[]>([]);
  const [calTdo,setCalTdo] = useState<CalTdo[]>([]);
  // 현재 캘린더가 보고 있는 연/월 추적
  const [calViewYear,setCalViewYear]   = useState(new Date().getFullYear());
  const [calViewMonth,setCalViewMonth] = useState(new Date().getMonth());
  // 구글 캘린더
  const [gcalConnected,setGcalConnected] = useState(false);
  const [gcalEvents,setGcalEvents] = useState<{id:string;title:string;start:string;color?:string}[]>([]);

  // 통계
  const [stats,setStats] = useState({todaySch:0,activeTodo:0,urgentTodo:0,newOrders:0,todayFollowup:0,newConsult:0});

  // 토스트
  const [toast,setToast] = useState<{msg:string;type:"ok"|"err"}|null>(null);
  const showToast = (msg:string,type:"ok"|"err"="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

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
      supabase.from("secretary_schedules").select("id,title,schedule_date,start_time,category,is_done").gte("schedule_date",from).lte("schedule_date",to),
      supabase.from("secretary_todos").select("id,title,due_date,priority,is_done").gte("due_date",from).lte("due_date",to).eq("is_done",false),
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
      // 응답에서 생성된 이벤트를 즉시 gcalEvents 상태에 추가
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

  const loadStats = useCallback(async()=>{
    const [a,b,c,d,e,f] = await Promise.all([
      supabase.from("secretary_schedules").select("id",{count:"exact"}).eq("schedule_date",todayStr()).eq("is_done",false),
      supabase.from("secretary_todos").select("id",{count:"exact"}).eq("is_done",false),
      supabase.from("secretary_todos").select("id",{count:"exact"}).eq("is_done",false).eq("priority","urgent"),
      supabase.from("secretary_orders").select("id",{count:"exact"}).eq("status","new"),
      supabase.from("consultation_cases").select("id",{count:"exact"}).eq("followup_needed",true).eq("next_followup_date",todayStr()),
      supabase.from("consultation_cases").select("id",{count:"exact"}).gte("created_at",todayStr()+"T00:00:00").lte("created_at",todayStr()+"T23:59:59"),
    ]);
    setStats({todaySch:a.count??0,activeTodo:b.count??0,urgentTodo:c.count??0,newOrders:d.count??0,todayFollowup:e.count??0,newConsult:f.count??0});
  },[]);

  const loadChatHist = useCallback(async()=>{
    setHistLoading(true);
    // ascending:true 로 가져오면 DB 정렬 자체가 오래된순→최신순 → reverse() 불필요
    const {data} = await supabase.from("secretary_chat_logs").select("role,content,created_at").order("created_at",{ascending:true}).limit(200);
    const mapped = (data??[]).map(r=>({
      role:r.role as "user"|"assistant",
      content:r.content,
      ts:new Date(r.created_at).toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(". ","월 ").replace(". ","일 "),
    }));
    setMsgs(prev=>{
      // 이미 현재 세션에서 메시지가 쌓인 경우(새 전송 후 재로드 방지): DB 이력은 뒤에 합치지 않고 그대로 유지
      if(prev.length>0) return prev;
      return mapped;
    });
    setHistLoading(false);
    // 히스토리 로드 완료 후 맨 아래로 스크롤 (렌더링 완료 후 3단계)
    [50,200,500].forEach(ms=>setTimeout(()=>{
      const c = chatContainerRef.current;
      if(c) c.scrollTop = c.scrollHeight;
    }, ms));
  },[]);

  const loadSchedules = useCallback(async()=>{
    setSchedLoading(true);
    const d = new Date(schedDate); d.setDate(d.getDate()+1);
    const nextDay = d.toISOString().slice(0,10);
    // 선택 날짜 기준 일정 + 현대건설기계 미완료 팔로업(날짜 지나도 고정)
    const [r1, r2] = await Promise.all([
      supabase.from("secretary_schedules").select("*").gte("schedule_date",schedDate).lte("schedule_date",nextDay).order("schedule_date",{ascending:true}).order("start_time",{ascending:true}),
      supabase.from("secretary_schedules").select("*").eq("category","followup").eq("related_type","finance").eq("is_done",false).lt("schedule_date",schedDate),
    ]);
    const pinned = (r2.data ?? []) as Schedule[];
    const regular = (r1.data ?? []) as Schedule[];
    // 중복 제거 후 고정 항목 위에 표시
    const ids = new Set(regular.map(s=>s.id));
    const merged = [...pinned.filter(s=>!ids.has(s.id)), ...regular];
    setSchedules(merged);
    setSchedLoading(false);
  },[schedDate]);

  const loadTodos = useCallback(async()=>{
    setTodoLoading(true);
    let q = supabase.from("secretary_todos").select("*").order("priority").order("created_at",{ascending:false});
    if(tdFilter==="active")q=q.eq("is_done",false);
    if(tdFilter==="done")q=q.eq("is_done",true);
    const {data} = await q;
    if(data)setTodos(data as Todo[]);
    setTodoLoading(false);
  },[tdFilter]);

  const loadOrders = useCallback(async()=>{
    setOrderLoading(true);
    let q = supabase.from("secretary_orders").select("*").order("created_at",{ascending:false});
    if(ordFilter==="active")q=q.in("status",["new","pending","processing","forwarded","delivered","wheel_returned"]);
    if(ordFilter==="done")q=q.in("status",["done","invoiced"]);
    const {data} = await q;
    if(data)setOrders(data as Order[]);
    setOrderLoading(false);
  },[ordFilter]);

  const loadStatusData = useCallback(async()=>{
    setStatusLoading(true);
    const [hr,nr,cr,fdr] = await Promise.all([
      supabase.from("hyundaicm_tasks").select("id,customer_name,company_name,status,purchase_amount,finance_company,created_at,equipment_ton").order("created_at",{ascending:false}).limit(20),
      supabase.from("narumi_tasks").select("id,customer_name,memo,status,is_urgent,docs_ready,delivery_date,created_at,vin").order("created_at",{ascending:false}).limit(20),
      supabase.from("consultation_cases").select("id,customer_name,phone,telecom_provider,work_type,status,summary,followup_needed,next_followup_date,created_at").order("created_at",{ascending:false}).limit(50),
      supabase.from("consultation_finance_details").select("consultation_id,finance_stage"),
    ]);
    if(hr.data)setHyundaiTasks(hr.data as HyundaiTask[]);
    if(nr.data)setNarumiTasks(nr.data as NarumiTask[]);
    if(cr.data){
      const fdMap:Record<number,string|null> = {};
      if(fdr.data) fdr.data.forEach((f:any)=>{ fdMap[f.consultation_id]=f.finance_stage; });
      setRecentC(cr.data.map((c:any)=>({
        ...c,
        finance_stage: fdMap[c.id] ?? null,
      })) as Consult[]);
    }
    setStatusLoading(false);
  },[]);

  const loadConsults = useCallback(async()=>{
    setCLoading(true);
    const [fr,rr] = await Promise.all([
      supabase.from("consultation_cases").select("id,customer_name,phone,telecom_provider,work_type,status,summary,followup_needed,next_followup_date,created_at").eq("followup_needed",true).eq("next_followup_date",todayStr()).order("created_at",{ascending:false}).limit(10),
      supabase.from("consultation_cases").select("id,customer_name,phone,telecom_provider,work_type,status,summary,followup_needed,next_followup_date,created_at").order("created_at",{ascending:false}).limit(8),
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
        void loadChatHist();
        void loadCalData(calViewYear, calViewMonth);
        void checkGcalConnection();
      }
    });
    return ()=>subscription.unsubscribe();
  },[loadStats, loadChatHist, loadCalData]);
  const prevMsgLen = useRef(0);
  useEffect(()=>{
    if(msgs.length > 0 && msgs.length !== prevMsgLen.current){
      if(prevMsgLen.current > 0){
        // 채팅 컨테이너만 스크롤 (전체 페이지 스크롤 방지)
        const c = chatContainerRef.current;
        if(c) c.scrollTop = c.scrollHeight;
      }
      prevMsgLen.current = msgs.length;
    }
  },[msgs]);
  useEffect(()=>{
    if(tab==="schedule"){
      const today = todayStr();
      setSchedDate(today);
      setSchedLoading(true);
      Promise.all([
        supabase.from("secretary_schedules").select("*").gte("schedule_date",today).lte("schedule_date",(()=>{const d=new Date(today);d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);})()).order("schedule_date",{ascending:true}).order("start_time",{ascending:true}),
        supabase.from("secretary_todos").select("*").eq("is_done",false).order("priority").order("created_at",{ascending:false}),
      ]).then(([sr,tr])=>{
        if(sr.data) setSchedules(sr.data as Schedule[]);
        if(tr.data) setTodos(tr.data as Todo[]);
        setSchedLoading(false);
      });
    }
    if(tab==="status"){ void loadStatusData(); }
    if(tab==="chat"){ setTimeout(()=>{ const c=chatContainerRef.current; if(c)c.scrollTop=c.scrollHeight; },100); }
  },[tab, loadStatusData]);
  useEffect(()=>{if(tab==="orders"){void loadOrders();void loadConsults();}},[tab,loadOrders,loadConsults]);

  // ─── 일정 CRUD ──────────────────────────────────────────────────────────────
  async function addSchedule(){
    if(!newSched.title)return;
    if(newSched.category==="followup"&&newSched.consultation_id){
      await supabase.from("consultation_cases").update({next_followup_date:newSched.schedule_date,followup_needed:true}).eq("id",Number(newSched.consultation_id));
    }
    const {data:schedData,error}=await supabase.from("secretary_schedules").insert({
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
    await supabase.from("secretary_schedules").update({is_done:!done}).eq("id",id);
    setSchedules(p=>p.map(s=>s.id===id?{...s,is_done:!done}:s));
  }
  async function saveSchedProgress(s:Schedule){
    const today = new Date().toISOString().slice(0,10);
    const appendText = schedProgress.memo ? "["+today+"] "+schedProgress.memo : null;
    const newMemo = appendText ? (s.progress_memo ? s.progress_memo+"\n"+appendText : appendText) : s.progress_memo;
    const patch: Record<string,unknown> = { progress_memo: newMemo };
    if (schedProgress.next_date) {
      patch.next_schedule_date = schedProgress.next_date;
      patch.next_schedule_time = schedProgress.next_time || null;
      await supabase.from("secretary_schedules").insert({
        title: s.title,
        description: newMemo,
        schedule_date: schedProgress.next_date,
        start_time: schedProgress.next_time || null,
        category: s.category,
        location: s.location,
        related_type: s.related_type,
        consultation_id: s.consultation_id,
      });
    }
    await supabase.from("secretary_schedules").update(patch).eq("id",s.id);
    await loadSchedules();
    setSchedModal(null);
    setSchedProgress({memo:"",next_date:"",next_time:""});
    showToast("경과 저장 완료" + (schedProgress.next_date ? " + 다음 일정 등록" : ""));
    void loadCalData(calViewYear, calViewMonth);
  }

  async function delSched(id:number){
    await supabase.from("secretary_schedules").delete().eq("id",id);
    setSchedules(p=>p.filter(s=>s.id!==id)); void loadStats();
  }

  // ─── 할일 CRUD ──────────────────────────────────────────────────────────────
  async function addTodo(){
    if(!newTodo.title)return;
    const {error}=await supabase.from("secretary_todos").insert({
      title:newTodo.title,description:newTodo.description||null,priority:newTodo.priority,
      category:newTodo.category||null,due_date:newTodo.due_date||null,
      consultation_id:newTodo.consultation_id?Number(newTodo.consultation_id):null,
    });
    if(!error){showToast("할일 저장 완료");setShowTodoForm(false);setNewTodo({title:"",description:"",priority:"normal",category:"",due_date:"",consultation_id:""});void loadTodos();void loadStats();void loadCalData(calViewYear, calViewMonth);}
  }
  async function toggleTodo(id:number,done:boolean){
    await supabase.from("secretary_todos").update({is_done:!done,done_at:!done?new Date().toISOString():null}).eq("id",id);
    void loadTodos(); void loadStats();
  }
  async function delTodo(id:number){
    await supabase.from("secretary_todos").delete().eq("id",id);
    setTodos(p=>p.filter(t=>t.id!==id)); void loadStats();
  }

  // ─── 주문 CRUD ──────────────────────────────────────────────────────────────
  async function addOrder(){
    if(!newOrder.customer_name||!newOrder.summary)return;
    let cid:number|null=null;
    if(syncConsult&&newOrder.work_type){
      const wm:Record<string,string>={insurance:"registration_insurance",tire:"tire_sales",finance:"finance",forklift:"forklift_sales",battery:"battery_sales"};
      const {data:cd,error:ce}=await supabase.from("consultation_cases").insert({
        customer_name:newOrder.customer_name,phone:newOrder.phone||"미입력",telecom_provider:newOrder.telecom_provider||null,
        work_type:wm[newOrder.work_type]??newOrder.work_type,status:"new",
        summary:`[AI비서 ${newOrder.channel==="kakao"?"카카오":newOrder.channel} 접수] ${newOrder.summary}`,
        detail_memo:newOrder.detail||null,followup_needed:false,call_datetime:new Date().toISOString(),
      }).select("id").single();
      if(ce){showToast("상담관리 연동 실패","err");return;}
      if(cd)cid=cd.id;
    }
    const {error}=await supabase.from("secretary_orders").insert({
      customer_name:newOrder.customer_name,phone:newOrder.phone||null,channel:newOrder.channel,
      work_type:newOrder.work_type||null,summary:newOrder.summary,detail:newOrder.detail||null,status:"new",consultation_id:cid,
    });
    if(!error){
      showToast(cid?`주문 + 상담관리 등록 완료 (상담#${cid})`:"주문 등록 완료");
      setShowOrderForm(false);
      setNewOrder({customer_name:"",phone:"",channel:"kakao",work_type:"",summary:"",detail:"",telecom_provider:"",region:""});
      void loadOrders(); void loadStats();
    }
  }
  async function setOrderStatus(id:number,status:Order["status"]){
    await supabase.from("secretary_orders").update({status,...(status==="done"?{completed_at:new Date().toISOString()}:{})}).eq("id",id);
    const o=orders.find(x=>x.id===id);
    if(o?.consultation_id){
      const m:Record<string,string>={done:"completed",processing:"in_progress",new:"new",pending:"pending"};
      await supabase.from("consultation_cases").update({status:m[status]??status}).eq("id",o.consultation_id);
      showToast("상태 변경 + 상담관리 동기화");
    }
    void loadOrders(); void loadStats();
  }
  async function delOrder(id:number){
    await supabase.from("secretary_orders").delete().eq("id",id);
    setOrders(p=>p.filter(o=>o.id!==id)); void loadStats();
  }

  // ─── AI 채팅 ────────────────────────────────────────────────────────────────
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

  async function sendChat(){
    const text=chatInput.trim();
    if(!text||chatLoading)return;
    setChatInput("");
    const next:ChatMsg[]=[...msgsRef.current,{role:"user",content:text,ts:nowTs()}];
    setMsgs(next);
    setChatLoading(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secretary-ai`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({messages:next.map(m=>({role:m.role,content:m.content})),autoSave}),
      });
      const d=await res.json();
      const reply:string=d.reply??d.content?.[0]?.text??"응답을 받지 못했습니다.";
      const saved=d.saved??[], actions=d.actions??[], pendingUpdates=d.pendingUpdates??[], pendingHyundaiUpdates=d.pendingHyundaiUpdates??[];
      setMsgs(p=>[...p,{role:"assistant",content:reply,saved,actions,pendingUpdates,pendingHyundaiUpdates,ts:nowTs()}]);
      if(saved.length>0){
        void loadStats();
        if(saved.some((s:any)=>["schedule","schedule_edit","schedule_update"].includes(s.type))){
          void loadSchedules();
          void loadCalData(calViewYear, calViewMonth);
          if(gcalConnected){
            // 새로 생성된 일정만 구글 캘린더에 동기화 (schedule_edit/update는 기존 항목 수정이므로 skip)
            const schedIds = saved.filter((s:any)=>s.type==="schedule").map((s:any)=>s.id);
            for(const sid of schedIds){
              const {data:sd} = await supabase.from("secretary_schedules").select("*").eq("id",sid).single();
              if(sd) void syncToGcal({
                id:sd.id, title:sd.title, description:sd.description??null,
                schedule_date:sd.schedule_date, start_time:sd.start_time??null,
                end_time:sd.end_time??null, location:sd.location??null,
              });
            }
          }
        }
        if(saved.some((s:any)=>s.type==="todo"))  { void loadTodos();  void loadCalData(calViewYear, calViewMonth); }
        if(saved.some((s:any)=>s.type==="order"))   void loadOrders();
        if(saved.some((s:any)=>s.type==="order_update")) { void loadOrders(); void loadStats(); }
        const cc=saved.filter((s:any)=>s.consultation_id).length;
        showToast(`${saved.length}건 저장${cc>0?` + 상담관리 ${cc}건`:""}`);
      }
      if(pendingUpdates.length>0)showToast(`상담 업데이트 ${pendingUpdates.length}건 확인 필요`,"err");
      const hasUpdate = saved.some((s:any)=>["consult_update","narumi_update","hyundaicm_update","order_update"].includes(s.type));
      if(hasUpdate) setTimeout(()=>void loadStatusData(), 500);
      await supabase.from("secretary_chat_logs").insert([
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
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secretary-ai`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({messages:[{role:"user",content:"confirm_update"}],autoSave:false,confirmUpdate:{consultation_id:cid,update_memo:action.update_memo,update_summary:action.update_summary??null,update_status:action.update_status??null,direct_fields:action.direct_fields??null}}),
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

  // ─── 현대건설기계 상태 변경 확인 ──────────────────────────────────────────────
  async function confirmHyundaiUpdate(msgIdx:number,match:HyundaiMatch,action:Record<string,unknown>){
    setChatLoading(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const patch = {...(action.patch as Record<string,unknown>??{})};
      delete patch._prevStatus;
      const res=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secretary-ai`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({
          messages:[{role:"user",content:"confirm_hyundai_update"}],
          autoSave:false,
          confirmHyundaiUpdate:{
            task_id:match.id, next_status:action.next_status,
            patch,
            caseNo:match.caseNo, customerName:match.customer_name,
            customerType:match.customer_type, equipmentTon:match.equipment_ton,
            financeCompany:match.finance_company, salesRep:match.sales_rep,
            installmentPrincipal:match.installment_principal,
          },
        }),
      });
      const d=await res.json();
      setMsgs(p=>p.map((m,i)=>i!==msgIdx?m:{...m,pendingHyundaiUpdates:[],saved:[...(m.saved??[]),...(d.saved??[])]}));
      showToast(`${match.customer_name} → ${action.next_status as string} 변경 + 카카오 알림 발송`);
      if(tab==="status") void loadStatusData();
    }catch{showToast("현대건설기계 업데이트 실패","err");}
    setChatLoading(false);
  }
  function rejectHyundaiUpdate(msgIdx:number,uidx:number){
    setMsgs(p=>p.map((m,i)=>i!==msgIdx?m:{...m,pendingHyundaiUpdates:(m.pendingHyundaiUpdates??[]).filter((_,j)=>j!==uidx)}));
  }

  // 푸터 숨기기
  useEffect(()=>{
    const footer = document.querySelector('footer') as HTMLElement|null;
    if(footer) footer.style.display='none';
    return ()=>{ if(footer) footer.style.display=''; };
  },[]);

  // ─── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-gray-50">
      <CalPopupPortal/>

      {/* 일정 경과 기록 모달 */}
      {schedModal&&ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/40 px-4" onClick={()=>setSchedModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-semibold text-[#0f172a]">📝 일정 경과 기록</p>
              <button className="text-gray-400 hover:text-gray-600 text-lg" onClick={()=>setSchedModal(null)}>✕</button>
            </div>
            <div className="mb-3">
              <p className="text-sm font-medium text-[#0f172a]">{schedModal.s.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmtDate(schedModal.s.schedule_date)} {schedModal.s.start_time?fmtTime(schedModal.s.start_time):""} · {CAT_LBL[schedModal.s.category]}</p>
            </div>
            {schedModal.s.progress_memo&&(
              <div className="mb-3 bg-gray-50 rounded-xl p-3 max-h-32 overflow-y-auto">
                <p className="text-xs text-gray-500 mb-1 font-medium">이전 경과</p>
                {schedModal.s.progress_memo.split("\n").map((line,i)=>(
                  <p key={i} className="text-xs text-gray-600">{line}</p>
                ))}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className={LBL}>오늘 경과 메모</label>
                <textarea className={TA2} rows={3} placeholder="미팅 결과, 협의 내용, 다음 액션 등..."
                  value={schedProgress.memo} onChange={e=>setSchedProgress(p=>({...p,memo:e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LBL}>다음 일정 날짜</label>
                  <input type="date" className={CTRL} value={schedProgress.next_date} onChange={e=>setSchedProgress(p=>({...p,next_date:e.target.value}))}/>
                </div>
                <div>
                  <label className={LBL}>다음 일정 시간</label>
                  <input type="time" className={CTRL} value={schedProgress.next_time} onChange={e=>setSchedProgress(p=>({...p,next_time:e.target.value}))}/>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className={BTP} onClick={()=>void saveSchedProgress(schedModal.s)} disabled={!schedProgress.memo&&!schedProgress.next_date}>
                {schedProgress.next_date?"저장 + 다음 일정 등록":"경과 저장"}
              </button>
              <button className={BTS} onClick={()=>{quickChat(`"${schedModal.s.title}" 일정 경과 정리해줘. 메모: ${schedProgress.memo}`);setSchedModal(null);}}>AI 정리</button>
              <button className={BTS} onClick={()=>setSchedModal(null)}>닫기</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 토스트 */}
      {toast&&ReactDOM.createPortal(
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[99998] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white ${toast.type==="ok"?"bg-emerald-600":"bg-red-500"}`}>
          {toast.type==="ok"?"✅":"⚠️"} {toast.msg}
        </div>,
        document.body
      )}

      {/* 헤더 - PageHeader(64px) 바로 아래 sticky */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0 fixed top-16 md:top-20 left-0 right-0 z-[200] shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#0f172a] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
            <div>
              <h1 className="text-sm font-bold text-[#0f172a]">AI 비서</h1>
              <p className="text-xs text-gray-400">두서없이 말씀하시면 자동 저장 · 상담관리 연동</p>
            </div>
            <button
              onClick={()=>void logout()}
              className="ml-2 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
            >
              로그아웃
            </button>
          </div>
          {/* 통계 배지 */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">📅 {stats.todaySch}</span>
            <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 font-medium">✅ {stats.activeTodo}</span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">📦 {stats.newOrders}</span>
            {stats.todayFollowup>0&&<span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 font-medium">📞 사후관리 {stats.todayFollowup}</span>}
            {stats.newConsult>0&&<span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">💬 오늘상담 {stats.newConsult}</span>}
          </div>
          {/* 탭 - 항상 보이도록 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["chat","schedule","status","orders"] as TabKey[]).map(t=>(
              <button key={t} className={`${TB} ${tab===t?TA:TI}`} onClick={()=>setTab(t)}>
                {{chat:"💬 채팅",schedule:"📅 일정",status:"📊 업무현황",orders:"📦 주문·상담"}[t]}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* fixed 헤더 높이만큼 spacer */}
      <div className="h-[56px] flex-shrink-0"/>
      {/* 바디 */}
      <div className="flex max-w-6xl w-full mx-auto px-6 py-4 gap-5" style={{minHeight:600}}>

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
            <button onClick={()=>navigate("/work/call-management")} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl border border-gray-200 text-xs text-[#0f172a] font-semibold hover:bg-gray-50 transition-all">📋 상담관리</button>
            <button onClick={()=>navigate("/work/dashboard")} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all">📊 대시보드</button>
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
              <div>
                <p className="text-[10px] text-emerald-600 mb-1.5">✅ 연동됨 — 일정 자동 동기화 중</p>
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
                <input type="date" className={`${CTRL} w-36`} value={schedDate} onChange={e=>setSchedDate(e.target.value)}/>
                <button className={BTS} onClick={()=>void loadSchedules()}>새로고침</button>
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
                        <option value="">선택 안함</option><option value="insurance">보험</option><option value="tire">타이어</option><option value="finance">금융</option><option value="forklift">지게차</option><option value="battery">배터리</option>
                      </select>
                    </div>
                    <div className="col-span-2"><label className={LBL}>🔗 상담 ID (사후관리 시 next_followup_date 자동 업데이트)</label><input className={CTRL} value={newSched.consultation_id} onChange={e=>setNewSched(p=>({...p,consultation_id:e.target.value.replace(/\D/g,"")}))} placeholder="숫자만"/></div>
                    <div className="col-span-2"><label className={LBL}>메모</label><textarea className={TA2} rows={2} value={newSched.description} onChange={e=>setNewSched(p=>({...p,description:e.target.value}))}/></div>
                  </div>
                  <div className="flex gap-2"><button className={BTP} onClick={()=>void addSchedule()}>저장</button><button className={BTS} onClick={()=>setShowSchedForm(false)}>취소</button></div>
                </div>
              )}
              {schedLoading?<p className="text-sm text-gray-400 p-4">불러오는 중...</p>
                :schedules.length===0?<div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>{fmtDate(schedDate)} 일정이 없습니다</div>
                :schedules.map(s=>(
                  <div key={s.id} className={`${CARD} p-4 flex items-start gap-3 cursor-pointer hover:bg-blue-50 transition-all ${s.is_done?"opacity-60":""}`}
                    onClick={()=>{setSchedModal({s});setSchedProgress({memo:"",next_date:"",next_time:""});}}>
                    <CatDot c={s.category}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {s.schedule_date<schedDate&&<span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium flex-shrink-0">📌 기한초과</span>}
                        {s.schedule_date>schedDate&&<span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium flex-shrink-0">내일</span>}
                        <span className={`text-sm font-semibold text-[#0f172a] ${s.is_done?"line-through":""}`}>{s.title}</span>
                        <span className="text-xs text-gray-400">{CAT_LBL[s.category]}</span>
                        {s.related_type&&<span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{WL[s.related_type]??s.related_type}</span>}
                        <span onClick={e=>e.stopPropagation()}><LinkBadge id={s.consultation_id} onClick={()=>navigate(`/work/call-management?id=${s.consultation_id}`)}/></span>
                        {s.next_schedule_date&&<span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">다음: {fmtDate(s.next_schedule_date)}</span>}
                      </div>
                      {(s.start_time||s.location)&&<p className="text-xs text-gray-400 mt-0.5">{[s.start_time?fmtTime(s.start_time):null,s.location].filter(Boolean).join(" · ")}</p>}
                      {s.description&&<p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                      {s.progress_memo&&<p className="text-xs text-blue-500 mt-1 line-clamp-1">📝 {s.progress_memo.split("\n").slice(-1)[0]}</p>}
                    </div>
                    <button className="text-xs text-red-400 hover:text-red-600 px-1 flex-shrink-0" onClick={e=>{e.stopPropagation();void delSched(s.id);}}>삭제</button>
                  </div>
                ))
              }
              {/* 당일 마감 할일 */}
              {(()=>{
                const tomorrow2 = (()=>{const d=new Date(schedDate);d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);})();
                const dueTodos = todos.filter(t=>(t.due_date===schedDate||t.due_date===tomorrow2)&&!t.is_done);
                if(dueTodos.length===0) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold text-blue-500 px-1 mb-2 mt-1">✅ 오늘·내일 마감 할일 — {dueTodos.length}건</p>
                    {dueTodos.map(t=>(
                      <div key={t.id} className={`${CARD} p-3.5 flex items-center gap-3 border-l-4 border-blue-400`}>
                        <button className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${t.is_done?"bg-emerald-500 border-emerald-500":"border-gray-300 hover:border-blue-400"}`}
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

          {/* ══ 업무현황 ══ */}
          {tab==="status"&&(
            <StatusTabContent
              hyundaiTasks={hyundaiTasks}
              narumiTasks={narumiTasks}
              recentC={recentC}
              statusLoading={statusLoading}

              chatInput={chatInput}
              chatLoading={chatLoading}
              setChatInput={setChatInput}
              onRefresh={()=>void loadStatusData()}
              onNavigate={navigate}
              onSendChat={()=>{setTab("chat");setTimeout(()=>void sendChat(),50);}}
              onTabChat={()=>setTab("chat")}
              BTS={BTS} BTG={BTG} BTP={BTP} TA2={TA2} CARD={CARD} md2html={md2html} fmtDate={fmtDate}
            />
          )}

          {/* ══ 주문·상담 ══ */}
          {tab==="orders"&&(
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
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100 cursor-pointer hover:bg-purple-100 transition-all" onClick={()=>navigate(`/work/call-management?id=${c.id}`)}>
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

                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 최근 상담 */}
              <div className={`${CARD} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#0f172a]">💬 최근 상담</p>
                  <div className="flex gap-2">
                    <button className={BTG} onClick={()=>void loadConsults()}>새로고침</button>
                    <button className={BTG} onClick={()=>navigate("/work/call-management")}>전체 보기 →</button>
                  </div>
                </div>
                {cLoading?<p className="text-xs text-gray-400">불러오는 중...</p>
                  :recentC.length===0?<p className="text-sm text-gray-400 text-center py-4">최근 상담이 없습니다</p>
                  :(
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead><tr className="border-b border-gray-100">
                          {["고객명","업무","요약","상태","등록일",""].map(h=><th key={h} className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {recentC.map(c=>(
                            <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={()=>navigate(`/work/call-management?id=${c.id}`)}>
                              <td className="py-1.5 px-2 font-medium text-[#0f172a] whitespace-nowrap">{c.customer_name}</td>
                              <td className="py-1.5 px-2 whitespace-nowrap"><span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{WL[c.work_type]??c.work_type}</span></td>
                              <td className="py-1.5 px-2 text-gray-600 max-w-[160px] truncate">{c.summary}</td>
                              <td className="py-1.5 px-2 whitespace-nowrap"><StsBadge s={c.status}/></td>
                              <td className="py-1.5 px-2 text-xs text-gray-400 whitespace-nowrap">{fmtDT(c.created_at)}</td>
                              <td className="py-1.5 px-2">
                                <button className={BTG} onClick={e=>{e.stopPropagation();quickChat(`"${c.customer_name}" ${WL[c.work_type]??""} 후속 조치: ${c.summary}`);}}>AI</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </div>
              {/* 카카오·주문 */}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <p className="text-sm font-semibold text-[#0f172a]">📦 카카오·기타 주문</p>
                  <div className="flex gap-1.5 ml-auto flex-wrap">
                    {(["active","all","done"] as const).map(f=>(
                      <button key={f} className={`${TB} text-xs py-1 px-2.5 ${ordFilter===f?TA:TI}`} onClick={()=>setOrdFilter(f)}>{{active:"진행중",all:"전체",done:"완료"}[f]}</button>
                    ))}
                    <button className={BTP} onClick={()=>setShowOrderForm(v=>!v)}>{showOrderForm?"닫기":"+ 등록"}</button>
                  </div>
                </div>
                {showOrderForm&&(
                  <div className={`${CARD} p-4 mb-3`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-[#0f172a]">새 주문/문의 등록</p>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <div className={`w-9 h-5 rounded-full transition-colors relative ${syncConsult?"bg-emerald-500":"bg-gray-300"}`} onClick={()=>setSyncConsult(v=>!v)}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${syncConsult?"translate-x-4":"translate-x-0.5"}`}/>
                        </div>
                        <span className="text-xs text-gray-600">{syncConsult?"🔗 상담관리 자동등록":"연동 OFF"}</span>
                      </label>
                    </div>
                    {syncConsult&&<div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">✅ consultation_cases에도 자동 등록됩니다</div>}
                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                      <div><label className={LBL}>고객명 *</label><input className={CTRL} value={newOrder.customer_name} onChange={e=>setNewOrder(p=>({...p,customer_name:e.target.value}))} placeholder="고객명"/></div>
                      <div><label className={LBL}>연락처</label><input className={CTRL} value={newOrder.phone} onChange={e=>setNewOrder(p=>({...p,phone:e.target.value}))} placeholder="010-0000-0000"/></div>
                      <div><label className={LBL}>채널</label>
                        <select className={CTRL} value={newOrder.channel} onChange={e=>setNewOrder(p=>({...p,channel:e.target.value as any}))}>
                          <option value="kakao">카카오톡</option><option value="phone">전화</option><option value="visit">방문</option><option value="web">홈페이지</option>
                        </select>
                      </div>
                      <div><label className={LBL}>업무 유형</label>
                        <select className={CTRL} value={newOrder.work_type} onChange={e=>setNewOrder(p=>({...p,work_type:e.target.value}))}>
                          <option value="">선택</option><option value="insurance">보험</option><option value="tire">타이어</option><option value="finance">금융</option><option value="forklift">지게차</option><option value="battery">배터리</option>
                        </select>
                      </div>
                      {syncConsult&&<>
                        <div><label className={LBL}>통신사</label><input className={CTRL} value={newOrder.telecom_provider} onChange={e=>setNewOrder(p=>({...p,telecom_provider:e.target.value}))} placeholder="SKT/KT/LG"/></div>
                        <div><label className={LBL}>지역</label><input className={CTRL} value={newOrder.region} onChange={e=>setNewOrder(p=>({...p,region:e.target.value}))} placeholder="지역"/></div>
                      </>}
                      <div className="col-span-2"><label className={LBL}>요약 *</label><input className={CTRL} value={newOrder.summary} onChange={e=>setNewOrder(p=>({...p,summary:e.target.value}))} placeholder="문의/주문 내용 요약"/></div>
                      <div className="col-span-2"><label className={LBL}>상세</label><textarea className={TA2} rows={2} value={newOrder.detail} onChange={e=>setNewOrder(p=>({...p,detail:e.target.value}))}/></div>
                    </div>
                    <div className="flex gap-2"><button className={BTP} onClick={()=>void addOrder()}>저장{syncConsult?" + 상담관리":""}</button><button className={BTS} onClick={()=>setShowOrderForm(false)}>취소</button></div>
                  </div>
                )}
                {orderLoading?<p className="text-sm text-gray-400 p-4">불러오는 중...</p>
                  :orders.length===0?<div className={`${CARD} p-6 text-center text-gray-400 text-sm`}>주문/문의가 없습니다</div>
                  :(
                    <div className="space-y-2">
                      {orders.map(o=>(
                        <div key={o.id} className={`${CARD} p-4`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${o.channel==="kakao"?"bg-yellow-100":"bg-gray-100"}`}>
                              {{kakao:"💬",phone:"📞",visit:"🏢",web:"🌐"}[o.channel]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-[#0f172a]">{o.customer_name}</span>
                                {o.work_type&&<span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{WL[o.work_type]}</span>}
                                <StsBadge s={o.status}/>
                                {o.phone&&<a href={`tel:${o.phone.replace(/-/g,"")}`} className="text-xs text-orange-500 hover:underline">{o.phone}</a>}
                                <LinkBadge id={o.consultation_id} onClick={()=>navigate(`/work/call-management?id=${o.consultation_id}`)}/>
                              </div>
                              <p className="text-sm text-gray-700 mt-0.5">{o.summary}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{fmtDT(o.created_at)}</p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                              {(o.status==="new"||o.status==="pending"||o.status==="processing")&&<>
                                {o.status==="new"&&<button className={BTO} onClick={()=>void setOrderStatus(o.id,"processing")}>처리중</button>}
                                <button className={BTE} onClick={()=>void setOrderStatus(o.id,"done")}>완료</button>
                              </>}
                              {o.status==="forwarded"&&<button className={BTE} onClick={()=>quickChat(`"${o.customer_name}" 납품 완료`)}>납품완료</button>}
                              {o.status==="delivered"&&<button className={BTE} onClick={()=>quickChat(`"${o.customer_name}" 휠 반납 완료`)}>휠반납</button>}
                              {o.status==="wheel_returned"&&<button className={BTE} onClick={()=>quickChat(`"${o.customer_name}" 계산서 발행 완료`)}>계산서발행</button>}
                              <button className={BTG} onClick={()=>setExpandedOrder(expandedOrder===o.id?null:o.id)}>{expandedOrder===o.id?"접기":"상세"}</button>
                              <button className={BTG} onClick={()=>quickChat(`"${o.customer_name}" ${WL[o.work_type??""]??""} 문의 처리: ${o.summary}`)}>AI</button>
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

          {/* ══ AI 채팅 ══ */}
          {tab==="chat"&&(
            <div className={`${CARD} p-4`} style={{height:520,display:"flex",flexDirection:"column"}}>
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
                      {m.role==="assistant"&&m.pendingHyundaiUpdates&&m.pendingHyundaiUpdates.length>0&&(
                        <PendingHyundaiCard phu={m.pendingHyundaiUpdates} onConfirm={(match,a)=>void confirmHyundaiUpdate(i,match,a)} onReject={(ui)=>rejectHyundaiUpdate(i,ui)}/>
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

          {/* ══ 입력창 (항상 하단 고정) ══ */}
          <div className="flex-shrink-0 pt-2">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {["오늘 현황 요약","긴급 업무","오늘 사후관리","방금 통화 저장","미팅 메모 정리"].map(c=>(
                <button key={c} onClick={()=>quickChat(c.includes("저장")||c.includes("정리")?c+". ":c+" 알려줘")}
                  className="px-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-orange-300 hover:text-orange-500 bg-white transition-all">
                  {c}
                </button>
              ))}
            </div>
            <div className={`${CARD} py-2.5 px-3`}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-400">두서없이 말씀하시면 AI가 자동 분류·저장합니다</p>
                <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${autoSave?"bg-emerald-500":"bg-gray-300"}`} onClick={()=>setAutoSave(v=>!v)}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${autoSave?"translate-x-4":"translate-x-0.5"}`}/>
                  </div>
                  <span className="text-xs text-gray-500">{autoSave?"자동저장 ON":"OFF"}</span>
                </label>
              </div>
              <div className="flex gap-2 items-end">
                <textarea ref={chatInputRef} className={`${TA2} flex-1 min-h-[38px] max-h-24`} rows={1}
                  placeholder="할일, 일정, 고객 문의... 자동 저장됩니다"
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

export default SecretaryPage;