// pages/HyundaiCM/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ─── 정책 ─────────────────────────────────────────────────
const HIDE_CLOSED_AFTER_DAYS_FOR_NON_ADMIN = 30;
const DOC_DELETE_AFTER_HOURS = 24;   // 확정 후 24시간 경과 시 첨부파일 삭제
const PHONE_MASK_AFTER_HOURS = 24;    // 확정 후 24시간 경과 시 전화번호 마스킹

// ─── 타입 ─────────────────────────────────────────────────
type CustomerType = "개인" | "법인";
type HCMStatus    = "접수" | "신용조회" | "승인" | "보완" | "거절" | "서류등록" | "전자계약발송" | "확정";

type FinanceCompany = "NH캐피탈" | "오릭스캐피탈" | "우리금융캐피탈";

type HCMTask = {
  id: string | number;
  customer_type: CustomerType;
  customer_name: string;
  customer_phone: string | null;
  company_name: string | null;
  equipment_ton: string | null;        // 톤수
  purchase_amount: number | null;      // 차량가격
  installment_principal: number | null; // 할부원금
  finance_company: string | null;      // 할부금융사
  interest_rate: number | null;        // 금리
  incentive: number | null;            // 인센티브
  nice_score: number | null;           // NICE 점수
  credit_rate: number | null;          // 적용금리 (%)
  credit_incentive: number | null;     // 적용인센티브 (%)
  biz_history: string | null;          // 업력 (1년이상/1년미만)
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

// ─── 상태 설정 ────────────────────────────────────────────
const STATUS_ORDER: HCMStatus[] = ["접수", "신용조회", "서류등록", "전자계약발송", "확정"];
const CREDIT_STATUSES: HCMStatus[] = ["승인", "보완", "거절"];

function statusStyle(status: HCMStatus) {
  switch (status) {
    case "접수":     return "bg-gray-100 text-gray-600 border-gray-200";
    case "신용조회": return "bg-orange-50 text-orange-600 border-orange-200";
    case "승인":     return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "보완":     return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "거절":     return "bg-red-50 text-red-600 border-red-200";
    case "서류등록":     return "bg-orange-50 text-orange-700 border-orange-200";
    case "전자계약발송": return "bg-blue-50 text-blue-700 border-blue-200";
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
  { key: "doc_etc",               label: "기타서류",              dbCol: "doc_etc" },
];

// ─── 스타일 상수 ──────────────────────────────────────────
const inputClass =
  "h-[48px] w-full px-4 rounded-2xl border border-gray-200 bg-white text-sm " +
  "font-medium text-navy-900 placeholder:text-gray-400 " +
  "focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 " +
  "disabled:opacity-50 disabled:bg-gray-50 transition-all";

const labelClass = "block text-sm font-medium text-navy-900 mb-2";

const btnPrimary =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-orange-500 " +
  "text-white font-semibold text-sm hover:bg-orange-600 transition-all disabled:opacity-50";

const btnSecondary =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-2xl border border-gray-300 " +
  "bg-white text-navy-900 font-semibold text-sm hover:shadow-md transition-all disabled:opacity-50";

const btnGhost =
  "inline-flex items-center justify-center px-4 py-2 rounded-2xl border border-gray-200 " +
  "bg-white text-sm font-medium text-gray-600 hover:border-gray-300 hover:shadow-sm transition-all disabled:opacity-50";

// ─── 메인 컴포넌트 ────────────────────────────────────────
export default function HyundaiCMPage() {
  const { user, logout, isAdmin, isHyundaiCM, isNhCapital } = useAuth() as any;
  const nav = useNavigate();
  const canCreate              = isAdmin || isHyundaiCM || isNhCapital;
  const canEditExisting        = isAdmin || isNhCapital;
  const canChangeStatus        = isAdmin || isNhCapital;
  const canUploadDoc           = isAdmin || isNhCapital;
  const canUploadVehicleRegDoc = isAdmin || isHyundaiCM || isNhCapital;
  const canDelete              = isAdmin || isNhCapital;

  // ── 신규 접수 폼 ──
  const [customerType,          setCustomerType]          = useState<CustomerType>("개인");
  const [customerName,          setCustomerName]          = useState("");
  const [customerPhone,         setCustomerPhone]         = useState("");
  const [companyName,           setCompanyName]           = useState("");
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

  // ── 수정 모달 ──
  const [editRow,                   setEditRow]                   = useState<HCMTask | null>(null);
  const [editSaving,                setEditSaving]                = useState(false);
  const [editCustomerType,          setEditCustomerType]          = useState<CustomerType>("개인");
  const [editCustomerName,          setEditCustomerName]          = useState("");
  const [editCustomerPhone,         setEditCustomerPhone]         = useState("");
  const [editCompanyName,           setEditCompanyName]           = useState("");
  const [editEquipmentTon,          setEditEquipmentTon]          = useState("");
  const [editPurchaseAmount,        setEditPurchaseAmount]        = useState("");
  const [editInstallmentPrincipal,  setEditInstallmentPrincipal]  = useState("");
  const [editFinanceCompany,        setEditFinanceCompany]        = useState<string>("NH캐피탈");
  const [editInterestRate,          setEditInterestRate]          = useState("");
  const [editIncentive,             setEditIncentive]             = useState("");
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

      // 카카오 알림 (비동기, 실패해도 업무 영향 없음)
      const row = rows.find((r) => String(r.id) === String(rowId));
      if (row) {
        sendKakaoNotify({
          type:         "vehicle_reg_upload",
          caseNo:       caseNoMap[String(rowId)] ?? String(rowId),
          customerName: row.customer_name,
          customerType: row.customer_type,
          equipmentTon: row.equipment_ton,
          salesRep:     row.sales_rep,
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
    const { data, error } = await supabase.storage.from("vehicle-reg-docs").download(path);
    if (error || !data) { alert("다운로드 실패: " + error?.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
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

      const nextRows = (data ?? []) as HCMTask[];
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
    } catch (e: any) {
      setErr(e?.message || "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, [showClosed, isAdmin, isHyundaiCM]); // eslint-disable-line

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
  }, [rows, searchText, statusFilter]);

  const summaryCounts = useMemo(() =>
    STATUS_ORDER.reduce((acc, s) => {
      acc[s] = rows.filter((r) => r.status === s).length;
      return acc;
    }, {} as Record<HCMStatus, number>)
  , [rows]);

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
    setCompanyName(""); setEquipmentTon(""); setPurchaseAmount("");
    setInstallmentPrincipal(""); setFinanceCompany("NH캐피탈");
    setInterestRate(""); setIncentive("");
    setVatDeferred("N"); setVatDeferredAmount("");
    setSalesRep(""); setSpecialNote("");
  };

  const onAdd = async () => {
    if (!canCreate) { alert("신규 입력 권한이 없습니다."); return; }
    if (!customerName.trim())  { alert("고객명을 입력해주세요."); return; }
    if (!customerPhone.trim()) { alert("고객 전화번호를 입력해주세요."); return; }
    
    if (!salesRep.trim())      { alert("영업사원을 입력해주세요."); return; }
    if (customerType === "법인" && !companyName.trim()) { alert("법인명을 입력해주세요."); return; }

    setSaving(true); setErr("");
    try {
      const payload = {
        customer_type:           customerType,
        customer_name:           customerName.trim(),
        customer_phone:          onlyDigits(customerPhone) || null,
        company_name:            customerType === "법인" ? companyName.trim() : null,
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

    // 확정 버튼 클릭 시 → 승인내역 팝업 먼저
    if (next === "확정") {
      setConfirmLoanPrincipal(row.installment_principal != null ? String(row.installment_principal) : "");
      setConfirmLoanPeriod(row.loan_period != null ? String(row.loan_period) : "");
      setConfirmInterestRate(row.interest_rate != null ? String(row.interest_rate) : "");
      setConfirmIncentive(row.incentive != null ? String(row.incentive) : "");
      setConfirmVatAmount(row.vat_deferred_amount != null ? String(row.vat_deferred_amount) : "");
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
      // 카카오 알림 (비동기, 실패해도 업무 영향 없음)
      const kakaoPayload: Record<string, unknown> = {
        type:          "status_change",
        caseNo:        caseNoMap[String(row.id)] ?? String(row.id),
        customerName:  row.customer_name,
        customerType:  row.customer_type,
        equipmentTon:  row.equipment_ton,
        salesRep:      row.sales_rep,
        prevStatus:    row.status,
        nextStatus:    next,
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
        status:           next,
        nice_score:       creditNiceScore.trim() ? parseInt(creditNiceScore, 10) || null : null,
        credit_rate:      creditRate.trim() ? parseFloat(creditRate) || null : null,
        credit_incentive: creditIncentive.trim() ? parseFloat(creditIncentive) || null : null,
        biz_history:      creditBizHistory,
      };
      const { error } = await supabase.from("hyundaicm_tasks").update(patch).eq("id", row.id as any);
      if (error) throw error;
      setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, ...patch } : r));
      setCreditResults((prev) => ({ ...prev, [String(row.id)]: next }));

      // 카카오 알림
      sendKakaoNotify({
        type:             "status_change",
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
        bizHistory:       creditBizHistory,
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
    setEditCompanyName(row.company_name ?? "");
    setEditEquipmentTon(row.equipment_ton ?? "");
    setEditPurchaseAmount(row.purchase_amount != null ? String(row.purchase_amount) : "");
    setEditInstallmentPrincipal(row.installment_principal != null ? String(row.installment_principal) : "");
    setEditFinanceCompany(row.finance_company ?? "NH캐피탈");
    setEditInterestRate(row.interest_rate != null ? String(row.interest_rate) : "");
    setEditIncentive(row.incentive != null ? String(row.incentive) : "");
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
        company_name:           editCustomerType === "법인" ? editCompanyName.trim() : null,
        equipment_ton:          editEquipmentTon.trim() || null,
        purchase_amount:        editPurchaseAmount.trim() ? parseInt(onlyDigits(editPurchaseAmount), 10) || null : null,
        installment_principal:  editInstallmentPrincipal.trim() ? parseInt(onlyDigits(editInstallmentPrincipal), 10) || null : null,
        finance_company:        editFinanceCompany || null,
        interest_rate:          editInterestRate.trim() ? parseFloat(editInterestRate) || null : null,
        incentive:              editIncentive.trim() ? parseFloat(editIncentive) || null : null,
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

      // 카카오 알림 — 확정 전 수정 시만 발송
      if (editRow.status !== "확정") {
        sendKakaoNotify({
          type:                 "edit",
          caseNo:               caseNoMap[String(editRow.id)] ?? String(editRow.id),
          customerName:         patch.customer_name,
          customerType:         patch.customer_type,
          equipmentTon:         patch.equipment_ton ?? "-",
          financeCompany:       patch.finance_company ?? "-",
          installmentPrincipal: patch.installment_principal ? String(patch.installment_principal) : "",
          salesRep:             patch.sales_rep ?? "-",
          prevStatus:           editRow.status,
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
      const { data, error } = await supabase.storage.from("hcm_docs").download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a   = document.createElement("a");
      a.href = url; a.download = `${label}_${path.split("/").pop() ?? "file"}`; a.click();
      URL.revokeObjectURL(url);
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
        if (paths.length > 0) await supabase.storage.from("hcm_docs").remove(paths);
      }
      const { error } = await supabase.from("hyundaicm_tasks").delete().eq("id", rowId as any);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => String(r.id) !== String(rowId)));
      setDeleteConfirmId(null);
    } catch (e: any) { alert(`삭제 실패: ${e?.message}`); }
    finally { setDeleting(false); }
  };

  // ─── JSX ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
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

      {/* ── 히어로 헤더 ── */}
      <section className="relative bg-[#0a192f] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]" aria-hidden="true"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-12 md:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">Business</p>
              <h1 className="mt-3 text-3xl md:text-4xl font-semibold leading-[1.15] text-white break-keep">
                현대건설기계 업무
              </h1>
              <p className="mt-3 text-base leading-7 text-white/75 break-keep">
                건설기계 할부금융 신용조회 및 서류관리
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => nav("/hyundaicm/kakao-connect")}
                title="카카오톡 알림 설정"
                className="inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => { if (window.confirm("로그아웃 하시겠습니까?")) logout(); }}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">

        {/* ── 상태 요약 뱃지 ── */}
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter((prev) => prev === s ? "all" : s)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-2xl border text-xs font-semibold transition-all
                ${statusStyle(s)}
                ${statusFilter === s ? "ring-2 ring-offset-2 ring-orange-300/60 shadow-sm" : "hover:shadow-sm"}`}
            >
              {s} <span className="opacity-70">({summaryCounts[s] ?? 0})</span>
            </button>
          ))}
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="px-4 py-1.5 rounded-2xl border border-gray-200 bg-white text-xs font-semibold text-gray-500 hover:shadow-sm transition-all"
            >
              전체 보기
            </button>
          )}
        </div>

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
              className={`inline-flex items-center justify-center px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all
                ${showClosed ? "bg-orange-50 border-orange-200 text-orange-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
            >
              {showClosed ? "종료 건 숨기기" : "종료 건 포함"}
            </button>
          )}
          <button onClick={fetchRows} disabled={loading} className={`${btnGhost} ml-auto`}>
            {loading ? "로딩중..." : "새로고침"}
          </button>
        </div>

        {/* ── 검색 패널 ── */}
        {showSearchPanel && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid sm:grid-cols-2 gap-4">
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
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">New</p>
                <h2 className="mt-1 text-xl font-semibold text-navy-900">신규 접수</h2>
              </div>
              <button
                onClick={() => { setShowCreatePanel(false); onReset(); }}
                className="h-9 w-9 rounded-2xl border border-gray-200 text-gray-500 hover:border-gray-300 text-xl font-bold transition-all"
              >×</button>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                  <label className={labelClass}>법인명 *</label>
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="(주)현대건설" className={inputClass} />
                </div>
              )}
              <div>
                <label className={labelClass}>톤수</label>
                <input value={equipmentTon} onChange={(e) => setEquipmentTon(e.target.value)} placeholder="예: 20톤" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>차량가격 (원)</label>
                <input value={purchaseAmount} onChange={(e) => setPurchaseAmount(onlyDigits(e.target.value))} placeholder="150000000" inputMode="numeric" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>할부원금 (원)</label>
                <input value={installmentPrincipal} onChange={(e) => setInstallmentPrincipal(onlyDigits(e.target.value))} placeholder="120000000" inputMode="numeric" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>할부금융사</label>
                <select value={financeCompany} onChange={(e) => setFinanceCompany(e.target.value)} className={inputClass}>
                  <option value="NH캐피탈">NH캐피탈</option>
                  <option value="오릭스캐피탈">오릭스캐피탈</option>
                  <option value="우리금융캐피탈">우리금융캐피탈</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>금리 (%)</label>
                <input value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="예: 4.5" inputMode="decimal" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>인센티브 (%)</label>
                <input value={incentive} onChange={(e) => setIncentive(e.target.value)} placeholder="예: 1.2" inputMode="decimal" className={inputClass} />
              </div>
              {/* 부가세 후불 */}
              <div>
                <label className={labelClass}>부가세 후불</label>
                <div className="flex gap-2 h-[48px]">
                  {(["Y", "N"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setVatDeferred(v); if (v === "N") setVatDeferredAmount(""); }}
                      className={`flex-1 rounded-2xl border text-sm font-semibold transition-all ${
                        vatDeferred === v
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:border-orange-300"
                      }`}
                    >{v}</button>
                  ))}
                </div>
              </div>
              {vatDeferred === "Y" && (
                <div>
                  <label className={labelClass}>부가세 후불금액 (원)</label>
                  <input value={vatDeferredAmount} onChange={(e) => setVatDeferredAmount(onlyDigits(e.target.value))} placeholder="예: 15000000" inputMode="numeric" className={inputClass} />
                </div>
              )}
              <div>
                <label className={labelClass}>영업사원 *</label>
                <input value={salesRep} onChange={(e) => setSalesRep(e.target.value)} placeholder="홍길동" className={inputClass} />
              </div>

            </div>

            <div className="mt-4">
              <label className={labelClass}>특이사항</label>
              <textarea
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder="고객 요청사항, 특이사항, 신용조회 관련 메모..."
                className="w-full min-h-[80px] px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all"
              />
            </div>

            {err && (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">{err}</div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setShowCreatePanel(false); onReset(); }} disabled={saving} className={btnSecondary}>취소</button>
              <button onClick={onAdd} disabled={saving} className={btnPrimary}>{saving ? "등록중..." : "접수 등록"}</button>
            </div>
          </div>
        )}

        {/* ── 카드 목록 ── */}
        {loading && <div className="py-12 text-center text-sm text-gray-400">로딩 중...</div>}

        {!loading && filteredRows.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
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
              <div key={r.id} className={`rounded-2xl border bg-white shadow-sm transition-all overflow-hidden ${
                r.status === "거절" ? "border-red-200" :
                r.status === "확정" ? "border-emerald-200" :
                "border-gray-200 hover:shadow-md"
              }`}>

                {/* 카드 헤더 */}
                <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 font-mono">
                      {caseNoMap[String(r.id)] ?? "-"}
                    </span>
                    <span className="text-base font-semibold text-navy-900">
                      {r.customer_name}{r.company_name ? ` (${r.company_name})` : ""}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-2xl border border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
                      {r.customer_type}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-2xl border text-xs font-semibold ${statusStyle(r.status)}`}>
                      {r.status}
                    </span>
                    {shouldMaskPhone(r) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-2xl bg-gray-100 border border-gray-200 text-gray-400 text-[10px] font-medium">
                        개인정보 마스킹
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isConfirmed && (
                      <button
                        onClick={() => toggleExpand(r.id)}
                        className={`inline-flex items-center justify-center px-4 py-2 rounded-2xl border text-sm font-medium transition-all ${
                          r.status === "거절"
                            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {isExpanded ? "접기 ↑" : "펼치기 ↓"}
                      </button>
                    )}
                    <button onClick={() => openEditModal(r)} className={btnGhost}>수정</button>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteConfirmId(r.id)}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-2xl border border-red-100 bg-white text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
                      >삭제</button>
                    )}
                  </div>
                </div>

                {/* 카드 바디 — 확정 상태면 펼쳤을 때만 표시 */}
                {(!isConfirmed || isExpanded) && (
                <div className="px-6 py-5 grid md:grid-cols-2 gap-6">
                  {/* 왼쪽: 기본 정보 */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "전화번호",   value: getDisplayPhone(r) },
                        { label: "할부금융사", value: r.finance_company ?? "-" },
                        { label: "톤수",       value: r.equipment_ton ?? "-" },
                        { label: "차량가격",   value: formatAmount(r.purchase_amount) },
                        { label: "할부원금",   value: formatAmount(r.installment_principal) },
                        { label: "선수율",     value: (r.purchase_amount && r.installment_principal != null)
                            ? `${(((r.purchase_amount - r.installment_principal) / r.purchase_amount) * 100).toFixed(1)}%`
                            : "-" },
                        { label: "금리",       value: r.interest_rate != null ? `${r.interest_rate}%` : "-" },
                        { label: "인센티브",   value: r.incentive != null ? `${r.incentive}%` : "-" },
                        { label: "부가세후불", value: r.vat_deferred ? `Y${r.vat_deferred_amount != null ? " / " + formatAmount(r.vat_deferred_amount) : ""}` : "N" },
                        { label: "대출기간",   value: r.loan_period != null ? `${r.loan_period}개월` : "-" },
                        { label: "영업사원",   value: r.sales_rep ?? "-" },
                        { label: "접수일시",   value: formatCreatedAt(r.created_at) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">{label}</p>
                          <p className="mt-1 text-sm font-semibold text-navy-900 break-all">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* 신용결과 상세 */}
                    {(r.nice_score != null || r.credit_rate != null || r.credit_incentive != null || r.biz_history) && (
                      <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 grid grid-cols-2 gap-2">
                        <p className="col-span-2 text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">신용결과 상세</p>
                        {r.nice_score != null && (
                          <div>
                            <p className="text-xs text-gray-400">NICE 점수</p>
                            <p className="text-sm font-semibold text-navy-900">{r.nice_score}점</p>
                          </div>
                        )}
                        {r.credit_rate != null && (
                          <div>
                            <p className="text-xs text-gray-400">적용금리</p>
                            <p className="text-sm font-semibold text-navy-900">{r.credit_rate}%</p>
                          </div>
                        )}
                        {r.credit_incentive != null && (
                          <div>
                            <p className="text-xs text-gray-400">적용인센티브</p>
                            <p className="text-sm font-semibold text-navy-900">{r.credit_incentive}%</p>
                          </div>
                        )}
                        {r.biz_history && (
                          <div>
                            <p className="text-xs text-gray-400">업력</p>
                            <p className="text-sm font-semibold text-navy-900">{r.biz_history}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 진행 단계 */}
                    <div>
                      <p className="text-xs font-medium tracking-wide text-gray-400 uppercase mb-2">진행 단계</p>
                      <div className="flex flex-wrap gap-1.5">
                        {/* 접수, 신용조회 버튼 */}
                        {["접수", "신용조회"].map((s) => (
                          <button
                            key={s}
                            disabled={!canChangeStatus || r.status === s}
                            onClick={() => changeStatus(r, s as HCMStatus)}
                            className={`px-3 py-1 rounded-2xl border text-xs font-semibold transition-all
                              ${r.status === s
                                ? statusStyle(s as HCMStatus) + " ring-2 ring-offset-1 ring-orange-200/60"
                                : "bg-white border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              }`}
                          >{s}</button>
                        ))}

                        {/* 신용결과 드롭다운 (승인/보완/거절) */}
                        <div className="relative">
                          <select
                            disabled={!canChangeStatus}
                            value={CREDIT_STATUSES.includes(r.status as any) ? r.status : (creditResults[String(r.id)] ?? "")}
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const next = e.target.value as HCMStatus;
                              // 기존 신용결과 값 미리 채우기
                              setCreditNiceScore(r.nice_score != null ? String(r.nice_score) : "");
                              setCreditRate(r.credit_rate != null ? String(r.credit_rate) : "");
                              setCreditIncentive(r.credit_incentive != null ? String(r.credit_incentive) : "");
                              setCreditBizHistory((r.biz_history as any) ?? "1년이상");
                              setCreditModal({ row: r, next });
                            }}
                            className={`px-3 py-1 rounded-2xl border text-xs font-semibold transition-all appearance-none pr-6 cursor-pointer
                              ${CREDIT_STATUSES.includes(r.status as any)
                                ? statusStyle(r.status) + " ring-2 ring-offset-1 ring-orange-200/60"
                                : creditResults[String(r.id)]
                                  ? statusStyle(creditResults[String(r.id)]!) + " opacity-70"
                                  : "bg-white border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              }`}
                          >
                            <option value="" disabled>신용결과 ▾</option>
                            {CREDIT_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        {/* 서류등록, 확정 버튼 */}
                        {["서류등록", "전자계약발송", "확정"].map((s) => (
                          <button
                            key={s}
                            disabled={!canChangeStatus || r.status === s}
                            onClick={() => changeStatus(r, s as HCMStatus)}
                            className={`px-3 py-1 rounded-2xl border text-xs font-semibold transition-all
                              ${r.status === s
                                ? statusStyle(s as HCMStatus) + " ring-2 ring-offset-1 ring-orange-200/60"
                                : "bg-white border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              }`}
                          >{s}</button>
                        ))}

                        {/* 차량등록증 업로드 버튼 — 확정 상태일 때만 표시 */}
                        {r.status === "확정" && canUploadVehicleRegDoc && (
                          <button
                            disabled={vehicleRegUploading === String(r.id)}
                            onClick={() => {
                              vehicleRegInputRef.current?.setAttribute("data-row-id", String(r.id));
                              vehicleRegInputRef.current?.click();
                            }}
                            className="px-3 py-1 rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-all"
                          >
                            {vehicleRegUploading === String(r.id) ? "업로드중..." : "+ 차량등록증"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 증빙서류 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">증빙서류</p>
                      {docExpired && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-2xl bg-gray-100 border border-gray-200 text-gray-400 text-xs font-semibold">
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
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                                    ✓ 완료
                                  </span>
                                  <button onClick={() => downloadDoc(path, f.label)} className="px-3 py-1 rounded-2xl border border-gray-200 text-gray-600 text-xs font-medium hover:border-navy-900 hover:text-navy-900 transition-all">
                                    다운로드
                                  </button>
                                  {canUploadDoc && (
                                    <button disabled={isUploading} onClick={() => triggerDocUpload(r.id, f.key, f.dbCol, f.label)} className="px-3 py-1 rounded-2xl border border-gray-200 text-gray-400 text-xs font-medium hover:border-orange-200 hover:text-orange-600 disabled:opacity-50 transition-all">
                                      {isUploading ? "..." : "재업로드"}
                                    </button>
                                  )}
                                </>
                              ) : (
                                <button disabled={isUploading || !canUploadDoc} onClick={() => triggerDocUpload(r.id, f.key, f.dbCol, f.label)} className="px-3 py-1 rounded-2xl border border-gray-200 text-gray-500 text-xs font-medium hover:border-orange-300 hover:text-orange-600 disabled:opacity-50 transition-all">
                                  {isUploading ? "업로드중..." : "+ 업로드"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                )}

                {/* 차량등록증 파일 목록 — 확정 상태이고 펼쳐진 경우에만 표시 */}
                {r.status === "확정" && (!isConfirmed || isExpanded) && canUploadVehicleRegDoc && (
                <div className="px-6 pb-5 border-t border-emerald-100 pt-4">
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
                          <div key={idx} className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-emerald-800 truncate">{f.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {formatCreatedAt(f.uploadedAt)} 업로드 &nbsp;·&nbsp;
                                <span className={hoursLeft < 6 ? "text-red-500 font-semibold" : "text-gray-400"}>
                                  {hoursLeft}시간 후 자동삭제
                                </span>
                              </p>
                            </div>
                            {(isAdmin || isNhCapital) && (
                            <button
                              onClick={() => downloadVehicleRegDoc(f.path, f.name)}
                              className="shrink-0 px-3 py-1 rounded-2xl border border-emerald-200 text-emerald-700 text-xs font-medium hover:border-emerald-400 transition-all"
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

                {/* 메모 — 확정 시 펼쳤을 때만 표시 */}
                {(!isConfirmed || isExpanded) && (
                <div className="px-6 pb-5 border-t border-gray-100 pt-4">
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
                    className="w-full h-[72px] text-sm text-gray-700 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-2.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all"
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
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-6">
              <div>
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">Edit</p>
                <h2 className="mt-1 text-xl font-semibold text-navy-900">기본정보 수정</h2>
                <p className="mt-1 text-sm text-gray-500">고객 정보 및 장비/금융 정보를 수정합니다.</p>
              </div>
              <button onClick={closeEditModal} disabled={editSaving} className="h-9 w-9 rounded-2xl border border-gray-200 text-xl font-bold text-gray-500 hover:border-gray-300 disabled:opacity-50 transition-all">×</button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>고객 유형</label><select value={editCustomerType} onChange={(e) => setEditCustomerType(e.target.value as CustomerType)} className={inputClass} disabled={editSaving}><option value="개인">개인</option><option value="법인">법인</option></select></div>
              <div><label className={labelClass}>고객명 *</label><input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} className={inputClass} disabled={editSaving} placeholder="홍길동" /></div>
              <div><label className={labelClass}>전화번호</label><input value={editCustomerPhone} onChange={(e) => setEditCustomerPhone(formatPhoneKR(e.target.value))} className={inputClass} disabled={editSaving} inputMode="tel" /></div>
              {editCustomerType === "법인" && <div><label className={labelClass}>법인명</label><input value={editCompanyName} onChange={(e) => setEditCompanyName(e.target.value)} className={inputClass} disabled={editSaving} /></div>}
              <div><label className={labelClass}>톤수</label><input value={editEquipmentTon} onChange={(e) => setEditEquipmentTon(e.target.value)} className={inputClass} disabled={editSaving} placeholder="예: 20톤" /></div>
              <div><label className={labelClass}>차량가격 (원)</label><input value={editPurchaseAmount} onChange={(e) => setEditPurchaseAmount(onlyDigits(e.target.value))} className={inputClass} disabled={editSaving} inputMode="numeric" /></div>
              <div><label className={labelClass}>할부원금 (원)</label><input value={editInstallmentPrincipal} onChange={(e) => setEditInstallmentPrincipal(onlyDigits(e.target.value))} className={inputClass} disabled={editSaving} inputMode="numeric" /></div>
              <div><label className={labelClass}>할부금융사</label><select value={editFinanceCompany} onChange={(e) => setEditFinanceCompany(e.target.value)} className={inputClass} disabled={editSaving}><option value="NH캐피탈">NH캐피탈</option><option value="오릭스캐피탈">오릭스캐피탈</option><option value="우리금융캐피탈">우리금융캐피탈</option></select></div>
              <div><label className={labelClass}>금리 (%)</label><input value={editInterestRate} onChange={(e) => setEditInterestRate(e.target.value)} className={inputClass} disabled={editSaving} placeholder="예: 4.5" inputMode="decimal" /></div>
              <div><label className={labelClass}>인센티브 (%)</label><input value={editIncentive} onChange={(e) => setEditIncentive(e.target.value)} className={inputClass} disabled={editSaving} placeholder="예: 1.2" inputMode="decimal" /></div>
              <div><label className={labelClass}>영업사원</label><input value={editSalesRep} onChange={(e) => setEditSalesRep(e.target.value)} className={inputClass} disabled={editSaving} /></div>
              <div><label className={labelClass}>ID</label><input value={String(editRow.id)} readOnly className={inputClass + " !bg-gray-50 !text-gray-400 cursor-not-allowed"} /></div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>특이사항</label>
              <textarea value={editSpecialNote} onChange={(e) => setEditSpecialNote(e.target.value)} placeholder="신용조회 결과, 금융사 조건, 특이사항..." className="min-h-[90px] w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all" disabled={editSaving} />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeEditModal} disabled={editSaving} className={btnSecondary}>취소</button>
              <button onClick={saveEditRow} disabled={editSaving} className={btnPrimary}>{editSaving ? "저장중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteConfirmId != null && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500 mb-2">Delete</p>
            <h2 className="text-xl font-semibold text-navy-900 mb-3">건 삭제 확인</h2>
            <p className="text-sm leading-6 text-gray-600">
              이 건의 <strong>모든 데이터 및 서류 파일이 영구 삭제</strong>됩니다.<br />삭제 후 복구가 불가능합니다.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmId(null)} disabled={deleting} className={btnSecondary}>취소</button>
              <button
                onClick={() => deleteRow(deleteConfirmId)}
                disabled={deleting}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all disabled:opacity-50"
              >{deleting ? "삭제중..." : "영구 삭제"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 확정 승인내역 입력 모달 ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-medium tracking-[0.12em] uppercase text-emerald-600 mb-2">확정 처리</p>
            <h2 className="text-xl font-semibold text-navy-900 mb-1">최종 승인내역 입력</h2>
            <p className="text-sm text-gray-500 mb-1">
              {confirmModal.customer_name} ({confirmModal.customer_type})
            </p>
            <p className="text-xs text-orange-500 mb-5">입력 값이 기존 접수 정보를 대체합니다.</p>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>대출원금 (원)</label>
                <input type="text" value={confirmLoanPrincipal} onChange={(e) => setConfirmLoanPrincipal(onlyDigits(e.target.value))} placeholder="예: 120000000" inputMode="numeric" className={inputClass} disabled={confirmSaving} />
                {confirmLoanPrincipal && <p className="mt-1 text-xs text-gray-400">{parseInt(confirmLoanPrincipal).toLocaleString("ko-KR")}원</p>}
              </div>
              <div>
                <label className={labelClass}>대출기간 (개월)</label>
                <input type="number" value={confirmLoanPeriod} onChange={(e) => setConfirmLoanPeriod(e.target.value)} placeholder="예: 60" inputMode="numeric" className={inputClass} disabled={confirmSaving} />
              </div>
              <div>
                <label className={labelClass}>금리 (%)</label>
                <input type="number" value={confirmInterestRate} onChange={(e) => setConfirmInterestRate(e.target.value)} placeholder="예: 4.5" inputMode="decimal" step="0.01" className={inputClass} disabled={confirmSaving} />
              </div>
              <div>
                <label className={labelClass}>인센티브 (%)</label>
                <input type="number" value={confirmIncentive} onChange={(e) => setConfirmIncentive(e.target.value)} placeholder="예: 1.2" inputMode="decimal" step="0.01" className={inputClass} disabled={confirmSaving} />
              </div>
              <div>
                <label className={labelClass}>부가세 후불금액 (원)</label>
                <input type="text" value={confirmVatAmount} onChange={(e) => setConfirmVatAmount(onlyDigits(e.target.value))} placeholder="해당 없으면 비워두세요" inputMode="numeric" className={inputClass} disabled={confirmSaving} />
                {confirmVatAmount && <p className="mt-1 text-xs text-gray-400">{parseInt(confirmVatAmount).toLocaleString("ko-KR")}원</p>}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmModal(null)} disabled={confirmSaving} className={btnSecondary}>취소</button>
              <button onClick={saveConfirmModal} disabled={confirmSaving} className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50">
                {confirmSaving ? "처리중..." : "확정 완료"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 신용결과 상세 입력 모달 ── */}
      {creditModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500 mb-2">신용결과</p>
            <h2 className="text-xl font-semibold text-navy-900 mb-1">
              {creditModal.next} 처리
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              {creditModal.row.customer_name} ({creditModal.row.customer_type})
            </p>

            <div className="space-y-4">
              {/* 업력 */}
              <div>
                <label className={labelClass}>업력</label>
                <div className="flex gap-2">
                  {(["1년이상", "1년미만"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCreditBizHistory(v)}
                      className={`flex-1 py-2.5 rounded-2xl border text-sm font-semibold transition-all ${
                        creditBizHistory === v
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:border-orange-300"
                      }`}
                    >{v}</button>
                  ))}
                </div>
              </div>

              {/* NICE 점수 */}
              <div>
                <label className={labelClass}>NICE 점수</label>
                <input
                  type="number"
                  value={creditNiceScore}
                  onChange={(e) => setCreditNiceScore(e.target.value)}
                  placeholder="예: 742"
                  inputMode="numeric"
                  className={inputClass}
                  disabled={creditSaving}
                />
              </div>

              {/* 적용금리 */}
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

              {/* 적용인센티브 */}
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
            </div>

            <div className="mt-6 flex justify-end gap-3">
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
    </div>
  );
}