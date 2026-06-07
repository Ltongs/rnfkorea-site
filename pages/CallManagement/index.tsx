import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

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
  process_stage: string | null;
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


type ForkliftDetailRow = {
  consultation_id: number;
  forklift_condition: string | null;
  forklift_type: string | null;
  forklift_ton: string | null;
  forklift_status: string | null;
  forklift_option_note: string | null;
  forklift_sale_method: string | null;
  process_stage: string | null;
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
  process_stage: string | null;
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

const tabBase =
  "px-5 py-2.5 rounded-2xl text-sm font-semibold border transition-all";
const tabActive = "bg-navy-900 text-white border-navy-900 shadow-sm";
const tabInactive = "bg-white text-gray-500 border-gray-200 hover:border-gray-300";

const typeBtnBase =
  "px-4 py-2 rounded-2xl text-sm font-semibold border transition-all";
const typeBtnActive =
  "bg-orange-500 text-white border-orange-500 shadow-sm";
const typeBtnInactive =
  "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600";

const card =
  "border border-gray-200 rounded-2xl bg-white p-6 shadow-sm hover:shadow-md transition-all";
const dashboardCard =
  "border border-gray-200 rounded-2xl bg-white p-5 shadow-sm";
const compactCard =
  "border border-gray-200 rounded-2xl bg-gray-50 p-3";

const controlClass =
  "w-full h-[48px] rounded-2xl border border-gray-200 px-4 text-sm font-medium text-navy-900 bg-white " +
  "focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 transition-all";
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
  "w-full h-9 rounded-xl border border-gray-200 px-3 text-xs font-medium text-navy-900 bg-white " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-200/50 focus:border-orange-400 transition-all";
const textareaClass =
  "w-full min-h-[104px] rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-navy-900 bg-white " +
  "focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 transition-all";

const labelClass = "block text-sm font-medium text-navy-900 mb-2";
const compactLabelClass = "block text-xs font-medium text-gray-600 mb-1";

const thClass =
  "px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-400 uppercase border-b border-gray-100 whitespace-nowrap";
const tdClass =
  "px-4 py-3 text-sm font-medium text-gray-700 border-b border-gray-100 align-top whitespace-nowrap";

const actionBtnClass =
  "px-3 py-1.5 rounded-2xl text-xs font-semibold border border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm whitespace-nowrap transition-all";
const completeBtnClass =
  "px-3 py-1.5 rounded-2xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 whitespace-nowrap transition-all";
const sectionTitleClass =
  "text-xs font-medium tracking-[0.12em] uppercase text-orange-500";

const detailLabelClass = "text-[10px] leading-3 font-medium text-gray-400 uppercase whitespace-nowrap";
const detailValueClass = "text-[11px] leading-3 text-gray-800 mt-0 whitespace-nowrap";
const inlineDetailBoxClass =
  "bg-orange-50/40 border border-orange-200 rounded-2xl p-2";

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
  return value.replace(/[^A-Za-z0-9./\-\s]/g, "").toUpperCase();
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
  const { user, loading, isAdmin, isInsuranceManager } = useAuth() as any;
  const location = useLocation();
  const navigate = useNavigate();
  const canAccessConsulting = isAdmin || isInsuranceManager;
  const insuranceOnlyScope = isInsuranceManager && !isAdmin;

  const [tab, setTab] = useState<TabKey>("new");
  const newFormTopRef = useRef<HTMLFormElement | null>(null);
  const customerNameInputRef = useRef<HTMLInputElement | null>(null);
  const appliedNarumiPrefillRef = useRef<string>("");

  const [callDatetime, setCallDatetime] = useState("");
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
  const [progressStage, setProgressStage] = useState<string>("consulting");
  const [tireNote, setTireNote] = useState("");

  const [insuranceVehicleNo, setInsuranceVehicleNo] = useState("");
  const [insuranceVehicleModel, setInsuranceVehicleModel] = useState("");
  const [insuranceVehicleUse, setInsuranceVehicleUse] = useState("");
  const [insuranceRequest, setInsuranceRequest] = useState("");
  const [insuranceType, setInsuranceType] = useState("automobile");
  const [insuranceJob, setInsuranceJob] = useState("");
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [insuranceStartDate, setInsuranceStartDate] = useState("");
  const [insuranceEndDate, setInsuranceEndDate] = useState("");
  const [designRequested, setDesignRequested] = useState(false);
  const [applicationIssued, setApplicationIssued] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [policyIssued, setPolicyIssued] = useState(false);
  const handleInsuranceStatusChange = (
    key: "requested" | "proposal" | "paid" | "issued",
    checked: boolean
  ) => {
    let next = {
      requested: designRequested,
      proposal: applicationIssued,
      paid: paymentCompleted,
      issued: policyIssued,
    };

    // 기존 ON 자동화는 유지, 하나라도 OFF 되면 전체 OFF
    if (!checked) {
      next = { requested: false, proposal: false, paid: false, issued: false };
    } else {
      next[key] = true;

      if (key === "issued") {
        next = { requested: true, proposal: true, paid: true, issued: true };
      } else if (key === "paid") {
        next.requested = true;
        next.proposal = true;
      } else if (key === "proposal") {
        next.requested = true;
      }
    }

    setDesignRequested(next.requested);
    setApplicationIssued(next.proposal);
    setPaymentCompleted(next.paid);
    setPolicyIssued(next.issued);
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
  const [batteryDueDate, setBatteryDueDate] = useState("");
  const [batteryWeightKg, setBatteryWeightKg] = useState("");
  const [batteryUnitPricePerKwh, setBatteryUnitPricePerKwh] = useState("");
  const [batteryExchangeRate, setBatteryExchangeRate] = useState("");
  const [batteryUnitSalePrice, setBatteryUnitSalePrice] = useState("");
  const [batteryQuantity, setBatteryQuantity] = useState("");
  const [batteryNote, setBatteryNote] = useState("");

  const [followupRescheduleMap, setFollowupRescheduleMap] = useState<Record<number, string>>({});

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
  const [expandedExportDetail, setExpandedExportDetail] =
    useState<{consultation_id:number;process_stage:string|null;export_stage:string|null}|null>(null);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [pendingOpenId, setPendingOpenId] = useState<string|null>(null);
  const [showTodoBox, setShowTodoBox] = useState(false);
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
    if (workType === "finance") return financeStage === "confirmed";
    if (["tire_sales","forklift_sales","battery_sales","export"].includes(workType)) return progressStage === "invoiced";
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
      return s === "invoiced" || s === "completed";
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
    { value: "consulting", label: "상담" },
    { value: "quote",      label: "견적" },
    { value: "contract",   label: "계약" },
    { value: "delivery",   label: "납품" },
    { value: "invoiced",   label: "계산서발행" },
  ] as const;
  type CommonStageValue = typeof COMMON_STAGES[number]["value"];

  const formatCommonStage = (value: string | null) => {
    const found = COMMON_STAGES.find(s => s.value === value);
    if (found) return found.label;
    // 레거시 값 호환
    if (value === "inquiry_received" || value === "size_confirming") return "상담";
    if (value === "quote_sent" || value === "proposal")               return "견적";
    if (value === "waiting_order" || value === "waiting_payment")     return "계약";
    if (value === "delivery_or_replacement" || value === "delivered") return "납품";
    if (value === "completed")                                        return "계산서발행";
    if (value === "hold" || value === "cancelled")                    return "보류";
    return value || "-";
  };

  // 레거시 값 → 새 공통 단계값으로 정규화
  const normalizeToCommonStage = (value: string | null | undefined): CommonStageValue => {
    if (!value) return "consulting";
    if (["consulting"].includes(value))                               return "consulting";
    if (["quote", "inquiry_received", "size_confirming", "quote_sent", "proposal"].includes(value)) return "quote";
    if (["contract", "waiting_order", "waiting_payment"].includes(value)) return "contract";
    if (["delivery", "delivery_or_replacement", "delivered"].includes(value)) return "delivery";
    if (["invoiced", "completed"].includes(value))                    return "invoiced";
    return "consulting";
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
    return matched?.[1] || null;
  };

  const formatStatus = (value: string) => {
    if (value === "new") return "신규";
    if (value === "in_progress") return "진행중";
    if (value === "waiting_customer") return "고객대기";
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
    const done: string[] = [];
    if (detail.design_requested) done.push("설계요청");
    if (detail.application_issued) done.push("청약서발행");
    if (detail.payment_completed) done.push("결제");
    if (detail.policy_issued) done.push("증권발급");
    return done.length ? done.join(" → ") : "미진행";
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
      setProgressStage(normalizeToCommonStage(tireDetail?.process_stage ?? tireDetail?.process_status));
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
      setProgressStage(normalizeToCommonStage(forkliftDetail?.process_stage ?? resolvedForkliftStatus(forkliftDetail)));
      setForkliftOptionNote(forkliftDetail?.forklift_option_note || "");
      setForkliftSaleMethod(forkliftDetail?.forklift_sale_method || "");
      setForkliftNote(stripStatusMeta(forkliftDetail?.note || ""));
    }

    if (row.work_type === "battery_sales") {
      setBatteryVehicleType(batteryDetail?.battery_vehicle_type || "");
      setBatteryDriveType(batteryDetail?.battery_drive_type || "");
      setProgressStage(normalizeToCommonStage(batteryDetail?.process_stage ?? resolvedBatteryStatus(batteryDetail)));
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

    if (row.work_type === "export") {
      setProgressStage(normalizeToCommonStage(expandedExportDetail?.process_stage ?? expandedExportDetail?.export_stage));
    }

    setTab("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    setProgressStage("consulting");
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
    setInsuranceStartDate("");
    setInsuranceEndDate("");
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
    setProgressStage("consulting");
    setForkliftOptionNote("");
    setForkliftSaleMethod("");
    setForkliftNote("");
  };

  const resetBatteryFields = () => {
    setBatteryVehicleType("");
    setBatteryDriveType("");
    setProgressStage("consulting");
    setBatteryVoltage("");
    setBatteryCapacityAh("");
    setBatterySizeL("");
    setBatteryDueDate("");
    setBatteryWeightKg("");
    setBatteryUnitPricePerKwh("");
    setBatteryExchangeRate("");
    setBatteryUnitSalePrice("");
    setBatteryQuantity("");
    setBatteryNote("");
  };

  const resetForm = () => {
    setEditingCaseId(null);
    setCallDatetime("");
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
    setExpandedExportDetail(null);
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
        setExpandedExportDetail(null);
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
      setExpandedExportDetail(null);
      setDetailError("");
      return;
    }

    setExpandedRowId(row.id);
    setExpandedTireDetail(null);
    setExpandedInsuranceDetail(null);
    setExpandedFinanceDetail(null);
    setExpandedForkliftDetail(null);
    setExpandedBatteryDetail(null);
    setExpandedExportDetail(null);
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

    if (row.work_type === "export") {
      const { data } = await supabase
        .from("consultation_export_details")
        .select("consultation_id,process_stage,export_stage")
        .eq("consultation_id", row.id)
        .maybeSingle();
      setExpandedExportDetail(data ?? null);
    }

    setLoadingDetail(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = params.get("id");
    if (targetId) setPendingOpenId(targetId);
  }, [location.search]);

  useEffect(() => {
    if (user && canAccessConsulting) {
      fetchConsultations();
      fetchInsuranceExpiries();
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
    setCallDatetime(payload.callDatetime || new Date().toISOString().slice(0, 10));
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
              call_datetime:  payload.callDatetime || new Date().toISOString().slice(0, 10),
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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
      company_name: null,
      region: null,
      work_type: workType,
      sub_type: subType || null,
      status: isClosing ? "closed" : editingCaseId ? status || "new" : "new",
      summary: autoSummary,
      detail_memo: detailMemoForCase,
      followup_needed: isClosing ? false : Boolean(nextFollowupDate),
      next_followup_date: isClosing ? null : nextFollowupDate || null,
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
            job: null,
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
            process_status: progressStage || "consulting",
            process_stage: progressStage || "consulting",
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
              forklift_status: progressStage || "consulting",
              process_stage: progressStage || "consulting",
              forklift_option_note: forkliftOptionNote.trim() || null,
              forklift_sale_method: forkliftSaleMethod || null,
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
              process_stage: progressStage || "consulting",
              note: batteryNote.trim() || null,
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
          [{ consultation_id: savedCaseId, export_stage: progressStage || "consulting", process_stage: progressStage || "consulting" }],
          { onConflict: "consultation_id" }
        );
      if (exportError) {
        alert(`상담건은 저장되었지만 수출 상세 저장 실패: ${exportError.message}`);
        await fetchConsultations(); await fetchFollowups(); await fetchInsuranceExpiries();
        setTab("list"); return;
      }
    }

    alert(editingCaseId ? "수정 완료" : "저장 완료");
    resetForm();
    await fetchConsultations();
    await fetchFollowups();
    await fetchInsuranceExpiries();
    setTab("list");
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
          <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">Business</p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold leading-[1.15] text-white break-keep">
            상담관리
          </h1>
          <p className="mt-3 text-base leading-7 text-white/75 break-keep">
            상담 등록 · 내역 조회 · 사후관리
          </p>

          {/* 탭 */}
          <div className="mt-6 flex flex-wrap gap-2">
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
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">



      <div className={card}>
        <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
          <div className="text-lg font-semibold text-navy-900">{title}</div>

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
          <div className="space-y-6">
            <form ref={newFormTopRef} className="space-y-6" onSubmit={handleSubmit}>
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
                  <div className="text-sm font-semibold text-navy-900">To-Do</div>
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
                    <label className={labelClass}>사후관리 (F/Up)</label>
                    <input
                      type="date"
                      className={controlClass}
                      style={insuranceEqualDateFieldStyle}
                      value={nextFollowupDate}
                      onChange={(e) => setNextFollowupDate(e.target.value)}
                    />
                    <div className="mt-1 text-xs font-semibold text-gray-500">
                      {nextFollowupDate ? "대상" : "비대상"}
                    </div>
                  </div>
                </div>


            <div className={compactCard}>
                  <div className="text-sm font-semibold text-navy-900 mb-2">
                    보험 진행상태
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={designRequested}
                        onChange={(e) => handleInsuranceStatusChange("requested", e.target.checked)}
                      />
                      설계요청
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={applicationIssued}
                        onChange={(e) => handleInsuranceStatusChange("proposal", e.target.checked)}
                      />
                      청약서발행
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={paymentCompleted}
                        onChange={(e) => handleInsuranceStatusChange("paid", e.target.checked)}
                      />
                      결제
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={policyIssued}
                        onChange={(e) => handleInsuranceStatusChange("issued", e.target.checked)}
                      />
                      증권발급
                    </label>
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
                      <option value="오릭스">오릭스</option>
                      <option value="HCI">HCI</option>
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
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>사후관리 (F/Up)</label>
                    <input
                      type="date"
                      className={controlClass}
                      value={nextFollowupDate}
                      onChange={(e) => setNextFollowupDate(e.target.value)}
                    />
                    <div className="mt-1 text-xs font-semibold text-gray-500">
                      {nextFollowupDate ? "대상" : "비대상"}
                    </div>
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

                  <div>
                    <label className={labelClass}>사후관리 (F/Up)</label>
                    <input
                      type="date"
                      className={controlClass}
                      value={nextFollowupDate}
                      onChange={(e) => setNextFollowupDate(e.target.value)}
                    />
                    <div className="mt-1 text-xs font-semibold text-gray-500">
                      {nextFollowupDate ? "대상" : "비대상"}
                    </div>
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



                  <div>
                    <label className={labelClass}>사후관리 (F/Up)</label>
                    <input
                      type="date"
                      className={controlClass}
                      value={nextFollowupDate}
                      onChange={(e) => setNextFollowupDate(e.target.value)}
                    />
                    <div className="mt-1 text-xs font-semibold text-gray-500">
                      {nextFollowupDate ? "대상" : "비대상"}
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

                  <div>
                    <label className={labelClass}>사후관리 (F/Up)</label>
                    <input
                      type="date"
                      className={controlClass}
                      value={nextFollowupDate}
                      onChange={(e) => setNextFollowupDate(e.target.value)}
                    />
                    <div className="mt-1 text-xs font-semibold text-gray-500">
                      {nextFollowupDate ? "대상" : "비대상"}
                    </div>
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

                  <div>
                    <label className={labelClass}>사후관리 (F/Up)</label>
                    <input
                      type="date"
                      className={controlClass}
                      value={nextFollowupDate}
                      onChange={(e) => setNextFollowupDate(e.target.value)}
                    />
                    <div className="mt-1 text-xs font-semibold text-gray-500">
                      {nextFollowupDate ? "대상" : "비대상"}
                    </div>
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
                className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                onClick={resetForm}
              >
                초기화
              </button>

              <button
                type="submit"
                className="px-6 py-2 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600"
              >
                {editingCaseId ? "수정 저장" : "저장"}
              </button>
            </div>
          </form>

            <div className={`${dashboardGridClass} pt-2`}>
              <div className={dashboardCard}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-navy-900">
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
                              <div className="text-sm font-medium text-navy-900">
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
                  <div className="text-sm font-semibold text-navy-900">
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
                          <div className="text-sm font-medium text-navy-900">
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
                  <div className="text-sm font-semibold text-navy-900">
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
                    <div className="text-2xl font-semibold text-navy-900 mt-1">
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
                    <div className="text-2xl font-semibold text-orange-600 mt-1">
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
                        <div className="text-sm font-medium text-navy-900">
                          {row.customer_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {row.phone} / {row.telecom_provider || "-"}
                        </div>
                      </div>
                      <a
                        href={`tel:${onlyDigits(row.phone)}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-300 text-orange-600 hover:bg-orange-50"
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
                <div className="text-sm font-semibold text-navy-900">
                  상담내역 검색 / 필터
                </div>
                <button
                  type="button"
                  onClick={() => setShowListFilters((prev) => !prev)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-semibold text-gray-700 hover:bg-gray-50"
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
            {!loadingList && !listError && filteredRows.length === 0 && (
              <div className="text-sm text-gray-500">조건에 맞는 상담내역이 없습니다.</div>
            )}

            {!loadingList && !listError && filteredRows.length > 0 && (
              <div className="border border-gray-200 rounded-2xl overflow-x-auto">
                <table className=" bg-white">
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
                      <th className={thClass}>Closing</th>
                      <th className={thClass}>사후관리</th>
                      <th className={thClass}>다음 연락일</th>
                      <th className={thClass}>수정</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map((row) => (
                      <React.Fragment key={row.id}>
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
                          <td className={tdClass}>{row.summary}</td>
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
                            {row.followup_needed ? "필요" : "불필요"}
                          </td>
                          <td className={tdClass}>{row.next_followup_date || "-"}</td>
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
                            <td colSpan={10} className="p-3 bg-white">
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
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="text-sm font-semibold text-navy-900">
                                        {row.customer_name} 상세내역
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          className={actionBtnClass}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartEdit(row);
                                          }}
                                        >
                                          수정
                                        </button>
                                        <button
                                          type="button"
                                          className={actionBtnClass}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedRowId(null);
                                            setExpandedTireDetail(null);
                                            setExpandedInsuranceDetail(null);
                                            setExpandedFinanceDetail(null);
                                            setExpandedForkliftDetail(null);
                                            setExpandedBatteryDetail(null);
                                            setExpandedExportDetail(null);
                                            setDetailError("");
                                          }}
                                        >
                                          닫기
                                        </button>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <div className={sectionTitleClass}>공통 정보</div>

                                      <div>
                                        <div className="grid grid-cols-8 gap-1">
                                          <div>
                                            <div className={detailLabelClass}>상담일자</div>
                                            <div className={detailValueClass}>
                                              {formatDateOnly(row.call_datetime)}
                                            </div>
                                          </div>

                                          <div>
                                            <div className={detailLabelClass}>고객명</div>
                                            <div className={detailValueClass}>{row.customer_name || "-"}</div>
                                          </div>

                                          <div>
                                            <div className={detailLabelClass}>연락처</div>
                                            <div className={detailValueClass}>
                                              <a
                                                href={`tel:${onlyDigits(row.phone)}`}
                                                className="text-orange-600 font-medium hover:underline"
                                              >
                                                {row.phone}
                                              </a>
                                            </div>
                                          </div>

                                          <div>
                                            <div className={detailLabelClass}>통신사</div>
                                            <div className={detailValueClass}>
                                              {row.telecom_provider || "-"}
                                            </div>
                                          </div>

                                          <div>
                                            <div className={detailLabelClass}>업무유형</div>
                                            <div className={detailValueClass}>
                                              {formatWorkType(row.work_type)}
                                            </div>
                                          </div>

                                          <div>
                                            <div className={detailLabelClass}>Closing</div>
                                            <div className={detailValueClass}>
                                              {isClosingCase(
                                                row,
                                                expandedInsuranceDetail,
                                                expandedTireDetail,
                                                expandedFinanceDetail,
                                                expandedForkliftDetail,
                                                expandedBatteryDetail
                                              ) ? "Y" : "N"}
                                            </div>
                                          </div>

                                          <div>
                                            <div className={detailLabelClass}>사후관리</div>
                                            <div className={detailValueClass}>
                                              {row.followup_needed ? "필요" : "불필요"}
                                            </div>
                                          </div>

                                          <div>
                                            <div className={detailLabelClass}>다음 연락일</div>
                                            <div className={detailValueClass}>
                                              {row.next_followup_date || "-"}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {row.work_type === "registration_insurance" && (
                                      <div className="space-y-3">
                                        <div className={sectionTitleClass}>보험 상세</div>

                                        {!expandedInsuranceDetail && (
                                          <div className="text-sm text-gray-500">
                                            저장된 보험 상세 정보가 없습니다.
                                          </div>
                                        )}

                                        {expandedInsuranceDetail && (
                                          <div>
                                            <div className="grid grid-cols-12 gap-1">
                                            <div>
                                              <div className={detailLabelClass}>차량번호</div>
                                              <div className={detailValueClass}>
                                                {expandedInsuranceDetail.vehicle_no || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>차종 / 모델</div>
                                              <div className={detailValueClass}>
                                                {expandedInsuranceDetail.vehicle_model || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>사용용도</div>
                                              <div className={detailValueClass}>
                                                {expandedInsuranceDetail.vehicle_use || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>보험종류</div>
                                              <div className={detailValueClass}>
                                                {formatInsuranceType(
                                                  expandedInsuranceDetail.insurance_type
                                                )}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>직업</div>
                                              <div className={detailValueClass}>
                                                {expandedInsuranceDetail.job || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>가입 보험사</div>
                                              <div className={detailValueClass}>
                                                {expandedInsuranceDetail.insurance_company || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>가입일자</div>
                                              <div className={detailValueClass}>
                                                {formatDateOnly(
                                                  expandedInsuranceDetail.insurance_start_date
                                                )}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>만기일자</div>
                                              <div className={detailValueClass}>
                                                {formatDateOnly(
                                                  expandedInsuranceDetail.insurance_end_date
                                                )}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>사후관리</div>
                                              <div className={detailValueClass}>
                                                {row.next_followup_date
                                                  ? `대상 (${row.next_followup_date})`
                                                  : "비대상"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>보험 요청 내용</div>
                                              <div className={detailValueClass}>
                                                {expandedInsuranceDetail.insurance_request || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>진행단계</div>
                                              <div className={detailValueClass}>
                                                {formatInsuranceProcess(expandedInsuranceDetail)}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>긴급도</div>
                                              <div className={detailValueClass}>
                                                {formatUrgency(expandedInsuranceDetail.urgency)}
                                              </div>
                                            </div>

                                            
                                            </div>
                                          </div>
                                        )}

                                        {expandedForkliftDetail && (
                                          <div>
                                            <div className="grid grid-cols-10 gap-1">
                                              <div>
                                                <div className={detailLabelClass}>구분</div>
                                                <div className={detailValueClass}>
                                                  {formatForkliftCondition(expandedForkliftDetail.forklift_condition)}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>형식</div>
                                                <div className={detailValueClass}>
                                                  {formatForkliftType(expandedForkliftDetail.forklift_type)}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>톤수</div>
                                                <div className={detailValueClass}>
                                                  {expandedForkliftDetail.forklift_ton || "-"}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>진행단계</div>
                                                <div className={detailValueClass}>
                                                  {formatCommonStage(resolvedForkliftStatus(expandedForkliftDetail))}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>판매방식</div>
                                                <div className={detailValueClass}>
                                                  {formatForkliftSaleMethod(expandedForkliftDetail.forklift_sale_method)}
                                                </div>
                                              </div>

                                              <div className="col-span-2">
                                                <div className={detailLabelClass}>옵션사항</div>
                                                <div className={detailValueClass}>
                                                  {expandedForkliftDetail.forklift_option_note || "-"}
                                                </div>
                                              </div>

                                              <div className="col-span-3">
                                                <div className={detailLabelClass}>비고</div>
                                                <div className={detailValueClass}>
                                                  {stripStatusMeta(expandedForkliftDetail.note) || "-"}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {expandedBatteryDetail && (
                                          <div>
                                            <div className="grid grid-cols-10 gap-1">
                                              <div>
                                                <div className={detailLabelClass}>차종</div>
                                                <div className={detailValueClass}>
                                                  {formatBatteryVehicleType(expandedBatteryDetail.battery_vehicle_type)}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>형식</div>
                                                <div className={detailValueClass}>
                                                  {formatBatteryDriveType(expandedBatteryDetail.battery_drive_type)}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>진행단계</div>
                                                <div className={detailValueClass}>
                                                  {formatCommonStage(resolvedBatteryStatus(expandedBatteryDetail))}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>전압</div>
                                                <div className={detailValueClass}>
                                                  {expandedBatteryDetail.battery_voltage ?? "-"}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>용량</div>
                                                <div className={detailValueClass}>
                                                  {expandedBatteryDetail.battery_capacity_ah ?? "-"}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>전체용량</div>
                                                <div className={detailValueClass}>
                                                  {expandedBatteryDetail.battery_total_capacity_kwh ?? "-"}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>규격 L</div>
                                                <div className={detailValueClass}>
                                                  {expandedBatteryDetail.battery_size_l ?? "-"}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>희망납기일</div>
                                                <div className={detailValueClass}>
                                                  {formatDateOnly(expandedBatteryDetail.battery_due_date)}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>웨이트</div>
                                                <div className={detailValueClass}>
                                                  {expandedBatteryDetail.battery_weight_kg ?? "-"}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>판매단가</div>
                                                <div className={detailValueClass}>
                                                  {formatAmountDisplay(expandedBatteryDetail.battery_unit_sale_price)}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>수량</div>
                                                <div className={detailValueClass}>
                                                  {expandedBatteryDetail.battery_quantity != null ? `${expandedBatteryDetail.battery_quantity}개` : "-"}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>판매가격</div>
                                                <div className={detailValueClass}>
                                                  {formatAmountDisplay(expandedBatteryDetail.battery_sale_price)}
                                                </div>
                                              </div>

                                              <div>
                                                <div className={detailLabelClass}>비고</div>
                                                <div className={detailValueClass}>
                                                  {stripStatusMeta(expandedBatteryDetail.note) || "-"}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                      </div>
                                    )}

                                    {row.work_type === "tire_sales" && (
                                      <div className="space-y-3">
                                        <div className={sectionTitleClass}>타이어 상세</div>

                                        {!expandedTireDetail && (
                                          <div className="text-sm text-gray-500">
                                            저장된 타이어 상세 정보가 없습니다.
                                          </div>
                                        )}

                                        {expandedTireDetail && (
                                          <div>
                                            <div className="grid grid-cols-12 gap-1">
                                            <div>
                                              <div className={detailLabelClass}>보유차량 브랜드</div>
                                              <div className={detailValueClass}>
                                                {expandedTireDetail.vehicle_info || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>차량종류</div>
                                              <div className={detailValueClass}>
                                                {expandedTireDetail.vehicle_type || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>타이어 사이즈</div>
                                              <div className={detailValueClass}>
                                                {expandedTireDetail.tire_size || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>총 수량</div>
                                              <div className={detailValueClass}>
                                                {expandedTireDetail.quantity ?? "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>전륜 수량</div>
                                              <div className={detailValueClass}>
                                                {expandedTireDetail.front_quantity ?? "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>후륜 수량</div>
                                              <div className={detailValueClass}>
                                                {expandedTireDetail.rear_quantity ?? "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>지역 상세</div>
                                              <div className={detailValueClass}>
                                                {expandedTireDetail.region_detail || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>유입경로</div>
                                              <div className={detailValueClass}>
                                                {expandedTireDetail.inflow_channel === "association"
                                                  ? `협회${expandedTireDetail.association_name ? ` (${expandedTireDetail.association_name})` : ""}`
                                                  : expandedTireDetail.inflow_channel === "gotruck"
                                                    ? "고트럭"
                                                    : expandedTireDetail.inflow_channel === "etc"
                                                      ? "기타"
                                                      : "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>진행단계</div>
                                              <div className={detailValueClass}>
                                                {formatCommonStage(expandedTireDetail.process_status)}
                                              </div>
                                            </div>

                                            

                                            <div>
                                              <div className={detailLabelClass}>사후관리</div>
                                              <div className={detailValueClass}>
                                                {row.next_followup_date
                                                  ? `대상 (${row.next_followup_date})`
                                                  : "비대상"}
                                              </div>
                                            </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {row.work_type === "finance" && (
                                      <div className="space-y-3">
                                        <div className={sectionTitleClass}>금융 상세</div>

                                        {!expandedFinanceDetail && (
                                          <div className="text-sm text-gray-500">
                                            저장된 금융 상세 정보가 없습니다.
                                          </div>
                                        )}

                                        {expandedFinanceDetail && (
                                          <div>
                                            <div className="grid grid-cols-10 gap-1">
                                            <div>
                                              <div className={detailLabelClass}>종목</div>
                                              <div className={detailValueClass}>
                                                {expandedFinanceDetail.finance_category || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>차종</div>
                                              <div className={detailValueClass}>
                                                {expandedFinanceDetail.finance_vehicle_model || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>상품</div>
                                              <div className={detailValueClass}>
                                                {expandedFinanceDetail.finance_product || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>금융사</div>
                                              <div className={detailValueClass}>
                                                {expandedFinanceDetail.finance_company || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>취급액</div>
                                              <div className={detailValueClass}>
                                                {formatAmountDisplay(
                                                  expandedFinanceDetail.finance_amount
                                                )}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>기간</div>
                                              <div className={detailValueClass}>
                                                {expandedFinanceDetail.finance_period ?? "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>금리</div>
                                              <div className={detailValueClass}>
                                                {expandedFinanceDetail.finance_interest_rate ?? "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>인센티브</div>
                                              <div className={detailValueClass}>
                                                {formatPercentDisplay(
                                                  expandedFinanceDetail.finance_incentive
                                                )}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>진행단계</div>
                                              <div className={detailValueClass}>
                                                {formatFinanceStage(
                                                  expandedFinanceDetail.finance_stage
                                                )}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>사후관리</div>
                                              <div className={detailValueClass}>
                                                {row.next_followup_date
                                                  ? `대상 (${row.next_followup_date})`
                                                  : "비대상"}
                                              </div>
                                            </div>

                                            
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
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
                <div className="text-sm font-semibold text-navy-900">
                  사후관리 검색 / 필터
                </div>
                <button
                  type="button"
                  onClick={() => setShowFollowupFilters((prev) => !prev)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-semibold text-gray-700 hover:bg-gray-50"
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