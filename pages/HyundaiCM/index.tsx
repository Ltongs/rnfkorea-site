// pages/HyundaiCM/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Settings } from "lucide-react";
import html2canvas from "html2canvas";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ─── 정책 ─────────────────────────────────────────────────
const HIDE_CLOSED_AFTER_DAYS_FOR_NON_ADMIN = 30;
const DOC_DELETE_AFTER_HOURS = 24;   // 확정 후 24시간 경과 시 첨부파일 삭제
const PHONE_MASK_AFTER_HOURS = 24;    // 확정 후 24시간 경과 시 전화번호 마스킹

// ─── 타입 ─────────────────────────────────────────────────
type CustomerType = "개인" | "법인";
type HCMStatus    = "접수" | "신용조회" | "승인" | "보완" | "거절" | "확정";

type FinanceCompany = "NH캐피탈" | "오릭스캐피탈" | "우리금융캐피탈";

type HCMTask = {
  id: string | number;
  customer_type: CustomerType;
  customer_name: string;
  customer_phone: string | null;
  company_name: string | null;
  ceo_name: string | null;             // 법인 대표자명
  repayment_sent_at?: string | null;
  repayment_sent_channel?: "sms" | null;
  repayment_sent_to?: string | null;
  equipment_ton: string | null;        // 톤수
  purchase_amount: number | null;      // 차량가격 (차량+어태치 합산)
  vehicle_amount: number | null;       // 차량가격 (순수 차량)
  attach_amount: number | null;        // 어태치 가격
  installment_principal: number | null; // 할부원금
  grace_period: number | null;         // 거치기간 (개월)
  installment_period: number | null;   // 할부기간 (개월)
  finance_company: string | null;      // 할부금융사
  interest_rate: number | null;        // 금리
  incentive: number | null;            // 인센티브
  nice_score: number | null;           // NICE 점수
  credit_rate: number | null;          // 적용금리 (%)
  credit_incentive: number | null;     // 적용인센티브 (%)
  biz_history: string | null;          // 업력 (1년이상/1년미만)
  loan_limit: number | null;           // 대출한도 (승인 시)
  credit_note: string | null;          // 특이사항(승인)/보완사항(보완)/거절사유(거절)
  has_tax_invoice: boolean | null;     // 세금계산서 업로드 여부
  vat_deferred: boolean | null;        // 부가세 후불 여부
  vat_deferred_amount: number | null;  // 부가세 후불 금액
  loan_period: number | null;          // 대출기간 (확정 시)
  sales_rep: string | null;
  status: HCMStatus;
  special_note: string | null;
  doc_id_card: string | null;
  doc_employment: string | null;
  doc_income: string | null;
  doc_estimate: string | null;
  doc_excavator_license: string | null;
  doc_etc: string | null;
  created_at?: string;
  closed_at?: string | null;
  phone_scrubbed_at?: string | null;
};

// ─── 유틸 ─────────────────────────────────────────────────
function onlyDigits(s: string) { return (s ?? "").replace(/\D/g, ""); }

function formatPhoneKR(raw: string) {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function formatCreatedAt(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function shouldMaskPhone(r: HCMTask) {
  // DB에서 영구 마스킹된 경우
  if (r.phone_scrubbed_at) return true;
  // 확정 후 24시간 경과
  if (!r.closed_at) return false;
  const t = new Date(r.closed_at).getTime();
  if (Number.isNaN(t)) return false;
  return (Date.now() - t) / (1000 * 60 * 60) >= PHONE_MASK_AFTER_HOURS;
}

function maskPhone(phone: string | null) {
  if (!phone) return "-";
  const d = onlyDigits(phone);
  if (d.length < 8) return phone;
  return formatPhoneKR(d.slice(0, d.length - 4) + "****");
}

function getDisplayPhone(r: HCMTask) {
  if (!r.customer_phone) return "-";
  return shouldMaskPhone(r) ? maskPhone(r.customer_phone) : formatPhoneKR(r.customer_phone);
}

function isDocExpired(closedAt?: string | null) {
  if (!closedAt) return false;
  const t = new Date(closedAt).getTime();
  if (Number.isNaN(t)) return false;
  return (Date.now() - t) / (1000 * 60 * 60) >= DOC_DELETE_AFTER_HOURS;
}

function formatAmount(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function extFromName(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

// ─── NH캐피탈 조견표 (최대 인센티브 기준) ────────────────────
const NH_RATE_TABLE = [
  { min: 922, max: 1000, rate: 6.3, incentive: 1.7 },
  { min: 868, max: 921,  rate: 6.4, incentive: 1.7 },
  { min: 824, max: 867,  rate: 6.5, incentive: 1.7 },
  { min: 778, max: 823,  rate: 6.6, incentive: 1.7 },
  { min: 729, max: 777,  rate: 6.8, incentive: 1.7 },
];
function getNhRateByScore(score: number): { rate: number; incentive: number } | null {
  const entry = NH_RATE_TABLE.find((e) => score >= e.min && score <= e.max);
  return entry ? { rate: entry.rate, incentive: entry.incentive } : null;
}

// ─── 상태 설정 ────────────────────────────────────────────
const STATUS_ORDER: HCMStatus[] = ["접수", "신용조회", "확정"];
const CREDIT_STATUSES: HCMStatus[] = ["승인", "보완", "거절"];

// 신용결과(승인/보완/거절)를 포함한 전체 순서 인덱스
// 신용결과는 신용조회(1) 다음, 서류등록(2) 이전에 위치
const FULL_STATUS_ORDER: HCMStatus[] = ["접수", "신용조회", "승인", "보완", "거절", "확정"];

function getStatusIndex(status: HCMStatus): number {
  return FULL_STATUS_ORDER.indexOf(status);
}

// 다음 단계로 이동 가능 여부 (한 단계씩만 전진)
// 신용결과(승인/보완/거절)는 신용조회 다음에만 선택 가능
// 서류등록은 신용결과(승인/보완/거절) 다음에만 가능
function canGoToStatus(current: HCMStatus, next: HCMStatus, isAdmin: boolean): boolean {
  const currentIdx = getStatusIndex(current);
  const nextIdx    = getStatusIndex(next);

  // 뒤로 가기: admin만 허용
  if (nextIdx < currentIdx) return isAdmin;

  // 같은 단계: 불가
  if (nextIdx === currentIdx) return false;

  // 접수 또는 신용조회 상태 → 신용결과(승인/보완/거절): 허용
  if ((current === "접수" || current === "신용조회") && CREDIT_STATUSES.includes(next)) return true;

  // 신용조회 상태에서 신용결과 외 점프: 불가 (확정은 허용)
  if (current === "신용조회" && !CREDIT_STATUSES.includes(next) && next !== "확정") return false;

  // 신용결과 상태 → 확정: 허용
  if (CREDIT_STATUSES.includes(current) && next === "확정") return true;

  // 신용결과 상태에서 확정 외 점프: 불가
  if (CREDIT_STATUSES.includes(current) && next !== "확정") return false;

  // 일반 순서: 접수 → 신용조회 → 확정
  const mainOrder: HCMStatus[] = ["접수", "신용조회", "확정"];
  const currentMainIdx = mainOrder.indexOf(CREDIT_STATUSES.includes(current) ? "확정" : current);
  const nextMainIdx    = mainOrder.indexOf(next);
  return nextMainIdx === currentMainIdx + 1;
}

function statusStyle(status: HCMStatus) {
  switch (status) {
    case "접수":     return "bg-gray-100 text-gray-600 border-gray-200";
    case "신용조회": return "bg-orange-50 text-orange-600 border-orange-200";
    case "승인":     return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "보완":     return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "거절":     return "bg-red-50 text-red-600 border-red-200";
    case "확정":     return "bg-emerald-100 text-emerald-800 border-emerald-300";
    default:         return "bg-gray-50 text-gray-500 border-gray-200";
  }
}

// ─── 서류 목록 ────────────────────────────────────────────
const DOC_FIELDS: { key: keyof HCMTask; label: string; dbCol: string }[] = [
  { key: "doc_id_card",           label: "신분증",               dbCol: "doc_id_card" },
  { key: "doc_employment",        label: "사업자등록증",            dbCol: "doc_employment" },
  { key: "doc_income",            label: "통장사본",              dbCol: "doc_income" },
  { key: "doc_estimate",          label: "견적서/계약서",         dbCol: "doc_estimate" },
  { key: "doc_excavator_license", label: "굴삭기조종면허증",      dbCol: "doc_excavator_license" },
  // doc_etc는 hcm_etc_docs 테이블로 분리됨
];

// ─── 스타일 상수 ──────────────────────────────────────────
const inputClass =
  "h-10 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm " +
  "text-[#0f172a] placeholder:text-gray-400 " +
  "focus:outline-none focus:border-orange-400 " +
  "disabled:opacity-50 disabled:bg-gray-50 transition-all";

const labelClass = "block text-xs font-medium text-gray-500 mb-1";

const btnPrimary =
  "inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-orange-500 " +
  "text-white font-semibold text-sm hover:bg-orange-600 transition-all disabled:opacity-50";

const btnSecondary =
  "inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-gray-200 " +
  "bg-white text-[#0f172a] font-semibold text-sm hover:border-gray-300 transition-all disabled:opacity-50";

const btnGhost =
  "inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-gray-200 " +
  "bg-white text-sm font-medium text-gray-600 hover:border-gray-300 transition-all disabled:opacity-50";

// ─── 메인 컴포넌트 ────────────────────────────────────────
export default function HyundaiCMPage() {
  const { user, logout, isAdmin, isSubAdmin, isHyundaiCM, isNhCapital, isNhCapitalStaff } = useAuth() as any;
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("id"); // 업무현황에서 딜 클릭 시 전달되는 id
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
  const isAdminLevel           = isAdmin || isSubAdmin;
  const canCreate              = isAdminLevel || isHyundaiCM || isNhCapital;
  const canEditExisting        = isAdminLevel || isNhCapital;
  const canChangeStatus        = isAdminLevel || isNhCapital || isNhCapitalStaff;
  const canUploadDoc           = isAdminLevel || isNhCapital;
  const canUploadVehicleRegDoc = isAdminLevel || isHyundaiCM || isNhCapital || isNhCapitalStaff;
  const canUploadTaxInvoice    = isHyundaiCM || isAdminLevel;  // 세금계산서 업로드: p2001103 + admin + ltongs7
  const canDelete              = isAdminLevel || isNhCapital;

  // ── 신규 접수 폼 ──
  const [customerType,          setCustomerType]          = useState<CustomerType>("개인");
  const [customerName,          setCustomerName]          = useState("");
  const [customerPhone,         setCustomerPhone]         = useState("");
  const [ceoName,                setCeoName]                = useState("");
  const [equipmentTon,          setEquipmentTon]          = useState("");
  const [purchaseAmount,        setPurchaseAmount]        = useState("");
  const [installmentPrincipal,  setInstallmentPrincipal]  = useState("");
  const [financeCompany,        setFinanceCompany]        = useState<string>("NH캐피탈");
  const [interestRate,          setInterestRate]          = useState("");
  const [incentive,             setIncentive]             = useState("");
  const [vatDeferred,           setVatDeferred]           = useState<"Y" | "N">("N");
  const [vatDeferredAmount,     setVatDeferredAmount]     = useState("");
  const [salesRep,              setSalesRep]              = useState("");
  const [specialNote,           setSpecialNote]           = useState("");

  // ── 데이터 ──
  const [rows,    setRows]    = useState<HCMTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  // ── UI ──
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchText,      setSearchText]      = useState("");
  const [statusFilter,    setStatusFilter]    = useState<HCMStatus | "all">("all");
  const [showClosed,      setShowClosed]      = useState(false);
  const [statsMonth,      setStatsMonth]      = useState<string>(() => {
    const n = new Date();
    return n.getFullYear().toString() + String(n.getMonth() + 1).padStart(2, "0");
  });

  // ── 수정 모달 ──
  const [editRow,                   setEditRow]                   = useState<HCMTask | null>(null);
  const [editSaving,                setEditSaving]                = useState(false);
  const [editCustomerType,          setEditCustomerType]          = useState<CustomerType>("개인");
  const [editCustomerName,          setEditCustomerName]          = useState("");
  const [editCustomerPhone,         setEditCustomerPhone]         = useState("");
  const [editCeoName,               setEditCeoName]                = useState("");
  const [editEquipmentTon,          setEditEquipmentTon]          = useState("");
  const [editPurchaseAmount,        setEditPurchaseAmount]        = useState("");
  const [editInstallmentPrincipal,  setEditInstallmentPrincipal]  = useState("");
  const [editFinanceCompany,        setEditFinanceCompany]        = useState<string>("NH캐피탈");
  const [editInterestRate,          setEditInterestRate]          = useState("");
  const [editIncentive,             setEditIncentive]             = useState("");
  const [editVatDeferred,           setEditVatDeferred]           = useState<"Y"|"N">("N");
  const [editVatDeferredAmount,     setEditVatDeferredAmount]     = useState("");
  const [editLoanPeriod,            setEditLoanPeriod]            = useState("");
  const [editSalesRep,              setEditSalesRep]              = useState("");
  const [editSpecialNote,           setEditSpecialNote]           = useState("");

  // ── 메모 ──
  const [memoDrafts,   setMemoDrafts]   = useState<Record<string, string>>({});
  const [memoSavingId, setMemoSavingId] = useState<string | number | null>(null);

  // ── 신용결과 추적 (승인/보완/거절 → 서류등록/확정으로 넘어가도 마지막 값 유지) ──
  const [creditResults, setCreditResults] = useState<Record<string, HCMStatus>>({});

  // ── 신용결과 상세 입력 모달 ──
  const [creditModal, setCreditModal]           = useState<{ row: HCMTask; next: HCMStatus } | null>(null);
  const [creditNiceScore,    setCreditNiceScore]    = useState("");
  const [creditRate,         setCreditRate]         = useState("");
  const [creditIncentive,    setCreditIncentive]    = useState("");
  const [creditLoanLimit,    setCreditLoanLimit]    = useState(""); // 대출한도 (승인 시)
  const [creditLoanPeriod,   setCreditLoanPeriod]   = useState(""); // 대출기간 (승인 시)
  const [creditGracePeriod,  setCreditGracePeriod]  = useState(""); // 거치기간 (승인 시)
  const [creditInstallmentPeriod, setCreditInstallmentPeriod] = useState(""); // 할부기간 (승인 시)
  const [creditVehicleAmount, setCreditVehicleAmount] = useState(""); // 차량가격 순수 차량
  const [creditAttachAmount,  setCreditAttachAmount]  = useState(""); // 어태치 가격
  const [creditVatAmount,    setCreditVatAmount]    = useState(""); // 부가세 후불금액 (승인 시)
  const [creditNote,         setCreditNote]         = useState(""); // 특이사항(승인)/보완사항(보완)/거절사유(거절)
  const [creditBizHistory,   setCreditBizHistory]   = useState<"1년이상" | "1년미만">("1년이상");
  const [creditSaving,       setCreditSaving]       = useState(false);

  // ── 업로드 ──
  const [uploadingDocKey,   setUploadingDocKey]   = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUploadInfo, setPendingUploadInfo] = useState<{
    rowId: string | number; docKey: string; dbCol: string; label: string;
  } | null>(null);

  // ── 삭제 ──
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [deleting,        setDeleting]        = useState(false);

  // ── 차량등록증 업로드 (확정 후, 72시간 자동삭제) ──
  const vehicleRegInputRef = useRef<HTMLInputElement | null>(null);
  const [vehicleRegUploading, setVehicleRegUploading] = useState<string | null>(null); // rowId
  const [vehicleRegFiles, setVehicleRegFiles] = useState<Record<string, { name: string; path: string; uploadedAt: string }[]>>({});

  // ── 기타서류 다중 업로드 ──
  const etcDocInputRef = useRef<HTMLInputElement | null>(null);
  const [etcDocUploading, setEtcDocUploading] = useState<string | null>(null); // rowId
  const [etcDocs, setEtcDocs] = useState<Record<string, { id: number; name: string; path: string; uploadedAt: string }[]>>({});
  const [etcDocNameModal, setEtcDocNameModal] = useState<{ rowId: string; file: File } | null>(null);
  const [etcDocNameInput, setEtcDocNameInput] = useState<string>("");

  // ── 세금계산서 업로드 (isHyundaiCM 전용, 72시간 자동삭제) ──
  const taxInvoiceInputRef       = useRef<HTMLInputElement | null>(null);
  const taxInvoiceAttachInputRef = useRef<HTMLInputElement | null>(null);
  const [taxInvoiceUploading, setTaxInvoiceUploading] = useState<string | null>(null);
  const [taxInvoiceFiles, setTaxInvoiceFiles] = useState<Record<string, { name: string; path: string; uploadedAt: string; invoiceType: string }[]>>({});

  // ── 인센티브 지급 완료 상태 (한 번 누르면 비활성화) ──
  const [incentivePaidIds, setIncentivePaidIds] = useState<Set<string>>(new Set());

  // ── 보류(재통화 예약) ──
  const KAKAO_RECIPIENTS = [
    { id: "tongs",    label: "이동수 (관리자)" },
    { id: "p2001103", label: "현대CM 담당자" },
    { id: "nhcap",    label: "NH캐피탈 담당자" },
  ] as const;
  type RecipientId = typeof KAKAO_RECIPIENTS[number]["id"];

  const [holdModal,        setHoldModal]        = useState<HCMTask | null>(null);
  const [approvalModal,    setApprovalModal]    = useState<HCMTask | null>(null); // 승인조건 확인 모달
  const [holdDate,         setHoldDate]         = useState("");        // YYYY-MM-DD
  const [holdTime,         setHoldTime]         = useState("10:00");   // HH:MM
  const [holdNote,         setHoldNote]         = useState("");
  const [holdRecipients,   setHoldRecipients]   = useState<RecipientId[]>([]);
  const [holdSaving,       setHoldSaving]       = useState(false);
  // rowId → 보류 정보 캐시
  const [holdMap, setHoldMap] = useState<Record<string, { scheduled_at: string; note: string | null; recipients: string[] }>>({});

  const openHoldModal = (row: HCMTask) => {
    setHoldModal(row);
    // 기본값: 내일 10:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const ymd = tomorrow.toISOString().slice(0, 10);
    setHoldDate(ymd);
    setHoldTime("10:00");
    setHoldNote("");
    setHoldRecipients([]);
  };

  const saveHold = async () => {
    if (!holdModal) return;
    if (holdRecipients.length === 0) { alert("알림 받을 담당자를 1명 이상 선택해주세요."); return; }
    if (!holdDate) { alert("날짜를 선택해주세요."); return; }

    setHoldSaving(true);
    try {
      const scheduledAt = new Date(`${holdDate}T${holdTime}:00+09:00`).toISOString();
      const payload = {
        record_id:    String(holdModal.id),
        scheduled_at: scheduledAt,
        note:         holdNote.trim() || null,
        recipients:   holdRecipients,
        is_sent:      false,
      };
      // upsert: 같은 record_id의 미발송 보류를 덮어씀
      const { error } = await supabase
        .from("hcm_holds")
        .upsert(payload, { onConflict: "record_id" });
      if (error) throw error;

      setHoldMap((prev) => ({
        ...prev,
        [String(holdModal.id)]: { scheduled_at: scheduledAt, note: holdNote.trim() || null, recipients: holdRecipients },
      }));

      // 카카오 알림 — 보류 등록 즉시: 전체 수신자에게 "보류 등록됨" 알림
      // (send-hyundaicm-kakao는 hold_registered 타입을 전체 RECIPIENTS로 발송)
      const row = holdModal;
      sendKakaoNotify({
        type:         "hold_registered",
        caseNo:       caseNoMap[String(row.id)] ?? String(row.id),
        customerName: row.customer_name,
        customerType: row.customer_type,
        equipmentTon: row.equipment_ton  ?? "",
        salesRep:     row.sales_rep      ?? "",
        scheduledAt,  // ISO 문자열 → Edge Function에서 KST 포맷팅
        holdNote:     holdNote.trim() || "",
        // 선택 수신자 이름 목록 (메시지 내 참고용)
        recipientNames: holdRecipients
          .map((id) => KAKAO_RECIPIENTS.find((r) => r.id === id)?.label ?? id)
          .join(", "),
      } as any);

      setHoldModal(null);
      alert(`보류 예약 완료 — ${holdDate} ${holdTime} 알림 발송 예정`);
    } catch (e: any) {
      alert(e?.message || "보류 저장 실패");
    } finally {
      setHoldSaving(false);
    }
  };

  // ── 원리금균등분납 상환스케줄 계산 ──
  // 거치기간(gracePeriod) 동안은 이자만 납부, 이후 잔여기간(installmentMonths)에 대해 원리금균등분납
  const calcAmortization = (principal: number, annualRate: number, months: number, startYM: string, gracePeriod: number = 0) => {
    const r = annualRate / 100 / 12;
    const grace = Math.max(0, Math.min(gracePeriod, months)); // 거치기간은 총 기간을 넘을 수 없음
    const installmentMonths = months - grace; // 원리금균등분납 적용 기간
    const payment = installmentMonths <= 0
      ? 0
      : r === 0
        ? principal / installmentMonths
        : (principal * r * Math.pow(1+r, installmentMonths)) / (Math.pow(1+r, installmentMonths) - 1);
    const rows: {no:number;date:string;payment:number;interest:number;principalPmt:number;balance:number}[] = [];
    let balance = principal;
    const [sy, sm] = startYM.split('-').map(Number);
    for (let i = 1; i <= months; i++) {
      const interest = balance * r;
      if (i <= grace) {
        // 거치기간: 이자만 납부, 원금 변동 없음
        const d = new Date(sy, sm - 1 + (i - 1), 1);
        const date = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.01`;
        rows.push({ no:i, date, payment:Math.round(interest), interest:Math.round(interest), principalPmt:0, balance:Math.round(balance) });
      } else {
        // 거치 종료 후: 원리금균등분납
        const principalPmt = payment - interest;
        balance = Math.max(0, balance - principalPmt);
        const d = new Date(sy, sm - 1 + (i - 1), 1);
        const date = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.01`;
        rows.push({ no:i, date, payment:Math.round(payment), interest:Math.round(interest), principalPmt:Math.round(principalPmt), balance:Math.round(balance) });
      }
    }
    return { payment: Math.round(payment), rows, gracePeriod: grace, installmentMonths };
  };

  // ── 상환스케줄 PDF 다운로드 ──
  const downloadSchedulePDF = (task: HCMTask, startYM: string, recipient: string) => {
    // 승인 후 확정된 대출한도(loan_limit)가 있으면 우선 사용, 없으면 접수 시 입력한 할부원금
    const principal = task.loan_limit ?? task.installment_principal ?? 0;
    const annualRate = task.interest_rate ?? 0;
    const months = task.loan_period ?? 0;
    if (!principal || !annualRate || !months) return;

    const gracePeriod = task.grace_period ?? 0;
    const installmentPeriod = task.installment_period ?? 0;
    const periodLabel = (gracePeriod > 0 && installmentPeriod > 0)
      ? `${months}개월 (거치 ${gracePeriod} + 할부 ${installmentPeriod})`
      : gracePeriod > 0
        ? `${months}개월 (거치 ${gracePeriod})`
        : `${months}개월`;

    const { payment, rows } = calcAmortization(principal, annualRate, months, startYM, gracePeriod);
    const fmt = (n:number) => n.toLocaleString('ko-KR');
    const displayName = task.company_name
      ? `${task.company_name}${task.customer_name !== task.company_name ? ` (${task.customer_name})` : ''}`
      : task.customer_name;

    const tableRows = rows.map(r => `
      <tr>
        <td>${r.no}</td>
        <td>${r.date}</td>
        <td>${fmt(r.payment)}</td>
        <td>${fmt(r.principalPmt)}</td>
        <td>${fmt(r.interest)}</td>
        <td>${fmt(r.balance)}</td>
      </tr>`).join('');

    const totalInterest = rows.reduce((s,r) => s + r.interest, 0);
    const totalPayment  = rows.reduce((s,r) => s + r.payment,  0);

    const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"/>
<title>상환스케줄 - ${displayName}</title>
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11px; color: #1e293b; }
  h1 { font-size: 18px; font-weight: 700; margin: 0 0 4px; color: #0a192f; }
  .subtitle { font-size: 12px; color: #64748b; margin-bottom: 20px; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; background: #f8fafc; border-radius: 8px; padding: 14px; }
  .meta-item label { font-size: 10px; color: #94a3b8; display: block; margin-bottom: 2px; }
  .meta-item span { font-weight: 600; color: #0a192f; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0a192f; color: #fff; padding: 7px 6px; text-align: center; font-size: 10px; }
  td { padding: 5px 6px; text-align: right; border-bottom: 1px solid #f1f5f9; font-size: 10.5px; }
  td:nth-child(1), td:nth-child(2) { text-align: center; }
  tr:nth-child(even) td { background: #f8fafc; }
  .tfoot td { background: #e2e8f0; font-weight: 700; color: #0a192f; border-top: 2px solid #94a3b8; }
  .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: center; }
  .recipient { margin-bottom: 12px; font-size: 13px; }
  .recipient strong { color: #0a192f; }
</style>
</head><body>
<h1>원리금균등분납 상환스케줄</h1>
<p class="subtitle">RNF Korea · 현대건설기계 할부금융</p>
${recipient ? `<p class="recipient">수신: <strong>${recipient}</strong> 귀중</p>` : ''}
<div class="meta">
  <div class="meta-item"><label>고객명</label><span>${displayName}</span></div>
  <div class="meta-item"><label>할부원금</label><span>${fmt(principal)}원</span></div>
  <div class="meta-item"><label>금리 (연)</label><span>${annualRate}%</span></div>
  <div class="meta-item"><label>대출기간</label><span>${periodLabel}</span></div>
  <div class="meta-item"><label>월 납입액</label><span>${fmt(payment)}원</span></div>
  <div class="meta-item"><label>금융사</label><span>${task.finance_company ?? '-'}</span></div>
</div>
<table>
  <thead><tr><th>회차</th><th>납입일</th><th>월납입액</th><th>원금</th><th>이자</th><th>잔액</th></tr></thead>
  <tbody>${tableRows}</tbody>
  <tfoot><tr class="tfoot">
    <td colspan="2">합계</td>
    <td>${fmt(totalPayment)}</td>
    <td>${fmt(principal)}</td>
    <td>${fmt(Math.round(totalInterest))}</td>
    <td>0</td>
  </tr></tfoot>
</table>
<p class="footer">※ 실제 납입액은 금융사 기준일·계산방식에 따라 일부 다를 수 있습니다.</p>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 500);
      });
    }
  };

  // ── 확정 카드 펼침/접힘 ──
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string | number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  };

  // ── 확정 승인내역 입력 모달 ──
  const [confirmModal, setConfirmModal]             = useState<HCMTask | null>(null);
  const [confirmLoanPrincipal, setConfirmLoanPrincipal] = useState("");
  const [confirmLoanPeriod,    setConfirmLoanPeriod]    = useState("");
  const [confirmInterestRate,  setConfirmInterestRate]  = useState("");
  const [confirmIncentive,     setConfirmIncentive]     = useState("");
  const [confirmVatAmount,     setConfirmVatAmount]     = useState("");

  // ── 상환스케줄 PDF 모달 ──
  const [scheduleModal, setScheduleModal] = useState<HCMTask | null>(null);
  const [scheduleRecipient, setScheduleRecipient] = useState("");
  const [scheduleStartDate, setScheduleStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth()+1); d.setDate(1);
    return d.toISOString().slice(0,7);
  });
  // 상환표 임의 수정값 (비교설명용)
  const [schedOvPrincipal,    setSchedOvPrincipal]    = useState<string>("");
  const [schedOvRate,         setSchedOvRate]         = useState<string>("");
  const [schedOvMonths,       setSchedOvMonths]       = useState<string>("");
  const [schedOvGrace,        setSchedOvGrace]        = useState<string>("");
  // 상환표 발송 (SMS/MMS)
  const [scheduleSendTarget,  setScheduleSendTarget]  = useState("");
  const [scheduleSending,     setScheduleSending]     = useState(false);
  const scheduleTableRef = useRef<HTMLDivElement>(null);
  const [confirmSaving,        setConfirmSaving]        = useState(false);

  // ─── 카카오 알림 ─────────────────────────────────────────
  const EDGE_FN_URL = "https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/send-hyundaicm-kakao";

  const sendKakaoNotify = async (
    payload: Record<string, unknown>
  ): Promise<void> => {
    try {
      await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn("[kakao notify] 전송 실패:", e);
    }
  };

  // ─── 구글 캘린더 자동 동기화 (신규 접수 시) ─────────────────
  const syncHcmToGcal = async (task: {
    id: number | string;
    customer_name: string;
    company_name: string | null;
    equipment_ton: string | null;
    finance_company: string | null;
    sales_rep: string;
  }) => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const title = `${task.company_name ?? task.customer_name} (${task.equipment_ton ?? "현대CM"}) 접수`;
      const description = [
        task.equipment_ton ? `장비: ${task.equipment_ton}` : null,
        task.finance_company ? `금융사: ${task.finance_company}` : null,
        task.sales_rep ? `영업: ${task.sales_rep}` : null,
      ].filter(Boolean).join("\n");
      const todayIso = new Date().toISOString().slice(0, 10);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({
            action: "create_task",
            user_id: user.id,
            event: {
              title,
              description,
              schedule_date: todayIso,
              source_table: "hyundaicm_tasks",
              source_id: task.id,
            },
          }),
        }
      );
      const d = await res.json();
      if (d?.task?.id) {
        await supabase.from("hyundaicm_tasks").update({ gcal_task_id: d.task.id }).eq("id", task.id);
      }
    } catch (e) {
      console.warn("[hcm gcal task sync] 전송 실패:", e);
    }
  };

  // 확정/거절 등 종결 처리 시 구글 할일도 완료 처리 (목록에서 사라짐)
  const completeHcmGcalTask = async (taskId: number | string) => {
    if (!user) return;
    try {
      const { data: row } = await supabase.from("hyundaicm_tasks").select("gcal_task_id").eq("id", taskId).maybeSingle();
      if (!row?.gcal_task_id) return;
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ action: "complete_task", user_id: user.id, event_id: row.gcal_task_id }),
        }
      );
    } catch (e) {
      console.warn("[hcm gcal task complete] 전송 실패:", e);
    }
  };

  // ─── 차량등록증 업로드 목록 조회 ────────────────────────────
  const fetchVehicleRegFiles = async (rowIds: (string | number)[]) => {
    if (rowIds.length === 0) return;
    const { data } = await supabase
      .from("vehicle_reg_doc_uploads")
      .select("id, record_id, file_name, storage_path, uploaded_at, expires_at")
      .in("record_id", rowIds.map(String))
      .order("uploaded_at", { ascending: false });
    if (!data) return;
    const map: Record<string, { name: string; path: string; uploadedAt: string }[]> = {};
    data.forEach((d: any) => {
      const key = String(d.record_id);
      if (!map[key]) map[key] = [];
      map[key].push({ name: d.file_name, path: d.storage_path, uploadedAt: d.uploaded_at });
    });
    setVehicleRegFiles(map);
  };

  // ─── 기타서류 다중 업로드 ────────────────────────────────────
  const fetchEtcDocs = async (rowIds: (string | number)[]) => {
    if (rowIds.length === 0) return;
    const { data } = await supabase
      .from("hcm_etc_docs")
      .select("id, task_id, file_name, storage_path, uploaded_at")
      .in("task_id", rowIds.map(Number))
      .order("uploaded_at", { ascending: true });
    if (!data) return;
    const map: Record<string, { id: number; name: string; path: string; uploadedAt: string }[]> = {};
    data.forEach((d: any) => {
      const key = String(d.task_id);
      if (!map[key]) map[key] = [];
      map[key].push({ id: d.id, name: d.file_name, path: d.storage_path, uploadedAt: d.uploaded_at });
    });
    setEtcDocs((prev) => ({ ...prev, ...map }));
  };

  const uploadEtcDoc = async (rowId: string | number, file: File, docLabel: string) => {
    if (!canUploadDoc) { alert("서류 업로드 권한이 없습니다."); return; }
    setEtcDocUploading(String(rowId));
    try {
      const ext      = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const safeName = `${Date.now()}.${ext}`;
      const path     = `hyundaicm/${String(rowId)}/etc/${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("hcm_docs")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const displayName = docLabel.trim() || file.name;
      const { error: dbErr } = await supabase
        .from("hcm_etc_docs")
        .insert({ task_id: Number(rowId), storage_path: path, file_name: displayName, file_size: file.size });
      if (dbErr) throw dbErr;
      await fetchEtcDocs([rowId]);
    } catch (e: any) { alert(`기타서류 업로드 실패: ${e?.message}`); }
    finally {
      setEtcDocUploading(null);
      if (etcDocInputRef.current) etcDocInputRef.current.value = "";
    }
  };

  const deleteEtcDoc = async (docId: number, storagePath: string, rowId: string | number) => {
    if (!canUploadDoc) return;
    if (!confirm("기타서류를 삭제하시겠습니까?")) return;
    try {
      await supabase.storage.from("hcm_docs").remove([storagePath]);
      await supabase.from("hcm_etc_docs").delete().eq("id", docId);
      setEtcDocs((prev) => ({
        ...prev,
        [String(rowId)]: (prev[String(rowId)] ?? []).filter((d) => d.id !== docId),
      }));
    } catch (e: any) { alert(`삭제 실패: ${e?.message}`); }
  };

  // ─── 차량등록증 업로드 실행 ──────────────────────────────────
  const uploadVehicleRegDoc = async (rowId: string | number, file: File) => {
    setVehicleRegUploading(String(rowId));
    try {
      // 한글/특수문자 제거 → 안전한 파일명 생성
      const ext      = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const safeName = `${Date.now()}.${ext}`;
      const path     = `${rowId}/${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("vehicle-reg-docs")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("vehicle_reg_doc_uploads")
        .insert({
          record_id:    String(rowId),
          uploaded_by:  user?.id,
          storage_path: path,
          file_name:    file.name,   // 원본 파일명은 DB에 보관
          file_size:    file.size,
        });
      if (dbErr) throw dbErr;

      await fetchVehicleRegFiles([rowId]);

      // 카카오 알림
      const row = rows.find((r) => String(r.id) === String(rowId));
      if (row) {
        sendKakaoNotify({
          type:           "vehicle_reg_upload",
          caseNo:         caseNoMap[String(rowId)] ?? String(rowId),
          customerName:   row.customer_name,
          customerType:   row.customer_type,
          equipmentTon:   row.equipment_ton,
          financeCompany: row.finance_company,
          salesRep:       row.sales_rep,
        });
      }
    } catch (e: any) {
      alert("업로드 실패: " + (e?.message || e));
    } finally {
      setVehicleRegUploading(null);
    }
  };

  // ─── 차량등록증 다운로드 ─────────────────────────────────────
  const downloadVehicleRegDoc = async (path: string, name: string) => {
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const { data, error } = await supabase.storage.from("vehicle-reg-docs").createSignedUrl(path, 60);
        if (error || !data?.signedUrl) throw error ?? new Error("URL 생성 실패");
        window.open(data.signedUrl, "_blank");
      } else {
        const { data, error } = await supabase.storage.from("vehicle-reg-docs").download(path);
        if (error || !data) { alert("다운로드 실패: " + error?.message); return; }
        const url = URL.createObjectURL(data);
        const a   = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }
    } catch (e: any) { alert(`다운로드 실패: ${e?.message}`); }
  };

  // ─── 세금계산서 목록 조회 ────────────────────────────────────
  const fetchTaxInvoiceFiles = async (rowIds: (string | number)[]) => {
    if (rowIds.length === 0) return;
    const { data } = await supabase
      .from("tax_invoice_uploads")
      .select("id, record_id, file_name, storage_path, uploaded_at, invoice_type")
      .in("record_id", rowIds.map(String))
      .order("uploaded_at", { ascending: false });
    if (!data) return;
    const map: Record<string, { name: string; path: string; uploadedAt: string; invoiceType: string }[]> = {};
    data.forEach((d: any) => {
      const key = String(d.record_id);
      if (!map[key]) map[key] = [];
      map[key].push({ name: d.file_name, path: d.storage_path, uploadedAt: d.uploaded_at, invoiceType: d.invoice_type ?? "vehicle" });
    });
    setTaxInvoiceFiles(map);
  };

  // ─── 세금계산서 업로드 ───────────────────────────────────────
  const uploadTaxInvoice = async (rowId: string | number, file: File, invoiceType: string = "vehicle") => {
    setTaxInvoiceUploading(`${rowId}-${invoiceType}`);
    try {
      const ext      = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const safeName = `${Date.now()}.${ext}`;
      const path     = `${rowId}/${invoiceType}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("tax-invoices")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("tax_invoice_uploads")
        .insert({
          record_id:    String(rowId),
          uploaded_by:  user?.id,
          storage_path: path,
          file_name:    file.name,
          file_size:    file.size,
          invoice_type: invoiceType,
        });
      if (dbErr) throw dbErr;

      await fetchTaxInvoiceFiles([rowId]);

      // 카카오 알림
      const row = rows.find((r) => String(r.id) === String(rowId));
      if (row) {
        sendKakaoNotify({
          type:           "tax_invoice_upload",
          caseNo:         caseNoMap[String(rowId)] ?? String(rowId),
          customerName:   row.customer_name,
          customerType:   row.customer_type,
          equipmentTon:   row.equipment_ton,
          financeCompany: row.finance_company,
          salesRep:       row.sales_rep,
        });
      }
    } catch (e: any) {
      alert("업로드 실패: " + (e?.message || e));
    } finally {
      setTaxInvoiceUploading(null);
    }
  };
  const downloadTaxInvoice = async (path: string, name: string) => {
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const { data, error } = await supabase.storage.from("tax-invoices").createSignedUrl(path, 60);
        if (error || !data?.signedUrl) throw error ?? new Error("URL 생성 실패");
        window.open(data.signedUrl, "_blank");
      } else {
        const { data, error } = await supabase.storage.from("tax-invoices").download(path);
        if (error || !data) { alert("다운로드 실패: " + error?.message); return; }
        const url = URL.createObjectURL(data);
        const a   = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }
    } catch (e: any) { alert(`다운로드 실패: ${e?.message}`); }
  };

  // ─── FETCH ──────────────────────────────────────────────
  const fetchRows = async () => {
    setLoading(true); setErr("");
    try {
      const cutoffISO = new Date(
        Date.now() - HIDE_CLOSED_AFTER_DAYS_FOR_NON_ADMIN * 24 * 60 * 60 * 1000
      ).toISOString();

      let q = supabase.from("hyundaicm_tasks").select("*");
      if (!isAdmin) {
        q = q.or(`status.neq.확정,created_at.gte.${cutoffISO}`);
      } else if (!showClosed) {
        q = q.or(`status.neq.확정,created_at.gte.${cutoffISO}`);
      }

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;

      const fetchedRows = (data ?? []) as HCMTask[];
      // NH캐피탈 직원(조회 전용)은 할부금융사가 NH캐피탈인 건만 조회 가능
      const nextRows = isNhCapitalStaff
        ? fetchedRows.filter((r) => r.finance_company === "NH캐피탈")
        : fetchedRows;
      setRows(nextRows);
      const drafts: Record<string, string> = {};
      const credits: Record<string, HCMStatus> = {};
      nextRows.forEach((r) => {
        drafts[String(r.id)] = r.special_note ?? "";
        if (["승인","보완","거절"].includes(r.status)) {
          credits[String(r.id)] = r.status as HCMStatus;
        }
      });
      setMemoDrafts(drafts);
      setCreditResults((prev) => ({ ...prev, ...credits }));

      // 확정 건의 차량등록증 파일 목록 조회
      const confirmedIds = nextRows.filter((r) => r.status === "확정").map((r) => r.id);
      if (confirmedIds.length > 0) fetchVehicleRegFiles(confirmedIds);

      // 세금계산서 파일 목록 조회 (전체)
      fetchTaxInvoiceFiles(nextRows.map((r) => r.id));

      // 기타서류 목록 조회 (전체)
      fetchEtcDocs(nextRows.map((r) => r.id));

      // 보류(재통화 예약) 목록 조회 — 미발송 건만
      {
        const ids = nextRows.map((r) => String(r.id));
        if (ids.length > 0) {
          const { data: holds } = await supabase
            .from("hcm_holds")
            .select("record_id, scheduled_at, note, recipients")
            .in("record_id", ids)
            .eq("is_sent", false);
          if (holds) {
            const hm: Record<string, { scheduled_at: string; note: string | null; recipients: string[] }> = {};
            (holds as any[]).forEach((h) => { hm[String(h.record_id)] = { scheduled_at: h.scheduled_at, note: h.note, recipients: h.recipients ?? [] }; });
            setHoldMap(hm);
          }
        }
      }
    } catch (e: any) {
      setErr(e?.message || "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, [showClosed, isAdmin, isHyundaiCM, isNhCapitalStaff]); // eslint-disable-line


  // ─── 모바일 파일 선택 후 세션 자동 복구 ─────────────────────
  // 모바일에서 파일 picker 사용 시 앱이 백그라운드 전환 후 복귀하면서 세션이 끊기는 현상 방지
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // 세션이 없으면 로컬스토리지에서 복구 시도
          await supabase.auth.refreshSession();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ─── 필터 ────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    // 업무현황에서 특정 딜을 클릭해서 온 경우 → 해당 건만 표시
    if (focusId) {
      return rows.filter((r) => String(r.id) === String(focusId));
    }
    let result = [...rows];
    const q = searchText.trim().toLowerCase();
    if (q) {
      const qd = onlyDigits(q);
      result = result.filter((r) =>
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        (r.company_name ?? "").toLowerCase().includes(q) ||
        (r.equipment_ton ?? "").toLowerCase().includes(q) ||
        (r.finance_company ?? "").toLowerCase().includes(q) ||
        (r.sales_rep ?? "").toLowerCase().includes(q) ||
        (r.special_note ?? "").toLowerCase().includes(q) ||
        String(r.id).includes(q) ||
        (qd ? onlyDigits(r.customer_phone ?? "").includes(qd) : false)
      );
    }
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    return result;
  }, [rows, searchText, statusFilter, focusId]);

  const summaryCounts = useMemo(() =>
    STATUS_ORDER.reduce((acc, s) => {
      acc[s] = rows.filter((r) => r.status === s).length;
      return acc;
    }, {} as Record<HCMStatus, number>)
  , [rows]);

  // ─── 당월 실적 ───────────────────────────────────────────
  const availableStatsMonths = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0"));
    rows.forEach((r) => {
      const d = new Date(r.created_at ?? 0);
      if (!r.created_at || isNaN(d.getTime())) return;
      set.add(d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, "0"));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const monthlyStats = useMemo(() => {
    const ym = statsMonth;
    const thisMonth = rows.filter((r) => {
      const d = new Date(r.created_at ?? 0);
      return d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, "0") === ym;
    });
    const confirmed = thisMonth.filter((r) => r.status === "확정");
    const totalAmount = confirmed.reduce((sum, r) => sum + (r.loan_limit ?? r.installment_principal ?? 0), 0);
    return { total: thisMonth.length, confirmed: confirmed.length, amount: totalAmount };
  }, [rows, statsMonth]);

  // 월내 순번 맵: 같은 연월의 건들을 created_at 오름차순으로 정렬해 순번 부여
  const caseNoMap = useMemo(() => {
    const map: Record<string, string> = {};
    const sorted = [...rows].sort((a, b) =>
      new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
    const monthCount: Record<string, number> = {};
    sorted.forEach((r) => {
      const d = new Date(r.created_at ?? 0);
      const ym = d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, "0");
      monthCount[ym] = (monthCount[ym] ?? 0) + 1;
      map[String(r.id)] = `${ym}-${String(monthCount[ym]).padStart(3, "0")}`;
    });
    return map;
  }, [rows]);

  // ─── 신규 접수 ───────────────────────────────────────────
  const onReset = () => {
    setCustomerType("개인"); setCustomerName(""); setCustomerPhone("");
    setCeoName(""); setEquipmentTon(""); setPurchaseAmount("");
    setInstallmentPrincipal(""); setFinanceCompany("NH캐피탈");
    setInterestRate(""); setIncentive("");
    setVatDeferred("N"); setVatDeferredAmount("");
    setSalesRep(""); setSpecialNote("");
  };

  const onAdd = async () => {
    if (!canCreate) { alert("신규 입력 권한이 없습니다."); return; }
    if (!customerName.trim()) { alert("고객명을 입력해주세요."); return; }
    if (!customerPhone.trim()) { alert("고객 전화번호를 입력해주세요."); return; }
    
    if (!salesRep.trim())      { alert("영업사원을 입력해주세요."); return; }

    setSaving(true); setErr("");
    try {
      const payload = {
        customer_type:           customerType,
        customer_name:           customerName.trim(),
        customer_phone:          onlyDigits(customerPhone) || null,
        company_name:            customerType === "법인" ? customerName.trim() : null,
        ceo_name:                customerType === "법인" ? (ceoName.trim() || null) : null,
        equipment_ton:           equipmentTon.trim() || null,
        purchase_amount:         purchaseAmount.trim() ? parseInt(onlyDigits(purchaseAmount), 10) || null : null,
        installment_principal:   installmentPrincipal.trim() ? parseInt(onlyDigits(installmentPrincipal), 10) || null : null,
        finance_company:         financeCompany || null,
        interest_rate:           interestRate.trim() ? parseFloat(interestRate) || null : null,
        incentive:               incentive.trim() ? parseFloat(incentive) || null : null,
        vat_deferred:            vatDeferred === "Y",
        vat_deferred_amount:     vatDeferred === "Y" && vatDeferredAmount.trim() ? parseInt(onlyDigits(vatDeferredAmount), 10) || null : null,
        loan_period:             null,
        sales_rep:               salesRep.trim(),
        special_note:            specialNote.trim() || null,
        status:                  "접수" as HCMStatus,
        phone_scrubbed_at:       null,
        doc_id_card: null, doc_employment: null, doc_income: null,
        doc_estimate: null, doc_excavator_license: null, doc_etc: null,
        closed_at: null,
      };
      const { data: inserted, error } = await supabase
        .from("hyundaicm_tasks")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // 월내 순번 계산 (새 건 포함 후 fetchRows 전이므로 임시 계산)
      const now = new Date();
      const ym = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0");
      const monthRows = rows.filter((r) => {
        const d = new Date(r.created_at ?? 0);
        return d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, "0") === ym;
      });
      const newCaseNo = `${ym}-${String(monthRows.length + 1).padStart(3, "0")}`;

      // 카카오 알림 (비동기, 실패해도 업무 영향 없음)
      sendKakaoNotify({
        type:                 "new",
        caseNo:               newCaseNo,
        customerName:         payload.customer_name,
        customerType:         payload.customer_type,
        equipmentTon:         payload.equipment_ton,
        financeCompany:       payload.finance_company,
        salesRep:             payload.sales_rep,
        installmentPrincipal: payload.installment_principal,
      });

      // 구글 캘린더 자동 동기화 (접수일 = 일정)
      if (inserted) {
        void syncHcmToGcal({
          id: inserted.id,
          customer_name: payload.customer_name,
          company_name: payload.company_name,
          equipment_ton: payload.equipment_ton,
          finance_company: payload.finance_company,
          sales_rep: payload.sales_rep,
        });

        // 접수 시 할일 + 일정 자동 등록 (단 1회)
        const todayStr = new Date().toISOString().slice(0, 10);
        const regTitle = `${payload.customer_name} (현대CM - 접수)`;
        const regDesc  = [
          `케이스: ${newCaseNo}`,
          payload.equipment_ton   ? `장비: ${payload.equipment_ton}`    : null,
          payload.finance_company ? `금융사: ${payload.finance_company}` : null,
          payload.sales_rep       ? `영업: ${payload.sales_rep}`         : null,
        ].filter(Boolean).join(" / ");
        await Promise.all([
          supabase.from("secretary_todos").insert({
            title: regTitle, description: regDesc,
            priority: "normal", category: "finance",
            due_date: todayStr, is_done: false,
          }),
          supabase.from("secretary_schedules").insert({
            title: regTitle, description: regDesc,
            schedule_date: todayStr, category: "followup",
            related_type: "finance", progress_stage: "접수",
            work_type: "finance_hcm",
          }),
        ]);
      }

      onReset(); setShowCreatePanel(false); await fetchRows();
    } catch (e: any) {
      setErr(e?.message || "등록 실패");
      alert(e?.message || "등록 실패");
    } finally { setSaving(false); }
  };

  // ─── 상태 변경 ───────────────────────────────────────────
  const changeStatus = async (row: HCMTask, next: HCMStatus) => {
    if (!canChangeStatus) { alert("상태 변경 권한이 없습니다."); return; }
    if (row.status === next) return;

    // 단계 순서 제어
    if (!canGoToStatus(row.status, next, isAdminLevel)) {
      const nextIdx    = getStatusIndex(next);
      const currentIdx = getStatusIndex(row.status);
      if (nextIdx < currentIdx) {
        alert("이전 단계로 되돌리는 권한이 없습니다.");
      } else {
        alert("단계를 건너뛸 수 없습니다. 순서대로 진행해 주세요.");
      }
      return;
    }

    // 확정 버튼 클릭 시 → 최종확정 팝업 (승인 시 입력한 값 pre-fill)
    if (next === "확정") {
      setConfirmLoanPrincipal(
        row.loan_limit != null
          ? Number(row.loan_limit).toLocaleString("ko-KR")
          : row.installment_principal != null
            ? Number(row.installment_principal).toLocaleString("ko-KR")
            : ""
      );
      setConfirmLoanPeriod(row.loan_period != null ? String(row.loan_period) : "");
      setConfirmInterestRate(row.interest_rate != null ? String(row.interest_rate) : "");
      setConfirmIncentive(row.incentive != null ? String(row.incentive) : "");
      setConfirmVatAmount(row.vat_deferred_amount != null ? Number(row.vat_deferred_amount).toLocaleString("ko-KR") : "");
      setConfirmModal(row);
      return;
    }

    const patch: Partial<HCMTask> = { status: next };
    // 신용결과(승인/보완/거절) 변경 시 추적
    if (["승인","보완","거절"].includes(next)) {
      setCreditResults((prev) => ({ ...prev, [String(row.id)]: next }));
    }
    setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, ...patch } : r));
    const { error } = await supabase.from("hyundaicm_tasks").update(patch).eq("id", row.id as any);
    if (error) {
      setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, status: row.status } : r));
      alert(error.message);
    } else {
      // 거절 시 구글 할일도 완료 처리 (목록에서 사라짐)
      if (next === "거절") {
        void completeHcmGcalTask(row.id);
      }
      // 카카오 알림 (비동기, 실패해도 업무 영향 없음)
      const kakaoPayload: Record<string, unknown> = {
        type:                 "status_change",
        caseNo:               caseNoMap[String(row.id)] ?? String(row.id),
        customerName:         row.customer_name,
        customerType:         row.customer_type,
        equipmentTon:         row.equipment_ton,
        financeCompany:       row.finance_company,       // 금융사 (신용조회 단계에서 표시)
        installmentPrincipal: row.installment_principal ? String(row.installment_principal) : undefined,
        salesRep:             row.sales_rep,
        prevStatus:           row.status,
        nextStatus:           next,
      };
      sendKakaoNotify(kakaoPayload);
    }
  };

  // ─── 확정 승인내역 저장 ──────────────────────────────────
  const saveConfirmModal = async () => {
    if (!confirmModal) return;
    setConfirmSaving(true);
    try {
      const patch: Partial<HCMTask> & Record<string, any> = {
        status:               "확정" as HCMStatus,
        closed_at:            new Date().toISOString(),
        installment_principal: confirmLoanPrincipal.trim() ? parseInt(onlyDigits(confirmLoanPrincipal), 10) || null : null,
        loan_period:          confirmLoanPeriod.trim() ? parseInt(confirmLoanPeriod, 10) || null : null,
        interest_rate:        confirmInterestRate.trim() ? parseFloat(confirmInterestRate) || null : null,
        incentive:            confirmIncentive.trim() ? parseFloat(confirmIncentive) || null : null,
        vat_deferred_amount:  confirmVatAmount.trim() ? parseInt(onlyDigits(confirmVatAmount), 10) || null : null,
      };
      const { error } = await supabase.from("hyundaicm_tasks").update(patch).eq("id", confirmModal.id as any);
      if (error) throw error;
      setRows((prev) => prev.map((r) => String(r.id) === String(confirmModal.id) ? { ...r, ...patch } : r));

      // 확정 시 구글 할일도 완료 처리 (목록에서 사라짐)
      void completeHcmGcalTask(confirmModal.id);

      // 카카오 알림
      sendKakaoNotify({
        type:                 "status_change",
        caseNo:               caseNoMap[String(confirmModal.id)] ?? String(confirmModal.id),
        customerName:         confirmModal.customer_name,
        customerType:         confirmModal.customer_type,
        equipmentTon:         confirmModal.equipment_ton,
        salesRep:             confirmModal.sales_rep,
        prevStatus:           confirmModal.status,
        nextStatus:           "확정",
        financeCompany:       confirmModal.finance_company,
        purchaseAmount:       confirmModal.purchase_amount,
        installmentPrincipal: patch.installment_principal,
        interestRate:         patch.interest_rate,
        incentive:            patch.incentive,
        vatDeferredAmount:    patch.vat_deferred_amount,
        loanPeriod:           patch.loan_period,
      });

      setConfirmModal(null);

      // ── 확정 전환 시: 익일 사후 미결 할 일 자동 등록 (설정 / 원본서류 징구) ──
      try {
        const tomorrowDate = (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          return d.toISOString().slice(0, 10);
        })();
        const custName = confirmModal.customer_name || "고객";
        await Promise.all([
          supabase.from("secretary_todos").insert({
            title:       `${custName} 설정`,
            description: `[현대CM] ${custName} 확정 건 - 설정(담보) 등록 확인`,
            priority:    "urgent",
            category:    "finance",
            due_date:    tomorrowDate,
            is_done:     false,
          }),
          supabase.from("secretary_todos").insert({
            title:       `${custName} 원본`,
            description: `[현대CM] ${custName} 확정 건 - 원본서류 징구 확인`,
            priority:    "urgent",
            category:    "finance",
            due_date:    tomorrowDate,
            is_done:     false,
          }),
        ]);
      } catch (todoErr) {
        console.error("[현대CM 확정 사후 할 일 등록 오류]:", todoErr);
      }
    } catch (e: any) { alert(e?.message || "저장 실패"); }
    finally { setConfirmSaving(false); }
  };

  // ─── 메모 저장 ───────────────────────────────────────────
  const saveMemo = async (rowId: string | number) => {
    setMemoSavingId(rowId);
    try {
      const note = memoDrafts[String(rowId)] ?? "";
      const { error } = await supabase.from("hyundaicm_tasks").update({ special_note: note || null }).eq("id", rowId as any);
      if (error) throw error;
      setRows((prev) => prev.map((r) => String(r.id) === String(rowId) ? { ...r, special_note: note || null } : r));
    } catch (e: any) { alert(e?.message || "메모 저장 실패"); }
    finally { setMemoSavingId(null); }
  };

  // ─── 신용결과 모달 저장 ──────────────────────────────────
  const saveCreditModal = async () => {
    if (!creditModal) return;
    const { row, next } = creditModal;
    setCreditSaving(true);
    try {
      const patch: Partial<HCMTask> = {
        status:              next,
        nice_score:          next !== "거절" && creditNiceScore.trim() ? parseInt(creditNiceScore, 10) || null : null,
        credit_rate:         next !== "거절" && creditRate.trim() ? parseFloat(creditRate) || null : null,
        credit_incentive:    next !== "거절" && creditIncentive.trim() ? parseFloat(creditIncentive) || null : null,
        interest_rate:       next !== "거절" && creditRate.trim() ? parseFloat(creditRate) || null : null,
        incentive:           next !== "거절" && creditIncentive.trim() ? parseFloat(creditIncentive) || null : null,
        biz_history:         next !== "거절" ? creditBizHistory : null,
        loan_limit:          next === "승인" && creditLoanLimit.trim()
                               ? parseInt(creditLoanLimit.replace(/,/g, ""), 10) || null : null,
        loan_period:         next === "승인" && creditLoanPeriod.trim() ? parseInt(creditLoanPeriod, 10) || null : null,
        grace_period:        next === "승인" && creditGracePeriod.trim() ? parseInt(creditGracePeriod, 10) || null : null,
        installment_period:  next === "승인" && creditInstallmentPeriod.trim() ? parseInt(creditInstallmentPeriod, 10) || null : null,
        vehicle_amount:      next === "승인" && creditVehicleAmount.trim() ? parseInt(creditVehicleAmount.replace(/,/g, ""), 10) || null : null,
        attach_amount:       next === "승인" && creditAttachAmount.trim() ? parseInt(creditAttachAmount.replace(/,/g, ""), 10) || null : null,
        purchase_amount:     next === "승인" && (creditVehicleAmount.trim() || creditAttachAmount.trim())
                               ? ((parseInt(creditVehicleAmount.replace(/,/g, ""), 10) || 0) + (parseInt(creditAttachAmount.replace(/,/g, ""), 10) || 0)) || null
                               : undefined as any,
        vat_deferred_amount: next === "승인" && creditModal.row.vat_deferred && creditVatAmount.trim()
                               ? parseInt(creditVatAmount.replace(/,/g, ""), 10) || null : null,
        credit_note:         creditNote.trim() || null,
        // 신용결과 처리 시 입력한 메모를 본문 특이사항에도 반영(대체)
        special_note:        creditNote.trim() || null,
      };
      const { error } = await supabase.from("hyundaicm_tasks").update(patch).eq("id", row.id as any);
      if (error) throw error;
      setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, ...patch } : r));
      setCreditResults((prev) => ({ ...prev, [String(row.id)]: next }));
      setMemoDrafts((prev) => ({ ...prev, [String(row.id)]: patch.special_note ?? "" }));

      // 카카오 알림 — 동일 상태 재저장(조건 수정)인 경우 "수정 알림", 신규 상태 변경인 경우 기존 알림
      const isConditionUpdate = row.status === next; // 이미 같은 상태(예: 승인)에서 재저장 = 조건 수정
      sendKakaoNotify({
        type:             isConditionUpdate ? "credit_condition_updated" : "status_change",
        caseNo:           caseNoMap[String(row.id)] ?? String(row.id),
        customerName:     row.customer_name,
        customerType:     row.customer_type,
        equipmentTon:     row.equipment_ton,
        salesRep:         row.sales_rep,
        prevStatus:       row.status,
        nextStatus:       next,
        niceScore:        patch.nice_score,
        creditRate:       patch.credit_rate,
        creditIncentive:  patch.credit_incentive,
        bizHistory:       next !== "거절" ? creditBizHistory : undefined,
        loanLimit:        patch.loan_limit ? String(patch.loan_limit) : "-",
        loanPeriod:       patch.loan_period ? String(patch.loan_period) : undefined,
        gracePeriod:      patch.grace_period ? String(patch.grace_period) : undefined,
        installmentPeriod: patch.installment_period ? String(patch.installment_period) : undefined,
        vehicleAmount:    patch.vehicle_amount ? String(patch.vehicle_amount) : undefined,
        attachAmount:     patch.attach_amount ? String(patch.attach_amount) : undefined,
        creditNote:       patch.credit_note ?? undefined,
      });

      setCreditModal(null);
    } catch (e: any) { alert(e?.message || "저장 실패"); }
    finally { setCreditSaving(false); }
  };

  // ─── 수정 모달 ───────────────────────────────────────────
  const openEditModal = (row: HCMTask) => {
    if (!canEditExisting) { alert("수정 권한이 없습니다."); return; }
    setEditRow(row);
    setEditCustomerType(row.customer_type ?? "개인");
    setEditCustomerName(row.customer_name ?? "");
    setEditCustomerPhone(formatPhoneKR(row.customer_phone ?? ""));
    setEditCeoName(row.ceo_name ?? "");
    setEditEquipmentTon(row.equipment_ton ?? "");
    setEditPurchaseAmount(row.purchase_amount != null ? String(row.purchase_amount) : "");
    setEditInstallmentPrincipal(row.installment_principal != null ? String(row.installment_principal) : "");
    setEditFinanceCompany(row.finance_company ?? "NH캐피탈");
    setEditInterestRate(row.interest_rate != null ? String(row.interest_rate) : "");
    setEditIncentive(row.incentive != null ? String(row.incentive) : "");
    setEditVatDeferred(row.vat_deferred ? "Y" : "N");
    setEditVatDeferredAmount(row.vat_deferred_amount != null ? Number(row.vat_deferred_amount).toLocaleString("ko-KR") : "");
    setEditLoanPeriod(row.loan_period != null ? String(row.loan_period) : "");
    setEditSalesRep(row.sales_rep ?? "");
    setEditSpecialNote(row.special_note ?? "");
  };

  const closeEditModal = () => { if (editSaving) return; setEditRow(null); };

  const saveEditRow = async () => {
    if (!editRow) return;
    if (!editCustomerName.trim()) { alert("고객명을 입력해주세요."); return; }
    setEditSaving(true);
    try {
      const patch = {
        customer_type:          editCustomerType,
        customer_name:          editCustomerName.trim(),
        customer_phone:         onlyDigits(editCustomerPhone) || null,
        company_name:           editCustomerType === "법인" ? editCustomerName.trim() : null,
        ceo_name:               editCustomerType === "법인" ? (editCeoName.trim() || null) : null,
        equipment_ton:          editEquipmentTon.trim() || null,
        purchase_amount:        editPurchaseAmount.trim() ? parseInt(onlyDigits(editPurchaseAmount), 10) || null : null,
        installment_principal:  editInstallmentPrincipal.trim() ? parseInt(onlyDigits(editInstallmentPrincipal), 10) || null : null,
        finance_company:        editFinanceCompany || null,
        vat_deferred:           editVatDeferred === "Y",
        vat_deferred_amount:    editVatDeferred === "Y" && editVatDeferredAmount.trim()
                                  ? parseInt(editVatDeferredAmount.replace(/,/g, ""), 10) || null : null,
        loan_period:            editLoanPeriod.trim() ? parseInt(editLoanPeriod, 10) || null : null,
        sales_rep:              editSalesRep.trim() || null,
        special_note:           editSpecialNote.trim() || null,
        // 전화번호 변경 시 마스킹 초기화
        ...(onlyDigits(editCustomerPhone) !== onlyDigits(editRow?.customer_phone ?? "")
          ? { phone_scrubbed_at: null }
          : {}),
      };
      const { error } = await supabase.from("hyundaicm_tasks").update(patch).eq("id", editRow.id as any);
      if (error) throw error;
      setRows((prev) => prev.map((r) => String(r.id) === String(editRow.id) ? { ...r, ...patch } : r));

      // SMS 알림 — 확정 전 수정 시만, 변경된 필드 목록 포함
      if (editRow.status !== "확정") {
        // 변경된 필드 감지
        const changedFields: string[] = [];
        const fmtAmt = (v: number | null | undefined) =>
          v != null ? Number(v).toLocaleString("ko-KR") + "원" : "-";

        const changes: { label: string; before: string; after: string }[] = [];

        if (patch.customer_name !== editRow.customer_name)
          changes.push({ label: "고객명", before: editRow.customer_name ?? "-", after: patch.customer_name });
        if (patch.customer_phone !== (editRow.customer_phone ?? null))
          changes.push({ label: "전화번호", before: editRow.customer_phone ?? "-", after: patch.customer_phone ?? "-" });
        if (patch.equipment_ton !== (editRow.equipment_ton ?? null))
          changes.push({ label: "톤수", before: editRow.equipment_ton ?? "-", after: patch.equipment_ton ?? "-" });
        if (patch.finance_company !== (editRow.finance_company ?? null))
          changes.push({ label: "금융사", before: editRow.finance_company ?? "-", after: patch.finance_company ?? "-" });
        if (patch.purchase_amount !== (editRow.purchase_amount ?? null))
          changes.push({ label: "차량가격", before: fmtAmt(editRow.purchase_amount), after: fmtAmt(patch.purchase_amount) });
        if (patch.installment_principal !== (editRow.installment_principal ?? null))
          changes.push({ label: "할부원금", before: fmtAmt(editRow.installment_principal), after: fmtAmt(patch.installment_principal) });
        if (patch.vat_deferred !== (editRow.vat_deferred ?? false))
          changes.push({ label: "부가세후불", before: editRow.vat_deferred ? "Y" : "N", after: patch.vat_deferred ? "Y" : "N" });
        if (patch.vat_deferred_amount !== (editRow.vat_deferred_amount ?? null))
          changes.push({ label: "부가세금액", before: fmtAmt(editRow.vat_deferred_amount), after: fmtAmt(patch.vat_deferred_amount) });
        if (patch.loan_period !== (editRow.loan_period ?? null))
          changes.push({ label: "대출기간", before: editRow.loan_period ? `${editRow.loan_period}개월` : "-", after: patch.loan_period ? `${patch.loan_period}개월` : "-" });
        if (patch.sales_rep !== (editRow.sales_rep ?? null))
          changes.push({ label: "영업사원", before: editRow.sales_rep ?? "-", after: patch.sales_rep ?? "-" });

        const changedSummary = changes.length > 0
          ? changes.map((c) => `${c.label}: ${c.before}→${c.after}`).join("\n")
          : "변경사항 없음";

        sendKakaoNotify({
          type:                 "edit",
          caseNo:               caseNoMap[String(editRow.id)] ?? String(editRow.id),
          customerName:         patch.customer_name,
          customerType:         patch.customer_type,
          equipmentTon:         patch.equipment_ton ?? "-",
          financeCompany:       patch.finance_company ?? "-",
          installmentPrincipal: patch.installment_principal ? String(patch.installment_principal) : "",
          purchaseAmount:       patch.purchase_amount ? String(patch.purchase_amount) : "",
          interestRate:         editRow.interest_rate ? String(editRow.interest_rate) : "",
          incentive:            editRow.incentive ? String(editRow.incentive) : "",
          vatDeferredAmount:    patch.vat_deferred_amount ? String(patch.vat_deferred_amount) : "",
          loanPeriod:           patch.loan_period ? String(patch.loan_period) : (editRow.loan_period ? String(editRow.loan_period) : ""),
          salesRep:             patch.sales_rep ?? "-",
          prevStatus:           editRow.status,
          changedSummary,
        });
      }

      closeEditModal();
    } catch (e: any) { alert(e?.message || "수정 저장 실패"); }
    finally { setEditSaving(false); }
  };

  // ─── 파일 업로드 ─────────────────────────────────────────
  const triggerDocUpload = (rowId: string | number, docKey: string, dbCol: string, label: string) => {
    if (!canUploadDoc) { alert("서류 업로드 권한이 없습니다."); return; }
    setPendingUploadInfo({ rowId, docKey, dbCol, label });
    docInputRef.current?.click();
  };

  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadInfo) return;
    const { rowId, dbCol, label } = pendingUploadInfo;
    const ext  = extFromName(file.name) || "pdf";
    const path = `hyundaicm/${String(rowId)}/${dbCol}.${ext}`;
    setUploadingDocKey(`${rowId}_${dbCol}`);
    try {
      const { error: upErr } = await supabase.storage.from("hcm_docs").upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("hyundaicm_tasks").update({ [dbCol]: path }).eq("id", rowId as any);
      if (dbErr) throw dbErr;
      setRows((prev) => prev.map((r) => String(r.id) === String(rowId) ? { ...r, [dbCol]: path } : r));
      alert(`${label} 업로드 완료`);
    } catch (e: any) { alert(`업로드 실패: ${e?.message}`); }
    finally {
      setUploadingDocKey(null); setPendingUploadInfo(null);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const downloadDoc = async (path: string, label: string) => {
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        // 모바일: Signed URL로 새 탭에서 열기 (a.click()은 모바일에서 동작 안 함)
        const { data, error } = await supabase.storage
          .from("hcm_docs")
          .createSignedUrl(path, 60); // 60초 유효
        if (error || !data?.signedUrl) throw error ?? new Error("URL 생성 실패");
        window.open(data.signedUrl, "_blank");
      } else {
        // PC: Blob 다운로드
        const { data, error } = await supabase.storage.from("hcm_docs").download(path);
        if (error) throw error;
        const url = URL.createObjectURL(data);
        const a   = document.createElement("a");
        a.href = url;
        a.download = `${label}_${path.split("/").pop() ?? "file"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e: any) { alert(`다운로드 실패: ${e?.message}`); }
  };

  // ─── 삭제 ────────────────────────────────────────────────
  const deleteRow = async (rowId: string | number) => {
    if (!canDelete) { alert("삭제 권한은 관리자만 가능합니다."); return; }
    setDeleting(true);
    try {
      const target = rows.find((r) => String(r.id) === String(rowId));
      if (target) {
        const paths = DOC_FIELDS.map((f) => target[f.key] as string | null).filter(Boolean) as string[];
        // 기타서류(hcm_etc_docs) storage 경로도 함께 삭제
        const etcPaths = (etcDocs[String(rowId)] ?? []).map((d) => d.path);
        const allPaths = [...paths, ...etcPaths];
        if (allPaths.length > 0) await supabase.storage.from("hcm_docs").remove(allPaths);
      }
      // 삭제 전 gcal_task_id 조회 → 구글 할일도 삭제
      const { data: gcalRow } = await supabase.from("hyundaicm_tasks").select("gcal_task_id").eq("id", rowId as any).maybeSingle();
      const { error } = await supabase.from("hyundaicm_tasks").delete().eq("id", rowId as any);
      if (error) throw error;
      if (gcalRow?.gcal_task_id && user) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token ?? ""}` },
            body: JSON.stringify({ action: "delete_task", user_id: user.id, event_id: gcalRow.gcal_task_id }),
          });
        } catch (e) { console.warn("[hcm gcal task delete] 실패:", e); }
      }
      setRows((prev) => prev.filter((r) => String(r.id) !== String(rowId)));
      setDeleteConfirmId(null);
    } catch (e: any) { alert(`삭제 실패: ${e?.message}`); }
    finally { setDeleting(false); }
  };

  // ─── JSX ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      {/* 숨겨진 파일 인풋 */}
      <input
        ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic"
        className="hidden" onChange={handleDocFileChange}
      />
      {/* 차량등록증 전용 숨겨진 파일 인풋 */}
      <input
        ref={vehicleRegInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          const rowId = vehicleRegInputRef.current?.getAttribute("data-row-id");
          if (!file || !rowId) return;
          e.target.value = "";
          await uploadVehicleRegDoc(rowId, file);
        }}
      />
      {/* 기타서류 전용 숨겨진 파일 인풋 */}
      <input
        ref={etcDocInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const rowId = etcDocInputRef.current?.getAttribute("data-row-id");
          if (!file || !rowId) return;
          setEtcDocNameInput("");
          setEtcDocNameModal({ rowId, file });
        }}
      />
      {/* 세금계산서 전용 숨겨진 파일 인풋 (차량) */}
      <input
        ref={taxInvoiceInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          const rowId = taxInvoiceInputRef.current?.getAttribute("data-row-id");
          if (!file || !rowId) return;
          e.target.value = "";
          await uploadTaxInvoice(rowId, file, "vehicle");
        }}
      />
      {/* 세금계산서 전용 숨겨진 파일 인풋 (어태치) */}
      <input
        ref={taxInvoiceAttachInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          const rowId = taxInvoiceAttachInputRef.current?.getAttribute("data-row-id");
          if (!file || !rowId) return;
          e.target.value = "";
          await uploadTaxInvoice(rowId, file, "attach");
        }}
      />

      {/* 기타서류 이름 입력 모달 */}
      {etcDocNameModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4"
          onClick={() => { setEtcDocNameModal(null); if (etcDocInputRef.current) etcDocInputRef.current.value = ""; }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-[#0f172a] mb-1">기타서류 이름 입력</p>
            <p className="text-xs text-gray-400 mb-3">파일: {etcDocNameModal.file.name}</p>
            <input
              autoFocus
              type="text"
              value={etcDocNameInput}
              onChange={(e) => setEtcDocNameInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && etcDocNameInput.trim()) {
                  const { rowId, file } = etcDocNameModal;
                  setEtcDocNameModal(null);
                  await uploadEtcDoc(rowId, file, etcDocNameInput.trim());
                }
              }}
              placeholder="예: 사업자등록증, 재직증명서 등"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setEtcDocNameModal(null); if (etcDocInputRef.current) etcDocInputRef.current.value = ""; }}
                className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-gray-300"
              >취소</button>
              <button
                disabled={!etcDocNameInput.trim() || etcDocUploading !== null}
                onClick={async () => {
                  const { rowId, file } = etcDocNameModal;
                  setEtcDocNameModal(null);
                  await uploadEtcDoc(rowId, file, etcDocNameInput.trim());
                }}
                className="px-3 py-1.5 rounded-xl bg-[#0f172a] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40"
              >업로드</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 헤더 (AI비서 스타일) ── */}
      <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <button onClick={() => nav("/work/secretary")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-gray-300 hover:text-gray-700 transition-all">
            ← AI비서
          </button>
          <span className="text-sm font-semibold text-[#0f172a]">🏗 현대건설기계</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => nav("/hyundaicm/kakao-connect")} title="카카오톡 알림 설정"
            className="inline-flex items-center justify-center w-7 h-7 rounded-xl border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-all">
            <Settings size={13} />
          </button>
          <button onClick={() => { if (window.confirm("로그아웃 하시겠습니까?")) logout(); }}
            className="inline-flex items-center px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-300 transition-all">
            로그아웃
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">

        {/* ── 상태 요약 뱃지 ── */}
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter((prev) => prev === s ? "all" : s)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl border text-xs font-semibold transition-all
                ${statusStyle(s)}
                ${statusFilter === s ? "ring-2 ring-offset-2 ring-orange-300/60 shadow-sm" : "hover:shadow-sm"}`}
            >
              {s} <span className="opacity-70">({summaryCounts[s] ?? 0})</span>
            </button>
          ))}
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="px-4 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-500 hover:shadow-sm transition-all"
            >
              전체 보기
            </button>
          )}
        </div>

        {/* ── focusId: 특정 딜 단독 뷰 배너 ── */}
        {focusId && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
            <button
              onClick={() => nav("/hyundaicm")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50 transition-all shrink-0"
            >
              ← 전체 목록
            </button>
            <p className="text-sm text-blue-700 font-medium">
              AI비서에서 선택한 건만 표시 중입니다
            </p>
          </div>
        )}

        {/* ── 액션 바 ── */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowCreatePanel((v) => !v)} className={btnPrimary}>
            + 신규 접수
          </button>
          <button onClick={() => setShowSearchPanel((v) => !v)} className={btnSecondary}>
            🔍 검색 / 필터
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowClosed((v) => !v)}
              className={`inline-flex items-center justify-center px-3 py-1.5 rounded-xl border text-sm font-medium transition-all
                ${showClosed ? "bg-orange-50 border-orange-200 text-orange-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
            >
              {showClosed ? "종료 건 숨기기" : "종료 건 포함"}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-600">
              <select
                value={statsMonth}
                onChange={(e) => setStatsMonth(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#0f172a] outline-none cursor-pointer pr-1"
              >
                {availableStatsMonths.map((ym) => (
                  <option key={ym} value={ym}>
                    {ym.slice(0, 4)}년 {parseInt(ym.slice(4), 10)}월
                  </option>
                ))}
              </select>
              <span className="text-gray-300">|</span>
              <span className="text-gray-400">접수</span>
              <span className="font-bold text-[#0f172a]">{monthlyStats.total}건</span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-400">확정</span>
              <span className="font-bold text-emerald-600">{monthlyStats.confirmed}건</span>
              {monthlyStats.amount > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="font-bold text-orange-500">{(monthlyStats.amount / 100000000).toFixed(1)}억</span>
                </>
              )}
            </div>
            <button onClick={fetchRows} disabled={loading} className={btnGhost}>
              {loading ? "로딩중..." : "새로고침"}
            </button>
          </div>
        </div>

        {/* ── 검색 패널 ── */}
        {showSearchPanel && (
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>통합 검색</label>
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="고객명, 법인명, 장비모델, 영업사원, 금융사..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>상태 필터</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as HCMStatus | "all")} className={inputClass}>
                  <option value="all">전체</option>
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {searchText && (
              <button onClick={() => setSearchText("")} className="mt-3 text-xs text-gray-400 hover:text-gray-600">
                검색어 초기화
              </button>
            )}
          </div>
        )}

        {/* ── 신규 접수 패널 ── */}
        {showCreatePanel && (
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">New</p>
                <h2 className="mt-1 text-sm font-semibold text-[#0f172a]">신규 접수</h2>
              </div>
              <button
                onClick={() => { setShowCreatePanel(false); onReset(); }}
                className="h-9 w-9 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-300 text-sm font-bold transition-all"
              >×</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>고객 유형 *</label>
                <select value={customerType} onChange={(e) => setCustomerType(e.target.value as CustomerType)} className={inputClass}>
                  <option value="개인">개인</option>
                  <option value="법인">법인</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>고객명 *</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="홍길동" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>전화번호 *</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(formatPhoneKR(e.target.value))} placeholder="010-1234-5678" inputMode="tel" className={inputClass} />
              </div>
              {customerType === "법인" && (
                <div>
                  <label className={labelClass}>대표자명</label>
                  <input value={ceoName} onChange={(e) => setCeoName(e.target.value)} placeholder="홍길동" className={inputClass} />
                </div>
              )}
              <div>
                <label className={labelClass}>톤수</label>
                <input value={equipmentTon} onChange={(e) => setEquipmentTon(e.target.value)} placeholder="예: 20톤" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>차량가격 (원)</label>
                <input
                  value={purchaseAmount ? Number(purchaseAmount).toLocaleString("ko-KR") : ""}
                  onChange={(e) => setPurchaseAmount(onlyDigits(e.target.value))}
                  placeholder="150,000,000" inputMode="numeric" className={inputClass}
                />
                {purchaseAmount && <p className="mt-1 text-xs text-gray-400">{Number(purchaseAmount).toLocaleString("ko-KR")}원</p>}
              </div>
              <div>
                <label className={labelClass}>할부원금 (원)</label>
                <input
                  value={installmentPrincipal ? Number(installmentPrincipal).toLocaleString("ko-KR") : ""}
                  onChange={(e) => setInstallmentPrincipal(onlyDigits(e.target.value))}
                  placeholder="120,000,000" inputMode="numeric" className={inputClass}
                />
                {installmentPrincipal && <p className="mt-1 text-xs text-gray-400">{Number(installmentPrincipal).toLocaleString("ko-KR")}원</p>}
              </div>
              <div>
                <label className={labelClass}>할부금융사</label>
                <select value={financeCompany} onChange={(e) => setFinanceCompany(e.target.value)} className={inputClass}>
                  <option value="NH캐피탈">NH캐피탈</option>
                  <option value="오릭스캐피탈">오릭스캐피탈</option>
                  <option value="우리금융캐피탈">우리금융캐피탈</option>
                </select>
              </div>
              {/* 부가세 후불 + 금액 + 영업사원 — 한 행 */}
              <div className="col-span-1 sm:col-span-2 md:col-span-3">
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <label className={labelClass}>부가세 후불</label>
                    <div className="flex gap-1.5">
                      {(["Y", "N"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => { setVatDeferred(v); if (v === "N") setVatDeferredAmount(""); }}
                          className={`flex-1 h-[38px] rounded-xl border text-xs font-semibold transition-all ${
                            vatDeferred === v
                              ? v === "Y" ? "bg-orange-500 border-orange-500 text-white" : "bg-gray-200 border-gray-300 text-gray-700"
                              : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                          }`}
                        >{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>후불금액 (원)</label>
                    <input
                      value={vatDeferredAmount ? Number(vatDeferredAmount).toLocaleString("ko-KR") : ""}
                      onChange={(e) => setVatDeferredAmount(onlyDigits(e.target.value))}
                      placeholder={vatDeferred === "Y" ? "15,000,000" : "-"}
                      inputMode="numeric"
                      disabled={vatDeferred === "N"}
                      className={`h-[38px] w-full px-3 rounded-xl border text-xs font-medium transition-all focus:outline-none focus:border-orange-400 ${vatDeferred === "N" ? "bg-gray-50 border-gray-200 text-gray-300" : "bg-white border-gray-200 text-[#0f172a]"}`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>영업사원 *</label>
                    <input
                      value={salesRep}
                      onChange={(e) => setSalesRep(e.target.value)}
                      placeholder="홍길동"
                      className="h-[38px] w-full px-3 rounded-xl border border-gray-200 bg-white text-xs font-medium text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:border-orange-400 transition-all"
                    />
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-4">
              <label className={labelClass}>특이사항</label>
              <textarea
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder="고객 요청사항, 특이사항, 신용조회 관련 메모..."
                className="w-full min-h-[80px] px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all"
              />
            </div>

            {err && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">{err}</div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setShowCreatePanel(false); onReset(); }} disabled={saving} className={btnSecondary}>취소</button>
              <button onClick={onAdd} disabled={saving} className={btnPrimary}>{saving ? "등록중..." : "접수 등록"}</button>
            </div>
          </div>
        )}

        {/* ── 카드 목록 ── */}
        {loading && <div className="py-3 text-center text-sm text-gray-400">로딩 중...</div>}

        {!loading && filteredRows.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-center text-sm text-gray-500">
            조회 결과가 없습니다.
          </div>
        )}

        <div className="space-y-4">
          {filteredRows.map((r) => {
            const memoVal     = memoDrafts[String(r.id)] ?? r.special_note ?? "";
            const memoChanged = memoVal !== (r.special_note ?? "");

            const docExpired   = isDocExpired(r.closed_at);
            const phoneMasked  = shouldMaskPhone(r);
            const isConfirmed  = r.status === "확정" || r.status === "거절";
            const isExpanded   = expandedIds.has(String(r.id));

            return (
              <div key={r.id} className={`rounded-xl border bg-white shadow-sm transition-all overflow-hidden ${
                r.status === "거절" ? "border-red-200" :
                r.status === "확정" ? "border-emerald-200" :
                "border-gray-200 hover:shadow-md"
              }`}>

                {/* 카드 헤더 */}
                <div className="px-4 md:px-3.5 pt-4 pb-3 border-b border-gray-100">
                  {/* 1행: 케이스번호+이름 / 버튼 */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
                      <span className="text-xs font-semibold text-gray-400 font-mono shrink-0">{caseNoMap[String(r.id)] ?? "-"}</span>
                      <span className="text-base font-semibold text-[#0f172a] break-all">
                        {r.company_name ? `${r.company_name}${r.customer_name !== r.company_name ? ` (${r.customer_name})` : ""}` : r.customer_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isConfirmed && (
                        <button
                          onClick={() => toggleExpand(r.id)}
                          className={`inline-flex items-center justify-center px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                            r.status === "거절" ? "border-red-200 bg-red-50 text-red-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >{isExpanded ? "접기 ↑" : "펼치기 ↓"}</button>
                      )}
                      {/* 상환스케줄 버튼: 원금+금리+기간 모두 있을 때 */}
                      {r.installment_principal && r.interest_rate && r.loan_period && (
                        <button
                          onClick={() => {
                            setScheduleModal(r);
                            // override 초기화 (딜 값으로 세팅)
                            setSchedOvPrincipal(String(r.loan_limit ?? r.installment_principal ?? ""));
                            setSchedOvRate(String(r.interest_rate ?? ""));
                            setSchedOvMonths(String(r.loan_period ?? ""));
                            setSchedOvGrace(String(r.grace_period ?? "0"));
                            setScheduleRecipient(r.company_name ?? r.customer_name ?? "");
                            setScheduleSendTarget(r.customer_phone ? formatPhoneKR(r.customer_phone) : "");
                          }}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-all"
                        >📄 상환표</button>
                      )}
                      <button onClick={() => openEditModal(r)} className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:shadow-sm transition-all">수정</button>
                      {canDelete && (
                        <button onClick={() => setDeleteConfirmId(r.id)} className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-red-100 bg-white text-xs font-medium text-red-500 hover:bg-red-50 transition-all">삭제</button>
                      )}
                    </div>
                  </div>
                  {/* 2행: 배지들 */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">{r.customer_type}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-xl border text-xs font-semibold ${statusStyle(r.status)}`}>{r.status}</span>
                    {holdMap[String(r.id)] && r.status !== "확정" && r.status !== "거절" && (() => {
                      const h = holdMap[String(r.id)];
                      const d = new Date(h.scheduled_at);
                      const fmt = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
                      return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold">
                          ⏰ 보류 {fmt}
                        </span>
                      );
                    })()}
                    {shouldMaskPhone(r) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-xl bg-gray-100 border border-gray-200 text-gray-400 text-[10px] font-medium">개인정보 마스킹</span>
                    )}
                  </div>
                </div>

                {/* 카드 바디 — 확정 상태면 펼쳤을 때만 표시 */}
                {(!isConfirmed || isExpanded) && (
                <div className="px-4 md:px-3.5 py-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 왼쪽: 기본 정보 */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {/* 전화번호: 모바일 tel: 링크 */}
                      <div>
                        <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">전화번호</p>
                        {!shouldMaskPhone(r) && r.customer_phone ? (
                          <a href={`tel:${onlyDigits(r.customer_phone)}`} className="mt-1 text-sm font-semibold text-orange-500 underline underline-offset-2 break-all">{getDisplayPhone(r)}</a>
                        ) : (
                          <p className="mt-1 text-sm font-semibold text-[#0f172a] break-all">{getDisplayPhone(r)}</p>
                        )}
                      </div>
                      {[
                        { label: "할부금융사", value: r.finance_company ?? "-" },
                        { label: "톤수",       value: r.equipment_ton ?? "-" },
                        { label: "차량가격",   value: formatAmount(r.purchase_amount) },
                        { label: "대출한도",   value: formatAmount(r.loan_limit ?? r.installment_principal) },
                        { label: "선수율",     value: (() => {
                            const principal = r.loan_limit ?? r.installment_principal;
                            return (r.purchase_amount && principal != null)
                              ? `${(((r.purchase_amount - principal) / r.purchase_amount) * 100).toFixed(1)}%`
                              : "-";
                          })() },
                        { label: "금리",       value: r.interest_rate != null ? `${r.interest_rate}%` : "-" },
                        { label: "인센티브",   value: r.incentive != null ? `${r.incentive}%` : "-" },
                        { label: "부가세후불", value: r.vat_deferred ? `Y${r.vat_deferred_amount != null ? " / " + formatAmount(r.vat_deferred_amount) : ""}` : "N" },
                        {
                          label: "대출기간",
                          value: r.loan_period != null
                            ? (r.grace_period != null && r.installment_period != null)
                              ? `${r.loan_period}개월 (거치 ${r.grace_period} + 할부 ${r.installment_period})`
                              : r.grace_period != null
                                ? `${r.loan_period}개월 (거치 ${r.grace_period})`
                                : `${r.loan_period}개월`
                            : "-",
                        },
                        { label: "영업사원",   value: r.sales_rep ?? "-" },
                        { label: "접수일시",   value: formatCreatedAt(r.created_at) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">{label}</p>
                          <p className="mt-1 text-sm font-semibold text-[#0f172a] break-all">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* 신용결과 상세 */}
                    {(r.nice_score != null || r.credit_rate != null || r.credit_incentive != null || r.biz_history || CREDIT_STATUSES.includes(r.status as any) || creditResults[String(r.id)]) && (
                      <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 grid grid-cols-2 gap-2">
                        <div className="col-span-2 flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">신용결과 상세</p>
                          {/* 판정결과 배지 */}
                          {(() => {
                            const creditStatus = CREDIT_STATUSES.includes(r.status as any)
                              ? r.status
                              : creditResults[String(r.id)];
                            if (!creditStatus) return null;
                            return (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-xl border text-xs font-bold ${statusStyle(creditStatus as HCMStatus)}`}>
                                판정: {creditStatus}
                              </span>
                            );
                          })()}
                        </div>
                        {r.nice_score != null && (
                          <div>
                            <p className="text-xs text-gray-400">NICE 점수</p>
                            <p className="text-sm font-semibold text-[#0f172a]">{r.nice_score}점</p>
                          </div>
                        )}
                        {r.credit_rate != null && (
                          <div>
                            <p className="text-xs text-gray-400">적용금리</p>
                            <p className="text-sm font-semibold text-[#0f172a]">{r.credit_rate}%</p>
                          </div>
                        )}
                        {r.credit_incentive != null && (
                          <div>
                            <p className="text-xs text-gray-400">적용인센티브</p>
                            <p className="text-sm font-semibold text-[#0f172a]">{r.credit_incentive}%</p>
                          </div>
                        )}
                        {r.biz_history && (
                          <div>
                            <p className="text-xs text-gray-400">업력</p>
                            <p className="text-sm font-semibold text-[#0f172a]">{r.biz_history}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 진행 단계 */}
                    <div className="space-y-2 mt-1">
                      <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">진행 단계</p>
                      {/* 1행: 진행단계 버튼 */}
                      <div className="flex flex-wrap gap-1.5 pb-1">
                        {/* 접수 버튼 */}
                        {["접수"].map((s) => {
                          const canGo = canGoToStatus(r.status, s as HCMStatus, isAdminLevel);
                          return (
                          <button
                            key={s}
                            disabled={!canChangeStatus || r.status === s || !canGo}
                            onClick={() => changeStatus(r, s as HCMStatus)}
                            className={`px-3 py-1 rounded-xl border text-xs font-semibold transition-all
                              ${r.status === s
                                ? statusStyle(s as HCMStatus) + " ring-2 ring-offset-1 ring-orange-200/60"
                                : canGo && canChangeStatus
                                  ? "bg-white border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-600"
                                  : "bg-white border-gray-100 text-gray-300 cursor-not-allowed"
                              }`}
                          >{s}</button>
                          );
                        })}

                        {/* 신용결과 버튼 (승인/보완/거절) */}
                        {CREDIT_STATUSES.map((s) => {
                          const isCurrent = r.status === s || creditResults[String(r.id)] === s;
                          const canGo = canGoToStatus(r.status, s, isAdminLevel) || CREDIT_STATUSES.includes(r.status as any);
                          const openCreditModal = () => {
                            setCreditNiceScore(r.nice_score != null ? String(r.nice_score) : "");
                            setCreditRate(r.credit_rate != null ? String(r.credit_rate) : "");
                            setCreditIncentive(r.credit_incentive != null ? String(r.credit_incentive) : "");
                            setCreditLoanLimit(r.loan_limit != null ? Number(r.loan_limit).toLocaleString("ko-KR") : "");
                            setCreditLoanPeriod(r.loan_period != null ? String(r.loan_period) : "");
                            setCreditGracePeriod(r.grace_period != null ? String(r.grace_period) : "");
                            setCreditInstallmentPeriod(r.installment_period != null ? String(r.installment_period) : "");
                            setCreditVehicleAmount(r.vehicle_amount != null ? Number(r.vehicle_amount).toLocaleString("ko-KR") : "");
                            setCreditAttachAmount(r.attach_amount != null ? Number(r.attach_amount).toLocaleString("ko-KR") : "");
                            setCreditVatAmount(r.vat_deferred_amount != null ? Number(r.vat_deferred_amount).toLocaleString("ko-KR") : "");
                            setCreditNote(r.credit_note ?? "");
                            setCreditBizHistory((r.biz_history as any) ?? "1년이상");
                            setCreditModal({ row: r, next: s });
                          };
                          return (
                            <button
                              key={s}
                              disabled={!canChangeStatus || !canGo}
                              onClick={openCreditModal}
                              className={`px-3 py-1 rounded-xl border text-xs font-semibold transition-all
                                ${isCurrent
                                  ? statusStyle(s) + " ring-2 ring-offset-1 ring-orange-200/60"
                                  : canGo && canChangeStatus
                                    ? "bg-white border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-600"
                                    : "bg-white border-gray-100 text-gray-300 cursor-not-allowed"
                                }`}
                            >{s}</button>
                          );
                        })}

                        {/* 확정 버튼 */}
                        {["확정"].map((s) => {
                          const canGo = canGoToStatus(r.status, s as HCMStatus, isAdminLevel);
                          return (
                          <button
                            key={s}
                            disabled={!canChangeStatus || r.status === s || !canGo}
                            onClick={() => changeStatus(r, s as HCMStatus)}
                            className={`px-3 py-1 rounded-xl border text-xs font-semibold transition-all
                              ${r.status === s
                                ? statusStyle(s as HCMStatus) + " ring-2 ring-offset-1 ring-orange-200/60"
                                : canGo && canChangeStatus
                                  ? "bg-white border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-600"
                                  : "bg-white border-gray-100 text-gray-300 cursor-not-allowed"
                              }`}
                          >{s}</button>
                          );
                        })}

                        {/* 보류(재통화 예약) 버튼 */}
                        {canChangeStatus && r.status !== "확정" && r.status !== "거절" && (
                          <button
                            onClick={() => openHoldModal(r)}
                            className={`px-3 py-1 rounded-xl border text-xs font-semibold transition-all
                              ${holdMap[String(r.id)]
                                ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                                : "bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-700"
                              }`}
                          >
                            {holdMap[String(r.id)] ? "⏰ 보류중" : "⏰ 보류"}
                          </button>
                        )}
                        {/* 승인조건 확인 버튼 — 승인 결과가 있는 건만 표시 */}
                        {(r.credit_rate != null || r.loan_limit != null || r.vehicle_amount != null || r.attach_amount != null) && (
                          <button
                            onClick={() => setApprovalModal(r)}
                            className="px-3 py-1 rounded-xl border text-xs font-semibold transition-all bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                          >
                            📋 승인조건
                          </button>
                        )}
                        {/* 조건 변경 버튼 — 신용결과(승인/보완/거절)가 이미 확정된 건의 세부조건만 다시 입력 */}
                        {canChangeStatus && CREDIT_STATUSES.includes(r.status as any) && (
                          <button
                            onClick={() => {
                              setCreditNiceScore(r.nice_score != null ? String(r.nice_score) : "");
                              setCreditRate(r.credit_rate != null ? String(r.credit_rate) : "");
                              setCreditIncentive(r.credit_incentive != null ? String(r.credit_incentive) : "");
                              setCreditLoanLimit(r.loan_limit != null ? Number(r.loan_limit).toLocaleString("ko-KR") : "");
                              setCreditLoanPeriod(r.loan_period != null ? String(r.loan_period) : "");
                              setCreditGracePeriod(r.grace_period != null ? String(r.grace_period) : "");
                              setCreditInstallmentPeriod(r.installment_period != null ? String(r.installment_period) : "");
                              setCreditVehicleAmount(r.vehicle_amount != null ? Number(r.vehicle_amount).toLocaleString("ko-KR") : "");
                              setCreditAttachAmount(r.attach_amount != null ? Number(r.attach_amount).toLocaleString("ko-KR") : "");
                              setCreditVatAmount(r.vat_deferred_amount != null ? Number(r.vat_deferred_amount).toLocaleString("ko-KR") : "");
                              setCreditNote(r.credit_note ?? "");
                              setCreditBizHistory((r.biz_history as any) ?? "1년이상");
                              setCreditModal({ row: r, next: r.status as HCMStatus });
                            }}
                            className="px-3 py-1 rounded-xl border text-xs font-semibold transition-all bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                          >
                            ✏️ 조건 변경
                          </button>
                        )}
                      </div>

                      {/* 2행: 업로드 버튼 + 인센티브 지급 버튼 — 확정 상태일 때만 표시 */}
                      {r.status === "확정" && (canUploadVehicleRegDoc || canUploadTaxInvoice || isAdminLevel) && (
                        <div className="flex flex-wrap gap-1.5">
                          {canUploadVehicleRegDoc && (
                            <button
                              disabled={
                                vehicleRegUploading === String(r.id) ||
                                (vehicleRegFiles[String(r.id)] ?? []).length > 0
                              }
                              onClick={() => {
                                vehicleRegInputRef.current?.setAttribute("data-row-id", String(r.id));
                                vehicleRegInputRef.current?.click();
                              }}
                              className="px-3 py-1 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                              {vehicleRegUploading === String(r.id)
                                ? "업로드중..."
                                : (vehicleRegFiles[String(r.id)] ?? []).length > 0
                                  ? "✓ 차량등록증"
                                  : "+ 차량등록증"}
                            </button>
                          )}
                          {canUploadTaxInvoice && (() => {
                            const files      = taxInvoiceFiles[String(r.id)] ?? [];
                            const hasAttach  = r.attach_amount != null && r.attach_amount > 0;
                            const vFiles     = files.filter(f => f.invoiceType === "vehicle");
                            const aFiles     = files.filter(f => f.invoiceType === "attach");
                            const vUploading = taxInvoiceUploading === `${r.id}-vehicle`;
                            const aUploading = taxInvoiceUploading === `${r.id}-attach`;
                            return (
                              <>
                                {/* 차량 세금계산서 */}
                                <button
                                  disabled={vUploading || vFiles.length > 0}
                                  onClick={() => {
                                    taxInvoiceInputRef.current?.setAttribute("data-row-id", String(r.id));
                                    taxInvoiceInputRef.current?.click();
                                  }}
                                  className="px-3 py-1 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                  {vUploading ? "업로드중..." : vFiles.length > 0 ? "✓ 세금계산서" : "+ 세금계산서"}
                                </button>
                                {/* 어태치 세금계산서 (attach_amount 있을 때만) */}
                                {hasAttach && (
                                  <button
                                    disabled={aUploading || aFiles.length > 0}
                                    onClick={() => {
                                      taxInvoiceAttachInputRef.current?.setAttribute("data-row-id", String(r.id));
                                      taxInvoiceAttachInputRef.current?.click();
                                    }}
                                    className="px-3 py-1 rounded-xl border border-cyan-300 bg-cyan-50 text-cyan-700 text-xs font-semibold hover:bg-cyan-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                  >
                                    {aUploading ? "업로드중..." : aFiles.length > 0 ? "✓ 어태치 계산서" : "+ 어태치 계산서"}
                                  </button>
                                )}
                              </>
                            );
                          })()}
                          {isAdminLevel && (
                            <button
                              disabled={incentivePaidIds.has(String(r.id))}
                              onClick={() => {
                                if (!window.confirm("인센티브 지급 완료 알림을 발송하시겠습니까?")) return;
                                sendKakaoNotify({
                                  type:           "incentive_paid",
                                  caseNo:         caseNoMap[String(r.id)] ?? String(r.id),
                                  customerName:   r.customer_name,
                                  customerType:   r.customer_type,
                                  equipmentTon:   r.equipment_ton,
                                  financeCompany: r.finance_company,
                                  salesRep:       r.sales_rep,
                                });
                                setIncentivePaidIds((prev) => new Set([...prev, String(r.id)]));
                              }}
                              className="px-3 py-1 rounded-xl border border-purple-300 bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                              {incentivePaidIds.has(String(r.id)) ? "✓ 인센티브 지급" : "💰 인센티브 지급"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 오른쪽: 증빙서류 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">증빙서류</p>
                      {docExpired && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-gray-100 border border-gray-200 text-gray-400 text-xs font-semibold">
                          확정 후 24시간 경과 — 파일 삭제됨
                        </span>
                      )}
                    </div>
                    <div className="space-y-2.5">
                      {DOC_FIELDS.map((f) => {
                        const path        = r[f.key] as string | null;
                        const isUploading = uploadingDocKey === `${r.id}_${f.dbCol}`;
                        return (
                          <div key={f.key} className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-gray-600 w-36 shrink-0">{f.label}</span>
                            <div className="flex items-center gap-2">
                              {docExpired ? (
                                <span className="text-xs text-gray-400 font-medium">삭제됨</span>
                              ) : path ? (
                                <>
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                                    ✓ 완료
                                  </span>
                                  <button onClick={() => downloadDoc(path, f.label)} className="px-3 py-1 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:border-navy-900 hover:text-[#0f172a] transition-all">
                                    다운로드
                                  </button>
                                  {canUploadDoc && (
                                    <button disabled={isUploading} onClick={() => triggerDocUpload(r.id, f.key, f.dbCol, f.label)} className="px-3 py-1 rounded-xl border border-orange-300 text-orange-600 text-xs font-semibold hover:bg-orange-50 hover:border-orange-400 disabled:opacity-50 transition-all">
                                      {isUploading ? "..." : "재업로드"}
                                    </button>
                                  )}
                                </>
                              ) : (
                                <button disabled={isUploading || !canUploadDoc} onClick={() => triggerDocUpload(r.id, f.key, f.dbCol, f.label)} className="px-3 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:border-orange-300 hover:text-orange-600 disabled:opacity-50 transition-all">
                                  {isUploading ? "업로드중..." : "+ 업로드"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 기타서류 다중 업로드 */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">기타서류</span>
                        {canUploadDoc && !docExpired && (
                          <button
                            onClick={() => {
                              etcDocInputRef.current?.setAttribute("data-row-id", String(r.id));
                              etcDocInputRef.current?.click();
                            }}
                            disabled={etcDocUploading === String(r.id)}
                            className="px-3 py-1 rounded-xl border border-orange-300 text-orange-600 text-xs font-medium hover:bg-orange-50 disabled:opacity-50 transition-all"
                          >
                            {etcDocUploading === String(r.id) ? "업로드중..." : "+ 추가"}
                          </button>
                        )}
                      </div>
                      {(etcDocs[String(r.id)] ?? []).length === 0 ? (
                        <p className="text-xs text-gray-400">등록된 기타서류가 없습니다.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(etcDocs[String(r.id)] ?? []).map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                              <span className="text-xs text-gray-700 truncate min-w-0">{doc.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => downloadDoc(doc.path, doc.name)}
                                  className="px-2.5 py-1 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:border-navy-900 hover:text-[#0f172a] transition-all"
                                >다운로드</button>
                                {canUploadDoc && (
                                  <button
                                    onClick={() => deleteEtcDoc(doc.id, doc.path, r.id)}
                                    className="px-2.5 py-1 rounded-xl border border-red-100 text-red-400 text-xs font-medium hover:border-red-300 hover:text-red-600 transition-all"
                                  >삭제</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {/* 차량등록증 파일 목록 — 확정 상태이고 펼쳐진 경우에만 표시 */}
                {r.status === "확정" && (!isConfirmed || isExpanded) && canUploadVehicleRegDoc && (
                <div className="px-4 md:px-3.5 pb-5 border-t border-emerald-100 pt-4">
                  <div className="mb-3">
                    <p className="text-xs font-medium tracking-wide text-emerald-600 uppercase">차량등록증</p>
                    <p className="text-xs text-gray-400 mt-0.5">업로드 후 72시간 뒤 자동 삭제됩니다</p>
                  </div>

                  {/* 업로드된 파일 목록 */}
                  {(vehicleRegFiles[String(r.id)] ?? []).length > 0 ? (
                    <div className="space-y-2">
                      {(vehicleRegFiles[String(r.id)] ?? []).map((f, idx) => {
                        const uploadedDate = new Date(f.uploadedAt);
                        const expiresDate  = new Date(uploadedDate.getTime() + 72 * 60 * 60 * 1000);
                        const hoursLeft    = Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60)));
                        return (
                          <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-emerald-800 truncate">{f.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {formatCreatedAt(f.uploadedAt)} 업로드 &nbsp;·&nbsp;
                                <span className={hoursLeft < 6 ? "text-red-500 font-semibold" : "text-gray-400"}>
                                  {hoursLeft}시간 후 자동삭제
                                </span>
                              </p>
                            </div>
                            {(isAdmin || isSubAdmin || isNhCapital || isNhCapitalStaff) && (
                            <button
                              onClick={() => downloadVehicleRegDoc(f.path, f.name)}
                              className="shrink-0 px-3 py-1 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-medium hover:border-emerald-400 transition-all"
                            >다운로드</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">업로드된 차량등록증이 없습니다.</p>
                  )}
                </div>
                )}

                {/* 세금계산서 — 확정 상태이고 펼쳐진 경우에만 표시 */}
                {r.status === "확정" && (!isConfirmed || isExpanded) && (
                <div className="px-4 md:px-3.5 pb-5 border-t border-blue-100 pt-4">
                  <div className="mb-3">
                    <p className="text-xs font-medium tracking-wide text-blue-600 uppercase">세금계산서</p>
                    <p className="text-xs text-gray-400 mt-0.5">업로드 후 72시간 뒤 자동 삭제됩니다</p>
                  </div>

                  {(taxInvoiceFiles[String(r.id)] ?? []).length > 0 ? (
                    <div className="space-y-2">
                      {(taxInvoiceFiles[String(r.id)] ?? []).map((f, idx) => {
                        const uploadedDate = new Date(f.uploadedAt);
                        const expiresDate  = new Date(uploadedDate.getTime() + 72 * 60 * 60 * 1000);
                        const hoursLeft    = Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60)));
                        const isAttach     = f.invoiceType === "attach";
                        return (
                          <div key={idx} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-1.5 ${isAttach ? "border-cyan-100 bg-cyan-50" : "border-blue-100 bg-blue-50"}`}>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isAttach ? "bg-cyan-200 text-cyan-800" : "bg-blue-200 text-blue-800"}`}>
                                  {isAttach ? "어태치" : "차량"}
                                </span>
                                <p className={`text-sm font-medium truncate ${isAttach ? "text-cyan-800" : "text-blue-800"}`}>{f.name}</p>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {formatCreatedAt(f.uploadedAt)} 업로드 &nbsp;·&nbsp;
                                <span className={hoursLeft < 6 ? "text-red-500 font-semibold" : "text-gray-400"}>
                                  {hoursLeft}시간 후 자동삭제
                                </span>
                              </p>
                            </div>
                            <button
                              onClick={() => downloadTaxInvoice(f.path, f.name)}
                              className={`shrink-0 px-3 py-1 rounded-xl border text-xs font-medium transition-all ${isAttach ? "border-cyan-200 text-cyan-700 hover:border-cyan-400" : "border-blue-200 text-blue-700 hover:border-blue-400"}`}
                            >다운로드</button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">업로드된 세금계산서가 없습니다.</p>
                  )}
                </div>
                )}

                {/* 메모 — 확정 시 펼쳤을 때만 표시 */}
                {(!isConfirmed || isExpanded) && (
                <div className="px-3.5 pb-5 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">특이사항 / 메모</p>
                    {memoChanged && (
                      <button disabled={memoSavingId === r.id} onClick={() => saveMemo(r.id)} className={btnPrimary + " !py-1 !px-3 !text-xs"}>
                        {memoSavingId === r.id ? "저장중..." : "저장"}
                      </button>
                    )}
                  </div>
                  <textarea
                    value={memoVal}
                    onChange={(e) => setMemoDrafts((prev) => ({ ...prev, [String(r.id)]: e.target.value }))}
                    placeholder="신용조회 결과, 금융사 조건, 특이사항 입력..."
                    className="w-full h-[72px] text-sm text-gray-700 rounded-xl bg-gray-50 border border-gray-200 px-3 py-1.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all"
                  />
                </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 수정 모달 ── */}
      {editRow && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">Edit</p>
                <h2 className="mt-1 text-sm font-semibold text-[#0f172a]">기본정보 수정</h2>
                <p className="mt-1 text-sm text-gray-500">고객 정보 및 장비/금융 정보를 수정합니다.</p>
              </div>
              <button onClick={closeEditModal} disabled={editSaving} className="h-9 w-9 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:border-gray-300 disabled:opacity-50 transition-all">×</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>고객 유형</label><select value={editCustomerType} onChange={(e) => setEditCustomerType(e.target.value as CustomerType)} className={inputClass} disabled={editSaving}><option value="개인">개인</option><option value="법인">법인</option></select></div>
              <div><label className={labelClass}>고객명 *</label><input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} className={inputClass} disabled={editSaving} placeholder="홍길동" /></div>
              <div><label className={labelClass}>전화번호</label><input value={editCustomerPhone} onChange={(e) => setEditCustomerPhone(formatPhoneKR(e.target.value))} className={inputClass} disabled={editSaving} inputMode="tel" /></div>
              {editCustomerType === "법인" && <div><label className={labelClass}>대표자명</label><input value={editCeoName} onChange={(e) => setEditCeoName(e.target.value)} className={inputClass} disabled={editSaving} placeholder="홍길동" /></div>}
              <div><label className={labelClass}>톤수</label><input value={editEquipmentTon} onChange={(e) => setEditEquipmentTon(e.target.value)} className={inputClass} disabled={editSaving} placeholder="예: 20톤" /></div>
              <div><label className={labelClass}>차량가격 (원)</label><input value={editPurchaseAmount} onChange={(e) => setEditPurchaseAmount(onlyDigits(e.target.value))} className={inputClass} disabled={editSaving} inputMode="numeric" /></div>
              <div><label className={labelClass}>할부원금 (원)</label><input value={editInstallmentPrincipal} onChange={(e) => setEditInstallmentPrincipal(onlyDigits(e.target.value))} className={inputClass} disabled={editSaving} inputMode="numeric" /></div>
              <div><label className={labelClass}>할부금융사</label><select value={editFinanceCompany} onChange={(e) => setEditFinanceCompany(e.target.value)} className={inputClass} disabled={editSaving}><option value="NH캐피탈">NH캐피탈</option><option value="오릭스캐피탈">오릭스캐피탈</option><option value="우리금융캐피탈">우리금융캐피탈</option></select></div>
              {/* 부가세 후불 + 금액 + 대출기간 + 영업사원 */}
              <div className="col-span-1 sm:col-span-2 md:col-span-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className={labelClass}>부가세 후불</label>
                    <div className="flex gap-1.5">
                      {(["Y", "N"] as const).map((v) => (
                        <button key={v} type="button"
                          onClick={() => { setEditVatDeferred(v); if (v === "N") setEditVatDeferredAmount(""); }}
                          disabled={editSaving}
                          className={`flex-1 h-[38px] rounded-xl border text-xs font-semibold transition-all ${
                            editVatDeferred === v
                              ? v === "Y" ? "bg-orange-500 border-orange-500 text-white" : "bg-gray-200 border-gray-300 text-gray-700"
                              : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                          }`}
                        >{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>후불금액 (원)</label>
                    <input
                      value={editVatDeferredAmount}
                      onChange={(e) => {
                        const raw = onlyDigits(e.target.value);
                        setEditVatDeferredAmount(raw ? Number(raw).toLocaleString("ko-KR") : "");
                      }}
                      placeholder={editVatDeferred === "Y" ? "15,000,000" : "-"}
                      inputMode="numeric"
                      disabled={editSaving || editVatDeferred === "N"}
                      className={`h-[38px] w-full px-3 rounded-xl border text-xs font-medium transition-all focus:outline-none focus:border-orange-400 ${
                        editVatDeferred === "N" ? "bg-gray-50 border-gray-200 text-gray-300" : "bg-white border-gray-200 text-[#0f172a]"
                      }`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>대출기간 (개월)</label>
                    <input
                      type="number" inputMode="numeric"
                      value={editLoanPeriod}
                      onChange={(e) => setEditLoanPeriod(e.target.value)}
                      placeholder="예: 60"
                      className="h-[38px] w-full px-3 rounded-xl border border-gray-200 bg-white text-xs font-medium text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:border-orange-400 transition-all"
                      disabled={editSaving}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>영업사원</label>
                    <input value={editSalesRep} onChange={(e) => setEditSalesRep(e.target.value)}
                      className="h-[38px] w-full px-3 rounded-xl border border-gray-200 bg-white text-xs font-medium text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:border-orange-400 transition-all"
                      disabled={editSaving} />
                  </div>
                </div>
              </div>
              <div><label className={labelClass}>ID</label><input value={String(editRow.id)} readOnly className={inputClass + " !bg-gray-50 !text-gray-400 cursor-not-allowed"} /></div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>특이사항</label>
              <textarea value={editSpecialNote} onChange={(e) => setEditSpecialNote(e.target.value)} placeholder="신용조회 결과, 금융사 조건, 특이사항..." className="min-h-[90px] w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all" disabled={editSaving} />
            </div>

            <div className="mt-3 flex justify-end gap-3">
              <button onClick={closeEditModal} disabled={editSaving} className={btnSecondary}>취소</button>
              <button onClick={saveEditRow} disabled={editSaving} className={btnPrimary}>{editSaving ? "저장중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteConfirmId != null && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xl">
            <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500 mb-2">Delete</p>
            <h2 className="text-sm font-semibold text-[#0f172a] mb-3">건 삭제 확인</h2>
            <p className="text-sm leading-6 text-gray-600">
              이 건의 <strong>모든 데이터 및 서류 파일이 영구 삭제</strong>됩니다.<br />삭제 후 복구가 불가능합니다.
            </p>
            <div className="mt-3 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmId(null)} disabled={deleting} className={btnSecondary}>취소</button>
              <button
                onClick={() => deleteRow(deleteConfirmId)}
                disabled={deleting}
                className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all disabled:opacity-50"
              >{deleting ? "삭제중..." : "영구 삭제"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 상환스케줄 PDF 모달 ── */}
      {scheduleModal && (() => {
        const r = scheduleModal;
        // override 값 우선 사용 (비어있으면 딜 원래 값 사용)
        const principal   = schedOvPrincipal ? Number(schedOvPrincipal.replace(/,/g,"")) : (r.loan_limit ?? r.installment_principal ?? 0);
        const annualRate  = schedOvRate      ? Number(schedOvRate)      : (r.interest_rate ?? 0);
        const months      = schedOvMonths    ? Number(schedOvMonths)    : (r.loan_period   ?? 0);
        const gracePeriod = schedOvGrace     ? Number(schedOvGrace)     : (r.grace_period  ?? 0);
        const installmentPeriod = months - gracePeriod;
        const periodLabel = gracePeriod > 0
          ? `${months}개월 (거치 ${gracePeriod} + 할부 ${installmentPeriod})`
          : `${months}개월`;
        const { payment, rows } = calcAmortization(principal, annualRate, months, scheduleStartDate, gracePeriod);
        const fmt = (n:number) => n.toLocaleString('ko-KR');
        return (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl flex flex-col max-h-[90vh]">
              {/* 헤더 — 고정 */}
              <div className="px-3 pt-5 pb-4 border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-[#0a192f]">📄 원리금균등 상환스케줄</p>
                  <button onClick={() => setScheduleModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                </div>
                <p className="text-xs text-gray-500">
                  {r.company_name ? `${r.company_name}${r.customer_name !== r.company_name ? ` (${r.customer_name})` : ''}` : r.customer_name}
                  {' · '}{fmt(principal)}원 · {annualRate}% · {periodLabel}
                </p>
              </div>

              {/* 전체 스크롤 영역 */}
              <div className="flex-1 overflow-y-auto">
              {/* 수신인 + 시작월 + 비교설명 조건 */}
              <div className="px-3 py-4 border-b border-gray-100 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">수신인</label>
                  <input
                    value={scheduleRecipient}
                    onChange={e => setScheduleRecipient(e.target.value)}
                    placeholder="예: (주)장장아스콘산업 홍길동 대표"
                    className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">납입 시작월</label>
                  <input
                    type="month"
                    value={scheduleStartDate}
                    onChange={e => setScheduleStartDate(e.target.value)}
                    className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                {/* ── 비교설명용 조건 수정 ── */}
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-orange-700">✏️ 비교설명용 조건 수정</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-500 mb-0.5 block">대출한도 (원)</label>
                      <input
                        type="text" inputMode="numeric"
                        value={schedOvPrincipal ? Number(schedOvPrincipal.replace(/,/g,"")).toLocaleString("ko-KR") : ""}
                        onChange={e => setSchedOvPrincipal(e.target.value.replace(/[^0-9]/g,""))}
                        placeholder={fmt(r.loan_limit ?? r.installment_principal ?? 0)}
                        className="w-full h-8 rounded-lg border border-orange-200 px-2 text-xs focus:outline-none focus:border-orange-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 mb-0.5 block">금리 (%)</label>
                      <input
                        type="number" step="0.1" min="0" max="30"
                        value={schedOvRate}
                        onChange={e => setSchedOvRate(e.target.value)}
                        placeholder={String(r.interest_rate ?? "")}
                        className="w-full h-8 rounded-lg border border-orange-200 px-2 text-xs focus:outline-none focus:border-orange-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 mb-0.5 block">총 대출기간 (개월)</label>
                      <input
                        type="number" min="1" max="120"
                        value={schedOvMonths}
                        onChange={e => setSchedOvMonths(e.target.value)}
                        placeholder={String(r.loan_period ?? "")}
                        className="w-full h-8 rounded-lg border border-orange-200 px-2 text-xs focus:outline-none focus:border-orange-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 mb-0.5 block">거치기간 (개월)</label>
                      <input
                        type="number" min="0" max="60"
                        value={schedOvGrace}
                        onChange={e => setSchedOvGrace(e.target.value)}
                        placeholder={String(r.grace_period ?? "0")}
                        className="w-full h-8 rounded-lg border border-orange-200 px-2 text-xs focus:outline-none focus:border-orange-400 bg-white"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSchedOvPrincipal(String(r.loan_limit ?? r.installment_principal ?? ""));
                      setSchedOvRate(String(r.interest_rate ?? ""));
                      setSchedOvMonths(String(r.loan_period ?? ""));
                      setSchedOvGrace(String(r.grace_period ?? "0"));
                    }}
                    className="text-[11px] text-orange-600 hover:text-orange-800 underline"
                  >원래 조건으로 되돌리기</button>
                </div>
                <div className="flex gap-3 text-center bg-blue-50 rounded-xl p-3">
                  <div className="flex-1"><p className="text-xs text-blue-500">{gracePeriod > 0 ? "거치 후 월 납입액" : "월 납입액"}</p><p className="font-bold text-blue-700 text-sm">{fmt(payment)}원</p></div>
                  <div className="flex-1"><p className="text-xs text-blue-500">총 이자</p><p className="font-bold text-blue-700 text-sm">{fmt(rows.reduce((s,r)=>s+r.interest,0))}원</p></div>
                  <div className="flex-1"><p className="text-xs text-blue-500">총 납입</p><p className="font-bold text-blue-700 text-sm">{fmt(rows.reduce((s,r)=>s+r.payment,0))}원</p></div>
                </div>
              </div>
              {/* 미리보기 테이블 */}
              <div className="px-3 py-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {['회차','납입일','월납입액','원금','이자','잔액'].map(h=>(
                        <th key={h} className="text-left py-1.5 text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row=>(
                      <tr key={row.no} className="border-b border-gray-50">
                        <td className="py-1">{row.no}</td>
                        <td className="py-1 text-gray-500">{row.date}</td>
                        <td className="py-1 font-medium">{fmt(row.payment)}</td>
                        <td className="py-1">{fmt(row.principalPmt)}</td>
                        <td className="py-1 text-gray-500">{fmt(row.interest)}</td>
                        <td className="py-1">{fmt(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 발송 — SMS(MMS)로 상환표 이미지 전송 */}
              <div className="px-3 py-4 border-t border-gray-100 space-y-3">
                <label className="text-xs font-medium text-gray-500 block">수신 전화번호</label>
                <input
                  value={scheduleSendTarget}
                  onChange={e => setScheduleSendTarget(formatPhoneKR(e.target.value))}
                  placeholder="예: 010-1234-5678"
                  inputMode="tel"
                  className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:border-blue-400"
                />
                <button
                  disabled={scheduleSending || !scheduleSendTarget.trim()}
                  onClick={async () => {
                    if (!scheduleTableRef.current) return;
                    setScheduleSending(true);
                    try {
                      let canvas = await html2canvas(scheduleTableRef.current, { scale: 1.5, backgroundColor: "#ffffff" });

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
                      // 품질을 낮춰도 안 되면 캔버스 크기 자체를 추가 축소
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
                        alert("상환표 이미지 압축에 실패했습니다. 잠시 후 다시 시도해주세요.");
                        setScheduleSending(false);
                        return;
                      }

                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-hcm-repayment`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${session?.access_token ?? ""}`,
                          },
                          body: JSON.stringify({
                            recipientPhone: scheduleSendTarget.trim(),
                            recipientName: scheduleRecipient || undefined,
                            customerName: r.company_name ?? r.customer_name,
                            imageBase64,
                            taskId: r.id,
                          }),
                        }
                      );
                      const d = await res.json();
                      if (!res.ok || d.error) {
                        alert(`발송 실패: ${d.error ?? "알 수 없는 오류"}`);
                      } else {
                        alert("SMS 발송 완료되었습니다.");
                      }
                    } catch (e: any) {
                      alert(`발송 중 오류: ${e?.message ?? e}`);
                    } finally {
                      setScheduleSending(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40"
                >{scheduleSending ? "발송 중..." : "📤 SMS로 발송"}</button>
              </div>
              </div>{/* 전체 스크롤 영역 닫기 */}

              {/* PDF/닫기 버튼 — 고정 하단 */}
              <div className="px-3 pb-5 pt-3 border-t border-gray-100 flex gap-2 shrink-0">
                <button
                  onClick={() => downloadSchedulePDF(
                    { ...r,
                      installment_principal: principal,
                      loan_limit: principal,
                      interest_rate: annualRate,
                      loan_period: months,
                      grace_period: gracePeriod,
                      installment_period: months - gracePeriod,
                    } as HCMTask,
                    scheduleStartDate,
                    scheduleRecipient
                  )}
                  className="flex-1 py-2.5 rounded-xl bg-[#0f172a] text-white text-sm font-semibold hover:opacity-90 transition-all"
                >🖨️ PDF 인쇄 / 저장</button>
                <button
                  onClick={() => setScheduleModal(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-all"
                >닫기</button>
              </div>
            </div>

            {/* 발송용 캡처 전용 숨김 DOM — 전체 상환표를 깔끔하게 렌더링 */}
            <div style={{ position: "fixed", left: "-9999px", top: 0, width: "560px" }}>
              <div ref={scheduleTableRef} style={{ fontFamily: "'Malgun Gothic','맑은 고딕',sans-serif", background: "#fff", padding: "24px", color: "#1e293b" }}>
                <h1 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px", color: "#0a192f" }}>원리금균등분납 상환스케줄</h1>
                <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>현대건설기계 할부금융</p>
                {scheduleRecipient && (
                  <p style={{ fontSize: "13px", marginBottom: "12px" }}>수신: <strong style={{ color: "#0a192f" }}>{scheduleRecipient}</strong> 귀중</p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "16px", background: "#f8fafc", borderRadius: "8px", padding: "14px" }}>
                  <div><div style={{ fontSize: "10px", color: "#94a3b8" }}>고객명</div><div style={{ fontWeight: 600, color: "#0a192f", fontSize: "13px" }}>{r.company_name ? `${r.company_name}${r.customer_name !== r.company_name ? ` (${r.customer_name})` : ''}` : r.customer_name}</div></div>
                  <div><div style={{ fontSize: "10px", color: "#94a3b8" }}>할부원금</div><div style={{ fontWeight: 600, color: "#0a192f", fontSize: "13px" }}>{fmt(principal)}원</div></div>
                  <div><div style={{ fontSize: "10px", color: "#94a3b8" }}>금리 (연)</div><div style={{ fontWeight: 600, color: "#0a192f", fontSize: "13px" }}>{annualRate}%</div></div>
                  <div><div style={{ fontSize: "10px", color: "#94a3b8" }}>대출기간</div><div style={{ fontWeight: 600, color: "#0a192f", fontSize: "13px" }}>{months}개월{(r.grace_period ?? 0) > 0 ? ` (거치 ${r.grace_period}+할부 ${months - (r.grace_period ?? 0)})` : ""}</div></div>
                  <div><div style={{ fontSize: "10px", color: "#94a3b8" }}>{(r.grace_period ?? 0) > 0 ? "거치 후 월 납입액" : "월 납입액"}</div><div style={{ fontWeight: 600, color: "#0a192f", fontSize: "13px" }}>{fmt(payment)}원</div></div>
                  <div><div style={{ fontSize: "10px", color: "#94a3b8" }}>금융사</div><div style={{ fontWeight: 600, color: "#0a192f", fontSize: "13px" }}>{r.finance_company ?? "-"}</div></div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {['회차','납입일','월납입액','원금','이자','잔액'].map(h=>(
                        <th key={h} style={{ background: "#0a192f", color: "#fff", padding: "7px 6px", textAlign: h === "회차" || h === "납입일" ? "center" : "right", fontSize: "10px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(rows.length > 12 ? rows.slice(0, 6) : rows).map(row=>(
                      <tr key={row.no} style={{ background: row.no % 2 === 0 ? "#f8fafc" : "#fff" }}>
                        <td style={{ padding: "5px 6px", textAlign: "center", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9" }}>{row.no}</td>
                        <td style={{ padding: "5px 6px", textAlign: "center", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>{row.date}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>{fmt(row.payment)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9" }}>{fmt(row.principalPmt)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>{fmt(row.interest)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9" }}>{fmt(row.balance)}</td>
                      </tr>
                    ))}
                    {rows.length > 12 && (
                      <tr>
                        <td colSpan={6} style={{ padding: "8px 6px", textAlign: "center", fontSize: "11px", color: "#94a3b8", letterSpacing: "2px" }}>⋮ 중간 {rows.length - 12}회차 생략 ⋮</td>
                      </tr>
                    )}
                    {rows.length > 12 && rows.slice(-6).map(row=>(
                      <tr key={row.no} style={{ background: row.no % 2 === 0 ? "#f8fafc" : "#fff" }}>
                        <td style={{ padding: "5px 6px", textAlign: "center", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9" }}>{row.no}</td>
                        <td style={{ padding: "5px 6px", textAlign: "center", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>{row.date}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>{fmt(row.payment)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9" }}>{fmt(row.principalPmt)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>{fmt(row.interest)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontSize: "10.5px", borderBottom: "1px solid #f1f5f9" }}>{fmt(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ marginTop: "16px", fontSize: "10px", color: "#94a3b8", textAlign: "center" }}>
                  ※ 실제 납입액은 금융사 기준일·계산방식에 따라 일부 다를 수 있습니다.
                  {rows.length > 12 ? " 전체 회차 상세 내역은 별도 PDF로 요청해주세요." : ""}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 확정 처리 모달 (간소화: 승인 시 입력한 값 확인 + 대출원금만 수정 가능) ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xl">
            <p className="text-sm font-medium tracking-[0.12em] uppercase text-emerald-600 mb-2">확정 처리</p>
            <h2 className="text-sm font-semibold text-[#0f172a] mb-1">최종 확정</h2>
            <p className="text-sm text-gray-500 mb-1">
              {confirmModal.company_name ? `${confirmModal.company_name}${confirmModal.customer_name !== confirmModal.company_name ? ` (${confirmModal.customer_name})` : ""}` : confirmModal.customer_name} ({confirmModal.customer_type})
            </p>
            <p className="text-xs text-gray-400 mb-4">승인 처리 시 입력한 값이 자동 반영됩니다. 필요 시 수정하세요.</p>

            {/* 승인 시 입력된 값 요약 표시 */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <span className="text-gray-400">금리</span>
                <span className="ml-2 font-semibold text-[#0f172a]">
                  {confirmModal.interest_rate != null ? `${confirmModal.interest_rate}%` : "-"}
                </span>
              </div>
              <div>
                <span className="text-gray-400">인센티브</span>
                <span className="ml-2 font-semibold text-[#0f172a]">
                  {confirmModal.incentive != null ? `${confirmModal.incentive}%` : "-"}
                </span>
              </div>
              <div>
                <span className="text-gray-400">대출기간</span>
                <span className="ml-2 font-semibold text-[#0f172a]">
                  {confirmLoanPeriod ? `${confirmLoanPeriod}개월` : "-"}
                </span>
              </div>
              {confirmModal.vat_deferred && (
                <div>
                  <span className="text-gray-400">부가세후불</span>
                  <span className="ml-2 font-semibold text-[#0f172a]">
                    {confirmVatAmount ? `${confirmVatAmount}원` : "-"}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* 대출원금 — 최종 확인/수정 */}
              <div>
                <label className={labelClass}>대출원금 (원)</label>
                <input
                  type="text"
                  value={confirmLoanPrincipal}
                  onChange={(e) => {
                    const raw = onlyDigits(e.target.value);
                    setConfirmLoanPrincipal(raw ? Number(raw).toLocaleString("ko-KR") : "");
                  }}
                  placeholder="예: 180,000,000"
                  inputMode="numeric"
                  className={inputClass}
                  disabled={confirmSaving}
                />
                {confirmLoanPrincipal && (
                  <p className="mt-1 text-xs text-gray-400">{confirmLoanPrincipal}원</p>
                )}
              </div>
              {/* 대출기간 — 승인 시 미입력이면 여기서 입력 */}
              {!confirmLoanPeriod && (
                <div>
                  <label className={labelClass}>
                    대출기간 (개월)
                    <span className="ml-2 text-xs text-orange-500">※ 미입력</span>
                  </label>
                  <input
                    type="number"
                    value={confirmLoanPeriod}
                    onChange={(e) => setConfirmLoanPeriod(e.target.value)}
                    placeholder="예: 60"
                    inputMode="numeric"
                    className={inputClass + " border-orange-400 ring-2 ring-orange-200/50"}
                    disabled={confirmSaving}
                  />
                </div>
              )}
              {/* 부가세 후불금액 — vat_deferred=Y이고 미입력이면 여기서 입력 */}
              {confirmModal.vat_deferred && !confirmVatAmount && (
                <div>
                  <label className={labelClass}>
                    부가세 후불금액 (원)
                    <span className="ml-2 text-xs text-orange-500">※ 부가세 후불 Y — 미입력</span>
                  </label>
                  <input
                    type="text"
                    value={confirmVatAmount}
                    onChange={(e) => {
                      const raw = onlyDigits(e.target.value);
                      setConfirmVatAmount(raw ? Number(raw).toLocaleString("ko-KR") : "");
                    }}
                    placeholder="예: 17,000,000"
                    inputMode="numeric"
                    className={inputClass + " border-orange-400 ring-2 ring-orange-200/50"}
                    disabled={confirmSaving}
                  />
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-end gap-3">
              <button onClick={() => setConfirmModal(null)} disabled={confirmSaving} className={btnSecondary}>취소</button>
              <button onClick={saveConfirmModal} disabled={confirmSaving} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50">
                {confirmSaving ? "처리중..." : "확정 완료"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 신용결과 상세 입력 모달 ── */}
      {creditModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 py-3">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-2xl flex flex-col max-h-full overflow-hidden">
            <div className="overflow-y-auto flex-1 p-3.5">
            <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500 mb-2">신용결과</p>
            <h2 className="text-sm font-semibold text-[#0f172a] mb-1">
              {creditModal.row.status === creditModal.next ? `${creditModal.next} 조건 변경` : `${creditModal.next} 처리`}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              {creditModal.row.company_name ? `${creditModal.row.company_name}${creditModal.row.customer_name !== creditModal.row.company_name ? ` (${creditModal.row.customer_name})` : ""}` : creditModal.row.customer_name} ({creditModal.row.customer_type})
            </p>

            <div className="space-y-4">
              {/* 거절: 거절사유만 표시 */}
              {creditModal.next === "거절" ? (
                <div>
                  <label className={labelClass}>거절사유</label>
                  <textarea
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    placeholder="거절 사유를 입력해주세요"
                    rows={4}
                    className={inputClass + " resize-none"}
                    disabled={creditSaving}
                  />
                </div>
              ) : (
              <>
              {/* 업력 — 승인/보완 공통 */}
              <div>
                <label className={labelClass}>업력</label>
                <div className="flex gap-2">
                  {(["1년이상", "1년미만"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCreditBizHistory(v)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        creditBizHistory === v
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:border-orange-300"
                      }`}
                    >{v}</button>
                  ))}
                </div>
              </div>

              {/* NICE 점수 — 승인/보완 공통 */}
              <div>
                <label className={labelClass}>NICE 점수</label>
                <input
                  type="number"
                  value={creditNiceScore}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCreditNiceScore(val);
                    const score = parseInt(val);
                    if (!isNaN(score) && creditModal?.row.finance_company === "NH캐피탈") {
                      const suggest = getNhRateByScore(score);
                      if (suggest) {
                        setCreditRate(String(suggest.rate));
                        setCreditIncentive(String(suggest.incentive));
                      }
                    }
                  }}
                  placeholder="예: 742"
                  inputMode="numeric"
                  className={inputClass}
                  disabled={creditSaving}
                />
                {creditModal?.row.finance_company === "NH캐피탈" && creditNiceScore && (() => {
                  const score = parseInt(creditNiceScore);
                  const suggest = !isNaN(score) ? getNhRateByScore(score) : null;
                  if (suggest) return <p className="mt-1.5 text-xs text-emerald-600 font-medium">✓ NH조견표: 금리 {suggest.rate}% / 수수료 {suggest.incentive}%</p>;
                  if (!isNaN(score)) return <p className="mt-1.5 text-xs text-red-500 font-medium">⚠ 조견표 범위 외 (729~1000)</p>;
                  return null;
                })()}
              </div>

              {/* 적용금리 — 승인/보완 공통 */}
              <div>
                <label className={labelClass}>적용금리 (%)</label>
                <input
                  type="number"
                  value={creditRate}
                  onChange={(e) => setCreditRate(e.target.value)}
                  placeholder="예: 4.5"
                  inputMode="decimal"
                  step="0.01"
                  className={inputClass}
                  disabled={creditSaving}
                />
              </div>

              {/* 적용인센티브 — 승인/보완 공통 */}
              <div>
                <label className={labelClass}>적용인센티브 (%)</label>
                <input
                  type="number"
                  value={creditIncentive}
                  onChange={(e) => setCreditIncentive(e.target.value)}
                  placeholder="예: 1.2"
                  inputMode="decimal"
                  step="0.01"
                  className={inputClass}
                  disabled={creditSaving}
                />
              </div>

              {/* 승인 시 추가 필드 */}
              {creditModal.next === "승인" && (<>

              {/* ── 차량가격 분리 입력 ── */}
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide">차량가격</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>차량 (원)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={creditVehicleAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setCreditVehicleAmount(raw ? Number(raw).toLocaleString("ko-KR") : "");
                    }}
                    placeholder="예: 80,000,000"
                    className={inputClass}
                    disabled={creditSaving}
                  />
                </div>
                <div>
                  <label className={labelClass}>어태치 (원)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={creditAttachAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setCreditAttachAmount(raw ? Number(raw).toLocaleString("ko-KR") : "");
                    }}
                    placeholder="예: 10,000,000"
                    className={inputClass}
                    disabled={creditSaving}
                  />
                </div>
              </div>
              {/* 합산 표시 */}
              {(creditVehicleAmount || creditAttachAmount) && (() => {
                const v = parseInt(creditVehicleAmount.replace(/,/g, "")) || 0;
                const a = parseInt(creditAttachAmount.replace(/,/g, "")) || 0;
                const total = v + a;
                return total > 0 ? (
                  <p className="text-xs text-emerald-600 font-medium -mt-1">
                    합산 차량가격: {total.toLocaleString("ko-KR")}원
                  </p>
                ) : null;
              })()}

              {/* ── 대출한도 ── */}
              <div>
                <label className={labelClass}>대출한도 (원)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={creditLoanLimit}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setCreditLoanLimit(raw ? Number(raw).toLocaleString("ko-KR") : "");
                  }}
                  placeholder="예: 90,000,000"
                  className={inputClass}
                  disabled={creditSaving}
                />
              </div>

              {/* ── 기간 분리 입력 ── */}
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide">대출기간</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>거치기간 (개월)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={creditGracePeriod}
                    onChange={(e) => setCreditGracePeriod(e.target.value)}
                    placeholder="예: 6"
                    className={inputClass}
                    disabled={creditSaving}
                  />
                </div>
                <div>
                  <label className={labelClass}>할부기간 (개월)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={creditInstallmentPeriod}
                    onChange={(e) => {
                      setCreditInstallmentPeriod(e.target.value);
                      // 거치+할부 합산 → loan_period 자동 계산
                      const grace = parseInt(creditGracePeriod) || 0;
                      const inst  = parseInt(e.target.value) || 0;
                      setCreditLoanPeriod(String(grace + inst));
                    }}
                    placeholder="예: 54"
                    className={inputClass}
                    disabled={creditSaving}
                  />
                </div>
              </div>
              {/* 합산 대출기간 표시 */}
              {(creditGracePeriod || creditInstallmentPeriod) && (() => {
                const g = parseInt(creditGracePeriod) || 0;
                const i = parseInt(creditInstallmentPeriod) || 0;
                const total = g + i;
                return total > 0 ? (
                  <p className="text-xs text-emerald-600 font-medium -mt-1">
                    총 대출기간: {total}개월 {g > 0 ? `(거치 ${g} + 할부 ${i})` : ""}
                  </p>
                ) : null;
              })()}

              {creditModal.row.vat_deferred && (
              <div>
                <label className={labelClass}>
                  부가세 후불금액 (원)
                  <span className="ml-2 text-xs font-semibold text-orange-500">※ 부가세 후불 Y</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={creditVatAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setCreditVatAmount(raw ? Number(raw).toLocaleString("ko-KR") : "");
                  }}
                  placeholder="예: 17,000,000"
                  className={inputClass + (!creditVatAmount ? " border-orange-400 ring-2 ring-orange-200/50" : "")}
                  disabled={creditSaving}
                />
                {creditVatAmount && <p className="mt-1 text-xs text-gray-400">{creditVatAmount}원</p>}
              </div>
              )}
              </>)}

              {/* 특이사항(승인) / 보완사항(보완) — credit_note 컬럼, 본문 특이사항(special_note)과는 별개 항목 */}
              <div>
                <label className={labelClass}>
                  {creditModal.next === "승인" ? "특이사항 (승인조건 메모)" : "보완사항"}
                </label>
                <textarea
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder={creditModal.next === "승인" ? "승인조건 관련 특이사항을 입력해주세요" : "보완 사항을 입력해주세요"}
                  rows={3}
                  className={inputClass + " resize-none"}
                  disabled={creditSaving}
                />
              </div>
              </>
              )}
            </div>
            </div>
            {/* 하단 버튼 — sticky */}
            <div className="px-3.5 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setCreditModal(null)}
                disabled={creditSaving}
                className={btnSecondary}
              >취소</button>
              <button
                onClick={saveCreditModal}
                disabled={creditSaving}
                className={btnPrimary}
              >{creditSaving ? "저장중..." : `${creditModal.next} 저장`}</button>
            </div>
          </div>
        </div>
      )}
      {/* ── 승인조건 확인 모달 ── */}
      {approvalModal && (() => {
        const r = approvalModal;
        const vehicleAmt = r.vehicle_amount ?? 0;
        const attachAmt  = r.attach_amount ?? 0;
        const totalVehicle = vehicleAmt + attachAmt;
        const purchaseDisplay = totalVehicle > 0 ? totalVehicle : (r.purchase_amount ?? 0);
        const gracePeriod = r.grace_period ?? 0;
        const installmentPeriod = r.installment_period ?? 0;
        const totalPeriod = r.loan_period ?? (gracePeriod + installmentPeriod);
        const fmtAmt = (v: number | null) => v != null ? `${v.toLocaleString("ko-KR")}원` : "-";
        return (
          <div className="fixed inset-0 z-[136] flex items-center justify-center bg-black/60 px-4 py-3" style={{backdropFilter:"blur(2px)"}} onClick={() => setApprovalModal(null)}>
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* 헤더 */}
              <div className="bg-blue-600 px-3 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-blue-200 uppercase tracking-wide">승인조건 확인</p>
                    <p className="text-base font-bold text-white mt-0.5">
                      {r.company_name ?? r.customer_name}
                      {r.company_name && r.customer_name !== r.company_name && (
                        <span className="text-sm font-normal text-blue-200 ml-1">({r.customer_name})</span>
                      )}
                    </p>
                    <p className="text-xs text-blue-200 mt-0.5">{r.equipment_ton} · {r.finance_company}</p>
                  </div>
                  <button onClick={() => setApprovalModal(null)} className="text-blue-200 hover:text-white text-xl font-light">✕</button>
                </div>
              </div>

              {/* 차량가격 섹션 */}
              <div className="px-3 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">차량가격</p>
                <div className="space-y-2">
                  {vehicleAmt > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">차량</span>
                      <span className="text-sm font-medium text-gray-800">{fmtAmt(vehicleAmt)}</span>
                    </div>
                  )}
                  {attachAmt > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">어태치</span>
                      <span className="text-sm font-medium text-gray-800">{fmtAmt(attachAmt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                    <span className="text-sm font-semibold text-gray-700">합산 차량가격</span>
                    <span className="text-base font-bold text-blue-700">{fmtAmt(purchaseDisplay || null)}</span>
                  </div>
                </div>
              </div>

              {/* 할부 조건 섹션 */}
              <div className="px-3 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">할부 승인조건</p>
                <div className="space-y-2">
                  {r.installment_principal != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">대출한도</span>
                      <span className="text-sm font-medium text-gray-800">{fmtAmt(r.loan_limit ?? r.installment_principal)}</span>
                    </div>
                  )}
                  {r.vat_deferred && r.vat_deferred_amount != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">부가세 후불</span>
                      <span className="text-sm font-medium text-orange-600">+{fmtAmt(r.vat_deferred_amount)}</span>
                    </div>
                  )}
                  
                  {purchaseDisplay > 0 && (r.loan_limit ?? r.installment_principal) != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">선수율</span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {(((purchaseDisplay - (r.loan_limit ?? r.installment_principal ?? 0)) / purchaseDisplay) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 금리 & 기간 섹션 */}
              <div className="px-3 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">금리 / 기간</p>
                <div className="space-y-2">
                  {r.credit_rate != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">적용금리</span>
                      <span className="text-sm font-bold text-blue-700">{r.credit_rate}%</span>
                    </div>
                  )}
                  {r.credit_incentive != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">인센티브</span>
                      <span className="text-sm font-medium text-gray-800">{r.credit_incentive}%</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">대출기간</span>
                    <span className="text-sm font-medium text-gray-800">
                      {totalPeriod > 0 ? `${totalPeriod}개월` : "-"}
                      {gracePeriod > 0 && installmentPeriod > 0 && (
                        <span className="text-xs text-gray-400 ml-1">(거치 {gracePeriod} + 할부 {installmentPeriod})</span>
                      )}
                    </span>
                  </div>
                  {r.loan_limit != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">대출한도</span>
                      <span className="text-sm font-medium text-gray-800">{fmtAmt(r.loan_limit)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 특이사항 */}
              {r.credit_note && (
                <div className="px-3 py-4 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">특이사항</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.credit_note}</p>
                </div>
              )}

              <div className="px-3 py-3">
                <button onClick={() => setApprovalModal(null)} className="w-full py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-all">닫기</button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* ── 보류(재통화 예약) 모달 ── */}
      {holdModal && (
        <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/40 px-4 py-3">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-2xl flex flex-col max-h-full overflow-hidden">
            <div className="overflow-y-auto flex-1 p-3.5">
              <p className="text-sm font-medium tracking-[0.12em] uppercase text-amber-600 mb-2">보류 / 재통화 예약</p>
              <h2 className="text-sm font-semibold text-[#0f172a] mb-1">알림 예약</h2>
              <p className="text-sm text-gray-500 mb-5">
                {holdModal.company_name ? `${holdModal.company_name}${holdModal.customer_name !== holdModal.company_name ? ` (${holdModal.customer_name})` : ""}` : holdModal.customer_name} ({holdModal.customer_type})
              </p>

              <div className="space-y-4">
                {/* 날짜 */}
                <div>
                  <label className={labelClass}>알림 날짜 *</label>
                  <input
                    type="date"
                    value={holdDate}
                    onChange={(e) => setHoldDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className={inputClass}
                    disabled={holdSaving}
                  />
                </div>

                {/* 시간 */}
                <div>
                  <label className={labelClass}>알림 시간 *</label>
                  <div className="flex flex-wrap gap-2">
                    {["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setHoldTime(t)}
                        disabled={holdSaving}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                          holdTime === t
                            ? "bg-amber-500 border-amber-500 text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:border-amber-300"
                        }`}
                      >{t}</button>
                    ))}
                    <input
                      type="time"
                      value={holdTime}
                      onChange={(e) => setHoldTime(e.target.value)}
                      disabled={holdSaving}
                      className="h-[34px] px-3 rounded-xl border border-gray-200 text-xs font-medium text-[#0f172a] focus:outline-none focus:border-amber-400 transition-all"
                    />
                  </div>
                </div>

                {/* 알림 받을 담당자 */}
                <div>
                  <label className={labelClass}>알림 받을 담당자 * (복수 선택 가능)</label>
                  <div className="space-y-2">
                    {KAKAO_RECIPIENTS.map((rec) => {
                      const checked = holdRecipients.includes(rec.id as RecipientId);
                      return (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => {
                            setHoldRecipients((prev) =>
                              checked
                                ? prev.filter((id) => id !== rec.id)
                                : [...prev, rec.id as RecipientId]
                            );
                          }}
                          disabled={holdSaving}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                            checked
                              ? "bg-amber-50 border-amber-400 text-amber-800"
                              : "bg-white border-gray-200 text-gray-600 hover:border-amber-200"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-xs ${
                            checked ? "bg-amber-500 border-amber-500 text-white" : "border-gray-300"
                          }`}>{checked ? "✓" : ""}</span>
                          {rec.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 메모 */}
                <div>
                  <label className={labelClass}>메모 (선택)</label>
                  <textarea
                    value={holdNote}
                    onChange={(e) => setHoldNote(e.target.value)}
                    placeholder="예: 익일 오전 재통화 요청, 고객이 서류 준비 중..."
                    rows={3}
                    className={inputClass + " resize-none"}
                    disabled={holdSaving}
                  />
                </div>

                {/* 예약 요약 */}
                {holdDate && holdRecipients.length > 0 && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <p className="font-semibold mb-1">📋 예약 요약</p>
                    <p>일시: {holdDate} {holdTime}</p>
                    <p>수신: {holdRecipients.map((id) => KAKAO_RECIPIENTS.find((r) => r.id === id)?.label ?? id).join(", ")}</p>
                    {holdNote && <p className="mt-1 text-amber-600">메모: {holdNote}</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="px-3.5 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setHoldModal(null)}
                disabled={holdSaving}
                className={btnSecondary}
              >취소</button>
              <button
                onClick={saveHold}
                disabled={holdSaving}
                className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-all disabled:opacity-50"
              >{holdSaving ? "저장중..." : "⏰ 보류 예약"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}