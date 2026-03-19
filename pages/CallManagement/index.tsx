import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import PageTitle from "../../components/PageTitle";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

type TabKey = "new" | "list" | "followups";
type WorkType = "" | "registration_insurance" | "tire_sales" | "finance";

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
  work_type: "registration_insurance" | "tire_sales" | "finance";
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
  current_brand: string | null;
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

const tabBase =
  "px-4 py-2 rounded-xl text-sm font-bold border transition";
const tabActive = "bg-gray-100 text-gray-900 border-gray-300";
const tabInactive = "bg-white text-gray-400 border-gray-200";

const typeBtnBase =
  "px-4 py-2 rounded-xl text-sm font-bold border transition";
const typeBtnActive =
  "bg-orange-500 text-white border-orange-500 shadow-sm";
const typeBtnInactive =
  "bg-white text-gray-700 border-gray-300 hover:bg-gray-50";

const card =
  "border border-gray-200 rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]";
const dashboardCard =
  "border border-gray-200 rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]";
const compactCard =
  "border border-gray-200 rounded-xl bg-gray-50 p-3";

const controlClass =
  "w-full h-11 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 bg-white";
const compactControlClass =
  "w-full h-9 rounded-lg border border-gray-200 px-3 text-xs text-gray-900 bg-white";
const textareaClass =
  "w-full min-h-[80px] rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white resize-none";

const labelClass = "block text-sm font-semibold text-gray-700 mb-1";
const compactLabelClass = "block text-xs font-semibold text-gray-600 mb-1";

const thClass =
  "px-4 py-3 text-left text-sm font-bold text-navy-900 border-b border-gray-200";
const tdClass =
  "px-4 py-3 text-sm text-gray-700 border-b border-gray-100 align-top";

const actionBtnClass =
  "px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap";
const completeBtnClass =
  "px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 whitespace-nowrap";
const sectionTitleClass =
  "text-sm font-extrabold text-navy-900 border-b border-gray-200 pb-1";

const detailLabelClass = "text-[11px] leading-4 font-bold text-gray-500";
const detailValueClass = "text-xs leading-4 text-gray-800 mt-0.5";
const inlineDetailBoxClass =
  "bg-orange-50/40 border border-orange-200 rounded-xl p-3";

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

function formatDateOnly(value: string | null) {
  return value || "-";
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
  return "request_received";
}

const CallManagementPage: React.FC = () => {
  const { user, loading, isAdmin } = useAuth() as any;
  const location = useLocation();

  const [tab, setTab] = useState<TabKey>("new");

  const [callDatetime, setCallDatetime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [telecomProvider, setTelecomProvider] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [region, setRegion] = useState("");
  const [workType, setWorkType] = useState<WorkType>("");
  const [status, setStatus] = useState("new");
  const [nextFollowupDate, setNextFollowupDate] = useState("");

  const [tireVehicleInfo, setTireVehicleInfo] = useState("");
  const [tireVehicleType, setTireVehicleType] = useState("");
  const [tireSize, setTireSize] = useState("");
  const [tireFrontQuantity, setTireFrontQuantity] = useState("");
  const [tireRearQuantity, setTireRearQuantity] = useState("");
  const [tireRegionDetail, setTireRegionDetail] = useState("");
  const [tireCurrentBrand, setTireCurrentBrand] = useState("");
  const [tireProcessStatus, setTireProcessStatus] =
    useState("inquiry_received");
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
  const [insuranceNote, setInsuranceNote] = useState("");

  const [financeCategory, setFinanceCategory] = useState("");
  const [financeVehicleModel, setFinanceVehicleModel] = useState("");
  const [financeProduct, setFinanceProduct] = useState("");
  const [financeCompany, setFinanceCompany] = useState("");
  const [financeAmount, setFinanceAmount] = useState("");
  const [financePeriod, setFinancePeriod] = useState("");
  const [financeInterestRate, setFinanceInterestRate] = useState("");
  const [financeIncentive, setFinanceIncentive] = useState("");
  const [financeStage, setFinanceStage] = useState("consulting");
  const [financeNote, setFinanceNote] = useState("");
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
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [expandedTireDetail, setExpandedTireDetail] =
    useState<TireDetailRow | null>(null);
  const [expandedInsuranceDetail, setExpandedInsuranceDetail] =
    useState<InsuranceDetailRow | null>(null);
  const [expandedFinanceDetail, setExpandedFinanceDetail] =
    useState<FinanceDetailRow | null>(null);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);

  const title = useMemo(() => {
    if (tab === "new") return "상담등록";
    if (tab === "list") return "상담내역";
    return "사후관리";
  }, [tab]);

  const isClosingByCurrentForm = () => {
    if (workType === "registration_insurance") return policyIssued;
    if (workType === "tire_sales") return tireProcessStatus === "completed";
    if (workType === "finance") return financeStage === "confirmed";
    return false;
  };

  const isClosingCase = (
    row: ConsultationRow,
    insuranceDetail?: InsuranceDetailRow | null,
    tireDetail?: TireDetailRow | null,
    financeDetail?: FinanceDetailRow | null
  ) => {
    if (row.work_type === "registration_insurance") return Boolean(insuranceDetail?.policy_issued);
    if (row.work_type === "tire_sales") return tireDetail?.process_status === "completed";
    if (row.work_type === "finance") return financeDetail?.finance_stage === "confirmed";
    return false;
  };

  const formatWorkType = (value: string) => {
    if (value === "registration_insurance") return "보험";
    if (value === "tire_sales") return "타이어";
    if (value === "finance") return "금융";
    return value || "-";
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

  const formatTireProcessStatus = (value: string | null) => {
    if (value === "inquiry_received") return "문의접수";
    if (value === "size_confirming") return "규격확인중";
    if (value === "quote_sent") return "견적발송";
    if (value === "waiting_order") return "발주대기";
    if (value === "delivery_or_replacement") return "납품/교체중";
    if (value === "completed") return "완료";
    if (value === "hold") return "보류";
    return value || "-";
  };

  const formatFinanceStage = (value: string | null) => {
    if (value === "consulting") return "상담";
    if (value === "approved") return "승인";
    if (value === "rejected") return "부결";
    if (value === "documents_requested") return "서류징구";
    if (value === "confirmed") return "확정";
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

      return (
        nameOk &&
        phoneOk &&
        companyOk &&
        workTypeOk &&
        statusOk &&
        advancedOk &&
        quickScopeOk
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
    insuranceDetailsMap,
    tireDetailsMap,
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


  const populateFormForEdit = (
    row: ConsultationRow,
    insuranceDetail?: InsuranceDetailRow | null,
    tireDetail?: TireDetailRow | null,
    financeDetail?: FinanceDetailRow | null
  ) => {
    setEditingCaseId(row.id);
    setCallDatetime(formatDateInputValue(row.call_datetime));
    setCustomerName(row.customer_name || "");
    setPhone(row.phone || "");
    setTelecomProvider(row.telecom_provider || "");
    setCompanyName(row.company_name || "");
    setRegion(row.region || "");
    setWorkType(row.work_type || "");
    setStatus(row.status || "new");
    setNextFollowupDate(row.next_followup_date || "");

    resetInsuranceFields();
    resetTireFields();
    resetFinanceFields();

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
      setDesignRequested(Boolean(insuranceDetail?.design_requested));
      setApplicationIssued(Boolean(insuranceDetail?.application_issued));
      setPaymentCompleted(Boolean(insuranceDetail?.payment_completed));
      setPolicyIssued(Boolean(insuranceDetail?.policy_issued));
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
      setTireCurrentBrand(tireDetail?.current_brand || "");
      setTireProcessStatus(tireDetail?.process_status || "inquiry_received");
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
      setFinanceStage(financeDetail?.finance_stage || "consulting");
      setFinanceNote(financeDetail?.note || "");
    }

    setTab("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStartEdit = (row: ConsultationRow) => {
    populateFormForEdit(
      row,
      insuranceDetailsMap[row.id] || expandedInsuranceDetail,
      tireDetailsMap[row.id] || expandedTireDetail,
      financeDetailsMap[row.id] || expandedFinanceDetail
    );
  };

  const resetTireFields = () => {
    setTireVehicleInfo("");
    setTireVehicleType("");
    setTireSize("");
    setTireFrontQuantity("");
    setTireRearQuantity("");
    setTireRegionDetail("");
    setTireCurrentBrand("");
    setTireProcessStatus("inquiry_received");
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
    setFinanceStage("consulting");
    setFinanceNote("");
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
    setStatus("new");
    setNextFollowupDate("");
    resetTireFields();
    resetInsuranceFields();
    resetFinanceFields();
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
      .in("work_type", ["registration_insurance", "tire_sales", "finance"])
      .order("created_at", { ascending: false });

    if (error) {
      setListError(error.message || "목록 조회 실패");
      setRows([]);
      setLoadingList(false);
      return;
    }

    const caseRows = (data || []) as ConsultationRow[];
    setRows(caseRows);
    setLoadingList(false);

    const ids = caseRows.map((r) => r.id);
    if (!ids.length) {
      setInsuranceDetailsMap({});
      setTireDetailsMap({});
      setFinanceDetailsMap({});
      return;
    }

    const [insRes, tireRes, financeRes] = await Promise.all([
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
    ]);

    const insMap: Record<number, InsuranceDetailRow> = {};
    const tireMap: Record<number, TireDetailRow> = {};
    const financeMap: Record<number, FinanceDetailRow> = {};

    (insRes.data || []).forEach((row: any) => {
      insMap[row.consultation_id] = row as InsuranceDetailRow;
    });

    (tireRes.data || []).forEach((row: any) => {
      tireMap[row.consultation_id] = row as TireDetailRow;
    });

    (financeRes.data || []).forEach((row: any) => {
      financeMap[row.consultation_id] = row as FinanceDetailRow;
    });

    setInsuranceDetailsMap(insMap);
    setTireDetailsMap(tireMap);
    setFinanceDetailsMap(financeMap);
  };

  const fetchFollowups = async () => {
    setLoadingFollowups(true);
    setFollowupError("");

    const { data, error } = await supabase
      .from("consultation_cases")
      .select("*")
      .in("work_type", ["registration_insurance", "tire_sales", "finance"])
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

  const toggleInlineDetail = async (row: ConsultationRow) => {
    if (expandedRowId === row.id) {
      setExpandedRowId(null);
      setExpandedTireDetail(null);
      setExpandedInsuranceDetail(null);
      setExpandedFinanceDetail(null);
      setDetailError("");
      return;
    }

    setExpandedRowId(row.id);
    setExpandedTireDetail(null);
    setExpandedInsuranceDetail(null);
    setExpandedFinanceDetail(null);
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

    setLoadingDetail(false);
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchConsultations();
      fetchInsuranceExpiries();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (user && isAdmin && tab === "followups") {
      fetchFollowups();
    }
  }, [tab, user, isAdmin]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!customerName.trim()) return alert("고객명을 입력해 주세요.");
    if (!phone.trim()) return alert("연락처를 입력해 주세요.");
    if (!workType) return alert("상단에서 업무유형(보험/타이어/금융)을 선택해 주세요.");

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

    if (workType === "finance" && !financeProduct) {
      return alert("금융 상담은 상품을 선택해 주세요.");
    }

    const autoSummary = buildAutoSummary();
    const detailMemoForCase =
      workType === "registration_insurance"
        ? insuranceNote.trim() || null
        : workType === "tire_sales"
          ? tireNote.trim() || null
          : workType === "finance"
            ? financeNote.trim() || null
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
      const deleteTargets = ["consultation_insurance_details", "consultation_tire_details", "consultation_finance_details"].filter(
        (table) =>
          (workType === "registration_insurance" && table !== "consultation_insurance_details") ||
          (workType === "tire_sales" && table !== "consultation_tire_details") ||
          (workType === "finance" && table !== "consultation_finance_details")
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
        .upsert([
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
        ]);

      if (insuranceError) {
        alert("상담건은 저장되었지만 보험 상세 저장 실패: " + insuranceError.message);
        await fetchConsultations();
        await fetchFollowups();
        await fetchInsuranceExpiries();
        setTab("list");
        return;
      }
    }

    if (workType === "tire_sales") {
      const frontQtyNum = tireFrontQuantity ? Number(tireFrontQuantity) : 0;
      const rearQtyNum = tireRearQuantity ? Number(tireRearQuantity) : 0;
      const totalQty = frontQtyNum + rearQtyNum;

      const { error: tireError } = await supabase
        .from("consultation_tire_details")
        .upsert([
          {
            consultation_id: savedCaseId,
            vehicle_info: tireVehicleInfo.trim() || null,
            vehicle_type: tireVehicleType.trim() || null,
            tire_size: tireSize.trim() || null,
            quantity: totalQty || null,
            front_quantity: frontQtyNum || null,
            rear_quantity: rearQtyNum || null,
            region_detail: tireRegionDetail.trim() || null,
            current_brand: tireCurrentBrand.trim() || null,
            process_status: tireProcessStatus || "inquiry_received",
            note: tireNote.trim() || null,
          },
        ]);

      if (tireError) {
        alert("상담건은 저장되었지만 타이어 상세 저장 실패: " + tireError.message);
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
        .upsert([
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
        ]);

      if (financeError) {
        alert("상담건은 저장되었지만 금융 상세 저장 실패: " + financeError.message);
        await fetchConsultations();
        await fetchFollowups();
        await fetchInsuranceExpiries();
        setTab("list");
        return;
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
      <div className="container mx-auto px-4 py-12">
        <div className="text-sm text-gray-500">로그인 확인 중입니다...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/narumi/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-xl mx-auto border border-red-200 bg-red-50 rounded-2xl p-6">
          <div className="text-lg font-extrabold text-red-700 mb-2">
            접근 권한이 없습니다.
          </div>
          <div className="text-sm text-red-700 leading-relaxed">
            상담관리 페이지는 admin@rnfkorea.co.kr 계정만 접근할 수 있습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageTitle title="상담관리" />

    

      <div className="flex flex-wrap gap-2">
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

      <div className={card}>
        <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
          <div className="text-lg font-extrabold text-navy-900">{title}</div>

          {tab === "new" && (
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
              <button
                type="button"
                className={`${typeBtnBase} ${
                  workType === "tire_sales" ? typeBtnActive : typeBtnInactive
                }`}
                onClick={() => setWorkType("tire_sales")}
              >
                타이어
              </button>
              <button
                type="button"
                className={`${typeBtnBase} ${
                  workType === "finance" ? typeBtnActive : typeBtnInactive
                }`}
                onClick={() => setWorkType("finance")}
              >
                금융
              </button>
            </div>
          )}
        </div>

        {tab === "new" && (
          <div className="space-y-6">
            <form className="space-y-6" onSubmit={handleSubmit}>
            {editingCaseId && (
              <div className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                <div className="text-sm font-bold text-orange-700">
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
            

            <div className={grid5Class}>
              <div>
                <label className={labelClass}>상담일자</label>
                <input
                  type="date"
                  className={controlClass}
                  value={callDatetime}
                  onChange={(e) => setCallDatetime(e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>고객명</label>
                <input
                  type="text"
                  className={controlClass}
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
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                />
              </div>

              <div>
                <label className={labelClass}>통신사</label>
                <select
                  className={controlClass}
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
            </div>

            {workType === "registration_insurance" && (
              <div className="space-y-4 pt-2">
                <div className={sectionTitleClass}>보험 상세</div>

                <div className={grid5Class}>
                  <div>
                    <label className={labelClass}>차량번호</label>
                    <input
                      type="text"
                      className={controlClass}
                      placeholder="예: 123가4567"
                      value={insuranceVehicleNo}
                      onChange={(e) => setInsuranceVehicleNo(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>차종 / 모델</label>
                    <select
                      className={controlClass}
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
                    <input
                      type="text"
                      className={controlClass}
                      placeholder="예: 신규가입 / 갱신 / 조건비교"
                      value={insuranceRequest}
                      onChange={(e) => setInsuranceRequest(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>보험종류</label>
                    <select
                      className={controlClass}
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
                    <label className={labelClass}>직업</label>
                    <input
                      type="text"
                      className={controlClass}
                      placeholder="예: 자영업 / 운전기사 / 회사원"
                      value={insuranceJob}
                      onChange={(e) => setInsuranceJob(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>가입 보험사</label>
                    <select
                      className={controlClass}
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
                      value={insuranceStartDate}
                      onChange={(e) => setInsuranceStartDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>만기일자</label>
                    <input
                      type="date"
                      className={controlClass}
                      value={insuranceEndDate}
                      onChange={(e) => setInsuranceEndDate(e.target.value)}
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


            <div className={compactCard}>
                  <div className="text-sm font-extrabold text-navy-900 mb-2">
                    보험 진행상태
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={designRequested}
                        onChange={(e) => setDesignRequested(e.target.checked)}
                      />
                      설계요청
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={applicationIssued}
                        onChange={(e) => setApplicationIssued(e.target.checked)}
                      />
                      청약서발행
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={paymentCompleted}
                        onChange={(e) => setPaymentCompleted(e.target.checked)}
                      />
                      결제
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={policyIssued}
                        onChange={(e) => setPolicyIssued(e.target.checked)}
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
                      type="number"
                      className={controlClass}
                      placeholder="예: 36"
                      value={financePeriod}
                      onChange={(e) => setFinancePeriod(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>금리</label>
                    <input
                      type="number"
                      step="0.001"
                      className={controlClass}
                      placeholder="예: 5.9"
                      value={financeInterestRate}
                      onChange={(e) => setFinanceInterestRate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>인센티브</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        className={`${controlClass} pr-8`}
                        placeholder="예: 2.5"
                        value={financeIncentive}
                        onChange={(e) => setFinanceIncentive(e.target.value)}
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
                      <option value="consulting">상담</option>
                      <option value="approved">승인</option>
                      <option value="rejected">부결</option>
                      <option value="documents_requested">서류징구</option>
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

                <div className="grid grid-cols-12 gap-4 items-start">
                  <div className="col-span-12 lg:col-span-10">
                    <label className={labelClass}>상담내용</label>
                    <textarea
                      className={textareaClass}
                      placeholder="금융조건, 요청사항, 진행 메모 등을 입력하세요."
                      value={financeNote}
                      onChange={(e) => setFinanceNote(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="col-span-12 lg:col-span-2 flex flex-col gap-2 lg:pt-7">
                    <button
                      type="button"
                      className="w-full h-10 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 whitespace-nowrap"
                      onClick={resetForm}
                    >
                      초기화
                    </button>

                    <button
                      type="submit"
                      className="w-full h-10 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 whitespace-nowrap"
                    >
                      {editingCaseId ? "수정 저장" : "저장"}
                    </button>
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
                      <option value="기아">기아</option>
                      <option value="대우">대우</option>
                      <option value="수입">수입</option>
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
                      className={controlClass}
                      placeholder="예: 265/70R19.5"
                      value={tireSize}
                      onChange={(e) => setTireSize(e.target.value.toUpperCase())}
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
                    <label className={labelClass}>현재 사용 브랜드</label>
                    <input
                      type="text"
                      className={controlClass}
                      placeholder="예: 금호 / 한국 / 넥센"
                      value={tireCurrentBrand}
                      onChange={(e) => setTireCurrentBrand(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>타이어 진행상태</label>
                    <select
                      className={controlClass}
                      value={tireProcessStatus}
                      onChange={(e) => setTireProcessStatus(e.target.value)}
                    >
                      <option value="inquiry_received">문의접수</option>
                      <option value="size_confirming">규격확인중</option>
                      <option value="quote_sent">견적발송</option>
                      <option value="waiting_order">발주대기</option>
                      <option value="delivery_or_replacement">납품/교체중</option>
                      <option value="completed">완료</option>
                      <option value="hold">보류</option>
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

                <div className="grid grid-cols-12 gap-4 items-start">
                  <div className="col-span-12 lg:col-span-10">
                    <label className={labelClass}>상담내용</label>
                    <textarea
                      className={textareaClass}
                      placeholder="규격 문의, 장착 위치, 교체 일정, 현장 요청사항 등을 입력하세요."
                      value={tireNote}
                      onChange={(e) => setTireNote(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="col-span-12 lg:col-span-2 flex flex-col gap-2 lg:pt-7">
                    <button
                      type="button"
                      className="w-full h-10 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 whitespace-nowrap"
                      onClick={resetForm}
                    >
                      초기화
                    </button>

                    <button
                      type="submit"
                      className="w-full h-10 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 whitespace-nowrap"
                    >
                      {editingCaseId ? "수정 저장" : "저장"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>

            <div className={`${dashboardGridClass} pt-2`}>
              <div className={dashboardCard}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-extrabold text-navy-900">
                    보험만기예정
                  </div>
                  <div className="text-xs font-bold text-orange-600">
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
                    <div className="space-y-3">
                      {insuranceExpiries.slice(0, 6).map((item, idx) => {
                        const daysLeft = getDaysLeft(item.insurance_end_date);
                        const c = item.consultation_cases;
                        return (
                          <div
                            key={`${item.consultation_id}-${idx}`}
                            className="rounded-xl border border-gray-200 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-bold text-navy-900">
                                {c?.customer_name || "-"}
                              </div>
                              <div className="text-xs font-bold text-red-600">
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
                  <div className="text-sm font-extrabold text-navy-900">
                    최근상담
                  </div>
                  <div className="text-xs font-bold text-gray-500">
                    최신 10건
                  </div>
                </div>

                {rows.length === 0 ? (
                  <div className="text-sm text-gray-500">최근 상담이 없습니다.</div>
                ) : (
                  <div className="space-y-3">
                    {recentContacts.slice(0, 6).map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className="w-full rounded-xl border border-gray-200 p-3 text-left hover:border-orange-300 hover:bg-orange-50/40 transition"
                        onClick={() => {
                          void openListDetailFromDashboard(row);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-bold text-navy-900">
                            {row.customer_name}
                          </div>
                          <div className="text-xs font-bold text-gray-500">
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
                          {row.summary}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={dashboardCard}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-extrabold text-navy-900">
                    빠른연락
                  </div>
                  <div className="text-xs font-bold text-gray-500">
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
                    <div className="text-xs font-bold text-gray-500">
                      전체 상담
                    </div>
                    <div className="text-2xl font-extrabold text-navy-900 mt-1">
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
                    <div className="text-xs font-bold text-gray-500">
                      사후관리 필요
                    </div>
                    <div className="text-2xl font-extrabold text-orange-600 mt-1">
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
                        <div className="text-sm font-bold text-navy-900">
                          {row.customer_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {row.phone} / {row.telecom_provider || "-"}
                        </div>
                      </div>
                      <a
                        href={`tel:${onlyDigits(row.phone)}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-300 text-orange-600 hover:bg-orange-50"
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
              <div className="text-sm font-extrabold text-navy-900 mb-3">
                상담내역 검색 / 필터
              </div>

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
            </div>

            <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
              <div>목록을 클릭하면 바로 아래에 상세 내역이 열립니다.</div>
              <div className="font-bold text-orange-600">
                {listQuickScope === "followup" ? "사후관리 대상만 표시 중" : "전체 상담 표시 중"}
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
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={thClass}>상담일시</th>
                      <th className={thClass}>고객명</th>
                      <th className={thClass}>연락처</th>
                      <th className={thClass}>업무유형</th>
                      <th className={thClass}>자동요약</th>
                      <th className={thClass}>Closing</th>
                      <th className={thClass}>사후관리</th>
                      <th className={thClass}>다음 연락일</th>
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
                          <td className={tdClass}>{formatDateTime(row.call_datetime)}</td>
                          <td className={tdClass}>{row.customer_name}</td>
                          <td className={tdClass}>
                            <a
                              href={`tel:${onlyDigits(row.phone)}`}
                              className="text-orange-600 font-bold hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.phone}
                            </a>
                          </td>
                          <td className={tdClass}>{formatWorkType(row.work_type)}</td>
                          <td className={tdClass}>{row.summary}</td>
                          <td className={tdClass}>
                            {isClosingCase(
                              row,
                              insuranceDetailsMap[row.id],
                              tireDetailsMap[row.id],
                              financeDetailsMap[row.id]
                            ) ? "Y" : "N"}
                          </td>
                          <td className={tdClass}>
                            {row.followup_needed ? "필요" : "불필요"}
                          </td>
                          <td className={tdClass}>{row.next_followup_date || "-"}</td>
                        </tr>

                        {expandedRowId === row.id && (
                          <tr>
                            <td colSpan={8} className="p-3 bg-white">
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
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-extrabold text-navy-900">
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
                                            setDetailError("");
                                          }}
                                        >
                                          닫기
                                        </button>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <div className={sectionTitleClass}>공통 정보</div>

                                      <div className="overflow-x-auto">
                                        <div className="grid grid-cols-8 gap-1 min-w-[1200px]">
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
                                                className="text-orange-600 font-bold hover:underline"
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
                                                expandedFinanceDetail
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
                                          <div className="overflow-x-auto">
                                            <div className="grid grid-cols-12 gap-1 min-w-[1800px]">
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

                                            <div>
                                              <div className={detailLabelClass}>상담내용</div>
                                              <div className={detailValueClass}>
                                                {expandedInsuranceDetail.note || "-"}
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
                                          <div className="overflow-x-auto">
                                            <div className="grid grid-cols-11 gap-1 min-w-[1700px]">
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
                                              <div className={detailLabelClass}>현재 사용 브랜드</div>
                                              <div className={detailValueClass}>
                                                {expandedTireDetail.current_brand || "-"}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>진행상태</div>
                                              <div className={detailValueClass}>
                                                {formatTireProcessStatus(
                                                  expandedTireDetail.process_status
                                                )}
                                              </div>
                                            </div>

                                            <div>
                                              <div className={detailLabelClass}>상담내용</div>
                                              <div className={detailValueClass}>
                                                {expandedTireDetail.note || "-"}
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
                                          <div className="overflow-x-auto">
                                            <div className="grid grid-cols-10 gap-1 min-w-[1500px]">
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

                                            <div>
                                              <div className={detailLabelClass}>상담내용</div>
                                              <div className={detailValueClass}>
                                                {expandedFinanceDetail.note || "-"}
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
              <div className="text-sm font-extrabold text-navy-900 mb-3">
                사후관리 검색 / 필터
              </div>

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
                            className="text-orange-600 font-bold hover:underline"
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
              보험 / 타이어 상담 및 사후관리 관리
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallManagementPage;