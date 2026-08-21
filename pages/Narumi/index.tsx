import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import AppTabBar from "../../components/AppTabBar";

import { useNavigate, useSearchParams } from "react-router-dom";

// 정책
const UI_MASK_AFTER_HOURS = 120;
const DB_SCRUB_AFTER_HOURS = 120;
const COMPLETION_MASK_AFTER_HOURS = 48; // 등록완료(차량등록증 업로드) 후 마스킹까지의 유예시간
const HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN = 30;

type TaskStatus =
  | "todo"
  | "insurance"
  | "docs"
  | "registered"
  | "completed";

type NarumiTask = {
  id: string | number;
  vin: string;
  vin_last6: string | null;
  delivery_date_text: string | null;
  is_lotte_autolease: boolean;
  has_insurance: boolean;
  docs_ready: boolean;
  is_registering: boolean;
  is_registered: boolean;
  status?: TaskStatus | string | null;
  memo?: string | null;
  special_note: string | null;
  customer_name?: string | null;
  created_at?: string;
  vehicle_doc_path?: string | null;
  vehicle_doc_uploaded_at?: string | null;
  manufacture_doc_path?: string | null;
  customer_phone?: string | null;
  customer_phone_set_at?: string | null;
  customer_phone_scrubbed_at?: string | null;
  on_hold?: boolean | null;
  sales_rep?: string | null;
  sales_rep_phone?: string | null;
  vehicle_use_type?: string | null;
  postal_mail_sent?: boolean | null;
  postal_tracking_no?: string | null;
  postal_sent_date?: string | null;
  case_no?: string | null;
  finance_type?: string | null;
  lease_company?: string | null;
  business_type?: string | null;
  temp_plate_returned?: boolean | null;
  temp_plate_return_due_date?: string | null;
  is_plate_brokerage?: boolean | null;
  brokerage_result?: string | null;
  is_dispatched?: boolean | null;
  registered_at?: string | null;
};

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function normalizeVin(v: string) {
  return (v ?? "").trim().toUpperCase();
}

// "2026.07.16" ↔ "2026-07-16" — 네이티브 <input type="date"> 달력 위젯과 기존 YYYY.MM.DD 문자열 저장 형식을 서로 변환
function dotsToDateInputValue(text: string): string {
  const digits = onlyDigits(text);
  if (digits.length !== 8) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function dateInputValueToDots(value: string): string {
  return value.replace(/-/g, ".");
}

function vinLast6(vin: string) {
  const v = (vin ?? "").trim();
  if (!v) return "";
  return v.slice(-6);
}

function parseDeliveryDateToUTCDate(text: string | null | undefined): Date | null {
  const digits = onlyDigits(text ?? "");
  if (digits.length !== 8) return null;
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// 출고 예정일까지 남은 일수가 1일 이하(오늘·내일)이거나 이미 지난 경우 긴급으로 간주
function isUrgentDelivery(text: string | null | undefined): boolean {
  const deliveryDate = parseDeliveryDateToUTCDate(text);
  if (!deliveryDate) return false;
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayUTC = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()));
  const diffDays = Math.round((deliveryDate.getTime() - todayUTC.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays <= 1;
}

function isAllDone(t: NarumiTask) {
  return !!(t.has_insurance && t.docs_ready && t.is_registered);
}

function isClosingDone(t: Pick<NarumiTask, "is_registered" | "vehicle_doc_path">) {
  return !!(t.is_registered && t.vehicle_doc_path);
}

function isOnHold(row: Pick<NarumiTask, "on_hold">) {
  return !!row.on_hold;
}

// 번호판 중개 건이 아직 '출고' 처리 전인 경우 — VIN/보험 등 정규 필드가 비어있으므로 일반 단계 집계에서 제외
function isBrokeragePending(row: Pick<NarumiTask, "is_plate_brokerage" | "is_dispatched">) {
  return !!row.is_plate_brokerage && !row.is_dispatched;
}

function extFromName(name: string) {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

function safeFileBase(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function formatPhoneKR(raw: string) {
  const d = onlyDigits(raw).slice(0, 11);

  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function maskLast4(phone: string) {
  const digits = onlyDigits(phone);
  if (digits.length < 8) return phone;
  const head = digits.slice(0, digits.length - 4);
  return `${head}****`;
}

function formatPhonePrettyFromDigits(digitsOnly: string) {
  const d = (digitsOnly ?? "").slice(0, 11);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return digitsOnly;
}

function shouldMaskPhoneForUI(r: NarumiTask) {
  if (r.customer_phone_scrubbed_at) return true;

  // 등록완료(차량등록증 업로드) 후에는 즉시가 아니라 48시간 유예 후 마스킹한다.
  // 업로드 시각 기록이 없는 과거 데이터(vehicle_doc_uploaded_at 컬럼 도입 이전)는
  // 안전하게 기존과 동일하게 즉시 마스킹 상태를 유지한다.
  if (r.vehicle_doc_path) {
    if (!r.vehicle_doc_uploaded_at) return true;
    const uploadedAt = new Date(r.vehicle_doc_uploaded_at).getTime();
    if (Number.isNaN(uploadedAt)) return true;
    const hoursSinceUpload = (Date.now() - uploadedAt) / (1000 * 60 * 60);
    return hoursSinceUpload >= COMPLETION_MASK_AFTER_HOURS;
  }

  if (!r.customer_phone_set_at) return false;
  const setAt = new Date(r.customer_phone_set_at).getTime();
  if (Number.isNaN(setAt)) return false;
  const hours = (Date.now() - setAt) / (1000 * 60 * 60);
  return hours >= UI_MASK_AFTER_HOURS;
}

function getDisplayPhone(r: NarumiTask) {
  const raw = (r.customer_phone ?? "").trim();
  if (!raw) return "-";

  const digits = onlyDigits(raw);
  const pretty = formatPhonePrettyFromDigits(digits);

  if (!shouldMaskPhoneForUI(r)) return pretty;

  const maskedDigits = maskLast4(digits);
  return formatPhonePrettyFromDigits(maskedDigits);
}

function getDialablePhone(r: NarumiTask) {
  return onlyDigits(r.customer_phone ?? "").slice(0, 11);
}

// 정책: 일정 시간 경과 후에도 고객명은 계속 공개, 전화번호만 마스킹 대상
function getDisplayCustomerName(r: NarumiTask) {
  const raw = (r.customer_name ?? "").trim();
  return raw || "-";
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function deriveStatus(
  row: Pick<
    NarumiTask,
    "has_insurance" | "docs_ready" | "is_registered" | "vehicle_doc_path"
  >
): TaskStatus {
  if (row.vehicle_doc_path) return "completed";
  if (row.is_registered) return "registered";
  if (row.docs_ready) return "docs";
  if (row.has_insurance) return "insurance";
  return "todo";
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "insurance":
      return "보험";
    case "docs":
      return "등록서류";
    case "registered":
      return "등록완료";
    case "completed":
      return "차량등록증 완료";
    case "todo":
    default:
      return "접수";
  }
}

function formatCreatedAt(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${hh}:${mm}`;
}


// ─── 디자인 시스템 (타이어 페이지 기준) ──────────────────────
const pillBase =
  "inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border";
const pillDone = "bg-emerald-50 text-emerald-700 border-emerald-200";
const pillProg = "bg-orange-50 text-orange-700 border-orange-200";
const pillGray = "bg-gray-100 text-gray-500 border-gray-200";

const btnBase =
  "w-[88px] h-[40px] inline-flex items-center justify-center px-2 py-1 rounded-xl text-xs font-semibold border transition-all text-center whitespace-nowrap shrink-0";
const btnOn = "bg-navy-900 text-white border-navy-900";
const btnOff =
  "bg-white text-navy-900 border-gray-200 hover:border-orange-300 hover:text-orange-600";
const btnDisabled = "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-50";

const labelClass = "block text-sm font-medium text-navy-900 mb-2";
const compactInputClass =
  "h-[48px] w-full px-4 rounded-xl border border-gray-200 bg-white " +
  "text-sm font-medium text-navy-900 placeholder:text-gray-400 " +
  "focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 " +
  "disabled:opacity-50 transition-all";

const compactButtonClass =
  "h-[48px] w-full px-4 rounded-xl border border-gray-200 bg-white " +
  "text-sm font-medium text-navy-900 hover:border-orange-300 disabled:opacity-60 transition-all";

const cardClass = "border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-all";

const infoLabel = "text-xs font-medium tracking-wide text-gray-400 uppercase";
const infoValue = "mt-1 text-sm font-semibold text-navy-900 break-all";
const summaryBadgeBase =
  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-semibold whitespace-nowrap";

type SummaryFilter = "all" | "hold" | "insurance_waiting" | "docs_waiting" | "register_waiting" | "completed";

type SummaryBadgeProps = {
  label: string;
  count: number;
  className: string;
  active?: boolean;
  onClick?: () => void;
};

function SummaryBadge({ label, count, className, active = false, onClick }: SummaryBadgeProps) {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`${summaryBadgeBase} ${className} ${onClick ? "hover:brightness-95 transition-all cursor-pointer" : ""} ${active ? "ring-2 ring-offset-2 ring-navy-900/20 shadow-sm" : ""}`.trim()}
      aria-pressed={onClick ? active : undefined}
      title={onClick ? `${label} 목록만 보기` : undefined}
    >
      <span>{label}</span>
      <span>({count}개)</span>
    </Comp>
  );
}

function isSummaryHold(row: NarumiTask) {
  return isOnHold(row);
}

function isSummaryCompleted(row: NarumiTask) {
  return !isSummaryHold(row) && isClosingDone(row);
}

function isSummaryInsuranceWaiting(row: NarumiTask) {
  return !isSummaryHold(row) && !isSummaryCompleted(row) && !isBrokeragePending(row) && !row.has_insurance;
}

function isSummaryDocsWaiting(row: NarumiTask) {
  return !isSummaryHold(row) && !isSummaryCompleted(row) && !isBrokeragePending(row) && !row.docs_ready;
}

function isSummaryRegisterWaiting(row: NarumiTask) {
  return (
    !isBrokeragePending(row) &&
    !isSummaryHold(row) &&
    !isSummaryCompleted(row) &&
    !!row.has_insurance &&
    !!row.docs_ready
  );
}

function matchesSummaryFilter(
  row: NarumiTask,
  filter: Exclude<SummaryFilter, "all">
) {
  switch (filter) {
    case "hold":
      return isSummaryHold(row);
    case "completed":
      return isSummaryCompleted(row);
    case "insurance_waiting":
      return isSummaryInsuranceWaiting(row);
    case "docs_waiting":
      return isSummaryDocsWaiting(row);
    case "register_waiting":
      return isSummaryRegisterWaiting(row);
    default:
      return true;
  }
}

export default function NarumiPage() {
  const {
    user,
    logout,
    isAdmin,
    isNarumi,
    isInsAI,
    isLotte,
    isInsuranceManager,
    canViewAll,
    canCreate,
    canEditExisting,
    canChangeStatus,
    canEditMemo,
    canUploadVehicleDoc,
  } = useAuth() as any;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("id"); // AI비서에서 딜 클릭 시 전달되는 id
  const isPrivilegedManager = isAdmin || isInsuranceManager;

  const [vin, setVin] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryText, setDeliveryText] = useState("");
  const [lotte, setLotte] = useState<boolean>(false);
  const [salesRep, setSalesRep] = useState("");
  const [salesRepPhone, setSalesRepPhone] = useState("");
  const [vehicleUseType, setVehicleUseType] = useState<"영업용" | "자가용">("자가용");
  const [specialNote, setSpecialNote] = useState("");

  const [financeType, setFinanceType] = useState<"" | "할부" | "리스" | "현금">("");
  const [leaseCompany, setLeaseCompany] = useState("");
  const [businessType, setBusinessType] = useState<"" | "개별" | "용달" | "지입">("");
  const [tempPlateReturned, setTempPlateReturned] = useState<boolean | null>(null);
  const [tempPlateReturnDueDate, setTempPlateReturnDueDate] = useState("");
  const [isPlateBrokerage, setIsPlateBrokerage] = useState(false);

  const [manufactureImageFile, setManufactureImageFile] = useState<File | null>(null);

  const [rows, setRows] = useState<NarumiTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("all");
  const [showOldUploaded, setShowOldUploaded] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [reportMonth, setReportMonth] = useState(() => {
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return kstNow.toISOString().slice(0, 7); // YYYY-MM
  });

  const [uploadingId, setUploadingId] = useState<string | number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manufactureInputRef = useRef<HTMLInputElement | null>(null);
  const rowManufactureInputRef = useRef<HTMLInputElement | null>(null);

  const [pendingUploadRowId, setPendingUploadRowId] = useState<string | number | null>(null);
  const [pendingManufactureUploadRowId, setPendingManufactureUploadRowId] = useState<string | number | null>(null);
  const [manufactureUploadingId, setManufactureUploadingId] = useState<string | number | null>(null);
  const [insuranceModalRow, setInsuranceModalRow] = useState<NarumiTask | null>(null);
  const [postalOpenRowId, setPostalOpenRowId] = useState<string | number | null>(null);
  const [postalTrackingNo, setPostalTrackingNo] = useState("");
  const [postalSentDate, setPostalSentDate] = useState("");
  const [postalSavingId, setPostalSavingId] = useState<string | number | null>(null);

  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const [memoSavingId, setMemoSavingId] = useState<string | number | null>(null);

  const [editRow, setEditRow] = useState<NarumiTask | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editVin, setEditVin] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editSalesRep, setEditSalesRep] = useState("");
  const [editSalesRepPhone, setEditSalesRepPhone] = useState("");
  const [editVehicleUseType, setEditVehicleUseType] = useState<"영업용" | "자가용">("자가용");
  const [editSpecialNote, setEditSpecialNote] = useState("");

  // ── 번호판 중개 건 → '출고' 처리(정식 건 전환) 모달 ──
  const [dispatchRow, setDispatchRow] = useState<NarumiTask | null>(null);
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const [dispatchVin, setDispatchVin] = useState("");
  const [dispatchDeliveryText, setDispatchDeliveryText] = useState("");
  const [dispatchFinanceType, setDispatchFinanceType] = useState<"" | "할부" | "리스" | "현금">("");
  const [dispatchLotte, setDispatchLotte] = useState<boolean>(false);
  const [dispatchLeaseCompany, setDispatchLeaseCompany] = useState("");
  const [dispatchBusinessType, setDispatchBusinessType] = useState<"" | "개별" | "용달" | "지입">("");
  const [dispatchTempPlateReturned, setDispatchTempPlateReturned] = useState<boolean | null>(null);
  const [dispatchTempPlateReturnDueDate, setDispatchTempPlateReturnDueDate] = useState("");
  const [dispatchSalesRep, setDispatchSalesRep] = useState("");
  const [dispatchSalesRepPhone, setDispatchSalesRepPhone] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    setErr("");

    try {
      const cutoffISO = new Date(
        Date.now() - HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN * 24 * 60 * 60 * 1000
      ).toISOString();
      // 정책 문구("업로드 후 30일")와 일치시키기 위해 접수일(created_at)이 아닌 실제
      // 업로드 시각(vehicle_doc_uploaded_at) 기준으로 판정한다. 업로드 시각이 기록되지
      // 않은 과거 건(레거시)은 삭제 배치도 건드리지 않으므로 화면에서도 숨기지 않는다.
      const recentUploadOrPending = `vehicle_doc_path.is.null,vehicle_doc_uploaded_at.is.null,vehicle_doc_uploaded_at.gte.${cutoffISO}`;

      let q = supabase.from("narumi_tasks").select("*");

      if (isPrivilegedManager) {
        if (!showOldUploaded) {
          q = q.or(recentUploadOrPending);
        }
      } else if (isNarumi || isInsAI) {
        q = q.or(recentUploadOrPending);
      } else if (isLotte) {
        q = q
          .eq("is_lotte_autolease", true)
          .or(recentUploadOrPending);
      } else {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;

      const nextRows = (data ?? []) as NarumiTask[];
      setRows(nextRows);

      const nextDrafts: Record<string, string> = {};
      nextRows.forEach((row) => {
        nextDrafts[String(row.id)] = row.special_note ?? "";
      });
      setMemoDrafts(nextDrafts);
    } catch (e: any) {
      setErr(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return; // auth 아직 로딩 중 → 기다림
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showOldUploaded, isPrivilegedManager, isNarumi, isInsAI, isLotte]);

  const searchedRows = useMemo(() => {
    let result = [...rows];

    if (isLotte) {
      result = result.filter((r) => r.is_lotte_autolease === true);
    }

    const q = searchText.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => {
        const vinText = (r.vin ?? "").toLowerCase();
        const nameText = (r.customer_name ?? "").toLowerCase();
        const phoneText = onlyDigits(r.customer_phone ?? "");
        const noteText = (r.special_note ?? "").toLowerCase();
        const salesRepText = (r.sales_rep ?? "").toLowerCase();
        const salesRepPhoneText = onlyDigits(r.sales_rep_phone ?? "");
        const vehicleUseTypeText = (r.vehicle_use_type ?? "").toLowerCase();
        const idText = String(r.id ?? "");
        const qDigits = onlyDigits(q);
        return (
          vinText.includes(q) ||
          nameText.includes(q) ||
          (qDigits ? phoneText.includes(qDigits) : false) ||
          noteText.includes(q) ||
          salesRepText.includes(q) ||
          vehicleUseTypeText.includes(q) ||
          (qDigits ? salesRepPhoneText.includes(qDigits) : false) ||
          idText.includes(q)
        );
      });
    }

    return result;
  }, [rows, searchText, isLotte]);

  const filteredRows = useMemo(() => {
    // AI비서에서 특정 딜을 클릭해서 온 경우 → 해당 건만 표시
    if (focusId) {
      return rows.filter((r) => String(r.id) === String(focusId));
    }
    let result = [...searchedRows];

    if (summaryFilter !== "all") {
      result = result.filter((r) => matchesSummaryFilter(r, summaryFilter));
    }

    if (statusFilter !== "all") {
      result = result.filter((r) => {
        if (summaryFilter !== "hold" && r.on_hold) return false;
        return deriveStatus(r) === statusFilter;
      });
    }

    return result;
  }, [rows, searchedRows, summaryFilter, statusFilter, focusId]);

  const summaryCounts = useMemo(() => {
    return searchedRows.reduce(
      (acc, row) => {
        if (isSummaryHold(row)) acc.hold += 1;
        if (isSummaryInsuranceWaiting(row)) acc.insuranceWaiting += 1;
        if (isSummaryDocsWaiting(row)) acc.docsWaiting += 1;
        if (isSummaryRegisterWaiting(row)) acc.registerWaiting += 1;
        if (isSummaryCompleted(row)) acc.completed += 1;

        return acc;
      },
      {
        hold: 0,
        insuranceWaiting: 0,
        docsWaiting: 0,
        registerWaiting: 0,
        completed: 0,
      }
    );
  }, [searchedRows]);

  const handleSummaryBadgeClick = (next: Exclude<SummaryFilter, "all">) => {
    setSummaryFilter((prev) => (prev === next ? "all" : next));
    setStatusFilter("all");
  };

  // 특이사항/제작증을 제외한 전 필드가 채워져야 저장 가능 — 번호판 중개 건은 고객명+연락처만 필수
  const isCreateFormValid = useMemo(() => {
    if (!customerName.trim() || !customerPhone.trim()) return false;

    if (isPlateBrokerage) return true;

    if (!vin.trim()) return false;
    if (deliveryText.trim().length !== 10) return false;
    if (!financeType) return false;
    if (financeType === "리스" && !leaseCompany.trim()) return false;
    if (vehicleUseType === "영업용" && !businessType) return false;
    if (tempPlateReturned === null) return false;
    if (tempPlateReturned === false && tempPlateReturnDueDate.trim().length !== 10) return false;
    if (!salesRep.trim()) return false;
    if (!salesRepPhone.trim()) return false;

    return true;
  }, [
    customerName,
    customerPhone,
    isPlateBrokerage,
    vin,
    deliveryText,
    financeType,
    leaseCompany,
    vehicleUseType,
    businessType,
    tempPlateReturned,
    tempPlateReturnDueDate,
    salesRep,
    salesRepPhone,
  ]);

  // registered_at(등록완료 시각, KST) 기준으로 선택한 월(YYYY-MM)에 등록완료된 건만 엑셀로 내보내기
  const exportMonthlyReport = () => {
    const monthRows = rows.filter((r) => {
      if (!r.is_registered || !r.registered_at) return false;
      const registeredAt = new Date(r.registered_at);
      if (Number.isNaN(registeredAt.getTime())) return false;
      const kst = new Date(registeredAt.getTime() + 9 * 60 * 60 * 1000);
      return kst.toISOString().slice(0, 7) === reportMonth;
    });

    if (monthRows.length === 0) {
      alert(`${reportMonth}에 등록완료된 건이 없습니다.`);
      return;
    }

    const sheetRows = monthRows.map((r) => ({
      접수번호: r.case_no ?? String(r.id),
      VIN: r.vin || "-",
      고객명: getDisplayCustomerName(r),
      연락처: getDisplayPhone(r),
      등록완료일시: formatCreatedAt(r.registered_at ?? undefined),
      출고일자: r.delivery_date_text || "-",
      금융구분: r.finance_type || "-",
      롯데오토리스: r.finance_type === "할부" ? (r.is_lotte_autolease ? "Y" : "N") : "-",
      리스사: r.lease_company || "-",
      용도구분: r.vehicle_use_type || "-",
      용도세부: r.business_type || "-",
      임시번호판반납여부: r.temp_plate_returned === true ? "Y" : r.temp_plate_returned === false ? "N" : "-",
      임시번호판반납예정일: r.temp_plate_return_due_date || "-",
      영업사원: r.sales_rep || "-",
      영업사원연락처: r.sales_rep_phone ? formatPhoneKR(r.sales_rep_phone) : "-",
      진행상태: statusLabel(deriveStatus(r)),
      번호판중개여부: r.is_plate_brokerage ? "Y" : "N",
      중개결과: r.brokerage_result || "-",
      특이사항: r.special_note || "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws["!cols"] = [12, 18, 10, 16, 16, 12, 8, 12, 14, 8, 8, 14, 16, 10, 16, 10, 12, 10, 30].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "월간리포트");
    XLSX.writeFile(wb, `나르미_월간리포트(등록완료)_${reportMonth}.xlsx`);
  };

  const onReset = () => {
    setVin("");
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryText("");
    setLotte(false);
    setSalesRep("");
    setSalesRepPhone("");
    setVehicleUseType("자가용");
    setSpecialNote("");
    setFinanceType("");
    setLeaseCompany("");
    setBusinessType("");
    setTempPlateReturned(null);
    setTempPlateReturnDueDate("");
    setIsPlateBrokerage(false);
    setManufactureImageFile(null);
    if (manufactureInputRef.current) manufactureInputRef.current.value = "";
  };

  const openEditModal = (row: NarumiTask) => {
    if (!canEditExisting) {
      alert("기존 데이터 수정 권한이 없습니다.");
      return;
    }

    setEditRow(row);
    setEditVin(row.vin ?? "");
    setEditCustomerName(row.customer_name ?? "");
    setEditCustomerPhone(formatPhoneKR(row.customer_phone ?? ""));
    setEditSalesRep(row.sales_rep ?? "");
    setEditSalesRepPhone(formatPhoneKR(row.sales_rep_phone ?? ""));
    setEditVehicleUseType(row.vehicle_use_type === "영업용" ? "영업용" : "자가용");
    setEditSpecialNote(row.special_note ?? "");
  };

  const closeEditModal = () => {
    if (editSaving) return;
    setEditRow(null);
    setEditVin("");
    setEditCustomerName("");
    setEditCustomerPhone("");
    setEditSalesRep("");
    setEditSalesRepPhone("");
    setEditVehicleUseType("자가용");
    setEditSpecialNote("");
  };

  const openDispatchModal = (row: NarumiTask) => {
    if (!canChangeStatus) {
      alert("상태 변경 권한이 없습니다.");
      return;
    }
    setDispatchRow(row);
    setDispatchVin("");
    setDispatchDeliveryText("");
    setDispatchFinanceType("");
    setDispatchLotte(false);
    setDispatchLeaseCompany("");
    setDispatchBusinessType("");
    setDispatchTempPlateReturned(null);
    setDispatchTempPlateReturnDueDate("");
    setDispatchSalesRep("");
    setDispatchSalesRepPhone("");
  };

  const closeDispatchModal = () => {
    if (dispatchSaving) return;
    setDispatchRow(null);
  };

  const isDispatchFormValid = useMemo(() => {
    if (!dispatchVin.trim()) return false;
    if (dispatchDeliveryText.trim().length !== 10) return false;
    if (!dispatchFinanceType) return false;
    if (dispatchFinanceType === "리스" && !dispatchLeaseCompany.trim()) return false;
    if (!dispatchBusinessType) return false;
    if (dispatchTempPlateReturned === null) return false;
    if (dispatchTempPlateReturned === false && dispatchTempPlateReturnDueDate.trim().length !== 10) return false;
    if (!dispatchSalesRep.trim()) return false;
    if (!dispatchSalesRepPhone.trim()) return false;
    return true;
  }, [
    dispatchVin,
    dispatchDeliveryText,
    dispatchFinanceType,
    dispatchLeaseCompany,
    dispatchBusinessType,
    dispatchTempPlateReturned,
    dispatchTempPlateReturnDueDate,
    dispatchSalesRep,
    dispatchSalesRepPhone,
  ]);

  const saveDispatch = async () => {
    if (!dispatchRow) return;
    if (!isDispatchFormValid) {
      alert("모든 필수 항목을 입력해주세요.");
      return;
    }

    const vinTrim = normalizeVin(dispatchVin);
    const dtTrim = dispatchDeliveryText.trim();
    const salesRepTrim = dispatchSalesRep.trim();
    const salesRepPhoneTrim = dispatchSalesRepPhone.trim();
    const leaseCompanyTrim = dispatchLeaseCompany.trim();

    setDispatchSaving(true);
    try {
      const { data: existing, error: dupErr } = await supabase
        .from("narumi_tasks")
        .select("id, vin")
        .eq("vin", vinTrim)
        .neq("id", dispatchRow.id as any)
        .limit(1);

      if (dupErr) throw dupErr;
      if (existing && existing.length > 0) {
        alert(`이미 등록된 VIN입니다.\nVIN: ${vinTrim}\n기존 ID: ${existing[0].id}`);
        return;
      }

      const patch: Partial<NarumiTask> = {
        vin: vinTrim,
        vin_last6: vinLast6(vinTrim),
        delivery_date_text: dtTrim,
        finance_type: dispatchFinanceType,
        is_lotte_autolease: dispatchFinanceType === "할부" ? dispatchLotte : false,
        lease_company: dispatchFinanceType === "리스" ? leaseCompanyTrim : null,
        business_type: dispatchBusinessType,
        temp_plate_returned: dispatchTempPlateReturned,
        temp_plate_return_due_date: dispatchTempPlateReturned === false ? dispatchTempPlateReturnDueDate.trim() : null,
        sales_rep: salesRepTrim,
        sales_rep_phone: salesRepPhoneTrim,
        is_dispatched: true,
      };

      const { error } = await supabase
        .from("narumi_tasks")
        .update(patch)
        .eq("id", dispatchRow.id as any);

      if (error) throw error;

      // 카카오 알림: narumi_tasks 출고전환(is_dispatched) 트리거가 서버에서 직접 발송함
      // (브라우저 탭이 닫혀도 확실히 발송되도록 서버 트리거 방식으로 전환됨)

      setDispatchRow(null);
      await fetchRows();
    } catch (e: any) {
      alert(e?.message || "저장 실패");
    } finally {
      setDispatchSaving(false);
    }
  };

  const uploadManufactureDocForRow = async (rowId: string | number, file: File) => {
    const ext = extFromName(file.name) || "jpg";
    const path = `${String(rowId)}/manufacture_certificate.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("vehicle_docs")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });

    if (upErr) throw upErr;

    const { error: dbErr } = await supabase
      .from("narumi_tasks")
      .update({ manufacture_doc_path: path })
      .eq("id", rowId as any);

    if (dbErr) throw dbErr;
  };

  // ─── 카카오 알림 ─────────────────────────────────────────
  const NARUMI_KAKAO_URL = "https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/send-hyundaicm-kakao";

  const sendNarumiKakao = async (payload: Record<string, unknown>) => {
    try {
      const res = await fetch(NARUMI_KAKAO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      // fetch()는 네트워크 레벨 실패에서만 reject되고 4xx/5xx는 정상 응답으로 처리되므로,
      // 응답 본문을 반드시 확인해야 서버 쪽 발송 실패를 감지할 수 있다(기존엔 여기서 그냥
      // 끝나버려서 큐잉/실패 여부를 전혀 알 수 없었음).
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) {
        console.error("[narumi kakao] 발송 실패:", res.status, data);
        alert(`카카오 알림톡 발송에 실패했습니다 (사유: ${data?.error ?? res.status}). 담당자에게 별도로 연락해주세요.`);
      } else if (data?.queued) {
        console.log("[narumi kakao] 업무시간 외라 큐에 저장됨:", data.reason, "→", data.send_at);
      }
    } catch (e) {
      console.warn("[narumi kakao] 전송 실패:", e);
    }
  };

  // ─── 신규 등록 ───────────────────────────────────────────
  const onAdd = async () => {
    if (!canCreate) {
      alert("신규 입력 권한이 없습니다.");
      return;
    }

    const nameTrim = customerName.trim();
    const phoneTrim = customerPhone.trim();

    if (!nameTrim) {
      alert("고객명을 입력해주세요.");
      return;
    }
    if (!phoneTrim) {
      alert("고객 전화번호를 입력해주세요.");
      return;
    }

    // ── 번호판 중개 건: 고객명 + 연락처만으로 최소 접수 ──
    if (isPlateBrokerage) {
      setSaving(true);
      setErr("");
      try {
        const { data: caseNoData, error: caseNoErr } = await supabase.rpc("next_rnf_number");
        if (caseNoErr) throw caseNoErr;

        const payload = {
          case_no: caseNoData as string,
          vin: null,
          vin_last6: null,
          delivery_date_text: null,
          is_lotte_autolease: false,
          special_note: specialNote.trim() || null,
          customer_name: nameTrim,
          customer_phone: phoneTrim,
          sales_rep: null,
          sales_rep_phone: null,
          vehicle_use_type: "영업용",
          finance_type: null,
          lease_company: null,
          business_type: null,
          temp_plate_returned: null,
          temp_plate_return_due_date: null,
          is_plate_brokerage: true,
          brokerage_result: null,
          is_dispatched: false,
          customer_phone_set_at: new Date().toISOString(),
          customer_phone_scrubbed_at: null,
          on_hold: false,
          has_insurance: false,
          docs_ready: false,
          is_registering: false,
          is_registered: false,
          status: "todo" as TaskStatus,
          vehicle_doc_path: null,
          manufacture_doc_path: null,
        };

        const { error } = await supabase.from("narumi_tasks").insert(payload);
        if (error) throw error;

        // 카카오 알림: narumi_tasks insert 트리거가 서버에서 직접 발송함
        // (브라우저 탭이 닫혀도 확실히 발송되도록 서버 트리거 방식으로 전환됨)

        onReset();
        await fetchRows();
      } catch (e: any) {
        setErr(e?.message || "Insert failed");
        alert(e?.message || "Insert failed");
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── 일반 건 ──
    const vinTrim = normalizeVin(vin);
    const dtTrim = deliveryText.trim();
    const salesRepTrim = salesRep.trim();
    const salesRepPhoneTrim = salesRepPhone.trim();
    const leaseCompanyTrim = leaseCompany.trim();

    if (!vinTrim) {
      alert("차대번호를 입력해주세요.");
      return;
    }
    if (dtTrim.length !== 10) {
      alert("출고일자는 YYYY.MM.DD 형식으로 입력해주세요. (예: 2026.02.25)");
      return;
    }
    if (!financeType) {
      alert("금융구분을 선택해주세요.");
      return;
    }
    if (financeType === "리스" && !leaseCompanyTrim) {
      alert("리스사명을 입력해주세요.");
      return;
    }
    if (vehicleUseType === "영업용" && !businessType) {
      alert("영업용 세부구분(개별/용달/지입)을 선택해주세요.");
      return;
    }
    if (tempPlateReturned === null) {
      alert("임시번호판 반납여부를 선택해주세요.");
      return;
    }
    if (tempPlateReturned === false && tempPlateReturnDueDate.trim().length !== 10) {
      alert("임시번호판 예정 반납일자를 YYYY.MM.DD 형식으로 입력해주세요.");
      return;
    }
    if (!salesRepTrim) {
      alert("영업사원을 입력해주세요.");
      return;
    }
    if (!salesRepPhoneTrim) {
      alert("영업사원 연락처를 입력해주세요.");
      return;
    }

    setSaving(true);
    setErr("");

    try {
      const { data: existing, error: dupErr } = await supabase
        .from("narumi_tasks")
        .select("id, vin, created_at, vehicle_doc_path")
        .eq("vin", vinTrim)
        .order("created_at", { ascending: false })
        .limit(1);

      if (dupErr) throw dupErr;
      if (existing && existing.length > 0) {
        alert(`이미 등록된 VIN입니다.\nVIN: ${vinTrim}\n기존 ID: ${existing[0].id}`);
        return;
      }

      const { data: caseNoData, error: caseNoErr } = await supabase.rpc("next_rnf_number");
      if (caseNoErr) throw caseNoErr;

      const payload = {
        case_no: caseNoData as string,
        vin: vinTrim,
        vin_last6: vinLast6(vinTrim),
        delivery_date_text: dtTrim,
        is_lotte_autolease: financeType === "할부" ? lotte : false,
        special_note: specialNote.trim() || null,
        customer_name: nameTrim,
        customer_phone: phoneTrim,
        sales_rep: salesRepTrim,
        sales_rep_phone: salesRepPhoneTrim,
        vehicle_use_type: vehicleUseType,
        finance_type: financeType,
        lease_company: financeType === "리스" ? leaseCompanyTrim : null,
        business_type: vehicleUseType === "영업용" ? businessType : null,
        temp_plate_returned: tempPlateReturned,
        temp_plate_return_due_date: tempPlateReturned === false ? tempPlateReturnDueDate.trim() : null,
        is_plate_brokerage: false,
        brokerage_result: null,
        is_dispatched: false,
        customer_phone_set_at: new Date().toISOString(),
        customer_phone_scrubbed_at: null,
        on_hold: false,
        has_insurance: false,
        docs_ready: false,
        is_registering: false,
        is_registered: false,
        status: "todo" as TaskStatus,
        vehicle_doc_path: null,
        manufacture_doc_path: null,
      };

      const { data: inserted, error } = await supabase
        .from("narumi_tasks")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      if (manufactureImageFile && inserted?.id != null) {
        try {
          await uploadManufactureDocForRow(inserted.id, manufactureImageFile);
        } catch (docErr: any) {
          // 접수 자체는 이미 성공했으므로, 제작증 첨부 실패는 별도로 알리고 흐름은 계속 진행한다.
          // 목록 카드의 "제작증 첨부" 버튼으로 재시도할 수 있다.
          alert(`접수는 완료되었지만 제작증 첨부에 실패했습니다: ${docErr?.message || "알 수 없는 오류"}\n목록에서 해당 건의 "제작증 첨부" 버튼으로 다시 첨부해주세요.`);
        }
      }

      // 카카오 알림: narumi_tasks insert 트리거가 서버에서 직접 발송함
      // (브라우저 탭이 닫혀도 확실히 발송되도록 서버 트리거 방식으로 전환됨)

      // 다음 날 할 일 + 일정 자동 등록 (KST 기준)
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const tomorrow = new Date(kstNow);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      const narumiNewTitle = `${nameTrim} (나르미 - 신규접수 확인)`;
      const narumiNewDesc  = `VIN: ${vinTrim} / 출고: ${dtTrim} / 영업: ${salesRepTrim}`;
      const [todoRes, schedRes] = await Promise.all([
        supabase.from("secretary_todos").insert({
          title:       narumiNewTitle,
          description: narumiNewDesc,
          priority:    "normal",
          category:    "finance",
          due_date:    tomorrowStr,
          is_done:     false,
        }),
        supabase.from("secretary_schedules").insert({
          title:          narumiNewTitle,
          description:    narumiNewDesc,
          schedule_date:  tomorrowStr,
          category:       "followup",
          related_type:   "finance",
          progress_stage: "신규접수",
          work_type:      "narumi",
        }),
      ]);
      if (todoRes.error) console.error("[narumi] todo insert 실패:", todoRes.error.message);
      if (schedRes.error) console.error("[narumi] schedule insert 실패:", schedRes.error.message);

      onReset();
      await fetchRows();
    } catch (e: any) {
      setErr(e?.message || "Insert failed");
      alert(e?.message || "Insert failed");
    } finally {
      setSaving(false);
    }
  };

  const isLockedAfterUpload = (r: NarumiTask) => !!r.vehicle_doc_path;
  const isVehicleDocKeyEnabled = (r: NarumiTask) =>
    canUploadVehicleDoc && isAllDone(r) && !isLockedAfterUpload(r);

  const toggleStage = async (
    id: NarumiTask["id"],
    key: keyof Pick<NarumiTask, "has_insurance" | "docs_ready" | "is_registered">
  ) => {
    if (!canChangeStatus) {
      alert("상태 변경 권한이 없습니다.");
      return;
    }

    const target = rows.find((rr) => String(rr.id) === String(id));
    if (!target) return;

    if (isLockedAfterUpload(target) || isOnHold(target)) return;

    const nextVal = !target[key];
    const nextRow = { ...target, [key]: nextVal };
    const nextStatus = deriveStatus(nextRow);
    // 월간 리포트가 "등록완료 월"을 집계할 수 있도록 완료 시점을 기록(해제 시 초기화)
    const nextRegisteredAt = key === "is_registered" ? (nextVal ? new Date().toISOString() : null) : undefined;

    setRows((prev) =>
      prev.map((rr) =>
        String(rr.id) === String(id)
          ? { ...rr, [key]: nextVal, status: nextStatus, ...(nextRegisteredAt !== undefined ? { registered_at: nextRegisteredAt } : {}) }
          : rr
      )
    );

    const patch: Partial<NarumiTask> = {
      [key]: nextVal,
      status: nextStatus,
      ...(nextRegisteredAt !== undefined ? { registered_at: nextRegisteredAt } : {}),
    };

    const { error } = await supabase
      .from("narumi_tasks")
      .update(patch)
      .eq("id", id as any);

    if (error) {
      setRows((prev) =>
        prev.map((rr) =>
          String(rr.id) === String(id)
            ? { ...rr, [key]: !nextVal, status: target.status ?? deriveStatus(target), registered_at: target.registered_at ?? null }
            : rr
        )
      );
      alert(error.message);
    } else {
      // 단계 변경 시 카카오 알림톡 발송
      const keyToStatus: Record<string, { prev: string; next: string }> = {
        docs_ready:    { prev: "보험완료", next: "등록서류" },
        is_registered: { prev: "등록서류", next: "등록완료" },
      };
      const stageChange = keyToStatus[key];
      if (stageChange && nextVal === true) {
        sendNarumiKakao({
          type:       "narumi_status",
          vin:        target.vin,
          customerName: target.customer_name,
          salesRep:   target.sales_rep,
          prevStatus: stageChange.prev,
          nextStatus: stageChange.next,
        });
      }
    }
  };

  // 번호판 중개 건의 결과(중개완료/보류/취소)를 카드 목록에서 즉시 저장
  const saveBrokerageResult = async (id: NarumiTask["id"], value: string | null) => {
    if (!canChangeStatus) {
      alert("상태 변경 권한이 없습니다.");
      return;
    }

    const target = rows.find((rr) => String(rr.id) === String(id));
    if (!target) return;

    setRows((prev) =>
      prev.map((rr) => (String(rr.id) === String(id) ? { ...rr, brokerage_result: value } : rr))
    );

    const { error } = await supabase
      .from("narumi_tasks")
      .update({ brokerage_result: value })
      .eq("id", id as any);

    if (error) {
      setRows((prev) =>
        prev.map((rr) => (String(rr.id) === String(id) ? { ...rr, brokerage_result: target.brokerage_result ?? null } : rr))
      );
      alert(error.message);
    }
  };

  const updateInsuranceStage = async (row: NarumiTask, nextVal: boolean) => {
    const nextRow = { ...row, has_insurance: nextVal };
    const nextStatus = deriveStatus(nextRow);

    setRows((prev) =>
      prev.map((rr) =>
        String(rr.id) === String(row.id)
          ? { ...rr, has_insurance: nextVal, status: nextStatus }
          : rr
      )
    );

    const { data, error } = await supabase
      .from("narumi_tasks")
      .update({ has_insurance: nextVal, status: nextStatus })
      .eq("id", row.id as any)
      .select("id");

    // RLS로 대상 행이 보이지 않으면 update가 0건에 성공(error 없음)으로 끝나버려
    // 화면은 바뀐 것처럼 보이다가 새로고침하면 원래대로 돌아가는 문제가 있었다.
    // data가 비어있으면 실제로는 반영되지 않은 것이므로 명시적으로 에러 처리한다.
    if (error || !data || data.length === 0) {
      setRows((prev) =>
        prev.map((rr) =>
          String(rr.id) === String(row.id)
            ? { ...rr, has_insurance: row.has_insurance, status: row.status ?? deriveStatus(row) }
            : rr
        )
      );
      throw error ?? new Error("업데이트 대상을 찾지 못했습니다(권한 또는 동기화 문제일 수 있습니다).");
    }

    // 보험확인 단계는 SMS 미발송
  };

  const hasIssuedInsuranceCase = async (vin: string) => {
    const normalizedVin = normalizeVin(vin);
    if (!normalizedVin) return false;

    const { data, error } = await supabase
      .from("consultation_insurance_details")
      .select("consultation_id")
      .eq("vehicle_no", normalizedVin)
      .eq("policy_issued", true)
      .limit(1);

    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  };

  const handleInsuranceButtonClick = async (row: NarumiTask) => {
    if (!canChangeStatus) {
      alert("상태 변경 권한이 없습니다.");
      return;
    }

    if (isLockedAfterUpload(row) || isOnHold(row)) return;

    if (!row.has_insurance) {
      setInsuranceModalRow(row);
      return;
    }

    try {
      const issuedByConsultation = await hasIssuedInsuranceCase(row.vin);

      if (issuedByConsultation) {
        alert("Y 완료건은 상담관리에서 해당 건의 증권발급을 해제해 주세요.");
        return;
      }

      await updateInsuranceStage(row, false);
    } catch (e: any) {
      alert(e?.message || "보험 단계 해제 실패");
    }
  };

  const completeInsuranceAsN = async () => {
    if (!insuranceModalRow) return;

    try {
      await updateInsuranceStage(insuranceModalRow, true);
      setInsuranceModalRow(null);
    } catch (e: any) {
      alert(e?.message || "보험 단계 완료 처리 실패");
    }
  };

  const moveToCallManagementForInsurance = async () => {
    if (!insuranceModalRow) return;

    // Y 클릭 즉시 나르미 보험 단계 업데이트
    try {
      await updateInsuranceStage(insuranceModalRow, true);
    } catch (e: any) {
      alert("나르미 보험 단계 업데이트에 실패했습니다: " + (e?.message || "알 수 없는 오류") + "\n상담관리 화면으로는 이동하지만, 나르미 목록의 보험 버튼은 비활성화되지 않았을 수 있습니다.");
    }

    // 보험확인 단계는 SMS 미발송

    navigate("/work/call-management", {
      state: {
        narumiInsurancePrefill: {
          narumiTaskId: insuranceModalRow.id,
          callDatetime: new Date().toISOString().slice(0, 10),
          phone: insuranceModalRow.customer_phone ?? "",
          customerName: insuranceModalRow.customer_name ?? "",
          vehicleNo: normalizeVin(insuranceModalRow.vin ?? ""),
          autoSave: true,
        },
      },
    });

    setInsuranceModalRow(null);
  };

  const openPostalForm = (row: NarumiTask) => {
    if (!canChangeStatus) {
      alert("우편발송 변경 권한이 없습니다.");
      return;
    }
    if (!row.is_registered) {
      alert("등록완료 상태에서만 우편발송을 입력할 수 있습니다.");
      return;
    }

    setPostalOpenRowId(row.id);
    setPostalTrackingNo(row.postal_tracking_no ?? "");
    setPostalSentDate(
      row.postal_sent_date ??
        new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000)
          .toISOString()
          .slice(0, 10)
    );
  };

  const closePostalForm = () => {
    setPostalOpenRowId(null);
    setPostalTrackingNo("");
    setPostalSentDate("");
  };

  const savePostalInfo = async (row: NarumiTask) => {
    if (!canChangeStatus) {
      alert("우편발송 저장 권한이 없습니다.");
      return;
    }
    if (!row.is_registered) {
      alert("등록완료 상태에서만 우편발송을 저장할 수 있습니다.");
      return;
    }

    const tracking = postalTrackingNo.trim();
    const sentDate = postalSentDate.trim();

    if (!tracking) {
      return;
    }
    if (!sentDate) {
      return;
    }

    setPostalSavingId(row.id);
    try {
      const patch = {
        postal_mail_sent: true,
        postal_tracking_no: tracking,
        postal_sent_date: sentDate,
      };

      const { error } = await supabase
        .from("narumi_tasks")
        .update(patch)
        .eq("id", row.id as any);

      if (error) throw error;

      setRows((prev) =>
        prev.map((rr) =>
          String(rr.id) === String(row.id)
            ? { ...rr, ...patch }
            : rr
        )
      );

      closePostalForm();

      // SMS 발송 (우편발송 — 등기번호 포함)
      sendNarumiKakao({
        type:         "narumi_postal",
        vin:          row.vin,
        customerName: row.customer_name,
        salesRep:     row.sales_rep ?? "-",
        trackingNo:   tracking,
        sentDate,
      });

    } catch (e: any) {
      alert(e?.message || "우편발송 저장 실패");
    } finally {
      setPostalSavingId(null);
    }
  };

  const openPostalTrackingLookup = async (trackingNo: string) => {
    const trimmed = (trackingNo ?? "").trim();
    if (!trimmed) {
      return;
    }

    const normalized = onlyDigits(trimmed) || trimmed;
    const directLookupUrl = `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(normalized)}`;
    const fallbackLookupUrl = "https://service.epost.go.kr/iservice/trace.jsp";

    let opened = false;

    // 1) 공식 조회 endpoint로 새 탭 오픈
    try {
      const anchor = document.createElement("a");
      anchor.href = directLookupUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      opened = true;
    } catch {
      // 아래 fallback 진행
    }

    // 2) anchor 클릭이 막히면 GET form submit으로 재시도
    if (!opened) {
      try {
        const form = document.createElement("form");
        form.method = "GET";
        form.action = "https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm";
        form.target = "_blank";
        form.style.display = "none";

        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "sid1";
        input.value = normalized;

        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        opened = true;
      } catch {
        // 아래 fallback 진행
      }
    }

    // 3) 최종 fallback: 일반 조회 화면 오픈 + 등기번호 복사
    if (!opened) {
      try {
        const popup = window.open(fallbackLookupUrl, "_blank", "noopener,noreferrer");
        if (popup) {
          popup.opener = null;
        }
      } catch {
        // 현재 창 유지
      }
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(normalized);
      } else {
        const ta = document.createElement("textarea");
        ta.value = normalized;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch {
      // 복사 실패 무시
    }
  };

  const toggleHold = async (row: NarumiTask) => {
    if (!canChangeStatus) {
      alert("보류 변경 권한이 없습니다.");
      return;
    }

    if (isLockedAfterUpload(row)) return;

    const nextVal = !row.on_hold;

    setRows((prev) =>
      prev.map((rr) =>
        String(rr.id) === String(row.id)
          ? { ...rr, on_hold: nextVal }
          : rr
      )
    );

    const { error } = await supabase
      .from("narumi_tasks")
      .update({ on_hold: nextVal })
      .eq("id", row.id as any);

    if (error) {
      setRows((prev) =>
        prev.map((rr) =>
          String(rr.id) === String(row.id)
            ? { ...rr, on_hold: row.on_hold ?? false }
            : rr
        )
      );
      alert(error.message);
    }
  };

  const onClickVehicleDocUpload = (r: NarumiTask) => {
    if (!canChangeStatus) {
      alert("차량등록증 업로드 권한이 없습니다.");
      return;
    }
    if (!isVehicleDocKeyEnabled(r)) return;
    setPendingUploadRowId(r.id);
    fileInputRef.current?.click();
  };

  const uploadVehicleDoc = async (row: NarumiTask, file: File) => {
    if (!canUploadVehicleDoc) {
      alert("차량등록증 업로드 권한이 없습니다.");
      return;
    }

    if (!isAllDone(row)) {
      alert("등록완료 상태에서만 차량등록증 업로드가 가능합니다.");
      return;
    }
    if (isLockedAfterUpload(row)) {
      alert("이미 업로드 완료되었습니다. 업로드 후에는 변경할 수 없습니다.");
      return;
    }

    setUploadingId(row.id);
    setErr("");

    try {
      const idText = String(row.id);
      const ext = extFromName(file.name) || "bin";
      const path = `${idText}/vehicle_registration.${ext}`;
      const prevManufactureDocPath = row.manufacture_doc_path ?? null;

      const { error: upErr } = await supabase.storage
        .from("vehicle_docs")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });

      if (upErr) throw upErr;

      if (prevManufactureDocPath) {
        const { error: removeErr } = await supabase.storage
          .from("vehicle_docs")
          .remove([prevManufactureDocPath]);

        if (removeErr) throw removeErr;
      }

      const nextStatus = "completed" as TaskStatus;

      const { error: dbErr } = await supabase
        .from("narumi_tasks")
        .update({
          vehicle_doc_path: path,
          vehicle_doc_uploaded_at: new Date().toISOString(),
          manufacture_doc_path: null,
          status: nextStatus,
        })
        .eq("id", row.id as any);

      if (dbErr) throw dbErr;

      // 카카오 알림
      sendNarumiKakao({
        type:         "narumi_vehicle_doc",
        vin:          row.vin,
        customerName: row.customer_name,
        salesRep:     row.sales_rep,
      });

      await fetchRows();
    } catch (e: any) {
      alert(e?.message || "차량등록증 업로드 실패");
    } finally {
      setUploadingId(null);
    }
  };

  const downloadStorageFile = async (path: string, fallbackName: string) => {
    const { data, error } = await supabase.storage.from("vehicle_docs").download(path);
    if (error) throw error;

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeFileBase(path.split("/").pop() || fallbackName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openStorageFile = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("vehicle_docs")
      .createSignedUrl(path, 60 * 10, {
        download: false,
      });

    if (error) throw error;

    const signedUrl = data?.signedUrl;
    if (!signedUrl) throw new Error("파일 열기 링크를 생성하지 못했습니다.");

    if (typeof window !== "undefined") {
      // 모바일에서도 빈 새 창을 만들지 않고 현재 창에서 바로 엽니다.
      window.location.assign(signedUrl);
    }
  };

  const downloadVehicleDoc = async (row: NarumiTask) => {
    const path = row.vehicle_doc_path;
    if (!path) return;

    try {
      await downloadStorageFile(path, "vehicle_registration");
    } catch (e: any) {
      alert(e?.message || "다운로드 실패");
    }
  };

  const downloadManufactureDoc = async (row: NarumiTask) => {
    const path = row.manufacture_doc_path;
    if (!path) return;

    try {
      await downloadStorageFile(path, "manufacture_certificate");
    } catch (e: any) {
      alert(e?.message || "다운로드 실패");
    }
  };

  const viewManufactureDoc = async (row: NarumiTask) => {
    if (!isPrivilegedManager) {
      return;
    }

    const path = row.manufacture_doc_path;
    if (!path) return;

    try {
      await openStorageFile(path);
    } catch (e: any) {
      alert(e?.message || "보기 실패");
    }
  };

  const saveMemo = async (rowId: string | number) => {
    if (!canEditMemo) {
      alert("메모 저장 권한이 없습니다.");
      return;
    }

    const draft = memoDrafts[String(rowId)] ?? "";

    setMemoSavingId(rowId);
    try {
      const { error } = await supabase
        .from("narumi_tasks")
        .update({ special_note: draft.trim() ? draft : null })
        .eq("id", rowId as any);

      if (error) throw error;

      setRows((prev) =>
        prev.map((row) =>
          String(row.id) === String(rowId)
            ? { ...row, special_note: draft.trim() ? draft : null }
            : row
        )
      );

      alert("메모가 저장되었습니다.");
    } catch (e: any) {
      alert(e?.message || "메모 저장 실패");
    } finally {
      setMemoSavingId(null);
    }
  };

  const saveEditRow = async () => {
    if (!editRow) return;

    if (!canEditExisting) {
      alert("기존 데이터 수정 권한이 없습니다.");
      return;
    }

    const nextVin = normalizeVin(editVin);
    const nextName = editCustomerName.trim();
    const nextPhone = formatPhoneKR(editCustomerPhone).trim();
    const nextSalesRep = editSalesRep.trim();
    const nextSalesRepPhone = formatPhoneKR(editSalesRepPhone).trim();
    const nextNote = editSpecialNote.trim();

    if (!nextVin) {
      alert("차대번호를 입력해주세요.");
      return;
    }
    if (!nextName) {
      alert("고객명을 입력해주세요.");
      return;
    }
    if (!nextPhone) {
      alert("전화번호를 입력해주세요.");
      return;
    }
    if (!nextSalesRep) {
      alert("영업사원을 입력해주세요.");
      return;
    }
    if (!nextSalesRepPhone) {
      alert("영업사원 연락처를 입력해주세요.");
      return;
    }

    try {
      setEditSaving(true);

      if (!isPrivilegedManager && nextVin !== normalizeVin(editRow.vin ?? "")) {
        alert("차대번호는 관리자/보험전담 계정만 수정할 수 있습니다.");
        return;
      }

      if (nextVin !== normalizeVin(editRow.vin ?? "")) {
        const { data: dup, error: dupErr } = await supabase
          .from("narumi_tasks")
          .select("id")
          .eq("vin", nextVin)
          .neq("id", editRow.id as any)
          .limit(1);

        if (dupErr) throw dupErr;
        if (dup && dup.length > 0) {
          alert(`이미 등록된 VIN입니다.
VIN: ${nextVin}`);
          return;
        }
      }

      const prevPhoneDigits = onlyDigits(editRow.customer_phone ?? "");
      const nextPhoneDigits = onlyDigits(nextPhone);

      const patch: Partial<NarumiTask> & Record<string, any> = {
        customer_name: nextName,
        customer_phone: nextPhone,
        sales_rep: nextSalesRep,
        sales_rep_phone: nextSalesRepPhone,
        vehicle_use_type: editVehicleUseType,
        special_note: nextNote || null,
      };

      if (isPrivilegedManager) {
        patch.vin = nextVin;
        patch.vin_last6 = vinLast6(nextVin);
      }

      if (prevPhoneDigits !== nextPhoneDigits) {
        patch.customer_phone_set_at = new Date().toISOString();
        patch.customer_phone_scrubbed_at = null;
      }

      const { error } = await supabase
        .from("narumi_tasks")
        .update(patch)
        .eq("id", editRow.id as any);

      if (error) throw error;

      setRows((prev) =>
        prev.map((row) =>
          String(row.id) === String(editRow.id)
            ? { ...row, ...patch }
            : row
        )
      );

      setMemoDrafts((prev) => ({
        ...prev,
        [String(editRow.id)]: nextNote || "",
      }));

      closeEditModal();
      alert("수정되었습니다.");
    } catch (e: any) {
      alert(e?.message || "수정 실패");
    } finally {
      setEditSaving(false);
    }
  };

  const resetMemoDraft = (row: NarumiTask) => {
    setMemoDrafts((prev) => ({
      ...prev,
      [String(row.id)]: row.special_note ?? "",
    }));
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    const rowId = pendingUploadRowId;

    e.target.value = "";
    if (!file || rowId == null) return;

    const row = rows.find((rr) => String(rr.id) === String(rowId));
    if (!row) return;

    await uploadVehicleDoc(row, file);
    setPendingUploadRowId(null);
  };

  const onManufacturePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      alert("이미지 또는 PDF 파일만 첨부할 수 있습니다.");
      e.target.value = "";
      return;
    }

    setManufactureImageFile(file);
  };

  const onClickManufactureAttach = (r: NarumiTask) => {
    if (!canCreate) {
      alert("제작증 첨부 권한이 없습니다.");
      return;
    }
    if (isLockedAfterUpload(r)) return;
    setPendingManufactureUploadRowId(r.id);
    rowManufactureInputRef.current?.click();
  };

  const onRowManufacturePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    const rowId = pendingManufactureUploadRowId;
    e.target.value = "";
    setPendingManufactureUploadRowId(null);
    if (!file || rowId == null) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      alert("이미지 또는 PDF 파일만 첨부할 수 있습니다.");
      return;
    }

    setManufactureUploadingId(rowId);
    try {
      await uploadManufactureDocForRow(rowId, file);
      await fetchRows();
    } catch (e: any) {
      alert(e?.message || "제작증 첨부 실패");
    } finally {
      setManufactureUploadingId(null);
    }
  };

  const loginRoleLabel = useMemo(() => {
    if (isAdmin) return "관리자";
    if (isInsuranceManager) return "보험전담";
    if (isNarumi) return "나르미모터스";
    if (isLotte) return "롯데오토리스 조회";
    return "일반";
  }, [isAdmin, isInsuranceManager, isNarumi, isLotte]);

  // auth 로딩 중 → 흰 화면 방지
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-2">🔐 인증 확인 중...</p>
          <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto"/>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-white">

      {/* ── 숨겨진 파일 인풋 ── */}
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onFilePicked} />
      <input ref={manufactureInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onManufacturePicked} />
      <input ref={rowManufactureInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onRowManufacturePicked} />

      {/* ── 헤더 + 요약 뱃지 (전부 한 덩어리로 고정) ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 space-y-3 pb-3">
        <div className="px-3 pt-1.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#0f172a]">🚛 나르미 업무 관리</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              isAdmin ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
              isInsuranceManager ? "bg-purple-50 border-purple-100 text-purple-600" :
              isNarumi ? "bg-orange-50 border-orange-100 text-orange-600" :
              isLotte ? "bg-blue-50 border-blue-100 text-blue-600" :
              "bg-gray-50 border-gray-200 text-gray-500"
            }`}>{loginRoleLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={()=>navigate("/work/secretary")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-gray-300 hover:text-gray-700 transition-all">
              ← AI비서
            </button>
            <button type="button" onClick={fetchRows}
              className="inline-flex items-center px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-300 transition-all">
              새로고침
            </button>
            <button type="button" onClick={logout}
              className="inline-flex items-center px-2.5 py-1 rounded-xl border border-red-200 text-red-500 text-xs font-medium hover:border-red-300 transition-all">
              로그아웃
            </button>
          </div>
        </div>

        <div className="px-4">
          <AppTabBar activeTab="narumi" />
        </div>

        {/* ── 요약 뱃지 ── */}
        <div className="px-4 flex flex-wrap gap-2">
          <SummaryBadge
            label="보류" count={summaryCounts.hold}
            className="bg-gray-100 text-gray-600 border-gray-200"
            active={summaryFilter === "hold"}
            onClick={() => handleSummaryBadgeClick("hold")}
          />
          <SummaryBadge
            label="보험대기" count={summaryCounts.insuranceWaiting}
            className="bg-orange-50 text-orange-700 border-orange-200"
            active={summaryFilter === "insurance_waiting"}
            onClick={() => handleSummaryBadgeClick("insurance_waiting")}
          />
          <SummaryBadge
            label="서류대기" count={summaryCounts.docsWaiting}
            className="bg-orange-50 text-orange-700 border-orange-200"
            active={summaryFilter === "docs_waiting"}
            onClick={() => handleSummaryBadgeClick("docs_waiting")}
          />
          <SummaryBadge
            label="등록대기" count={summaryCounts.registerWaiting}
            className="bg-orange-50 text-orange-700 border-orange-200"
            active={summaryFilter === "register_waiting"}
            onClick={() => handleSummaryBadgeClick("register_waiting")}
          />
          <SummaryBadge
            label="완료" count={summaryCounts.completed}
            className="bg-emerald-50 text-emerald-700 border-emerald-200"
            active={summaryFilter === "completed"}
            onClick={() => handleSummaryBadgeClick("completed")}
          />
          {summaryFilter !== "all" && (
            <button
              type="button"
              onClick={() => { setSummaryFilter("all"); setStatusFilter("all"); }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-500 hover:shadow-sm transition-all"
            >
              전체 보기
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">

        {/* ── 오류 메시지 ── */}
        {!!err && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-3 text-sm font-medium">
            {err}
          </div>
        )}

        {/* ── 안내문 ── */}
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-4 text-xs text-orange-700/90 leading-relaxed space-y-0.5">
          <p>* 고객 전화번호는 입력 후 {UI_MASK_AFTER_HOURS}시간 경과 시 화면에서 뒷 4자리가 마스킹됩니다(등록완료 전). 고객명은 계속 공개됩니다.</p>
          <p>* 등록완료(차량등록증 업로드) 후에는 {COMPLETION_MASK_AFTER_HOURS}시간 경과 시 화면에서 뒷 4자리가 마스킹됩니다.</p>
          <p>* 고객 전화번호는 입력 후 {DB_SCRUB_AFTER_HOURS}시간(5일) 경과 시 DB에서 뒷 4자리가 영구 마스킹(삭제)됩니다.</p>
          <p>* 차량등록증 업로드 완료 건은 일반 사용자는 최근 {HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN}일 이내만 표시되며, 업로드 후 {HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN}일이 지나면 파일이 실제로 삭제됩니다.</p>
        </div>

        {/* ── 검색/필터 패널 ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500">Search</p>
            <button
              type="button"
              onClick={() => setShowSearchPanel((v) => !v)}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showSearchPanel ? "접기 ↑" : "펼치기 ↓"}
            </button>
          </div>

          {showSearchPanel && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>통합 검색</label>
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="VIN, 고객명, 전화번호, 영업사원..."
                  className={compactInputClass}
                />
              </div>
              <div>
                <label className={labelClass}>상태 필터</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className={compactInputClass}
                >
                  <option value="all">전체</option>
                  <option value="todo">접수</option>
                  <option value="insurance">보험</option>
                  <option value="docs">등록서류</option>
                  <option value="registered">등록완료</option>
                  <option value="completed">차량등록증 완료</option>
                </select>
              </div>
              {isPrivilegedManager && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setShowOldUploaded((v) => !v)}
                    className={`w-full h-[48px] px-4 rounded-xl border text-sm font-medium transition-all ${
                      showOldUploaded
                        ? "bg-orange-50 border-orange-200 text-orange-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {showOldUploaded ? "오래된 완료 건 숨기기" : "오래된 완료 건 포함"}
                  </button>
                </div>
              )}
            </div>
          )}

          {showSearchPanel && (isPrivilegedManager || isNarumi) && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-end gap-3">
              <div>
                <label className={labelClass}>월간 리포트 (등록완료월 기준)</label>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className={compactInputClass}
                />
              </div>
              <button
                type="button"
                onClick={exportMonthlyReport}
                className="h-[48px] inline-flex items-center justify-center px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:shadow-sm transition-all"
              >
                월간 리포트 다운로드 (Excel)
              </button>
            </div>
          )}
        </div>

        {/* ── 신규 입력 패널 ── */}
        {((isAdmin || isNarumi) || canViewAll) && (isPrivilegedManager || isNarumi) && (
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500">New</p>
                <h2 className="mt-1 text-sm font-semibold text-navy-900">신규 입력</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePanel((prev) => !prev)}
                className="h-9 w-9 shrink-0 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 hover:border-gray-300 transition-all"
                aria-label={showCreatePanel ? "신규입력 접기" : "신규입력 펼치기"}
              >
                {showCreatePanel ? "−" : "+"}
              </button>
            </div>

            {showCreatePanel && (
              <div className="space-y-4">
                {/* 1행: 이름 / 전화번호 / 제작증첨부 / 번호판 중개건 체크 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
                  <div>
                    <label className={labelClass}>이름 *</label>
                    <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="예: 홍길동" className={compactInputClass} disabled={!canCreate} />
                  </div>
                  <div>
                    <label className={labelClass}>전화번호 *</label>
                    <input value={customerPhone} onChange={(e) => setCustomerPhone(formatPhoneKR(e.target.value))} placeholder="010-1234-5678" inputMode="tel" className={compactInputClass} disabled={!canCreate} />
                  </div>
                  <div>
                    <label className={labelClass}>제작증첨부</label>
                    <button type="button" onClick={() => manufactureInputRef.current?.click()} disabled={!canCreate || isPlateBrokerage} className={compactButtonClass}>
                      {manufactureImageFile ? "첨부됨 ✓" : "제작증 첨부"}
                    </button>
                    {manufactureImageFile && (
                      <div className="mt-1 flex items-center gap-2">
                        <button type="button" onClick={() => window.open(URL.createObjectURL(manufactureImageFile), "_blank", "noopener,noreferrer")} className="text-[11px] font-medium text-navy-900 hover:underline">
                          보기
                        </button>
                        <button type="button" onClick={() => { setManufactureImageFile(null); if (manufactureInputRef.current) manufactureInputRef.current.value = ""; }} disabled={!canCreate || isPlateBrokerage} className="text-[11px] font-medium text-red-500 hover:underline">
                          첨부 제거
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-end pb-2.5">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-navy-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPlateBrokerage}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsPlateBrokerage(checked);
                          if (checked) setVehicleUseType("영업용");
                        }}
                        className="h-4 w-4 accent-orange-500"
                        disabled={!canCreate}
                      />
                      번호판 중개건으로 접수
                    </label>
                  </div>
                </div>

                {isPlateBrokerage && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-700/90 leading-relaxed">
                    번호판 중개 건은 이름과 전화번호만 입력하면 접수됩니다. 이후 카드 목록의 "출고" 버튼으로 나머지 정보를 입력해 정식 건으로 전환하세요.
                  </div>
                )}

                {/* 번호판 중개건 접수 시에는 차대번호~임시번호판 반납여부까지 전부 숨김 */}
                {!isPlateBrokerage && (
                  <>
                    {/* 2행: 차대번호(VIN) / 출고일자 / 영업사원 / 영업사원 전화번호 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
                      <div>
                        <label className={labelClass}>차대번호(VIN) *</label>
                        <input value={vin} onChange={(e) => setVin(normalizeVin(e.target.value))} placeholder="예: KMH..." className={compactInputClass} disabled={!canCreate} />
                      </div>
                      <div>
                        <label className={labelClass}>출고일자 *</label>
                        <input type="date" value={dotsToDateInputValue(deliveryText)} onChange={(e) => setDeliveryText(dateInputValueToDots(e.target.value))} className={compactInputClass} disabled={!canCreate} />
                      </div>
                      <div>
                        <label className={labelClass}>영업사원 *</label>
                        <input value={salesRep} onChange={(e) => setSalesRep(e.target.value)} placeholder="홍길동" className={compactInputClass} disabled={!canCreate} />
                      </div>
                      <div>
                        <label className={labelClass}>영업사원 전화번호 *</label>
                        <input value={salesRepPhone} onChange={(e) => setSalesRepPhone(formatPhoneKR(e.target.value))} placeholder="010-0000-0000" inputMode="tel" className={compactInputClass} disabled={!canCreate} />
                      </div>
                    </div>

                    {/* 3행: 금융구분 / 용도구분 / 세부구분 / 임시번호판 반납여부 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
                      <div>
                        <label className={labelClass}>금융구분 *</label>
                        <select value={financeType} onChange={(e) => setFinanceType(e.target.value as any)} className={compactInputClass} disabled={!canCreate}>
                          <option value="">선택</option>
                          <option value="할부">할부</option>
                          <option value="리스">리스</option>
                          <option value="현금">현금</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>용도구분 *</label>
                        <select
                          value={vehicleUseType}
                          onChange={(e) => {
                            const next = e.target.value as "영업용" | "자가용";
                            setVehicleUseType(next);
                            if (next !== "영업용") setBusinessType("");
                          }}
                          className={compactInputClass}
                          disabled={!canCreate}
                        >
                          <option value="자가용">자가용</option>
                          <option value="영업용">영업용</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>세부구분 {vehicleUseType === "영업용" && "*"}</label>
                        <select value={businessType} onChange={(e) => setBusinessType(e.target.value as any)} className={compactInputClass} disabled={!canCreate || vehicleUseType !== "영업용"}>
                          <option value="">선택</option>
                          <option value="개별">개별</option>
                          <option value="용달">용달</option>
                          <option value="지입">지입</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>임시번호판 반납여부 *</label>
                        <div className="h-[48px] w-full rounded-xl border border-gray-200 bg-white flex items-center gap-4 px-4">
                          <label className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 cursor-pointer">
                            <input type="radio" name="tempPlateReturned" checked={tempPlateReturned === true} onChange={() => setTempPlateReturned(true)} className="h-4 w-4 accent-orange-500" disabled={!canCreate} /> Y
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 cursor-pointer">
                            <input type="radio" name="tempPlateReturned" checked={tempPlateReturned === false} onChange={() => setTempPlateReturned(false)} className="h-4 w-4 accent-orange-500" disabled={!canCreate} /> N
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* 3행 하위 조건부 입력: 롯데오토리스 / 리스사명 / 예정 반납일자 */}
                    {(financeType === "할부" || financeType === "리스" || tempPlateReturned === false) && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
                        {financeType === "할부" && (
                          <div>
                            <label className={labelClass}>롯데오토리스 여부</label>
                            <div className="h-[48px] w-full rounded-xl border border-gray-200 bg-white flex items-center gap-4 px-4">
                              <label className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 cursor-pointer">
                                <input type="radio" name="lotte" checked={lotte === true} onChange={() => setLotte(true)} className="h-4 w-4 accent-orange-500" disabled={!canCreate} /> Y
                              </label>
                              <label className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 cursor-pointer">
                                <input type="radio" name="lotte" checked={lotte === false} onChange={() => setLotte(false)} className="h-4 w-4 accent-orange-500" disabled={!canCreate} /> N
                              </label>
                            </div>
                          </div>
                        )}
                        {financeType === "리스" && (
                          <div>
                            <label className={labelClass}>리스사명 *</label>
                            <input value={leaseCompany} onChange={(e) => setLeaseCompany(e.target.value)} placeholder="예: 현대캐피탈" className={compactInputClass} disabled={!canCreate} />
                          </div>
                        )}
                        {tempPlateReturned === false && (
                          <div>
                            <label className={labelClass}>예정 반납일자 *</label>
                            <input type="date" value={dotsToDateInputValue(tempPlateReturnDueDate)} onChange={(e) => setTempPlateReturnDueDate(dateInputValueToDots(e.target.value))} className={compactInputClass} disabled={!canCreate} />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* 특이사항 */}
                <div>
                  <label className={labelClass}>특이사항</label>
                  <textarea value={specialNote} onChange={(e) => setSpecialNote(e.target.value)} placeholder="고객 요청사항 / 특이사항 / 보험사 정보..." className="w-full min-h-[80px] px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all" disabled={!canCreate} />
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={onReset} disabled={saving || !canCreate} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-navy-900 font-semibold text-sm hover:shadow-md transition-all disabled:opacity-50">
                    초기화
                  </button>
                  <button type="button" onClick={onAdd} disabled={saving || !canCreate || !isCreateFormValid} title={!isCreateFormValid ? "모든 필수 항목을 입력해주세요" : undefined} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all disabled:opacity-50">
                    {saving ? "저장중..." : "접수 등록"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── focusId: 특정 딜 단독 뷰 배너 ── */}
        {focusId && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
            <button
              onClick={() => navigate("/narumi")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50 transition-all shrink-0"
            >
              ← 전체 목록
            </button>
            <p className="text-sm text-blue-700 font-medium">
              AI비서에서 선택한 건만 표시 중입니다
            </p>
          </div>
        )}

        {/* ── 카드 목록 ── */}
        {loading && (
          <div className="py-3 text-center text-sm text-gray-400">로딩 중...</div>
        )}

        <div className="space-y-4">
          {filteredRows.map((r) => {
            const isLocked   = isLockedAfterUpload(r);
            const isHold     = isOnHold(r);
            const isDone     = isAllDone(r);
            const canDocUp   = isVehicleDocKeyEnabled(r);
            const memoValue  = memoDrafts[String(r.id)] ?? r.special_note ?? "";
            const memoChanged = memoValue !== (r.special_note ?? "");
            const canEditMemoNow = canEditMemo;
            const displayPhone = getDisplayPhone(r);
            const displayName  = getDisplayCustomerName(r);
            const dialable     = getDialablePhone(r);
            const brokeragePending = isBrokeragePending(r);
            const urgent = !brokeragePending && !isLocked && !isHold && isUrgentDelivery(r.delivery_date_text);

            return (
              <div key={r.id} className={`rounded-xl border bg-white shadow-sm hover:shadow-md transition-all overflow-hidden ${isHold ? "border-gray-300 opacity-75" : isLocked ? "border-emerald-200" : "border-gray-200"}`}>

                {/* 카드 헤더 */}
                <div className="flex items-start justify-between gap-3 px-4 md:px-3.5 pt-5 pb-4 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 상태 뱃지 */}
                    <span className={`${pillBase} ${
                      brokeragePending ? "bg-purple-50 text-purple-700 border border-purple-200" :
                      isLocked ? pillDone :
                      isHold ? pillGray :
                      deriveStatus(r) === "registered" ? pillDone :
                      deriveStatus(r) === "docs" ? pillProg :
                      deriveStatus(r) === "insurance" ? pillProg :
                      pillGray
                    }`}>
                      {brokeragePending ? "번호판중개대기" : isLocked ? "차량등록증 완료" : isHold ? "보류" : statusLabel(deriveStatus(r))}
                    </span>
                    {urgent && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl border border-red-300 bg-red-50 text-red-700 text-xs font-bold animate-pulse">긴급</span>
                    )}
                    {r.is_lotte_autolease && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold">롯데</span>
                    )}
                    <span className="text-base font-semibold text-navy-900">
                      {r.vin_last6 ?? r.vin?.slice(-6) ?? "-"}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{r.case_no ?? `#${String(r.id)}`}</span>
                    {r.vehicle_use_type && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 text-xs font-medium">{r.vehicle_use_type}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEditExisting && (
                      <button type="button" onClick={() => openEditModal(r)} className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-gray-300 hover:shadow-sm transition-all">
                        수정
                      </button>
                    )}
                  </div>
                </div>

                {/* 카드 바디 */}
                <div className="px-4 md:px-3.5 py-2.5 grid grid-cols-1 md:grid-cols-2 gap-3">

                  {/* 왼쪽: 기본 정보 + 단계 버튼 */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className={infoLabel}>VIN</p>
                        <p className={infoValue}>{r.vin || "-"}</p>
                      </div>
                      <div>
                        <p className={infoLabel}>출고일</p>
                        <p className={infoValue}>{r.delivery_date_text || "-"}</p>
                      </div>
                      <div>
                        <p className={infoLabel}>고객명</p>
                        <p className={infoValue}>{displayName}</p>
                      </div>
                      <div>
                        <p className={infoLabel}>전화번호</p>
                        {dialable && !shouldMaskPhoneForUI(r) ? (
                          <a href={`tel:${dialable}`} className="mt-1 text-sm font-semibold text-orange-600 hover:underline break-all">
                            {displayPhone}
                          </a>
                        ) : (
                          <p className={infoValue}>{displayPhone}</p>
                        )}
                      </div>
                      <div>
                        <p className={infoLabel}>영업사원</p>
                        <p className={infoValue}>
                          {r.sales_rep || "-"}
                          {r.sales_rep_phone && (
                            <>
                              {" / "}
                              <a href={`tel:${onlyDigits(r.sales_rep_phone)}`} className="font-semibold text-orange-600 hover:underline">
                                {formatPhoneKR(r.sales_rep_phone)}
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className={infoLabel}>접수일시</p>
                        <p className={infoValue}>{formatCreatedAt(r.created_at)}</p>
                      </div>
                      <div>
                        <p className={infoLabel}>금융구분</p>
                        <p className={infoValue}>
                          {r.finance_type || "-"}
                          {r.finance_type === "할부" && (r.is_lotte_autolease ? " (롯데오토리스 Y)" : " (롯데오토리스 N)")}
                          {r.finance_type === "리스" && r.lease_company ? ` (${r.lease_company})` : ""}
                        </p>
                      </div>
                      <div>
                        <p className={infoLabel}>용도</p>
                        <p className={infoValue}>{r.vehicle_use_type || "-"}{r.business_type ? ` / ${r.business_type}` : ""}</p>
                      </div>
                      <div>
                        <p className={infoLabel}>임시번호판 반납</p>
                        <p className="mt-1">
                          {r.temp_plate_returned === true ? (
                            <span className={`${pillBase} ${pillDone}`}>Y</span>
                          ) : r.temp_plate_returned === false ? (
                            <span className={`${pillBase} ${pillProg}`}>N{r.temp_plate_return_due_date ? ` · ${r.temp_plate_return_due_date}` : ""}</span>
                          ) : (
                            <span className={`${pillBase} ${pillGray}`}>-</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* 단계 버튼 */}
                    {brokeragePending ? (
                      <div>
                        <p className={`${infoLabel} mb-2`}>번호판 중개 결과</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={r.brokerage_result ?? ""}
                            onChange={(e) => saveBrokerageResult(r.id, e.target.value || null)}
                            disabled={!canChangeStatus}
                            className={compactInputClass + " !h-[40px] !w-auto"}
                          >
                            <option value="">결과 미정</option>
                            <option value="중개완료">중개완료</option>
                            <option value="보류">보류</option>
                            <option value="취소">취소</option>
                          </select>
                          {canChangeStatus && (
                            <button
                              type="button"
                              onClick={() => openDispatchModal(r)}
                              className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all"
                            >
                              출고
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className={`${infoLabel} mb-2`}>진행 단계</p>
                        <div className="flex flex-wrap gap-2">
                          {/* 보험 */}
                          <button
                            type="button"
                            disabled={isLocked || isHold || !canChangeStatus || r.has_insurance}
                            onClick={() => handleInsuranceButtonClick(r)}
                            className={`${btnBase} ${isLocked || isHold || r.has_insurance ? btnDisabled : btnOff}`}
                          >
                            보험
                          </button>
                          {/* 등록서류 */}
                          <button
                            type="button"
                            disabled={isLocked || isHold || !canChangeStatus}
                            onClick={() => !isLocked && !isHold && toggleStage(r.id, "docs_ready")}
                            className={`${btnBase} ${isLocked || isHold ? btnDisabled : r.docs_ready ? btnOn : btnOff}`}
                          >
                            등록서류
                          </button>
                          {/* 등록완료 */}
                          <button
                            type="button"
                            disabled={isLocked || isHold || !canChangeStatus}
                            onClick={() => !isLocked && !isHold && toggleStage(r.id, "is_registered")}
                            className={`${btnBase} ${isLocked || isHold ? btnDisabled : r.is_registered ? btnOn : btnOff}`}
                          >
                            등록완료
                          </button>
                          {/* 차량등록증 */}
                          <button
                            type="button"
                            disabled={!canDocUp}
                            onClick={() => onClickVehicleDocUpload(r)}
                            className={`${btnBase} ${!canDocUp ? btnDisabled : isLocked ? btnOn : btnOff}`}
                          >
                            {uploadingId === r.id ? "업로드중" : "차량등록증"}
                          </button>
                          {/* 우편발송 — 등록완료 상태이고 canChangeStatus 권한이 있으면 isLocked 여부 관계없이 표시 */}
                          {r.is_registered && canChangeStatus && (
                            <button
                              type="button"
                              onClick={() => postalOpenRowId === r.id ? closePostalForm() : openPostalForm(r)}
                              className={`${btnBase} ${r.postal_mail_sent ? btnOn : btnOff}`}
                              title={r.postal_mail_sent ? "우편발송 정보 조회/수정" : "우편발송 정보 입력"}
                            >
                              {r.postal_mail_sent ? "우편조회" : "우편발송"}
                            </button>
                          )}
                          {/* 보류 — 등록완료 전이고 잠금 전일 때만 표시 */}
                          {!r.is_registered && canChangeStatus && !isLocked && (
                            <button
                              type="button"
                              onClick={() => toggleHold(r)}
                              className={`${btnBase} ${isHold ? "bg-gray-500 text-white border-gray-500" : btnOff}`}
                            >
                              {isHold ? "보류해제" : "보류"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 제작증 / 차량등록증 다운로드 */}
                    <div className="flex flex-wrap gap-2">
                      {r.manufacture_doc_path ? (
                        <button
                          type="button"
                          onClick={() => openStorageFile(r.manufacture_doc_path!).catch((e: any) => alert(e?.message || "보기 실패"))}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-navy-900 font-semibold text-xs hover:shadow-md transition-all"
                        >
                          제작증 보기
                        </button>
                      ) : (
                        !isLocked && canCreate && (
                          <button
                            type="button"
                            onClick={() => onClickManufactureAttach(r)}
                            disabled={manufactureUploadingId === r.id}
                            className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-600 font-semibold text-xs hover:shadow-md transition-all disabled:opacity-50"
                          >
                            {manufactureUploadingId === r.id ? "첨부중..." : "제작증 첨부"}
                          </button>
                        )
                      )}
                      {r.vehicle_doc_path && (
                        <button
                          type="button"
                          onClick={() => openStorageFile(r.vehicle_doc_path!).catch((e: any) => alert(e?.message || "보기 실패"))}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold text-xs hover:shadow-md transition-all"
                        >
                          차량등록증 보기
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 오른쪽: 우편 발송 + 메모 */}
                  <div className="space-y-4">
                    {/* 우편 발송 */}
                    {r.is_registered && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className={`${infoLabel}`}>우편 발송</p>
                        </div>

                        {r.postal_mail_sent ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`${pillBase} ${pillDone}`}>발송완료</span>
                              {r.postal_sent_date && <span className="text-xs text-gray-500">{r.postal_sent_date}</span>}
                            </div>
                            {r.postal_tracking_no && (
                              <button
                                type="button"
                                onClick={() => openPostalTrackingLookup(r.postal_tracking_no!)}
                                className="text-xs font-semibold text-orange-500 hover:underline"
                              >
                                {r.postal_tracking_no} (조회)
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className={`${pillBase} ${pillGray}`}>미발송</span>
                        )}

                        {postalOpenRowId === r.id && (
                          <div className="mt-3 space-y-2">
                            <div>
                              <label className={labelClass}>등기번호</label>
                              <input value={postalTrackingNo} onChange={(e) => setPostalTrackingNo(e.target.value)} placeholder="등기번호 입력" className={compactInputClass} />
                            </div>
                            <div>
                              <label className={labelClass}>발송일</label>
                              <input type="date" value={postalSentDate} onChange={(e) => setPostalSentDate(e.target.value)} className={compactInputClass} />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={closePostalForm} className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:shadow-sm transition-all">취소</button>
                              <button type="button" onClick={() => savePostalInfo(r)} disabled={postalSavingId === r.id} className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50">
                                {postalSavingId === r.id ? "저장중..." : "저장"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 메모 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className={infoLabel}>특이사항 / 메모</p>
                        {memoChanged && canEditMemoNow && (
                          <button
                            type="button"
                            disabled={memoSavingId === r.id}
                            onClick={() => saveMemo(r.id)}
                            className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-all disabled:opacity-50"
                          >
                            {memoSavingId === r.id ? "저장중..." : "저장"}
                          </button>
                        )}
                      </div>

                      {canEditMemoNow ? (
                        <textarea
                          value={memoValue}
                          onChange={(e) => setMemoDrafts((prev) => ({ ...prev, [String(r.id)]: e.target.value }))}
                          placeholder="관리자/보험전담 계정만 메모 입력/수정 가능"
                          className="w-full h-[88px] text-sm text-gray-700 rounded-xl bg-white border border-gray-200 px-4 py-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all"
                        />
                      ) : (
                        <div className="h-[88px] overflow-y-auto text-sm text-gray-700 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                          {r.special_note?.trim() ? r.special_note : <span className="text-gray-400">-</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && filteredRows.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-center text-sm text-gray-500">
              조회 결과가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* ── 수정 모달 ── */}
      {editRow && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500">Edit</p>
                <h2 className="mt-1 text-sm font-semibold text-navy-900">기본정보 수정</h2>
                <p className="mt-1 text-sm text-gray-500">차대번호, 고객명, 전화번호, 영업사원 정보를 수정합니다.</p>
              </div>
              <button type="button" onClick={closeEditModal} disabled={editSaving} className="h-9 w-9 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:border-gray-300 disabled:opacity-50 transition-all">×</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>차대번호(VIN) *</label>
                <input value={editVin} onChange={(e) => setEditVin(normalizeVin(e.target.value))} className={compactInputClass} disabled={!isPrivilegedManager || editSaving} placeholder="예: KMH..." />
                {!isPrivilegedManager && <p className="mt-1 text-xs text-gray-400">차대번호는 관리자/보험전담 계정만 수정 가능합니다.</p>}
              </div>
              <div>
                <label className={labelClass}>고객명 *</label>
                <input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} className={compactInputClass} disabled={editSaving} placeholder="예: 홍길동" />
              </div>
              <div>
                <label className={labelClass}>전화번호 *</label>
                <input value={editCustomerPhone} onChange={(e) => setEditCustomerPhone(formatPhoneKR(e.target.value))} className={compactInputClass} disabled={editSaving} inputMode="tel" placeholder="010-1234-5678" />
                <p className="mt-1 text-xs text-gray-400">전화번호 변경 시 마스킹 기준시간이 다시 시작됩니다.</p>
              </div>
              <div>
                <label className={labelClass}>영업사원 *</label>
                <input value={editSalesRep} onChange={(e) => setEditSalesRep(e.target.value)} className={compactInputClass} disabled={editSaving} placeholder="예: 홍길동" />
              </div>
              <div>
                <label className={labelClass}>영업사원 연락처 *</label>
                <input value={editSalesRepPhone} onChange={(e) => setEditSalesRepPhone(formatPhoneKR(e.target.value))} className={compactInputClass} disabled={editSaving} inputMode="tel" placeholder="010-1234-5678" />
              </div>
              <div>
                <label className={labelClass}>용도 구분 *</label>
                <select value={editVehicleUseType} onChange={(e) => setEditVehicleUseType(e.target.value as any)} className={compactInputClass} disabled={editSaving}>
                  <option value="영업용">영업용</option>
                  <option value="자가용">자가용</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>ID</label>
                <input value={String(editRow.id)} readOnly className={compactInputClass + " !bg-gray-50 !text-gray-400 cursor-not-allowed"} />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>특이사항</label>
              <textarea value={editSpecialNote} onChange={(e) => setEditSpecialNote(e.target.value)} placeholder="고객 요청사항 / 특이사항 / 보험사 정보 / 등록 관련 메모..." className="min-h-[90px] w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all" disabled={editSaving} />
            </div>

            <div className="mt-3 flex justify-end gap-3">
              <button type="button" onClick={closeEditModal} disabled={editSaving} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:shadow-md transition-all disabled:opacity-50">취소</button>
              <button type="button" onClick={saveEditRow} disabled={editSaving} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50">{editSaving ? "저장중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 출고 처리 모달 (번호판 중개 건 → 정식 건 전환) ── */}
      {dispatchRow && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500">Dispatch</p>
                <h2 className="mt-1 text-sm font-semibold text-navy-900">출고 처리 — 정식 건 전환</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {getDisplayCustomerName(dispatchRow)} / {getDisplayPhone(dispatchRow)} — 아래 항목을 모두 입력하면 일반 건과 동일하게 진행됩니다.
                </p>
              </div>
              <button type="button" onClick={closeDispatchModal} disabled={dispatchSaving} className="h-9 w-9 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:border-gray-300 disabled:opacity-50 transition-all">×</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>차대번호(VIN) *</label>
                <input value={dispatchVin} onChange={(e) => setDispatchVin(normalizeVin(e.target.value))} className={compactInputClass} disabled={dispatchSaving} placeholder="예: KMH..." />
              </div>
              <div>
                <label className={labelClass}>출고일자 *</label>
                <input type="date" value={dotsToDateInputValue(dispatchDeliveryText)} onChange={(e) => setDispatchDeliveryText(dateInputValueToDots(e.target.value))} className={compactInputClass} disabled={dispatchSaving} />
              </div>
              <div>
                <label className={labelClass}>금융구분 *</label>
                <select value={dispatchFinanceType} onChange={(e) => setDispatchFinanceType(e.target.value as any)} className={compactInputClass} disabled={dispatchSaving}>
                  <option value="">선택</option>
                  <option value="할부">할부</option>
                  <option value="리스">리스</option>
                  <option value="현금">현금</option>
                </select>
              </div>
              {dispatchFinanceType === "할부" && (
                <div>
                  <label className={labelClass}>롯데오토리스 여부</label>
                  <div className="h-[48px] w-full rounded-xl border border-gray-200 bg-white flex items-center gap-4 px-4">
                    <label className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 cursor-pointer">
                      <input type="radio" name="dispatchLotte" checked={dispatchLotte === true} onChange={() => setDispatchLotte(true)} className="h-4 w-4 accent-orange-500" disabled={dispatchSaving} /> Y
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 cursor-pointer">
                      <input type="radio" name="dispatchLotte" checked={dispatchLotte === false} onChange={() => setDispatchLotte(false)} className="h-4 w-4 accent-orange-500" disabled={dispatchSaving} /> N
                    </label>
                  </div>
                </div>
              )}
              {dispatchFinanceType === "리스" && (
                <div>
                  <label className={labelClass}>리스사명 *</label>
                  <input value={dispatchLeaseCompany} onChange={(e) => setDispatchLeaseCompany(e.target.value)} placeholder="예: 현대캐피탈" className={compactInputClass} disabled={dispatchSaving} />
                </div>
              )}
              <div>
                <label className={labelClass}>세부구분 *</label>
                <select value={dispatchBusinessType} onChange={(e) => setDispatchBusinessType(e.target.value as any)} className={compactInputClass} disabled={dispatchSaving}>
                  <option value="">선택</option>
                  <option value="개별">개별</option>
                  <option value="용달">용달</option>
                  <option value="지입">지입</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>임시번호판 반납여부 *</label>
                <div className="h-[48px] w-full rounded-xl border border-gray-200 bg-white flex items-center gap-4 px-4">
                  <label className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 cursor-pointer">
                    <input type="radio" name="dispatchTempPlateReturned" checked={dispatchTempPlateReturned === true} onChange={() => setDispatchTempPlateReturned(true)} className="h-4 w-4 accent-orange-500" disabled={dispatchSaving} /> Y
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 cursor-pointer">
                    <input type="radio" name="dispatchTempPlateReturned" checked={dispatchTempPlateReturned === false} onChange={() => setDispatchTempPlateReturned(false)} className="h-4 w-4 accent-orange-500" disabled={dispatchSaving} /> N
                  </label>
                </div>
              </div>
              {dispatchTempPlateReturned === false && (
                <div>
                  <label className={labelClass}>예정 반납일자 *</label>
                  <input type="date" value={dotsToDateInputValue(dispatchTempPlateReturnDueDate)} onChange={(e) => setDispatchTempPlateReturnDueDate(dateInputValueToDots(e.target.value))} className={compactInputClass} disabled={dispatchSaving} />
                </div>
              )}
              <div>
                <label className={labelClass}>영업사원 *</label>
                <input value={dispatchSalesRep} onChange={(e) => setDispatchSalesRep(e.target.value)} className={compactInputClass} disabled={dispatchSaving} placeholder="예: 홍길동" />
              </div>
              <div>
                <label className={labelClass}>영업사원 연락처 *</label>
                <input value={dispatchSalesRepPhone} onChange={(e) => setDispatchSalesRepPhone(formatPhoneKR(e.target.value))} className={compactInputClass} disabled={dispatchSaving} inputMode="tel" placeholder="010-1234-5678" />
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-3">
              <button type="button" onClick={closeDispatchModal} disabled={dispatchSaving} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:shadow-md transition-all disabled:opacity-50">취소</button>
              <button type="button" onClick={saveDispatch} disabled={dispatchSaving || !isDispatchFormValid} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all disabled:opacity-50">{dispatchSaving ? "저장중..." : "출고 확정"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 보험 모달 ── */}
      {insuranceModalRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xl">
            <p className="text-xs font-medium tracking-[0.12em] uppercase text-orange-500 mb-2">Insurance</p>
            <h2 className="text-sm font-semibold text-navy-900 mb-3">당사에서 가입하나요?</h2>
            <p className="text-sm leading-6 text-gray-600">
              Y를 선택하면 상담관리 페이지의 보험 상담등록 화면으로 이동합니다.<br />
              N을 선택하면 현재 업무목록에서 보험 단계가 즉시 완료됩니다.
            </p>
            <div className="mt-3 flex justify-end gap-3">
              <button type="button" onClick={() => setInsuranceModalRow(null)} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:shadow-md transition-all">취소</button>
              <button type="button" onClick={completeInsuranceAsN} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-emerald-600 bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all">N</button>
              <button type="button" onClick={moveToCallManagementForInsurance} className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all">Y</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}