import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus as FhPlus, Search as FhSearch, Check as FhCheck, X as FhX, Pencil as FhPencil, Trash2 as FhTrash2, Loader2 as FhLoader2, PackageCheck as FhPackageCheck, AlertCircle as FhAlertCircle, Upload as FhUpload, FileText as FhFileText, Link2 as FhLink2, FileSpreadsheet as FhFileSpreadsheet } from "lucide-react";
import ReactDOM from "react-dom";
import html2canvas from "html2canvas";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type TabKey = "chat"|"schedule"|"status"|"orders"|"hyundaicm"|"taesan"|"finance"|"narumi"|"jinheung"|"email"|"memo"|"financehub"|"exportshop"|"quotation"|"statement";
type EmailReport = {
  id:number; created_at:string; report_date:string;
  title:string; content:string; source:string; is_read:boolean;
};
type Schedule = {
  id:number; title:string; description:string|null; schedule_date:string;
  progress_memo:string|null; next_schedule_date:string|null; next_schedule_time:string|null;
  start_time:string|null; end_time:string|null;
  category:"meeting"|"call"|"task"|"followup";
  location:string|null; related_type:string|null; is_done:boolean; consultation_id:number|null;
  progress_stage?:string|null; // consultation 진행단계 (로컬 보강) + secretary_schedules DB 컬럼
  work_type?:string|null;      // consultation work_type (로컬 보강) + secretary_schedules DB 컬럼
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
// 주문내역: consultation_cases 기반 통합 뷰
type OrderView = {
  id: number;                  // consultation_cases.id
  customer_name: string;
  work_type: string;
  status: string;              // consultation_cases.status
  summary: string;
  created_at: string;
  phone: string | null;
  // 진행단계
  progress_stage: string | null; // tire/forklift/battery: process_status/forklift_status/battery_status, finance: finance_stage
  // 제품 정보 (detail 테이블에서)
  product_detail: string | null; // 타이어규격, 배터리전압, 지게차톤수 등
  sub_type: string | null;
  secretary_order_id: number | null;
  secretary_order_status: string | null;
};
type Consult = {
  id:number; customer_name:string; phone:string; telecom_provider:string|null;
  work_type:string; status:string; summary:string;
  followup_needed:boolean; next_followup_date:string|null; created_at:string;
  finance_stage?:string|null;
  process_stage?:string|null;
};
type HyundaiTask = {
  id:number; customer_name:string; company_name:string|null;
  status:string|null; purchase_amount:number|null; finance_company:string|null;
  created_at:string; equipment_ton:string|null;
};
type TaesanTask = {
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
type Memo = {
  id: number;
  memo_date: string;
  title: string | null;
  content: string;
  category: "meeting"|"call"|"visit"|"note";
  related_name: string | null;
  consultation_id: number | null;
  created_at: string;
};

type ChatMsg = {
  role:"user"|"assistant"; content:string;
  ts?:string;
  saved?:{type:string;id:number;consultation_id?:number}[];
  actions?:Record<string,unknown>[];
  pendingUpdates?:PendingUpdate[];
  pendingHyundaiUpdates?:PendingHyundaiUpdate[];
};

// ─── FinanceHub 타입 ──────────────────────────────────────────────────────────
type FH_SalesRecord = {
  id: number; sale_date: string; customer_name: string; business_no: string | null;
  category: string; trade_type: string; maker: string | null; spec: string | null;
  quantity: number; unit_price: number; unit_cost: number;
  total_revenue: number; total_cost: number; margin: number;
  tax_invoice: boolean; payment_confirmed: boolean; payment_date: string | null;
  delivery_date: string | null; delivery_confirmed: boolean;
  wheel_returned: boolean; closing: boolean; note: string | null;
  invoice_id: number | null; is_confirmed: boolean;
};
type FH_PurchaseRecord = {
  id: number; purchase_date: string; supplier_name: string; business_no: string | null;
  category: string; trade_type: string; maker: string | null; spec: string | null;
  quantity: number; unit_price: number; total_cost: number;
  tax_invoice: boolean; payment_confirmed: boolean; payment_date: string | null;
  invoice_id: number | null; note: string | null; is_confirmed: boolean;
};
type FH_Customer = { id: string; name: string; business_no: string | null; };
type FH_SalesFormData = {
  sale_date: string; customer_name: string; business_no: string;
  category: string; trade_type: "내수" | "수출"; maker: string; spec: string;
  quantity: string; unit_price: string; unit_cost: string;
  tax_invoice: boolean; payment_confirmed: boolean; payment_date: string;
  delivery_date: string; delivery_confirmed: boolean;
  wheel_returned: boolean; closing: boolean; note: string;
};
type FH_PurchaseFormData = {
  purchase_date: string; supplier_name: string; business_no: string;
  category: string; trade_type: "국내" | "수입"; maker: string; spec: string;
  quantity: string; unit_price: string;
  tax_invoice: boolean; payment_confirmed: boolean; payment_date: string; note: string;
};
type FH_ParsedInvoice = {
  invoice_no?: string | null; sale_date?: string | null;
  customer_name?: string | null; business_no?: string | null;
  supply_amount?: number | null; tax_amount?: number | null;
  total_amount?: number | null; items?: string | null;
};
type FH_InvoiceForm = {
  invoice_no: string; issue_date: string; customer_name: string;
  business_no: string; supply_amount: string; tax_amount: string;
  total_amount: string; items: string;
};
type FH_Period = "월간" | "분기" | "반기" | "연간";


// ─── 상수 ─────────────────────────────────────────────────────────────────────
const WL:Record<string,string> = {
  insurance:"보험",tire:"타이어",finance:"금융",forklift:"지게차",battery:"배터리",
  registration_insurance:"보험",tire_sales:"타이어",forklift_sales:"지게차",battery_sales:"배터리",
  finance_hcm:"현대CM금융",narumi:"나르미",
};
const CAT_LBL:Record<string,string> = {meeting:"미팅",call:"통화",task:"업무",followup:"사후관리"};
const STS_LBL:Record<string,string> = {new:"신규",pending:"대기",processing:"진행중",done:"완료",in_progress:"진행중",completed:"완료",closed:"종결",waiting_customer:"고객대기",on_hold:"보류",forwarded:"진흥전달",delivered:"납품완료",wheel_returned:"휠반납",invoiced:"계산서발행",confirmed:"확정",approved:"승인",rejected:"거절",supplement:"보완",credit_check:"신용조회",received:"접수",cancelled:"취소",registered:"등록완료",docs:"서류준비",insurance:"보험확인",
  // 보험 단계
  design_request:"접수(설계요청)", design_requested:"접수(설계요청)", policy_issued:"완료(증권발급)",
  // 레거시 완결 → 계산서발행
  completed_order:"계산서발행",
  // 레거시 상담/견적 단계
  consulting:"계약", quote:"계약", quote_submitted:"신용조회", documents_requested:"서류등록"};
const PRI_LBL:Record<string,string> = {urgent:"긴급",normal:"일반",low:"낮음"};
const ACT_LBL:Record<string,string> = {todo:"✅ 할일",schedule:"📅 일정",order:"📦 주문",consult_update:"🔄 상담 업데이트",hyundaicm_update:"🏗 현대건설기계 변경",narumi_update:"🚛 나르미 단계 변경",schedule_update:"📅 일정 업데이트",schedule_edit:"✏️ 일정 수정",order_update:"📦 주문 상태 변경",memo:"📝 메모 저장",todo_edit:"✏️ 할일 수정"};
const CAT_CLR:Record<string,string> = {meeting:"#60a5fa",call:"#fb923c",followup:"#c084fc",task:"#34d399"};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
const todayStr = () => { const d=new Date(); d.setHours(d.getHours()+9); return d.toISOString().slice(0,10); };
const nowTimeStr = () => { const d=new Date(); d.setHours(d.getHours()+9); d.setMinutes(Math.round(d.getMinutes()/10)*10); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const nowTs = () => new Date().toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(". ","월 ").replace(". ","일 ");
const pad2 = (n:number) => String(n).padStart(2,"0");
const fmtDate = (d:string) => { const dt=new Date(d+(d.includes("T")?"":"T00:00:00")); return `${dt.getMonth()+1}월 ${dt.getDate()}일`; };
const fmtDT = (d:string) => new Date(d).toLocaleDateString("ko-KR",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtTime = (t:string|null) => t?t.slice(0,5):"";
const md2html = (s:string) => s.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\[(.*?)\]/g,'<span style="color:#f97316;font-weight:600">[$1]</span>').replace(/\n/g,"<br/>");

// ─── 스타일 ───────────────────────────────────────────────────────────────────
const TB  = "px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all";
const TA  = "bg-[#0f172a] text-white border-[#0f172a]";
const TI  = "bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-200";
const CARD = "border border-gray-200 rounded-2xl bg-white shadow-sm";
const LBL = "block text-xs font-medium text-gray-500 mb-1";
const CTRL = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 transition-all";
const TA2  = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0f172a] bg-white resize-none focus:outline-none focus:border-orange-400 transition-all";
const BTP = "px-3 py-1.5 rounded-xl bg-[#0f172a] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40";
const BTS = "px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-gray-300 transition-all";
const BTO = "px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-all";
const BTG = "px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-gray-300 transition-all";
const BTE = "px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all";


// ─── FinanceHub 상수/유틸 ────────────────────────────────────────────────────
const FH_CATEGORIES = ["타이어","렌탈","지게차렌탈","건설기계수출","배터리(LFP)","배터리(납산)","기타판매","기타"];
const FH_CAT_COLOR:Record<string,string> = {
  "타이어":"bg-blue-100 text-blue-700","렌탈":"bg-orange-100 text-orange-700","지게차렌탈":"bg-purple-100 text-purple-700",
  "건설기계수출":"bg-amber-100 text-amber-700","배터리(LFP)":"bg-emerald-100 text-emerald-700",
  "배터리(납산)":"bg-teal-100 text-teal-700","기타판매":"bg-indigo-100 text-indigo-700",
  "기타":"bg-gray-100 text-gray-600",
};
const FH_PERIODS = ["월간","분기","반기","연간"] as const;
const FH_EMPTY_SALES:FH_SalesFormData = {
  sale_date:new Date().toISOString().split("T")[0],customer_name:"",business_no:"",
  category:"타이어",trade_type:"내수",maker:"",spec:"",quantity:"",unit_price:"",unit_cost:"",
  tax_invoice:false,payment_confirmed:false,payment_date:"",
  delivery_date:"",delivery_confirmed:false,wheel_returned:false,closing:false,note:"",
};
const FH_EMPTY_PURCHASE:FH_PurchaseFormData = {
  purchase_date:new Date().toISOString().split("T")[0],supplier_name:"",business_no:"",
  category:"기타",trade_type:"국내",maker:"",spec:"",quantity:"1",unit_price:"",
  tax_invoice:true,payment_confirmed:false,payment_date:"",note:"",
};
const FH_EMPTY_INV:FH_InvoiceForm = {
  invoice_no:"",issue_date:new Date().toISOString().split("T")[0],
  customer_name:"",business_no:"",supply_amount:"",tax_amount:"",total_amount:"",items:"",
};
const fhFmt = (v:number) => `${Math.round(v||0).toLocaleString("ko-KR")}원`;
const fhFmtAbs = (v:number) => `${Math.round(Math.abs(v||0)).toLocaleString("ko-KR")}원`;
function fhGuessCategory(spec:string):string {
  const s=spec.toLowerCase();
  if(/타이어|tyre|tire|솔리드|우레탄|튜브|휠|림/.test(s)) return "타이어";
  if(/배터리|battery|lfp|리튬|납산|agm|충전기/.test(s)){if(/납산|agm/.test(s))return "배터리(납산)";return "배터리(LFP)";}
  if(/지게차|forklift|리프트|마스트|포크/.test(s)) return "지게차렌탈";
  if(/굴삭기|굴착기|excavator|크레인|건설기계|덤프|로더/.test(s)) return "건설기계수출";
  if(/렌탈|리스|임대|월사용료|월납|관리비|수수료/.test(s)) return "렌탈";
  return "기타";
}
function fhFileToBase64(file:File):Promise<string>{
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res((r.result as string).split(",")[1]||"");r.onerror=()=>rej(new Error("파일 읽기 실패"));r.readAsDataURL(file);});
}
function fhGetDateRange(year:number,month:number,period:FH_Period){
  const pad=(n:number)=>String(n).padStart(2,"0");
  if(period==="월간"){const from=`${year}-${pad(month)}-01`;const to=new Date(year,month,0).toISOString().split("T")[0];return{from,to};}
  if(period==="분기"){const q=Math.ceil(month/3);const fm=(q-1)*3+1;const tm=q*3;return{from:`${year}-${pad(fm)}-01`,to:new Date(year,tm,0).toISOString().split("T")[0]};}
  if(period==="반기"){const h=month<=6?1:2;const fm=h===1?1:7;const tm=h===1?6:12;return{from:`${year}-${pad(fm)}-01`,to:new Date(year,tm,0).toISOString().split("T")[0]};}
  return{from:`${year}-01-01`,to:`${year}-12-31`};
}

// ─── 작은 컴포넌트들 ───────────────────────────────────────────────────────────
const PriBadge = ({p}:{p:string}) => {
  const c = p==="urgent"?"bg-red-50 text-red-600":p==="normal"?"bg-blue-50 text-blue-600":"bg-gray-100 text-gray-500";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c}`}>{PRI_LBL[p]??p}</span>;
};
const StsBadge = ({s}:{s:string}) => {
  const c = s==="new"?"bg-blue-50 text-blue-600"
    :s==="pending"||s==="on_hold"?"bg-amber-50 text-amber-600"
    :s==="processing"||s==="in_progress"||s==="waiting_customer"?"bg-orange-50 text-orange-600"
    :s==="completed"||s==="closed"||s==="done"||s==="invoiced"||s==="confirmed"?"bg-emerald-50 text-emerald-600"
    :s==="rejected"||s==="cancelled"?"bg-red-50 text-red-500"
    :s==="approved"||s==="registered"?"bg-blue-50 text-blue-600"
    :s==="docs"?"bg-purple-50 text-purple-600"
    :"bg-gray-50 text-gray-500";
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


// ─── ExportShop 탭 컴포넌트 ──────────────────────────────────────────────────
const SUPABASE_STORAGE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string ?? "";
const EXPORT_STORAGE_BASE = `${SUPABASE_STORAGE_URL}/storage/v1/object/public/export-listings`;

type ExportListing = {
  id: string;
  category: "forklift"|"excavator"|"aerial";
  brand: string;
  model: string|null;
  year: number|null;
  tonnage: number|null;
  engine_type: string|null;
  condition_grade: "A"|"B"|"C"|null;
  price_usd: number|null;
  price_negotiable: boolean;
  stock_qty: number;
  status: "active"|"sold"|"draft";
  images: string[];
  created_at: string;
};

const EXPORT_CAT_LBL: Record<string,string> = {
  excavator: "굴삭기", forklift: "지게차", aerial: "고소작업대",
};
const EXPORT_GRADE_CLS: Record<string,string> = {
  A: "bg-emerald-100 text-emerald-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-amber-100 text-amber-700",
};

function exImgUrl(path: string) {
  if(!path) return "";
  if(path.startsWith("http")) return path;
  return `${EXPORT_STORAGE_BASE}/${path}`;
}

function ExportShopTab({ onNavigate }: { onNavigate:(path:string)=>void }) {
  const { isAdmin, isSubAdmin, isHyundaiCM } = useAuth();
  const canManage = isAdmin || isSubAdmin || isHyundaiCM;
  const [items, setItems] = React.useState<ExportListing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [catFilter, setCatFilter] = React.useState<"all"|"excavator"|"forklift"|"aerial">("all");
  const [selected, setSelected] = React.useState<ExportListing|null>(null);
  const [imgIdx, setImgIdx] = React.useState(0);

  React.useEffect(()=>{
    setLoading(true);
    supabase
      .from("export_listings")
      .select("*")
      .in("category",["excavator","forklift","aerial"])
      .in("status",["active","sold"])
      .order("created_at",{ascending:false})
      .then(({data})=>{ setItems((data as ExportListing[])??[]); setLoading(false); });
  },[]);

  // 모달 열릴 때 이미지 인덱스 초기화
  const openModal = (item: ExportListing) => { setSelected(item); setImgIdx(0); };
  const closeModal = () => setSelected(null);

  // 키보드 ESC/화살표
  React.useEffect(()=>{
    if(!selected) return;
    const handler = (e: KeyboardEvent) => {
      if(e.key==="Escape") closeModal();
      if(e.key==="ArrowRight") setImgIdx(i=>Math.min(i+1,(selected.images.length||1)-1));
      if(e.key==="ArrowLeft")  setImgIdx(i=>Math.max(i-1,0));
    };
    window.addEventListener("keydown", handler);
    return ()=>window.removeEventListener("keydown", handler);
  },[selected]);

  const filtered = catFilter==="all" ? items : items.filter(i=>i.category===catFilter);
  const counts = {
    all: items.length,
    excavator: items.filter(i=>i.category==="excavator").length,
    forklift: items.filter(i=>i.category==="forklift").length,
    aerial: items.filter(i=>i.category==="aerial").length,
  };

  return (
    <div className="space-y-3 pb-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-[#0f172a]">🌏 수출장비 매물</p>
        <div className="flex gap-1.5 flex-wrap">
          {canManage&&(
            <button className={BTP} onClick={()=>onNavigate("/export-shop/listing/new")}>+ 매물 등록</button>
          )}
          <button className={BTG} onClick={()=>onNavigate("/export-shop")}>전체 페이지 →</button>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all","excavator","forklift","aerial"] as const).map(c=>(
          <button key={c} onClick={()=>setCatFilter(c)}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${catFilter===c?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
            {c==="all"?"전체":EXPORT_CAT_LBL[c]}
            <span className={`ml-1 ${catFilter===c?"text-white/60":"text-gray-400"}`}>({counts[c]})</span>
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {loading&&(
        <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          <span className="text-sm">불러오는 중...</span>
        </div>
      )}

      {/* 빈 상태 */}
      {!loading&&filtered.length===0&&(
        <div className={`${CARD} p-8 flex flex-col items-center gap-2 text-gray-400`}>
          <p className="text-sm font-semibold">등록된 매물이 없습니다</p>
          {canManage&&(
            <button className={BTO} onClick={()=>onNavigate("/export-shop/listing/new")}>+ 첫 매물 등록</button>
          )}
        </div>
      )}

      {/* 매물 목록 */}
      {!loading&&filtered.length>0&&(
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(item=>{
            const thumb = item.images[0] ? exImgUrl(item.images[0]) : null;
            return (
              <div key={item.id}
                className={`${CARD} p-3.5 flex gap-3 cursor-pointer hover:border-orange-300 hover:shadow-md transition-all`}
                onClick={()=>openModal(item)}
              >
                {/* 썸네일 */}
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 relative">
                  {thumb
                    ? <img src={thumb} alt="" className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No img</div>
                  }
                  {item.status==="sold"&&(
                    <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold tracking-widest">SOLD</span>
                    </div>
                  )}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-orange-500 uppercase">{EXPORT_CAT_LBL[item.category]}</span>
                    {item.condition_grade&&(
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${EXPORT_GRADE_CLS[item.condition_grade]}`}>
                        Grade {item.condition_grade}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-[#0f172a] truncate">
                    {item.brand}{item.model?` ${item.model}`:""}{item.year?` (${item.year})`:""}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.tonnage&&<span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-lg font-medium">{item.tonnage}T</span>}
                    {item.engine_type&&<span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-lg font-medium capitalize">{item.engine_type}</span>}
                    {item.stock_qty>1&&<span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-lg font-medium">Qty {item.stock_qty}</span>}
                  </div>
                  <p className="text-sm font-semibold text-[#0f172a]">
                    {item.price_usd ? `USD ${item.price_usd.toLocaleString()}${item.price_negotiable?" (협의)":""}` : "가격 문의"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 상세 모달 ── */}
      {selected&&ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/60 px-4"
          onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e=>e.stopPropagation()}>

            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-orange-500 uppercase">{EXPORT_CAT_LBL[selected.category]}</span>
                {selected.condition_grade&&(
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${EXPORT_GRADE_CLS[selected.condition_grade]}`}>
                    Grade {selected.condition_grade}
                  </span>
                )}
                {selected.status==="sold"&&(
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500">SOLD</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* URL 공유 버튼 */}
                <button
                  onClick={()=>{
                    const url = `${window.location.origin}/export-shop?id=${selected.id}`;
                    if(navigator.share){
                      navigator.share({ title:`${selected.brand} ${selected.model??""} 수출 매물`, url });
                    } else {
                      navigator.clipboard.writeText(url).then(()=>alert("링크가 복사됐습니다.\nSMS·카카오톡에 붙여넣기 하세요."));
                    }
                  }}
                  className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all"
                  title="링크 공유"
                >
                  🔗 공유
                </button>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
              </div>
            </div>

            {/* 이미지 갤러리 */}
            {selected.images.length>0&&(
              <div className="relative bg-gray-100"
                onTouchStart={(e)=>{
                  const t = e.touches[0];
                  (e.currentTarget as any)._touchStartX = t.clientX;
                }}
                onTouchEnd={(e)=>{
                  const startX = (e.currentTarget as any)._touchStartX ?? 0;
                  const endX = e.changedTouches[0].clientX;
                  const diff = startX - endX;
                  if(Math.abs(diff)>40){
                    if(diff>0) setImgIdx(i=>Math.min(i+1,selected.images.length-1));
                    else setImgIdx(i=>Math.max(i-1,0));
                  }
                }}
              >
                <img
                  src={exImgUrl(selected.images[imgIdx])}
                  alt=""
                  className="w-full h-64 object-cover select-none"
                  draggable={false}
                />
                {selected.status==="sold"&&(
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl tracking-widest">SOLD</span>
                  </div>
                )}
                {selected.images.length>1&&(
                  <>
                    <button onClick={()=>setImgIdx(i=>Math.max(i-1,0))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center text-gray-700 shadow">‹</button>
                    <button onClick={()=>setImgIdx(i=>Math.min(i+1,selected.images.length-1))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center text-gray-700 shadow">›</button>
                    {/* 도트 인디케이터 */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {selected.images.map((_,i)=>(
                        <button key={i} onClick={()=>setImgIdx(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${i===imgIdx?"bg-white scale-125":"bg-white/50"}`}/>
                      ))}
                    </div>
                    <p className="absolute bottom-2 right-3 text-white/70 text-xs">{imgIdx+1}/{selected.images.length}</p>
                  </>
                )}
              </div>
            )}

            {/* 썸네일 스트립 */}
            {selected.images.length>1&&(
              <div className="flex gap-1.5 px-4 pt-3 overflow-x-auto">
                {selected.images.map((img,i)=>(
                  <button key={i} onClick={()=>setImgIdx(i)}
                    className={`w-14 h-14 rounded-lg border-2 overflow-hidden flex-shrink-0 transition-all ${i===imgIdx?"border-orange-500":"border-transparent"}`}>
                    <img src={exImgUrl(img)} alt="" className="w-full h-full object-cover"/>
                  </button>
                ))}
              </div>
            )}

            {/* 정보 */}
            <div className="px-5 py-4 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-[#0f172a]">
                  {selected.brand}{selected.model?` ${selected.model}`:""}{selected.year?` (${selected.year})`:""}
                </h3>
                <p className="text-xl font-bold text-orange-500 mt-1">
                  {selected.price_usd ? `USD ${selected.price_usd.toLocaleString()}${selected.price_negotiable?" (협의)":""}` : "가격 문의"}
                </p>
              </div>

              {/* 스펙 */}
              <dl className="border-t pt-3 space-y-2">
                {selected.tonnage&&(
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">톤수</dt>
                    <dd className="font-semibold text-[#0f172a]">{selected.tonnage}T</dd>
                  </div>
                )}
                {selected.engine_type&&(
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">엔진</dt>
                    <dd className="font-semibold text-[#0f172a] capitalize">{selected.engine_type}</dd>
                  </div>
                )}
                {selected.stock_qty>1&&(
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">수량</dt>
                    <dd className="font-semibold text-[#0f172a]">{selected.stock_qty}대</dd>
                  </div>
                )}
              </dl>

              {/* 버튼 */}
              <div className="flex gap-2 pt-1">
                <button className={`${BTP} flex-1`}
                  onClick={()=>{ closeModal(); onNavigate(`/export-shop/inquiry?ref=${selected.id}&model=${encodeURIComponent(`${selected.brand} ${selected.model??""}`)}`);}}>
                  견적 문의 →
                </button>
                {canManage&&(
                  <button className={BTG}
                    onClick={()=>{ closeModal(); window.location.href=`/export-shop/listing/edit/${selected.id}`;}}>
                    수정
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


// ─── FinanceHub 탭 컴포넌트 ──────────────────────────────────────────────────
function FinanceHubTab() {
  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth()+1);
  const [period, setPeriod] = React.useState<FH_Period>("월간");
  const [activeSubTab, setActiveSubTab] = React.useState<"sales"|"purchases"|"incomplete">("sales");
  const [filterCategory, setFilterCategory] = React.useState("전체");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sales, setSales] = React.useState<FH_SalesRecord[]>([]);
  const [purchases, setPurchases] = React.useState<FH_PurchaseRecord[]>([]);
  const [allSales, setAllSales] = React.useState<FH_SalesRecord[]>([]);
  const [allPurchases, setAllPurchases] = React.useState<FH_PurchaseRecord[]>([]);
  const [customers, setCustomers] = React.useState<FH_Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fhError, setFhError] = React.useState<string|null>(null);
  const [incompleteSales, setIncompleteSales] = React.useState<FH_SalesRecord[]>([]);
  const [incompletePurchases, setIncompletePurchases] = React.useState<FH_PurchaseRecord[]>([]);
  const [loadingIncomplete, setLoadingIncomplete] = React.useState(false);
  const [inlineEdits, setInlineEdits] = React.useState<Record<string,string>>({});
  const [showSalesForm, setShowSalesForm] = React.useState(false);
  const [salesEditId, setSalesEditId] = React.useState<number|null>(null);
  const [salesForm, setSalesForm] = React.useState<FH_SalesFormData>(FH_EMPTY_SALES);
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [showCustDrop, setShowCustDrop] = React.useState(false);
  const custRef = React.useRef<HTMLDivElement>(null);
  const [savingSales, setSavingSales] = React.useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = React.useState(false);
  const [purchaseEditId, setPurchaseEditId] = React.useState<number|null>(null);
  const [purchaseForm, setPurchaseForm] = React.useState<FH_PurchaseFormData>(FH_EMPTY_PURCHASE);
  const [savingPurchase, setSavingPurchase] = React.useState(false);
  const salesInvRef = React.useRef<HTMLInputElement>(null);
  const [parsingSalesInv, setParsingSalesInv] = React.useState(false);
  const [showMatchModal, setShowMatchModal] = React.useState(false);
  const [invForm, setInvForm] = React.useState<FH_InvoiceForm>(FH_EMPTY_INV);
  const [matchCandidates, setMatchCandidates] = React.useState<FH_SalesRecord[]>([]);
  const [matchSearch, setMatchSearch] = React.useState("");
  const [matchSelectedIds, setMatchSelectedIds] = React.useState<Set<number>>(new Set());
  const [matchSaving, setMatchSaving] = React.useState(false);
  const [loadingCandidates, setLoadingCandidates] = React.useState(false);
  const purchInvRef = React.useRef<HTMLInputElement>(null);
  const [parsingPurchInv, setParsingPurchInv] = React.useState(false);
  const excelRef = React.useRef<HTMLInputElement>(null);
  const [importingExcel, setImportingExcel] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{success:number;skipped:number;errors:string[];type?:string}|null>(null);
  const [showUncategorized, setShowUncategorized] = React.useState(false);
  const [uncatSales, setUncatSales] = React.useState<FH_SalesRecord[]>([]);
  const [uncatPurchases, setUncatPurchases] = React.useState<FH_PurchaseRecord[]>([]);
  const [loadingUncat, setLoadingUncat] = React.useState(false);
  const [editingCategoryId, setEditingCategoryId] = React.useState<{id:number;table:"sales"|"purchases"}|null>(null);
  const [detailSales, setDetailSales] = React.useState<FH_SalesRecord|null>(null);
  const [detailPurchase, setDetailPurchase] = React.useState<FH_PurchaseRecord|null>(null);

  const {from,to} = React.useMemo(()=>fhGetDateRange(year,month,period),[year,month,period]);

  React.useEffect(()=>{
    (async()=>{
      const{data}=await supabase.from("sales_records").select("sale_date").order("sale_date",{ascending:false}).limit(1).maybeSingle();
      if(data?.sale_date){const d=new Date(data.sale_date);setYear(d.getFullYear());setMonth(d.getMonth()+1);}
    })();
    loadFhCustomers();
    loadFhIncomplete();
  },[]);
  React.useEffect(()=>{loadFhAll();},[from,to]);
  React.useEffect(()=>{if(showUncategorized)loadFhUncategorized();},[year]);

  async function loadFhAll(){
    setLoading(true);setFhError(null);
    const[s,p,sa,pa]=await Promise.all([
      supabase.from("sales_records").select("*").gte("sale_date",from).lte("sale_date",to).order("sale_date",{ascending:false}),
      supabase.from("purchase_records").select("*").gte("purchase_date",from).lte("purchase_date",to).order("purchase_date",{ascending:false}),
      supabase.from("sales_records").select("*").order("sale_date",{ascending:false}),
      supabase.from("purchase_records").select("*").order("purchase_date",{ascending:false}),
    ]);
    if(s.error)setFhError(s.error.message);else setSales((s.data||[])as FH_SalesRecord[]);
    if(p.error)setFhError(p.error.message);else setPurchases((p.data||[])as FH_PurchaseRecord[]);
    setAllSales((sa.data||[])as FH_SalesRecord[]);
    setAllPurchases((pa.data||[])as FH_PurchaseRecord[]);
    setLoading(false);
  }
  async function loadFhIncomplete(){
    setLoadingIncomplete(true);
    const[s,p]=await Promise.all([
      supabase.from("sales_records").select("*").eq("category","기타").eq("is_confirmed",false).order("sale_date",{ascending:false}),
      supabase.from("purchase_records").select("*").eq("category","기타").eq("is_confirmed",false).order("purchase_date",{ascending:false}),
    ]);
    setIncompleteSales((s.data||[])as FH_SalesRecord[]);
    setIncompletePurchases((p.data||[])as FH_PurchaseRecord[]);
    setLoadingIncomplete(false);
  }
  function setInlineEdit(id:number,table:string,field:string,value:string){setInlineEdits(prev=>({...prev,[`${table}-${id}-${field}`]:value}));}
  function getInlineEdit(id:number,table:string,field:string,fallback:string){return inlineEdits[`${table}-${id}-${field}`]??fallback;}
  async function saveInlineSales(r:FH_SalesRecord){
    const category=getInlineEdit(r.id,"sales","category",r.category);
    const maker=getInlineEdit(r.id,"sales","maker",r.maker||"");
    const spec=getInlineEdit(r.id,"sales","spec",r.spec||"");
    await supabase.from("sales_records").update({category,maker:maker||null,spec:spec||null,is_confirmed:true}).eq("id",r.id);
    setInlineEdits(prev=>{const next={...prev};delete next[`sales-${r.id}-category`];delete next[`sales-${r.id}-maker`];delete next[`sales-${r.id}-spec`];return next;});
    loadFhIncomplete();loadFhAll();
  }
  async function saveInlinePurchase(r:FH_PurchaseRecord){
    const category=getInlineEdit(r.id,"purchases","category",r.category);
    const spec=getInlineEdit(r.id,"purchases","spec",r.spec||"");
    await supabase.from("purchase_records").update({category,spec:spec||null,is_confirmed:true}).eq("id",r.id);
    setInlineEdits(prev=>{const next={...prev};delete next[`purchases-${r.id}-category`];delete next[`purchases-${r.id}-spec`];return next;});
    loadFhIncomplete();loadFhAll();
  }
  async function loadFhCustomers(){const{data}=await supabase.from("customers").select("id,name,business_no").eq("is_active",true).order("name");setCustomers((data||[])as FH_Customer[]);}
  async function loadFhUncategorized(){
    setLoadingUncat(true);
    const fromYear=`${year}-01-01`;const toYear=`${year}-12-31`;
    const[s,p]=await Promise.all([
      supabase.from("sales_records").select("*").eq("category","기타").gte("sale_date",fromYear).lte("sale_date",toYear).order("sale_date",{ascending:false}),
      supabase.from("purchase_records").select("*").eq("category","기타").gte("purchase_date",fromYear).lte("purchase_date",toYear).order("purchase_date",{ascending:false}),
    ]);
    setUncatSales((s.data||[])as FH_SalesRecord[]);setUncatPurchases((p.data||[])as FH_PurchaseRecord[]);setLoadingUncat(false);
  }
  function toggleUncategorized(){if(!showUncategorized)loadFhUncategorized();setShowUncategorized(v=>!v);}
  async function updateFhCategory(id:number,table:"sales"|"purchases",newCategory:string){
    const tableName=table==="sales"?"sales_records":"purchase_records";
    await supabase.from(tableName).update({category:newCategory}).eq("id",id);
    setEditingCategoryId(null);
    if(showUncategorized)loadFhUncategorized();else loadFhAll();
  }

  const kpi=React.useMemo(()=>{
    const totalRevenue=sales.reduce((s,r)=>s+(r.total_revenue||0),0);
    const totalCost=purchases.reduce((s,r)=>s+(r.total_cost||0),0);
    const totalMargin=sales.reduce((s,r)=>s+(r.margin||0),0);
    const netProfit=totalRevenue-totalCost;
    const unpaidSales=sales.filter(r=>!r.payment_confirmed).reduce((s,r)=>s+(r.total_revenue||0),0);
    const unpaidPurch=purchases.filter(r=>!r.payment_confirmed).reduce((s,r)=>s+(r.total_cost||0),0);
    const profitRate=totalRevenue>0?(netProfit/totalRevenue)*100:0;
    return{totalRevenue,totalCost,totalMargin,netProfit,unpaidSales,unpaidPurch,profitRate};
  },[sales,purchases]);

  const displaySales=showUncategorized?uncatSales:sales;
  const displayPurchases=showUncategorized?uncatPurchases:purchases;
  const filteredSales=React.useMemo(()=>{
    const base=searchQuery?allSales:displaySales;
    return base.filter(r=>{
      if(filterCategory!=="전체"&&r.category!==filterCategory)return false;
      if(searchQuery){const q=searchQuery.toLowerCase();return r.customer_name.toLowerCase().includes(q)||(r.spec||"").toLowerCase().includes(q)||(r.maker||"").toLowerCase().includes(q);}
      return true;
    });
  },[displaySales,allSales,filterCategory,searchQuery]);
  const filteredPurchases=React.useMemo(()=>{
    const base=searchQuery?allPurchases:displayPurchases;
    return base.filter(r=>{
      if(filterCategory!=="전체"&&r.category!==filterCategory)return false;
      if(searchQuery){const q=searchQuery.toLowerCase();return r.supplier_name.toLowerCase().includes(q)||(r.spec||"").toLowerCase().includes(q)||(r.maker||"").toLowerCase().includes(q);}
      return true;
    });
  },[displayPurchases,allPurchases,filterCategory,searchQuery]);
  const filteredCustomers=React.useMemo(()=>{
    if(!customerQuery)return customers;
    const q=customerQuery.toLowerCase();
    return customers.filter(c=>c.name.toLowerCase().includes(q)||(c.business_no||"").includes(q));
  },[customers,customerQuery]);
  React.useEffect(()=>{
    const handler=(e:MouseEvent)=>{if(custRef.current&&!custRef.current.contains(e.target as Node))setShowCustDrop(false);};
    document.addEventListener("mousedown",handler);return()=>document.removeEventListener("mousedown",handler);
  },[]);

  function openNewSales(){setSalesEditId(null);setSalesForm(FH_EMPTY_SALES);setCustomerQuery("");setShowSalesForm(true);}
  function openEditSales(r:FH_SalesRecord){
    setSalesEditId(r.id);
    setSalesForm({sale_date:r.sale_date,customer_name:r.customer_name,business_no:r.business_no||"",category:r.category,trade_type:r.trade_type==="수출"?"수출":"내수",maker:r.maker||"",spec:r.spec||"",quantity:String(r.quantity),unit_price:String(r.unit_price),unit_cost:String(r.unit_cost),tax_invoice:r.tax_invoice,payment_confirmed:r.payment_confirmed,payment_date:r.payment_date||"",delivery_date:r.delivery_date||"",delivery_confirmed:r.delivery_confirmed,wheel_returned:r.wheel_returned,closing:r.closing,note:r.note||""});
    setCustomerQuery(r.customer_name);setShowSalesForm(true);
  }
  async function saveSales(){
    if(!salesForm.customer_name||!salesForm.quantity||!salesForm.unit_price){setFhError("거래처, 수량, 단가를 입력해주세요.");return;}
    setSavingSales(true);setFhError(null);
    const qty=parseFloat(salesForm.quantity)||0;const price=parseFloat(salesForm.unit_price)||0;const cost=parseFloat(salesForm.unit_cost)||0;
    const vat=salesForm.trade_type==="수출"?1:1.1;
    const payload={sale_date:salesForm.sale_date,customer_name:salesForm.customer_name,business_no:salesForm.business_no||null,category:salesForm.category,trade_type:salesForm.trade_type,maker:salesForm.maker||null,spec:salesForm.spec||null,quantity:qty,unit_price:price,unit_cost:cost,total_revenue:qty*price*vat,total_cost:qty*cost*vat,margin:qty*(price-cost)*vat,tax_invoice:salesForm.tax_invoice,payment_confirmed:salesForm.payment_confirmed,payment_date:salesForm.payment_date||null,delivery_date:salesForm.delivery_date||null,delivery_confirmed:salesForm.delivery_confirmed,wheel_returned:salesForm.wheel_returned,closing:salesForm.closing,note:salesForm.note||null};
    const{error}=salesEditId!==null?await supabase.from("sales_records").update(payload).eq("id",salesEditId):await supabase.from("sales_records").insert(payload);
    if(error)setFhError(error.message);else{setShowSalesForm(false);loadFhAll();}
    setSavingSales(false);
  }
  async function deleteSales(id:number){if(!confirm("삭제하시겠습니까?"))return;await supabase.from("sales_records").delete().eq("id",id);loadFhAll();}
  async function quickToggleSales(id:number,field:string,current:boolean){
    const upd:Record<string,unknown>={[field]:!current};
    if(field==="payment_confirmed"&&!current)upd.payment_date=new Date().toISOString().split("T")[0];
    await supabase.from("sales_records").update(upd).eq("id",id);loadFhAll();
  }
  function openEditPurchase(r:FH_PurchaseRecord){
    setPurchaseEditId(r.id);
    setPurchaseForm({purchase_date:r.purchase_date,supplier_name:r.supplier_name,business_no:r.business_no||"",category:r.category,trade_type:r.trade_type==="수입"?"수입":"국내",maker:r.maker||"",spec:r.spec||"",quantity:String(r.quantity),unit_price:String(r.unit_price),tax_invoice:r.tax_invoice,payment_confirmed:r.payment_confirmed,payment_date:r.payment_date||"",note:r.note||""});
    setShowPurchaseForm(true);
  }
  async function savePurchase(){
    if(!purchaseForm.supplier_name||!purchaseForm.unit_price){setFhError("매입처와 단가를 입력해주세요.");return;}
    setSavingPurchase(true);setFhError(null);
    const payload={purchase_date:purchaseForm.purchase_date,supplier_name:purchaseForm.supplier_name,business_no:purchaseForm.business_no||null,category:purchaseForm.category,trade_type:purchaseForm.trade_type,maker:purchaseForm.maker||null,spec:purchaseForm.spec||null,quantity:parseFloat(purchaseForm.quantity)||0,unit_price:parseFloat(purchaseForm.unit_price)||0,tax_invoice:purchaseForm.tax_invoice,payment_confirmed:purchaseForm.payment_confirmed,payment_date:purchaseForm.payment_date||null,note:purchaseForm.note||null};
    const{error}=purchaseEditId!==null?await supabase.from("purchase_records").update(payload).eq("id",purchaseEditId):await supabase.from("purchase_records").insert(payload);
    if(error)setFhError(error.message);else{setShowPurchaseForm(false);loadFhAll();}
    setSavingPurchase(false);
  }
  async function deletePurchase(id:number){if(!confirm("삭제하시겠습니까?"))return;await supabase.from("purchase_records").delete().eq("id",id);loadFhAll();}
  async function quickTogglePurchase(id:number,current:boolean){const upd:Record<string,unknown>={payment_confirmed:!current};if(!current)upd.payment_date=new Date().toISOString().split("T")[0];await supabase.from("purchase_records").update(upd).eq("id",id);loadFhAll();}

  async function handleSalesInvFile(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    setParsingSalesInv(true);setFhError(null);
    try{
      const base64=await fhFileToBase64(file);
      const{data,error:fnErr}=await supabase.functions.invoke("parse-tax-invoice",{body:{image_base64:base64,media_type:file.type||"image/png",direction:"sales"}});
      if(fnErr)throw fnErr;
      const parsed=(data||{})as FH_ParsedInvoice;
      setInvForm({invoice_no:parsed.invoice_no?String(parsed.invoice_no):"",issue_date:parsed.sale_date||FH_EMPTY_INV.issue_date,customer_name:parsed.customer_name||"",business_no:parsed.business_no?String(parsed.business_no).replace(/[^0-9]/g,""):"",supply_amount:parsed.supply_amount!=null?String(Math.round(parsed.supply_amount)):"",tax_amount:parsed.tax_amount!=null?String(Math.round(parsed.tax_amount)):"",total_amount:parsed.total_amount!=null?String(Math.round(parsed.total_amount)):"",items:parsed.items||""});
      const cleanName=(parsed.customer_name||"").replace(/^\(유\)|^\(주\)|^\(재\)|^\(사\)/g,"").trim();
      setMatchSelectedIds(new Set());setMatchSearch(cleanName);setShowMatchModal(true);loadMatchCandidates(cleanName);
    }catch(err:any){setFhError("계산서 인식 실패: "+(err?.message||""));}
    finally{setParsingSalesInv(false);if(salesInvRef.current)salesInvRef.current.value="";}
  }
  async function loadMatchCandidates(q:string){
    setLoadingCandidates(true);
    const cleanQ=q.trim().replace(/^\(유\)|^\(주\)|^\(재\)|^\(사\)/g,"").trim();
    let query=supabase.from("sales_records").select("*").order("sale_date",{ascending:false}).limit(100);
    if(cleanQ)query=query.ilike("customer_name",`%${cleanQ}%`);
    const{data}=await query;setMatchCandidates((data||[])as FH_SalesRecord[]);setLoadingCandidates(false);
  }
  const matchSelectedSum=React.useMemo(()=>matchCandidates.filter(c=>matchSelectedIds.has(c.id)).reduce((s,c)=>s+(c.total_revenue||0),0),[matchCandidates,matchSelectedIds]);
  const matchTotal=parseFloat(invForm.total_amount)||0;
  const matchIsClose=Math.abs(matchTotal-matchSelectedSum)<1;
  async function confirmMatch(){
    if(matchSelectedIds.size===0){setFhError("매칭할 매출건을 선택해주세요.");return;}
    setMatchSaving(true);setFhError(null);
    const{data:invRow,error:invErr}=await supabase.from("tax_invoices").insert({direction:"sales",invoice_no:invForm.invoice_no||null,issue_date:invForm.issue_date||null,customer_name:invForm.customer_name||null,business_no:invForm.business_no||null,supply_amount:invForm.supply_amount?parseFloat(invForm.supply_amount):null,tax_amount:invForm.tax_amount?parseFloat(invForm.tax_amount):null,total_amount:invForm.total_amount?parseFloat(invForm.total_amount):null,items:invForm.items||null,matched_total:matchSelectedSum}).select().single();
    if(invErr||!invRow){setFhError(invErr?.message||"계산서 등록 실패");setMatchSaving(false);return;}
    const invoiceSupply=invForm.supply_amount?parseFloat(invForm.supply_amount):null;
    const selectedRecords=matchCandidates.filter(c=>matchSelectedIds.has(c.id));
    if(invoiceSupply!=null&&invoiceSupply>0&&selectedRecords.length>0){
      if(selectedRecords.length===1){const rec=selectedRecords[0];const newUnitPrice=rec.quantity>0?Math.round(invoiceSupply/rec.quantity):rec.unit_price;await supabase.from("sales_records").update({unit_price:newUnitPrice,tax_invoice:true,invoice_id:invRow.id}).eq("id",rec.id);}
      else{const totalExisting=selectedRecords.reduce((s,r)=>s+(r.total_revenue||0),0);for(const rec of selectedRecords){const ratio=totalExisting>0?(rec.total_revenue||0)/totalExisting:1/selectedRecords.length;const allocSupply=Math.round(invoiceSupply*ratio);const newUnitPrice=rec.quantity>0?Math.round(allocSupply/rec.quantity):rec.unit_price;await supabase.from("sales_records").update({unit_price:newUnitPrice,tax_invoice:true,invoice_id:invRow.id}).eq("id",rec.id);}}
    }else{await supabase.from("sales_records").update({tax_invoice:true,invoice_id:invRow.id}).in("id",Array.from(matchSelectedIds));}
    setShowMatchModal(false);setInvForm(FH_EMPTY_INV);setMatchSelectedIds(new Set());loadFhAll();setMatchSaving(false);
  }
  // 매칭할 기존 매출건 없을 때 → 계산서 정보로 신규 매출 생성 후 즉시 매칭
  async function createAndMatch(){
    setMatchSaving(true);setFhError(null);
    try{
      // 1) tax_invoices 등록 (matched_total 컬럼 없는 환경 대응)
      const invPayload:Record<string,unknown>={
        direction:"sales",
        invoice_no:invForm.invoice_no||null,
        issue_date:invForm.issue_date||new Date().toISOString().split("T")[0],
        customer_name:invForm.customer_name||null,
        business_no:invForm.business_no||null,
        supply_amount:invForm.supply_amount?parseFloat(invForm.supply_amount):null,
        tax_amount:invForm.tax_amount?parseFloat(invForm.tax_amount):null,
        total_amount:invForm.total_amount?parseFloat(invForm.total_amount):null,
        items:invForm.items||null,
      };
      const{data:invRow,error:invErr}=await supabase.from("tax_invoices").insert(invPayload).select().single();
      if(invErr||!invRow)throw new Error("계산서 등록 실패: "+(invErr?.message||"알 수 없는 오류"));
      // 2) sales_records 신규 생성
      const supplyAmt=invForm.supply_amount?parseFloat(invForm.supply_amount):0;
      const taxAmtRaw=invForm.tax_amount?parseFloat(invForm.tax_amount):null;
      const tradeType=(taxAmtRaw!=null&&taxAmtRaw===0)?"수출":"내수";
      const vat=tradeType==="수출"?1:1.1;
      const unitPrice=Math.round(supplyAmt);
      const{error:recErr}=await supabase.from("sales_records").insert({
        sale_date:invForm.issue_date||new Date().toISOString().split("T")[0],
        customer_name:invForm.customer_name||"거래처 미입력",
        business_no:invForm.business_no||null,
        category:fhGuessCategory(invForm.items||invForm.customer_name||""),
        trade_type:tradeType,maker:null,
        spec:invForm.items||null,
        quantity:1,unit_price:unitPrice,unit_cost:0,
        tax_invoice:true,payment_confirmed:false,payment_date:null,
        delivery_date:null,delivery_confirmed:false,wheel_returned:false,closing:false,
        invoice_id:invRow.id,
        note:`계산서 업로드 자동생성${invForm.invoice_no?` (#${invForm.invoice_no})`:""} — 수량·매입단가 확인 필요`,
      });
      if(recErr)throw new Error("매출 생성 실패: "+recErr.message);
      setShowMatchModal(false);setInvForm(FH_EMPTY_INV);setMatchSelectedIds(new Set());
      await loadFhAll();
      setActiveSubTab("sales");
    }catch(err:any){
      const msg="신규 생성 실패: "+(err?.message||"");
      setFhError(msg);
      alert(msg);
    }finally{setMatchSaving(false);}
  }
  async function handlePurchInvFile(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    setParsingPurchInv(true);setFhError(null);
    try{
      const base64=await fhFileToBase64(file);
      const{data,error:fnErr}=await supabase.functions.invoke("parse-tax-invoice",{body:{image_base64:base64,media_type:file.type||"image/png",direction:"purchase"}});
      if(fnErr)throw fnErr;
      const parsed=(data||{})as FH_ParsedInvoice;
      if(!parsed.customer_name&&!parsed.total_amount)throw new Error("인식 실패. 더 선명한 이미지로 다시 시도해주세요.");
      const tradeType:"국내"|"수입"=(parsed.tax_amount??null)===0?"수입":"국내";
      const{data:invRow,error:invErr}=await supabase.from("tax_invoices").insert({direction:"purchase",invoice_no:parsed.invoice_no||null,issue_date:parsed.sale_date||new Date().toISOString().split("T")[0],customer_name:parsed.customer_name||null,business_no:parsed.business_no?String(parsed.business_no).replace(/[^0-9]/g,""):null,supply_amount:parsed.supply_amount??null,tax_amount:parsed.tax_amount??null,total_amount:parsed.total_amount??null,items:parsed.items||null}).select().single();
      if(invErr||!invRow)throw new Error(invErr?.message||"계산서 등록 실패");
      const{data:newRec}=await supabase.from("purchase_records").insert({purchase_date:parsed.sale_date||new Date().toISOString().split("T")[0],supplier_name:parsed.customer_name||"거래처 미입력",business_no:parsed.business_no?String(parsed.business_no).replace(/[^0-9]/g,""):null,category:fhGuessCategory(parsed.items||""),trade_type:tradeType,maker:null,spec:parsed.items||null,quantity:1,unit_price:Math.round(parsed.supply_amount??0),tax_invoice:true,payment_confirmed:false,payment_date:null,invoice_id:invRow.id,note:`계산서 업로드 자동등록${parsed.invoice_no?` (#${parsed.invoice_no})`:""} — 수량 확인 필요`}).select().single();
      await loadFhAll();
      if(newRec){setActiveSubTab("purchases");openEditPurchase(newRec as FH_PurchaseRecord);}
    }catch(err:any){setFhError("계산서 인식/등록 실패: "+(err?.message||""));}
    finally{setParsingPurchInv(false);if(purchInvRef.current)purchInvRef.current.value="";}
  }
  async function handleExcelImport(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    setImportingExcel(true);setImportResult(null);setFhError(null);
    try{
      const XLSX=await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm" as any);
      const arrayBuffer=await file.arrayBuffer();
      const wb=XLSX.read(arrayBuffer,{type:"array",cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows:any[][]=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
      const fullText=rows.slice(0,6).map((r:any)=>r.join(" ")).join(" ");
      const isSales=fullText.includes("매출 전자");
      const direction=isSales?"sales":"purchase";
      let headerRow=-1;
      for(let i=0;i<Math.min(10,rows.length);i++){if(String(rows[i][0]).includes("작성일자")){headerRow=i;break;}}
      if(headerRow===-1)throw new Error("홈택스 전자세금계산서 목록 형식이 아닙니다.");
      const dataRows=rows.slice(headerRow+1).filter((r:any)=>r[0]&&String(r[0]).trim()!=="");
      let success=0,skipped=0;const errors:string[]=[];
      for(const r of dataRows){
        try{
          const invoice_no=String(r[1]||"").trim();
          const issue_date=r[0]instanceof Date?r[0].toISOString().split("T")[0]:String(r[0]).trim().slice(0,10);
          const counterpart_name=isSales?String(r[11]||"").trim():String(r[6]||"").trim();
          const counterpart_biz=isSales?String(r[9]||"").replace(/[^0-9]/g,""):String(r[4]||"").replace(/[^0-9]/g,"");
          const total_amount=parseFloat(String(r[14]).replace(/[^0-9,.-]/g,"").replace(/,/g,""))||0;
          const supply_amount=parseFloat(String(r[15]).replace(/[^0-9,.-]/g,"").replace(/,/g,""))||0;
          const tax_amount=parseFloat(String(r[16]).replace(/[^0-9,.-]/g,"").replace(/,/g,""))||0;
          const invoiceType=String(r[18]||"").trim();
          const isAmendment=supply_amount<0||invoiceType.includes("수정");
          const itemName=String(r[26]||"").trim();
          const itemSpec=String(r[27]||"").trim();
          const itemQty=parseFloat(String(r[28]||"1").replace(/[^0-9.-]/g,""))||1;
          const itemUnitPrice=parseFloat(String(r[29]||"0").replace(/[^0-9,.-]/g,"").replace(/,/g,""))||0;
          const spec=[itemName,itemSpec].filter(Boolean).join(" / ");
          if(!counterpart_name||!issue_date){skipped++;continue;}
          if(invoice_no){const{data:existing}=await supabase.from("tax_invoices").select("id").eq("invoice_no",invoice_no).eq("direction",direction).maybeSingle();if(existing){skipped++;continue;}}
          const{data:invRow,error:invErr}=await supabase.from("tax_invoices").insert({direction,invoice_no:invoice_no||null,issue_date,customer_name:counterpart_name,business_no:counterpart_biz||null,supply_amount,tax_amount,total_amount,items:spec||null}).select().single();
          if(invErr||!invRow)throw new Error(invErr?.message||"계산서 저장 실패");
          if(isSales){
            const trade_type=Math.abs(tax_amount)===0?"수출":"내수";
            const vat=trade_type==="수출"?1:1.1;
            const unit_price=Math.round(Math.abs(itemUnitPrice||supply_amount));
            const qty=Math.abs(itemQty);
            const category=fhGuessCategory(spec);
            const{error:recErr}=await supabase.from("sales_records").insert({sale_date:issue_date,customer_name:counterpart_name,business_no:counterpart_biz||null,category,trade_type,maker:null,spec:spec||null,quantity:qty,unit_price,unit_cost:0,total_revenue:qty*unit_price*vat,total_cost:0,margin:qty*unit_price*vat,tax_invoice:true,payment_confirmed:false,payment_date:null,delivery_date:null,delivery_confirmed:false,wheel_returned:false,closing:false,invoice_id:invRow.id,note:`엑셀 일괄등록${isAmendment?" [수정세금계산서]":""}${invoice_no?` (#${invoice_no})`:""}`});
            if(recErr)throw new Error(recErr.message);
          }else{
            const trade_type:"국내"|"수입"=Math.abs(tax_amount)===0?"수입":"국내";
            const category=fhGuessCategory(spec);
            const{error:recErr}=await supabase.from("purchase_records").insert({purchase_date:issue_date,supplier_name:counterpart_name,business_no:counterpart_biz||null,category,trade_type,maker:null,spec:spec||null,quantity:1,unit_price:Math.round(supply_amount),tax_invoice:true,payment_confirmed:false,payment_date:null,invoice_id:invRow.id,note:`엑셀 일괄등록${isAmendment?" [수정세금계산서]":""}${invoice_no?` (#${invoice_no})`:""}`});
            if(recErr)throw new Error(recErr.message);
          }
          success++;
        }catch(rowErr:any){errors.push(`${r[isSales?11:6]||r[0]}: ${rowErr.message}`);}
      }
      setImportResult({success,skipped,errors,type:isSales?"매출":"매입"});
      await loadFhAll();
      if(isSales)setActiveSubTab("sales");else setActiveSubTab("purchases");
    }catch(err:any){setFhError("엑셀 처리 실패: "+(err?.message||""));}
    finally{setImportingExcel(false);if(excelRef.current)excelRef.current.value="";}
  }

  const periodLabel=React.useMemo(()=>{
    if(period==="월간")return `${year}년 ${month}월`;
    if(period==="분기")return `${year}년 ${Math.ceil(month/3)}분기`;
    if(period==="반기")return `${year}년 ${month<=6?"상반기":"하반기"}`;
    return `${year}년`;
  },[year,month,period]);

  // ── 스타일 (AI비서 통일) ──────────────────────────────────────────────────
  const fhCard="border border-gray-200 rounded-2xl bg-white shadow-sm";
  const fhInp="w-full h-[44px] rounded-xl border border-gray-200 px-3 text-sm font-medium text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 transition-all";
  const fhInpSm="w-full h-[38px] rounded-xl border border-gray-200 px-3 text-sm font-medium text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 transition-all";
  const fhLbl="block text-xs font-medium text-gray-500 mb-1";
  const fhBtnP="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50";
  const fhBtnS="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all";
  const fhBtnG="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-gray-300 transition-all";

  return (
    <div className="space-y-3 pb-4">
      {/* ── KPI 헤더 ── */}
      <div className={`${fhCard} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-[#0f172a]">💵 매출 / 매입 관리</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {FH_PERIODS.map(p=>(
                <button key={p} onClick={()=>setPeriod(p)}
                  className={`px-2.5 py-1 text-xs font-semibold transition-all ${period===p?"bg-[#0f172a] text-white":"bg-white text-gray-500 hover:bg-gray-50"}`}>{p}</button>
              ))}
            </div>
            <select value={year} onChange={e=>setYear(Number(e.target.value))}
              className="h-8 rounded-xl border border-gray-200 bg-white px-2 text-xs text-[#0f172a] focus:outline-none focus:border-orange-400">
              {[today.getFullYear()-1,today.getFullYear(),today.getFullYear()+1].map(y=>
                <option key={y} value={y}>{y}년</option>)}
            </select>
            {period==="월간"&&(
              <select value={month} onChange={e=>setMonth(Number(e.target.value))}
                className="h-8 rounded-xl border border-gray-200 bg-white px-2 text-xs text-[#0f172a] focus:outline-none focus:border-orange-400">
                {Array.from({length:12}).map((_,i)=><option key={i+1} value={i+1}>{i+1}월</option>)}
              </select>
            )}
            {period==="분기"&&(
              <select value={Math.ceil(month/3)} onChange={e=>setMonth((Number(e.target.value)-1)*3+1)}
                className="h-8 rounded-xl border border-gray-200 bg-white px-2 text-xs text-[#0f172a] focus:outline-none focus:border-orange-400">
                {[1,2,3,4].map(q=><option key={q} value={q}>{q}분기</option>)}
              </select>
            )}
            {period==="반기"&&(
              <select value={month<=6?1:7} onChange={e=>setMonth(Number(e.target.value))}
                className="h-8 rounded-xl border border-gray-200 bg-white px-2 text-xs text-[#0f172a] focus:outline-none focus:border-orange-400">
                <option value={1}>상반기</option><option value={7}>하반기</option>
              </select>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            {label:"매출",value:fhFmt(kpi.totalRevenue),clr:"text-[#0f172a]"},
            {label:"매입",value:fhFmt(kpi.totalCost),clr:"text-[#0f172a]"},
            {label:"손익",value:fhFmt(kpi.netProfit),clr:kpi.netProfit>=0?"text-emerald-600":"text-red-500"},
            {label:"매출이익",value:fhFmt(kpi.totalMargin),clr:"text-sky-600"},
            {label:"이익률",value:`${kpi.profitRate.toFixed(1)}%`,clr:kpi.profitRate>=0?"text-emerald-600":"text-red-500"},
            {label:"미수/미지급",value:`${Math.round(kpi.unpaidSales/10000)}만/${Math.round(kpi.unpaidPurch/10000)}만`,clr:"text-amber-600"},
          ].map(k=>(
            <div key={k.label} className="bg-gray-50 rounded-xl px-2.5 py-2 border border-gray-100">
              <p className="text-[10px] text-gray-400 font-medium">{k.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${k.clr}`}>{k.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">{periodLabel} 기준</p>
      </div>

      {/* ── 에러 / 엑셀 결과 ── */}
      {fhError&&(
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <FhAlertCircle className="w-4 h-4 shrink-0"/>{fhError}
          <button onClick={()=>setFhError(null)} className="ml-auto"><FhX className="w-4 h-4"/></button>
        </div>
      )}
      {importResult&&(
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 flex items-center justify-between gap-3">
          <span>✅ {importResult.type||""} 엑셀 등록 — <strong>{importResult.success}건</strong>{importResult.skipped>0&&`, ${importResult.skipped}건 중복`}</span>
          <button onClick={()=>setImportResult(null)}><FhX className="w-4 h-4"/></button>
        </div>
      )}

      {/* ── 서브탭 + 액션 버튼 ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(["sales","purchases","incomplete"] as const).map(t=>(
              <button key={t} onClick={()=>{setActiveSubTab(t);setFilterCategory("전체");setSearchQuery("");setShowUncategorized(false);if(t==="incomplete")loadFhIncomplete();}}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab===t?"bg-white text-[#0f172a] shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
                {t==="sales"?`매출 (${sales.length}건)`:t==="purchases"?`매입 (${purchases.length}건)`:(
                  <span className={(incompleteSales.length+incompletePurchases.length)>0?"text-amber-600":""}>
                    ⚠ 보완 ({incompleteSales.length+incompletePurchases.length}건)
                  </span>
                )}
              </button>
            ))}
          </div>
          <button onClick={toggleUncategorized}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${showUncategorized?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-amber-600 border-amber-300 hover:bg-amber-50"}`}>
            {loadingUncat?<FhLoader2 className="w-3 h-3 animate-spin inline"/>:null}
            {showUncategorized?"▶ 기간별 보기":` ⚠ ${year}년 미분류`}
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <input ref={excelRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleExcelImport}/>
          <button onClick={()=>excelRef.current?.click()} disabled={importingExcel} className={fhBtnG}>
            {importingExcel?<FhLoader2 className="w-3.5 h-3.5 animate-spin"/>:<FhFileSpreadsheet className="w-3.5 h-3.5"/>}
            {importingExcel?"처리중":"엑셀등록"}
          </button>
          {activeSubTab==="sales"?(
            <>
              <input ref={salesInvRef} type="file" accept="image/*" className="hidden" onChange={handleSalesInvFile}/>
              <button onClick={()=>salesInvRef.current?.click()} disabled={parsingSalesInv} className={fhBtnG}>
                {parsingSalesInv?<FhLoader2 className="w-3.5 h-3.5 animate-spin"/>:<FhUpload className="w-3.5 h-3.5"/>}
                {parsingSalesInv?"인식중":"계산서"}
              </button>
              <button onClick={openNewSales} className={fhBtnG}>
                <FhPlus className="w-3.5 h-3.5"/>매출입력
              </button>
            </>
          ):(
            activeSubTab==="purchases"&&(
              <>
                <input ref={purchInvRef} type="file" accept="image/*" className="hidden" onChange={handlePurchInvFile}/>
                <button onClick={()=>purchInvRef.current?.click()} disabled={parsingPurchInv} className={fhBtnG}>
                  {parsingPurchInv?<FhLoader2 className="w-3.5 h-3.5 animate-spin"/>:<FhUpload className="w-3.5 h-3.5"/>}
                  {parsingPurchInv?"인식중":"계산서"}
                </button>
              </>
            )
          )}
        </div>
      </div>

      {/* ── 검색 + 카테고리 필터 ── */}
      {activeSubTab!=="incomplete"&&(
        <div className={`${fhCard} px-3 py-2.5 flex flex-wrap gap-2 items-center`}>
          <div className="relative flex-1 min-w-[160px]">
            <FhSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              placeholder={activeSubTab==="sales"?"거래처·Maker·규격 검색":"매입처·Maker·규격 검색"}
              className="w-full h-8 pl-8 pr-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-orange-400"/>
            {searchQuery&&<span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-orange-500 font-medium whitespace-nowrap">전 기간</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["전체",...FH_CATEGORIES].map(cat=>(
              <button key={cat} onClick={()=>setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${filterCategory===cat?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 매출 목록 ── */}
      {activeSubTab==="sales"&&(
        loading?<div className={`${fhCard} p-8 text-center text-sm text-gray-400`}><FhLoader2 className="w-5 h-5 animate-spin text-orange-500 mx-auto mb-2"/>불러오는 중...</div>
        :filteredSales.length===0?<div className={`${fhCard} p-8 text-center text-gray-400 text-sm`}>매출 데이터가 없습니다.</div>:(
          <div className={`${fhCard} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["날짜","거래처","종류","구분","Maker/규격","수량","매출","이익","계산서","입금",""].map(h=>(
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSales.map(r=>(
                    <React.Fragment key={r.id}>
                    <tr className={`transition-colors cursor-pointer ${detailSales?.id===r.id?"bg-orange-50":"hover:bg-orange-50/40"}`} onClick={()=>setDetailSales(prev=>prev?.id===r.id?null:r)}>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{r.sale_date}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-[#0f172a] whitespace-nowrap text-xs">{r.customer_name}</p>
                        {r.business_no&&<p className="text-[10px] text-gray-400">{r.business_no}</p>}
                      </td>
                      <td className="px-3 py-2.5" onClick={e=>e.stopPropagation()}>
                        {editingCategoryId?.id===r.id&&editingCategoryId?.table==="sales"?(
                          <select autoFocus defaultValue={r.category} onChange={e=>updateFhCategory(r.id,"sales",e.target.value)} onBlur={()=>setEditingCategoryId(null)}
                            className="h-7 rounded-lg border border-orange-400 px-1.5 text-xs bg-white focus:outline-none">
                            {FH_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                        ):(
                          <button onClick={()=>setEditingCategoryId({id:r.id,table:"sales"})} title="클릭하여 변경"
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap hover:ring-2 hover:ring-orange-300 transition-all ${FH_CAT_COLOR[r.category]||"bg-gray-100 text-gray-600"}`}>
                            {r.category}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${r.trade_type==="수출"?"bg-amber-50 text-amber-600":"bg-gray-100 text-gray-500"}`}>{r.trade_type}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{[r.maker,r.spec].filter(Boolean).join(" / ")||"-"}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-gray-700 text-right whitespace-nowrap">{r.quantity}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-[#0f172a] text-right whitespace-nowrap">{fhFmt(r.total_revenue||0)}</td>
                      <td className={`px-3 py-2.5 text-xs font-semibold text-right whitespace-nowrap ${(r.margin||0)>=0?"text-emerald-600":"text-red-500"}`}>{fhFmt(r.margin||0)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${r.tax_invoice?"bg-emerald-100 text-emerald-700":"bg-gray-100 text-gray-400"}`}>
                          {r.invoice_id&&<FhLink2 className="w-3 h-3"/>}{r.tax_invoice?"완료":"-"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>quickToggleSales(r.id,"payment_confirmed",r.payment_confirmed)}
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${r.payment_confirmed?"bg-emerald-100 text-emerald-700 hover:bg-emerald-200":"bg-red-100 text-red-600 hover:bg-red-200"}`}>
                          {r.payment_confirmed?"입금":"미수"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5" onClick={e=>e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={()=>openEditSales(r)} className="p-1 text-gray-400 hover:text-orange-500 rounded-lg hover:bg-orange-50 transition-all"><FhPencil className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>deleteSales(r.id)} className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"><FhTrash2 className="w-3.5 h-3.5"/></button>
                        </div>
                      </td>
                    </tr>
                    {detailSales?.id===r.id&&(
                      <tr>
                        <td colSpan={11} className="px-3 pb-3 pt-0 bg-orange-50">
                          <div className="rounded-xl border border-orange-100 bg-white shadow-sm p-3">
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                              {(()=>{const isExport=r.trade_type==="수출";const supply=Math.round(r.total_revenue||0);const vat=isExport?0:Math.round(supply*0.1);const total=supply+vat;return(<>
                                <div><p className="text-[11px] text-gray-400 mb-0.5">공급가액</p><p className="font-semibold text-[#0f172a] text-xs">{fhFmt(supply)}</p></div>
                                <div><p className="text-[11px] text-gray-400 mb-0.5">부가세</p><p className="font-semibold text-gray-500 text-xs">{fhFmt(vat)}</p></div>
                                <div><p className="text-[11px] text-orange-500 mb-0.5">합계(VAT포함)</p><p className="font-bold text-orange-600 text-sm">{fhFmt(total)}</p></div>
                                <div><p className="text-[11px] text-gray-400 mb-0.5">계산서</p><p className={`font-semibold text-xs ${r.tax_invoice?"text-emerald-600":"text-gray-400"}`}>{r.tax_invoice?"✅ 발행":"미발행"}</p></div>
                                <div><p className="text-[11px] text-gray-400 mb-0.5">입금일</p><p className={`font-semibold text-xs ${r.payment_confirmed?"text-emerald-600":"text-red-500"}`}>{r.payment_confirmed?`✅ ${r.payment_date||"완료"}`:"미수"}</p></div>
                                {r.note&&<div className="w-full"><p className="text-[11px] text-gray-400 mb-0.5">비고</p><p className="text-xs text-gray-600">{r.note}</p></div>}
                              </>);})()}
                            </div>
                            <div className="flex justify-end mt-2 pt-2 border-t border-gray-100">
                              <button onClick={e=>{e.stopPropagation();openEditSales(r);setDetailSales(null);}} className={fhBtnP}><FhPencil className="w-3.5 h-3.5"/>수정</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── 매입 목록 ── */}
      {activeSubTab==="purchases"&&(
        loading?<div className={`${fhCard} p-8 text-center text-sm text-gray-400`}><FhLoader2 className="w-5 h-5 animate-spin text-orange-500 mx-auto mb-2"/>불러오는 중...</div>
        :filteredPurchases.length===0?<div className={`${fhCard} p-8 text-center text-gray-400 text-sm`}>매입 데이터가 없습니다.</div>:(
          <div className={`${fhCard} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["날짜","매입처","종류","구분","Maker/규격","수량","매입액","계산서","지급",""].map(h=>(
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPurchases.map(r=>(
                    <React.Fragment key={r.id}>
                    <tr className={`transition-colors cursor-pointer ${detailPurchase?.id===r.id?"bg-blue-50":"hover:bg-orange-50/40"}`} onClick={()=>setDetailPurchase(prev=>prev?.id===r.id?null:r)}>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{r.purchase_date}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-[#0f172a] whitespace-nowrap text-xs">{r.supplier_name}</p>
                        {r.business_no&&<p className="text-[10px] text-gray-400">{r.business_no}</p>}
                      </td>
                      <td className="px-3 py-2.5" onClick={e=>e.stopPropagation()}>
                        {editingCategoryId?.id===r.id&&editingCategoryId?.table==="purchases"?(
                          <select autoFocus defaultValue={r.category} onChange={e=>updateFhCategory(r.id,"purchases",e.target.value)} onBlur={()=>setEditingCategoryId(null)}
                            className="h-7 rounded-lg border border-orange-400 px-1.5 text-xs bg-white focus:outline-none">
                            {FH_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                        ):(
                          <button onClick={()=>setEditingCategoryId({id:r.id,table:"purchases"})} title="클릭하여 변경"
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap hover:ring-2 hover:ring-orange-300 transition-all ${FH_CAT_COLOR[r.category]||"bg-gray-100 text-gray-600"}`}>
                            {r.category}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${r.trade_type==="수입"?"bg-amber-50 text-amber-600":"bg-gray-100 text-gray-500"}`}>{r.trade_type}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{[r.maker,r.spec].filter(Boolean).join(" / ")||"-"}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-gray-700 text-right whitespace-nowrap">{r.quantity}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className={`text-xs font-semibold ${(r.total_cost||0)<0?"text-red-500":"text-[#0f172a]"}`}>
                          {(r.total_cost||0)<0&&"▼ "}{fhFmtAbs(r.total_cost||0)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.tax_invoice?"bg-emerald-100 text-emerald-700":"bg-gray-100 text-gray-400"}`}>{r.tax_invoice?"완료":"-"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>quickTogglePurchase(r.id,r.payment_confirmed)}
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${r.payment_confirmed?"bg-emerald-100 text-emerald-700 hover:bg-emerald-200":"bg-red-100 text-red-600 hover:bg-red-200"}`}>
                          {r.payment_confirmed?"지급":"미납"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5" onClick={e=>e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={()=>openEditPurchase(r)} className="p-1 text-gray-400 hover:text-orange-500 rounded-lg hover:bg-orange-50 transition-all"><FhPencil className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>deletePurchase(r.id)} className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"><FhTrash2 className="w-3.5 h-3.5"/></button>
                        </div>
                      </td>
                    </tr>
                    {detailPurchase?.id===r.id&&(
                      <tr>
                        <td colSpan={10} className="px-3 pb-3 pt-0 bg-blue-50">
                          <div className="rounded-xl border border-blue-100 bg-white shadow-sm p-3">
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                              {(()=>{const isImport=r.trade_type==="수입";const supply=Math.round(Math.abs(r.total_cost||0));const vat=isImport?0:Math.round(supply*0.1);const total=supply+vat;return(<>
                                <div><p className="text-[11px] text-gray-400 mb-0.5">공급가액</p><p className="font-semibold text-[#0f172a] text-xs">{fhFmt(supply)}</p></div>
                                <div><p className="text-[11px] text-gray-400 mb-0.5">부가세</p><p className="font-semibold text-gray-500 text-xs">{fhFmt(vat)}</p></div>
                                <div><p className="text-[11px] text-blue-500 mb-0.5">합계(VAT포함)</p><p className="font-bold text-blue-700 text-sm">{fhFmt(total)}</p></div>
                                <div><p className="text-[11px] text-gray-400 mb-0.5">계산서</p><p className={`font-semibold text-xs ${r.tax_invoice?"text-emerald-600":"text-gray-400"}`}>{r.tax_invoice?"✅ 수취":"미수취"}</p></div>
                                <div><p className="text-[11px] text-gray-400 mb-0.5">지급일</p><p className={`font-semibold text-xs ${r.payment_confirmed?"text-emerald-600":"text-red-500"}`}>{r.payment_confirmed?`✅ ${r.payment_date||"완료"}`:"미납"}</p></div>
                                {r.note&&<div className="w-full"><p className="text-[11px] text-gray-400 mb-0.5">비고</p><p className="text-xs text-gray-600">{r.note}</p></div>}
                              </>);})()}
                            </div>
                            <div className="flex justify-end mt-2 pt-2 border-t border-gray-100">
                              <button onClick={e=>{e.stopPropagation();openEditPurchase(r);setDetailPurchase(null);}} className={fhBtnP}><FhPencil className="w-3.5 h-3.5"/>수정</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── 보완필요 탭 ── */}
      {activeSubTab==="incomplete"&&(
        loadingIncomplete?<div className={`${fhCard} p-8 text-center text-sm text-gray-400`}><FhLoader2 className="w-5 h-5 animate-spin text-orange-500 mx-auto mb-2"/>불러오는 중...</div>
        :(incompleteSales.length+incompletePurchases.length)===0?(
          <div className={`${fhCard} p-10 flex flex-col items-center text-gray-400 gap-2`}>
            <FhPackageCheck className="w-8 h-8 text-emerald-300"/>
            <p className="text-sm font-medium">보완이 필요한 건이 없습니다 🎉</p>
          </div>
        ):(
          <div className="space-y-3">
            {incompleteSales.length>0&&(()=>{
              const groups:Record<string,FH_SalesRecord[]>={};
              incompleteSales.forEach(r=>{if(!groups[r.customer_name])groups[r.customer_name]=[];groups[r.customer_name].push(r);});
              const bulkSave=async(customerName:string,records:FH_SalesRecord[])=>{
                const firstId=records[0].id;const category=getInlineEdit(firstId,"sales","category",records[0].category);const maker=getInlineEdit(firstId,"sales","maker",records[0].maker||"");
                await Promise.all(records.map(r=>supabase.from("sales_records").update({category,maker:maker||null,is_confirmed:true}).eq("id",r.id)));
                setInlineEdits(prev=>{const next={...prev};records.forEach(r=>{delete next[`sales-${r.id}-category`];delete next[`sales-${r.id}-maker`];});return next;});
                loadFhIncomplete();loadFhAll();
              };
              return(
                <div className={`${fhCard} overflow-hidden`}>
                  <div className="px-3 py-2.5 border-b border-gray-100 bg-amber-50">
                    <p className="text-xs font-semibold text-amber-700">매출 확인 필요 ({incompleteSales.length}건, {Object.keys(groups).length}개 거래처)</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Object.entries(groups).map(([cname,records])=>{
                      const firstId=records[0].id;const currentCategory=getInlineEdit(firstId,"sales","category",records[0].category);const currentMaker=getInlineEdit(firstId,"sales","maker",records[0].maker||"");const totalAmt=records.reduce((s,r)=>s+(r.total_revenue||0),0);
                      return(
                        <div key={cname} className="px-3 py-2.5 hover:bg-amber-50/30 transition-colors">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="min-w-[140px]"><p className="text-xs font-semibold text-[#0f172a]">{cname}</p><p className="text-[10px] text-gray-400">{records.length}건 · {fhFmt(totalAmt)}</p></div>
                            <select value={currentCategory} onChange={e=>{records.forEach(r=>setInlineEdit(r.id,"sales","category",e.target.value));}}
                              className="h-7 rounded-lg border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400 w-28">
                              {FH_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                            <input value={currentMaker} onChange={e=>records.forEach(r=>setInlineEdit(r.id,"sales","maker",e.target.value))} placeholder="Maker"
                              className="h-7 rounded-lg border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400 w-24"/>
                            <span className="text-[10px] text-gray-400">{records[records.length-1].sale_date}~{records[0].sale_date}</span>
                            <button onClick={()=>bulkSave(cname,records)} className="ml-auto px-3 py-1 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors whitespace-nowrap">{records.length}건 저장</button>
                          </div>
                          <div className="mt-1.5 ml-1 space-y-0.5">
                            {records.map(r=>(
                              <div key={r.id} className="flex items-center gap-3 text-[10px] text-gray-500">
                                <span className="w-20 shrink-0">{r.sale_date}</span>
                                <span className="truncate flex-1">{r.spec||"-"}</span>
                                <span className="shrink-0 font-medium text-gray-700">{fhFmt(r.total_revenue||0)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {incompletePurchases.length>0&&(()=>{
              const groups:Record<string,FH_PurchaseRecord[]>={};
              incompletePurchases.forEach(r=>{if(!groups[r.supplier_name])groups[r.supplier_name]=[];groups[r.supplier_name].push(r);});
              const bulkSave=async(records:FH_PurchaseRecord[])=>{
                const firstId=records[0].id;const category=getInlineEdit(firstId,"purchases","category",records[0].category);
                await Promise.all(records.map(r=>supabase.from("purchase_records").update({category,is_confirmed:true}).eq("id",r.id)));
                setInlineEdits(prev=>{const next={...prev};records.forEach(r=>{delete next[`purchases-${r.id}-category`];});return next;});
                loadFhIncomplete();loadFhAll();
              };
              return(
                <div className={`${fhCard} overflow-hidden`}>
                  <div className="px-3 py-2.5 border-b border-gray-100 bg-blue-50">
                    <p className="text-xs font-semibold text-blue-700">매입 확인 필요 ({incompletePurchases.length}건, {Object.keys(groups).length}개 매입처)</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Object.entries(groups).map(([sname,records])=>{
                      const firstId=records[0].id;const currentCategory=getInlineEdit(firstId,"purchases","category",records[0].category);const totalAmt=records.reduce((s,r)=>s+Math.abs(r.total_cost||0),0);
                      return(
                        <div key={sname} className={`px-3 py-2.5 transition-colors ${records.some(r=>(r.total_cost||0)<0)?"bg-red-50/20":"hover:bg-blue-50/20"}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="min-w-[140px]"><p className="text-xs font-semibold text-[#0f172a]">{sname}</p><p className="text-[10px] text-gray-400">{records.length}건 · {fhFmt(totalAmt)}</p></div>
                            <select value={currentCategory} onChange={e=>records.forEach(r=>setInlineEdit(r.id,"purchases","category",e.target.value))}
                              className="h-7 rounded-lg border border-amber-300 px-2 text-xs bg-white focus:outline-none focus:border-orange-400 w-28">
                              {FH_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                            <span className="text-[10px] text-gray-400">{records[records.length-1].purchase_date}~{records[0].purchase_date}</span>
                            <button onClick={()=>bulkSave(records)} className="ml-auto px-3 py-1 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors whitespace-nowrap">{records.length}건 저장</button>
                          </div>
                          <div className="mt-1.5 ml-1 space-y-0.5">
                            {records.map(r=>(
                              <div key={r.id} className="flex items-center gap-3 text-[10px] text-gray-500">
                                <span className="w-20 shrink-0">{r.purchase_date}</span>
                                <span className="truncate flex-1">{r.spec||"-"}</span>
                                <span className={`shrink-0 font-medium ${(r.total_cost||0)<0?"text-red-500":"text-gray-700"}`}>{(r.total_cost||0)<0&&"▼ "}{fhFmtAbs(r.total_cost||0)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )
      )}

      {/* ── 매출 입력/수정 모달 ── */}
      {showSalesForm&&ReactDOM.createPortal(
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto pt-[140px] pb-8 px-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-[#0f172a]">{salesEditId?"매출 수정":"새 매출 입력"}</h2>
              <button onClick={()=>setShowSalesForm(false)} className="text-gray-400 hover:text-gray-600"><FhX className="w-5 h-5"/></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div><label className={fhLbl}>날짜</label><input type="date" value={salesForm.sale_date} onChange={e=>setSalesForm(f=>({...f,sale_date:e.target.value}))} className={fhInp}/></div>
                <div><label className={fhLbl}>종류</label>
                  <select value={salesForm.category} onChange={e=>setSalesForm(f=>({...f,category:e.target.value}))} className={fhInp}>
                    {FH_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className={fhLbl}>구분</label>
                  <select value={salesForm.trade_type} onChange={e=>setSalesForm(f=>({...f,trade_type:e.target.value as "내수"|"수출"}))} className={fhInp}>
                    <option value="내수">내수 (VAT 10%)</option><option value="수출">수출 (영세율)</option>
                  </select>
                </div>
              </div>
              <div ref={custRef}>
                <label className={fhLbl}>거래처</label>
                <div className="relative">
                  <input value={customerQuery} onChange={e=>{setCustomerQuery(e.target.value);setSalesForm(f=>({...f,customer_name:e.target.value,business_no:""}));setShowCustDrop(true);}}
                    onFocus={()=>setShowCustDrop(true)} placeholder="거래처명 또는 사업자번호" className={fhInp}/>
                  {showCustDrop&&filteredCustomers.length>0&&(
                    <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.map(c=>(
                        <button key={c.id} type="button" onClick={()=>{setSalesForm(f=>({...f,customer_name:c.name,business_no:c.business_no||""}));setCustomerQuery(c.name);setShowCustDrop(false);}}
                          className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-50 last:border-0">
                          <p className="text-xs font-semibold text-[#0f172a]">{c.name}</p>
                          <p className="text-[10px] text-gray-400">{c.business_no||"-"}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={fhLbl}>Maker</label><input value={salesForm.maker} onChange={e=>setSalesForm(f=>({...f,maker:e.target.value}))} placeholder="예: MAXAM" className={fhInp}/></div>
                <div><label className={fhLbl}>규격</label><input value={salesForm.spec} onChange={e=>setSalesForm(f=>({...f,spec:e.target.value}))} placeholder="예: 815-15" className={fhInp}/></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={fhLbl}>수량</label><input type="number" value={salesForm.quantity} onChange={e=>setSalesForm(f=>({...f,quantity:e.target.value}))} className={fhInp}/></div>
                <div><label className={fhLbl}>판매단가</label><input type="number" value={salesForm.unit_price} onChange={e=>setSalesForm(f=>({...f,unit_price:e.target.value}))} className={fhInp}/></div>
                <div><label className={fhLbl}>매입단가</label><input type="number" value={salesForm.unit_cost} onChange={e=>setSalesForm(f=>({...f,unit_cost:e.target.value}))} className={fhInp}/></div>
              </div>
              <div><label className={fhLbl}>입금일자</label><input type="date" value={salesForm.payment_date} onChange={e=>setSalesForm(f=>({...f,payment_date:e.target.value}))} className="h-10 rounded-xl border border-gray-200 px-3 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 transition-all w-48"/></div>
              <div className="flex gap-4">
                {([["tax_invoice","계산서"],["payment_confirmed","입금확인"]] as [keyof FH_SalesFormData,string][]).map(([k,label])=>(
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <div onClick={()=>setSalesForm(f=>({...f,[k]:!f[k]}))}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${salesForm[k]?"bg-orange-500 border-orange-500":"bg-white border-gray-300"}`}>
                      {salesForm[k]&&<FhCheck className="w-3 h-3 text-white"/>}
                    </div>
                    <span className="text-xs font-medium text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
              <div><label className={fhLbl}>비고</label><textarea value={salesForm.note} onChange={e=>setSalesForm(f=>({...f,note:e.target.value}))} rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 resize-none transition-all"/></div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={()=>setShowSalesForm(false)} className={fhBtnS}>취소</button>
              <button onClick={saveSales} disabled={savingSales} className={fhBtnP}>
                {savingSales?<FhLoader2 className="w-4 h-4 animate-spin"/>:<FhCheck className="w-4 h-4"/>}
                {salesEditId?"수정 저장":"저장"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* ── 매입 수정 모달 ── */}
      {showPurchaseForm&&ReactDOM.createPortal(
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto pt-[140px] pb-8 px-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-[#0f172a]">매입 정보 확인/수정</h2>
              <button onClick={()=>setShowPurchaseForm(false)} className="text-gray-400 hover:text-gray-600"><FhX className="w-5 h-5"/></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><label className={fhLbl}>종류</label>
                  <select value={purchaseForm.category} onChange={e=>setPurchaseForm(f=>({...f,category:e.target.value}))} className={fhInp}>
                    {FH_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className={fhLbl}>구분</label>
                  <select value={purchaseForm.trade_type} onChange={e=>setPurchaseForm(f=>({...f,trade_type:e.target.value as "국내"|"수입"}))} className={fhInp}>
                    <option value="국내">국내 (VAT 10%)</option><option value="수입">수입 (영세율)</option>
                  </select>
                </div>
              </div>
              <div><label className={fhLbl}>매입처</label>
                <input value={purchaseForm.supplier_name} onChange={e=>setPurchaseForm(f=>({...f,supplier_name:e.target.value}))} className={fhInp}/>
                {purchaseForm.business_no&&<p className="mt-0.5 text-[10px] text-gray-400">사업자번호: {purchaseForm.business_no}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={fhLbl}>Maker</label><input value={purchaseForm.maker} onChange={e=>setPurchaseForm(f=>({...f,maker:e.target.value}))} className={fhInp}/></div>
                <div><label className={fhLbl}>규격</label><input value={purchaseForm.spec} onChange={e=>setPurchaseForm(f=>({...f,spec:e.target.value}))} className={fhInp}/></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={fhLbl}>수량</label><input type="number" value={purchaseForm.quantity} onChange={e=>setPurchaseForm(f=>({...f,quantity:e.target.value}))} className={fhInp}/></div>
                <div><label className={fhLbl}>매입단가 (VAT 제외)</label><input type="number" value={purchaseForm.unit_price} onChange={e=>setPurchaseForm(f=>({...f,unit_price:e.target.value}))} className={fhInp}/></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={fhLbl}>발행일자</label><input type="date" value={purchaseForm.purchase_date} onChange={e=>setPurchaseForm(f=>({...f,purchase_date:e.target.value}))} className={fhInp}/></div>
                <div><label className={fhLbl}>지급일자</label><input type="date" value={purchaseForm.payment_date} onChange={e=>setPurchaseForm(f=>({...f,payment_date:e.target.value}))} className={fhInp}/></div>
              </div>
              <div className="flex gap-4">
                {([["tax_invoice","계산서 수취"],["payment_confirmed","지급완료"]] as [keyof FH_PurchaseFormData,string][]).map(([k,label])=>(
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <div onClick={()=>setPurchaseForm(f=>({...f,[k]:!f[k]}))}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${purchaseForm[k]?"bg-orange-500 border-orange-500":"bg-white border-gray-300"}`}>
                      {purchaseForm[k]&&<FhCheck className="w-3 h-3 text-white"/>}
                    </div>
                    <span className="text-xs font-medium text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
              <div><label className={fhLbl}>비고</label><textarea value={purchaseForm.note} onChange={e=>setPurchaseForm(f=>({...f,note:e.target.value}))} rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400 resize-none transition-all"/></div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={()=>setShowPurchaseForm(false)} className={fhBtnS}>취소</button>
              <button onClick={savePurchase} disabled={savingPurchase} className={fhBtnP}>
                {savingPurchase?<FhLoader2 className="w-4 h-4 animate-spin"/>:<FhCheck className="w-4 h-4"/>}저장
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* ── 계산서 매칭 모달 ── */}
      {showMatchModal&&ReactDOM.createPortal(
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto pt-[140px] pb-8 px-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-[#0f172a]">계산서 매칭</h2>
              <button onClick={()=>setShowMatchModal(false)} className="text-gray-400 hover:text-gray-600"><FhX className="w-5 h-5"/></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5"><FhFileText className="w-3.5 h-3.5"/>계산서 정보</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {([{label:"작성일자",key:"issue_date" as const,type:"date"},{label:"계산서번호",key:"invoice_no" as const,type:"text"},{label:"거래처명",key:"customer_name" as const,type:"text"},{label:"사업자번호",key:"business_no" as const,type:"text"},{label:"공급가액",key:"supply_amount" as const,type:"number"},{label:"합계금액",key:"total_amount" as const,type:"number"}]).map(f=>(
                    <div key={f.key}><label className={fhLbl}>{f.label}</label>
                      <input type={f.type} value={invForm[f.key]} onChange={e=>setInvForm(p=>({...p,[f.key]:e.target.value}))} className={fhInpSm}/>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <FhSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input value={matchSearch} onChange={e=>setMatchSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loadMatchCandidates(matchSearch)}
                    placeholder="거래처명으로 미매칭 매출건 검색" className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-orange-400"/>
                </div>
                <button onClick={()=>loadMatchCandidates(matchSearch)} className={fhBtnS}><FhSearch className="w-4 h-4"/>검색</button>
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-50">
                {loadingCandidates?(
                  <div className="flex items-center justify-center py-6 text-gray-400 text-xs gap-2"><FhLoader2 className="w-4 h-4 animate-spin text-orange-500"/>불러오는 중...</div>
                ):matchCandidates.length===0?(
                  <div className="py-6 text-center text-xs text-gray-400 space-y-1">
                    <p>미매칭 매출건이 없습니다.</p>
                    <p className="text-emerald-600 font-medium">↓ 아래 '신규 생성 후 매칭'으로 계산서 기반 매출을 자동 생성할 수 있습니다.</p>
                  </div>
                ):matchCandidates.map(c=>{
                  const checked=matchSelectedIds.has(c.id);const alreadyMatched=c.invoice_id!=null;
                  return(
                    <label key={c.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${checked?"bg-orange-50":alreadyMatched?"bg-blue-50":"hover:bg-gray-50"}`}>
                      <div onClick={e=>{e.preventDefault();setMatchSelectedIds(prev=>{const n=new Set(prev);checked?n.delete(c.id):n.add(c.id);return n;});}}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked?"bg-orange-500 border-orange-500":"bg-white border-gray-300"}`}>
                        {checked&&<FhCheck className="w-3 h-3 text-white"/>}
                      </div>
                      <span className="text-[10px] text-gray-400 w-20 shrink-0">{c.sale_date}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${FH_CAT_COLOR[c.category]||"bg-gray-100 text-gray-600"}`}>{c.category}</span>
                      <span className="text-xs font-semibold text-[#0f172a] whitespace-nowrap">{c.customer_name}</span>
                      <span className="text-[10px] text-gray-500 truncate flex-1">{[c.maker,c.spec].filter(Boolean).join(" / ")||"-"}</span>
                      {alreadyMatched&&<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium shrink-0">재매칭</span>}
                      <span className="text-xs font-semibold text-[#0f172a] whitespace-nowrap">{fhFmt(c.total_revenue||0)}</span>
                    </label>
                  );
                })}
              </div>
              <div className={`rounded-xl border px-3 py-2.5 flex flex-wrap items-center justify-between gap-3 ${matchIsClose&&matchTotal>0?"border-emerald-200 bg-emerald-50":"border-gray-100 bg-gray-50"}`}>
                <div><p className="text-[10px] text-gray-400">선택 합계</p><p className="text-xs font-semibold text-[#0f172a] mt-0.5">{fhFmt(matchSelectedSum)} ({matchSelectedIds.size}건)</p></div>
                <div><p className="text-[10px] text-gray-400">계산서 합계</p><p className="text-xs font-semibold text-[#0f172a] mt-0.5">{fhFmt(matchTotal)}</p></div>
                <div><p className="text-[10px] text-gray-400">차이</p><p className={`text-xs font-semibold mt-0.5 ${matchIsClose?"text-emerald-600":"text-red-500"}`}>{fhFmt(matchTotal-matchSelectedSum)}{matchIsClose&&matchTotal>0?" · 일치":""}</p></div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={createAndMatch} disabled={matchSaving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition-all disabled:opacity-50">
                {matchSaving?<FhLoader2 className="w-4 h-4 animate-spin"/>:<FhPlus className="w-4 h-4"/>}
                신규 생성 후 매칭
              </button>
              <div className="flex gap-2">
                <button onClick={()=>setShowMatchModal(false)} className={fhBtnS}>취소</button>
                <button onClick={confirmMatch} disabled={matchSaving||matchSelectedIds.size===0} className={fhBtnP}>
                  {matchSaving?<FhLoader2 className="w-4 h-4 animate-spin"/>:<FhLink2 className="w-4 h-4"/>}
                  매칭 확정 ({matchSelectedIds.size}건)
                </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}

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
              <button className="text-xs text-emerald-600 hover:underline ml-2 flex-shrink-0" onClick={()=>window.open(`/work/call-management?id=${s.consultation_id}`,"_blank")}>열기→</button>
            )}
            {a.type==="consult_update"&&s?.id&&(
              <button className="text-xs text-emerald-600 hover:underline ml-2 flex-shrink-0" onClick={()=>window.open(`/work/call-management?id=${s.id}`,"_blank")}>상담내역→</button>
            )}
            {a.type==="hyundaicm_update"&&s?.id&&(
              <button className="text-xs text-blue-600 hover:underline ml-2 flex-shrink-0" onClick={()=>window.open(`/hyundaicm?id=${s.id}`,"_blank")}>현대건설기계→</button>
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
  onRefresh, onNavigate,
  BTS, BTG, BTP, TA2, CARD, md2html, fmtDate,
}:any) {
  // onNavigate(path_or_tab, dealId?) — dealId가 있으면 탭 이동 + 딜 선택
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
  const FINANCE_STAGE_LBL:Record<string,string> = {consulting:"상담",quote_submitted:"견적제출",approved:"승인",rejected:"거절",documents_requested:"서류등록",confirmed:"확정",received:"접수",credit_check:"신용조회",supplement:"보완",cancelled:"취소"};
  const getConsultDisplayStatus = (c:any) => {
    if(c.work_type==="finance" && c.finance_stage) return c.finance_stage;
    if(["tire","tire_sales","battery","battery_sales","forklift","forklift_sales"].includes(c.work_type) && c.process_stage) return c.process_stage;
    return c.status;
  };
  const StsBadgeLocal = ({s,isFinance}:{s:string;isFinance?:boolean}) => {
    const ALL_LBL:Record<string,string> = {new:"신규",pending:"대기",processing:"진행중",in_progress:"진행중",completed:"완료",done:"완료",closed:"완료",on_hold:"보류",waiting_customer:"고객대기",approved:"승인",confirmed:"확정",rejected:"거절",cancelled:"취소",supplement:"보완",forwarded:"진흥전달",delivered:"납품완료",wheel_returned:"휠반납",invoiced:"계산서발행",credit_check:"신용조회",received:"접수",contract:"계약",delivery:"납품",
      // 레거시 완결 → 계산서발행, 보험 단계
      completed_order:"계산서발행", design_request:"접수(설계요청)", policy_issued:"완료(증권발급)",
      // 레거시 상담/견적 단계
      consulting:"계약", quote:"계약", quote_submitted:"신용조회", documents_requested:"서류등록",
      design_requested:"접수(설계요청)"};
    const lbl = isFinance ? (FINANCE_STAGE_LBL[s]??ALL_LBL[s]??s) : (ALL_LBL[s]??s);
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

                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{c.summary}</p>
              </div>

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
    거절:"bg-red-50 text-red-600", 확정:"bg-[#0f172a] text-white", 보류:"bg-orange-50 text-orange-700",
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
            <button className={BTG} onClick={()=>onNavigate("/hyundaicm")}>전체 보기 →</button>
          </div>
          {statusLoading?<p className="text-xs text-gray-400">불러오는 중...</p>
          :hyundaiTasks.length===0?<p className="text-xs text-gray-400 py-4 text-center">데이터가 없습니다</p>
          :(
            <div className="space-y-2">
              {hyundaiTasks.slice(0,6).map((t:any)=>{
                const stsCls = HCM_STS_CLR_LOCAL[t.status]??"bg-gray-100 text-gray-500";
                return (
                  <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 hover:bg-blue-50 transition-all cursor-pointer" onClick={()=>onNavigate(`/hyundaicm?id=${t.id}`)}>
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
            <button className={BTG} onClick={()=>onNavigate("/narumi")}>전체 보기 →</button>
          </div>
          {statusLoading?<p className="text-xs text-gray-400">불러오는 중...</p>
          :narumiTasks.length===0?<p className="text-xs text-gray-400 py-4 text-center">데이터가 없습니다</p>
          :(
            <div className="space-y-2">
              {narumiTasks.slice(0,6).map((t:any)=>{
                const NARUMI_STS_LBL:Record<string,string> = {completed:"완료",registered:"등록완료",docs:"서류준비",insurance:"보험확인",consulting:"상담중",in_progress:"진행중",pending:"대기",cancelled:"취소",done:"완료"};
                const stsLbl = NARUMI_STS_LBL[t.status]??t.status??"진행중";
                const stsCls = !t.status?"bg-gray-100 text-gray-500":["completed","registered","done"].includes(t.status)?"bg-emerald-50 text-emerald-700":["pending","docs"].includes(t.status)?"bg-amber-50 text-amber-700":"bg-blue-50 text-blue-700";
                return (
                  <div key={t.id} className={`flex items-center gap-2 p-2.5 rounded-xl transition-all cursor-pointer ${t.is_urgent?"bg-red-50 hover:bg-red-100":"bg-gray-50 hover:bg-emerald-50"}`} onClick={()=>onNavigate(`/narumi?id=${t.id}`)}>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${stsCls}`}>{stsLbl}</span>
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

    </div>
  );
}
// ─── 현대건설기계 상태 변경 확인 카드 ──────────────────────────────────────────
type HyundaiMatch = {id:number;customer_name:string;status:string;caseNo:string;equipment_ton:string|null;finance_company:string|null;customer_type:string;sales_rep:string|null;installment_principal:number|null};
type PendingHyundaiUpdate = {action:Record<string,unknown>;matches:HyundaiMatch[]};

const HCM_STS_CLR:Record<string,string> = {
  접수:"bg-gray-100 text-gray-600", 신용조회:"bg-blue-50 text-blue-700",
  승인:"bg-emerald-50 text-emerald-700", 보완:"bg-amber-50 text-amber-700",
  거절:"bg-red-50 text-red-600", 확정:"bg-[#0f172a] text-white",
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
let _popupSetterRegistered = false;

function CalPopupPortal() {
  const [popup, setPopup] = useState<PopupData|null>(null);
  const setterRef = useRef(setPopup);
  setterRef.current = setPopup; // 항상 최신 setter 유지

  useEffect(()=>{
    // 항상 최신 setPopup으로 업데이트 (cleanup 없이 덮어쓰기)
    _setPopup = (p) => setterRef.current(p);
    _popupSetterRegistered = true;
    return ()=>{
      // 언마운트 시에만 null 처리
      _setPopup = null;
      _popupSetterRegistered = false;
    };
  },[]);
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

  // 언마운트 시 팝업 즉시 닫기 + 타이머 정리
  useEffect(()=>{ return ()=>{ if(hideTimer.current) clearTimeout(hideTimer.current); _setPopup?.(null); }; },[]);

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
  // calSchedules가 있을 때만 업데이트 (빈 배열로 기존 데이터 덮어쓰기 방지)
  if(calSchedules.length > 0 || schMapRef.current.size === 0) schMapRef.current = schMap;

  const tdoMap = new Map<string,CalTdo[]>();
  for(const t of calTodos){
    if(!tdoMap.has(t.due_date))tdoMap.set(t.due_date,[]);
    tdoMap.get(t.due_date)!.push(t);
  }
  tdoMapRef.current = tdoMap;

  // 로컬 일정 제목 집합 — 공백/대소문자 무시하여 구글 캘린더 중복 제거 (완전 일치만)
  const localTitles = new Set(calSchedules.map(s=>s.title.trim().toLowerCase().replace(/\s+/g," ")));

  const gcalMap = new Map<string,{id:string;title:string;color:string}[]>();
  for(const e of (gcalEvents??[])){
    if(!e.start) continue;
    const normalized = e.title.trim().toLowerCase().replace(/\s+/g," ");
    // 로컬에 동일 제목(완전 일치)이 있으면 구글 항목 제외
    if(localTitles.has(normalized)) continue;
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
    // ref와 함께 현재 렌더의 최신 map 직접 참조
    const sc = schMapRef.current.get(dt)??[];
    const tc = tdoMapRef.current.get(dt)??[];
    const gc = gcalMapRef.current.get(dt)??[];
    if(sc.length===0 && tc.length===0 && gc.length===0) return;
    if(hideTimer.current){clearTimeout(hideTimer.current);hideTimer.current=null;}
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // _setPopup이 null이면 재등록 시도
    if(!_setPopup) return;
    _setPopup({
      x: r.right,
      y: r.top,
      schedules: sc,
      todos: tc,
      gcalEvents: gc,
      dateLabel: `${parseInt(dt.slice(5,7))}월 ${parseInt(dt.slice(8))}일`,
    });
  }
  function hidePopup(){
    if(hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(()=>{ _setPopup?.(null); hideTimer.current=null; }, 150);
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
  // ─── PWA standalone 모드 감지 ─────────────────────────────────────────────
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;

  if(!user||(!isAdmin&&!isSubAdmin))return <Navigate to="/" replace/>;

  const [tab,setTab] = useState<TabKey>(()=>{ try{return (sessionStorage.getItem("sec_tab") as TabKey)||"schedule";}catch{return "schedule";} });
  const setTabAndSave = (t:TabKey)=>{ try{sessionStorage.setItem("sec_tab",t);}catch{} setTab(t); };

  // 일정
  const [schedules,setSchedules]     = useState<Schedule[]>([]);
  const [schedLoading,setSchedLoading] = useState(false);
  const [schedDate,setSchedDate]     = useState(todayStr);
  const [schedViewMode,setSchedViewMode] = useState<"day"|"week"|"all">("day");
  const [schedShowDone,setSchedShowDone] = useState(false);
  const [allSchedules,setAllSchedules]   = useState<Schedule[]>([]);
  const [allSchedLoading,setAllSchedLoading] = useState(false);
  const [showSchedForm,setShowSchedForm] = useState(false);
  const [schedModal,setSchedModal] = useState<{s:Schedule}|null>(null);
  const [dupModal,setDupModal] = useState<{
    candidates:{id:number;title:string;schedule_date:string;category:string;is_done:boolean}[];
    pendingText:string;
  }|null>(null);
  const [dupSelected,setDupSelected] = useState<Set<number>>(new Set());
  const [schedProgress,setSchedProgress] = useState({memo:"",next_date:"",next_time:""});
  const [newSched,setNewSched] = useState({title:"",description:"",schedule_date:todayStr(),start_time:nowTimeStr(),end_time:"",category:"meeting" as Schedule["category"],location:"",related_type:"",consultation_id:""});

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

  // 금융상담 탭
  const [financeConsults,setFinanceConsults] = useState<OrderView[]>([]);
  const [financeLoading,setFinanceLoading] = useState(false);
  const [financeFilter,setFinanceFilter] = useState<"active"|"all"|"done">("active");
  const [showRepayModal,setShowRepayModal] = useState(false);
  const [repayForm,setRepayForm] = useState({
    recipientName:"", recipientPhone:"", recipientEmail:"", customerName:"", vehicleModel:"",
    vehiclePrice:"", downPaymentRate:"20",
    principal:"", gracePeriod:"3", installmentPeriod:"36", interestRate:"",
    sendMethod:"kakao" as "kakao"|"email"|"sms",
  });
  const [repayStartYM,setRepayStartYM] = useState(()=>{
    const d = new Date(); d.setMonth(d.getMonth()+1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
  const [repaySending,setRepaySending] = useState(false);
  const repayTableRef = useRef<HTMLDivElement>(null);

  // ── 원리금균등분납 상환스케줄 계산 (거치기간 지원) ──
  const calcRepayAmortization = (principal:number, annualRate:number, months:number, startYM:string, gracePeriod:number=0) => {
    const r = annualRate/100/12;
    const grace = Math.max(0, Math.min(gracePeriod, months));
    const installmentMonths = months - grace;
    const payment = installmentMonths<=0 ? 0
      : r===0 ? principal/installmentMonths
      : (principal*r*Math.pow(1+r,installmentMonths))/(Math.pow(1+r,installmentMonths)-1);
    const rows:{no:number;date:string;payment:number;interest:number;principalPmt:number;balance:number}[] = [];
    let balance = principal;
    const [sy,sm] = startYM.split("-").map(Number);
    for(let i=1;i<=months;i++){
      const interest = balance*r;
      const d = new Date(sy, sm-1+(i-1), 1);
      const date = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.01`;
      if(i<=grace){
        rows.push({no:i,date,payment:Math.round(interest),interest:Math.round(interest),principalPmt:0,balance:Math.round(balance)});
      } else {
        const principalPmt = payment-interest;
        balance = Math.max(0, balance-principalPmt);
        rows.push({no:i,date,payment:Math.round(payment),interest:Math.round(interest),principalPmt:Math.round(principalPmt),balance:Math.round(balance)});
      }
    }
    return { payment: Math.round(payment), rows };
  };

  // 현대CM 탭
  const [hcmFilter,setHcmFilter] = useState<"active"|"all"|"done">("active");
  const [hcmExpanded,setHcmExpanded] = useState<number|null>(null);
  const [hcmLoading,setHcmLoading] = useState(false);
  const [hcmList,setHcmList] = useState<HyundaiTask[]>([]);
  const [taesanFilter,setTaesanFilter] = useState<"active"|"all"|"done">("active");
  const [taesanExpanded,setTaesanExpanded] = useState<number|null>(null);
  const [taesanLoading,setTaesanLoading] = useState(false);
  const [taesanList,setTaesanList] = useState<TaesanTask[]>([]);
  const [hcmConsults,setHcmConsults] = useState<OrderView[]>([]);
  const [hcmSelectedId,setHcmSelectedId] = useState<number|null>(null);
  // 나르미 탭
  const [narumiLoading2,setNarumiLoading2] = useState(false);
  const [narumiList,setNarumiList] = useState<NarumiTask[]>([]);
  const [narumiFilter,setNarumiFilter] = useState<"active"|"all"|"done">("active");
  const [narumiConsults,setNarumiConsults] = useState<OrderView[]>([]);
  const [narumiSelectedId,setNarumiSelectedId] = useState<number|null>(null);
  // 진흥주문 탭
  const [jFilter,setJFilter] = useState<"active"|"all"|"done">("active");
  const [jExpanded,setJExpanded] = useState<string|null>(null);
  const [jLoading,setJLoading] = useState(false);
  const [jList,setJList] = useState<any[]>([]);
  const jListReqRef = useRef(0); // tb_orders 목록 fetch 경쟁 상태 방지용 토큰
  const [jConsults,setJConsults] = useState<OrderView[]>([]);
  const [jConsultsLoading,setJConsultsLoading] = useState(false);
  const [showJNewForm,setShowJNewForm] = useState(false);
  const [jNewSaving,setJNewSaving] = useState(false);
  const [jNewForm,setJNewForm] = useState({customer_name:"",product_spec:"",quantity:"",memo:""});
  const [jAmtModal,setJAmtModal] = useState<any|null>(null);
  const [jAmtTo,setJAmtTo] = useState("");
  const [jAmtFrom,setJAmtFrom] = useState("");
  const [jSaving,setJSaving] = useState(false);
  // 계산서발행 시 이미지 업로드 강제 모달
  const [jInvoiceModal,setJInvoiceModal] = useState<any|null>(null);
  const [jInvoiceFile,setJInvoiceFile] = useState<File|null>(null);
  const [jInvoiceUploading,setJInvoiceUploading] = useState(false);
  // 주문상담 탭 — 타이어/배터리 계산서발행 시 이미지 업로드 강제 모달
  const [orderInvoiceModal,setOrderInvoiceModal] = useState<OrderView|null>(null);
  const [orderInvoiceFile,setOrderInvoiceFile] = useState<File|null>(null);
  const [orderInvoiceUploading,setOrderInvoiceUploading] = useState(false);
  const [orderInvoiceAmtTo,setOrderInvoiceAmtTo] = useState("");
  const [orderInvoiceAmtFrom,setOrderInvoiceAmtFrom] = useState("");
  // 여러 건 묶어서 계산서 발행 (합산 청구)
  const [orderSelectMode,setOrderSelectMode] = useState(false);
  const [orderSelectedIds,setOrderSelectedIds] = useState<Set<number>>(new Set());
  const [orderBulkInvoiceModal,setOrderBulkInvoiceModal] = useState<OrderView[]|null>(null);
  const [orderBulkInvoiceFile,setOrderBulkInvoiceFile] = useState<File|null>(null);
  const [orderBulkInvoiceUploading,setOrderBulkInvoiceUploading] = useState(false);

  // 주문
  const [orders,setOrders]           = useState<Order[]>([]);
  const [orderViews,setOrderViews]   = useState<OrderView[]>([]);
  const [ordViewLoading,setOrdViewLoading] = useState(false);
  const [orderLoading,setOrderLoading] = useState(false);
  const [ordFilter,setOrdFilter]     = useState(()=>{ try{return sessionStorage.getItem("sec_ord_filter")||"active";}catch{return "active";} });
  const setOrdFilterAndSave = (f:string)=>{ try{sessionStorage.setItem("sec_ord_filter",f);}catch{} setOrdFilter(f); };
  const [showOrderForm,setShowOrderForm] = useState(false);
  const [expandedOrder,setExpandedOrder] = useState<number|null>(null);
  const [orderSearch,setOrderSearch] = useState("");
  const [syncConsult,setSyncConsult] = useState(true);
  const [newOrder,setNewOrder] = useState({customer_name:"",phone:"",channel:"kakao" as Order["channel"],work_type:"",summary:"",detail:"",telecom_provider:"",region:""});

  // 상담
  const [followups,setFollowups]     = useState<Consult[]>([]);
  const [recentC,setRecentC]         = useState<Consult[]>([]);

  // 메모
  const [memos,setMemos]             = useState<Memo[]>([]);
  const [memoLoading,setMemoLoading] = useState(false);
  const [memoFilter,setMemoFilter]   = useState<"all"|"meeting"|"call"|"visit"|"note">("all");
  const [memoSearch,setMemoSearch]   = useState("");
  const [showMemoForm,setShowMemoForm] = useState(false);
  const [memoDetail,setMemoDetail]   = useState<Memo|null>(null);
  const [newMemo,setNewMemo]         = useState({title:"",content:"",category:"meeting" as Memo["category"],related_name:"",memo_date:new Date().toISOString().slice(0,10),consultation_id:""});
  const [cLoading,setCLoading]       = useState(false);
  // Apple Notes 가져오기
  const [showNotesImport,setShowNotesImport]     = useState(false);
  const [notesRawText,setNotesRawText]           = useState("");
  const [notesImporting,setNotesImporting]       = useState(false);
  const [notesImportResult,setNotesImportResult] = useState<{saved:number;skipped:number;items:{title:string;date:string;summary:string}[]}|null>(null);

  // 채팅
  const [msgs,setMsgs]               = useState<ChatMsg[]>([]);
  const [histLoading,setHistLoading] = useState(true);
  const [chatInput,setChatInput]     = useState("");
  const [chatLoading,setChatLoading] = useState(false);
  const [autoSave,setAutoSave]       = useState(true);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const headerBarRef = useRef<HTMLDivElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [headerBarHeight, setHeaderBarHeight] = useState(128);

  // 달력 데이터
  const [calSch,setCalSch] = useState<CalSch[]>([]);
  const [calTdo,setCalTdo] = useState<CalTdo[]>([]);
  // 현재 캘린더가 보고 있는 연/월 추적
  const [calViewYear,setCalViewYear]   = useState(new Date().getFullYear());
  const [calViewMonth,setCalViewMonth] = useState(new Date().getMonth());
  // 구글 캘린더
  const [gcalConnected,setGcalConnected] = useState(false);
  const [gcalEmail,setGcalEmail] = useState<string|null>(null);
  const [gcalEvents,setGcalEvents] = useState<{id:string;title:string;start:string;color?:string}[]>([]);
  const [gcalImporting,setGcalImporting] = useState(false);
  const [gcalBulkSyncing,setGcalBulkSyncing] = useState(false);
  const [gcalBulkResult,setGcalBulkResult] = useState<string|null>(null);

  // 이메일 리포트
  const [emailReports,setEmailReports] = useState<EmailReport[]>([]);
  const [emailLoading,setEmailLoading] = useState(false);
  const [emailDetail,setEmailDetail] = useState<EmailReport|null>(null);

  const loadMemos = useCallback(async()=>{
    setMemoLoading(true);
    const {data} = await supabase
      .from("secretary_memos")
      .select("*")
      .order("memo_date",{ascending:false})
      .order("created_at",{ascending:false});
    setMemos(data??[]);
    setMemoLoading(false);
  },[]);

  const saveMemo = useCallback(async(m:typeof newMemo)=>{
    const {error} = await supabase.from("secretary_memos").insert({
      title: m.title||null,
      content: m.content,
      category: m.category,
      related_name: m.related_name||null,
      memo_date: m.memo_date,
      consultation_id: m.consultation_id ? Number(m.consultation_id) : null,
    });
    if(!error){ void loadMemos(); return true; }
    return false;
  },[loadMemos]);

  const deleteMemo = useCallback(async(id:number)=>{
    await supabase.from("secretary_memos").delete().eq("id",id);
    setMemos(prev=>prev.filter(m=>m.id!==id));
    if(memoDetail?.id===id) setMemoDetail(null);
  },[memoDetail]);

  // ── Apple Notes 붙여넣기 → AI 요약 → secretary_memos 저장 ──────────────────
  const importNotesText = useCallback(async(rawText:string)=>{
    if(!rawText.trim()) return;
    setNotesImporting(true);
    setNotesImportResult(null);
    try {
      // Claude API로 미팅별 분리 + 요약
      const aiRes = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:2000,
          system:`You are a Korean business secretary AI. Parse Apple Notes Meeting History text into individual records.
Return ONLY a raw JSON array, no markdown, no code fences.
Each element: {"title":"제목","memo_date":"YYYY-MM-DD","category":"meeting|call|visit|note","related_name":"회사명 or null","summary":"핵심내용 2~4문장 한국어 요약"}
- title: 날짜+회사+미팅 형태 (예: [4/21] 동성종합지게차 미팅)
- memo_date: 본문 날짜 추출, 연도 없으면 현재 연도(${new Date().getFullYear()}) 사용
- category: meeting(미팅/회의), call(통화), visit(방문), note(기타)
- related_name: 고객사·거래처명, 없으면 null
- summary: 핵심 논의사항만 간결하게`,
          messages:[{role:"user",content:`다음 Apple Notes Meeting History 내용을 분석해주세요:\n\n${rawText.slice(0,8000)}`}],
        }),
      });
      const aiData = await aiRes.json();
      const raw = (aiData.content?.[0]?.text??"[]").trim()
        .replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/\s*```\s*$/,"").trim();
      let parsed:{title:string;memo_date:string;category:string;related_name:string|null;summary:string}[]=[];
      try{ parsed=JSON.parse(raw.startsWith("[") ? raw : `[${raw}]`); }catch{ parsed=[]; }

      // 중복 체크: 같은 날짜+제목 이미 저장된 항목 건너뜀
      const {data:existing} = await supabase.from("secretary_memos").select("title,memo_date").limit(300);
      const existSet = new Set((existing??[]).map((m:any)=>`${m.memo_date}||${m.title}`));

      let saved=0, skipped=0;
      const items:{title:string;date:string;summary:string}[]=[];
      for(const item of parsed){
        if(existSet.has(`${item.memo_date}||${item.title}`)){ skipped++; continue; }
        const cat=(["meeting","call","visit","note"].includes(item.category)?item.category:"meeting") as Memo["category"];
        const {error}=await supabase.from("secretary_memos").insert({
          title:        item.title,
          content:      item.summary,
          category:     cat,
          related_name: item.related_name??null,
          memo_date:    item.memo_date,
        });
        if(!error){ saved++; items.push({title:item.title,date:item.memo_date,summary:item.summary}); }
      }
      setNotesImportResult({saved,skipped,items});
      if(saved>0) void loadMemos();
    }catch(e:any){
      alert(`가져오기 오류: ${String(e?.message??e)}`);
    }finally{
      setNotesImporting(false);
    }
  },[loadMemos]);

  const loadEmailReports = useCallback(async()=>{
    setEmailLoading(true);
    const {data} = await supabase
      .from("email_reports")
      .select("*")
      .order("created_at",{ascending:false})
      .limit(50);
    if(data) setEmailReports(data as EmailReport[]);
    setEmailLoading(false);
  },[]);

  const markEmailRead = async(id:number)=>{
    await supabase.from("email_reports").update({is_read:true}).eq("id",id);
    setEmailReports(prev=>prev.map(r=>r.id===id?{...r,is_read:true}:r));
  };

  const deleteEmailReport = async(id:number)=>{
    await supabase.from("email_reports").delete().eq("id",id);
    setEmailReports(prev=>prev.filter(r=>r.id!==id));
    if(emailDetail?.id===id) setEmailDetail(null);
  };

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
      supabase.from("secretary_schedules").select("id,title,schedule_date,start_time,category,is_done,progress_stage,work_type").gte("schedule_date",from).lte("schedule_date",to),
      supabase.from("secretary_todos").select("id,title,due_date,priority,is_done").gte("due_date",from).lte("due_date",to).eq("is_done",false),
    ]);
    if(sr.data) setCalSch(sr.data as CalSch[]);
    if(tr.data) setCalTdo(tr.data as CalTdo[]);
  },[]);

  // ─── 구글 캘린더 ─────────────────────────────────────────────────────────────
  const checkGcalConnection = useCallback(async()=>{
    if(!user) return;
    const {data} = await supabase.from("google_calendar_tokens").select("user_id,gcal_email").eq("user_id",user.id).maybeSingle();
    setGcalConnected(!!data);
    setGcalEmail((data as any)?.gcal_email ?? null);
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
        // 신/구 포맷 모두 지원: 문자열("google-calendar-connected") 또는 { type, email }
        const isConnected = e.data==="google-calendar-connected" || e.data?.type==="google-calendar-connected";
        if(isConnected){
          window.removeEventListener("message",handler);
          setGcalConnected(true);
          const email = e.data?.email ?? null;
          setGcalEmail(email);
          void loadGcalEvents(new Date().getFullYear(),new Date().getMonth());
          showToast(email ? `구글 캘린더 연동 완료! 🎉 (${email})` : "구글 캘린더 연동 완료! 🎉");
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
    setGcalEmail(null);
    setGcalEvents([]);
    showToast("구글 캘린더 연동 해제");
  }

  // ─── 구글 캘린더 → AI비서 역방향 가져오기 ────────────────────────────────────
  async function importGcalToLocal(yr:number, mo:number){
    if(!user || !gcalConnected) return;
    setGcalImporting(true);
    try {
      // 1. 이번 달 구글 캘린더 이벤트 가져오기
      const {data:{session}} = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({action:"list",user_id:user.id,year:yr,month:mo}),
      });
      const d = await res.json();
      if(!d.events?.length){ showToast("가져올 새 일정이 없습니다"); return; }

      // 2. 로컬에 있는 일정 제목+날짜 집합 조회
      const from = `${yr}-${String(mo+1).padStart(2,"0")}-01`;
      const lastDay = new Date(yr, mo+1, 0).getDate();
      const to = `${yr}-${String(mo+1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      const {data:localScheds} = await supabase.from("secretary_schedules")
        .select("title,schedule_date").gte("schedule_date",from).lte("schedule_date",to);
      const localSet = new Set(
        (localScheds??[]).map((s:any)=>`${s.schedule_date}||${s.title.trim().toLowerCase()}`)
      );

      // 3. 로컬에 없는 구글 이벤트만 필터링
      const toInsert = (d.events as any[]).filter(e=>{
        const date = e.start?.date || e.start?.dateTime?.slice(0,10) || "";
        if(!date) return false;
        const title = (e.summary??"(제목없음)").trim().toLowerCase();
        return !localSet.has(`${date}||${title}`);
      });

      if(toInsert.length === 0){ showToast("이미 모든 일정이 동기화되어 있습니다 ✅"); return; }

      // 4. secretary_schedules에 일괄 insert
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
      const {error} = await supabase.from("secretary_schedules").insert(rows);
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

  // 일정 저장 후 구글 캘린더에도 동기화
  async function syncToGcal(schedule:{id:number;title:string;description:string|null;schedule_date:string;start_time:string|null;end_time:string|null;location:string|null}, isTodo=false){
    if(!user||!gcalConnected) return;
    try{
      const {data:{session}} = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({action:"create",user_id:user.id,event:{...schedule,schedule_id:schedule.id}}),
      });
      const d = await res.json();
      if(d.error){
        console.error("gcal sync error:", d.error, d.raw);
        showToast("⚠️ 구글 캘린더 동기화 실패: " + d.error + " — 재연동이 필요할 수 있습니다", "err");
        return;
      }
      // 응답에서 생성된 이벤트를 즉시 gcalEvents 상태에 추가
      if(d.event){
        const newEvt = {
          id: d.event.id ?? String(Date.now()),
          title: d.event.summary ?? schedule.title,
          start: d.event.start?.date || d.event.start?.dateTime?.slice(0,10) || schedule.schedule_date,
          color: "#4285f4",
        };
        setGcalEvents(prev=>[...prev, newEvt]);
        // 중복 동기화 방지: 생성된 구글 이벤트 ID를 원본 레코드에 저장
        if(d.event.id){
          if(isTodo){
            await supabase.from("secretary_todos").update({ gcal_event_id: d.event.id }).eq("id", schedule.id);
          } else {
            await supabase.from("secretary_schedules").update({ gcal_event_id: d.event.id }).eq("id", schedule.id);
            setSchedules(prev=>prev.map(s=>s.id===schedule.id?{...s, gcal_event_id: d.event.id} as any:s));
          }
        }
        void loadCalData(calViewYear, calViewMonth);
      } else {
        await new Promise(r=>setTimeout(r,1500));
        void loadGcalEvents(calViewYear, calViewMonth);
      }
    }catch(e){console.error("gcal sync error",e);}
  }

  // 일정 삭제 시 구글 캘린더에서도 삭제
  async function deleteFromGcal(gcalEventId: string | null | undefined){
    if(!user || !gcalConnected || !gcalEventId) return;
    try{
      const {data:{session}} = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session?.access_token??""}`},
        body:JSON.stringify({action:"delete",user_id:user.id,event_id:gcalEventId}),
      });
      setGcalEvents(prev=>prev.filter(e=>e.id!==gcalEventId));
    }catch(e){console.error("gcal delete error",e);}
  }

  // ─── 기존 항목 전체 구글 캘린더 일괄 동기화 ──────────────────────────────────
  async function bulkSyncToGcal(){
    if(!user||!gcalConnected) return;
    setGcalBulkSyncing(true);
    setGcalBulkResult(null);
    try{
      const today = todayStr();
      // 1. 오늘 이후 일정 중 gcal_event_id 없는 것
      const {data:scheds} = await supabase.from("secretary_schedules")
        .select("id,title,description,schedule_date,start_time,end_time,location")
        .gte("schedule_date", today)
        .is("gcal_event_id", null)
        .eq("is_done", false);
      // 2. 오늘 이후 할 일 중 due_date 있고, 아직 구글캘린더 미동기화인 것
      const {data:todos} = await supabase.from("secretary_todos")
        .select("id,title,description,due_date")
        .gte("due_date", today)
        .is("gcal_event_id", null)
        .eq("is_done", false);

      const schedList = scheds ?? [];
      const todoList  = todos  ?? [];
      let ok = 0, fail = 0;

      for(const s of schedList){
        try{
          await syncToGcal({
            id: s.id, title: s.title,
            description: s.description??null,
            schedule_date: s.schedule_date,
            start_time: s.start_time??null,
            end_time: s.end_time??null,
            location: s.location??null,
          });
          ok++;
          await new Promise(r=>setTimeout(r,200)); // API 레이트 리밋 방지
        }catch{ fail++; }
      }
      for(const t of todoList){
        try{
          await syncToGcal({
            id: t.id, title: `✅ ${t.title}`,
            description: t.description??null,
            schedule_date: t.due_date,
            start_time: null, end_time: null, location: null,
          }, true);
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

  const loadChatHist = useCallback(async(initial=false)=>{
    if(initial) setHistLoading(true);
    // 최신 200개를 내림차순으로 가져온 뒤 역순 정렬 → 항상 최신 대화 포함
    const {data} = await supabase.from("secretary_chat_logs").select("role,content,created_at").order("created_at",{ascending:false}).limit(200);
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
    const d = new Date(schedDate); d.setDate(d.getDate()+1);
    const nextDay = d.toISOString().slice(0,10);

    // 선택 날짜 미완료 일정 + 과거 미완료 일정 병렬 조회
    const [r1, r2] = await Promise.all([
      // 선택 날짜 ~ 다음날 (미완료만)
      supabase.from("secretary_schedules").select("*")
        .gte("schedule_date", schedDate).lte("schedule_date", nextDay)
        .eq("is_done", false)
        .order("schedule_date", {ascending:true}).order("start_time", {ascending:true}),
      // 선택 날짜 이전 미완료 일정
      supabase.from("secretary_schedules").select("*")
        .lt("schedule_date", schedDate).eq("is_done", false)
        .order("schedule_date", {ascending:true}).order("start_time", {ascending:true}),
    ]);

    // 과거 미완료를 앞에, 선택 날짜 일정을 뒤에 합산
    const merged = [
      ...((r2.data ?? []) as Schedule[]),
      ...((r1.data ?? []) as Schedule[]),
    ];

    // consultation_id가 있는 일정의 진행단계 조회
    const cids = [...new Set(merged.filter(s=>s.consultation_id).map(s=>s.consultation_id as number))];
    if(cids.length > 0){
      const [caseR, finR, tireR, fklR, battR] = await Promise.all([
        supabase.from("consultation_cases").select("id,work_type").in("id",cids),
        supabase.from("consultation_finance_details").select("consultation_id,finance_stage").in("consultation_id",cids),
        supabase.from("consultation_tire_details").select("consultation_id,process_stage,process_status").in("consultation_id",cids),
        supabase.from("consultation_forklift_details").select("consultation_id,process_stage,forklift_status").in("consultation_id",cids),
        supabase.from("consultation_battery_details").select("consultation_id,process_stage").in("consultation_id",cids),
      ]);
      const wtMap:Record<number,string>={};
      (caseR.data??[]).forEach((c:any)=>{ wtMap[c.id]=c.work_type; });
      const stageMap:Record<number,string>={};
      (finR.data??[]).forEach((r:any)=>{ if(r.finance_stage) stageMap[r.consultation_id]=r.finance_stage; });
      (tireR.data??[]).forEach((r:any)=>{ const s=r.process_stage??r.process_status; if(s) stageMap[r.consultation_id]=s; });
      (fklR.data??[]).forEach((r:any)=>{ const s=r.process_stage??r.forklift_status; if(s) stageMap[r.consultation_id]=s; });
      (battR.data??[]).forEach((r:any)=>{ if(r.process_stage) stageMap[r.consultation_id]=r.process_stage; });
      const enriched = merged.map(s=>s.consultation_id
        ? {...s, progress_stage: stageMap[s.consultation_id]??null, work_type: wtMap[s.consultation_id]??null}
        : s
      );
      setSchedules(enriched);
    } else {
      setSchedules(merged);
    }
    setSchedLoading(false);
  },[schedDate]);

  const loadAllSchedules = useCallback(async(mode:"week"|"all", baseDate:string, showDone:boolean)=>{
    setAllSchedLoading(true);
    let from = baseDate, to = "2099-12-31";
    if(mode==="week"){
      const d=new Date(baseDate);
      // 이번 주 월요일
      const day=d.getDay(); const diff=day===0?-6:1-day;
      d.setDate(d.getDate()+diff);
      from=d.toISOString().slice(0,10);
      const d2=new Date(d); d2.setDate(d2.getDate()+6);
      to=d2.toISOString().slice(0,10);
    } else {
      // 전체: 1개월 전부터 3개월 후까지
      const d=new Date(baseDate); d.setMonth(d.getMonth()-1);
      from=d.toISOString().slice(0,10);
      const d2=new Date(baseDate); d2.setMonth(d2.getMonth()+3);
      to=d2.toISOString().slice(0,10);
    }
    let q = supabase.from("secretary_schedules").select("*")
      .gte("schedule_date",from).lte("schedule_date",to)
      .order("schedule_date",{ascending:true}).order("start_time",{ascending:true});
    if(!showDone) q=q.eq("is_done",false);
    const {data}=await q;
    if(data) setAllSchedules(data as Schedule[]);
    setAllSchedLoading(false);
  },[]);

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

  // 주문내역: consultation_cases + hyundaicm_tasks + narumi_tasks 통합 조회
  const loadOrderViews = useCallback(async()=>{
    setOrdViewLoading(true);

    const HCM_DONE   = ["confirmed","cancelled","확정","취소","거절","rejected"];
    const HCM_ACTIVE_NOT = HCM_DONE;

    // 세 소스 병렬 조회
    const [casesRes, hcmRes, narumiRes] = await Promise.all([
      // consultation_cases (보험 제외, 최근 100건)
      // finance는 finance_stage 기준이므로 status 필터 없이 전체 조회 후 클라이언트에서 분류
      supabase
        .from("consultation_cases")
        .select("id,customer_name,work_type,status,summary,created_at,phone,sub_type")
        .neq("work_type","registration_insurance")
        .order("created_at",{ascending:false})
        .limit(200),

      // hyundaicm_tasks
      (ordFilter==="done"
        ? supabase.from("hyundaicm_tasks").select("id,customer_name,status,equipment_ton,finance_company,installment_principal,created_at").in("status", HCM_DONE)
        : ordFilter==="active"
        ? supabase.from("hyundaicm_tasks").select("id,customer_name,status,equipment_ton,finance_company,installment_principal,created_at").not("status","in",`(${HCM_ACTIVE_NOT.join(",")})`)
        : supabase.from("hyundaicm_tasks").select("id,customer_name,status,equipment_ton,finance_company,installment_principal,created_at")
      ).order("created_at",{ascending:false}).limit(100),

      // narumi_tasks
      (ordFilter==="done"
        ? supabase.from("narumi_tasks").select("id,customer_name,status,vehicle_model,vehicle_no,created_at").in("status",["completed","registered"])
        : ordFilter==="active"
        ? supabase.from("narumi_tasks").select("id,customer_name,status,vehicle_model,vehicle_no,created_at").not("status","in","(completed,registered)")
        : supabase.from("narumi_tasks").select("id,customer_name,status,vehicle_model,vehicle_no,created_at")
      ).order("created_at",{ascending:false}).limit(100),
    ]);

    const cases = casesRes.data ?? [];
    const ids = cases.map((c:any)=>c.id);

    // detail 테이블 병렬 조회 (consultation_cases ids가 있을 때만)
    const [tireR,battR,fklR,finR,expR,ordR] = ids.length > 0 ? await Promise.all([
      supabase.from("consultation_tire_details").select("consultation_id,tire_size,vehicle_info,vehicle_type,process_status,process_stage").in("consultation_id",ids),
      supabase.from("consultation_battery_details").select("consultation_id,battery_voltage,battery_capacity_ah,battery_vehicle_type,battery_quantity,process_stage").in("consultation_id",ids),
      supabase.from("consultation_forklift_details").select("consultation_id,forklift_ton,forklift_type,forklift_status,forklift_sale_method,process_stage").in("consultation_id",ids),
      supabase.from("consultation_finance_details").select("consultation_id,finance_stage,finance_amount,finance_vehicle_model").in("consultation_id",ids),
      supabase.from("consultation_export_details").select("consultation_id,export_stage,product_name,destination_country,process_stage").in("consultation_id",ids),
      supabase.from("secretary_orders").select("id,consultation_id,status").in("consultation_id",ids),
    ]) : [{data:[]},{data:[]},{data:[]},{data:[]},{data:[]},{data:[]}];

    // detail map 구성
    const tireMap: Record<number,any> = {};
    const battMap: Record<number,any> = {};
    const fklMap:  Record<number,any> = {};
    const finMap:  Record<number,any> = {};
    const expMap:  Record<number,any> = {};
    const ordMap:  Record<number,any> = {};
    tireR.data?.forEach((r:any)=>{ tireMap[r.consultation_id]=r; });
    battR.data?.forEach((r:any)=>{ battMap[r.consultation_id]=r; });
    fklR.data?.forEach((r:any)=>  { fklMap[r.consultation_id]=r;  });
    finR.data?.forEach((r:any)=>  { finMap[r.consultation_id]=r;  });
    expR.data?.forEach((r:any)=>  { expMap[r.consultation_id]=r;  });
    ordR.data?.forEach((r:any)=>  { ordMap[r.consultation_id]=r;  });

    // consultation_cases → OrderView
    const caseViews: OrderView[] = cases.map((c:any)=>{
      const wt = c.work_type as string;
      let progress_stage: string|null = null;
      let product_detail: string|null = null;

      if(wt==="tire_sales"){ const d=tireMap[c.id]; if(d){ progress_stage=d.process_stage??d.process_status; product_detail=[d.tire_size,d.vehicle_info,d.vehicle_type].filter(Boolean).join(" / "); }}
      else if(wt==="battery_sales"){ const d=battMap[c.id]; if(d){ progress_stage=d.process_stage??null; product_detail=[d.battery_vehicle_type,d.battery_voltage?d.battery_voltage+"V":null,d.battery_capacity_ah?d.battery_capacity_ah+"Ah":null,d.battery_quantity?d.battery_quantity+"개":null].filter(Boolean).join(" / "); }}
      else if(wt==="forklift_sales"){ const d=fklMap[c.id]; if(d){
        progress_stage=d.process_stage??d.forklift_status;
        const fklTypeLbl:Record<string,string>={seated:"좌승",standing:"입승",electric_seated:"전동좌승",electric_standing:"전동입승",reach:"리치",order_picker:"오더피커"};
        const fklSaleLbl:Record<string,string>={cash:"현금",rental:"렌탈",lease:"리스",installment:"할부"};
        product_detail=[
          d.forklift_ton?d.forklift_ton:"",
          d.forklift_type?(fklTypeLbl[d.forklift_type]??d.forklift_type):"",
          d.forklift_sale_method?(fklSaleLbl[d.forklift_sale_method]??d.forklift_sale_method):"",
        ].filter(Boolean).join(" / ");
      }}
      else if(wt==="finance"){ const d=finMap[c.id]; if(d){ progress_stage=d.finance_stage; product_detail=[d.finance_vehicle_model,d.finance_amount?Number(d.finance_amount).toLocaleString()+"만원":null].filter(Boolean).join(" / "); }}
      else if(wt==="export"){ const d=expMap[c.id]; if(d){ progress_stage=d.process_stage??d.export_stage; product_detail=[d.product_name,d.destination_country].filter(Boolean).join(" / "); }}
      const ord = ordMap[c.id];
      return {
        id:c.id, customer_name:c.customer_name, work_type:wt, status:c.status,
        summary:c.summary, created_at:c.created_at, phone:c.phone??null,
        progress_stage, product_detail, sub_type:c.sub_type??null,
        secretary_order_id: ord?.id??null, secretary_order_status: ord?.status??null,
      };
    });

    // consultation_cases ordFilter 클라이언트 필터링
    const filteredCaseViews = caseViews.filter(v=>{
      // finance: finance_stage 기준
      if(v.work_type==="finance"){
        const doneStages = ["confirmed","cancelled","rejected","closed"];
        const isDone = doneStages.includes(v.progress_stage??v.status??"");
        if(ordFilter==="done") return isDone;
        if(ordFilter==="active") return !isDone;
        return true;
      }
      // 타이어/지게차/배터리: progress_stage(process_status) 기준 — 나르미와 동일
      if(["tire_sales","forklift_sales","battery_sales","tire"].includes(v.work_type??"")){
        const doneStages = ["invoiced","cancelled"];
        const isDone = doneStages.includes(v.progress_stage??"") || ["completed","closed","invoiced"].includes(v.status??"");
        if(ordFilter==="done") return isDone;
        if(ordFilter==="active") return !isDone;
        return true;
      }
      // 그 외: status 기준 (cancelled 추가)
      const doneStatuses = ["completed","closed","invoiced","cancelled"];
      const isDone = doneStatuses.includes(v.status??"");
      if(ordFilter==="done") return isDone;
      if(ordFilter==="active") return !isDone;
      return true;
    });

    // hyundaicm_tasks → OrderView
    const hcmViews: OrderView[] = (hcmRes.data ?? []).map((h:any)=>{
      const parts = [
        h.equipment_ton ? h.equipment_ton+"톤" : null,
        h.finance_company ?? null,
        h.installment_principal ? Math.round(h.installment_principal/10000).toLocaleString()+"만원" : null,
      ].filter(Boolean);
      return {
        id: h.id,
        customer_name: h.customer_name ?? "-",
        work_type: "finance_hcm",
        status: h.status ?? "-",
        summary: parts.join(" / ") || "-",
        created_at: h.created_at,
        phone: null,
        progress_stage: h.status ?? null,
        product_detail: parts.join(" / ") || null,
        sub_type: null,
        secretary_order_id: null,
        secretary_order_status: null,
      };
    });

    // narumi_tasks → OrderView
    const narumiViews: OrderView[] = (narumiRes.data ?? []).map((n:any)=>{
      const product_detail = [n.vehicle_model, n.vehicle_no].filter(Boolean).join(" ") || null;
      return {
        id: n.id,
        customer_name: n.customer_name ?? "-",
        work_type: "narumi",
        status: n.status ?? "-",
        summary: product_detail || "-",
        created_at: n.created_at,
        phone: null,
        progress_stage: n.status ?? null,
        product_detail,
        sub_type: null,
        secretary_order_id: null,
        secretary_order_status: null,
      };
    });

    // 합치고 created_at 내림차순 정렬
    const allViews = [...filteredCaseViews, ...hcmViews, ...narumiViews]
      .sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setOrderViews(allViews);
    setOrdViewLoading(false);
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
      const FIN_LBL_S:Record<string,string> = {consulting:"상담중",received:"접수",credit_check:"신용조회",approved:"승인",supplement:"보완",rejected:"거절",confirmed:"확정",cancelled:"취소"};

      // 타이어/배터리/지게차 process_stage 조회 (업무현황 탭 단계 표시 일치를 위함)
      const cids = cr.data.map((c:any)=>c.id as number);
      const [tireR, battR, forkR] = await Promise.all([
        supabase.from("consultation_tire_details").select("consultation_id,process_status,process_stage").in("consultation_id",cids),
        supabase.from("consultation_battery_details").select("consultation_id,process_stage").in("consultation_id",cids),
        supabase.from("consultation_forklift_details").select("consultation_id,process_stage,forklift_status").in("consultation_id",cids),
      ]);
      const psMap:Record<number,string> = {};
      (tireR.data??[]).forEach((d:any)=>{ psMap[d.consultation_id]=d.process_stage??d.process_status; });
      (battR.data??[]).forEach((d:any)=>{ if(d.process_stage) psMap[d.consultation_id]=d.process_stage; });
      (forkR.data??[]).forEach((d:any)=>{ if(d.process_stage||d.forklift_status) psMap[d.consultation_id]=d.process_stage??d.forklift_status; });

      setRecentC(cr.data.map((c:any)=>{
        const fs = fdMap[c.id];
        return {
          ...c,
          finance_stage: fs ?? null,
          display_status: c.work_type==="finance" && fs ? FIN_LBL_S[fs]??fs : null,
          process_stage: psMap[c.id] ?? null,
        };
      }) as Consult[]);
    }
    setStatusLoading(false);
  },[]);

  const loadConsults = useCallback(async()=>{
    setCLoading(true);
    const [fr,rr,fdr] = await Promise.all([
      supabase.from("consultation_cases").select("id,customer_name,phone,telecom_provider,work_type,status,summary,followup_needed,next_followup_date,created_at").eq("followup_needed",true).eq("next_followup_date",todayStr()).order("created_at",{ascending:false}).limit(10),
      supabase.from("consultation_cases").select("id,customer_name,phone,telecom_provider,work_type,status,summary,followup_needed,next_followup_date,created_at").order("created_at",{ascending:false}).limit(8),
      supabase.from("consultation_finance_details").select("consultation_id,finance_stage"),
    ]);
    const FIN_LBL:Record<string,string> = {consulting:"상담중",received:"접수",credit_check:"신용조회",approved:"승인",supplement:"보완",rejected:"거절",confirmed:"확정",cancelled:"취소"};
    const fdMap:Record<number,string> = {};
    (fdr.data??[]).forEach((f:any)=>{ fdMap[f.consultation_id]=f.finance_stage; });
    if(fr.data)setFollowups(fr.data as Consult[]);

    if(rr.data && rr.data.length > 0){
      const cids = rr.data.map((c:any)=>c.id as number);
      const [tireR, battR, forkR] = await Promise.all([
        supabase.from("consultation_tire_details").select("consultation_id,process_status,process_stage").in("consultation_id",cids),
        supabase.from("consultation_battery_details").select("consultation_id,process_stage").in("consultation_id",cids),
        supabase.from("consultation_forklift_details").select("consultation_id,process_stage,forklift_status").in("consultation_id",cids),
      ]);
      const psMap:Record<number,string> = {};
      (tireR.data??[]).forEach((d:any)=>{ psMap[d.consultation_id]=d.process_stage??d.process_status; });
      (battR.data??[]).forEach((d:any)=>{ if(d.process_stage) psMap[d.consultation_id]=d.process_stage; });
      (forkR.data??[]).forEach((d:any)=>{ if(d.process_stage||d.forklift_status) psMap[d.consultation_id]=d.process_stage??d.forklift_status; });
      setRecentC(rr.data.map((c:any)=>({
        ...c,
        display_status: c.work_type==="finance" ? (fdMap[c.id] ?? null) : null,
        process_stage: psMap[c.id] ?? null,
      })) as Consult[]);
    }
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
      }
    });
    return ()=>subscription.unsubscribe();
  },[loadStats, loadChatHist, loadCalData]);
  const prevMsgLen = useRef(0);
  // 탭 바 가로 스크롤 — 모바일 터치 스와이프
  useEffect(()=>{
    // 초기 위치: 중간 벌(2번째 세트) 시작 지점으로 설정
    const el = tabScrollRef.current;
    if(el) {
      setTimeout(()=>{ el.scrollLeft = el.scrollWidth / 3; }, 50);
    }
  },[]);

  useEffect(()=>{
    const el = tabScrollRef.current;
    if(!el) return;
    let startX = 0;
    let startScroll = 0;
    let velocityX = 0;
    let lastX = 0;
    let lastTime = 0;
    let rafId = 0;

    const onStart = (e: TouchEvent) => {
      cancelAnimationFrame(rafId);
      startX = e.touches[0].clientX;
      lastX = startX;
      startScroll = el.scrollLeft;
      lastTime = Date.now();
      velocityX = 0;
    };
    const onMove = (e: TouchEvent) => {
      const now = Date.now();
      const dx = startX - e.touches[0].clientX;
      velocityX = (e.touches[0].clientX - lastX) / (now - lastTime || 1);
      lastX = e.touches[0].clientX;
      lastTime = now;
      el.scrollLeft = startScroll + dx;
      e.preventDefault();
    };
    const onEnd = () => {
      // 모멘텀 스크롤
      let vel = -velocityX * 12;
      const momentum = () => {
        if(Math.abs(vel) < 0.5) return;
        el.scrollLeft += vel;
        vel *= 0.92;
        rafId = requestAnimationFrame(momentum);
      };
      rafId = requestAnimationFrame(momentum);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  },[]);
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
      setSchedViewMode("day");
      void loadSchedules();
      void loadTodos();
      // 구글 캘린더 → AI비서 자동 역방향 동기화
      if(gcalConnected) void importGcalToLocal(calViewYear, calViewMonth);
    }
    if(tab==="status"){ void loadStatusData(); }
    if(tab==="chat"){ setTimeout(()=>{ const c=chatContainerRef.current; if(c)c.scrollTop=c.scrollHeight; },100); }
  },[tab, loadStatusData]);
  // 캘린더 날짜 클릭 시 해당 날짜 일정 재조회
  useEffect(()=>{ if(tab==="schedule") void loadSchedules(); },[schedDate]);
  useEffect(()=>{if(tab==="orders"){void loadOrderViews();void loadConsults();}},[tab,loadOrderViews,loadConsults]);

  useEffect(()=>{
    if(tab!=="hyundaicm") return;
    setHcmLoading(true);
    supabase.from("hyundaicm_tasks").select("*").order("created_at",{ascending:false}).limit(60)
      .then(({data})=>{setHcmList((data??[]) as HyundaiTask[]);setHcmLoading(false);});
  },[tab]);

  useEffect(()=>{
    if(tab!=="taesan") return;
    setTaesanLoading(true);
    supabase.from("taesan_tasks").select("*").order("created_at",{ascending:false}).limit(60)
      .then(({data})=>{setTaesanList((data??[]) as TaesanTask[]);setTaesanLoading(false);});
  },[tab]);

  useEffect(()=>{
    if(tab!=="finance") return;
    setFinanceLoading(true);
    supabase.from("consultation_cases")
      .select("id,customer_name,work_type,status,summary,created_at,phone,sub_type")
      .eq("work_type","finance")
      .order("created_at",{ascending:false}).limit(60)
      .then(async({data})=>{
        const cases = data??[];
        const ids = cases.map((c:any)=>c.id);
        let stageMap:Record<number,string> = {};
        if(ids.length>0){
          const {data:fd} = await supabase.from("consultation_finance_details")
            .select("consultation_id,finance_stage,finance_amount,finance_vehicle_model")
            .in("consultation_id",ids);
          (fd??[]).forEach((d:any)=>{ stageMap[d.consultation_id]=d.finance_stage; });
        }
        const FIN_LBL:Record<string,string> = {
          consulting:"상담중", received:"접수", credit_check:"신용조회",
          approved:"승인", supplement:"보완", rejected:"거절",
          confirmed:"확정", cancelled:"취소"
        };
        setFinanceConsults(cases.map((c:any)=>({
          ...c,
          progress_stage: stageMap[c.id] ?? null,
          finance_stage_label: FIN_LBL[stageMap[c.id]] ?? stageMap[c.id] ?? null,
          product_detail: null,
        })));
        setFinanceLoading(false);
      });
  },[tab]);

  useEffect(()=>{
    if(tab!=="narumi") return;
    setNarumiLoading2(true);
    Promise.all([
      supabase.from("narumi_tasks").select("*").order("created_at",{ascending:false}).limit(60),
      supabase.from("consultation_cases").select("id,customer_name,work_type,status,summary,created_at,phone,sub_type").eq("work_type","registration_insurance").order("created_at",{ascending:false}).limit(40),
    ]).then(([nRes,cRes])=>{
      setNarumiList((nRes.data??[]) as NarumiTask[]);
      setNarumiLoading2(false);
      setNarumiConsults((cRes.data??[]).map((c:any)=>({...c,progress_stage:null,product_detail:null})));
    });
  },[tab]);

  useEffect(()=>{
    if(tab!=="jinheung") return;
    const myReq = ++jListReqRef.current;
    setJLoading(true);
    setJConsultsLoading(true);
    Promise.all([
      supabase.from("tb_orders").select("*").order("created_at",{ascending:false}).limit(60),
      supabase.from("consultation_cases").select("id,customer_name,work_type,status,summary,created_at,phone,sub_type").in("work_type",["tire","tire_sales"]).order("created_at",{ascending:false}).limit(60),
    ]).then(async([ordRes,cRes])=>{
      if(myReq!==jListReqRef.current) return; // 더 최신 요청(신규등록 후 새로고침 등)이 이미 있었다면 이 결과는 버림
      setJList(ordRes.data??[]);
      setJLoading(false);
      const cases = cRes.data??[];
      // tire details에서 process_status + 휠반납/금액 조회
      const ids = cases.map((c:any)=>c.id);
      let tireMap:Record<number,{stage:string|null;wheel_returned_at:string|null;price_to_customer:number|null;price_from_jinheung:number|null}> = {};
      if(ids.length>0){
        const {data:tds} = await supabase.from("consultation_tire_details")
          .select("consultation_id,process_status,process_stage,tire_size,vehicle_info,vehicle_type,wheel_returned_at,price_to_customer,price_from_jinheung")
          .in("consultation_id",ids);
        (tds??[]).forEach((d:any)=>{
          tireMap[d.consultation_id] = {
            stage: d.process_stage ?? d.process_status,
            wheel_returned_at: d.wheel_returned_at ?? null,
            price_to_customer: d.price_to_customer ?? null,
            price_from_jinheung: d.price_from_jinheung ?? null,
          };
        });
      }
      if(myReq!==jListReqRef.current) return;
      setJConsults(cases.map((c:any)=>({
        ...c,
        progress_stage: tireMap[c.id]?.stage ?? null,
        wheel_returned_at: tireMap[c.id]?.wheel_returned_at ?? null,
        price_to_customer: tireMap[c.id]?.price_to_customer ?? null,
        price_from_jinheung: tireMap[c.id]?.price_from_jinheung ?? null,
        product_detail:null,
      })));
      setJConsultsLoading(false);
    });
  },[tab]);
  useEffect(()=>{if(tab==="email"){void loadEmailReports();}},[tab,loadEmailReports]);
  useEffect(()=>{if(tab==="memo"){void loadMemos();}},[tab,loadMemos]);

  // ─── 일정 CRUD ──────────────────────────────────────────────────────────────
  async function addSchedule(){
    if(!newSched.title)return;
    if(newSched.category==="followup"&&newSched.consultation_id){
      // 일정 등록 시 consultation_cases followup 자동 업데이트 제거 (일정으로 통합 관리)
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
      setNewSched({title:"",description:"",schedule_date:todayStr(),start_time:nowTimeStr(),end_time:"",category:"meeting",location:"",related_type:"",consultation_id:""});
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
      // 다음 일정을 먼저 생성하고, 성공했을 때만 기존 일정을 완료 처리한다.
      // (기존 코드는 이 insert의 성공 여부를 확인하지 않아, 실패해도 기존 일정이
      //  그냥 완료 처리되어 "다음 일정 없이 완료만 되는" 현상이 발생했음)
      const {data:newSchedData, error:insertError} = await supabase.from("secretary_schedules").insert({
        title: s.title,
        description: newMemo,
        schedule_date: schedProgress.next_date,
        start_time: schedProgress.next_time || null,
        category: s.category,
        location: s.location,
        related_type: s.related_type,
        consultation_id: s.consultation_id,
        is_done: false,
      }).select("id").single();

      if (insertError || !newSchedData) {
        showToast("다음 일정 등록 실패: " + (insertError?.message ?? "알 수 없는 오류"));
        return; // 기존 일정은 완료 처리하지 않고 중단 — 모달은 열어둔 채로 재시도 가능
      }

      patch.next_schedule_date = schedProgress.next_date;
      patch.next_schedule_time = schedProgress.next_time || null;
      patch.is_done = true; // 다음 일정 등록에 성공했을 때만 기존 일정 자동 완료 처리

      // 구글 캘린더 동기화 — 새로 등록된 다음 일정
      if(gcalConnected){
        void syncToGcal({
          id: newSchedData.id,
          title: s.title,
          description: newMemo,
          schedule_date: schedProgress.next_date,
          start_time: schedProgress.next_time || null,
          end_time: null,
          location: s.location,
        });
      }
    }

    const {error:updateError} = await supabase.from("secretary_schedules").update(patch).eq("id",s.id);
    if (updateError) {
      showToast("경과 저장 실패: " + updateError.message);
      return;
    }
    await loadSchedules();
    setSchedModal(null);
    setSchedProgress({memo:"",next_date:"",next_time:""});
    showToast("경과 저장 완료" + (schedProgress.next_date ? " + 다음 일정 등록" : ""));
    void loadCalData(calViewYear, calViewMonth);
  }

  async function delSched(id:number){
    // 삭제 전 gcal_event_id 조회 → 구글 캘린더에서도 삭제
    const { data: row } = await supabase.from("secretary_schedules").select("gcal_event_id").eq("id", id).maybeSingle();
    await supabase.from("secretary_schedules").delete().eq("id",id);
    if (row?.gcal_event_id) void deleteFromGcal(row.gcal_event_id);
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
    if(!error){
      showToast("할일 저장 완료");
      setShowTodoForm(false);
      setNewTodo({title:"",description:"",priority:"normal",category:"",due_date:"",consultation_id:""});
      void loadTodos(); void loadStats(); void loadCalData(calViewYear, calViewMonth);
      // due_date 있으면 구글 캘린더 등록
      if(gcalConnected && newTodo.due_date){
        const {data:td} = await supabase.from("secretary_todos").select("id,title,due_date").eq("title",newTodo.title).order("created_at",{ascending:false}).limit(1).maybeSingle();
        if(td) void syncToGcal({id:td.id,title:`✅ ${td.title}`,description:newTodo.description||null,schedule_date:td.due_date,start_time:null,end_time:null,location:null}, true);
      }
    }
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
        work_type:wm[newOrder.work_type]??newOrder.work_type,status:"in_progress",
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
      const m:Record<string,string>={done:"completed",processing:"in_progress",new:"in_progress",pending:"on_hold"};
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

  // 진행단계 포맷 (주문내역용)
  const fmtProgress = (wt:string, stage:string|null):string => {
    if(!stage) return "-";
    // 공통 단계
    const COMMON:Record<string,string> = {consulting:"상담",quote:"견적",contract:"계약",delivery:"납품",invoiced:"계산서발행",cancelled:"취소",
      // 보험
      design_request:"접수(설계요청)", policy_issued:"완료(증권발급)"};
    if(COMMON[stage]) return COMMON[stage];
    // 타이어 레거시 — 나르미 formatCommonStage와 동일하게 맞춤
    const TIRE:Record<string,string> = {
      inquiry_received:"상담",   // 나르미: "상담"
      size_confirming:"상담",    // 나르미: "상담"
      quote_sent:"견적",          // 나르미: "견적"
      proposal:"견적",
      waiting_order:"계약",       // 나르미: "계약"
      waiting_payment:"계약",
      delivery_or_replacement:"납품",
      delivered:"납품",
      completed:"계산서발행",     // 나르미: "계산서발행"
      hold:"보류",
    };
    if(TIRE[stage]) return TIRE[stage];
    // 금융 / 현대CM
    const FIN:Record<string,string> = {received:"접수",credit_check:"신용조회",approved:"승인",supplement:"보완",rejected:"거절",confirmed:"확정"};
    if(FIN[stage]) return FIN[stage];
    // HCM 한글 status 그대로
    const HCM_KR = ["접수","신용조회","승인","보완","거절","확정","보류","취소"];
    if(HCM_KR.includes(stage)) return stage;
    return stage;
  };

  // 진행단계 컬러
  const progressColor = (stage:string|null):string => {
    if(!stage) return "text-gray-400";
    if(["invoiced","completed","confirmed","delivered","completed_order","확정"].includes(stage)) return "text-emerald-600 font-semibold";
    if(["cancelled","rejected","취소","거절"].includes(stage)) return "text-red-400";
    if(["closed"].includes(stage)) return "text-gray-500"; // 종결 — 회색
    if(["contract","approved","승인","보완","supplement"].includes(stage)) return "text-blue-600";
    if(["quote","proposal","credit_check"].includes(stage)) return "text-indigo-500";
    return "text-orange-500";
  };

  // ─── 중복 일정 감지 ──────────────────────────────────────────────────────────
  async function checkDupAndSend(){
    const text = chatInput.trim();
    if(!text || chatLoading) return;

    // 일정 관련 입력인지 판별
    // 날짜/시간 표현이 함께 있을 때만 일정으로 판단
    const dateTimePattern = /(\d+월\s*\d+일|\d+일|\d+시|\d+:\d+|오늘|내일|모레|다음주|이번주|월요일|화요일|수요일|목요일|금요일|토요일|일요일|내주|익일|오전|오후|아침|저녁)/;
    const schedKeywords = ["일정","미팅","방문","회의","출장","상담","점검","납품","반출"];
    const hasDateTime = dateTimePattern.test(text);
    const hasSchedKeyword = schedKeywords.some(k=>text.includes(k));
    const isSchedInput = hasDateTime && hasSchedKeyword;
    if(!isSchedInput){ void sendChat(); return; }

    // 시간/수식어 표현 제거 후 고객/거래처명 추출
    const timeWords = ["내일","오늘","모레","다음주","이번주","오전","오후","아침","저녁","월요일","화요일","수요일","목요일","금요일","토요일","일요일","내주","익일"];
    let cleaned = text;
    timeWords.forEach(w=>{ cleaned = cleaned.replace(new RegExp(w,"g"),""); });
    cleaned = cleaned.replace(/[0-9]+월\s*[0-9]+일/g,"").replace(/[0-9]+시/g,"").trim();

    // 고객/거래처명: 2글자 이상 한글/영문 단어 (조사/접속사 제외)
    const stopWords = new Set(["은","는","이","가","을","를","의","에","도","로","와","과","또는","그리고","후","전","및","등","때","일정","미팅","방문","상담","확인","점검","납품","반출","등록","필요","예정","진행","상황","점검"]);
    const tokens = cleaned.split(/[\s,]+/).filter(t=>t.length>=2 && !stopWords.has(t));
    if(tokens.length === 0){ void sendChat(); return; }

    // 각 토큰으로 DB 검색, 가장 많은 결과를 가져온 키워드 사용
    const since = new Date(); since.setDate(since.getDate()-14);
    const until = new Date(); until.setDate(until.getDate()+60);
    let allCandidates: any[] = [];

    for(const token of tokens.slice(0,3)){
      const {data} = await supabase
        .from("secretary_schedules")
        .select("id,title,schedule_date,category,is_done")
        .ilike("title", `%${token}%`)
        .gte("schedule_date", since.toISOString().slice(0,10))
        .lte("schedule_date", until.toISOString().slice(0,10))
        .order("schedule_date",{ascending:true})
        .limit(10);
      if(data) allCandidates = [...allCandidates, ...data];
    }

    // 중복 제거
    const seen = new Set<number>();
    const unique = allCandidates.filter(c=>{ if(seen.has(c.id)) return false; seen.add(c.id); return true; });

    if(unique.length === 0){ void sendChat(); return; }

    // 중복 후보 있으면 모달 표시
    setDupSelected(new Set());
    setDupModal({candidates: unique, pendingText: text});
  }

  async function sendChat(overrideText?:string){

    const text=(overrideText??chatInput).trim();
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
        body:JSON.stringify({messages:[{role:"user",content:text}],autoSave}),
      });
      const d=await res.json();
      const reply:string=d.reply??d.content?.[0]?.text??"응답을 받지 못했습니다.";
      const saved=d.saved??[], actions=d.actions??[], pendingUpdates=d.pendingUpdates??[], pendingHyundaiUpdates=d.pendingHyundaiUpdates??[];
      setMsgs(p=>[...p,{role:"assistant",content:reply,saved,actions,pendingUpdates,pendingHyundaiUpdates,ts:nowTs()}]);
      if(saved.length>0){
        void loadStats();
        if(saved.some((s:any)=>["schedule","schedule_edit","schedule_update"].includes(s.type))){
          // 당일 접수 사후관리 일정 → schedule_date가 내일 이후면 오늘로 보정
          const today = todayStr();
          const newSchedIds = saved.filter((s:any)=>s.type==="schedule").map((s:any)=>s.id);
          if(newSchedIds.length > 0){
            const {data:newScheds} = await supabase.from("secretary_schedules")
              .select("id,schedule_date,category").in("id",newSchedIds);
            const toFix = (newScheds??[]).filter((s:any)=>
              s.category==="followup" && s.schedule_date > today
            );
            for(const s of toFix){
              await supabase.from("secretary_schedules").update({schedule_date:today}).eq("id",s.id);
            }
          }
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
        if(saved.some((s:any)=>s.type==="todo")){
          void loadTodos(); void loadCalData(calViewYear, calViewMonth);
          // due_date 있는 todo는 구글 캘린더 등록
          if(gcalConnected){
            const todoItems = saved.filter((s:any)=>s.type==="todo" && s.id);
            for(const t of todoItems){
              const {data:td} = await supabase.from("secretary_todos").select("id,title,due_date,description").eq("id",t.id).maybeSingle();
              if(td?.due_date) void syncToGcal({id:td.id,title:`✅ ${td.title}`,description:td.description??null,schedule_date:td.due_date,start_time:null,end_time:null,location:null}, true);
            }
          }
        }
        if(saved.some((s:any)=>s.type==="order"))   { void loadOrderViews(); void loadStats(); }
        if(saved.some((s:any)=>s.type==="order_update")) { void loadOrders(); void loadStats(); }
        if(saved.some((s:any)=>s.type==="memo"))       { if(tab==="memo") void loadMemos(); }
        if(saved.some((s:any)=>s.type==="todo_edit"))  { void loadTodos(); void loadCalData(calViewYear, calViewMonth); }
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
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();e.stopPropagation();void checkDupAndSend();}
  }

  function quickChat(t:string){setTabAndSave("chat");setChatInput(t);setTimeout(()=>chatInputRef.current?.focus(),80);}

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

  // 주문내역 탭 스크롤 위치 저장/복원
  const ordScrollRef = useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    if(tab!=="orders") return;
    const saved = parseInt(sessionStorage.getItem("sec_ord_scroll")||"0");
    if(saved && ordScrollRef.current) setTimeout(()=>{ window.scrollTo({top:saved,behavior:"instant" as ScrollBehavior}); },100);
    const onScroll = ()=>{ try{sessionStorage.setItem("sec_ord_scroll",String(window.scrollY));}catch{} };
    window.addEventListener("scroll",onScroll,{passive:true});
    return ()=>window.removeEventListener("scroll",onScroll);
  },[tab]);

  // 헤더 높이 동적 측정
  useEffect(()=>{
    const el = headerBarRef.current;
    if(!el) return;
    const ob = new ResizeObserver(()=>{
      const rect = el.getBoundingClientRect();
      // PageHeader top 오프셋 + 헤더 자신 높이
      setHeaderBarHeight(rect.top + rect.height);
    });
    ob.observe(el);
    // 초기 측정
    const rect = el.getBoundingClientRect();
    setHeaderBarHeight(rect.top + rect.height);
    return ()=>ob.disconnect();
  },[]);

  // 푸터 숨기기 + standalone 모드에서 네비 숨기기
  useEffect(()=>{
    const footer = document.querySelector('footer') as HTMLElement|null;
    if(footer) footer.style.display='none';
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

  // 세션 자동 갱신 — 5분마다 체크, 만료 임박 시 갱신
  useEffect(()=>{
    const refresh = async()=>{
      const {data:{session}} = await supabase.auth.getSession();
      if(!session) return;
      const expiresAt = session.expires_at ?? 0;
      const now = Math.floor(Date.now()/1000);
      // 만료 10분 전이면 갱신
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

      {/* 일정 경과 기록 모달 */}
      {/* ── 중복 일정 감지 모달 ── */}
      {dupModal&&ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99995] flex items-center justify-center bg-black/50 px-4" onClick={()=>setDupModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-semibold text-[#0f172a]">🔍 유사 일정 발견</p>
              <button className="text-gray-400 hover:text-gray-600 text-lg" onClick={()=>setDupModal(null)}>✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              입력과 유사한 기존 일정입니다. 삭제할 항목을 선택하거나, 그냥 계속 진행하세요.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {dupModal.candidates.map(c=>(
                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${dupSelected.has(c.id)?"border-red-300 bg-red-50":"border-gray-200 bg-gray-50 hover:border-gray-300"}`}>
                  <input type="checkbox" className="w-4 h-4 accent-red-500"
                    checked={dupSelected.has(c.id)}
                    onChange={e=>{
                      setDupSelected(prev=>{
                        const next=new Set(prev);
                        e.target.checked?next.add(c.id):next.delete(c.id);
                        return next;
                      });
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${c.is_done?"line-through text-gray-400":"text-[#0f172a]"}`}>{c.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.schedule_date} · {c.category==="meeting"?"미팅":c.category==="followup"?"사후관리":c.category==="call"?"통화":"업무"} {c.is_done?"✅완료":""}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all disabled:opacity-40"
                disabled={dupSelected.size===0}
                onClick={async()=>{
                  if(dupSelected.size>0){
                    const ids=[...dupSelected];
                    const { data: rows } = await supabase.from("secretary_schedules").select("gcal_event_id").in("id",ids);
                    await supabase.from("secretary_schedules").delete().in("id",ids);
                    (rows??[]).forEach(r=>{ if(r.gcal_event_id) void deleteFromGcal(r.gcal_event_id); });
                    void loadSchedules(); void loadCalData(calViewYear,calViewMonth);
                    showToast(`${dupSelected.size}건 삭제됨`);
                  }
                  const txt=dupModal.pendingText;
                  setDupModal(null);
                  setTimeout(()=>void sendChat(txt),50);
                }}
              >{dupSelected.size>0?`${dupSelected.size}건 삭제 후 전송`:"삭제 후 전송"}</button>
              <button
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
                onClick={()=>{
                  const txt=dupModal.pendingText;
                  setDupModal(null);
                  setTimeout(()=>void sendChat(txt),50);
                }}
              >그냥 전송</button>
              <button
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-400 hover:bg-gray-50 transition-all"
                onClick={()=>setDupModal(null)}
              >취소</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {schedModal&&ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99990] flex items-end sm:items-center justify-center bg-black/60 px-0 sm:px-4" style={{backdropFilter:"blur(2px)"}} onClick={()=>setSchedModal(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md sm:max-w-md max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <p className="text-base font-semibold text-[#0f172a]">📝 일정 경과 기록</p>
              <button className="text-gray-400 hover:text-gray-600 text-lg" onClick={()=>setSchedModal(null)}>✕</button>
            </div>
            {/* 스크롤 영역 */}
            <div className="overflow-y-auto flex-1 px-5 pb-2">
              <div className="mb-3">
                <p className="text-sm font-medium text-[#0f172a]">{schedModal.s.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDate(schedModal.s.schedule_date)} {schedModal.s.start_time?fmtTime(schedModal.s.start_time):""} · {CAT_LBL[schedModal.s.category]}</p>
              </div>
              {schedModal.s.progress_memo&&(
                <div className="mb-3 bg-gray-50 rounded-xl p-3 max-h-24 overflow-y-auto">
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
                    <input type="time" step="600" className={CTRL} value={schedProgress.next_time} onChange={e=>setSchedProgress(p=>({...p,next_time:e.target.value}))}/>
                  </div>
                </div>
              </div>
            </div>
            {/* 버튼 영역 - 항상 하단 고정 */}
            <div className="flex gap-2 px-5 py-4 flex-shrink-0 border-t border-gray-100">
              <button className={BTP} onClick={()=>void saveSchedProgress(schedModal.s)} disabled={!schedProgress.memo&&!schedProgress.next_date}>
                {schedProgress.next_date?"저장 + 다음 일정":"경과 저장"}
              </button>
              <button className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-all"
                onClick={async()=>{
                  await supabase.from("secretary_schedules").update({is_done:true}).eq("id",schedModal.s.id);
                  if(schedProgress.memo) await saveSchedProgress(schedModal.s);
                  else { setSchedModal(null); void loadSchedules(); void loadCalData(calViewYear,calViewMonth); showToast("완료 처리됨"); }
                }}>완료</button>
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
      <div ref={headerBarRef} className="bg-white border-b border-gray-200 flex-shrink-0 sticky top-0 left-0 right-0 z-[200] shadow-sm">
        <div className="max-w-6xl mx-auto px-6 pt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-[#0f172a] transition-all flex-shrink-0"
              title="홈으로"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </button>
            <div className="w-8 h-8 rounded-xl bg-[#0f172a] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
            <div>
              <h1 className="text-sm font-bold text-[#0f172a]">AI 비서</h1>

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
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">📦 {stats.newOrders}</span>
            {stats.newConsult>0&&<span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">💬 오늘상담 {stats.newConsult}</span>}
          </div>
        </div>

        {/* 탭 - 무한 순환 가로 스크롤 */}
        <style>{`
          .hcm-tab-scroll{-ms-overflow-style:none;scrollbar-width:none;}
          .hcm-tab-scroll::-webkit-scrollbar{display:none;}
        `}</style>
        <div className="w-full px-4 py-3" style={{minWidth:0}}>
          <div
            ref={tabScrollRef}
            className="hcm-tab-scroll flex items-center gap-1.5"
            style={{overflowX:"scroll",overflowY:"hidden",minWidth:0}}
            onScroll={()=>{
              const el = tabScrollRef.current;
              if(!el) return;
              const third = el.scrollWidth / 3;
              if(el.scrollLeft < third * 0.3){
                el.scrollLeft += third;
              } else if(el.scrollLeft > third * 1.7){
                el.scrollLeft -= third;
              }
            }}
            onWheel={(e)=>{
              if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&tabScrollRef.current){
                e.preventDefault();
                tabScrollRef.current.scrollLeft += e.deltaY;
              }
            }}
          >
            {([...["chat","schedule","status","orders","hyundaicm","taesan","finance","narumi","jinheung","email","memo","financehub","exportshop","quotation","statement"],
               ...["chat","schedule","status","orders","hyundaicm","taesan","finance","narumi","jinheung","email","memo","financehub","exportshop","quotation","statement"],
               ...["chat","schedule","status","orders","hyundaicm","taesan","finance","narumi","jinheung","email","memo","financehub","exportshop","quotation","statement"]] as TabKey[]).map((t,i)=>(
              <button key={`${t}-${i}`} className={`${TB} ${tab===t?TA:TI}`} style={{flexShrink:0,whiteSpace:"nowrap"}} onClick={()=>setTabAndSave(t)}>
                {t==="email"
                  ? <span className="flex items-center gap-1">📧 이메일{emailReports.filter(r=>!r.is_read).length>0&&<span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">{emailReports.filter(r=>!r.is_read).length}</span>}</span>
                  : {chat:"💬 채팅",schedule:"📅 일정",status:"📊 업무현황",orders:"📦 주문·상담",hyundaicm:"🏗 현대CM",taesan:"🚛 태산통운",finance:"🏦 금융상담",narumi:"🚛 나르미",jinheung:"🔧 진흥주문",memo:"📝 메모",financehub:"💵 매출/매입",exportshop:"🌏 수출장비",quotation:"📋 견적서",statement:"📑 거래명세서"}[t as string]
                }
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 바디 */}
      <div className="flex max-w-6xl w-full mx-auto px-6 py-4 gap-5" style={{minHeight:600}}>

        {/* 사이드바 */}
        <aside className="w-56 flex-shrink-0 hidden lg:flex flex-col gap-3 self-start sticky top-4">
          <MiniCalendar
            onDateSelect={(d)=>{setSchedDate(d);setTabAndSave("schedule");}}
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
              <div className="space-y-1.5">
                <p className="text-[10px] text-emerald-600 mb-1.5">✅ 연동됨 — 일정 자동 동기화 중</p>
                {gcalEmail ? (
                  <p className="text-[10px] text-gray-400 -mt-1 mb-1.5">계정: {gcalEmail}</p>
                ) : (
                  <p className="text-[10px] text-amber-500 -mt-1 mb-1.5">⚠️ 연동 계정 정보 없음 (재연동 시 표시됩니다)</p>
                )}
                {/* 구글 → AI비서 역방향 가져오기 */}
                <button
                  onClick={()=>void importGcalToLocal(calViewYear, calViewMonth)}
                  disabled={gcalImporting}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition-all disabled:opacity-40"
                >
                  {gcalImporting ? "가져오는 중..." : "📥 구글 → AI비서 가져오기"}
                </button>
                {/* 기존 항목 일괄 동기화 */}
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
                <p className="text-[10px] text-gray-400 mb-1.5">연동하면 AI비서 일정 ↔ 구글 캘린더 양방향 동기화됩니다</p>
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
                {/* 뷰모드 토글 */}
                {(["day","week","all"] as const).map(m=>(
                  <button key={m} className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${schedViewMode===m?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                    onClick={()=>{
                      setSchedViewMode(m);
                      if(m==="day") void loadSchedules();
                      else void loadAllSchedules(m, schedDate, schedShowDone);
                    }}>
                    {{day:"일별",week:"주간",all:"전체"}[m]}
                  </button>
                ))}
                {schedViewMode==="day"&&<input type="date" className={`${CTRL} w-36`} value={schedDate} onChange={e=>setSchedDate(e.target.value)}/>}
                {schedViewMode!=="day"&&(
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={schedShowDone} onChange={e=>{setSchedShowDone(e.target.checked);void loadAllSchedules(schedViewMode as "week"|"all",schedDate,e.target.checked);}}/>
                    완료 포함
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
                    <div><label className={LBL}>시작</label><input type="time" step="600" className={CTRL} value={newSched.start_time} onChange={e=>setNewSched(p=>({...p,start_time:e.target.value}))}/></div>
                    <div><label className={LBL}>종료</label><input type="time" step="600" className={CTRL} value={newSched.end_time} onChange={e=>setNewSched(p=>({...p,end_time:e.target.value}))}/></div>
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
              {schedViewMode!=="day"&&(
                allSchedLoading?<p className="text-sm text-gray-400 p-4">불러오는 중...</p>
                :allSchedules.length===0?<div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>일정이 없습니다</div>
                :<div className="space-y-1">
                  {/* 날짜별 그룹핑 */}
                  {Array.from(new Set(allSchedules.map(s=>s.schedule_date))).map(date=>(
                    <div key={date}>
                      <p className="text-xs font-semibold text-gray-400 px-1 py-1 mt-2">{fmtDate(date as string)} ({["일","월","화","수","목","금","토"][new Date((date as string)+"T00:00:00").getDay()]})</p>
                      {allSchedules.filter(s=>s.schedule_date===date).map(s=>(
                        <div key={s.id} className={`${CARD} p-3.5 flex items-start gap-3 cursor-pointer hover:bg-blue-50 transition-all mb-1.5 ${s.is_done?"opacity-50":""}`}
                          onClick={()=>{setSchedModal({s});setSchedProgress({memo:"",next_date:todayStr(),next_time:nowTimeStr()});}}>
                          <button className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${s.is_done?"bg-emerald-500 border-emerald-500":"border-gray-300 hover:border-emerald-400"}`}
                            onClick={e=>{e.stopPropagation();void toggleSched(s.id,s.is_done);setAllSchedules(p=>p.map(x=>x.id===s.id?{...x,is_done:!x.is_done}:x));}}>
                            {s.is_done&&<span className="text-white text-[10px]">✓</span>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold text-[#0f172a] ${s.is_done?"line-through":""}`}>{s.title}</span>
                              <span className="text-xs text-gray-400">{CAT_LBL[s.category]}</span>
                              {s.related_type&&<span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{WL[s.related_type]??s.related_type}</span>}
                            </div>
                            {(s.start_time||s.location)&&<p className="text-xs text-gray-400 mt-0.5">{[s.start_time?fmtTime(s.start_time):null,s.location].filter(Boolean).join(" · ")}</p>}
                            {s.progress_memo&&<p className="text-xs text-blue-500 mt-1 line-clamp-1">📝 {s.progress_memo.split("\n").slice(-1)[0]}</p>}
                          </div>
                          <button className="text-xs text-red-400 hover:text-red-600 px-1 flex-shrink-0" onClick={e=>{e.stopPropagation();void delSched(s.id);setAllSchedules(p=>p.filter(x=>x.id!==s.id));}}>삭제</button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {schedViewMode==="day"&&(schedLoading?<p className="text-sm text-gray-400 p-4">불러오는 중...</p>
                :schedules.length===0?<div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>{fmtDate(schedDate)} 일정이 없습니다</div>
                :schedules.map(s=>(
                  <div key={s.id} className={`${CARD} p-4 flex items-start gap-3 cursor-pointer hover:bg-blue-50 transition-all ${s.is_done?"opacity-60":""}`}
                    onClick={()=>{setSchedModal({s});setSchedProgress({memo:"",next_date:todayStr(),next_time:nowTimeStr()});}}>
                    <CatDot c={s.category}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {s.schedule_date<schedDate&&!s.is_done&&<span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium flex-shrink-0">⚠ 미완료</span>}
                        {s.schedule_date>schedDate&&<span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium flex-shrink-0">내일</span>}
                        <span className={`text-sm font-semibold text-[#0f172a] ${s.is_done?"line-through":""}`}>{s.title}</span>
                        <span className="text-xs text-gray-400">{CAT_LBL[s.category]}</span>
                        {s.related_type&&<span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{WL[s.related_type]??s.related_type}</span>}
                        {s.progress_stage&&<span className={`text-xs px-2 py-0.5 rounded-full border font-medium bg-white ${progressColor(s.progress_stage)} border-current/20`}>{fmtProgress(s.work_type??"", s.progress_stage)}</span>}
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
              )}
              {/* 당일 마감 할일 — 오늘/내일 구분 */}
              {(()=>{
                const tomorrow2 = (()=>{const d=new Date(schedDate);d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);})();
                const todayTodos    = todos.filter(t=>t.due_date===schedDate&&!t.is_done);
                const tomorrowTodos = todos.filter(t=>t.due_date===tomorrow2&&!t.is_done);
                if(todayTodos.length===0&&tomorrowTodos.length===0) return null;

                const TodoItem = ({t}:{t:Todo}) => (
                  <div key={t.id} className={`${CARD} p-3.5 flex items-center gap-3 border-l-4 ${t.due_date===schedDate?"border-orange-400":"border-blue-300"}`}>
                    <button className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${t.is_done?"bg-emerald-500 border-emerald-500":"border-gray-300 hover:border-blue-400"}`}
                      onClick={()=>void toggleTodo(t.id,t.is_done)}>
                      {t.is_done&&<span className="text-white text-[10px]">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[#0f172a]">{t.title}</span>
                        {t.priority==="urgent"&&<span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">긴급</span>}
                        {t.category&&<span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{WL[t.category]??t.category}</span>}
                      </div>
                      {t.description&&<p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
                    </div>
                    <button className="text-xs text-red-400 hover:text-red-600 flex-shrink-0" onClick={()=>void delTodo(t.id)}>삭제</button>
                  </div>
                );

                return (
                  <div className="space-y-3">
                    {todayTodos.length>0&&(
                      <div>
                        <p className="text-xs font-semibold text-orange-500 px-1 mb-2">🔥 오늘 마감 할일 — {todayTodos.length}건</p>
                        {todayTodos.map(t=><TodoItem key={t.id} t={t}/>)}
                      </div>
                    )}
                    {tomorrowTodos.length>0&&(
                      <div>
                        <p className="text-xs font-semibold text-blue-500 px-1 mb-2">📋 내일 마감 할일 — {tomorrowTodos.length}건</p>
                        {tomorrowTodos.map(t=><TodoItem key={t.id} t={t}/>)}
                      </div>
                    )}
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

              onRefresh={()=>void loadStatusData()}
              onNavigate={(path:string)=>navigate(path)}

            />
          )}

          {/* ══ 주문·상담 ══ */}
          {tab==="orders"&&(
            <div className="space-y-4 pb-4">
              {/* 사후관리 */}
              {followups.length>0&&(
                <div className={`${CARD} p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[#0f172a] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500 inline-block animate-pulse"/>
                      📞 오늘 사후관리 — {followups.length}건
                    </p>
                    <button className={BTG} onClick={()=>navigate("/work/call-management?tab=followups")}>전체 보기 →</button>
                  </div>
                  <div className="space-y-2">
                    {followups.map(c=>(
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all" onClick={()=>navigate(`/work/call-management?id=${c.id}`)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#0f172a]">{c.customer_name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{WL[c.work_type]??c.work_type}</span>
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
              {/* 고객명 검색창 — 진행중·상담관리·주문내역 통합 필터 */}
              <div className={`${CARD} p-3`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 flex-shrink-0">🔍</span>
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={e=>setOrderSearch(e.target.value)}
                    placeholder="고객 이름으로 검색..."
                    className="flex-1 text-sm text-[#0f172a] bg-transparent outline-none placeholder-gray-300"
                  />
                  {orderSearch&&(
                    <button onClick={()=>setOrderSearch("")} className="text-gray-300 hover:text-gray-500 flex-shrink-0 text-xl leading-none">×</button>
                  )}
                </div>
                {orderSearch&&(
                  <p className="text-xs text-orange-500 mt-1.5 pl-6">
                    &quot;{orderSearch}&quot; 검색 결과 — 상담 {recentC.filter(c=>c.customer_name.includes(orderSearch)).length}건 · 주문 {orderViews.filter(o=>o.customer_name.includes(orderSearch)).length}건
                  </p>
                )}
              </div>
              {/* 최근 상담 */}
              <div className={`${CARD} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#0f172a]">💬 최근 상담{orderSearch&&<span className="ml-1 text-xs text-orange-500 font-normal">— &quot;{orderSearch}&quot; 필터 적용중</span>}</p>
                  <div className="flex gap-2">
                    <button className={BTG} onClick={()=>void loadConsults()}>새로고침</button>
                    <button className={BTG} onClick={()=>navigate("/work/call-management")}>전체 보기 →</button>
                  </div>
                </div>
                {cLoading?<p className="text-xs text-gray-400">불러오는 중...</p>
                  :(()=>{
                    const filteredC = orderSearch ? recentC.filter(c=>c.customer_name.includes(orderSearch)) : recentC;
                    if(filteredC.length===0) return <p className="text-sm text-gray-400 text-center py-4">{orderSearch?`"${orderSearch}"에 해당하는 상담이 없습니다`:"최근 상담이 없습니다"}</p>;
                    return (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead><tr className="border-b border-gray-100">
                          {["고객명","업무","요약","상태","등록일",""].map(h=><th key={h} className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {filteredC.map(c=>{
                            // 상담관리 COMMON_STAGES와 동일한 기준
                            const COMMON_STAGES = [
                              {value:"contract",       label:"계약"},
                              {value:"delivery",       label:"납품"},
                              {value:"invoiced",       label:"계산서발행"},
                              {value:"cancelled",      label:"취소"},
                            ];
                            const INS_STAGES = [
                              {value:"design_request", label:"접수(설계요청)"},
                              {value:"policy_issued",  label:"완료(증권발급)"},
                            ];
                            const FIN_STAGES = [
                              {value:"received",          label:"접수"},
                              {value:"credit_check",      label:"신용조회"},
                              {value:"approved",          label:"승인"},
                              {value:"supplement",        label:"보완"},
                              {value:"rejected",          label:"거절"},
                              {value:"confirmed",         label:"확정"},
                              {value:"cancelled",         label:"취소"},
                            ];
                            const isTireOrBattery = ["tire_sales","tire","battery_sales","battery","forklift_sales","forklift"].includes(c.work_type);
                            const isFinanceType   = c.work_type==="finance";
                            const isInsurance     = c.work_type==="registration_insurance";
                            // 표시할 현재 단계값
                            const curStage = isTireOrBattery ? (c.process_stage??"contract") : isFinanceType ? ((c as any).display_status??"") : isInsurance ? (c.status??"design_request") : c.status;
                            const stageOptions = isInsurance ? INS_STAGES : isTireOrBattery ? COMMON_STAGES : isFinanceType ? FIN_STAGES : COMMON_STAGES;
                            // 단계별 색상 (상담관리 progressColor와 동일)
                            const stageColor = (s:string) =>
                              ["invoiced","completed_order","confirmed","delivered","policy_issued"].includes(s) ? {bg:"#f0fdf4",fg:"#16a34a",bd:"#bbf7d0"}
                              :["cancelled","rejected"].includes(s)                              ? {bg:"#fef2f2",fg:"#ef4444",bd:"#fecaca"}
                              :["contract","approved","design_request"].includes(s) ? {bg:"#eff6ff",fg:"#2563eb",bd:"#bfdbfe"}
                              :["delivery"].includes(s)                                          ? {bg:"#fff7ed",fg:"#ea580c",bd:"#fed7aa"}
                                                                                                : {bg:"#f9fafb",fg:"#6b7280",bd:"#e5e7eb"};
                            const sc = stageColor(curStage);
                            return (
                            <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={()=>navigate(`/work/call-management?id=${c.id}`)}>
                              <td className="py-1.5 px-2 font-medium text-[#0f172a] whitespace-nowrap">{c.customer_name}</td>
                              <td className="py-1.5 px-2 whitespace-nowrap"><span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{WL[c.work_type]??c.work_type}</span></td>
                              <td className="py-1.5 px-2 text-gray-600 max-w-[160px] truncate">{c.summary}</td>
                              <td className="py-1.5 px-2 whitespace-nowrap" onClick={e=>e.stopPropagation()}>
                                <select
                                  value={curStage}
                                  onChange={async e=>{
                                    const next = e.target.value;
                                    if(isTireOrBattery){
                                      const isTire = ["tire_sales","tire"].includes(c.work_type);
                                      const isBatt = ["battery_sales","battery"].includes(c.work_type);
                                      const detailTable = isTire
                                        ? "consultation_tire_details"
                                        : isBatt
                                        ? "consultation_battery_details"
                                        : "consultation_forklift_details";
                                      // 타이어만 process_status 컬럼 있음
                                      const updatePayload = isTire
                                        ? {process_stage:next, process_status:next}
                                        : {process_stage:next};
                                      const {error} = await supabase.from(detailTable).update(updatePayload).eq("consultation_id",c.id);
                                      if(error){alert("단계 변경 실패: "+error.message);return;}
                                      setRecentC(prev=>prev.map(x=>x.id===c.id?{...x,process_stage:next}:x));
                                    } else if(isFinanceType){
                                      const {error} = await supabase.from("consultation_finance_details").update({finance_stage:next}).eq("consultation_id",c.id);
                                      if(error){alert("단계 변경 실패: "+error.message);return;}
                                      setRecentC(prev=>prev.map(x=>x.id===c.id?{...x,display_status:next}:x));
                                      // ── 확정 익일 사후미결(설정/원본서류) 할 일 자동 등록 ──
                                      if(next==="confirmed"){
                                        try{
                                          const nextDayStr = (()=>{ const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
                                          const postConfirmDesc = `상담ID: ${c.id} / 금융상담 확정 사후미결`;
                                          await Promise.all([
                                            supabase.from("secretary_todos").insert({
                                              title: `${c.customer_name} 설정`,
                                              description: postConfirmDesc,
                                              priority: "urgent",
                                              category: "finance",
                                              due_date: nextDayStr,
                                              is_done: false,
                                            }),
                                            supabase.from("secretary_todos").insert({
                                              title: `${c.customer_name} 원본`,
                                              description: postConfirmDesc,
                                              priority: "urgent",
                                              category: "finance",
                                              due_date: nextDayStr,
                                              is_done: false,
                                            }),
                                          ]);
                                        }catch(todoErr){
                                          console.error("[금융상담 확정 사후미결 할 일 등록 오류]:",todoErr);
                                        }
                                      }
                                    } else if(isInsurance){
                                      const {error} = await supabase.from("consultation_cases").update({status:next}).eq("id",c.id);
                                      if(error){alert("단계 변경 실패: "+error.message);return;}
                                      setRecentC(prev=>prev.map(x=>x.id===c.id?{...x,status:next}:x));
                                    } else {
                                      const {error} = await supabase.from("consultation_cases").update({status:next}).eq("id",c.id);
                                      if(error){alert("단계 변경 실패: "+error.message);return;}
                                      setRecentC(prev=>prev.map(x=>x.id===c.id?{...x,status:next}:x));
                                    }
                                  }}
                                  className="text-xs px-2 py-0.5 rounded-full border font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-400"
                                  style={{background:sc.bg,color:sc.fg,borderColor:sc.bd}}
                                >
                                  {stageOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </td>
                              <td className="py-1.5 px-2 text-xs text-gray-400 whitespace-nowrap">{fmtDT(c.created_at)}</td>
                              <td className="py-1.5 px-2">
                                <button className={BTG} onClick={e=>{e.stopPropagation();quickChat(`"${c.customer_name}" ${WL[c.work_type]??""} 후속 조치: ${c.summary}`);}}>AI</button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    );
                  })()
                }
              </div>
              {/* 주문내역 */}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <p className="text-sm font-semibold text-[#0f172a]">📋 주문내역</p>
                  <div className="flex gap-1.5 ml-auto flex-wrap">
                    {(["active","all","done"] as const).map(f=>(
                      <button key={f} className={`${TB} text-xs py-1 px-2.5 ${ordFilter===f?TA:TI}`} onClick={()=>setOrdFilterAndSave(f)}>{{active:"진행중",all:"전체",done:"완료"}[f]}</button>
                    ))}
                    <button
                      className={`${TB} text-xs py-1 px-2.5 ${orderSelectMode?TA:TI}`}
                      onClick={()=>{ setOrderSelectMode(p=>!p); setOrderSelectedIds(new Set()); }}
                    >{orderSelectMode?"묶음발행 취소":"📑 묶음발행"}</button>
                    <button className={BTG} onClick={()=>void loadOrderViews()}>새로고침</button>
                    <button className={BTP} onClick={()=>navigate("/work/call-management")}>상담관리 →</button>
                  </div>
                </div>
                {/* 묶음발행 모드 안내 + 실행 버튼 */}
                {orderSelectMode&&(
                  <div className="mb-2 p-2.5 rounded-lg bg-orange-50 border border-orange-100 text-xs text-orange-700 flex items-center justify-between flex-wrap gap-2">
                    <span>타이어/배터리 건만 자동 필터링됩니다. 같은 거래처 여러 건을 체크해 계산서 1장으로 묶어 발행하세요. ({orderSelectedIds.size}건 선택됨)</span>
                    <button
                      disabled={orderSelectedIds.size===0}
                      onClick={()=>{
                        const selected = orderViews.filter(o=>orderSelectedIds.has(o.id));
                        setOrderBulkInvoiceModal(selected);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#0f172a] text-white text-xs font-semibold disabled:opacity-30"
                    >선택건 묶음 계산서발행 →</button>
                  </div>
                )}
                {/* AI비서 채팅으로 입력 안내 */}
                {!orderSearch&&(
                <div className="mb-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-600">
                  💡 주문 등록은 채팅탭에서 &quot;홍길동 타이어 18*7-8 두산 3톤 후륜 2개 주문&quot; 형태로 입력하시면 자동 저장됩니다
                </div>
                )}
                {(() => {
                  const visibleOrders = orderViews
                    .filter(o=>!orderSearch||o.customer_name.includes(orderSearch))
                    .filter(o=>!orderSelectMode||["tire","tire_sales","battery","battery_sales"].includes(o.work_type));
                  if(ordViewLoading) return <p className="text-sm text-gray-400 p-4">불러오는 중...</p>;
                  if(visibleOrders.length===0) return (
                    <div className={`${CARD} p-6 text-center text-gray-400 text-sm`}>
                      {orderSelectMode
                        ? "타이어/배터리 건이 없습니다"
                        : orderSearch?`"${orderSearch}"에 해당하는 주문이 없습니다`:"주문 내역이 없습니다"}
                    </div>
                  );
                  return (
                    <div className="space-y-2">
                      {visibleOrders.map(o=>(
                        <div key={o.id} className={`${CARD} p-3.5 ${orderSelectMode?"":"cursor-pointer hover:shadow-md"} transition-all`}
                          onClick={()=>{ if(!orderSelectMode) navigate(`/work/call-management?id=${o.id}`); }}>
                          <div className="flex items-start gap-2.5">
                            {orderSelectMode && ["tire","tire_sales","battery","battery_sales"].includes(o.work_type) && (
                              <input
                                type="checkbox"
                                className="mt-1 w-4 h-4 accent-[#0f172a] shrink-0"
                                checked={orderSelectedIds.has(o.id)}
                                onClick={e=>e.stopPropagation()}
                                onChange={(e)=>{
                                  setOrderSelectedIds(prev=>{
                                    const next = new Set(prev);
                                    if(e.target.checked) next.add(o.id); else next.delete(o.id);
                                    return next;
                                  });
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              {/* 1행: 고객명 + 업무유형 */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold text-[#0f172a]">{o.customer_name}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{WL[o.work_type]??o.work_type}</span>
                                {o.sub_type&&<span className="text-xs text-gray-400">{o.sub_type}</span>}
                              </div>
                              {/* 2행: 제품명·규격 */}
                              {o.product_detail&&(
                                <p className="text-xs text-gray-600 mt-1 font-medium">{o.product_detail}</p>
                              )}
                              {/* 3행: 진행단계 + 등록일 */}
                              <div className="flex items-center gap-3 mt-1">
                                {o.progress_stage ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border
                                    ${["invoiced","completed_order","confirmed","delivered","확정"].includes(o.progress_stage)?"bg-emerald-50 text-emerald-700 border-emerald-200"
                                    :["cancelled","rejected","취소","거절"].includes(o.progress_stage)?"bg-red-50 text-red-500 border-red-200"
                                    :["contract","approved"].includes(o.progress_stage)?"bg-blue-50 text-blue-600 border-blue-200"
                                    :["delivery"].includes(o.progress_stage)?"bg-orange-50 text-orange-600 border-orange-200"
                                    :"bg-gray-50 text-gray-500 border-gray-200"}`}>
                                    {fmtProgress(o.work_type, o.progress_stage)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                                <span className="text-xs text-gray-400">{fmtDT(o.created_at)}</span>
                              </div>
                              {/* 4행: 요약 (접힘) */}
                              {expandedOrder===o.id&&(
                                <p className="text-xs text-gray-500 mt-1.5 pt-1.5 border-t border-gray-100 break-keep">{o.summary}</p>
                              )}
                            </div>
                            {/* 우측 버튼 */}
                            <div className="flex flex-col gap-1.5 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                              {/* 배터리/타이어 항목만 — 목록에서 직접 단계 변경 (묶음발행 모드에서는 숨김) */}
                              {!orderSelectMode && ["tire","tire_sales","battery","battery_sales"].includes(o.work_type) && (
                                <select
                                  value={o.progress_stage ?? ""}
                                  onChange={async(e)=>{
                                    const nextStage = e.target.value;
                                    if(!nextStage || nextStage === o.progress_stage) return;
                                    if(nextStage === "invoiced"){
                                      setOrderInvoiceModal(o);
                                      return;
                                    }
                                    const table = ["tire","tire_sales"].includes(o.work_type) ? "consultation_tire_details" : "consultation_battery_details";
                                    await supabase.from(table).update({ process_stage: nextStage }).eq("consultation_id", o.id);
                                    void loadOrderViews();
                                    showToast("단계가 변경되었습니다");
                                  }}
                                  className="h-8 rounded-xl border border-gray-200 px-2 text-xs font-medium text-gray-600 focus:outline-none focus:border-orange-400 bg-white"
                                >
                                  <option value="" disabled>단계 선택</option>
                                  <option value="contract">계약</option>
                                  <option value="delivery">납품</option>
                                  <option value="invoiced">계산서발행</option>
                                  <option value="cancelled">취소</option>
                                </select>
                              )}
                              <button className={BTG} onClick={()=>setExpandedOrder(expandedOrder===o.id?null:o.id)}>
                                {expandedOrder===o.id?"접기":"펼침"}
                              </button>
                              <button className={BTG} onClick={()=>quickChat(`"${o.customer_name}" ${WL[o.work_type]??""} 진행상황 업데이트해줘`)}>AI</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ══ 현대CM ══ */}
          {tab==="hyundaicm"&&(
            <div className="space-y-3 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-semibold text-[#0f172a]">🏗 현대건설기계업무</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(["active","all","done"] as const).map(f=>(
                    <button key={f} onClick={()=>setHcmFilter(f)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${hcmFilter===f?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                      {{active:"진행중",all:"전체",done:"확정"}[f]}
                    </button>
                  ))}
                  <button className={BTG} onClick={()=>{
                    setHcmLoading(true);
                    supabase.from("hyundaicm_tasks").select("*").order("created_at",{ascending:false}).limit(60)
                      .then(({data})=>{setHcmList((data??[]) as HyundaiTask[]);setHcmLoading(false);});
                  }}>새로고침</button>
                  <button className={BTO} onClick={()=>navigate("/hyundaicm")}>전체 페이지 →</button>
                </div>
              </div>
              {hcmLoading?<p className="text-sm text-gray-400 p-4 text-center">불러오는 중...</p>:(()=>{
                const filtered=hcmList.filter((t:any)=>hcmFilter==="active"?(t.status!=="확정"&&t.status!=="거절"):hcmFilter==="done"?t.status==="확정":true);
                return filtered.length===0?<div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>해당 건이 없습니다</div>:(
                  <div className="space-y-2">
                    {filtered.map((t:any)=>(
                      <div key={t.id} className={`${CARD} p-3.5 cursor-pointer hover:shadow-md transition-all`}
                        onClick={()=>navigate(`/hyundaicm?id=${t.id}`)}>
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-[#0f172a]">{t.customer_name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{t.customer_type}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100 font-medium">{t.status}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                              {t.finance_company&&<span>{t.finance_company}</span>}
                              {t.equipment_ton&&<span>{t.equipment_ton}</span>}
                              {t.installment_principal&&<span>{Number(t.installment_principal).toLocaleString("ko-KR")}원</span>}
                              {t.interest_rate&&<span>금리 {t.interest_rate}%</span>}
                              <span className="ml-auto text-gray-300">{String(t.created_at||"").slice(0,10)}</span>
                            </div>
                            {hcmExpanded===t.id&&(
                              <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {t.nice_score&&<div><span className="text-gray-400">NICE </span><span>{t.nice_score}점</span></div>}
                                {t.loan_period&&<div><span className="text-gray-400">기간 </span><span>{t.loan_period}개월</span></div>}
                                {t.vat_deferred&&<div><span className="text-gray-400">부가세 </span><span>Y{t.vat_deferred_amount?` / ${Number(t.vat_deferred_amount).toLocaleString("ko-KR")}원`:""}</span></div>}
                                {t.sales_rep&&<div><span className="text-gray-400">영업 </span><span>{t.sales_rep}</span></div>}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0" onClick={e=>e.stopPropagation()}>
                            <button className={BTG} onClick={()=>setHcmExpanded(hcmExpanded===t.id?null:t.id)}>{hcmExpanded===t.id?"접기":"상세"}</button>
                            <button className={BTO} onClick={()=>navigate(`/hyundaicm?id=${t.id}`)}>이동 →</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══ 태산통운 ══ */}
          {tab==="taesan"&&(
            <div className="space-y-3 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-semibold text-[#0f172a]">🚛 태산통운업무</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(["active","all","done"] as const).map(f=>(
                    <button key={f} onClick={()=>setTaesanFilter(f)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${taesanFilter===f?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                      {{active:"진행중",all:"전체",done:"확정"}[f]}
                    </button>
                  ))}
                  <button className={BTG} onClick={()=>{
                    setTaesanLoading(true);
                    supabase.from("taesan_tasks").select("*").order("created_at",{ascending:false}).limit(60)
                      .then(({data})=>{setTaesanList((data??[]) as TaesanTask[]);setTaesanLoading(false);});
                  }}>새로고침</button>
                  <button className={BTO} onClick={()=>navigate("/taesan")}>전체 페이지 →</button>
                </div>
              </div>
              {taesanLoading?<p className="text-sm text-gray-400 p-4 text-center">불러오는 중...</p>:(()=>{
                const filtered=taesanList.filter((t:any)=>taesanFilter==="active"?(t.status!=="확정"&&t.status!=="거절"):taesanFilter==="done"?t.status==="확정":true);
                return filtered.length===0?<div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>해당 건이 없습니다</div>:(
                  <div className="space-y-2">
                    {filtered.map((t:any)=>(
                      <div key={t.id} className={`${CARD} p-3.5 cursor-pointer hover:shadow-md transition-all`}
                        onClick={()=>navigate(`/taesan?id=${t.id}`)}>
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-[#0f172a]">{t.customer_name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{t.customer_type}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100 font-medium">{t.status}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                              {t.finance_company&&<span>{t.finance_company}</span>}
                              {t.equipment_ton&&<span>{t.equipment_ton}</span>}
                              {t.installment_principal&&<span>{Number(t.installment_principal).toLocaleString("ko-KR")}원</span>}
                              {t.interest_rate&&<span>금리 {t.interest_rate}%</span>}
                              <span className="ml-auto text-gray-300">{String(t.created_at||"").slice(0,10)}</span>
                            </div>
                            {taesanExpanded===t.id&&(
                              <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {t.nice_score&&<div><span className="text-gray-400">NICE </span><span>{t.nice_score}점</span></div>}
                                {t.loan_period&&<div><span className="text-gray-400">기간 </span><span>{t.loan_period}개월</span></div>}
                                {t.vat_deferred&&<div><span className="text-gray-400">부가세 </span><span>Y{t.vat_deferred_amount?` / ${Number(t.vat_deferred_amount).toLocaleString("ko-KR")}원`:""}</span></div>}
                                {t.sales_rep&&<div><span className="text-gray-400">영업 </span><span>{t.sales_rep}</span></div>}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0" onClick={e=>e.stopPropagation()}>
                            <button className={BTG} onClick={()=>setTaesanExpanded(taesanExpanded===t.id?null:t.id)}>{taesanExpanded===t.id?"접기":"상세"}</button>
                            <button className={BTO} onClick={()=>navigate(`/taesan?id=${t.id}`)}>이동 →</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══ 금융상담 ══ */}
          {tab==="finance"&&(
            <div className="space-y-3 pb-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[#0f172a] shrink-0 pt-1">🏦 금융 상담내역</p>
                <div className="flex flex-col gap-1.5 items-end">
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {(["active","all","done"] as const).map(f=>(
                      <button key={f} onClick={()=>setFinanceFilter(f)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${financeFilter===f?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                        {{active:"진행중",all:"전체",done:"완료"}[f]}
                      </button>
                    ))}
                    <button className={BTG} onClick={()=>setShowRepayModal(true)}>📋 상환스케줄</button>
                  </div>
                  <div className="flex gap-1.5">
                    <button className={BTG} onClick={()=>{
                      setFinanceLoading(true);
                      supabase.from("consultation_cases").select("id,customer_name,work_type,status,summary,created_at,phone,sub_type").eq("work_type","finance").order("created_at",{ascending:false}).limit(60)
                        .then(({data})=>{setFinanceConsults((data??[]).map((c:any)=>({...c,progress_stage:null,product_detail:null})));setFinanceLoading(false);});
                    }}>새로고침</button>
                    <button className={BTO} onClick={()=>navigate("/work/call-management?work_type=finance")}>전체 보기 →</button>
                  </div>
                </div>
              </div>

              {/* 상환스케줄 송부 모달 */}
              {showRepayModal&&ReactDOM.createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 px-4" onClick={()=>setShowRepayModal(false)}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <p className="font-bold text-[#0f172a]">📋 상환스케줄 송부</p>
                      <button onClick={()=>setShowRepayModal(false)} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
                    </div>
                    <div className="px-5 py-4 space-y-4">

                      {/* 발송 방법 */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">발송 방법</p>
                        <div className="flex gap-2">
                          {(["kakao","email","sms"] as const).map(m=>(
                            <button key={m} onClick={()=>setRepayForm(p=>({...p,sendMethod:m}))}
                              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${repayForm.sendMethod===m?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200"}`}>
                              {m==="kakao"?"💬 카카오(SMS)":m==="email"?"📧 이메일":"📱 SMS"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 수신자 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">수신자 이름</label>
                          <input value={repayForm.recipientName} onChange={e=>setRepayForm(p=>({...p,recipientName:e.target.value}))}
                            placeholder="홍길동" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">
                            {repayForm.sendMethod==="email"?"이메일 주소":"전화번호"}
                          </label>
                          {repayForm.sendMethod==="email"
                            ? <input value={repayForm.recipientEmail} onChange={e=>setRepayForm(p=>({...p,recipientEmail:e.target.value}))}
                                placeholder="example@email.com" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                            : <input value={repayForm.recipientPhone} onChange={e=>setRepayForm(p=>({...p,recipientPhone:e.target.value}))}
                                placeholder="010-0000-0000" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                          }
                        </div>
                      </div>

                      {/* 고객명 / 차종 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">고객 이름</label>
                          <input value={repayForm.customerName} onChange={e=>setRepayForm(p=>({...p,customerName:e.target.value}))}
                            placeholder="홍길동" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">구매 차종 (메이커)</label>
                          <input value={repayForm.vehicleModel} onChange={e=>setRepayForm(p=>({...p,vehicleModel:e.target.value}))}
                            placeholder="현대 45D-9" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                        </div>
                      </div>

                      {/* 차량가격 / 선수율 → 원금 자동계산 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">차량 가격 (원)</label>
                          <input type="number" value={repayForm.vehiclePrice}
                            onChange={e=>{
                              const vp = e.target.value;
                              const dp = Number(repayForm.downPaymentRate)||0;
                              const auto = vp ? String(Math.round(Number(vp)*(1-dp/100))) : "";
                              setRepayForm(p=>({...p,vehiclePrice:vp,principal:auto}));
                            }}
                            placeholder="50000000" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">선수율 (%)</label>
                          <input type="number" value={repayForm.downPaymentRate}
                            onChange={e=>{
                              const dp = e.target.value;
                              const vp = Number(repayForm.vehiclePrice)||0;
                              const auto = vp ? String(Math.round(vp*(1-Number(dp)/100))) : "";
                              setRepayForm(p=>({...p,downPaymentRate:dp,principal:auto}));
                            }}
                            placeholder="20" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                        </div>
                      </div>

                      {/* 할부 원금 (자동계산 결과, 직접 수정 가능) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">
                          할부 원금 (원)
                          {repayForm.vehiclePrice&&repayForm.downPaymentRate&&(
                            <span className="ml-1.5 text-orange-500 font-normal">← 자동계산됨 (직접 수정 가능)</span>
                          )}
                        </label>
                        <input type="number" value={repayForm.principal} onChange={e=>setRepayForm(p=>({...p,principal:e.target.value}))}
                          placeholder="40000000" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">거치기간 (개월)</label>
                          <input type="number" value={repayForm.gracePeriod} onChange={e=>setRepayForm(p=>({...p,gracePeriod:e.target.value}))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">할부기간 (개월)</label>
                          <input type="number" value={repayForm.installmentPeriod} onChange={e=>setRepayForm(p=>({...p,installmentPeriod:e.target.value}))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1">이자율 (%)</label>
                          <input type="number" step="0.1" value={repayForm.interestRate} onChange={e=>setRepayForm(p=>({...p,interestRate:e.target.value}))}
                            placeholder="4.5" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">납입 시작월</label>
                        <input type="month" value={repayStartYM} onChange={e=>setRepayStartYM(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"/>
                      </div>

                      {/* 미리보기 요약 */}
                      {repayForm.principal&&repayForm.interestRate&&(()=>{
                        const P = Number(repayForm.principal);
                        const VP = Number(repayForm.vehiclePrice)||0;
                        const DP = Number(repayForm.downPaymentRate)||0;
                        const grace = Number(repayForm.gracePeriod)||0;
                        const inst = Number(repayForm.installmentPeriod)||36;
                        const r = Number(repayForm.interestRate)/100/12;
                        const gracePayment = Math.round(P * r);
                        const instPayment = r===0 ? Math.round(P/inst) : Math.round(P * r * Math.pow(1+r,inst) / (Math.pow(1+r,inst)-1));
                        const totalInterest = gracePayment*grace + instPayment*inst - P;
                        const downAmt = VP ? Math.round(VP*DP/100) : 0;
                        return (
                          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3.5 text-xs space-y-1">
                            <p className="font-semibold text-violet-700 mb-2">📊 스케줄 미리보기</p>
                            {VP>0&&<div className="flex justify-between"><span className="text-gray-500">차량가격</span><span className="font-semibold">{VP.toLocaleString()}원</span></div>}
                            {VP>0&&<div className="flex justify-between"><span className="text-gray-500">선수금 ({DP}%)</span><span className="font-semibold">{downAmt.toLocaleString()}원</span></div>}
                            <div className="flex justify-between"><span className="text-gray-500">할부원금</span><span className="font-semibold">{P.toLocaleString()}원</span></div>
                            <div className="flex justify-between border-t border-violet-200 pt-1 mt-1"><span className="text-gray-500">거치기 이자</span><span className="font-semibold">{gracePayment.toLocaleString()}원/월 × {grace}개월</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">할부 납입금</span><span className="font-semibold">{instPayment.toLocaleString()}원/월 × {inst}개월</span></div>
                            <div className="flex justify-between border-t border-violet-200 pt-1 mt-1"><span className="text-gray-500">총 이자</span><span className="font-semibold text-violet-700">{totalInterest.toLocaleString()}원</span></div>
                          </div>
                        );
                      })()}

                      {/* 발송 버튼 */}
                      <button
                        disabled={repaySending||(!repayForm.recipientPhone&&!repayForm.recipientEmail)||!repayForm.principal||!repayForm.interestRate}
                        onClick={async()=>{
                          setRepaySending(true);
                          try {
                            const P = Number(repayForm.principal);
                            const VP = Number(repayForm.vehiclePrice)||0;
                            const DP = Number(repayForm.downPaymentRate)||0;
                            const grace = Number(repayForm.gracePeriod)||0;
                            const inst = Number(repayForm.installmentPeriod)||36;
                            const r = Number(repayForm.interestRate)/100/12;
                            const gracePayment = Math.round(P * r);
                            const instPayment = r===0 ? Math.round(P/inst) : Math.round(P * r * Math.pow(1+r,inst) / (Math.pow(1+r,inst)-1));
                            const totalInterest = gracePayment*grace + instPayment*inst - P;
                            const downAmt = VP ? Math.round(VP*DP/100) : 0;
                            const msg = `[RNF KOREA] 상환스케줄 안내\n\n고객명: ${repayForm.customerName||repayForm.recipientName}\n차종: ${repayForm.vehicleModel}${VP?`\n차량가격: ${VP.toLocaleString()}원`:""}\n${VP?`선수금(${DP}%): ${downAmt.toLocaleString()}원\n`:""}\n할부원금: ${P.toLocaleString()}원\n이자율: ${repayForm.interestRate}%\n\n▶ 거치기(${grace}개월): ${gracePayment.toLocaleString()}원/월\n▶ 할부기(${inst}개월): ${instPayment.toLocaleString()}원/월\n▶ 총이자: ${totalInterest.toLocaleString()}원\n\n문의: 1551-1873`;

                            if(repayForm.sendMethod==="email"){
                              const { error } = await supabase.functions.invoke("send-email", {
                                body: {
                                  to: repayForm.recipientEmail,
                                  subject: `[RNF KOREA] ${repayForm.customerName||repayForm.recipientName}님 상환스케줄 안내`,
                                  text: msg,
                                }
                              });
                              if(error) throw error;
                            } else {
                              // ── 카카오/SMS: 텍스트가 아니라 상환표 이미지를 MMS로 발송 ──
                              if (!repayTableRef.current) throw new Error("상환표 렌더링 실패");
                              let canvas = await html2canvas(repayTableRef.current, { scale: 1.5, backgroundColor: "#ffffff" });

                              // Solapi MMS 이미지 크기 제한(가로 1500px, 세로 1440px) 대응
                              const MAX_W = 1500, MAX_H = 1440;
                              if (canvas.width > MAX_W || canvas.height > MAX_H) {
                                const ratio = Math.min(MAX_W / canvas.width, MAX_H / canvas.height);
                                const resized = document.createElement("canvas");
                                resized.width = Math.floor(canvas.width * ratio);
                                resized.height = Math.floor(canvas.height * ratio);
                                const ctx = resized.getContext("2d");
                                ctx?.drawImage(canvas, 0, 0, resized.width, resized.height);
                                canvas = resized;
                              }

                              // Solapi MMS 이미지 용량 제한(200KB) 대응: JPEG 품질을 단계적으로 낮춰 압축
                              const MAX_BYTES = 200 * 1024;
                              const base64SizeBytes = (dataUrl: string) => Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4);
                              let quality = 0.9;
                              let imageBase64 = canvas.toDataURL("image/jpeg", quality);
                              while (base64SizeBytes(imageBase64) > MAX_BYTES && quality > 0.2) {
                                quality -= 0.1;
                                imageBase64 = canvas.toDataURL("image/jpeg", quality);
                              }
                              if (base64SizeBytes(imageBase64) > MAX_BYTES) {
                                const shrink = document.createElement("canvas");
                                const ratio = Math.sqrt(MAX_BYTES / base64SizeBytes(imageBase64)) * 0.9;
                                shrink.width = Math.max(320, Math.floor(canvas.width * ratio));
                                shrink.height = Math.max(200, Math.floor(canvas.height * ratio));
                                const ctx = shrink.getContext("2d");
                                ctx?.drawImage(canvas, 0, 0, shrink.width, shrink.height);
                                imageBase64 = shrink.toDataURL("image/jpeg", 0.7);
                              }
                              if (base64SizeBytes(imageBase64) > MAX_BYTES) {
                                throw new Error("상환표 이미지 압축에 실패했습니다. 잠시 후 다시 시도해주세요.");
                              }

                              const { error } = await supabase.functions.invoke("send-hyundaicm-kakao", {
                                body: { type: "quote_send", to: repayForm.recipientPhone.replace(/-/g,""), text: msg, imageBase64 }
                              });
                              if(error) throw error;
                            }
                            alert(`${repayForm.sendMethod==="email"?"이메일":"MMS"} 발송 완료!`);
                            setShowRepayModal(false);
                            setRepayForm({recipientName:"",recipientPhone:"",recipientEmail:"",customerName:"",vehicleModel:"",vehiclePrice:"",downPaymentRate:"20",principal:"",gracePeriod:"3",installmentPeriod:"36",interestRate:"",sendMethod:"kakao"});
                          } catch(e:any) {
                            let detail = e?.message ?? "다시 시도해주세요.";
                            try {
                              // supabase-js FunctionsHttpError: 실제 응답 본문은 e.context에 들어있음
                              if (e?.context && typeof e.context.json === "function") {
                                const body = await e.context.json();
                                detail = body?.error ?? detail;
                              }
                            } catch { /* 본문 파싱 실패 시 원래 메시지 사용 */ }
                            alert(`발송 실패: ${detail}`);
                          } finally { setRepaySending(false); }
                        }}
                        className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${repaySending||(!repayForm.recipientPhone&&!repayForm.recipientEmail)||!repayForm.principal||!repayForm.interestRate?"bg-gray-100 text-gray-400 cursor-not-allowed":"bg-[#0f172a] text-white hover:bg-[#1e293b]"}`}>
                        {repaySending ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>발송 중...</> : `${repayForm.sendMethod==="email"?"📧 이메일":"📱 MMS"}으로 발송`}
                      </button>

                      {/* 발송용 캡처 전용 숨김 DOM — 상환표 이미지 생성 */}
                      {repayForm.principal && repayForm.interestRate && (()=>{
                        const P = Number(repayForm.principal);
                        const grace = Number(repayForm.gracePeriod)||0;
                        const inst = Number(repayForm.installmentPeriod)||36;
                        const months = grace + inst;
                        const { payment, rows } = calcRepayAmortization(P, Number(repayForm.interestRate), months, repayStartYM, grace);
                        const fmt = (n:number) => n.toLocaleString("ko-KR");
                        return (
                          <div style={{ position:"fixed", left:"-9999px", top:0, width:"560px" }}>
                            <div ref={repayTableRef} style={{ fontFamily:"'Malgun Gothic','맑은 고딕',sans-serif", background:"#fff", padding:"24px", color:"#1e293b" }}>
                              <h1 style={{ fontSize:"18px", fontWeight:700, margin:"0 0 4px", color:"#0a192f" }}>원리금균등분납 상환스케줄</h1>
                              <p style={{ fontSize:"12px", color:"#64748b", marginBottom:"16px" }}>{repayForm.vehicleModel||"할부금융"}</p>
                              <p style={{ fontSize:"13px", marginBottom:"12px" }}>수신: <strong style={{ color:"#0a192f" }}>{repayForm.customerName||repayForm.recipientName}</strong> 귀중</p>
                              <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"8px", marginBottom:"16px", background:"#f8fafc", borderRadius:"8px", padding:"14px" }}>
                                <div><div style={{ fontSize:"10px", color:"#94a3b8" }}>고객명</div><div style={{ fontWeight:600, color:"#0a192f", fontSize:"13px" }}>{repayForm.customerName||repayForm.recipientName}</div></div>
                                <div><div style={{ fontSize:"10px", color:"#94a3b8" }}>할부원금</div><div style={{ fontWeight:600, color:"#0a192f", fontSize:"13px" }}>{fmt(P)}원</div></div>
                                <div><div style={{ fontSize:"10px", color:"#94a3b8" }}>금리 (연)</div><div style={{ fontWeight:600, color:"#0a192f", fontSize:"13px" }}>{repayForm.interestRate}%</div></div>
                                <div><div style={{ fontSize:"10px", color:"#94a3b8" }}>대출기간</div><div style={{ fontWeight:600, color:"#0a192f", fontSize:"13px" }}>{months}개월{grace>0?` (거치 ${grace}+할부 ${inst})`:""}</div></div>
                                <div><div style={{ fontSize:"10px", color:"#94a3b8" }}>{grace>0?"거치 후 월 납입액":"월 납입액"}</div><div style={{ fontWeight:600, color:"#0a192f", fontSize:"13px" }}>{fmt(payment)}원</div></div>
                                <div><div style={{ fontSize:"10px", color:"#94a3b8" }}>차종</div><div style={{ fontWeight:600, color:"#0a192f", fontSize:"13px" }}>{repayForm.vehicleModel||"-"}</div></div>
                              </div>
                              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                                <thead>
                                  <tr>
                                    {["회차","납입일","월납입액","원금","이자","잔액"].map(h=>(
                                      <th key={h} style={{ background:"#0a192f", color:"#fff", padding:"7px 6px", textAlign: h==="회차"||h==="납입일" ? "center":"right", fontSize:"10px" }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(rows.length>12 ? rows.slice(0,6) : rows).map(row=>(
                                    <tr key={row.no} style={{ background: row.no%2===0 ? "#f8fafc":"#fff" }}>
                                      <td style={{ padding:"5px 6px", textAlign:"center", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9" }}>{row.no}</td>
                                      <td style={{ padding:"5px 6px", textAlign:"center", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9", color:"#64748b" }}>{row.date}</td>
                                      <td style={{ padding:"5px 6px", textAlign:"right", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9", fontWeight:600 }}>{fmt(row.payment)}</td>
                                      <td style={{ padding:"5px 6px", textAlign:"right", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9" }}>{fmt(row.principalPmt)}</td>
                                      <td style={{ padding:"5px 6px", textAlign:"right", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9", color:"#64748b" }}>{fmt(row.interest)}</td>
                                      <td style={{ padding:"5px 6px", textAlign:"right", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9" }}>{fmt(row.balance)}</td>
                                    </tr>
                                  ))}
                                  {rows.length>12 && (
                                    <tr><td colSpan={6} style={{ padding:"8px 6px", textAlign:"center", fontSize:"11px", color:"#94a3b8", letterSpacing:"2px" }}>⋮ 중간 {rows.length-12}회차 생략 ⋮</td></tr>
                                  )}
                                  {rows.length>12 && rows.slice(-6).map(row=>(
                                    <tr key={row.no} style={{ background: row.no%2===0 ? "#f8fafc":"#fff" }}>
                                      <td style={{ padding:"5px 6px", textAlign:"center", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9" }}>{row.no}</td>
                                      <td style={{ padding:"5px 6px", textAlign:"center", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9", color:"#64748b" }}>{row.date}</td>
                                      <td style={{ padding:"5px 6px", textAlign:"right", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9", fontWeight:600 }}>{fmt(row.payment)}</td>
                                      <td style={{ padding:"5px 6px", textAlign:"right", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9" }}>{fmt(row.principalPmt)}</td>
                                      <td style={{ padding:"5px 6px", textAlign:"right", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9", color:"#64748b" }}>{fmt(row.interest)}</td>
                                      <td style={{ padding:"5px 6px", textAlign:"right", fontSize:"10.5px", borderBottom:"1px solid #f1f5f9" }}>{fmt(row.balance)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <p style={{ marginTop:"16px", fontSize:"10px", color:"#94a3b8", textAlign:"center" }}>
                                ※ 실제 납입액은 금융사 기준일·계산방식에 따라 일부 다를 수 있습니다.
                                {rows.length>12 ? " 전체 회차 상세 내역은 별도 요청해주세요." : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>,
                document.body
              )}
              {financeLoading?<p className="text-sm text-gray-400 p-4 text-center">불러오는 중...</p>:(()=>{
                const DONE_STAGES = ["confirmed","cancelled","rejected"];
                const filtered=financeConsults.filter((c:any)=>
                  financeFilter==="active"?!DONE_STAGES.includes(c.progress_stage??""):
                  financeFilter==="done"?DONE_STAGES.includes(c.progress_stage??""):true
                );
                if(filtered.length===0) return <div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>해당 상담이 없습니다</div>;
                return (
                  <div className="space-y-2">
                    {filtered.map((c:any)=>(
                      <div key={c.id} className={`${CARD} p-3.5`}>
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-[#0f172a]">{c.customer_name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{c.sub_type||"금융"}</span>
                              {c.finance_stage_label
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-medium">{c.finance_stage_label}</span>
                                : <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100 font-medium">{STS_LBL[c.status]??c.status}</span>
                              }
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                              {c.summary&&<span className="truncate max-w-[200px]">{c.summary}</span>}
                              <span className="ml-auto text-gray-300">{String(c.created_at||"").slice(0,10)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button className={BTO} onClick={()=>navigate(`/work/call-management?id=${c.id}`)}>이동</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══ 나르미 ══ */}
          {tab==="narumi"&&(
            <div className="space-y-3 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-semibold text-[#0f172a]">🚛 나르미 업무</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(["active","all","done"] as const).map(f=>(
                    <button key={f} onClick={()=>setNarumiFilter(f)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${narumiFilter===f?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                      {{active:"진행중",all:"전체",done:"완료/보류"}[f]}
                    </button>
                  ))}
                  <button className={BTG} onClick={()=>{
                    setNarumiLoading2(true);
                    supabase.from("narumi_tasks").select("*").order("created_at",{ascending:false}).limit(60)
                      .then(({data})=>{setNarumiList((data??[]) as NarumiTask[]);setNarumiLoading2(false);});
                  }}>새로고침</button>
                  <button className={BTO} onClick={()=>navigate("/narumi")}>전체 페이지 →</button>
                </div>
              </div>
              {narumiLoading2?<p className="text-sm text-gray-400 p-4 text-center">불러오는 중...</p>:(()=>{
                const DONE_STS = ["completed","registered","done","cancelled","on_hold"];
                const filtered = narumiFilter==="active"
                  ? narumiList.filter(t=>!DONE_STS.includes(t.status??""))
                  : narumiFilter==="done"
                  ? narumiList.filter(t=>DONE_STS.includes(t.status??""))
                  : narumiList;
                if(filtered.length===0) return <div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>해당 차량이 없습니다</div>;
                return (
                <div className="space-y-2">
                  {filtered.map((t:any)=>(
                    <div key={t.id} className={`${CARD} p-3.5 cursor-pointer hover:shadow-md transition-all`}
                      onClick={()=>navigate(`/narumi?id=${t.id}`)}>
                      <div className="flex items-start gap-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-[#0f172a]">{t.customer_name||"미확인"}</span>
                            {t.vin&&<span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-mono">{t.vin}</span>}
                            <StsBadge s={t.status}/>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                            {t.sales_rep&&<span>영업: {t.sales_rep}</span>}
                            {t.delivery_date&&<span>출고: {t.delivery_date}</span>}
                            {t.special_note&&<span className="text-orange-500 truncate max-w-[140px]">{t.special_note}</span>}
                            <span className="ml-auto text-gray-300">{String(t.created_at||"").slice(0,10)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0" onClick={e=>e.stopPropagation()}>
                          <button className={BTO} onClick={()=>navigate(`/narumi?id=${t.id}`)}>이동 →</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                );
              })()}
              {narumiConsults.length>0&&(()=>{
                const NARUMI_DONE_STS = ["policy_issued","closed","cancelled"];
                const filteredConsults = narumiFilter==="active"
                  ? narumiConsults.filter((c:any)=>!NARUMI_DONE_STS.includes(c.status??""))
                  : narumiFilter==="done"
                  ? narumiConsults.filter((c:any)=>NARUMI_DONE_STS.includes(c.status??""))
                  : narumiConsults;
                if(filteredConsults.length===0) return null;
                return (
                <div className={`${CARD} p-3.5`}>
                  <p className="text-xs font-semibold text-gray-500 mb-2">📋 나르미 상담내역 ({filteredConsults.length}건)</p>
                  <div className="space-y-2">
                    {filteredConsults.map((c:any)=>(
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
                            <button className={BTO} onClick={()=>navigate(`/work/call-management?id=${c.id}`)}>이동</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })()}
            </div>
          )}

          {/* ══ 진흥주문 ══ */}
          {tab==="jinheung"&&(
            <div className="space-y-3 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-semibold text-[#0f172a]">🔧 진흥주문 관리</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button className={BTG} onClick={()=>{
                    const myReq = ++jListReqRef.current;
                    setJLoading(true);
                    supabase.from("tb_orders").select("*").order("created_at",{ascending:false}).limit(60)
                      .then(({data})=>{ if(myReq!==jListReqRef.current) return; setJList(data??[]);setJLoading(false);});
                  }}>새로고침</button>
                  <button className={BTP} onClick={()=>setShowJNewForm(v=>!v)}>{showJNewForm?"닫기":"+ 신규 등록"}</button>
                  <button className={BTO} onClick={()=>navigate("/work/orders")}>전체 페이지 →</button>
                </div>
              </div>

              {/* 신규 주문 등록 폼 */}
              {showJNewForm&&(
                <div className={`${CARD} p-4`}>
                  <p className="text-sm font-semibold text-[#0f172a] mb-3">신규 진흥주문 등록</p>
                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    <div className="col-span-2">
                      <label className={LBL}>고객사명 *</label>
                      <input className={CTRL} placeholder="예: 에코파밍 주식회사" value={jNewForm.customer_name} onChange={e=>setJNewForm(p=>({...p,customer_name:e.target.value}))}/>
                    </div>
                    <div className="col-span-2">
                      <label className={LBL}>품목/규격 *</label>
                      <input className={CTRL} placeholder="예: 18*7-8 솔리드 4개" value={jNewForm.product_spec} onChange={e=>setJNewForm(p=>({...p,product_spec:e.target.value}))}/>
                    </div>
                    <div>
                      <label className={LBL}>수량</label>
                      <input type="number" className={CTRL} placeholder="수량" value={jNewForm.quantity} onChange={e=>setJNewForm(p=>({...p,quantity:e.target.value}))}/>
                    </div>
                    <div>
                      <label className={LBL}>메모</label>
                      <input className={CTRL} placeholder="특이사항" value={jNewForm.memo} onChange={e=>setJNewForm(p=>({...p,memo:e.target.value}))}/>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button className={BTS} onClick={()=>{setShowJNewForm(false);setJNewForm({customer_name:"",product_spec:"",quantity:"",memo:""});}}>취소</button>
                    <button className={BTP} disabled={jNewSaving||!jNewForm.customer_name||!jNewForm.product_spec}
                      onClick={async()=>{
                        setJNewSaving(true);
                        const{data,error}=await supabase.from("tb_orders").insert({
                          customer_name_raw:jNewForm.customer_name,
                          product_type:"tire",
                          product_spec:jNewForm.product_spec,
                          quantity:jNewForm.quantity?parseInt(jNewForm.quantity):null,
                          inbound_channel:"other",
                          status:"received",
                          memo:jNewForm.memo||null,
                        }).select().single();
                        setJNewSaving(false);
                        if(error){
                          console.error("진흥주문 저장 실패:", error);
                          alert("저장 중 오류가 발생했습니다: "+error.message);
                          return; // 입력값 유지 — 폼 닫지 않음
                        }
                        setShowJNewForm(false);
                        setJNewForm({customer_name:"",product_spec:"",quantity:"",memo:""});
                        // 목록 새로고침 후 신규 카드 자동 펼침
                        const myReq = ++jListReqRef.current;
                        const{data:list,error:listErr}=await supabase.from("tb_orders").select("*").order("created_at",{ascending:false}).limit(60);
                        if(listErr){ console.error("진흥주문 목록 갱신 실패:", listErr); }
                        if(myReq===jListReqRef.current) setJList(list??[]);
                        if(data?.id) setJExpanded(data.id);
                      }}>
                      {jNewSaving?"저장 중...":"저장"}
                    </button>
                  </div>
                </div>
              )}

              {/* 타이어 상담내역 + 진흥주문 통합 표시 — 각 항목에서 단계변경/휠반납/금액입력/삭제까지 한번에 처리 */}
              {(jConsultsLoading||jLoading)?<p className="text-xs text-gray-400">상담내역 불러오는 중...</p>:(jConsults.length>0||jList.length>0)?(
                <div className={`${CARD} p-3.5`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500">📋 타이어 상담내역 ({jConsults.length+jList.length}건)</p>
                    <div className="flex gap-1.5">
                      {(["active","all","done"] as const).map(f=>(
                        <button key={f} onClick={()=>setJFilter(f)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${jFilter===f?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                          {{active:"진행중",all:"전체",done:"종결"}[f]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {/* ── tb_orders 기반 항목 ── */}
                    {jList.filter((o:any)=>{
                      const wheelDone=!!o.wheel_returned_at;
                      const invoiced=!!o.invoiced_at||["invoiced","billed_in","payment_in","payment_out","wheel_returned"].includes(o.status);
                      const closed=invoiced&&wheelDone;
                      return jFilter==="active"?!closed:jFilter==="done"?closed:true;
                    }).map((o:any)=>{
                      const wheelDone=!!o.wheel_returned_at;
                      const invoiced=!!o.invoiced_at||["invoiced","billed_in","payment_in","payment_out","wheel_returned"].includes(o.status);
                      const delivered=!!o.delivered_at||["delivered","wheel_returned","invoiced","billed_in","payment_in","payment_out"].includes(o.status);
                      const closed=invoiced&&wheelDone;
                      const jStage:"received"|"delivered"|"invoiced"|"closed" = closed?"closed":invoiced?"invoiced":delivered?"delivered":"received";
                      const JSLBL:Record<string,string>={received:"접수(진흥전달)",delivered:"발송(납품완료)",invoiced:"계산서발행",closed:"종결"};
                      const JSCLR:Record<string,string>={received:"bg-gray-100 text-gray-600 border-gray-200",delivered:"bg-blue-100 text-blue-700 border-blue-200",invoiced:"bg-orange-100 text-orange-700 border-orange-200",closed:"bg-emerald-100 text-emerald-700 border-emerald-200"};
                      const isExp=jExpanded===o.id;
                      const reload=()=>{const myReq=++jListReqRef.current;supabase.from("tb_orders").select("*").order("created_at",{ascending:false}).limit(60).then(({data})=>{if(myReq===jListReqRef.current)setJList(data??[]);});};
                      return (
                        <div key={`jo-${o.id}`} id={`jorder-${o.id}`} className={`${CARD} overflow-hidden`}>
                          <div className="p-3.5">
                            <div className="flex items-start gap-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-semibold text-[#0f172a]">{o.customer_name_raw||"미확인"}</span>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${JSCLR[jStage]}`}>{JSLBL[jStage]}</span>
                                  {jStage!=="closed"&&jStage!=="received"&&(
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${wheelDone?"bg-purple-100 text-purple-700 border-purple-200":"bg-white text-gray-300 border-gray-200"}`}>휠반납 {wheelDone?"✓":"-"}</span>
                                  )}
                                </div>
                                {o.product_spec&&<p className="text-xs text-gray-600 mt-0.5 font-medium">{o.product_spec}{o.quantity?` × ${o.quantity}개`:""}</p>}
                                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                                  {o.price_to_customer&&<span className="text-orange-600 font-medium">매출 {Number(o.price_to_customer).toLocaleString("ko-KR")}원</span>}
                                  {o.margin!=null&&o.margin!==0&&<span className="text-emerald-600 font-medium">마진 {Number(o.margin).toLocaleString("ko-KR")}원</span>}
                                  <span className="text-gray-400">{String(o.created_at||"").slice(0,10)}</span>
                                </div>
                                {isExp&&(
                                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div><p className="text-gray-400">고객청구(매출)</p><p className="font-semibold text-orange-600">{o.price_to_customer?`${Number(o.price_to_customer).toLocaleString("ko-KR")}원`:"-"}</p></div>
                                      <div><p className="text-gray-400">진흥매입</p><p className="font-semibold text-gray-700">{o.price_from_jinheung?`${Number(o.price_from_jinheung).toLocaleString("ko-KR")}원`:"-"}</p></div>
                                      <div><p className="text-gray-400">마진</p><p className="font-semibold text-emerald-600">{o.margin!=null?`${Number(o.margin).toLocaleString("ko-KR")}원`:"-"}</p></div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                                        <input type="checkbox" checked={wheelDone} className="w-4 h-4 rounded border-gray-300 accent-purple-600"
                                          onChange={async()=>{
                                            const next=wheelDone?null:new Date().toISOString();
                                            await supabase.from("tb_orders").update({wheel_returned_at:next}).eq("id",o.id);
                                            if(next&&invoiced) await supabase.from("sales_records").update({wheel_returned:true}).eq("jinheung_order_id",o.id);
                                            reload();
                                          }}/>
                                        휠반납 완료{jStage==="invoiced"&&!wheelDone&&<span className="text-gray-400">(체크 시 자동 종결)</span>}
                                      </label>
                                      <button className={`${BTG} text-xs`} onClick={e=>{e.stopPropagation();setJAmtModal(o);setJAmtTo(o.price_to_customer?.toLocaleString("ko-KR")??"");setJAmtFrom(o.price_from_jinheung?.toLocaleString("ko-KR")??"");}}>💰 매출금액 입력</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                {jStage==="received"&&(
                                  <button className={BTO} onClick={async()=>{
                                    await supabase.from("tb_orders").update({status:"delivered",delivered_at:new Date().toISOString()}).eq("id",o.id);
                                    try{await fetch("https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/kakao-order-webhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"status_change",orderId:o.id,status:"delivered",customerName:o.customer_name_raw??"",productSpec:o.product_spec??"",quantity:o.quantity?.toString()??"",amount:String(o.price_to_customer??o.price_from_jinheung??"")})});}catch(e){console.error(e);}
                                    reload();
                                  }}>발송(납품완료) →</button>
                                )}
                                {jStage==="delivered"&&(
                                  <button className={BTO} onClick={()=>setJInvoiceModal(o)}>계산서발행 →</button>
                                )}
                                <button className={BTG} onClick={()=>setJExpanded(isExp?null:o.id)}>{isExp?"접기":"상세"}</button>
                                <button
                                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-red-400 hover:border-red-300 hover:bg-red-50 transition-all"
                                  onClick={async()=>{
                                    if(!window.confirm(`'${o.customer_name_raw||"미확인"}' 주문을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
                                    const {error}=await supabase.from("tb_orders").delete().eq("id",o.id);
                                    if(error){ console.error("진흥주문 삭제 실패:",error); alert("삭제 중 오류가 발생했습니다: "+error.message); return; }
                                    if(jExpanded===o.id) setJExpanded(null);
                                    reload();
                                  }}
                                >🗑 삭제</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* ── 상담(consultation_cases) 기반 타이어 항목 ── */}
                    {jConsults.filter((c:any)=>{
                      const wheelDone=!!c.wheel_returned_at;
                      const closed=(c.progress_stage==="invoiced"&&wheelDone)||c.progress_stage==="cancelled";
                      return jFilter==="active"?!closed:jFilter==="done"?closed:true;
                    }).map((c:any)=>{
                      const wheelDone=!!c.wheel_returned_at;
                      const invoiced=c.progress_stage==="invoiced";
                      const cancelled=c.progress_stage==="cancelled";
                      const closed=invoiced&&wheelDone;
                      const curStage=c.progress_stage??"contract";
                      const badgeLabel = cancelled?"취소":closed?"종결":invoiced?"계산서발행":curStage==="delivery"?"발송(납품완료)":"접수(계약)";
                      const badgeColor = cancelled?"bg-red-100 text-red-500 border-red-200":closed?"bg-emerald-100 text-emerald-700 border-emerald-200":invoiced?"bg-orange-100 text-orange-700 border-orange-200":curStage==="delivery"?"bg-blue-100 text-blue-700 border-blue-200":"bg-gray-100 text-gray-600 border-gray-200";
                      const isExp=jExpanded===`c-${c.id}`;
                      const toggleWheel=async()=>{
                        const next=wheelDone?null:new Date().toISOString();
                        const {error}=await supabase.from("consultation_tire_details").update({wheel_returned_at:next}).eq("consultation_id",c.id);
                        if(error){ alert("휠반납 처리 실패: "+error.message); return; }
                        if(next&&invoiced){
                          await supabase.from("sales_records").update({wheel_returned:true}).eq("consultation_id",c.id);
                        }
                        setJConsults((prev:any)=>prev.map((x:any)=>x.id===c.id?{...x,wheel_returned_at:next}:x));
                      };
                      return (
                        <div key={`jc-${c.id}`} className={`${CARD} overflow-hidden`}>
                          <div className="p-3.5">
                            <div className="flex items-start gap-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-semibold text-[#0f172a]">{c.customer_name}</span>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${badgeColor}`}>{badgeLabel}</span>
                                  {!cancelled&&curStage!=="contract"&&(
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${wheelDone?"bg-purple-100 text-purple-700 border-purple-200":"bg-white text-gray-300 border-gray-200"}`}>휠반납 {wheelDone?"✓":"-"}</span>
                                  )}
                                </div>
                                {c.product_detail&&<p className="text-xs text-gray-600 mt-0.5 font-medium">{c.product_detail}</p>}
                                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                                  {c.price_to_customer&&<span className="text-orange-600 font-medium">매출 {Number(c.price_to_customer).toLocaleString("ko-KR")}원</span>}
                                  {c.summary&&<span className="text-gray-500 truncate max-w-[200px]">{c.summary}</span>}
                                  <span className="ml-auto text-gray-300">{String(c.created_at||"").slice(0,10)}</span>
                                </div>
                                {isExp&&(
                                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                                    {c.summary&&<p className="text-xs text-gray-600 bg-gray-50 rounded-xl p-2.5 border border-gray-100">{c.summary}</p>}
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div><p className="text-gray-400">고객청구(매출)</p><p className="font-semibold text-orange-600">{c.price_to_customer?`${Number(c.price_to_customer).toLocaleString("ko-KR")}원`:"-"}</p></div>
                                      <div><p className="text-gray-400">진흥매입</p><p className="font-semibold text-gray-700">{c.price_from_jinheung?`${Number(c.price_from_jinheung).toLocaleString("ko-KR")}원`:"-"}</p></div>
                                      <div><p className="text-gray-400">마진</p><p className="font-semibold text-emerald-600">{(c.price_to_customer!=null&&c.price_from_jinheung!=null)?`${(Number(c.price_to_customer)-Number(c.price_from_jinheung)).toLocaleString("ko-KR")}원`:"-"}</p></div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      {!cancelled&&curStage!=="contract"?(
                                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                                          <input type="checkbox" checked={wheelDone} className="w-4 h-4 rounded border-gray-300 accent-purple-600" onChange={toggleWheel}/>
                                          휠반납 완료{invoiced&&!wheelDone&&<span className="text-gray-400">(체크 시 자동 종결)</span>}
                                        </label>
                                      ):<span/>}
                                      <button className={`${BTG} text-xs`} onClick={()=>{setJAmtModal({...c,__consult:true});setJAmtTo(c.price_to_customer?.toLocaleString("ko-KR")??"");setJAmtFrom(c.price_from_jinheung?.toLocaleString("ko-KR")??"");}}>💰 매출금액 입력</button>
                                    </div>
                                    {!cancelled&&!invoiced&&(
                                      <button className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-400 hover:border-red-200 hover:text-red-400 transition-all"
                                        onClick={async()=>{
                                          const {error}=await supabase.from("consultation_tire_details").update({process_stage:"cancelled",process_status:"cancelled"}).eq("consultation_id",c.id);
                                          if(error){ alert("처리 실패: "+error.message); return; }
                                          setJConsults((prev:any)=>prev.map((x:any)=>x.id===c.id?{...x,progress_stage:"cancelled"}:x));
                                        }}>취소 처리</button>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                {curStage==="contract"&&(
                                  <button className={BTO} onClick={async()=>{
                                    const {error}=await supabase.from("consultation_tire_details").update({process_stage:"delivery",process_status:"delivery"}).eq("consultation_id",c.id);
                                    if(error){ alert("단계 변경 실패: "+error.message); return; }
                                    setJConsults((prev:any)=>prev.map((x:any)=>x.id===c.id?{...x,progress_stage:"delivery"}:x));
                                  }}>발송(납품완료) →</button>
                                )}
                                {curStage==="delivery"&&(
                                  <button className={BTO} onClick={()=>{setOrderInvoiceModal(c);setOrderInvoiceAmtTo(c.price_to_customer?.toLocaleString("ko-KR")??"");setOrderInvoiceAmtFrom(c.price_from_jinheung?.toLocaleString("ko-KR")??"");}}>계산서발행 →</button>
                                )}
                                <button className={BTG} onClick={()=>setJExpanded(isExp?null:`c-${c.id}`)}>{isExp?"접기":"상세"}</button>
                                <button
                                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-red-400 hover:border-red-300 hover:bg-red-50 transition-all"
                                  onClick={async()=>{
                                    if(!window.confirm(`'${c.customer_name}' 상담건을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
                                    await supabase.from("consultation_tire_details").delete().eq("consultation_id",c.id);
                                    const {error}=await supabase.from("consultation_cases").delete().eq("id",c.id);
                                    if(error){ console.error("상담건 삭제 실패:",error); alert("삭제 중 오류가 발생했습니다: "+error.message); return; }
                                    setJConsults((prev:any)=>prev.filter((x:any)=>x.id!==c.id));
                                  }}
                                >🗑 삭제</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ):(
                <div className={`${CARD} p-8 text-center text-gray-400 text-sm`}>주문/상담 내역이 없습니다</div>
              )}
            </div>
          )}

          {/* ══ 메모 ══ */}
          {tab==="memo"&&(
            <div className="space-y-4 pb-4">
              {/* 헤더 */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">📝 미팅/통화 메모</p>
                  <p className="text-xs text-gray-400 mt-0.5">회의·통화·방문 내용을 기록하고 검색합니다</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className={BTG} onClick={()=>void loadMemos()}>새로고침</button>
                  <button
                    onClick={()=>{setShowNotesImport(p=>!p);setNotesRawText("");setNotesImportResult(null);}}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${showNotesImport?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                    🍎 Apple Notes 가져오기
                  </button>
                  <button className={BTO} onClick={()=>setShowMemoForm(true)}>+ 메모 작성</button>
                </div>
              </div>

              {/* Apple Notes 가져오기 패널 */}
              {showNotesImport&&(
                <div className={`${CARD} p-4 border-amber-200 bg-amber-50/30 space-y-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#0f172a]">🍎 Apple Notes → 메모탭 가져오기</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        메모 앱 → Meeting History 폴더 → 메모 선택 후 전체복사(⌘A→⌘C) → 아래 붙여넣기(⌘V)
                      </p>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0"
                      onClick={()=>{setShowNotesImport(false);setNotesRawText("");setNotesImportResult(null);}}>×</button>
                  </div>

                  <textarea rows={8}
                    className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-gray-700 resize-none focus:outline-none focus:border-orange-400 transition-all"
                    placeholder={"여기에 붙여넣기 하세요...\n\n예시:\n[4/21] 동성종합지게차 미팅\n# 중고 지게차 렌탈 상품 안내\n• 성능점검표 기본 양식 공유 필요\n\n[4/13] Ch Int. 미팅\n# 뉴질랜드 박람회\n..."}
                    value={notesRawText}
                    onChange={e=>setNotesRawText(e.target.value)}
                    disabled={notesImporting}
                  />

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">
                      {notesRawText.trim()
                        ? `${notesRawText.length.toLocaleString()}자 · AI가 자동 분리·요약 후 저장합니다`
                        : "여러 건의 미팅 메모를 한번에 붙여넣으면 AI가 각각 분리하여 저장합니다"}
                    </p>
                    <button
                      className={`${BTO} disabled:opacity-40 whitespace-nowrap`}
                      disabled={!notesRawText.trim()||notesImporting}
                      onClick={()=>void importNotesText(notesRawText)}>
                      {notesImporting?"✨ AI 분석 중...":"✨ AI 요약 저장"}
                    </button>
                  </div>

                  {/* 결과 */}
                  {notesImportResult&&(
                    <div className="border border-emerald-200 rounded-xl bg-emerald-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-emerald-700">
                        ✅ {notesImportResult.saved}건 저장 완료
                        {notesImportResult.skipped>0&&<span className="font-normal text-gray-400 ml-1">({notesImportResult.skipped}건 중복 건너뜀)</span>}
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {notesImportResult.items.map((it,i)=>(
                          <div key={i} className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-[#0f172a] truncate">{it.title}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">{it.date}</span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2">{it.summary}</p>
                          </div>
                        ))}
                      </div>
                      {notesImportResult.saved>0&&(
                        <button className={`${BTG} w-full text-xs`}
                          onClick={()=>{setShowNotesImport(false);setNotesRawText("");setNotesImportResult(null);}}>
                          메모 목록에서 확인하기 →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 필터 + 검색 */}
              <div className="flex flex-wrap gap-2 items-center">
                {(["all","meeting","call","visit","note"] as const).map(cat=>(
                  <button key={cat} onClick={()=>setMemoFilter(cat)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${memoFilter===cat?"bg-[#0f172a] text-white border-[#0f172a]":"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                    {cat==="all"?"전체":cat==="meeting"?"미팅":cat==="call"?"통화":cat==="visit"?"방문":"기타"}
                  </button>
                ))}
                <input
                  type="text" placeholder="고객명·내용 검색..."
                  className="ml-auto h-8 rounded-xl border border-gray-200 px-3 text-xs focus:outline-none focus:border-orange-400 w-48"
                  value={memoSearch} onChange={e=>setMemoSearch(e.target.value)}
                />
              </div>

              {/* 메모 작성 폼 */}
              {showMemoForm&&(
                <div className={`${CARD} p-4 border-orange-200 bg-orange-50/30`}>
                  <p className="text-sm font-semibold text-[#0f172a] mb-3">새 메모 작성</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">날짜</label>
                      <input type="date" className="w-full h-9 rounded-xl border border-gray-200 px-3 text-xs focus:outline-none focus:border-orange-400"
                        value={newMemo.memo_date} onChange={e=>setNewMemo(p=>({...p,memo_date:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">구분</label>
                      <select className="w-full h-9 rounded-xl border border-gray-200 px-3 text-xs focus:outline-none focus:border-orange-400"
                        value={newMemo.category} onChange={e=>setNewMemo(p=>({...p,category:e.target.value as Memo["category"]}))}>
                        <option value="meeting">미팅</option>
                        <option value="call">통화</option>
                        <option value="visit">방문</option>
                        <option value="note">기타</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">제목 (선택)</label>
                      <input type="text" placeholder="예: 라이즈리프트 봄 장비 수요 미팅"
                        className="w-full h-9 rounded-xl border border-gray-200 px-3 text-xs focus:outline-none focus:border-orange-400"
                        value={newMemo.title} onChange={e=>setNewMemo(p=>({...p,title:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">고객/거래처명 (선택)</label>
                      <input type="text" placeholder="예: (주)라이즈리프트"
                        className="w-full h-9 rounded-xl border border-gray-200 px-3 text-xs focus:outline-none focus:border-orange-400"
                        value={newMemo.related_name} onChange={e=>setNewMemo(p=>({...p,related_name:e.target.value}))}/>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 mb-1 block">내용 *</label>
                    <textarea rows={5} placeholder="미팅/통화/방문 내용을 자유롭게 기록하세요..."
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-orange-400 resize-none"
                      value={newMemo.content} onChange={e=>setNewMemo(p=>({...p,content:e.target.value}))}/>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button className={BTG} onClick={()=>{setShowMemoForm(false);setNewMemo({title:"",content:"",category:"meeting",related_name:"",memo_date:new Date().toISOString().slice(0,10),consultation_id:""});}}>취소</button>
                    <button
                      className={`${BTG} bg-orange-500 text-white border-orange-500 hover:bg-orange-600 disabled:opacity-40`}
                      disabled={!newMemo.content.trim()}
                      onClick={async()=>{
                        const ok=await saveMemo(newMemo);
                        if(ok){setShowMemoForm(false);setNewMemo({title:"",content:"",category:"meeting",related_name:"",memo_date:new Date().toISOString().slice(0,10),consultation_id:""});}
                      }}>저장</button>
                  </div>
                </div>
              )}

              {/* 상세 뷰 */}
              {memoDetail&&(
                <div className={`${CARD} p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <button className={BTG} onClick={()=>setMemoDetail(null)}>← 목록으로</button>
                    <button className="text-xs text-red-400 hover:text-red-600 transition-all" onClick={()=>void deleteMemo(memoDetail.id)}>삭제</button>
                  </div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                      {memoDetail.category==="meeting"?"미팅":memoDetail.category==="call"?"통화":memoDetail.category==="visit"?"방문":"기타"}
                    </span>
                    {memoDetail.related_name&&<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{memoDetail.related_name}</span>}
                    <span className="text-xs text-gray-400">{memoDetail.memo_date}</span>
                  </div>
                  {memoDetail.title&&<p className="text-base font-bold text-[#0f172a] mb-2">{memoDetail.title}</p>}
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-3">{memoDetail.content}</p>
                </div>
              )}

              {/* 목록 */}
              {!memoDetail&&(
                <>
                  {memoLoading&&(
                    <div className="flex items-center justify-center py-12 gap-2 text-xs text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"0ms"}}/>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"150ms"}}/>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"300ms"}}/>
                      <span>메모 불러오는 중...</span>
                    </div>
                  )}
                  {!memoLoading&&memos.filter(m=>{
                    const catOk = memoFilter==="all"||m.category===memoFilter;
                    const kw=memoSearch.trim().toLowerCase();
                    const kwOk = !kw||(m.content+"|"+(m.title||"")+(m.related_name||"")).toLowerCase().includes(kw);
                    return catOk&&kwOk;
                  }).length===0&&(
                    <div className={`${CARD} p-10 flex flex-col items-center gap-3 text-center`}>
                      <span className="text-3xl">📭</span>
                      <p className="text-sm font-medium text-gray-500">저장된 메모가 없습니다</p>
                      <p className="text-xs text-gray-400">AI 채팅에서 미팅 내용을 입력하거나 직접 작성하세요</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {!memoLoading&&memos.filter(m=>{
                      const catOk = memoFilter==="all"||m.category===memoFilter;
                      const kw=memoSearch.trim().toLowerCase();
                      const kwOk = !kw||(m.content+"|"+(m.title||"")+(m.related_name||"")).toLowerCase().includes(kw);
                      return catOk&&kwOk;
                    }).map(m=>(
                      <div key={m.id}
                        className={`${CARD} p-4 cursor-pointer hover:shadow-md transition-all`}
                        onClick={()=>setMemoDetail(m)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                                {m.category==="meeting"?"미팅":m.category==="call"?"통화":m.category==="visit"?"방문":"기타"}
                              </span>
                              {m.related_name&&<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{m.related_name}</span>}
                              <span className="text-xs text-gray-400">{m.memo_date}</span>
                            </div>
                            {m.title&&<p className="text-sm font-semibold text-[#0f172a] mb-0.5">{m.title}</p>}
                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{m.content}</p>
                          </div>
                          <button className={BTG} onClick={e=>{e.stopPropagation();void deleteMemo(m.id);}}>삭제</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ 이메일 리포트 ══ */}
          {tab==="email"&&(
            <div className="space-y-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">📧 이메일 리포트</p>
                  <p className="text-xs text-gray-400 mt-0.5">Claude가 분석한 수신 이메일 업무 리포트</p>
                </div>
                <button className={BTG} onClick={()=>void loadEmailReports()}>새로고침</button>
              </div>

              {emailLoading?(
                <div className="flex items-center justify-center py-12 gap-2 text-xs text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"0ms"}}/>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"150ms"}}/>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{animationDelay:"300ms"}}/>
                  <span>리포트 불러오는 중...</span>
                </div>
              ):emailReports.length===0?(
                <div className={`${CARD} p-10 flex flex-col items-center gap-3 text-center`}>
                  <span className="text-4xl">📭</span>
                  <p className="text-sm font-medium text-gray-500">저장된 이메일 리포트가 없습니다</p>
                  <p className="text-xs text-gray-400">Claude에서 이메일 분석 후 리포트가 여기에 자동 저장됩니다</p>
                </div>
              ):(
                <div className="space-y-3">
                  {/* 상세 뷰 */}
                  {emailDetail&&(
                    <div className={`${CARD} p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <button className={BTG} onClick={()=>setEmailDetail(null)}>← 목록으로</button>
                        <button className="text-xs text-red-400 hover:text-red-600 transition-all" onClick={()=>void deleteEmailReport(emailDetail.id)}>삭제</button>
                      </div>
                      <p className="text-base font-bold text-[#0f172a] mb-1">{emailDetail.title}</p>
                      <p className="text-xs text-gray-400 mb-4">{fmtDT(emailDetail.created_at)}</p>
                      <div className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-4"
                        dangerouslySetInnerHTML={{__html:md2html(emailDetail.content)}}/>
                    </div>
                  )}
                  {/* 목록 */}
                  {!emailDetail&&emailReports.map(r=>(
                    <div key={r.id}
                      className={`${CARD} p-4 cursor-pointer hover:shadow-md transition-all ${!r.is_read?"border-l-4 border-orange-400":""}`}
                      onClick={()=>{setEmailDetail(r);if(!r.is_read)void markEmailRead(r.id);}}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {!r.is_read&&<span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0"/>}
                            <span className={`text-sm font-semibold text-[#0f172a] ${!r.is_read?"":""}`}>{r.title}</span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 break-keep">{r.content.slice(0,120).replace(/[#*_\[\]]/g,"")}...</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-gray-400">{fmtDT(r.created_at)}</span>
                            {!r.is_read&&<span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">미확인</span>}
                          </div>
                        </div>
                        <button className={BTG} onClick={e=>{e.stopPropagation();void deleteEmailReport(r.id);}}>삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

          {tab==="financehub"&&<FinanceHubTab/>}

          {tab==="exportshop"&&<ExportShopTab onNavigate={(p)=>navigate(p)}/>}

          {tab==="quotation"&&(
            <div className="flex flex-col items-center justify-center gap-4 py-16 w-full">
              <div className="text-4xl">📋</div>
              <h2 className="text-lg font-bold text-[#0f172a]">견적서 작성</h2>
              <p className="text-sm text-gray-500 text-center">지게차 · 배터리 · 할부금융 견적서를 작성하고<br/>이메일 · SMS로 발송할 수 있습니다.</p>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                <button
                  onClick={()=>navigate("/work/quotation?type=battery")}
                  className="px-5 py-2.5 bg-[#0f172a] text-white rounded-xl text-sm font-medium hover:bg-[#1e3a5f] transition-all"
                >
                  🔋 배터리 견적
                </button>
                <button
                  onClick={()=>navigate("/work/quotation?type=forklift")}
                  className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-all"
                >
                  🚜 지게차 견적
                </button>
                <button
                  onClick={()=>navigate("/work/quotation?type=installment")}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all"
                >
                  💳 할부금융 견적
                </button>
                <button
                  onClick={()=>navigate("/work/statement")}
                  className="px-5 py-2.5 bg-gray-700 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all"
                >
                  📑 거래명세서
                </button>
              </div>
            </div>
          )}

          {tab==="statement"&&(
            <div className="flex flex-col items-center justify-center gap-4 py-16 w-full">
              <div className="text-4xl">📑</div>
              <h2 className="text-lg font-bold text-[#0f172a]">거래명세서 작성</h2>
              <p className="text-sm text-gray-500 text-center">거래처 정보와 품목을 입력해 거래명세서를 작성하고<br/>원본 양식 그대로 엑셀 다운로드 · 이메일 발송할 수 있습니다.</p>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                <button
                  onClick={()=>navigate("/work/statement")}
                  className="px-5 py-2.5 bg-[#0f172a] text-white rounded-xl text-sm font-medium hover:bg-[#1e3a5f] transition-all"
                >
                  📑 거래명세서 작성하기
                </button>
              </div>
            </div>
          )}

          {/* ══ 입력창 (항상 하단 고정) ══ */}
          <div className="flex-shrink-0 pt-2">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {["오늘 현황 요약","긴급 업무","오늘 사후관리","방금 통화 저장","미팅 메모 정리"].map(c=>(
                <button key={c} onClick={()=>quickChat(c.includes("저장")||c.includes("정리")?c+". ":c+" 알려줘")}
                  className="px-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-100 bg-gray-50 transition-all">
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
                <button className={`${BTP} h-9 px-4 flex-shrink-0`} onClick={()=>void checkDupAndSend()} disabled={chatLoading||!chatInput.trim()}>전송</button>
              </div>
            </div>
          </div>

        </main>
      </div>

      {jAmtModal&&(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4" style={{backdropFilter:"blur(2px)"}}>
          <div className="w-full max-w-sm border border-gray-200 rounded-2xl bg-white shadow-2xl p-6">
            <h2 className="text-base font-bold text-[#0f172a] mb-1">매출금액 입력</h2>
            <p className="text-sm text-gray-500 mb-4">{jAmtModal.__consult?jAmtModal.customer_name:jAmtModal.customer_name_raw} — {jAmtModal.__consult?(jAmtModal.product_detail??""):jAmtModal.product_spec}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">고객사 청구금액 (원)</label>
                <input value={jAmtTo} onChange={e=>setJAmtTo(e.target.value.replace(/[^0-9]/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,","))} placeholder="예: 250,000" inputMode="numeric" className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-400"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">(주)진흥 매입금액 (원)</label>
                <input value={jAmtFrom} onChange={e=>setJAmtFrom(e.target.value.replace(/[^0-9]/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,","))} placeholder="예: 220,000" inputMode="numeric" className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-400"/>
              </div>
              {jAmtTo&&jAmtFrom&&(
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-xs text-emerald-700 font-semibold">마진: {(parseInt(jAmtTo.replace(/,/g,""))-parseInt(jAmtFrom.replace(/,/g,""))).toLocaleString("ko-KR")}원</p>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={()=>setJAmtModal(null)} className={BTG}>취소</button>
              <button disabled={jSaving} onClick={async()=>{
                setJSaving(true);
                const amtTo = jAmtTo?parseInt(jAmtTo.replace(/,/g,"")):null;
                const amtFrom = jAmtFrom?parseInt(jAmtFrom.replace(/,/g,"")):null;
                if(jAmtModal.__consult){
                  await supabase.from("consultation_tire_details").update({
                    price_to_customer: amtTo,
                    price_from_jinheung: amtFrom,
                  }).eq("consultation_id",jAmtModal.id);
                  // 이미 매출관리에 등록된 건이면 금액도 동기화
                  await supabase.from("sales_records").update({ unit_price: amtTo??0, unit_cost: amtFrom??0 }).eq("consultation_id",jAmtModal.id);
                  setJConsults((prev:any)=>prev.map((x:any)=>x.id===jAmtModal.id?{...x,price_to_customer:amtTo,price_from_jinheung:amtFrom}:x));
                } else {
                  await supabase.from("tb_orders").update({
                    price_to_customer: amtTo,
                    price_from_jinheung: amtFrom,
                  }).eq("id",jAmtModal.id);
                  await supabase.from("sales_records").update({ unit_price: amtTo??0, unit_cost: amtFrom??0 }).eq("jinheung_order_id",jAmtModal.id);
                  {const myReq=++jListReqRef.current;supabase.from("tb_orders").select("*").order("created_at",{ascending:false}).limit(60).then(({data})=>{if(myReq===jListReqRef.current)setJList(data??[]);});}
                }
                setJSaving(false); setJAmtModal(null);
              }} className="px-4 py-2 rounded-xl bg-[#0f172a] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 진흥주문 — 계산서발행 시 이미지 업로드 강제 모달 */}
      {jInvoiceModal&&(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4" style={{backdropFilter:"blur(2px)"}} onClick={()=>{if(!jInvoiceUploading){setJInvoiceModal(null);setJInvoiceFile(null);}}}>
          <div className="w-full max-w-sm border border-gray-200 rounded-2xl bg-white shadow-2xl p-6" onClick={e=>e.stopPropagation()}>
            <h2 className="text-base font-bold text-[#0f172a] mb-1">계산서발행 — 세금계산서 등록</h2>
            <p className="text-sm text-gray-500 mb-4">{jInvoiceModal.customer_name_raw} — {jInvoiceModal.product_spec}</p>
            <p className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-xl p-2.5 mb-3">
              계산서발행 단계로 전환하려면 세금계산서 이미지를 먼저 등록해야 합니다. 등록 즉시 매출관리에도 자동 반영됩니다.
            </p>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={e=>setJInvoiceFile(e.target.files?.[0]??null)}
              className="w-full text-xs text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:bg-orange-50 file:text-orange-600 file:text-xs file:font-semibold"
            />
            {jInvoiceFile&&<p className="mt-2 text-xs text-gray-500">선택됨: {jInvoiceFile.name}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={jInvoiceUploading} onClick={()=>{setJInvoiceModal(null);setJInvoiceFile(null);}} className={BTG}>취소</button>
              <button
                disabled={!jInvoiceFile||jInvoiceUploading}
                onClick={async()=>{
                  if(!jInvoiceFile) return;
                  setJInvoiceUploading(true);
                  try{
                    const o = jInvoiceModal;
                    const ext = jInvoiceFile.name.split(".").pop() || "jpg";
                    const path = `jinheung/${o.id}_${Date.now()}.${ext}`;
                    const { error: upErr } = await supabase.storage.from("tax-invoices").upload(path, jInvoiceFile, { upsert:true, contentType: jInvoiceFile.type || undefined });
                    if(upErr){ alert("업로드 실패: "+upErr.message); setJInvoiceUploading(false); return; }

                    // 1. tb_orders 상태 업데이트 (계산서발행 + 이미지 경로 저장)
                    await supabase.from("tb_orders").update({
                      status: "invoiced",
                      invoiced_at: new Date().toISOString(),
                      invoice_image_path: path,
                    }).eq("id", o.id);

                    // 2. 매출(sales_records) 자동 반영
                    await supabase.from("sales_records").insert({
                      sale_date: new Date().toISOString().split("T")[0],
                      customer_name: o.customer_name_raw || "미확인",
                      business_no: null,
                      category: "타이어",
                      trade_type: "내수",
                      maker: null,
                      spec: o.product_spec || null,
                      quantity: o.quantity || 1,
                      unit_price: o.price_to_customer || 0,
                      unit_cost: o.price_from_jinheung || 0,
                      tax_invoice: true,
                      payment_confirmed: false,
                      payment_date: null,
                      delivery_date: o.delivered_at ? String(o.delivered_at).slice(0,10) : null,
                      delivery_confirmed: !!o.delivered_at,
                      wheel_returned: !!o.wheel_returned_at,
                      closing: false,
                      note: `진흥주문 #${o.id} (${o.customer_name_raw}) 자동 연동 — 계산서발행 시 자동 등록`,
                      jinheung_order_id: o.id,
                    });

                    try{await fetch("https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/kakao-order-webhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"status_change",orderId:o.id,status:"invoiced",customerName:o.customer_name_raw??"",productSpec:o.product_spec??"",quantity:o.quantity?.toString()??"",amount:String(o.price_to_customer??o.price_from_jinheung??"")})});}catch(e){console.error(e);}

                    setJInvoiceModal(null); setJInvoiceFile(null); setJInvoiceUploading(false);
                    showToast("계산서발행 완료 + 매출관리 자동 등록됨");
                    {const myReq=++jListReqRef.current;supabase.from("tb_orders").select("*").order("created_at",{ascending:false}).limit(60).then(({data})=>{if(myReq===jListReqRef.current)setJList(data??[]);});}
                  }catch(err){
                    console.error(err);
                    alert("처리 중 오류가 발생했습니다.");
                    setJInvoiceUploading(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#0f172a] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40"
              >{jInvoiceUploading?"처리 중...":"등록 + 매출반영"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 주문상담 탭 — 타이어/배터리 계산서발행 시 이미지 업로드 강제 모달 */}
      {orderInvoiceModal&&(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4" style={{backdropFilter:"blur(2px)"}} onClick={()=>{if(!orderInvoiceUploading){setOrderInvoiceModal(null);setOrderInvoiceFile(null);}}}>
          <div className="w-full max-w-sm border border-gray-200 rounded-2xl bg-white shadow-2xl p-6" onClick={e=>e.stopPropagation()}>
            <h2 className="text-base font-bold text-[#0f172a] mb-1">계산서발행 — 세금계산서 등록</h2>
            <p className="text-sm text-gray-500 mb-4">{orderInvoiceModal.customer_name} — {orderInvoiceModal.product_detail ?? WL[orderInvoiceModal.work_type]}</p>
            <p className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-xl p-2.5 mb-3">
              계산서발행 단계로 전환하려면 세금계산서 이미지를 먼저 등록해야 합니다. 등록 즉시 매출관리에도 자동 반영됩니다.
            </p>
            <div className="space-y-2 mb-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">매출금액(고객 청구, 원)</label>
                <input value={orderInvoiceAmtTo} onChange={e=>setOrderInvoiceAmtTo(e.target.value.replace(/[^0-9]/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,","))} placeholder="예: 250,000" inputMode="numeric" className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-400"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">매입금액(원, 선택)</label>
                <input value={orderInvoiceAmtFrom} onChange={e=>setOrderInvoiceAmtFrom(e.target.value.replace(/[^0-9]/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,","))} placeholder="예: 220,000" inputMode="numeric" className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-400"/>
              </div>
            </div>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={e=>setOrderInvoiceFile(e.target.files?.[0]??null)}
              className="w-full text-xs text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:bg-orange-50 file:text-orange-600 file:text-xs file:font-semibold"
            />
            {orderInvoiceFile&&<p className="mt-2 text-xs text-gray-500">선택됨: {orderInvoiceFile.name}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={orderInvoiceUploading} onClick={()=>{setOrderInvoiceModal(null);setOrderInvoiceFile(null);}} className={BTG}>취소</button>
              <button
                disabled={!orderInvoiceFile||orderInvoiceUploading}
                onClick={async()=>{
                  if(!orderInvoiceFile) return;
                  setOrderInvoiceUploading(true);
                  try{
                    const o = orderInvoiceModal!;
                    const amtTo = orderInvoiceAmtTo ? parseInt(orderInvoiceAmtTo.replace(/,/g,"")) : 0;
                    const amtFrom = orderInvoiceAmtFrom ? parseInt(orderInvoiceAmtFrom.replace(/,/g,"")) : 0;
                    const ext = orderInvoiceFile.name.split(".").pop() || "jpg";
                    const path = `orders/${o.id}_${Date.now()}.${ext}`;
                    const { error: upErr } = await supabase.storage.from("tax-invoices").upload(path, orderInvoiceFile, { upsert:true, contentType: orderInvoiceFile.type || undefined });
                    if(upErr){ alert("업로드 실패: "+upErr.message); setOrderInvoiceUploading(false); return; }

                    // 1. 상세 테이블 단계 업데이트 + 계산서 이미지 경로 + 금액 저장
                    const table = ["tire","tire_sales"].includes(o.work_type) ? "consultation_tire_details" : "consultation_battery_details";
                    const updatePatch:any = {
                      process_stage: "invoiced",
                      process_status: "invoiced",
                      invoice_image_path: path,
                    };
                    if(table==="consultation_tire_details"){
                      updatePatch.price_to_customer = amtTo;
                      updatePatch.price_from_jinheung = amtFrom;
                    }
                    await supabase.from(table).update(updatePatch).eq("consultation_id", o.id);

                    // 2. 매출(sales_records) 자동 반영 — 이미 등록된 건이면 중복 방지, 금액은 입력값 사용
                    const { data: existing } = await supabase.from("sales_records").select("id").eq("consultation_id", o.id).maybeSingle();
                    if(!existing){
                      await supabase.from("sales_records").insert({
                        sale_date: new Date().toISOString().split("T")[0],
                        customer_name: o.customer_name,
                        business_no: null,
                        category: ["tire","tire_sales"].includes(o.work_type) ? "타이어" : "배터리(LFP)",
                        trade_type: "내수",
                        maker: null,
                        spec: o.product_detail || null,
                        quantity: 1,
                        unit_price: amtTo,
                        unit_cost: amtFrom,
                        tax_invoice: true,
                        payment_confirmed: false,
                        payment_date: null,
                        delivery_date: null,
                        delivery_confirmed: false,
                        wheel_returned: false,
                        closing: false,
                        note: `상담건 #${o.id} (${o.customer_name}) 자동 연동 — 계산서발행 시 자동 등록`,
                        consultation_id: o.id,
                      });
                    } else {
                      await supabase.from("sales_records").update({ unit_price: amtTo, unit_cost: amtFrom }).eq("id", existing.id);
                    }

                    setOrderInvoiceModal(null); setOrderInvoiceFile(null); setOrderInvoiceUploading(false);
                    setOrderInvoiceAmtTo(""); setOrderInvoiceAmtFrom("");
                    showToast("계산서발행 완료 + 매출관리 자동 등록됨");
                    setJConsults((prev:any)=>prev.map((x:any)=>x.id===o.id?{...x,progress_stage:"invoiced",price_to_customer:amtTo,price_from_jinheung:amtFrom}:x));
                    void loadOrderViews();
                  }catch(err){
                    console.error(err);
                    alert("처리 중 오류가 발생했습니다.");
                    setOrderInvoiceUploading(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#0f172a] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40"
              >{orderInvoiceUploading?"처리 중...":"등록 + 매출반영"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 주문상담 탭 — 여러 건 묶어서 계산서 1장 발행 */}
      {orderBulkInvoiceModal&&(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4" style={{backdropFilter:"blur(2px)"}} onClick={()=>{if(!orderBulkInvoiceUploading){setOrderBulkInvoiceModal(null);setOrderBulkInvoiceFile(null);}}}>
          <div className="w-full max-w-md border border-gray-200 rounded-2xl bg-white shadow-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <h2 className="text-base font-bold text-[#0f172a] mb-1">묶음 계산서발행</h2>
            <p className="text-sm text-gray-500 mb-3">선택한 {orderBulkInvoiceModal.length}건을 계산서 1장으로 묶어 발행합니다.</p>

            <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto border border-gray-100 rounded-xl p-2">
              {orderBulkInvoiceModal.map(o=>(
                <div key={o.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                  <span className="font-medium text-gray-700">{o.customer_name}</span>
                  <span className="text-gray-400 truncate ml-2">{o.product_detail ?? WL[o.work_type]}</span>
                </div>
              ))}
            </div>

            {(() => {
              const customers = new Set(orderBulkInvoiceModal.map(o=>o.customer_name));
              if(customers.size > 1){
                return (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-2.5 mb-3">
                    ⚠️ 선택한 건의 거래처가 서로 다릅니다 ({[...customers].join(", ")}). 계산서는 동일 거래처 건끼리만 묶어 발행해주세요.
                  </p>
                );
              }
              return (
                <p className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-xl p-2.5 mb-3">
                  세금계산서 이미지 1장을 등록하면 선택된 {orderBulkInvoiceModal.length}건 모두 계산서발행 단계로 전환되고, 매출관리에도 각 건이 자동 등록됩니다.
                </p>
              );
            })()}

            <input
              type="file"
              accept="image/*,.pdf"
              onChange={e=>setOrderBulkInvoiceFile(e.target.files?.[0]??null)}
              className="w-full text-xs text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:bg-orange-50 file:text-orange-600 file:text-xs file:font-semibold"
            />
            {orderBulkInvoiceFile&&<p className="mt-2 text-xs text-gray-500">선택됨: {orderBulkInvoiceFile.name}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button disabled={orderBulkInvoiceUploading} onClick={()=>{setOrderBulkInvoiceModal(null);setOrderBulkInvoiceFile(null);}} className={BTG}>취소</button>
              <button
                disabled={!orderBulkInvoiceFile||orderBulkInvoiceUploading||new Set(orderBulkInvoiceModal.map(o=>o.customer_name)).size>1}
                onClick={async()=>{
                  if(!orderBulkInvoiceFile) return;
                  setOrderBulkInvoiceUploading(true);
                  try{
                    const items = orderBulkInvoiceModal;
                    const ext = orderBulkInvoiceFile.name.split(".").pop() || "jpg";
                    const groupKey = `bulk_${Date.now()}`;
                    const path = `orders/${groupKey}.${ext}`;
                    const { error: upErr } = await supabase.storage.from("tax-invoices").upload(path, orderBulkInvoiceFile, { upsert:true, contentType: orderBulkInvoiceFile.type || undefined });
                    if(upErr){ alert("업로드 실패: "+upErr.message); setOrderBulkInvoiceUploading(false); return; }

                    for(const o of items){
                      const table = ["tire","tire_sales"].includes(o.work_type) ? "consultation_tire_details" : "consultation_battery_details";
                      await supabase.from(table).update({
                        process_stage: "invoiced",
                        invoice_image_path: path,
                        invoice_group_key: groupKey,
                      }).eq("consultation_id", o.id);

                      const { data: existing } = await supabase.from("sales_records").select("id").eq("consultation_id", o.id).maybeSingle();
                      if(!existing){
                        await supabase.from("sales_records").insert({
                          sale_date: new Date().toISOString().split("T")[0],
                          customer_name: o.customer_name,
                          business_no: null,
                          category: ["tire","tire_sales"].includes(o.work_type) ? "타이어" : "배터리(LFP)",
                          trade_type: "내수",
                          maker: null,
                          spec: o.product_detail || null,
                          quantity: 1,
                          unit_price: 0,
                          unit_cost: 0,
                          tax_invoice: true,
                          payment_confirmed: false,
                          payment_date: null,
                          delivery_date: null,
                          delivery_confirmed: false,
                          wheel_returned: false,
                          closing: false,
                          note: `상담건 #${o.id} (${o.customer_name}) 묶음 계산서발행 — ${items.length}건 합산 발행, 단가/매입가 확인 필요`,
                          consultation_id: o.id,
                          invoice_group_key: groupKey,
                        });
                      }
                    }

                    setOrderBulkInvoiceModal(null); setOrderBulkInvoiceFile(null); setOrderBulkInvoiceUploading(false);
                    setOrderSelectMode(false); setOrderSelectedIds(new Set());
                    showToast(`${items.length}건 묶음 계산서발행 완료 + 매출관리 자동 등록됨`);
                    void loadOrderViews();
                  }catch(err){
                    console.error(err);
                    alert("처리 중 오류가 발생했습니다.");
                    setOrderBulkInvoiceUploading(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#0f172a] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40"
              >{orderBulkInvoiceUploading?"처리 중...":`${orderBulkInvoiceModal.length}건 묶음발행`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretaryPage;