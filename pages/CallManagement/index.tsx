import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// 브라우저 로컬(한국) 시간 기준 오늘 날짜 — toISOString()은 UTC 변환 과정에서
// 자정 근처 시간대에 하루가 밀리는 문제가 있어 사용하지 않음.
function todayLocalStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type TabKey = "new" | "list" | "followups";
type WorkType =
  | ""
  | "registration_insurance"
  | "tire_sales"
  | "finance"
  | "forklift_sales"
  | "battery_sales"
  | "export";

type ConsultationRow = {
  id: number;
  created_at: string;
  updated_at: string;
  call_datetime: string | null;
  customer_name: string;
  phone: string;
  telecom_provider: string | null;
  company_name: string | null;
  region: string | null;
  work_type:
    | "registration_insurance"
    | "tire_sales"
    | "finance"
    | "forklift_sales"
    | "battery_sales"
    | "export";
  sub_type: string | null;
  status: string;
  summary: string;
  detail_memo: string | null;
  followup_needed: boolean;
  next_followup_date: string | null;
};

type TireDetailRow = {
  consultation_id: number;
  vehicle_info: string | null;
  vehicle_type: string | null;
  tire_size: string | null;
  quantity: number | null;
  front_quantity: number | null;
  rear_quantity: number | null;
  region_detail: string | null;
  inflow_channel: string | null;
  association_name: string | null;
  process_status: string | null;
  note: string | null;
};

type InsuranceDetailRow = {
  consultation_id: number;
  vehicle_no: string | null;
  vehicle_model: string | null;
  vehicle_use: string | null;
  insurance_request: string | null;
  insurance_type: string | null;
  job: string | null;
  insurance_company: string | null;
  insurance_start_date: string | null;
  insurance_end_date: string | null;
  design_requested: boolean | null;
  application_issued: boolean | null;
  payment_completed: boolean | null;
  policy_issued: boolean | null;
  process_status: string | null;
  urgency: string | null;
  note: string | null;
};

type FinanceDetailRow = {
  consultation_id: number;
  finance_category: string | null;
  finance_vehicle_model: string | null;
  finance_product: string | null;
  finance_company: string | null;
  finance_amount: number | null;
  finance_period: number | null;
  finance_interest_rate: number | null;
  finance_incentive: number | null;
  finance_stage: string | null;
  finance_aftercare: boolean | null;
  note: string | null;
};

// ── 현대CM(hyundaicm_tasks) / 태산통운(taesan_tasks) 통합 표시용 ──
// 두 테이블은 구조가 동일(HCMTask/TaesanTask 스키마 공유)하므로 하나의 타입으로 병합해서
// 상담관리 금융탭에 함께 보여준다. _source로 원본 테이블을 구분한다.
type ExternalFinanceSource = "hyundaicm" | "taesan";
type ExternalFinanceRow = {
  id: number;
  _source: ExternalFinanceSource;
  customer_type: string | null;
  customer_name: string;
  customer_phone: string | null;
  company_name: string | null;
  ceo_name: string | null;
  equipment_ton: string | null;
  purchase_amount: number | null;
  vehicle_amount: number | null;
  attach_amount: number | null;
  installment_principal: number | null;
  grace_period: number | null;
  installment_period: number | null;
  finance_company: string | null;
  interest_rate: number | null;
  incentive: number | null;
  sales_rep: string | null;
  status: string;
  special_note: string | null;
  created_at: string;
};

const EXTERNAL_FINANCE_STATUSES = ["접수", "신용조회", "승인", "보완", "거절", "확정"] as const;
function externalFinanceSourceLabel(source: ExternalFinanceSource) {
  return source === "hyundaicm" ? "🏗 현대CM" : "🚛 태산통운";
}
function externalFinanceFullPageUrl(row: ExternalFinanceRow) {
  return row._source === "hyundaicm" ? `/hyundaicm?id=${row.id}` : `/taesan?id=${row.id}`;
}


type ForkliftDetailRow = {
  consultation_id: number;
  forklift_condition: string | null;
  forklift_type: string | null;
  forklift_ton: string | null;
  forklift_status: string | null;
  forklift_option_note: string | null;
  forklift_sale_method: string | null;
  note: string | null;
};

type BatteryDetailRow = {
  consultation_id: number;
  battery_vehicle_type: string | null;
  battery_drive_type: string | null;

  battery_voltage: number | null;
  battery_capacity_ah: number | null;
  battery_total_capacity_kwh: number | null;
  battery_size_l: number | null;
  battery_due_date: string | null;
  battery_weight_kg: number | null;
  battery_expected_price: number | null;
  battery_unit_price_per_kwh: number | null;
  battery_exchange_rate: number | null;
  battery_unit_sale_price: number | null;
  battery_quantity: number | null;
  battery_sale_price: number | null;
  note: string | null;
};

type InsuranceExpiryRow = {
  consultation_id: number;
  insurance_end_date: string | null;
  insurance_company: string | null;
  insurance_type: string | null;
  vehicle_no: string | null;
  consultation_cases: {
    id: number;
    customer_name: string;
    phone: string;
    telecom_provider: string | null;
    company_name: string | null;
  } | null;
};

// ── 매출 등록(계산서 매칭) 모달 타입 ─────────────────────────────────────────
const SALES_CATEGORIES = ["타이어", "지게차렌탈", "건설기계수출", "배터리(LFP)", "배터리(납산)", "렌탈사업", "기타"];
const SALES_TRADE_TYPES = ["내수", "수출"] as const;

type InvoiceRegForm = {
  invoice_no: string;
  issue_date: string;
  customer_name: string;
  business_no: string;
  supply_amount: string;
  tax_amount: string;
  total_amount: string;
  items: string;
};

function makeEmptyInvoiceRegForm(): InvoiceRegForm {
  return {
    invoice_no: "",
    issue_date: todayLocalStr(),
    customer_name: "",
    business_no: "",
    supply_amount: "",
    tax_amount: "",
    total_amount: "",
    items: "",
  };
}

type InvoiceRegRow = {
  consultation_id: number;
  customer_name: string;
  category: string;
  trade_type: "내수" | "수출";
  maker: string;
  spec: string;
  quantity: string;
  unit_price: string;
  unit_cost: string;
};

function calcInvoiceRegRowRevenue(r: InvoiceRegRow) {
  const qty = parseFloat(r.quantity) || 0;
  const price = parseFloat(r.unit_price) || 0;
  const vat = r.trade_type === "수출" ? 1 : 1.1;
  return qty * price * vat;
}

const NON_LIFE_INSURERS = [
  "삼성화재",
  "현대해상",
  "KB손해보험",
  "메리츠화재",
  "한화손해보험",
  "DB손해보험",
  "롯데손해보험",
  "흥국화재",
  "NH농협손해보험",
  "예별손해보험",
  "AIG손해보험",
  "하나손해보험",
];

const LIFE_INSURERS = [
  "한화생명",
  "ABL생명",
  "삼성생명",
  "흥국생명",
  "교보생명",
  "iM라이프생명",
  "미래에셋생명",
  "KDB생명",
  "DB생명",
  "동양생명",
  "메트라이프생명",
  "KB라이프생명",
  "신한라이프생명",
  "라이나생명",
  "AIA생명",
  "NH농협생명",
];

const TIRE_INFLOW_CHANNELS = ["association", "gotruck", "etc"] as const;
const TIRE_ASSOCIATIONS = ["서울", "광주", "경북", "경남"] as const;

const tabBase   = "px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all";
const tabActive  = "bg-[#0f172a] text-white border-[#0f172a]";
const tabInactive = "bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-200";

const typeBtnBase    = "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all";
const typeBtnActive  = "bg-orange-500 text-white border-orange-500";
const typeBtnInactive = "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600";

const card         = "border border-gray-200 rounded-2xl bg-white shadow-sm";
const dashboardCard = "border border-gray-200 rounded-2xl bg-white p-3.5 shadow-sm";
const compactCard  = "border border-gray-200 rounded-2xl bg-gray-50 p-3";

const controlClass =
  "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-[#0f172a] bg-white " +
  "focus:outline-none focus:border-orange-400 transition-all";
const insuranceEqualFieldStyle = {
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box" as const,
};
const insuranceEqualDateFieldStyle = {
  ...insuranceEqualFieldStyle,
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
};
const compactControlClass =
  "w-full h-9 rounded-xl border border-gray-200 px-3 text-xs text-[#0f172a] bg-white " +
  "focus:outline-none focus:border-orange-400 transition-all";
const textareaClass =
  "w-full min-h-[96px] rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#0f172a] bg-white resize-none " +
  "focus:outline-none focus:border-orange-400 transition-all";

const labelClass = "block text-xs font-medium text-gray-500 mb-1";
const compactLabelClass = "block text-xs font-medium text-gray-600 mb-1";
const compactInputClass =
  "w-full rounded-xl border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400 transition-all";

const thClass =
  "px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase border-b border-gray-100 whitespace-nowrap";
const tdClass =
  "px-3 py-2.5 text-sm text-gray-700 border-b border-gray-100 align-middle whitespace-nowrap";

const actionBtnClass =
  "px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:border-gray-300 whitespace-nowrap transition-all";
const completeBtnClass =
  "px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 whitespace-nowrap transition-all";
const sectionTitleClass =
  "text-sm font-semibold text-orange-500 mr-3";

// 인라인 항목: 라벨+값이 한 쌍으로 flex item
const detailLabelClass = "text-[10px] text-gray-400 mr-0.5";
const detailValueClass = "text-[12px] text-gray-800 font-semibold";
const inlineDetailBoxClass =
  "bg-gray-50 border border-orange-100 rounded-xl px-3 py-2 w-full";
// dl 행: 인라인 쌍
const dlRowClass = "inline-flex items-baseline gap-0.5 mr-4 mb-0.5";

const grid5Class = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4";
const dashboardGridClass = "grid grid-cols-1 xl:grid-cols-3 gap-4";
const compactGridClass = "grid grid-cols-1 md:grid-cols-3 gap-3";
const filterGridClass = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-3";

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function onlyKoreanAndDigits(value: string) {
  return value.replace(/[^가-힣0-9]/g, "");
}

function onlyEnglishTireSize(value: string) {
  return value;
}

function formatNumberWithCommas(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function formatAmountDisplay(value: number | null) {
  if (value === null || value === undefined) return "-";
  return `${Number(value).toLocaleString("ko-KR")}원`;
}

function formatPercentDisplay(value: number | null) {
  if (value === null || value === undefined) return "-";
  return `${value}%`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ko-KR");
}

function formatWorkType(value: ConsultationRow["work_type"] | string | null) {
  if (value === "registration_insurance") return "보험";
  if (value === "tire_sales") return "타이어";
  if (value === "finance") return "금융";
  if (value === "export") return "수출";
  return value || "-";
}

function formatDateOnly(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("ko-KR");
  return value.includes("T") ? value.slice(0, 10) : value;
}


function formatCompactSummary(row: ConsultationRow) {
  const wt = formatWorkType(row.work_type);
  const st = (row as any).sub_type;
  return `${wt}${st ? `(${st})` : ""} / ${row.customer_name || "-"}`;
}

function formatDateInputValue(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value.includes("T") ? value.slice(0, 10) : value;
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeVehicleNo(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

async function syncNarumiInsuranceByVehicleNo(vehicleNo: string | null | undefined) {
  const normalizedVin = normalizeVehicleNo(vehicleNo);
  if (!normalizedVin) return;

  const { data: narumiRows, error: narumiFetchError } = await supabase
    .from("narumi_tasks")
    .select("id, vin, docs_ready, is_registered, vehicle_doc_path")
    .eq("vin", normalizedVin);

  if (narumiFetchError) throw narumiFetchError;
  if (!Array.isArray(narumiRows) || narumiRows.length === 0) return;

  const { data: issuedRows, error: issuedFetchError } = await supabase
    .from("consultation_insurance_details")
    .select("consultation_id")
    .eq("vehicle_no", normalizedVin)
    .eq("policy_issued", true)
    .limit(1);

  if (issuedFetchError) throw issuedFetchError;

  const hasIssued = Array.isArray(issuedRows) && issuedRows.length > 0;

  for (const narumiRow of narumiRows) {
    let nextStatus = "todo";
    if (narumiRow.vehicle_doc_path) nextStatus = "completed";
    else if (narumiRow.is_registered) nextStatus = "registered";
    else if (narumiRow.docs_ready) nextStatus = "docs";
    else if (hasIssued) nextStatus = "insurance";

    const { error: narumiUpdateError } = await supabase
      .from("narumi_tasks")
      .update({ has_insurance: hasIssued, status: nextStatus })
      .eq("id", narumiRow.id);

    if (narumiUpdateError) throw narumiUpdateError;
  }
}


function getDaysLeft(dateText: string | null) {
  if (!dateText) return null;
  const today = new Date();
  const base = new Date(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}T00:00:00`
  );
  const target = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}

function deriveInsuranceProcessStatus(
  designRequested: boolean,
  applicationIssued: boolean,
  paymentCompleted: boolean,
  policyIssued: boolean
) {
  if (policyIssued) return "policy_issued";
  if (paymentCompleted) return "payment_completed";
  if (applicationIssued) return "application_issued";
  if (designRequested) return "design_requested";
  return null;
}

function deriveNarumiInsuranceStatus(row: {
  has_insurance?: boolean | null;
  docs_ready?: boolean | null;
  is_registered?: boolean | null;
  vehicle_doc_path?: string | null;
}) {
  if (row.vehicle_doc_path) return "completed";
  if (row.is_registered) return "registered";
  if (row.docs_ready) return "docs";
  if (row.has_insurance) return "insurance";
  return "todo";
}

const CallManagementPage: React.FC = () => {
  const { user, loading, isAdmin, isSubAdmin, isInsuranceManager } = useAuth() as any;
  const location = useLocation();
  const navigate = useNavigate();
  const canAccessConsulting = isAdmin || isInsuranceManager;
  const insuranceOnlyScope = isInsuranceManager && !isAdmin;
  // 현대CM/태산통운 통합 섹션: 수정/상태변경은 관리자(admin/subAdmin)만
  const isAdminLevel = isAdmin || isSubAdmin;

  const [tab, setTab] = useState<TabKey>("new");
  const newFormTopRef = useRef<HTMLFormElement | null>(null);
  const customerNameInputRef = useRef<HTMLInputElement | null>(null);
  const appliedNarumiPrefillRef = useRef<string>("");

  const [callDatetime, setCallDatetime] = useState(todayLocalStr());
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [telecomProvider, setTelecomProvider] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [region, setRegion] = useState("");
  const [workType, setWorkType] = useState<WorkType>("");
  const [subType, setSubType] = useState<string>("");
  const [status, setStatus] = useState("new");
  const [nextFollowupDate, setNextFollowupDate] = useState("");

  const [tireVehicleInfo, setTireVehicleInfo] = useState("");
  const [tireVehicleType, setTireVehicleType] = useState("");
  const [tireSize, setTireSize] = useState("");
  const [tireFrontQuantity, setTireFrontQuantity] = useState("");
  const [tireRearQuantity, setTireRearQuantity] = useState("");
  const [tireRegionDetail, setTireRegionDetail] = useState("");
  const [tireInflowChannel, setTireInflowChannel] = useState("");
  const [tireAssociationName, setTireAssociationName] = useState("");
  const [progressStage, setProgressStage] = useState<string>("contract");
  const [tireNote, setTireNote] = useState("");

  const [insuranceVehicleNo, setInsuranceVehicleNo] = useState("");
  const [insuranceVehicleModel, setInsuranceVehicleModel] = useState("");
  const [insuranceVehicleUse, setInsuranceVehicleUse] = useState("");
  const [insuranceRequest, setInsuranceRequest] = useState("");
  const [insuranceType, setInsuranceType] = useState("automobile");
  const [insuranceJob, setInsuranceJob] = useState("");
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [insuranceStartDate, setInsuranceStartDate] = useState(todayLocalStr());
  const [insuranceEndDate, setInsuranceEndDate] = useState(todayLocalStr());
  const [designRequested, setDesignRequested] = useState(false);
  const [applicationIssued, setApplicationIssued] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [policyIssued, setPolicyIssued] = useState(false);
  // 보험 진행상태: 설계요청 / 증권발급 두 단계만 관리
  const handleInsuranceStatusSelect = (value: "requested" | "issued") => {
    if (value === "issued") {
      setDesignRequested(true);
      setApplicationIssued(true);
      setPaymentCompleted(true);
      setPolicyIssued(true);
    } else {
      setDesignRequested(true);
      setApplicationIssued(false);
      setPaymentCompleted(false);
      setPolicyIssued(false);
    }
  };

  const [insuranceNote, setInsuranceNote] = useState("");

  const [financeCategory, setFinanceCategory] = useState("");
  const [financeVehicleModel, setFinanceVehicleModel] = useState("");
  const [financeProduct, setFinanceProduct] = useState("");
  const [financeCompany, setFinanceCompany] = useState("");
  const [financeAmount, setFinanceAmount] = useState("");
  const [financePeriod, setFinancePeriod] = useState("");
  const [financeInterestRate, setFinanceInterestRate] = useState("");
  const [financeIncentive, setFinanceIncentive] = useState("");
  const [financeStage, setFinanceStage] = useState("received");
  const [financeNote, setFinanceNote] = useState("");

  const [forkliftCondition, setForkliftCondition] = useState("");
  const [forkliftType, setForkliftType] = useState("");
  const [forkliftTon, setForkliftTon] = useState("");

  const [forkliftOptionNote, setForkliftOptionNote] = useState("");
  const [forkliftSaleMethod, setForkliftSaleMethod] = useState("");
  const [forkliftNote, setForkliftNote] = useState("");

  const [batteryVehicleType, setBatteryVehicleType] = useState("");
  const [batteryDriveType, setBatteryDriveType] = useState("");

  const [batteryVoltage, setBatteryVoltage] = useState("");
  const [batteryCapacityAh, setBatteryCapacityAh] = useState("");
  const [batterySizeL, setBatterySizeL] = useState("");
  const [batteryDueDate, setBatteryDueDate] = useState(todayLocalStr());
  const [batteryWeightKg, setBatteryWeightKg] = useState("");
  const [batteryUnitPricePerKwh, setBatteryUnitPricePerKwh] = useState("");
  const [batteryExchangeRate, setBatteryExchangeRate] = useState("");
  const [batteryUnitSalePrice, setBatteryUnitSalePrice] = useState("");
  const [batteryQuantity, setBatteryQuantity] = useState("");
  const [batteryNote, setBatteryNote] = useState("");

  const [followupRescheduleMap, setFollowupRescheduleMap] = useState<Record<number, string>>({});
  const [overdueRows, setOverdueRows] = useState<{id:number;customer_name:string;work_type:string|null;created_at:string}[]>([]);
  const [showOverdueModal, setShowOverdueModal] = useState(false);

  // 매출관리(sales_records) 연동 — 이미 등록된 상담건 id 집합
  const [salesRegisteredIds, setSalesRegisteredIds] = useState<Set<number>>(new Set());
  const [registeringSalesId, setRegisteringSalesId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("sales_records")
        .select("consultation_id")
        .not("consultation_id", "is", null);
      if (!error && data) {
        setSalesRegisteredIds(new Set(data.map((d: any) => d.consultation_id as number)));
      }
    })();
  }, []);

  // 매출 등록(계산서 매칭) 모달
  const [showInvoiceRegModal, setShowInvoiceRegModal] = useState(false);
  const [invoiceRegMode, setInvoiceRegMode] = useState<"manual" | "image">("manual");
  const [invoiceRegParsing, setInvoiceRegParsing] = useState(false);
  const [invoiceRegSaving, setInvoiceRegSaving] = useState(false);
  const [invoiceRegForm, setInvoiceRegForm] = useState<InvoiceRegForm>(makeEmptyInvoiceRegForm());
  const [invoiceRegRows, setInvoiceRegRows] = useState<InvoiceRegRow[]>([]);
  const invoiceRegFileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ConsultationRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  const [followups, setFollowups] = useState<ConsultationRow[]>([]);
  const [loadingFollowups, setLoadingFollowups] = useState(false);
  const [followupError, setFollowupError] = useState("");

  const [insuranceDetailsMap, setInsuranceDetailsMap] = useState<
    Record<number, InsuranceDetailRow>
  >({});
  const [tireDetailsMap, setTireDetailsMap] = useState<
    Record<number, TireDetailRow>
  >({});
  const [financeDetailsMap, setFinanceDetailsMap] = useState<
    Record<number, FinanceDetailRow>
  >({});
  const [forkliftDetailsMap, setForkliftDetailsMap] = useState<
    Record<number, ForkliftDetailRow>
  >({});
  const [batteryDetailsMap, setBatteryDetailsMap] = useState<
    Record<number, BatteryDetailRow>
  >({});

  // ── 현대CM(hyundaicm_tasks) + 태산통운(taesan_tasks) 통합 표시 ──
  const [externalFinanceRows, setExternalFinanceRows] = useState<ExternalFinanceRow[]>([]);
  const [externalFinanceLoading, setExternalFinanceLoading] = useState(false);
  const [externalFinanceExpandedKey, setExternalFinanceExpandedKey] = useState<string | null>(null);
  const [externalFinanceEditKey, setExternalFinanceEditKey] = useState<string | null>(null);
  const [externalFinanceDraft, setExternalFinanceDraft] = useState<Partial<ExternalFinanceRow>>({});
  const [externalFinanceSaving, setExternalFinanceSaving] = useState(false);

  const [insuranceExpiries, setInsuranceExpiries] = useState<InsuranceExpiryRow[]>([]);
  const [loadingExpiry, setLoadingExpiry] = useState(false);
  const [expiryError, setExpiryError] = useState("");

  const [listSearchName, setListSearchName] = useState("");
  const [listSearchPhone, setListSearchPhone] = useState("");
  const [listSearchCompany, setListSearchCompany] = useState("");
  const [listFilterWorkType, setListFilterWorkType] = useState("");
  const [listFilterStatus, setListFilterStatus] = useState("");
  const [listSearchInsuranceCompany, setListSearchInsuranceCompany] = useState("");
  const [listSearchVehicleNo, setListSearchVehicleNo] = useState("");
  const [listSearchTireSize, setListSearchTireSize] = useState("");
  const [listQuickScope, setListQuickScope] = useState<"all" | "followup">("all");
  const [closingFilter, setClosingFilter] = useState<"all" | "Y" | "N">("all");

  const [followSearchName, setFollowSearchName] = useState("");
  const [followSearchPhone, setFollowSearchPhone] = useState("");
  const [followSearchCompany, setFollowSearchCompany] = useState("");
  const [followFilterWorkType, setFollowFilterWorkType] = useState("");
  const [followFilterStatus, setFollowFilterStatus] = useState("");
  const [followSearchInsuranceCompany, setFollowSearchInsuranceCompany] = useState("");
  const [followSearchVehicleNo, setFollowSearchVehicleNo] = useState("");
  const [followSearchTireSize, setFollowSearchTireSize] = useState("");

  const recentContacts = useMemo(() => rows.slice(0, 10), [rows]);

  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [expandedTireDetail, setExpandedTireDetail] =
    useState<TireDetailRow | null>(null);
  const [expandedInsuranceDetail, setExpandedInsuranceDetail] =
    useState<InsuranceDetailRow | null>(null);
  const [expandedFinanceDetail, setExpandedFinanceDetail] =
    useState<FinanceDetailRow | null>(null);
  const [expandedForkliftDetail, setExpandedForkliftDetail] =
    useState<ForkliftDetailRow | null>(null);
  const [expandedBatteryDetail, setExpandedBatteryDetail] =
    useState<BatteryDetailRow | null>(null);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [pendingOpenId, setPendingOpenId] = useState<string|null>(null);
  const [showTodoBox, setShowTodoBox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showListFilters, setShowListFilters] = useState(false);
  const [showFollowupFilters, setShowFollowupFilters] = useState(false);

  const title = useMemo(() => {
    if (tab === "new") return "상담등록";
    if (tab === "list") return "상담내역";
    return "사후관리";
  }, [tab]);

  const batteryTotalCapacityKwh = useMemo(() => {
    const voltage = Number(batteryVoltage || 0);
    const capacityAh = Number(batteryCapacityAh || 0);
    if (!voltage || !capacityAh) return 0;
    return (voltage * capacityAh) / 1000;
  }, [batteryVoltage, batteryCapacityAh]);

  const batterySalePrice = useMemo(() => {
    const unit = Number(batteryUnitSalePrice || 0);
    const qty  = Number(batteryQuantity || 0);
    if (!unit || !qty) return 0;
    return unit * qty;
  }, [batteryUnitSalePrice, batteryQuantity]);



  const isClosingByCurrentForm = () => {
    if (workType === "registration_insurance") return policyIssued;
    if (workType === "finance") return financeStage === "confirmed" || financeStage === "cancelled" || financeStage === "rejected";
    if (["tire_sales","forklift_sales","battery_sales","export"].includes(workType)) return progressStage === "invoiced" || progressStage === "cancelled";
    return false;
  };

  const isClosingCase = (
    row: ConsultationRow,
    insuranceDetail?: InsuranceDetailRow | null,
    tireDetail?: TireDetailRow | null,
    financeDetail?: FinanceDetailRow | null,
    forkliftDetail?: ForkliftDetailRow | null,
    batteryDetail?: BatteryDetailRow | null
  ) => {
    if (row.work_type === "registration_insurance") return Boolean(insuranceDetail?.policy_issued);
    if (["tire_sales","forklift_sales","battery_sales","export"].includes(row.work_type)) {
      const s = row.work_type === "tire_sales" ? tireDetail?.process_status
               : row.work_type === "forklift_sales" ? resolvedForkliftStatus(forkliftDetail)
               : resolvedBatteryStatus(batteryDetail);
      return s === "invoiced" || s === "completed" || s === "completed_order";
    }
    if (row.work_type === "finance") return financeDetail?.finance_stage === "confirmed";
    return false;
  };

  const formatWorkType = (value: string) => {
    if (value === "registration_insurance") return "보험";
    if (value === "tire_sales") return "타이어";
    if (value === "finance") return "금융";
    if (value === "forklift_sales") return "지게차";
    if (value === "battery_sales") return "배터리";
    if (value === "export") return "수출";
    return value || "-";
  };

  const formatForkliftCondition = (value: string | null) => {
    if (value === "new") return "신차";
    if (value === "used") return "중고";
    return value || "-";
  };

  const formatForkliftType = (value: string | null) => {
    if (value === "diesel") return "디젤";
    if (value === "electric_seated") return "전동좌승";
    if (value === "electric_standing") return "전동입승";
    if (value === "special") return "특수지게차";
    return value || "-";
  };

  // ── 공통 진행단계 (타이어/지게차/배터리/수출)
  const COMMON_STAGES = [
    { value: "contract",        label: "계약" },
    { value: "delivery",        label: "납품" },
    { value: "invoiced",        label: "계산서발행" },
    { value: "cancelled",       label: "취소" },
  ] as const;
  type CommonStageValue = typeof COMMON_STAGES[number]["value"];

  const formatCommonStage = (value: string | null) => {
    const found = COMMON_STAGES.find(s => s.value === value);
    if (found) return found.label;
    // 레거시 값 호환
    if (value === "inquiry_received" || value === "size_confirming") return "계약";
    if (value === "quote_sent" || value === "proposal")               return "계약";
    if (value === "consulting" || value === "quote")                   return "계약";
    if (value === "waiting_order" || value === "waiting_payment")     return "계약";
    if (value === "delivery_or_replacement" || value === "delivered") return "납품";
    if (value === "completed" || value === "completed_order")         return "계산서발행"; // 완결 → 계산서발행으로 표시
    if (value === "invoiced")                                         return "계산서발행";
    if (value === "hold" || value === "cancelled")                    return "취소";
    return value || "-";
  };

  // 레거시 값 → 새 공통 단계값으로 정규화
  const normalizeToCommonStage = (value: string | null | undefined): CommonStageValue => {
    if (!value) return "contract";
    if (["consulting", "quote", "contract", "inquiry_received", "size_confirming", "quote_sent", "proposal", "waiting_order", "waiting_payment"].includes(value)) return "contract";
    if (["delivery", "delivery_or_replacement", "delivered"].includes(value)) return "delivery";
    if (["completed_order", "completed", "wheel_returned"].includes(value))   return "invoiced"; // 완결 → 계산서발행으로 정규화
    if (["invoiced"].includes(value))                                          return "invoiced";
    if (["cancelled"].includes(value))                                         return "cancelled";
    return "contract";
  };

  const formatForkliftStatus = (value: string | null) => formatCommonStage(value);

  const formatForkliftSaleMethod = (value: string | null) => {
    if (value === "cash") return "현금";
    if (value === "installment") return "할부금융";
    if (value === "rental") return "렌탈";
    if (value === "lease") return "리스";
    return value || "-";
  };

  const formatBatteryVehicleType = (value: string | null) => {
    // DB 허용값이 한글이므로 그대로 반환, 레거시 영문 값 호환
    if (value === "forklift") return "지게차";
    if (value === "awp") return "고소작업대";
    if (value === "golfcart") return "골프카트";
    return value || "-";
  };

  const formatBatteryDriveType = (value: string | null) => {
    if (value === "seated") return "좌승";
    if (value === "standing") return "입승";
    if (value === "special") return "특수";
    return value || "-";
  };

  const formatBatteryStatus = (value: string | null) => formatCommonStage(value);

  const stripStatusMeta = (value: string | null | undefined) =>
    String(value || "").replace(/^\[status:[^\]]+\]\s*/, "").trim();

  const withStatusMeta = (statusValue: string, noteValue: string) =>
    `[status:${statusValue}] ${stripStatusMeta(noteValue)}`.trim();

  const resolvedForkliftStatus = (detail?: ForkliftDetailRow | null) => {
    const raw = String(detail?.note || "");
    const matched = raw.match(/\[status:([^\]]+)\]/);
    return matched?.[1] || detail?.forklift_status || null;
  };

  const resolvedBatteryStatus = (detail?: BatteryDetailRow | null) => {
    const raw = String(detail?.note || "");
    const matched = raw.match(/\[status:([^\]]+)\]/);
    return matched?.[1] || (detail as any)?.process_stage || null;
  };

  const formatStatus = (value: string) => {
    if (value === "new") return "신규";
    if (value === "in_progress") return "진행중";
    if (value === "waiting_customer") return "고객대기";
    if (value === "delivered") return "납품";
    if (value === "completed") return "완료";
    if (value === "on_hold") return "보류";
    if (value === "closed") return "종결";
    return value || "-";
  };

  const formatInsuranceType = (value: string | null) => {
    if (value === "automobile") return "자동차보험";
    if (value === "cargo") return "적재물보험";
    if (value === "general") return "일반보험";
    if (value === "health") return "건강보험";
    return value || "-";
  };

  const formatInsuranceProcess = (detail: InsuranceDetailRow | null) => {
    if (!detail) return "-";
    if (detail.policy_issued) return "증권발급";
    if (detail.design_requested) return "설계요청";
    return "미진행";
  };

  const formatTireProcessStatus = (value: string | null) => formatCommonStage(value);

  const formatFinanceStage = (value: string | null) => {
    if (value === "received")          return "접수";
    if (value === "credit_check")      return "신용조회";
    if (value === "approved")          return "승인";
    if (value === "supplement")        return "보완";
    if (value === "rejected")          return "거절";
    if (value === "doc_registration")  return "서류등록";
    if (value === "contract_sent")     return "전자계약발송";
    if (value === "confirmed")         return "확정";
    if (value === "cancelled")         return "취소";
    // 레거시 값 호환
    if (value === "consulting")           return "접수";
    if (value === "quote_submitted")      return "신용조회";
    if (value === "documents_requested")  return "서류등록";
    return value || "-";
  };

  const formatUrgency = (value: string | null) => {
    if (value === "low") return "낮음";
    if (value === "normal") return "보통";
    if (value === "high") return "높음";
    return value || "-";
  };

  const matchesAdvanced = (
    row: ConsultationRow,
    insuranceCompanyQ: string,
    vehicleNoQ: string,
    tireSizeQ: string
  ) => {
    const insuranceDetail = insuranceDetailsMap[row.id];
    const tireDetail = tireDetailsMap[row.id];

    const insuranceCompanyOk =
      !insuranceCompanyQ.trim() ||
      (insuranceDetail?.insurance_company || "")
        .toLowerCase()
        .includes(insuranceCompanyQ.trim().toLowerCase());

    const vehicleNoOk =
      !vehicleNoQ.trim() ||
      (insuranceDetail?.vehicle_no || "")
        .toLowerCase()
        .includes(vehicleNoQ.trim().toLowerCase());

    const tireSizeOk =
      !tireSizeQ.trim() ||
      (tireDetail?.tire_size || "")
        .toUpperCase()
        .includes(tireSizeQ.trim().toUpperCase());

    return insuranceCompanyOk && vehicleNoOk && tireSizeOk;
  };

  useEffect(() => {
    setExpandedRowId(null);
  }, [
    listSearchName,
    listSearchPhone,
    listSearchCompany,
    listFilterWorkType,
    listFilterStatus,
    listSearchInsuranceCompany,
    listSearchVehicleNo,
    listSearchTireSize,
    listQuickScope,
    closingFilter,
  ]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const nameOk =
        !listSearchName.trim() ||
        row.customer_name.toLowerCase().includes(listSearchName.trim().toLowerCase());

      const phoneOk =
        !listSearchPhone.trim() || row.phone.includes(listSearchPhone.trim());

      const companyOk =
        !listSearchCompany.trim() ||
        (row.company_name || "")
          .toLowerCase()
          .includes(listSearchCompany.trim().toLowerCase());

      const workTypeOk =
        !listFilterWorkType || row.work_type === listFilterWorkType;

      const statusOk =
        !listFilterStatus || row.status === listFilterStatus;

      const advancedOk = matchesAdvanced(
        row,
        listSearchInsuranceCompany,
        listSearchVehicleNo,
        listSearchTireSize
      );

      const quickScopeOk =
        listQuickScope === "followup" ? row.followup_needed : true;

      const closingValue = isClosingCase(
        row,
        insuranceDetailsMap[row.id],
        tireDetailsMap[row.id],
        financeDetailsMap[row.id],
        forkliftDetailsMap[row.id],
        batteryDetailsMap[row.id]
      )
        ? "Y"
        : "N";

      const closingOk = closingFilter === "all" ? true : closingValue === closingFilter;

      return (
        nameOk &&
        phoneOk &&
        companyOk &&
        workTypeOk &&
        statusOk &&
        advancedOk &&
        quickScopeOk &&
        closingOk
      );
    });
  }, [
    rows,
    listSearchName,
    listSearchPhone,
    listSearchCompany,
    listFilterWorkType,
    listFilterStatus,
    listSearchInsuranceCompany,
    listSearchVehicleNo,
    listSearchTireSize,
    listQuickScope,
    closingFilter,
    insuranceDetailsMap,
    tireDetailsMap,
    financeDetailsMap,
    forkliftDetailsMap,
    batteryDetailsMap,
  ]);

  // 현대CM/태산통운은 항상 "금융" 성격이므로, 금융 필터가 없거나(전체) "finance"로 걸려있을 때만 노출
  const filteredExternalFinanceRows = useMemo(() => {
    if (listFilterWorkType && listFilterWorkType !== "finance") return [];
    return externalFinanceRows.filter((row) => {
      const nameOk =
        !listSearchName.trim() ||
        row.customer_name.toLowerCase().includes(listSearchName.trim().toLowerCase());
      const phoneOk =
        !listSearchPhone.trim() || (row.customer_phone || "").includes(listSearchPhone.trim());
      const companyOk =
        !listSearchCompany.trim() ||
        (row.company_name || "").toLowerCase().includes(listSearchCompany.trim().toLowerCase());
      const statusOk = !listFilterStatus || row.status === listFilterStatus;
      return nameOk && phoneOk && companyOk && statusOk;
    });
  }, [externalFinanceRows, listFilterWorkType, listFilterStatus, listSearchName, listSearchPhone, listSearchCompany]);

  // 상담관리 네이티브 행 + 현대CM/태산통운 행을 날짜순으로 병합해서 하나의 표로 렌더링
  type ListDisplayItem =
    | { kind: "native"; key: string; sortAt: string; row: ConsultationRow }
    | { kind: "external"; key: string; sortAt: string; row: ExternalFinanceRow };

  const combinedListDisplayRows = useMemo<ListDisplayItem[]>(() => {
    const nativeItems: ListDisplayItem[] = filteredRows.map((row) => ({
      kind: "native",
      key: `native-${row.id}`,
      sortAt: row.call_datetime || row.created_at,
      row,
    }));
    const externalItems: ListDisplayItem[] = filteredExternalFinanceRows.map((row) => ({
      kind: "external",
      key: `${row._source}-${row.id}`,
      sortAt: row.created_at,
      row,
    }));
    return [...nativeItems, ...externalItems].sort(
      (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
    );
  }, [filteredRows, filteredExternalFinanceRows]);

  const filteredFollowups = useMemo(() => {
    return followups.filter((row) => {
      const nameOk =
        !followSearchName.trim() ||
        row.customer_name.toLowerCase().includes(followSearchName.trim().toLowerCase());

      const phoneOk =
        !followSearchPhone.trim() || row.phone.includes(followSearchPhone.trim());

      const companyOk =
        !followSearchCompany.trim() ||
        (row.company_name || "")
          .toLowerCase()
          .includes(followSearchCompany.trim().toLowerCase());

      const workTypeOk =
        !followFilterWorkType || row.work_type === followFilterWorkType;

      const statusOk =
        !followFilterStatus || row.status === followFilterStatus;

      const advancedOk = matchesAdvanced(
        row,
        followSearchInsuranceCompany,
        followSearchVehicleNo,
        followSearchTireSize
      );

      return nameOk && phoneOk && companyOk && workTypeOk && statusOk && advancedOk;
    });
  }, [
    followups,
    followSearchName,
    followSearchPhone,
    followSearchCompany,
    followFilterWorkType,
    followFilterStatus,
    followSearchInsuranceCompany,
    followSearchVehicleNo,
    followSearchTireSize,
    insuranceDetailsMap,
    tireDetailsMap,
  ]);



  const todayTomorrowTodoRows = useMemo(() => {
    const todayDate = new Date();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(todayDate.getDate() + 1);

    const today = formatDateInputValue(todayDate.toISOString());
    const tomorrow = formatDateInputValue(tomorrowDate.toISOString());

    return rows
      .filter((row) => {
        if (!row.followup_needed) return false;
        const followupDate = row.next_followup_date || '';
        return followupDate === today || followupDate === tomorrow;
      })
      .sort((a, b) => {
        const aFollow = new Date(`${a.next_followup_date || '9999-12-31'}T00:00:00`).getTime();
        const bFollow = new Date(`${b.next_followup_date || '9999-12-31'}T00:00:00`).getTime();
        if (aFollow !== bFollow) return aFollow - bFollow;

        const aTime = new Date(a.created_at || a.call_datetime || 0).getTime();
        const bTime = new Date(b.created_at || b.call_datetime || 0).getTime();
        return bTime - aTime;
      });
  }, [rows]);

  const todayTomorrowTodoSummary = useMemo(() => {
    if (!todayTomorrowTodoRows.length) return '오늘/내일 예정된 사후관리 할 일이 없습니다.';

    const preview = todayTomorrowTodoRows
      .slice(0, 5)
      .map((row) => {
        const label =
          row.next_followup_date === formatDateInputValue(new Date().toISOString()) ? '오늘' : '내일';
        return `${label} ${row.customer_name || '-'}(${formatWorkType(row.work_type)})`;
      })
      .join(' · ');

    return todayTomorrowTodoRows.length > 5
      ? `${preview} 외 ${todayTomorrowTodoRows.length - 5}건`
      : preview;
  }, [todayTomorrowTodoRows]);

  const populateFormForEdit = (
    row: ConsultationRow,
    insuranceDetail?: InsuranceDetailRow | null,
    tireDetail?: TireDetailRow | null,
    financeDetail?: FinanceDetailRow | null,
    forkliftDetail?: ForkliftDetailRow | null,
    batteryDetail?: BatteryDetailRow | null
  ) => {
    setEditingCaseId(row.id);
    setCallDatetime(formatDateInputValue(row.call_datetime));
    setCustomerName(row.customer_name || "");
    setPhone(row.phone || "");
    setTelecomProvider(row.telecom_provider || "");
    setCompanyName(row.company_name || "");
    setRegion(row.region || "");
    setWorkType(row.work_type || "");
    setSubType((row as any).sub_type || "");
    setStatus(row.status || "new");
    setNextFollowupDate(row.next_followup_date || "");

    resetInsuranceFields();
    resetTireFields();
    resetFinanceFields();
    resetForkliftFields();
    resetBatteryFields();

    if (row.work_type === "registration_insurance") {
      setInsuranceVehicleNo(insuranceDetail?.vehicle_no || "");
      setInsuranceVehicleModel(insuranceDetail?.vehicle_model || "");
      setInsuranceVehicleUse(insuranceDetail?.vehicle_use || "");
      setInsuranceRequest(insuranceDetail?.insurance_request || "");
      setInsuranceType(insuranceDetail?.insurance_type || "automobile");
      setInsuranceJob(insuranceDetail?.job || "");
      setInsuranceCompany(insuranceDetail?.insurance_company || "");
      setInsuranceStartDate(insuranceDetail?.insurance_start_date || "");
      setInsuranceEndDate(insuranceDetail?.insurance_end_date || "");

      const nextIssued = Boolean(insuranceDetail?.policy_issued);
      const nextPaid = nextIssued || Boolean(insuranceDetail?.payment_completed);
      const nextProposal =
        nextPaid || nextIssued || Boolean(insuranceDetail?.application_issued);
      const nextRequested =
        nextProposal || nextPaid || nextIssued || Boolean(insuranceDetail?.design_requested);

      setDesignRequested(nextRequested);
      setApplicationIssued(nextProposal);
      setPaymentCompleted(nextPaid);
      setPolicyIssued(nextIssued);
      setInsuranceNote(insuranceDetail?.note || "");
    }

    if (row.work_type === "tire_sales") {
      setTireVehicleInfo(tireDetail?.vehicle_info || "");
      setTireVehicleType(tireDetail?.vehicle_type || "");
      setTireSize(tireDetail?.tire_size || "");
      setTireFrontQuantity(
        tireDetail?.front_quantity !== null && tireDetail?.front_quantity !== undefined
          ? String(tireDetail.front_quantity)
          : ""
      );
      setTireRearQuantity(
        tireDetail?.rear_quantity !== null && tireDetail?.rear_quantity !== undefined
          ? String(tireDetail.rear_quantity)
          : ""
      );
      setTireRegionDetail(tireDetail?.region_detail || "");
      setTireInflowChannel(tireDetail?.inflow_channel || "");
      setTireAssociationName(tireDetail?.association_name || "");
      setProgressStage(normalizeToCommonStage(tireDetail?.process_status));
      setTireNote(tireDetail?.note || "");
    }

    if (row.work_type === "finance") {
      setFinanceCategory(financeDetail?.finance_category || "");
      setFinanceVehicleModel(financeDetail?.finance_vehicle_model || "");
      setFinanceProduct(financeDetail?.finance_product || "");
      setFinanceCompany(financeDetail?.finance_company || "");
      setFinanceAmount(formatNumberWithCommas(financeDetail?.finance_amount));
      setFinancePeriod(
        financeDetail?.finance_period !== null && financeDetail?.finance_period !== undefined
          ? String(financeDetail.finance_period)
          : ""
      );
      setFinanceInterestRate(
        financeDetail?.finance_interest_rate !== null &&
        financeDetail?.finance_interest_rate !== undefined
          ? String(financeDetail.finance_interest_rate)
          : ""
      );
      setFinanceIncentive(
        financeDetail?.finance_incentive !== null &&
        financeDetail?.finance_incentive !== undefined
          ? String(financeDetail.finance_incentive)
          : ""
      );
      setFinanceStage(financeDetail?.finance_stage || "received");
      setFinanceNote(financeDetail?.note || "");
    }

    if (row.work_type === "forklift_sales") {
      setForkliftCondition(forkliftDetail?.forklift_condition || "");
      setForkliftType(forkliftDetail?.forklift_type || "");
      setForkliftTon(forkliftDetail?.forklift_ton || "");
      setProgressStage(normalizeToCommonStage(resolvedForkliftStatus(forkliftDetail)));
      setForkliftOptionNote(forkliftDetail?.forklift_option_note || "");
      setForkliftSaleMethod(forkliftDetail?.forklift_sale_method || "");
      setForkliftNote(stripStatusMeta(forkliftDetail?.note || ""));
    }

    if (row.work_type === "battery_sales") {
      setBatteryVehicleType(batteryDetail?.battery_vehicle_type || "");
      setBatteryDriveType(batteryDetail?.battery_drive_type || "");
      setProgressStage(normalizeToCommonStage(resolvedBatteryStatus(batteryDetail)));
      setBatteryVoltage(
        batteryDetail?.battery_voltage !== null && batteryDetail?.battery_voltage !== undefined
          ? String(batteryDetail.battery_voltage)
          : ""
      );
      setBatteryCapacityAh(
        batteryDetail?.battery_capacity_ah !== null && batteryDetail?.battery_capacity_ah !== undefined
          ? String(batteryDetail.battery_capacity_ah)
          : ""
      );
      setBatteryUnitSalePrice(
        batteryDetail?.battery_unit_sale_price !== null && batteryDetail?.battery_unit_sale_price !== undefined
          ? String(batteryDetail.battery_unit_sale_price)
          : ""
      );
      setBatteryQuantity(
        batteryDetail?.battery_quantity !== null && batteryDetail?.battery_quantity !== undefined
          ? String(batteryDetail.battery_quantity)
          : ""
      );
      setBatterySizeL(
        batteryDetail?.battery_size_l !== null && batteryDetail?.battery_size_l !== undefined
          ? String(batteryDetail.battery_size_l)
          : ""
      );
      setBatteryDueDate(batteryDetail?.battery_due_date || "");
      setBatteryWeightKg(
        batteryDetail?.battery_weight_kg !== null && batteryDetail?.battery_weight_kg !== undefined
          ? String(batteryDetail.battery_weight_kg)
          : ""
      );
      setBatteryUnitPricePerKwh(
        batteryDetail?.battery_unit_price_per_kwh !== null && batteryDetail?.battery_unit_price_per_kwh !== undefined
          ? String(batteryDetail.battery_unit_price_per_kwh)
          : ""
      );
      setBatteryExchangeRate(
        batteryDetail?.battery_exchange_rate !== null && batteryDetail?.battery_exchange_rate !== undefined
          ? String(batteryDetail.battery_exchange_rate)
          : ""
      );
      setBatteryNote(stripStatusMeta(batteryDetail?.note || ""));
    }

    setTab("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── 매출관리(sales_records) 등록 ─────────────────────────────────────────
  // 상담건(타이어/지게차/배터리/수출)을 매출관리에 1건으로 등록합니다.
  // 단가/매입가/규격 등 세부 정보는 매출관리에서 확인·보완해야 합니다.
  const handleRegisterToSales = async (row: ConsultationRow) => {
    if (salesRegisteredIds.has(row.id)) {
      alert("이미 매출관리에 등록된 건입니다. (매출관리에서 확인해주세요)");
      return;
    }
    if (!["tire_sales", "forklift_sales", "battery_sales", "export"].includes(row.work_type)) {
      return;
    }

    setRegisteringSalesId(row.id);

    // 종류(카테고리) 매핑
    let category = "기타";
    if (row.work_type === "tire_sales") category = "타이어";
    else if (row.work_type === "forklift_sales") category = "지게차렌탈";
    else if (row.work_type === "battery_sales") category = "배터리(LFP)"; // 필요시 매출관리에서 '배터리(납산)'으로 변경
    else if (row.work_type === "export") category = "건설기계수출";

    // 거래구분(수출/내수) — 수출 업무는 영세율로 기본 설정
    const trade_type = row.work_type === "export" ? "수출" : "내수";

    // 상세 정보에서 가능한 만큼 자동 채움 (단가/매입가는 0으로, 매출관리에서 보완)
    const tire = tireDetailsMap[row.id];
    const forklift = forkliftDetailsMap[row.id];
    const battery = batteryDetailsMap[row.id];

    let quantity = 1;
    let unit_price = 0;
    let maker: string | null = null;
    let spec: string | null = null;

    if (row.work_type === "tire_sales" && tire) {
      quantity = tire.quantity || 1;
      maker = tire.vehicle_type || null;
      spec = tire.tire_size || null;
    } else if (row.work_type === "forklift_sales" && forklift) {
      maker = formatForkliftCondition(forklift.forklift_condition);
      spec = [formatForkliftType(forklift.forklift_type), forklift.forklift_ton]
        .filter(Boolean)
        .join(" ") || null;
    } else if (row.work_type === "battery_sales" && battery) {
      quantity = battery.battery_quantity || 1;
      unit_price = battery.battery_unit_sale_price || 0;
      spec = formatBatteryVehicleType(battery.battery_vehicle_type);
    }

    const payload = {
      sale_date: new Date().toISOString().split("T")[0],
      customer_name: row.company_name || row.customer_name,
      business_no: null,
      category,
      trade_type,
      maker,
      spec,
      quantity,
      unit_price,
      unit_cost: 0,
      tax_invoice: false,
      payment_confirmed: false,
      payment_date: null,
      delivery_date: null,
      delivery_confirmed: false,
      wheel_returned: false,
      closing: false,
      note: `상담건 #${row.id} (${row.customer_name}) 연동 — 단가/매입가/거래처(사업자번호) 확인 필요`,
      consultation_id: row.id,
    };

    const { error } = await supabase.from("sales_records").insert(payload);

    if (error) {
      alert("매출 등록에 실패했습니다: " + error.message);
    } else {
      setSalesRegisteredIds((prev) => {
        const next = new Set(prev);
        next.add(row.id);
        return next;
      });
      alert(
        "매출관리에 등록되었습니다.\n매출관리(/work/sales)에서 거래처 사업자번호 · 단가 · 매입가 · 거래구분을 확인/보완해주세요."
      );
    }
    setRegisteringSalesId(null);
  };

  // ── 매출 등록(계산서 매칭) 모달 — 선택한 여러 상담건을 한 장의 계산서에 일괄 등록 ──
  function fileToBase64ForInvoice(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = () => reject(new Error("파일을 읽는 중 오류가 발생했습니다."));
      reader.readAsDataURL(file);
    });
  }

  // 상담건 1건 → 매출 등록용 행(InvoiceRegRow) 초안 생성
  function buildInvoiceRegRow(row: ConsultationRow): InvoiceRegRow {
    let category = "기타";
    if (row.work_type === "tire_sales") category = "타이어";
    else if (row.work_type === "forklift_sales") category = "지게차렌탈";
    else if (row.work_type === "battery_sales") category = "배터리(LFP)";
    else if (row.work_type === "export") category = "건설기계수출";

    const trade_type: "내수" | "수출" = row.work_type === "export" ? "수출" : "내수";

    const tire = tireDetailsMap[row.id];
    const forklift = forkliftDetailsMap[row.id];
    const battery = batteryDetailsMap[row.id];

    let quantity = "1";
    let unit_price = "";
    let maker = "";
    let spec = "";

    if (row.work_type === "tire_sales" && tire) {
      quantity = String(tire.quantity || 1);
      maker = tire.vehicle_type || "";
      spec = tire.tire_size || "";
    } else if (row.work_type === "forklift_sales" && forklift) {
      maker = formatForkliftCondition(forklift.forklift_condition);
      spec = [formatForkliftType(forklift.forklift_type), forklift.forklift_ton].filter(Boolean).join(" ");
    } else if (row.work_type === "battery_sales" && battery) {
      quantity = String(battery.battery_quantity || 1);
      unit_price = battery.battery_unit_sale_price ? String(battery.battery_unit_sale_price) : "";
      spec = formatBatteryVehicleType(battery.battery_vehicle_type);
    }

    return {
      consultation_id: row.id,
      customer_name: row.company_name || row.customer_name,
      category,
      trade_type,
      maker,
      spec,
      quantity,
      unit_price,
      unit_cost: "",
    };
  }

  // 선택된 상담건들로 매출 등록 모달 오픈 (거래처 동일 여부 등 검증)
  const openInvoiceRegModal = () => {
    const selectedRows = rows.filter((r) => selectedIds.includes(r.id));

    if (selectedRows.length === 0) return;

    // 1) 업무유형 검증 (계산서를 통해 매출 인식하는 영역만)
    const invalid = selectedRows.filter(
      (r) => !["tire_sales", "forklift_sales", "battery_sales", "export"].includes(r.work_type)
    );
    if (invalid.length > 0) {
      alert(
        "매출 등록은 타이어/지게차/배터리/수출 건만 가능합니다.\n" +
          "다음 건은 제외하고 다시 선택해주세요:\n" +
          invalid.map((r) => `- ${r.customer_name} (${formatWorkType(r.work_type)})`).join("\n")
      );
      return;
    }

    // 2) 이미 매출등록된 건 검증
    const alreadyRegistered = selectedRows.filter((r) => salesRegisteredIds.has(r.id));
    if (alreadyRegistered.length > 0) {
      alert(
        "이미 매출관리에 등록된 건이 포함되어 있습니다:\n" +
          alreadyRegistered.map((r) => `- ${r.customer_name}`).join("\n") +
          "\n\n해당 건은 매출관리(/work/sales)의 '계산서 매칭' 기능을 이용해주세요."
      );
      return;
    }

    // 3) 거래처(공급받는자) 동일 여부 검증
    const customerKeys = Array.from(
      new Set(selectedRows.map((r) => (r.company_name || r.customer_name).trim()))
    );
    if (customerKeys.length > 1) {
      alert(
        "거래처가 상이합니다. 한 장의 계산서는 동일한 거래처 건만 묶을 수 있습니다.\n\n" +
          "선택된 건의 거래처:\n" +
          selectedRows.map((r) => `- ${r.customer_name} → ${r.company_name || r.customer_name}`).join("\n") +
          "\n\n각 건의 '수정'에서 거래처(회사명)를 동일하게 통일한 뒤, 다시 체크하여 매출 등록을 진행해주세요."
      );
      return;
    }

    const customerName = customerKeys[0];

    setInvoiceRegForm({
      ...makeEmptyInvoiceRegForm(),
      customer_name: customerName,
    });
    setInvoiceRegRows(selectedRows.map(buildInvoiceRegRow));
    setInvoiceRegMode("manual");
    setShowInvoiceRegModal(true);
  };

  function closeInvoiceRegModal() {
    setShowInvoiceRegModal(false);
    setInvoiceRegForm(makeEmptyInvoiceRegForm());
    setInvoiceRegRows([]);
    setInvoiceRegMode("manual");
  }

  function setInvoiceRegField<K extends keyof InvoiceRegForm>(key: K, value: InvoiceRegForm[K]) {
    setInvoiceRegForm((prev) => ({ ...prev, [key]: value }));
  }

  function setInvoiceRegRowField<K extends keyof InvoiceRegRow>(
    consultationId: number,
    key: K,
    value: InvoiceRegRow[K]
  ) {
    setInvoiceRegRows((prev) =>
      prev.map((r) => (r.consultation_id === consultationId ? { ...r, [key]: value } : r))
    );
  }

  // 계산서 이미지 업로드 → AI 인식 → invoiceRegForm 자동 채움
  const handleInvoiceRegFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInvoiceRegParsing(true);
    try {
      const base64 = await fileToBase64ForInvoice(file);
      const mediaType = file.type || "image/png";

      const { data, error } = await supabase.functions.invoke("parse-tax-invoice", {
        body: { image_base64: base64, media_type: mediaType },
      });
      if (error) throw error;

      const parsed = (data || {}) as {
        invoice_no?: string | null;
        sale_date?: string | null;
        customer_name?: string | null;
        business_no?: string | null;
        supply_amount?: number | null;
        tax_amount?: number | null;
        total_amount?: number | null;
        items?: string | null;
      };

      setInvoiceRegForm((prev) => ({
        ...prev,
        invoice_no: parsed.invoice_no ? String(parsed.invoice_no) : prev.invoice_no,
        issue_date: parsed.sale_date || prev.issue_date,
        business_no: parsed.business_no ? String(parsed.business_no).replace(/[^0-9]/g, "") : prev.business_no,
        supply_amount: parsed.supply_amount != null ? String(Math.round(parsed.supply_amount)) : prev.supply_amount,
        tax_amount: parsed.tax_amount != null ? String(Math.round(parsed.tax_amount)) : prev.tax_amount,
        total_amount: parsed.total_amount != null ? String(Math.round(parsed.total_amount)) : prev.total_amount,
        items: parsed.items || prev.items,
        // 거래처명은 인식 결과가 있어도 이미 검증된 거래처명을 우선 유지
      }));
    } catch (err: any) {
      alert("계산서 인식에 실패했습니다: " + (err?.message || "알 수 없는 오류") + "\n수기입력으로 진행해주세요.");
    } finally {
      setInvoiceRegParsing(false);
      if (invoiceRegFileRef.current) invoiceRegFileRef.current.value = "";
    }
  };

  const invoiceRegSelectedSum = invoiceRegRows.reduce((s, r) => s + calcInvoiceRegRowRevenue(r), 0);
  const invoiceRegTotalAmount = parseFloat(invoiceRegForm.total_amount) || 0;
  const invoiceRegDiff = invoiceRegTotalAmount - invoiceRegSelectedSum;
  const invoiceRegIsClose = Math.abs(invoiceRegDiff) < 1;

  // 확정: tax_invoices 1건 생성 + 선택된 상담건마다 sales_records 1건씩 생성
  const handleConfirmInvoiceReg = async () => {
    if (!invoiceRegForm.customer_name.trim()) {
      alert("거래처명을 입력해주세요.");
      return;
    }
    if (invoiceRegRows.some((r) => !r.quantity || !r.unit_price)) {
      alert("모든 건의 수량/판매단가를 입력해주세요.");
      return;
    }

    setInvoiceRegSaving(true);

    const { data: invRow, error: invErr } = await supabase
      .from("tax_invoices")
      .insert({
        invoice_no: invoiceRegForm.invoice_no || null,
        issue_date: invoiceRegForm.issue_date || null,
        customer_name: invoiceRegForm.customer_name || null,
        business_no: invoiceRegForm.business_no || null,
        supply_amount: invoiceRegForm.supply_amount ? parseFloat(invoiceRegForm.supply_amount) : null,
        tax_amount: invoiceRegForm.tax_amount ? parseFloat(invoiceRegForm.tax_amount) : null,
        total_amount: invoiceRegForm.total_amount ? parseFloat(invoiceRegForm.total_amount) : null,
        items: invoiceRegForm.items || null,
        matched_total: invoiceRegSelectedSum,
      })
      .select()
      .single();

    if (invErr || !invRow) {
      alert("계산서 등록에 실패했습니다: " + (invErr?.message || ""));
      setInvoiceRegSaving(false);
      return;
    }

    const payloads = invoiceRegRows.map((r) => ({
      sale_date: invoiceRegForm.issue_date || new Date().toISOString().split("T")[0],
      customer_name: invoiceRegForm.customer_name,
      business_no: invoiceRegForm.business_no || null,
      category: r.category,
      trade_type: r.trade_type,
      maker: r.maker || null,
      spec: r.spec || null,
      quantity: parseFloat(r.quantity) || 0,
      unit_price: parseFloat(r.unit_price) || 0,
      unit_cost: parseFloat(r.unit_cost) || 0,
      tax_invoice: true,
      payment_confirmed: false,
      payment_date: null,
      delivery_date: null,
      delivery_confirmed: false,
      wheel_returned: false,
      closing: false,
      note: `상담건 #${r.consultation_id} 연동 — 계산서 #${invRow.id}${invoiceRegForm.invoice_no ? ` (${invoiceRegForm.invoice_no})` : ""}`,
      consultation_id: r.consultation_id,
      invoice_id: invRow.id,
    }));

    const { error: insErr } = await supabase.from("sales_records").insert(payloads);

    if (insErr) {
      alert("매출 등록에 실패했습니다: " + insErr.message);
    } else {
      setSalesRegisteredIds((prev) => {
        const next = new Set(prev);
        invoiceRegRows.forEach((r) => next.add(r.consultation_id));
        return next;
      });
      setSelectedIds([]);
      closeInvoiceRegModal();
      alert(
        `매출관리에 ${invoiceRegRows.length}건이 등록되고, 계산서${
          invoiceRegForm.invoice_no ? ` #${invoiceRegForm.invoice_no}` : ""
        }에 매칭되었습니다.`
      );
    }
    setInvoiceRegSaving(false);
  };

  const handleStartEdit = (row: ConsultationRow) => {
    populateFormForEdit(
      row,
      insuranceDetailsMap[row.id] || expandedInsuranceDetail,
      tireDetailsMap[row.id] || expandedTireDetail,
      financeDetailsMap[row.id] || expandedFinanceDetail,
      forkliftDetailsMap[row.id] || expandedForkliftDetail,
      batteryDetailsMap[row.id] || expandedBatteryDetail
    );
  };

  const resetTireFields = () => {
    setTireVehicleInfo("");
    setTireVehicleType("");
    setTireSize("");
    setTireFrontQuantity("");
    setTireRearQuantity("");
    setTireRegionDetail("");
    setTireInflowChannel("");
    setTireAssociationName("");
    setProgressStage("contract");
    setTireNote("");
  };

  const resetInsuranceFields = () => {
    setInsuranceVehicleNo("");
    setInsuranceVehicleModel("");
    setInsuranceVehicleUse("");
    setInsuranceRequest("");
    setInsuranceType("automobile");
    setInsuranceJob("");
    setInsuranceCompany("");
    setInsuranceStartDate(todayLocalStr());
    setInsuranceEndDate(todayLocalStr());
    setDesignRequested(false);
    setApplicationIssued(false);
    setPaymentCompleted(false);
    setPolicyIssued(false);
    setInsuranceNote("");
  };

  const resetFinanceFields = () => {
    setFinanceCategory("");
    setFinanceVehicleModel("");
    setFinanceProduct("");
    setFinanceCompany("");
    setFinanceAmount("");
    setFinancePeriod("");
    setFinanceInterestRate("");
    setFinanceIncentive("");
    setFinanceStage("received");
    setFinanceNote("");
  };

  const resetForkliftFields = () => {
    setForkliftCondition("");
    setForkliftType("");
    setForkliftTon("");
    setProgressStage("contract");
    setForkliftOptionNote("");
    setForkliftSaleMethod("");
    setForkliftNote("");
  };

  const resetBatteryFields = () => {
    setBatteryVehicleType("");
    setBatteryDriveType("");
    setProgressStage("contract");
    setBatteryVoltage("");
    setBatteryCapacityAh("");
    setBatterySizeL("");
    setBatteryDueDate(todayLocalStr());
    setBatteryWeightKg("");
    setBatteryUnitPricePerKwh("");
    setBatteryExchangeRate("");
    setBatteryUnitSalePrice("");
    setBatteryQuantity("");
    setBatteryNote("");
  };

  const resetForm = () => {
    setEditingCaseId(null);
    setCallDatetime(todayLocalStr());
    setCustomerName("");
    setPhone("");
    setTelecomProvider("");
    setCompanyName("");
    setRegion("");
    setWorkType("");
    setSubType("");
    setNextFollowupDate("");
    resetTireFields();
    resetInsuranceFields();
    resetFinanceFields();
    resetForkliftFields();
    resetBatteryFields();
  };

  const resetListFilters = () => {
    setListSearchName("");
    setListSearchPhone("");
    setListSearchCompany("");
    setListFilterWorkType("");
    setListFilterStatus("");
    setListSearchInsuranceCompany("");
    setListSearchVehicleNo("");
    setListSearchTireSize("");
    setListQuickScope("all");
    setClosingFilter("all");
  };

  const resetFollowFilters = () => {
    setFollowSearchName("");
    setFollowSearchPhone("");
    setFollowSearchCompany("");
    setFollowFilterWorkType("");
    setFollowFilterStatus("");
    setFollowSearchInsuranceCompany("");
    setFollowSearchVehicleNo("");
    setFollowSearchTireSize("");
  };

  const fetchConsultations = async () => {
    setLoadingList(true);
    setListError("");

    const { data, error } = await supabase
      .from("consultation_cases")
      .select("*")
      .in("work_type", insuranceOnlyScope ? ["registration_insurance"] : ["registration_insurance", "tire_sales", "finance", "forklift_sales", "battery_sales"])
      .order("created_at", { ascending: false });

    if (error) {
      setListError(error.message || "목록 조회 실패");
      setRows([]);
      setLoadingList(false);
      return;
    }

    const caseRows = (data || []) as ConsultationRow[];
    setRows(caseRows);
    (window as any).__consultRows = caseRows;
    setLoadingList(false);
    // D+30일 초과 상담 체크 (최초 로드 시)
    void checkOverdueConsultations().then(overdue => {
      if (overdue.length > 0) { setOverdueRows(overdue as any); setShowOverdueModal(true); }
    });

    const ids = caseRows.map((r) => r.id);
    if (!ids.length) {
      setInsuranceDetailsMap({});
      setTireDetailsMap({});
      setFinanceDetailsMap({});
      setForkliftDetailsMap({});
      setBatteryDetailsMap({});
      return;
    }

    const [insRes, tireRes, financeRes, forkliftRes, batteryRes] = await Promise.all([
      supabase
        .from("consultation_insurance_details")
        .select("*")
        .in("consultation_id", ids),
      supabase
        .from("consultation_tire_details")
        .select("*")
        .in("consultation_id", ids),
      supabase
        .from("consultation_finance_details")
        .select("*")
        .in("consultation_id", ids),
      supabase
        .from("consultation_forklift_details")
        .select("*")
        .in("consultation_id", ids),
      supabase
        .from("consultation_battery_details")
        .select("*")
        .in("consultation_id", ids),
    ]);

    const insMap: Record<number, InsuranceDetailRow> = {};
    const tireMap: Record<number, TireDetailRow> = {};
    const financeMap: Record<number, FinanceDetailRow> = {};
    const forkliftMap: Record<number, ForkliftDetailRow> = {};
    const batteryMap: Record<number, BatteryDetailRow> = {};

    (insRes.data || []).forEach((row: any) => {
      insMap[row.consultation_id] = row as InsuranceDetailRow;
    });

    (tireRes.data || []).forEach((row: any) => {
      tireMap[row.consultation_id] = row as TireDetailRow;
    });

    (financeRes.data || []).forEach((row: any) => {
      financeMap[row.consultation_id] = row as FinanceDetailRow;
    });

    (forkliftRes.data || []).forEach((row: any) => {
      forkliftMap[row.consultation_id] = row as ForkliftDetailRow;
    });

    (batteryRes.data || []).forEach((row: any) => {
      batteryMap[row.consultation_id] = row as BatteryDetailRow;
    });

    setInsuranceDetailsMap(insMap);
    setTireDetailsMap(tireMap);
    setFinanceDetailsMap(financeMap);
    setForkliftDetailsMap(forkliftMap);
    setBatteryDetailsMap(batteryMap);
  };

  // ── 현대CM(hyundaicm_tasks) + 태산통운(taesan_tasks) 통합 조회 ──
  const fetchExternalFinanceRows = async () => {
    setExternalFinanceLoading(true);
    try {
      const [hcmRes, taesanRes] = await Promise.all([
        supabase.from("hyundaicm_tasks").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("taesan_tasks").select("*").order("created_at", { ascending: false }).limit(300),
      ]);
      const hcmRows: ExternalFinanceRow[] = (hcmRes.data || []).map((r: any) => ({ ...r, _source: "hyundaicm" as const }));
      const taesanRows: ExternalFinanceRow[] = (taesanRes.data || []).map((r: any) => ({ ...r, _source: "taesan" as const }));
      const merged = [...hcmRows, ...taesanRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setExternalFinanceRows(merged);
    } finally {
      setExternalFinanceLoading(false);
    }
  };

  const externalFinanceTableName = (source: ExternalFinanceSource) =>
    source === "hyundaicm" ? "hyundaicm_tasks" : "taesan_tasks";

  const startEditExternalFinance = (row: ExternalFinanceRow) => {
    if (!isAdminLevel) return;
    setExternalFinanceEditKey(`${row._source}-${row.id}`);
    setExternalFinanceDraft({ ...row });
  };

  const cancelEditExternalFinance = () => {
    setExternalFinanceEditKey(null);
    setExternalFinanceDraft({});
  };

  const saveExternalFinanceEdit = async (row: ExternalFinanceRow) => {
    if (!isAdminLevel) return;
    setExternalFinanceSaving(true);
    try {
      const patch: Record<string, unknown> = {
        customer_name: externalFinanceDraft.customer_name?.trim() || row.customer_name,
        customer_phone: (externalFinanceDraft.customer_phone ?? row.customer_phone) || null,
        company_name: (externalFinanceDraft.company_name ?? row.company_name) || null,
        ceo_name: (externalFinanceDraft.ceo_name ?? row.ceo_name) || null,
        equipment_ton: (externalFinanceDraft.equipment_ton ?? row.equipment_ton) || null,
        purchase_amount: externalFinanceDraft.purchase_amount ?? row.purchase_amount,
        vehicle_amount: externalFinanceDraft.vehicle_amount ?? row.vehicle_amount,
        attach_amount: externalFinanceDraft.attach_amount ?? row.attach_amount,
        installment_principal: externalFinanceDraft.installment_principal ?? row.installment_principal,
        grace_period: externalFinanceDraft.grace_period ?? row.grace_period,
        installment_period: externalFinanceDraft.installment_period ?? row.installment_period,
        finance_company: (externalFinanceDraft.finance_company ?? row.finance_company) || null,
        interest_rate: externalFinanceDraft.interest_rate ?? row.interest_rate,
        incentive: externalFinanceDraft.incentive ?? row.incentive,
        sales_rep: (externalFinanceDraft.sales_rep ?? row.sales_rep) || null,
        special_note: (externalFinanceDraft.special_note ?? row.special_note) || null,
      };
      const { error } = await supabase
        .from(externalFinanceTableName(row._source))
        .update(patch)
        .eq("id", row.id);
      if (error) {
        alert(`저장 실패: ${error.message}`);
        return;
      }
      await fetchExternalFinanceRows();
      cancelEditExternalFinance();
    } finally {
      setExternalFinanceSaving(false);
    }
  };

  const changeExternalFinanceStatus = async (row: ExternalFinanceRow, nextStatus: string) => {
    if (!isAdminLevel) return;
    if (nextStatus === row.status) return;
    if (!window.confirm(`${row.customer_name} 건의 상태를 "${nextStatus}"(으)로 변경할까요?`)) return;
    setExternalFinanceSaving(true);
    try {
      const patch: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "확정") patch.closed_at = new Date().toISOString();
      const { error } = await supabase
        .from(externalFinanceTableName(row._source))
        .update(patch)
        .eq("id", row.id);
      if (error) {
        alert(`상태 변경 실패: ${error.message}`);
        return;
      }
      await fetchExternalFinanceRows();
    } finally {
      setExternalFinanceSaving(false);
    }
  };

  // D+30일 초과 상담 감지 → 취소 후보 반환
  const checkOverdueConsultations = async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const { data } = await supabase
      .from("consultation_cases")
      .select("id, customer_name, work_type, call_datetime, created_at")
      .in("status", ["new", "in_progress", "waiting_customer", "on_hold"])
      .lt("created_at", cutoffStr + "T00:00:00")
      .order("created_at", { ascending: true })
      .limit(50);
    return data ?? [];
  };

  const fetchFollowups = async () => {
    setLoadingFollowups(true);
    setFollowupError("");

    const { data, error } = await supabase
      .from("consultation_cases")
      .select("*")
      .in("work_type", insuranceOnlyScope ? ["registration_insurance"] : ["registration_insurance", "tire_sales", "finance", "forklift_sales", "battery_sales"])
      .eq("followup_needed", true)
      .order("next_followup_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setFollowupError(error.message || "사후관리 조회 실패");
      setFollowups([]);
      setLoadingFollowups(false);
      return;
    }

    const followRows = (data || []) as ConsultationRow[];
    setFollowups(followRows);
    setFollowupRescheduleMap(
      Object.fromEntries(
        followRows.map((row) => [row.id, row.next_followup_date || ""])
      )
    );
    setLoadingFollowups(false);
  };

  const fetchInsuranceExpiries = async () => {
    setLoadingExpiry(true);
    setExpiryError("");

    const today = new Date();
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;

    const after30 = new Date();
    after30.setDate(after30.getDate() + 30);
    const end = `${after30.getFullYear()}-${String(after30.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(after30.getDate()).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("consultation_insurance_details")
      .select(
        `
        consultation_id,
        insurance_end_date,
        insurance_company,
        insurance_type,
        vehicle_no,
        consultation_cases (
          id,
          customer_name,
          phone,
          telecom_provider,
          company_name
        )
      `
      )
      .gte("insurance_end_date", start)
      .lte("insurance_end_date", end)
      .order("insurance_end_date", { ascending: true });

    if (error) {
      setExpiryError(error.message || "보험 만기 조회 실패");
      setInsuranceExpiries([]);
      setLoadingExpiry(false);
      return;
    }

    setInsuranceExpiries((data || []) as unknown as InsuranceExpiryRow[]);
    setLoadingExpiry(false);
  };

  const buildAutoSummary = () => {
    if (workType === "registration_insurance") {
      return [
        "보험",
        customerName.trim() || "고객",
        insuranceVehicleNo.trim() || "차량번호 미입력",
        formatInsuranceType(insuranceType),
      ].join(" / ");
    }

    if (workType === "tire_sales") {
      const front = tireFrontQuantity ? `전${tireFrontQuantity}` : "전0";
      const rear = tireRearQuantity ? `후${tireRearQuantity}` : "후0";
      return [
        "타이어",
        customerName.trim() || "고객",
        tireSize.trim() || "사이즈 미입력",
        `${front}/${rear}`,
      ].join(" / ");
    }

    if (workType === "finance") {
      return [
        "금융",
        customerName.trim() || "고객",
        financeCategory || "종목 미입력",
        financeProduct || "상품 미입력",
        financeCompany || "금융사 미입력",
      ].join(" / ");
    }

    if (workType === "forklift_sales") {
      return [
        "지게차",
        customerName.trim() || "고객",
        formatForkliftCondition(forkliftCondition),
        formatForkliftType(forkliftType),
        forkliftTon.trim() || "톤수 미입력",
      ].join(" / ");
    }

    if (workType === "battery_sales") {
      return [
        "배터리",
        customerName.trim() || "고객",
        formatBatteryVehicleType(batteryVehicleType),
        formatCommonStage(progressStage),
        `${batteryVoltage || "-"}V`,
        `${batteryCapacityAh || "-"}Ah`,
      ].join(" / ");
    }

    return customerName.trim() || "상담";
  };

  const openListDetailFromDashboard = async (row: ConsultationRow) => {
    setTab("list");
    setListQuickScope("all");
    setListSearchName("");
    setListSearchPhone("");
    setListSearchCompany("");
    setListFilterWorkType("");
    setListFilterStatus("");
    setListSearchInsuranceCompany("");
    setListSearchVehicleNo("");
    setListSearchTireSize("");
    await toggleInlineDetail(row);
  };

  const applyQuickListScope = (scope: "all" | "followup") => {
    setTab("list");
    setExpandedRowId(null);
    setExpandedTireDetail(null);
    setExpandedInsuranceDetail(null);
    setExpandedFinanceDetail(null);
    setExpandedForkliftDetail(null);
    setExpandedBatteryDetail(null);
    setExpandedForkliftDetail(null);
    setExpandedBatteryDetail(null);
    setDetailError("");
    setListSearchName("");
    setListSearchPhone("");
    setListSearchCompany("");
    setListFilterWorkType("");
    setListFilterStatus("");
    setListSearchInsuranceCompany("");
    setListSearchVehicleNo("");
    setListSearchTireSize("");
    setListQuickScope(scope);
  };


  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert("선택된 항목이 없습니다.");
      return;
    }

    if (!confirm(`총 ${selectedIds.length}건 삭제하시겠습니까?`)) return;

    try {
      const { data: insuranceRowsBeforeDelete, error: insuranceRowsError } = await supabase
        .from("consultation_insurance_details")
        .select("consultation_id, vehicle_no")
        .in("consultation_id", selectedIds);
      if (insuranceRowsError) throw insuranceRowsError;

      const affectedVehicleNos = Array.from(
        new Set(
          (insuranceRowsBeforeDelete || [])
            .map((row: any) => normalizeVehicleNo(row.vehicle_no))
            .filter(Boolean)
        )
      );

      await supabase.from("consultation_insurance_details").delete().in("consultation_id", selectedIds);
      await supabase.from("consultation_tire_details").delete().in("consultation_id", selectedIds);
      await supabase.from("consultation_finance_details").delete().in("consultation_id", selectedIds);
      await supabase.from("consultation_forklift_details").delete().in("consultation_id", selectedIds);
      await supabase.from("consultation_battery_details").delete().in("consultation_id", selectedIds);

      const { error } = await supabase.from("consultation_cases").delete().in("id", selectedIds);
      if (error) throw error;

      for (const vehicleNo of affectedVehicleNos) {
        await syncNarumiInsuranceByVehicleNo(vehicleNo);
      }

      if (expandedRowId && selectedIds.includes(expandedRowId)) {
        setExpandedRowId(null);
        setExpandedInsuranceDetail(null);
        setExpandedTireDetail(null);
        setExpandedFinanceDetail(null);
        setExpandedForkliftDetail(null);
        setExpandedBatteryDetail(null);
      }

      setSelectedIds([]);
      await fetchConsultations();
    } catch (err: any) {
      alert("삭제 실패: " + (err?.message || "알 수 없는 오류"));
    }
  };

  const toggleInlineDetail = async (row: ConsultationRow) => {
    if (expandedRowId === row.id) {
      setExpandedRowId(null);
      setExpandedTireDetail(null);
      setExpandedInsuranceDetail(null);
      setExpandedFinanceDetail(null);
      setExpandedForkliftDetail(null);
      setExpandedBatteryDetail(null);
      setDetailError("");
      return;
    }

    setExpandedRowId(row.id);
    setExpandedTireDetail(null);
    setExpandedInsuranceDetail(null);
    setExpandedFinanceDetail(null);
    setExpandedForkliftDetail(null);
    setExpandedBatteryDetail(null);
    setDetailError("");
    setLoadingDetail(true);

    if (row.work_type === "tire_sales") {
      const { data, error } = await supabase
        .from("consultation_tire_details")
        .select("*")
        .eq("consultation_id", row.id)
        .maybeSingle();

      if (error) {
        setDetailError(error.message || "타이어 상세 조회 실패");
        setLoadingDetail(false);
        return;
      }
      setExpandedTireDetail((data || null) as TireDetailRow | null);
    }

    if (row.work_type === "registration_insurance") {
      const { data, error } = await supabase
        .from("consultation_insurance_details")
        .select("*")
        .eq("consultation_id", row.id)
        .maybeSingle();

      if (error) {
        setDetailError(error.message || "보험 상세 조회 실패");
        setLoadingDetail(false);
        return;
      }
      setExpandedInsuranceDetail((data || null) as InsuranceDetailRow | null);
    }

    if (row.work_type === "finance") {
      const { data, error } = await supabase
        .from("consultation_finance_details")
        .select("*")
        .eq("consultation_id", row.id)
        .maybeSingle();

      if (error) {
        setDetailError(error.message || "금융 상세 조회 실패");
        setLoadingDetail(false);
        return;
      }
      setExpandedFinanceDetail((data || null) as FinanceDetailRow | null);
    }

    if (row.work_type === "forklift_sales") {
      const { data, error } = await supabase
        .from("consultation_forklift_details")
        .select("*")
        .eq("consultation_id", row.id)
        .maybeSingle();

      if (error) {
        setDetailError(error.message || "지게차 상세 조회 실패");
        setLoadingDetail(false);
        return;
      }
      setExpandedForkliftDetail((data || null) as ForkliftDetailRow | null);
    }

    if (row.work_type === "battery_sales") {
      const { data, error } = await supabase
        .from("consultation_battery_details")
        .select("*")
        .eq("consultation_id", row.id)
        .maybeSingle();

      if (error) {
        setDetailError(error.message || "배터리 상세 조회 실패");
        setLoadingDetail(false);
        return;
      }
      setExpandedBatteryDetail((data || null) as BatteryDetailRow | null);
    }

    setLoadingDetail(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = params.get("id");
    if (targetId) setPendingOpenId(targetId);
  }, [location.search]);

  // AI비서 통합상담 탭 등 외부에서 ?workType=battery_sales 형태로 들어오면 신규 등록 탭을
  // 해당 업무유형으로 미리 선택해둔다 (예: pages/work/QuotationPage.tsx의 ?type= 패턴과 동일).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const wt = params.get("workType");
    const validTypes: WorkType[] = ["registration_insurance", "tire_sales", "finance", "forklift_sales", "battery_sales", "export"];
    if (wt && (validTypes as string[]).includes(wt)) {
      setWorkType(wt as WorkType);
      setTab("new");
    }
  }, [location.search]);

  useEffect(() => {
    if (user && canAccessConsulting) {
      fetchConsultations();
      fetchInsuranceExpiries();
      void fetchExternalFinanceRows();
    }
  }, [user, canAccessConsulting]);

  // pendingOpenId + rows 모두 준비되면 해당 건 열기
  useEffect(() => {
    if (!pendingOpenId || rows.length === 0) return;
    const row = rows.find((r: any) => String(r.id) === pendingOpenId);
    if (!row) return;

    const openRow = async () => {
      let fd = financeDetailsMap[row.id] ?? null;
      let id2 = insuranceDetailsMap[row.id] ?? null;
      let td = tireDetailsMap[row.id] ?? null;
      let fld = forkliftDetailsMap[row.id] ?? null;
      let bd = batteryDetailsMap[row.id] ?? null;

      // 각 detail map에 없으면 직접 DB에서 조회 (페이지 진입 타이밍 이슈 방지)
      if (!bd && row.work_type === "battery_sales") {
        const { data: bdData } = await supabase
          .from("consultation_battery_details").select("*")
          .eq("consultation_id", row.id).maybeSingle();
        bd = bdData as any ?? null;
      }
      if (!td && row.work_type === "tire_sales") {
        const { data: tdData } = await supabase
          .from("consultation_tire_details").select("*")
          .eq("consultation_id", row.id).maybeSingle();
        td = tdData as any ?? null;
      }
      if (!fd && row.work_type === "finance") {
        const { data: fdData } = await supabase
          .from("consultation_finance_details").select("*")
          .eq("consultation_id", row.id).maybeSingle();
        fd = fdData as any ?? null;
      }
      if (!fld && row.work_type === "forklift_sales") {
        const { data: fldData } = await supabase
          .from("consultation_forklift_details").select("*")
          .eq("consultation_id", row.id).maybeSingle();
        fld = fldData as any ?? null;
      }
      if (!id2 && row.work_type === "registration_insurance") {
        const { data: id2Data } = await supabase
          .from("consultation_insurance_details").select("*")
          .eq("consultation_id", row.id).maybeSingle();
        id2 = id2Data as any ?? null;
      }

      setTab("new");
      populateFormForEdit(row, id2, td, fd, fld, bd);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setPendingOpenId(null);
    };

    void openRow();
  }, [pendingOpenId, rows, financeDetailsMap, insuranceDetailsMap, tireDetailsMap, forkliftDetailsMap, batteryDetailsMap]);

  useEffect(() => {
    if (user && canAccessConsulting && tab === "followups") {
      fetchFollowups();
    }
  }, [tab, user, canAccessConsulting]);

  useEffect(() => {
    if (insuranceOnlyScope && workType !== "registration_insurance") {
      setWorkType("registration_insurance");
    }
  }, [insuranceOnlyScope, workType]);

  useEffect(() => {
    if (insuranceType === "automobile" && insuranceStartDate) {
      const start = new Date(`${insuranceStartDate}T00:00:00`);
      if (!Number.isNaN(start.getTime())) {
        start.setFullYear(start.getFullYear() + 1);
        start.setDate(start.getDate() - 1);
        setInsuranceEndDate(start.toISOString().slice(0, 10));
      }
    }
  }, [insuranceType, insuranceStartDate]);

  useEffect(() => {
    if (tireInflowChannel !== "association" && tireAssociationName) {
      setTireAssociationName("");
    }
  }, [tireInflowChannel, tireAssociationName]);



  useEffect(() => {
    const payload = (location.state as any)?.narumiInsurancePrefill;
    if (!payload) return;

    const payloadKey = JSON.stringify(payload);
    if (appliedNarumiPrefillRef.current === payloadKey) return;
    appliedNarumiPrefillRef.current = payloadKey;

    const prefillCustomerName =
      payload.customerName ||
      payload.customer_name ||
      payload.name ||
      payload.customer ||
      "";

    setTab("new");
    setEditingCaseId(null);
    setWorkType("registration_insurance");
    setCallDatetime(payload.callDatetime || todayLocalStr());
    setCustomerName(prefillCustomerName);
    setPhone(formatPhoneInput(payload.phone || ""));
    setInsuranceVehicleNo(payload.vehicleNo || payload.vehicle_no || payload.vin || "");
    setDesignRequested(false);
    setApplicationIssued(false);
    setPaymentCompleted(false);
    setPolicyIssued(false);
    // 나르미 기본값
    setInsuranceVehicleModel("2.5톤 이하");
    setInsuranceVehicleUse("개인용");
    setInsuranceRequest("신규");

    // 나르미에서 Y 선택 시 자동 저장
    if (payload.autoSave && prefillCustomerName && (payload.phone || "")) {
      setTimeout(async () => {
        try {
          const autoSummary = `[나르미 보험] ${prefillCustomerName} / ${payload.vehicleNo || payload.vin || "-"}`;
          const { data: inserted, error: insertErr } = await supabase
            .from("consultations")
            .insert({
              call_datetime:  payload.callDatetime || todayLocalStr(),
              customer_name:  prefillCustomerName,
              phone:          (payload.phone || "").replace(/\D/g, "").replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3"),
              work_type:      "registration_insurance",
              auto_summary:   autoSummary,
              detail_memo:    null,
              status:         "pending",
            })
            .select("id")
            .single();

          if (insertErr) throw insertErr;

          // 보험 상세 저장
          if (inserted?.id) {
            await supabase.from("consultation_insurance_details").insert({
              consultation_id:    inserted.id,
              vehicle_no:         payload.vehicleNo || payload.vin || null,
              vehicle_model:      "2.5톤 이하",
              vehicle_use:        "개인용",
              insurance_request:  "신규",
              design_requested:   false,
              application_issued: false,
              payment_completed:  false,
              policy_issued:      false,
            });

            // 나르미 보험 단계 업데이트
            if (payload.narumiTaskId) {
              await supabase.from("narumi_tasks")
                .update({ has_insurance: true, status: "insurance" })
                .eq("id", payload.narumiTaskId);
            }
          }

          await fetchConsultations();
          alert(`✓ 상담이 자동 등록되었습니다.\n고객: ${prefillCustomerName}`);
          setTab("list");
        } catch (e: any) {
          console.warn("[narumi auto save] 자동 저장 실패:", e?.message);
          // 실패해도 폼은 채워진 상태로 유지
          setTimeout(() => {
            newFormTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            customerNameInputRef.current?.focus();
          }, 80);
        }
      }, 300);
    } else {
      setTimeout(() => {
        newFormTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        customerNameInputRef.current?.focus();
        customerNameInputRef.current?.select();
      }, 80);
    }
  }, [location.state]);

  // ─── 구글 캘린더 자동 동기화 (신규 상담건 등록 시 → 할일 스타일 이벤트) ───
  const syncConsultToGcal = async (caseInfo: {
    id: number;
    customer_name: string;
    work_type: string;
  }) => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const wtLbl: Record<string,string> = {tire_sales:"타이어",finance:"금융",forklift_sales:"지게차",battery_sales:"배터리",export:"수출",registration_insurance:"보험"};
      const title = `${caseInfo.customer_name} (${wtLbl[caseInfo.work_type] ?? caseInfo.work_type}) 신규상담`;
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
              description: null,
              schedule_date: todayIso,
              source_table: "consultation_cases",
              source_id: caseInfo.id,
            },
          }),
        }
      );
      const d = await res.json();
      if (d?.task?.id) {
        await supabase.from("consultation_cases").update({ gcal_task_id: d.task.id }).eq("id", caseInfo.id);
      }
    } catch (e) {
      console.warn("[consult gcal task sync] 전송 실패:", e);
    }
  };

  // 상담건이 종결(closed) 처리될 때 구글 할일도 완료 처리 (목록에서 사라짐)
  const completeConsultGcalTask = async (caseId: number) => {
    if (!user) return;
    try {
      const { data: row } = await supabase.from("consultation_cases").select("gcal_task_id").eq("id", caseId).maybeSingle();
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
      console.warn("[consult gcal task complete] 전송 실패:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {

    if (!customerName.trim()) return alert("고객명을 입력해 주세요.");
    if (!phone.trim()) return alert("연락처를 입력해 주세요.");
    if (!workType) return alert("상단에서 업무유형을 선택해 주세요.");

    if (
      workType === "registration_insurance" &&
      !insuranceVehicleNo.trim() &&
      insuranceType !== "health"
    ) {
      return alert("보험 상담은 차량번호를 입력해 주세요.");
    }

    if (workType === "tire_sales" && !tireSize.trim()) {
      return alert("타이어 상담은 타이어 사이즈를 입력해 주세요.");
    }

    if (workType === "tire_sales" && tireInflowChannel === "association" && !tireAssociationName) {
      return alert("유입경로를 협회로 선택한 경우 협회명을 선택해 주세요.");
    }

    if (workType === "finance" && !financeProduct) {
      return alert("금융 상담은 상품을 선택해 주세요.");
    }

    if (workType === "forklift_sales" && !forkliftType) {
      return alert("지게차 판매는 형식을 선택해 주세요.");
    }

    if (workType === "battery_sales" && (!batteryVoltage || !batteryCapacityAh)) {
      return alert("배터리 판매는 전압과 용량을 입력해 주세요.");
    }

    const autoSummary = buildAutoSummary();
    const detailMemoForCase =
      workType === "registration_insurance"
        ? insuranceNote.trim() || null
        : workType === "tire_sales"
          ? tireNote.trim() || null
          : workType === "finance"
            ? financeNote.trim() || null
            : workType === "forklift_sales"
              ? (forkliftNote.trim() || forkliftOptionNote.trim() || null)
              : workType === "battery_sales"
                ? batteryNote.trim() || null
                : null;

    const isClosing = isClosingByCurrentForm();
    const casePayload = {
      call_datetime: callDatetime
        ? new Date(`${callDatetime}T00:00:00`).toISOString()
        : new Date().toISOString(),
      customer_name: customerName.trim(),
      phone: phone.trim(),
      telecom_provider: telecomProvider || null,
      company_name: companyName.trim() || null,
      region: region.trim() || null,
      work_type: workType,
      sub_type: subType || null,
      status: isClosing ? "closed" : editingCaseId ? status || "new" : "new",
      summary: autoSummary,
      detail_memo: detailMemoForCase,
      followup_needed: false,
      next_followup_date: null,
    };

    let savedCaseId: number | null = editingCaseId;

    if (editingCaseId) {
      const { error: caseError } = await supabase
        .from("consultation_cases")
        .update(casePayload)
        .eq("id", editingCaseId);

      if (caseError) {
        alert("수정 실패: " + caseError.message);
        return;
      }
    } else {
      const { data: insertedCase, error: caseError } = await supabase
        .from("consultation_cases")
        .insert([casePayload])
        .select("id")
        .single();

      if (caseError) {
        alert("저장 실패: " + caseError.message);
        return;
      }

      savedCaseId = insertedCase.id;
    }

    if (!savedCaseId) {
      alert("상담건 저장 ID를 확인할 수 없습니다.");
      return;
    }

    if (editingCaseId) {
      const deleteTargets = [
        "consultation_insurance_details",
        "consultation_tire_details",
        "consultation_finance_details",
        "consultation_forklift_details",
        "consultation_battery_details",
      ].filter(
        (table) =>
          (workType === "registration_insurance" && table !== "consultation_insurance_details") ||
          (workType === "tire_sales" && table !== "consultation_tire_details") ||
          (workType === "finance" && table !== "consultation_finance_details") ||
          (workType === "forklift_sales" && table !== "consultation_forklift_details") ||
          (workType === "battery_sales" && table !== "consultation_battery_details")
      );

      if (deleteTargets.length) {
        await Promise.all(
          deleteTargets.map((table) =>
            supabase.from(table).delete().eq("consultation_id", savedCaseId)
          )
        );
      }
    }

    if (workType === "registration_insurance") {
      const processStatus = deriveInsuranceProcessStatus(
        designRequested,
        applicationIssued,
        paymentCompleted,
        policyIssued
      );

      const { error: insuranceError } = await supabase
        .from("consultation_insurance_details")
        .upsert(
          [
            {
              consultation_id: savedCaseId,
            vehicle_no: insuranceVehicleNo.trim() || null,
            vehicle_model: insuranceVehicleModel || null,
            vehicle_use: insuranceVehicleUse || null,
            insurance_request: insuranceRequest.trim() || null,
            insurance_type: insuranceType || null,
            job: insuranceJob.trim() || null,
            insurance_company: insuranceCompany || null,
            insurance_start_date: insuranceStartDate || null,
            insurance_end_date: insuranceEndDate || null,
            design_requested: designRequested,
            application_issued: applicationIssued,
            payment_completed: paymentCompleted,
            policy_issued: policyIssued,
            process_status: processStatus,
              note: insuranceNote.trim() || null,
            },
          ],
          { onConflict: "consultation_id" }
        );

      if (insuranceError) {
        alert(`상담건은 저장되었지만 보험 상세 저장 실패: ${insuranceError.message}\ncode: ${insuranceError.code ?? "-"}\ndetails: ${insuranceError.details ?? "-"}\nhint: ${insuranceError.hint ?? "-"}`);
        await fetchConsultations();
        await fetchFollowups();
        await fetchInsuranceExpiries();
        setTab("list");
        return;
      }

      const narumiPrefill = (location.state as any)?.narumiInsurancePrefill;
      const narumiTaskId = narumiPrefill?.narumiTaskId;
      const normalizedVehicleNo = normalizeVehicleNo(insuranceVehicleNo);

      try {
        if (normalizedVehicleNo) {
          await syncNarumiInsuranceByVehicleNo(normalizedVehicleNo);
        } else if (narumiTaskId !== undefined && narumiTaskId !== null) {
          const { data: narumiTask, error: narumiFetchError } = await supabase
            .from("narumi_tasks")
            .select("id, vin, docs_ready, is_registered, vehicle_doc_path")
            .eq("id", narumiTaskId)
            .maybeSingle();

          if (narumiFetchError) throw narumiFetchError;
          if (narumiTask?.vin) {
            await syncNarumiInsuranceByVehicleNo(narumiTask.vin);
          }
        }
      } catch (syncError: any) {
        alert("상담건은 저장되었지만 나르미 보험단계 동기화 실패: " + (syncError?.message || "알 수 없는 오류"));
      }

      // 나르미에서 넘어온 경우 저장 후 나르미로 복귀
      if (narumiPrefill) {
        alert("보험 상담이 등록되었습니다.");
        navigate("/narumi", { replace: true });
        return;
      }
    }

    if (workType === "tire_sales") {
      const frontQtyNum = tireFrontQuantity ? Number(tireFrontQuantity) : 0;
      const rearQtyNum = tireRearQuantity ? Number(tireRearQuantity) : 0;
      const totalQty = frontQtyNum + rearQtyNum;

      const { error: tireError } = await supabase
        .from("consultation_tire_details")
        .upsert(
          [
            {
              consultation_id: savedCaseId,
              vehicle_info: tireVehicleInfo.trim() || null,
            vehicle_type: tireVehicleType.trim() || null,
            tire_size: tireSize.trim() || null,
            quantity: totalQty || null,
            front_quantity: frontQtyNum || null,
            rear_quantity: rearQtyNum || null,
            region_detail: tireRegionDetail.trim() || null,
            inflow_channel: tireInflowChannel || null,
            association_name:
              tireInflowChannel === "association" ? tireAssociationName || null : null,
            process_status: progressStage || "contract",
              note: tireNote.trim() || null,
            },
          ],
          { onConflict: "consultation_id" }
        );

      if (tireError) {
        alert(`상담건은 저장되었지만 타이어 상세 저장 실패: ${tireError.message}\ncode: ${tireError.code ?? "-"}\ndetails: ${tireError.details ?? "-"}\nhint: ${tireError.hint ?? "-"}`);
        await fetchConsultations();
        await fetchFollowups();
        await fetchInsuranceExpiries();
        setTab("list");
        return;
      }

      // ── 신규 등록 시 자동화: 익일 할 일 + 진흥 알림톡 + admin 알림톡 ──
      if (!editingCaseId && savedCaseId) {
        const tomorrowDate = (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          return d.toISOString().slice(0, 10);
        })();

        const frontQtyNum = tireFrontQuantity ? Number(tireFrontQuantity) : 0;
        const rearQtyNum  = tireRearQuantity  ? Number(tireRearQuantity)  : 0;
        const totalQtyNum = frontQtyNum + rearQtyNum;
        const qtyStr      = totalQtyNum > 0 ? `${totalQtyNum}개` : "";
        const todoTitle   = `[타이어] ${customerName.trim()} ${tireSize.trim()} ${qtyStr}`.trim();

        // ① 익일 할 일 등록 (secretary_todos)
        try {
          await supabase.from("secretary_todos").insert({
            title:    todoTitle,
            description: tireNote.trim() || null,
            priority: "normal",
            category: "tire",
            due_date: tomorrowDate,
            is_done:  false,
          });
        } catch (todoErr) {
          console.error("[타이어 할 일 등록 오류]:", todoErr);
        }

        // ② 진흥 알림톡 + tb_orders 등록
        try {
          const nowIso = new Date().toISOString();
          const { data: tbOrder, error: tbErr } = await supabase
            .from("tb_orders")
            .insert({
              customer_name_raw: customerName.trim(),
              inbound_channel:   "phone",
              raw_message:       `${tireSize.trim()} ${qtyStr}`.trim(),
              product_type:      "tire",
              product_spec:      tireSize.trim() || null,
              quantity:          totalQtyNum || null,
              status:            "forwarded",
              parsed_confidence: "high",
              forwarded_at:      nowIso,
              consultation_id:   savedCaseId,
            })
            .select("id")
            .single();

          if (tbErr) {
            console.error("[tb_orders insert 오류]:", tbErr.message);
            alert(`주문 등록 실패(알림톡 미발송): ${tbErr.message}`);
          } else if (tbOrder) {
            const orderId = (tbOrder as any).id as string;
            const { error: kakaoErr } = await supabase.functions.invoke("send-hyundaicm-kakao", {
              body: {
                type:         "order_forwarded",
                orderNo:      orderId,
                customerName: customerName.trim(),
                productSpec:  tireSize.trim() || "확인필요",
                quantity:     totalQtyNum > 0 ? String(totalQtyNum) : "확인필요",
                deliveredUrl: `https://rnfkorea.co.kr/order/confirm/delivered/${orderId}`,
              },
            });
            if (kakaoErr) {
              console.error("[진흥 알림톡 오류]:", kakaoErr);
              alert(`주문 등록됐지만 알림톡 발송 실패: ${JSON.stringify(kakaoErr)}`);
            }
          }
        } catch (kakaoErr) {
          console.error("[진흥 알림톡 오류]:", kakaoErr);
        }

        // ③ AI비서 채팅에 신규 상담 알림 기록
        try {
          const chatMsg = [
            `📌 **타이어 상담 신규등록**`,
            ``,
            `고객: **${customerName.trim()}** (${phone.trim()})`,
            `규격: ${tireSize.trim()} ${qtyStr}`,
            tireVehicleInfo.trim() ? `차량: ${tireVehicleInfo.trim()}` : null,
            tireNote.trim() ? `비고: ${tireNote.trim()}` : null,
            ``,
            `✅ 진흥 알림톡 발송 완료 | 내일 할 일 등록됨`,
          ].filter((v) => v !== null).join("\n");
          await supabase.from("secretary_chat_logs").insert({
            role: "assistant",
            content: chatMsg,
            session_id: "main",
          });
        } catch (chatErr) {
          console.error("[채팅 알림 오류]:", chatErr);
        }
      }
    }

    if (workType === "finance") {
      const { error: financeError } = await supabase
        .from("consultation_finance_details")
        .upsert(
          [
            {
              consultation_id: savedCaseId,
              finance_category: financeCategory || null,
              finance_vehicle_model: financeVehicleModel.trim() || null,
              finance_product: financeProduct || null,
              finance_company: financeCompany || null,
              finance_amount: financeAmount ? Number(onlyDigits(financeAmount)) : null,
              finance_period: financePeriod ? Number(financePeriod) : null,
              finance_interest_rate: financeInterestRate ? Number(financeInterestRate) : null,
              finance_incentive: financeIncentive ? Number(financeIncentive) : null,
              finance_stage: financeStage || null,
              finance_aftercare: nextFollowupDate ? true : false,
              note: financeNote.trim() || null,
            },
          ],
          { onConflict: "consultation_id" }
        );

      if (financeError) {
        alert(`상담건은 저장되었지만 금융 상세 저장 실패: ${financeError.message}\ncode: ${financeError.code ?? "-"}\ndetails: ${financeError.details ?? "-"}\nhint: ${financeError.hint ?? "-"}`);
        await fetchConsultations();
        await fetchFollowups();
        await fetchInsuranceExpiries();
        setTab("list");
        return;
      }
    }

    if (workType === "forklift_sales") {
      const { error: forkliftError } = await supabase
        .from("consultation_forklift_details")
        .upsert(
          [
            {
              consultation_id: savedCaseId,
              forklift_condition: forkliftCondition || null,
              forklift_type: forkliftType || null,
              forklift_ton: forkliftTon.trim() || null,
              forklift_status: progressStage || "contract",
              forklift_option_note: forkliftOptionNote.trim() || null,
              forklift_sale_method: forkliftSaleMethod || null,
              process_stage: progressStage || "contract", // secretary와 동일 컬럼
              note: forkliftNote.trim() || null,
            },
          ],
          { onConflict: "consultation_id" }
        );

      if (forkliftError) {
        alert(`상담건은 저장되었지만 지게차 상세 저장 실패: ${forkliftError.message}\ncode: ${forkliftError.code ?? "-"}\ndetails: ${forkliftError.details ?? "-"}\nhint: ${forkliftError.hint ?? "-"}`);
        await fetchConsultations();
        await fetchFollowups();
        await fetchInsuranceExpiries();
        setTab("list");
        return;
      }
    }

    if (workType === "battery_sales") {
      // note에 [status:...] 패턴으로 단계 저장 (기존 note 내용 보존)
      const baseNote = batteryNote.trim().replace(/\[status:[^\]]*\]/g, "").trim();
      const noteWithStatus = progressStage
        ? `${baseNote ? baseNote + " " : ""}[status:${progressStage}]`
        : baseNote || null;

      const { error: batteryError } = await supabase
        .from("consultation_battery_details")
        .upsert(
          [
            {
              consultation_id: savedCaseId,
              battery_vehicle_type: batteryVehicleType || null,
              battery_drive_type: batteryDriveType || null,
              battery_voltage: batteryVoltage ? Number(batteryVoltage) : null,
              battery_capacity_ah: batteryCapacityAh ? Number(batteryCapacityAh) : null,
              battery_total_capacity_kwh: batteryTotalCapacityKwh || null,
              battery_size_l: batterySizeL ? Number(batterySizeL) : null,
              battery_due_date: batteryDueDate || null,
              battery_weight_kg: batteryWeightKg ? Number(batteryWeightKg) : null,
              battery_unit_price_per_kwh: batteryUnitPricePerKwh ? Number(batteryUnitPricePerKwh) : null,
              battery_exchange_rate: batteryExchangeRate ? Number(batteryExchangeRate) : null,
              battery_unit_sale_price: batteryUnitSalePrice ? Number(batteryUnitSalePrice.replace(/,/g,"")) : null,
              battery_quantity: batteryQuantity ? Number(batteryQuantity) : null,
              battery_sale_price: batterySalePrice ? Math.round(batterySalePrice) : null,
              process_stage: progressStage || "contract", // secretary와 동일 컬럼
              note: noteWithStatus,
            },
          ],
          { onConflict: "consultation_id" }
        );

      if (batteryError) {
        alert(`상담건은 저장되었지만 배터리 상세 저장 실패: ${batteryError.message}\ncode: ${batteryError.code ?? "-"}\ndetails: ${batteryError.details ?? "-"}\nhint: ${batteryError.hint ?? "-"}`);
        await fetchConsultations();
        await fetchFollowups();
        await fetchInsuranceExpiries();
        setTab("list");
        return;
      }
    }

    if (workType === "export") {
      const { error: exportError } = await supabase
        .from("consultation_export_details")
        .upsert(
          [{ consultation_id: savedCaseId, export_stage: progressStage || "contract" }],
          { onConflict: "consultation_id" }
        );
      if (exportError) {
        alert(`상담건은 저장되었지만 수출 상세 저장 실패: ${exportError.message}`);
        await fetchConsultations(); await fetchFollowups(); await fetchInsuranceExpiries();
        setTab("list"); return;
      }
    }

    // 신규 등록 건만 구글 캘린더 자동 동기화 (할일로 등록) — 단, 등록과 동시에 종결이면 생략
    if (!editingCaseId && savedCaseId && !isClosing) {
      void syncConsultToGcal({
        id: savedCaseId,
        customer_name: casePayload.customer_name,
        work_type: workType,
      });
    }
    // 종결 처리된 건은 구글 할일도 완료 처리 (목록에서 사라짐)
    if (isClosing && savedCaseId) {
      void completeConsultGcalTask(savedCaseId);
    }

    alert(editingCaseId ? "수정 완료" : "저장 완료");
    resetForm();
    await fetchConsultations();
    await fetchFollowups();
    await fetchInsuranceExpiries();
    setTab("list");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteFollowup = async (id: number) => {
    const ok = window.confirm("이 사후관리를 완료 처리하시겠습니까?");
    if (!ok) return;

    const { error } = await supabase
      .from("consultation_cases")
      .update({
        followup_needed: false,
        status: "completed",
        next_followup_date: null,
      })
      .eq("id", id);

    if (error) {
      alert("처리 실패: " + error.message);
      return;
    }

    await fetchConsultations();
    await fetchFollowups();
    alert("사후관리 완료 처리되었습니다.");
  };

  const handleRescheduleFollowup = async (id: number, nextDate?: string) => {
    const resolvedDate = nextDate || followupRescheduleMap[id] || "";
    if (!resolvedDate) return alert("새 사후관리 일정을 입력해 주세요.");

    const { error } = await supabase
      .from("consultation_cases")
      .update({
        followup_needed: true,
        status: "in_progress",
        next_followup_date: resolvedDate,
      })
      .eq("id", id);

    if (error) {
      alert("일정 저장 실패: " + error.message);
      return;
    }

    setFollowupRescheduleMap((prev) => ({ ...prev, [id]: resolvedDate }));
    await fetchConsultations();
    await fetchFollowups();
    alert("사후관리 일정이 저장되었습니다.");
  };

  const openFollowupDatePicker = (id: number) => {
    const input = document.getElementById(`followup-date-${id}`) as HTMLInputElement | null;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">로그인 확인 중입니다...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/narumi/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessConsulting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-xl w-full border border-red-200 bg-red-50 rounded-2xl p-6">
          <div className="text-lg font-semibold text-red-700 mb-2">
            접근 권한이 없습니다.
          </div>
          <div className="text-sm text-red-700 leading-relaxed">
            상담관리 페이지는 허용된 계정만 접근할 수 있습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* 매출 등록(계산서 매칭) 모달 */}
      {showInvoiceRegModal && (
        <div className="fixed inset-0 z-[99999] flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto" onClick={closeInvoiceRegModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-semibold text-[#0f172a]">매출 등록 / 계산서 매칭</p>
              <button className="text-gray-400 hover:text-gray-600" onClick={closeInvoiceRegModal}>✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              선택한 {invoiceRegRows.length}건을 한 장의 계산서에 묶어 매출관리에 등록합니다. 거래처: <span className="font-semibold text-gray-700">{invoiceRegForm.customer_name}</span>
            </p>

            {/* 모드 선택 */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                className={`${typeBtnBase} ${invoiceRegMode === "manual" ? typeBtnActive : typeBtnInactive}`}
                onClick={() => setInvoiceRegMode("manual")}
              >
                수기입력
              </button>
              <button
                type="button"
                className={`${typeBtnBase} ${invoiceRegMode === "image" ? typeBtnActive : typeBtnInactive}`}
                onClick={() => setInvoiceRegMode("image")}
              >
                계산서 이미지 업로드
              </button>
            </div>

            {invoiceRegMode === "image" && (
              <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 flex items-center gap-3">
                <input
                  ref={invoiceRegFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInvoiceRegFile}
                />
                <button
                  type="button"
                  className={actionBtnClass}
                  disabled={invoiceRegParsing}
                  onClick={() => invoiceRegFileRef.current?.click()}
                >
                  {invoiceRegParsing ? "인식 중..." : "이미지 선택"}
                </button>
                <p className="text-xs text-gray-400">계산서 캡처 이미지를 업로드하면 계산서번호/공급가액/세액/합계금액이 자동으로 채워집니다.</p>
              </div>
            )}

            {/* 계산서 정보 */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 mb-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">계산서 정보</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">작성일자</label>
                  <input
                    type="date"
                    value={invoiceRegForm.issue_date}
                    onChange={(e) => setInvoiceRegField("issue_date", e.target.value)}
                    className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">계산서번호</label>
                  <input
                    value={invoiceRegForm.invoice_no}
                    onChange={(e) => setInvoiceRegField("invoice_no", e.target.value)}
                    placeholder="승인번호"
                    className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">사업자번호</label>
                  <input
                    value={invoiceRegForm.business_no}
                    onChange={(e) => setInvoiceRegField("business_no", e.target.value)}
                    placeholder="숫자만"
                    className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">공급가액</label>
                  <input
                    type="number"
                    value={invoiceRegForm.supply_amount}
                    onChange={(e) => setInvoiceRegField("supply_amount", e.target.value)}
                    placeholder="0"
                    className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">세액</label>
                  <input
                    type="number"
                    value={invoiceRegForm.tax_amount}
                    onChange={(e) => setInvoiceRegField("tax_amount", e.target.value)}
                    placeholder="0"
                    className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">합계금액</label>
                  <input
                    type="number"
                    value={invoiceRegForm.total_amount}
                    onChange={(e) => setInvoiceRegField("total_amount", e.target.value)}
                    placeholder="0"
                    className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400"
                  />
                </div>
              </div>
            </div>

            {/* 딜별 매출 정보 */}
            <div className="space-y-3 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">매출 건별 정보 ({invoiceRegRows.length}건)</p>
              {invoiceRegRows.map((r) => (
                <div key={r.consultation_id} className="rounded-2xl border border-gray-200 p-3 grid grid-cols-2 md:grid-cols-6 gap-2">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">종류</label>
                    <select
                      value={r.category}
                      onChange={(e) => setInvoiceRegRowField(r.consultation_id, "category", e.target.value)}
                      className="w-full h-9 rounded-xl border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400"
                    >
                      {SALES_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">거래구분</label>
                    <select
                      value={r.trade_type}
                      onChange={(e) => setInvoiceRegRowField(r.consultation_id, "trade_type", e.target.value as "내수" | "수출")}
                      className="w-full h-9 rounded-xl border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400"
                    >
                      {SALES_TRADE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Maker</label>
                    <input
                      value={r.maker}
                      onChange={(e) => setInvoiceRegRowField(r.consultation_id, "maker", e.target.value)}
                      className="w-full h-9 rounded-xl border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">규격</label>
                    <input
                      value={r.spec}
                      onChange={(e) => setInvoiceRegRowField(r.consultation_id, "spec", e.target.value)}
                      className="w-full h-9 rounded-xl border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">수량</label>
                    <input
                      type="number"
                      value={r.quantity}
                      onChange={(e) => setInvoiceRegRowField(r.consultation_id, "quantity", e.target.value)}
                      className="w-full h-9 rounded-xl border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">판매단가</label>
                    <input
                      type="number"
                      value={r.unit_price}
                      onChange={(e) => setInvoiceRegRowField(r.consultation_id, "unit_price", e.target.value)}
                      className="w-full h-9 rounded-xl border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">매입단가</label>
                    <input
                      type="number"
                      value={r.unit_cost}
                      onChange={(e) => setInvoiceRegRowField(r.consultation_id, "unit_cost", e.target.value)}
                      className="w-full h-9 rounded-xl border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <p className="text-xs text-gray-400">
                      매출 <span className="font-semibold text-gray-700">{Math.round(calcInvoiceRegRowRevenue(r)).toLocaleString("ko-KR")}원</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* 합계 비교 */}
            <div className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 mb-4 ${
              invoiceRegIsClose && invoiceRegTotalAmount > 0 ? "border-emerald-200 bg-emerald-50" : "border-gray-100 bg-gray-50"
            }`}>
              <div>
                <p className="text-[11px] text-gray-400 font-medium">건별 매출 합계</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{Math.round(invoiceRegSelectedSum).toLocaleString("ko-KR")}원</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium">계산서 합계금액</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{Math.round(invoiceRegTotalAmount).toLocaleString("ko-KR")}원</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium">차이</p>
                <p className={`text-sm font-semibold mt-0.5 ${invoiceRegIsClose ? "text-emerald-600" : "text-red-500"}`}>
                  {Math.round(invoiceRegDiff).toLocaleString("ko-KR")}원{invoiceRegIsClose && invoiceRegTotalAmount > 0 ? " · 일치" : ""}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button className={actionBtnClass} onClick={closeInvoiceRegModal}>취소</button>
              <button
                className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-40"
                onClick={handleConfirmInvoiceReg}
                disabled={invoiceRegSaving}
              >
                {invoiceRegSaving ? "등록 중..." : `매출 등록 확정 (${invoiceRegRows.length}건)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* D+30일 초과 상담 취소 후보 팝업 */}
      {showOverdueModal && overdueRows.length > 0 && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 px-4" onClick={()=>setShowOverdueModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-semibold text-[#0f172a]">⚠️ D+30일 초과 상담 ({overdueRows.length}건)</p>
              <button className="text-gray-400 hover:text-gray-600" onClick={()=>setShowOverdueModal(false)}>✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">진전이 없는 상담입니다. 취소 처리하거나 계속 유지할 수 있습니다.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {overdueRows.map(r=>{
                const days = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000);
                const wtLbl: Record<string,string> = {tire_sales:"타이어",finance:"금융",forklift_sales:"지게차",battery_sales:"배터리",export:"수출",registration_insurance:"보험"};
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50">
                    <div>
                      <span className="text-sm font-semibold text-[#0f172a]">{r.customer_name}</span>
                      <span className="ml-2 text-xs text-orange-500">{wtLbl[r.work_type??'']??r.work_type}</span>
                      <span className="ml-2 text-xs text-red-400 font-medium">D+{days}일</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        className="px-3 py-1 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600"
                        onClick={async()=>{
                          await supabase.from("consultation_cases").update({status:"closed"}).eq("id",r.id);
                          void completeConsultGcalTask(r.id);
                          setOverdueRows(prev=>prev.filter(x=>x.id!==r.id));
                          void fetchConsultations();
                        }}
                      >취소처리</button>
                      <button
                        className="px-3 py-1 rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                        onClick={()=>setOverdueRows(prev=>prev.filter(x=>x.id!==r.id))}
                      >유지</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 py-1.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all"
                onClick={async()=>{
                  await Promise.all(overdueRows.map(r=>supabase.from("consultation_cases").update({status:"closed"}).eq("id",r.id)));
                  overdueRows.forEach(r=>void completeConsultGcalTask(r.id));
                  setOverdueRows([]);
                  setShowOverdueModal(false);
                  void fetchConsultations();
                }}
              >전체 취소처리</button>
              <button
                className="flex-1 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-gray-300 transition-all"
                onClick={()=>setShowOverdueModal(false)}
              >전체 유지</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 헤더 (AI비서 스타일) ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate("/work/secretary")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-gray-300 hover:text-gray-700 transition-all"
          >
            ← AI비서
          </button>
          <span className="text-sm font-semibold text-[#0f172a]">📋 상담관리</span>
        </div>
      </div>

      {/* ── 탭 헤더 ── */}
      <div className="border-b border-gray-100 bg-white">
        <div className="px-4 py-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={`${tabBase} ${tab === "new" ? tabActive : tabInactive}`}
            onClick={() => setTab("new")}
          >
            상담등록
          </button>
          <button
            type="button"
            className={`${tabBase} ${tab === "list" ? tabActive : tabInactive}`}
            onClick={() => setTab("list")}
          >
            상담내역
          </button>
          <button
            type="button"
            className={`${tabBase} ${tab === "followups" ? tabActive : tabInactive}`}
            onClick={() => setTab("followups")}
          >
            사후관리
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 py-3 space-y-3">



      <div className={card}>
        <div className="flex flex-col gap-2.5 px-4 pt-3 pb-3 md:flex-row md:items-center md:justify-between">
          <div className="text-base font-semibold text-[#0f172a]">{title}</div>

          {tab === "new" && (
            <>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold text-gray-600"></div>
              <button
                type="button"
                className={`${typeBtnBase} ${
                  workType === "registration_insurance" ? typeBtnActive : typeBtnInactive
                }`}
                onClick={() => setWorkType("registration_insurance")}
              >
                보험
              </button>
              {!insuranceOnlyScope && (
                <button
                  type="button"
                  className={`${typeBtnBase} ${
                    workType === "tire_sales" ? typeBtnActive : typeBtnInactive
                  }`}
                  onClick={() => setWorkType("tire_sales")}
                >
                  타이어
                </button>
              )}
              {!insuranceOnlyScope && (
                <button
                  type="button"
                  className={`${typeBtnBase} ${
                    workType === "finance" ? typeBtnActive : typeBtnInactive
                  }`}
                  onClick={() => setWorkType("finance")}
                >
                  금융
                </button>
              )}
              {!insuranceOnlyScope && (
                <button
                  type="button"
                  className={`${typeBtnBase} ${
                    workType === "forklift_sales" ? typeBtnActive : typeBtnInactive
                  }`}
                  onClick={() => setWorkType("forklift_sales")}
                >
                  지게차
                </button>
              )}
              {!insuranceOnlyScope && (
                <button
                  type="button"
                  className={`${typeBtnBase} ${
                    workType === "battery_sales" ? typeBtnActive : typeBtnInactive
                  }`}
                  onClick={() => setWorkType("battery_sales")}
                >
                  배터리
                </button>
              )}
              {!insuranceOnlyScope && (
                <button
                  type="button"
                  className={`${typeBtnBase} ${
                    workType === "export" ? typeBtnActive : typeBtnInactive
                  }`}
                  onClick={() => setWorkType("export")}
                >
                  수출
                </button>
              )}
            </div>
            {/* 세분류 선택 */}
            {workType && workType !== "registration_insurance" && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">세분류</label>
                <select
                  className="w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-[#0f172a] bg-white focus:outline-none focus:border-orange-400"
                  value={subType}
                  onChange={(e) => setSubType(e.target.value)}
                >
                  <option value="">선택 안함</option>
                  {workType === "tire_sales" && <>
                    <option value="화물차">화물차</option>
                    <option value="지게차">지게차</option>
                    <option value="고소작업대">고소작업대</option>
                  </>}
                  {workType === "battery_sales" && <>
                    <option value="지게차">지게차</option>
                    <option value="고소작업대">고소작업대</option>
                    <option value="농기계">농기계</option>
                  </>}
                  {workType === "finance" && <>
                    <option value="현대건설기계">현대건설기계</option>
                    <option value="기타할부금융">기타할부금융</option>
                  </>}
                  {workType === "forklift_sales" && <>
                    <option value="신차">신차</option>
                    <option value="중고">중고</option>
                    <option value="렌탈">렌탈</option>
                  </>}
                  {workType === "export" && <>
                    <option value="고소작업대(중고)">고소작업대(중고)</option>
                    <option value="배터리">배터리</option>
                    <option value="기타">기타</option>
                  </>}
                </select>
              </div>
            )}
            </>
          )}
        </div>

        {tab === "new" && (
          <div className="space-y-3">
            <form ref={newFormTopRef} className="space-y-3" onSubmit={handleSubmit}>
            {editingCaseId && (
              <div className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                <div className="text-sm font-medium text-orange-700">
                  상담내역 수정 중입니다. 저장하면 기존 상담건이 업데이트됩니다.
                </div>
                <button
                  type="button"
                  className={actionBtnClass}
                  onClick={resetForm}
                >
                  수정취소
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#0f172a]">To-Do</div>
                  <div className="text-xs text-gray-500">사후관리의 당일 + 익일 할 일 목록</div>
                </div>

                <button
                  type="button"
                  className="inline-flex h-9 min-w-[42px] items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-gray-300"
                  onClick={() => setShowTodoBox((prev) => !prev)}
                  aria-expanded={showTodoBox}
                  aria-label={showTodoBox ? 'To-Do 접기' : 'To-Do 펼치기'}
                >
                  {showTodoBox ? '-' : '+'}
                </button>
              </div>

              {showTodoBox && (
                <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  {todayTomorrowTodoSummary}
                </div>
              )}
            </div>

            <div className={grid5Class}>
              <div>
                <label className={labelClass}>상담일자</label>
                <input
                  type="date"
                  className={controlClass}
                  style={insuranceEqualDateFieldStyle}
                  value={callDatetime}
                  onChange={(e) => setCallDatetime(e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>고객명</label>
                <input
                  ref={customerNameInputRef}
                  type="text"
                  className={controlClass}
                  style={insuranceEqualFieldStyle}
                  placeholder="예: 홍길동"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>연락처</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={controlClass}
                  style={insuranceEqualFieldStyle}
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                />
              </div>
            </div>

            {workType === "registration_insurance" && (
              <div className="space-y-4 pt-2">
                <div className={sectionTitleClass}>보험 상세</div>

                <div className={grid5Class}>
                  <div>
                    <label className={labelClass}>통신사</label>
                    <select
                      className={controlClass}
                      style={insuranceEqualFieldStyle}
                      value={telecomProvider}
                      onChange={(e) => setTelecomProvider(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="SKT">SKT</option>
                      <option value="KT">KT</option>
                      <option value="LGU+">LGU+</option>
                      <option value="알뜰폰">알뜰폰</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>차량번호</label>
                    <input
                      type="text"
                      lang="ko"
                      inputMode="text"
                      autoComplete="off"
                      spellCheck={false}
                      className={controlClass}
                      style={insuranceEqualFieldStyle}
                      placeholder="예: 123가4567"
                      value={insuranceVehicleNo}
                      onChange={(e) => setInsuranceVehicleNo(onlyKoreanAndDigits(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>차종 / 모델</label>
                    <select
                      className={controlClass}
                      style={insuranceEqualFieldStyle}
                      value={insuranceVehicleModel}
                      onChange={(e) => setInsuranceVehicleModel(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="2.5톤 이하">2.5톤 이하</option>
                      <option value="2.5톤 이상">2.5톤 이상</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>사용용도</label>
                    <select
                      className={controlClass}
                      style={insuranceEqualFieldStyle}
                      value={insuranceVehicleUse}
                      onChange={(e) => setInsuranceVehicleUse(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="영업용">영업용</option>
                      <option value="개인용">개인용</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>보험 요청 내용</label>
                    <select
                      className={controlClass}
                      style={insuranceEqualFieldStyle}
                      value={insuranceRequest}
                      onChange={(e) => setInsuranceRequest(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="신규">신규</option>
                      <option value="갱신">갱신</option>
                      <option value="해지">해지</option>
                      <option value="비교견적">비교견적</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>보험종류</label>
                    <select
                      className={controlClass}
                      style={insuranceEqualFieldStyle}
                      value={insuranceType}
                      onChange={(e) => setInsuranceType(e.target.value)}
                    >
                      <option value="automobile">자동차보험</option>
                      <option value="cargo">적재물보험</option>
                      <option value="general">일반보험</option>
                      <option value="health">건강보험</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>가입 보험사</label>
                    <select
                      className={controlClass}
                      style={insuranceEqualFieldStyle}
                      value={insuranceCompany}
                      onChange={(e) => setInsuranceCompany(e.target.value)}
                    >
                      <option value="">선택</option>
                      <optgroup label="손해보험">
                        {NON_LIFE_INSURERS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="생명보험">
                        {LIFE_INSURERS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>가입일자</label>
                    <input
                      type="date"
                      className={controlClass}
                      style={insuranceEqualDateFieldStyle}
                      value={insuranceStartDate}
                      onChange={(e) => setInsuranceStartDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>만기일자</label>
                    <input
                      type="date"
                      className={controlClass}
                      style={insuranceEqualDateFieldStyle}
                      value={insuranceEndDate}
                      onChange={(e) => setInsuranceEndDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>보험 진행상태</label>
                    <select
                      className={controlClass}
                      style={insuranceEqualFieldStyle}
                      value={policyIssued ? "issued" : "requested"}
                      onChange={(e) =>
                        handleInsuranceStatusSelect(e.target.value as "requested" | "issued")
                      }
                    >
                      <option value="requested">설계요청</option>
                      <option value="issued">증권발급</option>
                    </select>
                  </div>

                </div>


                <div>
                  <label className={labelClass}>상담내용</label>
                  <textarea
                    className={textareaClass}
                    placeholder="보험 문의 배경, 요청 조건, 진행 메모 등을 입력하세요."
                    value={insuranceNote}
                    onChange={(e) => setInsuranceNote(e.target.value)}
                  />
                </div>
              </div>
            )}

    
            {workType === "finance" && (
              <div className="space-y-4 pt-2">
                <div className={sectionTitleClass}>금융 상세</div>

                <div className={grid5Class}>
                  <div>
                    <label className={labelClass}>종목</label>
                    <select
                      className={controlClass}
                      value={financeCategory}
                      onChange={(e) => setFinanceCategory(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="화물">화물</option>
                      <option value="건설">건설</option>
                      <option value="고소작업대">고소작업대</option>
                      <option value="배터리">배터리</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>차종</label>
                    <input
                      type="text"
                      className={controlClass}
                      placeholder="예: 포터2 / 3.5톤 카고 / 스카이"
                      value={financeVehicleModel}
                      onChange={(e) => setFinanceVehicleModel(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>상품</label>
                    <select
                      className={controlClass}
                      value={financeProduct}
                      onChange={(e) => setFinanceProduct(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="할부">할부</option>
                      <option value="리스">리스</option>
                      <option value="렌탈">렌탈</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>금융사</label>
                    <select
                      className={controlClass}
                      value={financeCompany}
                      onChange={(e) => setFinanceCompany(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="KB캐피탈">KB캐피탈</option>
                      <option value="NH캐피탈">NH캐피탈</option>
                      <option value="오릭스">오릭스</option>
                      <option value="HCI">HCI</option>
                      <option value="BNK캐피탈">BNK캐피탈</option>
                      <option value="메리츠캐피탈">메리츠캐피탈</option>
                      <option value="롯데오토리스">롯데오토리스</option>
                      <option value="농협">농협</option>
                      <option value="우리금융">우리금융</option>
                      <option value="BSON">BSON</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>취급액</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`${controlClass} pr-10`}
                        placeholder="예: 50,000,000"
                        value={formatNumberWithCommas(financeAmount)}
                        onChange={(e) => setFinanceAmount(onlyDigits(e.target.value))}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        원
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>기간</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={controlClass}
                      placeholder="예: 36"
                      value={financePeriod}
                      onChange={(e) => setFinancePeriod(onlyDigits(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>금리</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={controlClass}
                      placeholder="예: 5.9"
                      value={financeInterestRate}
                      onChange={(e) =>
                        setFinanceInterestRate(e.target.value.replace(/[^0-9.]/g, ""))
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>인센티브</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`${controlClass} pr-8`}
                        placeholder="예: 2.5"
                        value={financeIncentive}
                        onChange={(e) =>
                          setFinanceIncentive(e.target.value.replace(/[^0-9.]/g, ""))
                        }
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        %
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>진행단계</label>
                    <select
                      className={controlClass}
                      value={financeStage}
                      onChange={(e) => setFinanceStage(e.target.value)}
                    >
                      <option value="received">접수</option>
                      <option value="credit_check">신용조회</option>
                      <option value="approved">승인</option>
                      <option value="supplement">보완</option>
                      <option value="rejected">거절</option>
                      <option value="doc_registration">서류등록</option>
                      <option value="contract_sent">전자계약발송</option>
                      <option value="confirmed">확정</option>
                      <option value="cancelled">취소</option>
                    </select>
                  </div>


                </div>

                <div>
                  <label className={labelClass}>상담내용</label>
                  <textarea
                    className={textareaClass}
                    placeholder="금융조건, 요청사항, 진행 메모 등을 입력하세요."
                    value={financeNote}
                    onChange={(e) => setFinanceNote(e.target.value)}
                  />
                </div>
              </div>
            )}


            {workType === "forklift_sales" && (
              <div className="space-y-4 pt-2">
                <div className={sectionTitleClass}>지게차 판매 상세</div>

                <div className={grid5Class}>
                  <div>
                    <label className={labelClass}>구분</label>
                    <select
                      className={controlClass}
                      value={forkliftCondition}
                      onChange={(e) => setForkliftCondition(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="new">신차</option>
                      <option value="used">중고</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>형식</label>
                    <select
                      className={controlClass}
                      value={forkliftType}
                      onChange={(e) => setForkliftType(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="diesel">디젤</option>
                      <option value="electric_seated">전동좌승</option>
                      <option value="electric_standing">전동입승</option>
                      <option value="special">특수지게차</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>톤수</label>
                    <input
                      type="text"
                      className={controlClass}
                      placeholder="예: 2.5 / 3.0"
                      value={forkliftTon}
                      onChange={(e) => setForkliftTon(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>진행단계</label>
                    <select
                      className={controlClass}
                      value={progressStage}
                      onChange={(e) => setProgressStage(e.target.value)}
                    >
                      {COMMON_STAGES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>판매방식</label>
                    <select
                      className={controlClass}
                      value={forkliftSaleMethod}
                      onChange={(e) => setForkliftSaleMethod(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="cash">현금</option>
                      <option value="installment">할부금융</option>
                      <option value="rental">렌탈</option>
                      <option value="lease">리스</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 xl:col-span-2">
                    <label className={labelClass}>옵션사항</label>
                    <input
                      type="text"
                      className={controlClass}
                      placeholder="예: 사이드시프트 / 캐빈 / 충전기 포함"
                      value={forkliftOptionNote}
                      onChange={(e) => setForkliftOptionNote(e.target.value)}
                    />
                  </div>


                </div>

                <div>
                  <label className={labelClass}>비고</label>
                  <textarea
                    className={textareaClass}
                    placeholder="브랜드, 거래조건, 인도 일정 등"
                    value={forkliftNote}
                    onChange={(e) => setForkliftNote(e.target.value)}
                  />
                </div>
              </div>
            )}

            {workType === "battery_sales" && (
              <div className="space-y-4 pt-2">
                <div className={sectionTitleClass}>배터리 판매 상세</div>

                <div className={grid5Class}>
                  <div>
                    <label className={labelClass}>차종</label>
                    <select
                      className={controlClass}
                      value={batteryVehicleType}
                      onChange={(e) => setBatteryVehicleType(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="지게차">지게차</option>
                      <option value="고소작업대">고소작업대</option>
                      <option value="골프카트">골프카트</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>형식</label>
                    <select
                      className={controlClass}
                      value={batteryDriveType}
                      onChange={(e) => setBatteryDriveType(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="seated">좌승</option>
                      <option value="standing">입승</option>
                      <option value="special">특수</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>진행단계</label>
                    <select
                      className={controlClass}
                      value={progressStage}
                      onChange={(e) => setProgressStage(e.target.value)}
                    >
                      {COMMON_STAGES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>전압</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`${controlClass} pr-8`}
                        placeholder="예: 51.2"
                        value={batteryVoltage}
                        onChange={(e) => setBatteryVoltage(e.target.value.replace(/[^0-9.]/g, ""))}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">V</span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>용량</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`${controlClass} pr-10`}
                        placeholder="예: 150"
                        value={batteryCapacityAh}
                        onChange={(e) => setBatteryCapacityAh(e.target.value.replace(/[^0-9.]/g, ""))}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Ah</span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>전체용량</label>
                    <div className="relative">
                      <input
                        type="text"
                        className={`${controlClass} pr-12 bg-gray-50`}
                        value={batteryTotalCapacityKwh ? batteryTotalCapacityKwh.toFixed(2) : ""}
                        readOnly
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">kWh</span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>규격 L</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={controlClass}
                      placeholder="예: 830"
                      value={batterySizeL}
                      onChange={(e) => setBatterySizeL(e.target.value.replace(/[^0-9.]/g, ""))}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>희망납기일</label>
                    <input
                      type="date"
                      className={controlClass}
                      value={batteryDueDate}
                      onChange={(e) => setBatteryDueDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>웨이트</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`${controlClass} pr-8`}
                        placeholder="예: 780"
                        value={batteryWeightKg}
                        onChange={(e) => setBatteryWeightKg(e.target.value.replace(/[^0-9.]/g, ""))}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">kg</span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>kWh당 단가</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={controlClass}
                      placeholder="예: 220"
                      value={batteryUnitPricePerKwh}
                      onChange={(e) => setBatteryUnitPricePerKwh(e.target.value.replace(/[^0-9.]/g, ""))}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>환율</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={controlClass}
                      placeholder="예: 1380"
                      value={batteryExchangeRate}
                      onChange={(e) => setBatteryExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>판매단가</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`${controlClass} pr-6`}
                        placeholder="예: 850000"
                        value={batteryUnitSalePrice}
                        onChange={(e) => setBatteryUnitSalePrice(e.target.value.replace(/[^0-9]/g, ""))}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">원</span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>수량</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`${controlClass} pr-6`}
                        placeholder="예: 2"
                        value={batteryQuantity}
                        onChange={(e) => setBatteryQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">개</span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>판매가격</label>
                    <div className="relative">
                      <input
                        type="text"
                        className={`${controlClass} pr-6 bg-gray-50`}
                        value={batterySalePrice ? Math.round(batterySalePrice).toLocaleString("ko-KR") : ""}
                        readOnly
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">원</span>
                    </div>
                  </div>




                </div>

                <div>
                  <label className={labelClass}>비고</label>
                  <textarea
                    className={textareaClass}
                    placeholder="규격 특이사항, 설치 조건, 고객 요청사항 등"
                    value={batteryNote}
                    onChange={(e) => setBatteryNote(e.target.value)}
                  />
                </div>
              </div>
            )}

            {workType === "export" && (
              <div className="space-y-4 pt-2">
                <div className={sectionTitleClass}>수출 상세</div>

                <div className={grid5Class}>
                  <div>
                    <label className={labelClass}>진행단계</label>
                    <select
                      className={controlClass}
                      value={progressStage}
                      onChange={(e) => setProgressStage(e.target.value)}
                    >
                      {COMMON_STAGES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>


                </div>
              </div>
            )}

            {workType === "tire_sales" && (
              <div className="space-y-4 pt-2">
                <div className={sectionTitleClass}>타이어 상세</div>

                <div className={grid5Class}>
                  <div>
                    <label className={labelClass}>보유차량 브랜드</label>
                    <select
                      className={controlClass}
                      value={tireVehicleInfo}
                      onChange={(e) => setTireVehicleInfo(e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="현대">현대</option>
                      <option value="두산">두산</option>
                      <option value="기아">기아</option>
                      <option value="대우">대우</option>
                      <option value="TCM">TCM</option>
                      <option value="도요타">도요타</option>
                      <option value="볼보">볼보</option>
                      <option value="클라크">클라크</option>
                      <option value="닛산">닛산</option>
                      <option value="수입">수입</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>차량종류</label>
                    <input
                      type="text"
                      className={controlClass}
                      placeholder="예: 1톤 / 5톤 / 지게차"
                      value={tireVehicleType}
                      onChange={(e) => setTireVehicleType(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>타이어 사이즈</label>
                    <input
                      type="text"
                      lang="en"
                      inputMode="text"
                      autoComplete="off"
                      spellCheck={false}
                      className={controlClass}
                      placeholder="예: 265/70R19.5"
                      value={tireSize}
                      onChange={(e) => setTireSize(onlyEnglishTireSize(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>전륜 수량</label>
                    <input
                      type="number"
                      className={controlClass}
                      placeholder="예: 2"
                      value={tireFrontQuantity}
                      onChange={(e) => setTireFrontQuantity(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>후륜 수량</label>
                    <input
                      type="number"
                      className={controlClass}
                      placeholder="예: 4"
                      value={tireRearQuantity}
                      onChange={(e) => setTireRearQuantity(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>지역 상세</label>
                    <input
                      type="text"
                      className={controlClass}
                      placeholder="예: 칠곡 / 평택 / 수도권"
                      value={tireRegionDetail}
                      onChange={(e) => setTireRegionDetail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>유입경로</label>
                    <select
                      className={controlClass}
                      value={tireInflowChannel}
                      onChange={(e) => setTireInflowChannel(e.target.value)}
                    >
                      <option value="">선택</option>
                      {TIRE_INFLOW_CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>
                          {channel === "association"
                            ? "협회"
                            : channel === "gotruck"
                              ? "고트럭"
                              : "기타"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {tireInflowChannel === "association" && (
                    <div>
                      <label className={labelClass}>협회명</label>
                      <select
                        className={controlClass}
                        value={tireAssociationName}
                        onChange={(e) => setTireAssociationName(e.target.value)}
                      >
                        <option value="">선택</option>
                        {TIRE_ASSOCIATIONS.map((association) => (
                          <option key={association} value={association}>
                            {association}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>진행단계</label>
                    <select
                      className={controlClass}
                      value={progressStage}
                      onChange={(e) => setProgressStage(e.target.value)}
                    >
                      {COMMON_STAGES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>


                </div>

                <div>
                  <label className={labelClass}>상담내용</label>
                  <textarea
                    className={textareaClass}
                    placeholder="규격 문의, 장착 위치, 교체 일정, 현장 요청사항 등을 입력하세요."
                    value={tireNote}
                    onChange={(e) => setTireNote(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-4 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-semibold hover:border-gray-300 transition-all"
                onClick={resetForm}
              >
                초기화
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-xl bg-[#0f172a] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40"
              >
                {isSubmitting ? "저장 중..." : editingCaseId ? "수정 저장" : "저장"}
              </button>
            </div>
          </form>

            <div className={`${dashboardGridClass} pt-2`}>
              <div className={dashboardCard}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-[#0f172a]">
                    보험만기예정
                  </div>
                  <div className="text-xs font-medium text-orange-600">
                    30일 이내
                  </div>
                </div>

                {loadingExpiry && (
                  <div className="text-sm text-gray-500">불러오는 중입니다...</div>
                )}

                {!loadingExpiry && expiryError && (
                  <div className="text-sm text-red-600">{expiryError}</div>
                )}

                {!loadingExpiry &&
                  !expiryError &&
                  insuranceExpiries.length === 0 && (
                    <div className="text-sm text-gray-500">
                      30일 이내 만기 예정 건이 없습니다.
                    </div>
                  )}

                {!loadingExpiry &&
                  !expiryError &&
                  insuranceExpiries.length > 0 && (
                    <div className="space-y-2">
                      {insuranceExpiries.slice(0, 6).map((item, idx) => {
                        const daysLeft = getDaysLeft(item.insurance_end_date);
                        const c = item.consultation_cases;
                        return (
                          <div
                            key={`${item.consultation_id}-${idx}`}
                            className="rounded-xl border border-gray-200 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium text-[#0f172a]">
                                {c?.customer_name || "-"}
                              </div>
                              <div className="text-xs font-medium text-red-600">
                                {daysLeft !== null ? `D-${daysLeft}` : "-"}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {item.vehicle_no || "-"} /{" "}
                              {formatInsuranceType(item.insurance_type)}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              보험사: {item.insurance_company || "-"}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              만기일: {formatDateOnly(item.insurance_end_date)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>

              <div className={dashboardCard}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-[#0f172a]">
                    최근상담
                  </div>
                  <div className="text-xs font-medium text-gray-500">
                    최신 5건
                  </div>
                </div>

                {rows.length === 0 ? (
                  <div className="text-sm text-gray-500">최근 상담이 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    {recentContacts.slice(0, 5).map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className="w-full rounded-xl border border-gray-200 p-3 text-left hover:border-orange-300 hover:bg-orange-50/40 transition"
                        onClick={() => {
                          void openListDetailFromDashboard(row);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-[#0f172a]">
                            {row.customer_name}
                          </div>
                          <div className="text-xs font-medium text-gray-500">
                            {formatWorkType(row.work_type)}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {row.company_name || "-"}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {formatDateTime(row.call_datetime)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1 truncate">
                          {formatCompactSummary(row)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={dashboardCard}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-[#0f172a]">
                    빠른연락
                  </div>
                  <div className="text-xs font-medium text-gray-500">
                    최근 고객
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    type="button"
                    className={`rounded-xl border p-4 text-left transition ${
                      listQuickScope === "all"
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-200 hover:border-orange-300 hover:bg-orange-50/40"
                    }`}
                    onClick={() => applyQuickListScope("all")}
                  >
                    <div className="text-xs font-medium text-gray-500">
                      전체 상담
                    </div>
                    <div className="text-xl font-semibold text-[#0f172a] mt-1">
                      {rows.length}
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`rounded-xl border p-4 text-left transition ${
                      listQuickScope === "followup"
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-200 hover:border-orange-300 hover:bg-orange-50/40"
                    }`}
                    onClick={() => applyQuickListScope("followup")}
                  >
                    <div className="text-xs font-medium text-gray-500">
                      사후관리 필요
                    </div>
                    <div className="text-xl font-semibold text-orange-600 mt-1">
                      {rows.filter((r) => r.followup_needed).length}
                    </div>
                  </button>
                </div>

                <div className="space-y-2">
                  {recentContacts.slice(0, 4).map((row) => (
                    <div
                      key={`quick-${row.id}`}
                      className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#0f172a]">
                          {row.customer_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {row.phone} / {row.telecom_provider || "-"}
                        </div>
                      </div>
                      <a
                        href={`tel:${onlyDigits(row.phone)}`}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium border border-orange-300 text-orange-600 hover:bg-orange-50"
                      >
                        전화
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "list" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[#0f172a]">
                  상담내역 검색 / 필터
                </div>
                <button
                  type="button"
                  onClick={() => setShowListFilters((prev) => !prev)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-700 hover:bg-gray-50"
                  title={showListFilters ? "접기" : "펼치기"}
                >
                  {showListFilters ? "−" : "+"}
                </button>
              </div>

              {showListFilters && (
                <div className={filterGridClass}>
                <div>
                  <label className={compactLabelClass}>고객명</label>
                  <input
                    type="text"
                    className={compactControlClass}
                    placeholder="고객명 검색"
                    value={listSearchName}
                    onChange={(e) => setListSearchName(e.target.value)}
                  />
                </div>

                <div>
                  <label className={compactLabelClass}>연락처</label>
                  <input
                    type="text"
                    className={compactControlClass}
                    placeholder="연락처 검색"
                    value={listSearchPhone}
                    onChange={(e) => setListSearchPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className={compactLabelClass}>업무유형</label>
                  <select
                    className={compactControlClass}
                    value={listFilterWorkType}
                    onChange={(e) => setListFilterWorkType(e.target.value)}
                  >
                    <option value="">전체</option>
                    <option value="registration_insurance">보험</option>
                    <option value="tire_sales">타이어</option>
                    <option value="finance">금융</option>
                    <option value="forklift_sales">지게차</option>
                    <option value="battery_sales">배터리</option>
                    <option value="export">수출</option>
                  </select>
                </div>

                <div>
                  <label className={compactLabelClass}>보험사</label>
                  <input
                    type="text"
                    className={compactControlClass}
                    placeholder="보험사 검색"
                    value={listSearchInsuranceCompany}
                    onChange={(e) => setListSearchInsuranceCompany(e.target.value)}
                  />
                </div>

                <div>
                  <label className={compactLabelClass}>Closing</label>
                  <select
                    className={compactControlClass}
                    value={closingFilter}
                    onChange={(e) => setClosingFilter(e.target.value as "all" | "Y" | "N")}
                  >
                    <option value="all">전체</option>
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                </div>

                <div className="flex items-end gap-2 flex-nowrap whitespace-nowrap">
                  <button
                    type="button"
                    className={actionBtnClass}
                    onClick={resetListFilters}
                  >
                    필터 초기화
                  </button>
                  <button
                    type="button"
                    className={actionBtnClass}
                    onClick={fetchConsultations}
                  >
                    새로고침
                  </button>
                </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
              <div>필터 선택 시 목록에 자동 반영되며, 목록을 클릭하면 바로 아래에 상세 내역이 열립니다.</div>
              <div className="flex items-center gap-2">
                <div className="font-medium text-orange-600 whitespace-nowrap">
                  {listQuickScope === "followup" ? "사후관리 대상만 표시 중" : "전체 상담 표시 중"}
                </div>
                <button
                  type="button"
                  className={`${actionBtnClass} text-emerald-600 border-emerald-200 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
                  onClick={openInvoiceRegModal}
                  disabled={selectedIds.length === 0}
                >
                  매출 등록{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
                </button>
                <button
                  type="button"
                  className={`${actionBtnClass} text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
                  onClick={handleBulkDelete}
                  disabled={selectedIds.length === 0}
                >
                  선택 삭제{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
                </button>
              </div>
            </div>

            {loadingList && <div className="text-sm text-gray-500">불러오는 중입니다...</div>}
            {!loadingList && listError && (
              <div className="text-sm text-red-600">상담내역 조회 실패: {listError}</div>
            )}
            {!loadingList && !listError && combinedListDisplayRows.length === 0 && (
              <div className="text-sm text-gray-500">조건에 맞는 상담내역이 없습니다.</div>
            )}

            {!loadingList && !listError && combinedListDisplayRows.length > 0 && (
              <div className="border border-gray-200 rounded-2xl overflow-x-auto">
                <table className="w-full bg-white">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={thClass}>
                        <input
                          type="checkbox"
                          checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(filteredRows.map((r) => r.id));
                            else setSelectedIds([]);
                          }}
                        />
                      </th>
                      <th className={thClass}>상담일시</th>
                      <th className={thClass}>고객명</th>
                      <th className={thClass}>연락처</th>
                      <th className={thClass}>업무유형</th>
                      <th className={thClass}>자동요약</th>
                      <th className={thClass}>진행단계</th>
                      <th className={thClass}>Closing</th>
                      <th className={thClass}>수정</th>
                    </tr>
                  </thead>

                  <tbody>
                    {combinedListDisplayRows.map((item) => {
                      if (item.kind === "external") {
                        const row = item.row;
                        const editKey = `${row._source}-${row.id}`;
                        const isExpanded = externalFinanceExpandedKey === editKey;
                        const isEditing = externalFinanceEditKey === editKey;
                        return (
                          <React.Fragment key={item.key}>
                            <tr
                              className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? "bg-orange-50" : ""}`}
                              onClick={() =>
                                setExternalFinanceExpandedKey(isExpanded ? null : editKey)
                              }
                            >
                              <td className={tdClass}>
                                <span className="text-xs text-gray-300">-</span>
                              </td>
                              <td className={tdClass}>{formatDateTime(row.created_at)}</td>
                              <td className={tdClass}>{row.customer_name}</td>
                              <td className={tdClass}>
                                {row.customer_phone ? (
                                  <a
                                    href={`tel:${onlyDigits(row.customer_phone)}`}
                                    className="text-orange-600 font-medium hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {row.customer_phone}
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className={tdClass}>
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                  {externalFinanceSourceLabel(row._source)}
                                </span>
                              </td>
                              <td className={tdClass} style={{maxWidth:"240px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                {row.company_name || row.finance_company || "-"}
                              </td>
                              <td className={tdClass}>
                                <span className="text-xs font-medium text-purple-600">{row.status}</span>
                              </td>
                              <td className={tdClass}>-</td>
                              <td className={tdClass}>
                                {isAdminLevel ? (
                                  <button
                                    type="button"
                                    className={`${actionBtnClass} whitespace-nowrap`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExternalFinanceExpandedKey(editKey);
                                      startEditExternalFinance(row);
                                    }}
                                  >
                                    수정
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-300">-</span>
                                )}
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr>
                                <td colSpan={9} className="p-2 bg-white max-w-0">
                                  <div className={inlineDetailBoxClass}>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-sm font-semibold text-gray-700">
                                        {externalFinanceSourceLabel(row._source)} · {row.customer_name} 상세
                                      </span>
                                      <div className="flex gap-1.5">
                                        <a
                                          href={externalFinanceFullPageUrl(row)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={actionBtnClass}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          전체 페이지 열기 →
                                        </a>
                                        {isAdminLevel && !isEditing && (
                                          <button
                                            type="button"
                                            className={actionBtnClass}
                                            onClick={(e) => { e.stopPropagation(); startEditExternalFinance(row); }}
                                          >
                                            수정
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {!isEditing ? (
                                      <div className="text-[12px] text-gray-700 space-y-1">
                                        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                          <span><span className={detailLabelClass}>구분</span><span className={detailValueClass}>{row.customer_type || "-"}</span></span>
                                          <span><span className={detailLabelClass}>회사명</span><span className={detailValueClass}>{row.company_name || "-"}</span></span>
                                          <span><span className={detailLabelClass}>대표자</span><span className={detailValueClass}>{row.ceo_name || "-"}</span></span>
                                          <span><span className={detailLabelClass}>톤수</span><span className={detailValueClass}>{row.equipment_ton || "-"}</span></span>
                                          <span><span className={detailLabelClass}>할부금융사</span><span className={detailValueClass}>{row.finance_company || "-"}</span></span>
                                          <span><span className={detailLabelClass}>할부원금</span><span className={detailValueClass}>{row.installment_principal ? Number(row.installment_principal).toLocaleString("ko-KR")+"원" : "-"}</span></span>
                                          <span><span className={detailLabelClass}>금리</span><span className={detailValueClass}>{row.interest_rate != null ? `${row.interest_rate}%` : "-"}</span></span>
                                          <span><span className={detailLabelClass}>영업담당</span><span className={detailValueClass}>{row.sales_rep || "-"}</span></span>
                                        </div>
                                        {row.special_note && (
                                          <div className="border-t border-gray-100 mt-1 pt-1 text-[11px] text-gray-500 leading-4">
                                            특이사항: {row.special_note}
                                          </div>
                                        )}
                                        {isAdminLevel && (
                                          <div className="border-t border-gray-100 mt-1.5 pt-1.5 flex items-center gap-1.5 flex-wrap">
                                            <span className={detailLabelClass}>상태변경</span>
                                            {EXTERNAL_FINANCE_STATUSES.map((s) => (
                                              <button
                                                key={s}
                                                type="button"
                                                disabled={externalFinanceSaving || s === row.status}
                                                onClick={(e) => { e.stopPropagation(); changeExternalFinanceStatus(row, s); }}
                                                className={`px-2 py-0.5 rounded-xl text-[11px] font-medium border transition-all ${
                                                  s === row.status
                                                    ? "bg-[#0f172a] text-white border-[#0f172a]"
                                                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                                                }`}
                                              >
                                                {s}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                          <div>
                                            <label className={compactLabelClass}>고객명</label>
                                            <input className={compactInputClass} value={externalFinanceDraft.customer_name ?? row.customer_name}
                                              onChange={(e) => setExternalFinanceDraft((d) => ({ ...d, customer_name: e.target.value }))} />
                                          </div>
                                          <div>
                                            <label className={compactLabelClass}>연락처</label>
                                            <input className={compactInputClass} value={externalFinanceDraft.customer_phone ?? row.customer_phone ?? ""}
                                              onChange={(e) => setExternalFinanceDraft((d) => ({ ...d, customer_phone: e.target.value }))} />
                                          </div>
                                          <div>
                                            <label className={compactLabelClass}>회사명</label>
                                            <input className={compactInputClass} value={externalFinanceDraft.company_name ?? row.company_name ?? ""}
                                              onChange={(e) => setExternalFinanceDraft((d) => ({ ...d, company_name: e.target.value }))} />
                                          </div>
                                          <div>
                                            <label className={compactLabelClass}>대표자</label>
                                            <input className={compactInputClass} value={externalFinanceDraft.ceo_name ?? row.ceo_name ?? ""}
                                              onChange={(e) => setExternalFinanceDraft((d) => ({ ...d, ceo_name: e.target.value }))} />
                                          </div>
                                          <div>
                                            <label className={compactLabelClass}>톤수</label>
                                            <input className={compactInputClass} value={externalFinanceDraft.equipment_ton ?? row.equipment_ton ?? ""}
                                              onChange={(e) => setExternalFinanceDraft((d) => ({ ...d, equipment_ton: e.target.value }))} />
                                          </div>
                                          <div>
                                            <label className={compactLabelClass}>할부금융사</label>
                                            <input className={compactInputClass} value={externalFinanceDraft.finance_company ?? row.finance_company ?? ""}
                                              onChange={(e) => setExternalFinanceDraft((d) => ({ ...d, finance_company: e.target.value }))} />
                                          </div>
                                          <div>
                                            <label className={compactLabelClass}>할부원금</label>
                                            <input type="number" className={compactInputClass} value={externalFinanceDraft.installment_principal ?? row.installment_principal ?? ""}
                                              onChange={(e) => setExternalFinanceDraft((d) => ({ ...d, installment_principal: e.target.value === "" ? null : Number(e.target.value) }))} />
                                          </div>
                                          <div>
                                            <label className={compactLabelClass}>금리(%)</label>
                                            <input type="number" step="0.1" className={compactInputClass} value={externalFinanceDraft.interest_rate ?? row.interest_rate ?? ""}
                                              onChange={(e) => setExternalFinanceDraft((d) => ({ ...d, interest_rate: e.target.value === "" ? null : Number(e.target.value) }))} />
                                          </div>
                                          <div>
                                            <label className={compactLabelClass}>영업담당</label>
                                            <input className={compactInputClass} value={externalFinanceDraft.sales_rep ?? row.sales_rep ?? ""}
                                              onChange={(e) => setExternalFinanceDraft((d) => ({ ...d, sales_rep: e.target.value }))} />
                                          </div>
                                          <div className="col-span-2 md:col-span-4">
                                            <label className={compactLabelClass}>특이사항</label>
                                            <input className={compactInputClass} value={externalFinanceDraft.special_note ?? row.special_note ?? ""}
                                              onChange={(e) => setExternalFinanceDraft((d) => ({ ...d, special_note: e.target.value }))} />
                                          </div>
                                        </div>
                                        <div className="flex gap-1.5 justify-end">
                                          <button type="button" className={actionBtnClass} onClick={cancelEditExternalFinance} disabled={externalFinanceSaving}>취소</button>
                                          <button type="button" className={completeBtnClass} onClick={() => saveExternalFinanceEdit(row)} disabled={externalFinanceSaving}>
                                            {externalFinanceSaving ? "저장 중..." : "저장"}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      }

                      const row = item.row;
                      return (
                      <React.Fragment key={item.key}>
                        <tr
                          className={`hover:bg-gray-50 cursor-pointer ${
                            expandedRowId === row.id ? "bg-orange-50" : ""
                          }`}
                          onClick={() => toggleInlineDetail(row)}
                        >
                          <td className={tdClass}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds((prev) => [...prev, row.id]);
                                else setSelectedIds((prev) => prev.filter((id) => id !== row.id));
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className={tdClass}>{formatDateTime(row.call_datetime)}</td>
                          <td className={tdClass}>{row.customer_name}</td>
                          <td className={tdClass}>
                            <a
                              href={`tel:${onlyDigits(row.phone)}`}
                              className="text-orange-600 font-medium hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.phone}
                            </a>
                          </td>
                          <td className={tdClass}>
                            {formatWorkType(row.work_type)}
                            {row.sub_type && <span className="ml-1 text-xs text-gray-400">({row.sub_type})</span>}
                          </td>
                          <td className={tdClass} style={{maxWidth:"240px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.summary}</td>
                          <td className={tdClass}>
                            {row.work_type === "registration_insurance"
                              ? <span className="text-xs font-medium text-blue-600">{formatInsuranceProcess(insuranceDetailsMap[row.id] ?? null)}</span>
                              : row.work_type === "finance"
                              ? <span className="text-xs font-medium text-purple-600">{formatFinanceStage(financeDetailsMap[row.id]?.finance_stage ?? null)}</span>
                              : row.work_type === "tire_sales"
                              ? <span className="text-xs font-medium text-orange-600">{formatCommonStage(tireDetailsMap[row.id]?.process_status ?? null)}</span>
                              : row.work_type === "forklift_sales"
                              ? <span className="text-xs font-medium text-orange-600">{formatCommonStage(resolvedForkliftStatus(forkliftDetailsMap[row.id] ?? null))}</span>
                              : row.work_type === "battery_sales"
                              ? <span className="text-xs font-medium text-orange-600">{formatCommonStage(resolvedBatteryStatus(batteryDetailsMap[row.id] ?? null))}</span>
                              : "-"}
                          </td>
                          <td className={tdClass}>
                            {isClosingCase(
                              row,
                              insuranceDetailsMap[row.id],
                              tireDetailsMap[row.id],
                              financeDetailsMap[row.id],
                              forkliftDetailsMap[row.id],
                              batteryDetailsMap[row.id]
                            ) ? "Y" : "N"}
                          </td>
                          <td className={tdClass}>
                            <button
                              type="button"
                              className={`${actionBtnClass} whitespace-nowrap`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(row);
                              }}
                            >
                              수정
                            </button>
                          </td>
                        </tr>

                        {expandedRowId === row.id && (
                          <tr>
                            <td colSpan={9} className="p-2 bg-white max-w-0">
                              <div className={inlineDetailBoxClass}>
                                {loadingDetail && (
                                  <div className="text-sm text-gray-500">
                                    상세 정보를 불러오는 중입니다...
                                  </div>
                                )}

                                {!loadingDetail && detailError && (
                                  <div className="text-sm text-red-600">
                                    상세 조회 실패: {detailError}
                                  </div>
                                )}

                                {!loadingDetail && !detailError && (
                                  <div>
                                    {/* 헤더 */}
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-sm font-semibold text-gray-700">{row.customer_name} 상세</span>
                                      <div className="flex gap-1.5">
                                        {["tire_sales","forklift_sales","battery_sales","export"].includes(row.work_type) && (
                                          salesRegisteredIds.has(row.id) ? (
                                            <span className="px-2.5 py-1 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
                                              매출등록됨
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              className={actionBtnClass}
                                              disabled={registeringSalesId === row.id}
                                              onClick={(e) => { e.stopPropagation(); handleRegisterToSales(row); }}
                                            >
                                              {registeringSalesId === row.id ? "등록 중..." : "매출 등록"}
                                            </button>
                                          )
                                        )}
                                        <button type="button" className={actionBtnClass} onClick={(e)=>{e.stopPropagation();handleStartEdit(row);}}>수정</button>
                                        <button type="button" className={actionBtnClass} onClick={(e)=>{e.stopPropagation();setExpandedRowId(null);setExpandedTireDetail(null);setExpandedInsuranceDetail(null);setExpandedFinanceDetail(null);setExpandedForkliftDetail(null);setExpandedBatteryDetail(null);setDetailError("");}}>닫기</button>
                                      </div>
                                    </div>

                                    {/* 공통 + 상세 한 줄 flex-wrap */}
                                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm leading-6">
                                      <span className="text-orange-400 font-semibold">기본</span>
                                      <span><span className="text-gray-400">일자 </span><span className="font-medium text-gray-800">{formatDateOnly(row.call_datetime)}</span></span>
                                      <span><span className="text-gray-400">고객 </span><span className="font-medium text-gray-800">{row.customer_name||"-"}</span></span>
                                      <span><span className="text-gray-400">연락 </span><a href={`tel:${onlyDigits(row.phone)}`} className="font-medium text-orange-600 hover:underline">{row.phone||"-"}</a></span>
                                      <span><span className="text-gray-400">업무 </span><span className="font-medium text-gray-800">{formatWorkType(row.work_type)}</span></span>
                                      <span><span className="text-gray-400">Closing </span><span className="font-medium text-gray-800">{isClosingCase(row,expandedInsuranceDetail,expandedTireDetail,expandedFinanceDetail,expandedForkliftDetail,expandedBatteryDetail)?"✅완료":"진행중"}</span></span>
                                    </div>

                                    {/* 금융 상세 */}
                                    {row.work_type === "finance" && expandedFinanceDetail && (
                                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm leading-6 border-t border-gray-100 mt-1 pt-1">
                                        <span className="text-orange-400 font-semibold">금융</span>
                                        <span><span className="text-gray-400">종목 </span><span className="font-medium text-gray-800">{expandedFinanceDetail.finance_category||"-"}</span></span>
                                        <span><span className="text-gray-400">차종 </span><span className="font-medium text-gray-800">{expandedFinanceDetail.finance_vehicle_model||"-"}</span></span>
                                        <span><span className="text-gray-400">상품 </span><span className="font-medium text-gray-800">{expandedFinanceDetail.finance_product||"-"}</span></span>
                                        <span><span className="text-gray-400">금융사 </span><span className="font-medium text-gray-800">{expandedFinanceDetail.finance_company||"-"}</span></span>
                                        <span><span className="text-gray-400">취급액 </span><span className="font-medium text-gray-800">{formatAmountDisplay(expandedFinanceDetail.finance_amount)}</span></span>
                                        <span><span className="text-gray-400">기간 </span><span className="font-medium text-gray-800">{expandedFinanceDetail.finance_period??"-"}개월</span></span>
                                        <span><span className="text-gray-400">금리 </span><span className="font-medium text-gray-800">{expandedFinanceDetail.finance_interest_rate??"-"}%</span></span>
                                        <span><span className="text-gray-400">인센티브 </span><span className="font-medium text-gray-800">{formatPercentDisplay(expandedFinanceDetail.finance_incentive)}</span></span>
                                        <span><span className="text-gray-400">단계 </span><span className="font-medium text-orange-600">{formatFinanceStage(expandedFinanceDetail.finance_stage)}</span></span>
                                      </div>
                                    )}

                                    {/* 타이어 상세 */}
                                    {row.work_type === "tire_sales" && expandedTireDetail && (
                                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm leading-6 border-t border-gray-100 mt-1 pt-1">
                                        <span className="text-orange-400 font-semibold">타이어</span>
                                        <span><span className="text-gray-400">차량 </span><span className="font-medium text-gray-800">{expandedTireDetail.vehicle_info||"-"}</span></span>
                                        <span><span className="text-gray-400">차종 </span><span className="font-medium text-gray-800">{expandedTireDetail.vehicle_type||"-"}</span></span>
                                        <span><span className="text-gray-400">규격 </span><span className="font-medium text-gray-800">{expandedTireDetail.tire_size||"-"}</span></span>
                                        <span><span className="text-gray-400">수량 </span><span className="font-medium text-gray-800">전{expandedTireDetail.front_quantity??"-"}/후{expandedTireDetail.rear_quantity??"-"}(총{expandedTireDetail.quantity??"-"})</span></span>
                                        <span><span className="text-gray-400">지역 </span><span className="font-medium text-gray-800">{expandedTireDetail.region_detail||"-"}</span></span>
                                        <span><span className="text-gray-400">단계 </span><span className="font-medium text-orange-600">{formatCommonStage(expandedTireDetail.process_status)}</span></span>
                                      </div>
                                    )}

                                    {/* 지게차 상세 */}
                                    {row.work_type === "forklift_sales" && expandedForkliftDetail && (
                                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm leading-6 border-t border-gray-100 mt-1 pt-1">
                                        <span className="text-orange-400 font-semibold">지게차</span>
                                        <span><span className="text-gray-400">구분 </span><span className="font-medium text-gray-800">{formatForkliftCondition(expandedForkliftDetail.forklift_condition)}</span></span>
                                        <span><span className="text-gray-400">형식 </span><span className="font-medium text-gray-800">{formatForkliftType(expandedForkliftDetail.forklift_type)}</span></span>
                                        <span><span className="text-gray-400">톤수 </span><span className="font-medium text-gray-800">{expandedForkliftDetail.forklift_ton||"-"}</span></span>
                                        <span><span className="text-gray-400">판매방식 </span><span className="font-medium text-gray-800">{formatForkliftSaleMethod(expandedForkliftDetail.forklift_sale_method)}</span></span>
                                        <span><span className="text-gray-400">옵션 </span><span className="font-medium text-gray-800">{expandedForkliftDetail.forklift_option_note||"-"}</span></span>
                                        <span><span className="text-gray-400">단계 </span><span className="font-medium text-orange-600">{formatCommonStage(resolvedForkliftStatus(expandedForkliftDetail))}</span></span>
                                        {expandedForkliftDetail.note&&<span><span className="text-gray-400">비고 </span><span className="font-medium text-gray-800">{stripStatusMeta(expandedForkliftDetail.note)}</span></span>}
                                      </div>
                                    )}

                                    {/* 배터리 상세 */}
                                    {row.work_type === "battery_sales" && expandedBatteryDetail && (
                                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm leading-6 border-t border-gray-100 mt-1 pt-1">
                                        <span className="text-orange-400 font-semibold">배터리</span>
                                        <span><span className="text-gray-400">차종 </span><span className="font-medium text-gray-800">{formatBatteryVehicleType(expandedBatteryDetail.battery_vehicle_type)}</span></span>
                                        <span><span className="text-gray-400">전압/용량 </span><span className="font-medium text-gray-800">{expandedBatteryDetail.battery_voltage??"-"}V/{expandedBatteryDetail.battery_capacity_ah??"-"}Ah</span></span>
                                        <span><span className="text-gray-400">납기 </span><span className="font-medium text-gray-800">{formatDateOnly(expandedBatteryDetail.battery_due_date)}</span></span>
                                        <span><span className="text-gray-400">단가 </span><span className="font-medium text-gray-800">{formatAmountDisplay(expandedBatteryDetail.battery_unit_sale_price)}</span></span>
                                        <span><span className="text-gray-400">수량 </span><span className="font-medium text-gray-800">{expandedBatteryDetail.battery_quantity??"-"}개</span></span>
                                        <span><span className="text-gray-400">판매가 </span><span className="font-medium text-gray-800">{formatAmountDisplay(expandedBatteryDetail.battery_sale_price)}</span></span>
                                        <span><span className="text-gray-400">단계 </span><span className="font-medium text-orange-600">{formatCommonStage(resolvedBatteryStatus(expandedBatteryDetail))}</span></span>
                                      </div>
                                    )}

                                    {/* 보험 상세 */}
                                    {row.work_type === "registration_insurance" && expandedInsuranceDetail && (
                                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm leading-6 border-t border-gray-100 mt-1 pt-1">
                                        <span className="text-orange-400 font-semibold">보험</span>
                                        <span><span className="text-gray-400">차량번호 </span><span className="font-medium text-gray-800">{expandedInsuranceDetail.vehicle_no||"-"}</span></span>
                                        <span><span className="text-gray-400">차종 </span><span className="font-medium text-gray-800">{expandedInsuranceDetail.vehicle_model||"-"}</span></span>
                                        <span><span className="text-gray-400">용도 </span><span className="font-medium text-gray-800">{expandedInsuranceDetail.vehicle_use||"-"}</span></span>
                                        <span><span className="text-gray-400">보험종류 </span><span className="font-medium text-gray-800">{formatInsuranceType(expandedInsuranceDetail.insurance_type)}</span></span>
                                        <span><span className="text-gray-400">보험사 </span><span className="font-medium text-gray-800">{expandedInsuranceDetail.insurance_company||"-"}</span></span>
                                        <span><span className="text-gray-400">가입~만기 </span><span className="font-medium text-gray-800">{formatDateOnly(expandedInsuranceDetail.insurance_start_date)}~{formatDateOnly(expandedInsuranceDetail.insurance_end_date)}</span></span>
                                        <span><span className="text-gray-400">단계 </span><span className="font-medium text-orange-600">{formatInsuranceProcess(expandedInsuranceDetail)}</span></span>
                                      </div>
                                    )}

                                    {/* 메모 */}
                                    {row.detail_memo && (
                                      <div className="border-t border-gray-100 mt-1 pt-1 text-[11px] text-gray-500 leading-4">
                                        {row.detail_memo.split("\n").slice(-2).join(" · ")}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "followups" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[#0f172a]">
                  사후관리 검색 / 필터
                </div>
                <button
                  type="button"
                  onClick={() => setShowFollowupFilters((prev) => !prev)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-700 hover:bg-gray-50"
                  title={showFollowupFilters ? "접기" : "펼치기"}
                >
                  {showFollowupFilters ? "−" : "+"}
                </button>
              </div>

              {showFollowupFilters && (
                <div className={filterGridClass}>
                <div>
                  <label className={compactLabelClass}>고객명</label>
                  <input
                    type="text"
                    className={compactControlClass}
                    placeholder="고객명 검색"
                    value={followSearchName}
                    onChange={(e) => setFollowSearchName(e.target.value)}
                  />
                </div>

                <div>
                  <label className={compactLabelClass}>연락처</label>
                  <input
                    type="text"
                    className={compactControlClass}
                    placeholder="연락처 검색"
                    value={followSearchPhone}
                    onChange={(e) => setFollowSearchPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className={compactLabelClass}>업무유형</label>
                  <select
                    className={compactControlClass}
                    value={followFilterWorkType}
                    onChange={(e) => setFollowFilterWorkType(e.target.value)}
                  >
                    <option value="">전체</option>
                    <option value="registration_insurance">보험</option>
                    <option value="tire_sales">타이어</option>
                    <option value="finance">금융</option>
                    <option value="forklift_sales">지게차</option>
                    <option value="battery_sales">배터리</option>
                  </select>
                </div>

                <div>
                  <label className={compactLabelClass}>보험사</label>
                  <input
                    type="text"
                    className={compactControlClass}
                    placeholder="보험사 검색"
                    value={followSearchInsuranceCompany}
                    onChange={(e) => setFollowSearchInsuranceCompany(e.target.value)}
                  />
                </div>

                <div className="flex items-end gap-2 flex-nowrap whitespace-nowrap">
                  <button
                    type="button"
                    className={actionBtnClass}
                    onClick={resetFollowFilters}
                  >
                    필터 초기화
                  </button>
                  <button
                    type="button"
                    className={actionBtnClass}
                    onClick={fetchFollowups}
                  >
                    새로고침
                  </button>
                </div>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-600">사후관리 필요 건만 표시됩니다.</div>

            {loadingFollowups && (
              <div className="text-sm text-gray-500">불러오는 중입니다...</div>
            )}
            {!loadingFollowups && followupError && (
              <div className="text-sm text-red-600">
                사후관리 조회 실패: {followupError}
              </div>
            )}
            {!loadingFollowups && !followupError && filteredFollowups.length === 0 && (
              <div className="text-sm text-gray-500">조건에 맞는 사후관리 대상이 없습니다.</div>
            )}

            {!loadingFollowups && !followupError && filteredFollowups.length > 0 && (
              <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={thClass}>고객명</th>
                      <th className={thClass}>연락처</th>
                      <th className={thClass}>통신사</th>
                      <th className={thClass}>업무유형</th>
                      <th className={thClass}>자동요약</th>
                      <th className={thClass}>다음 연락일</th>
                      <th className={thClass}>현재상태</th>
                      <th className={thClass}>처리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFollowups.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className={tdClass}>{row.customer_name}</td>
                        <td className={tdClass}>
                          <a
                            href={`tel:${onlyDigits(row.phone)}`}
                            className="text-orange-600 font-medium hover:underline"
                          >
                            {row.phone}
                          </a>
                        </td>
                        <td className={tdClass}>{row.telecom_provider || "-"}</td>
                        <td className={tdClass}>{formatWorkType(row.work_type)}</td>
                        <td className={tdClass}>{row.summary}</td>
                        <td className={tdClass}>{row.next_followup_date || "-"}</td>
                        <td className={tdClass}>{formatStatus(row.status)}</td>
                        <td className={tdClass}>
                          <div className="flex items-center justify-end gap-2 flex-nowrap whitespace-nowrap min-w-[180px]">
                            <button
                              type="button"
                              className={completeBtnClass}
                              onClick={() => handleCompleteFollowup(row.id)}
                            >
                              완료
                            </button>
                            <button
                              type="button"
                              className={actionBtnClass}
                              onClick={() => openFollowupDatePicker(row.id)}
                            >
                              새 일정
                            </button>
                            <input
                              id={`followup-date-${row.id}`}
                              type="date"
                              className="absolute w-0 h-0 opacity-0 pointer-events-none"
                              value={followupRescheduleMap[row.id] || ""}
                              onChange={(e) => {
                                const selectedDate = e.target.value;
                                setFollowupRescheduleMap((prev) => ({
                                  ...prev,
                                  [row.id]: selectedDate,
                                }));
                                if (selectedDate) {
                                  void handleRescheduleFollowup(row.id, selectedDate);
                                }
                              }}
                              tabIndex={-1}
                              aria-hidden="true"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-sm text-gray-600 pt-2">
              보험 / 타이어 / 금융 / 지게차 / 배터리 상담 및 사후관리 관리
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default CallManagementPage;