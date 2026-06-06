import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgePercent,
  BarChart3,
  CalendarDays,
  Car,
  CircleDollarSign,
  CreditCard,
  FileText,
  Gauge,
  Loader2,
  PhoneCall,
  Shield,
  TrendingUp,
  Truck,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

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

type NarumiTask = {
  id: number | string;
  created_at: string;
  is_lotte_autolease: boolean | null;
  has_insurance: boolean | null;
  docs_ready: boolean | null;
  is_registered: boolean | null;
  vehicle_doc_path: string | null;
  status: string | null;
};

type InsuranceDetailRow = {
  consultation_id: number;
  design_requested: boolean | null;
  application_issued: boolean | null;
  payment_completed: boolean | null;
  policy_issued: boolean | null;
  process_status: string | null;
  insurance_company: string | null;
  insurance_type: string | null;
  vehicle_no: string | null;
};

type FinanceDetailRow = {
  consultation_id: number;
  finance_product: string | null;
  finance_company: string | null;
  finance_amount: number | null;
  finance_period: number | null;
  finance_interest_rate: number | null;
  finance_incentive: number | null;
  finance_stage: string | null;
};

type TireDetailRow = {
  consultation_id: number;
  vehicle_type: string | null;
  tire_size: string | null;
  current_brand: string | null;
  inflow_channel: string | null;
  association_name: string | null;
  process_status: string | null;
  quantity: number | null;
  front_quantity: number | null;
  rear_quantity: number | null;
  note: string | null;
};

type Metric = {
  month: number;
  ytd: number;
};

type CurrencyMetric = {
  month: number;
  ytd: number;
};

type RateMetric = {
  month: number;
  ytd: number;
};


const cardClass =
  "border border-gray-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all";
const subCardClass =
  "border border-gray-200 rounded-2xl bg-gray-50 p-4";
const sectionTitleClass =
  "text-xs font-medium tracking-[0.12em] uppercase text-orange-500";
const labelClass =
  "text-xs font-medium tracking-wide text-gray-400 uppercase";
const valueClass =
  "mt-2 text-2xl font-semibold text-navy-900";
const chipClass =
  "inline-flex items-center rounded-2xl border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500";


function startOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

function endOfMonth(year: number, month: number) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function startOfYear(year: number) {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

function endOfYear(year: number) {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

function isInRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return time >= start.getTime() && time <= end.getTime();
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatCount(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}건`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function financeStageLabel(value: string | null) {
  if (value === "consulting") return "상담";
  if (value === "approved") return "승인";
  if (value === "documents_requested") return "서류징구";
  if (value === "rejected") return "부결";
  if (value === "confirmed") return "확정";
  return value || "-";
}

function tireStageLabel(value: string | null) {
  if (value === "inquiry_received") return "문의접수";
  if (value === "size_confirming") return "규격확인중";
  if (value === "quote_sent") return "견적발송";
  if (value === "waiting_order") return "발주";
  if (value === "delivery_or_replacement") return "납품";
  if (value === "completed") return "완료";
  if (value === "hold") return "보류";
  return value || "-";
}

function insuranceStep(detail: InsuranceDetailRow | null | undefined) {
  if (!detail) return "미진행";
  if (detail.policy_issued) return "증권발급";
  if (detail.payment_completed) return "결제완료";
  if (detail.application_issued) return "청약서발행";
  if (detail.design_requested) return "설계요청";
  return "미진행";
}

function inflowChannelLabel(
  inflowChannel: string | null | undefined,
  associationName?: string | null
) {
  if (inflowChannel === "association") {
    return associationName ? `협회 (${associationName})` : "협회";
  }
  if (inflowChannel === "gotruck") return "고트럭";
  if (inflowChannel === "etc") return "기타";
  return "미분류";
}

function consultationListUrl(params?: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();

  // 상담관리 페이지 구현 차이에 대비해 목록 탭을 가리키는 키를 함께 전달
  search.set("tab", "list");
  search.set("view", "list");
  search.set("mode", "list");
  search.set("section", "list");
  search.set("screen", "list");
  search.set("from", "dashboard");

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    search.set(key, String(value));
  });

  return `/work/call-management?${search.toString()}#list`;
}

const DashboardPage: React.FC = () => {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [insuranceDetails, setInsuranceDetails] = useState<InsuranceDetailRow[]>([]);
  const [financeDetails, setFinanceDetails] = useState<FinanceDetailRow[]>([]);
  const [tireDetails, setTireDetails] = useState<TireDetailRow[]>([]);
  const [narumiTasks, setNarumiTasks] = useState<NarumiTask[]>([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const yearStart = startOfYear(selectedYear).toISOString();
      const yearEnd = endOfYear(selectedYear).toISOString();

      try {
        const [
          consultationsRes,
          insuranceRes,
          financeRes,
          tireRes,
          narumiRes,
        ] = await Promise.all([
          supabase
            .from("consultation_cases")
            .select(
              "id, created_at, updated_at, call_datetime, customer_name, phone, telecom_provider, company_name, region, work_type, status, summary, detail_memo, followup_needed, next_followup_date"
            )
            .gte("created_at", yearStart)
            .lte("created_at", yearEnd)
            .order("created_at", { ascending: false }),
          supabase
            .from("consultation_insurance_details")
            .select(
              "consultation_id, design_requested, application_issued, payment_completed, policy_issued, process_status, insurance_company, insurance_type, vehicle_no"
            ),
          supabase
            .from("consultation_finance_details")
            .select(
              "consultation_id, finance_product, finance_company, finance_amount, finance_period, finance_interest_rate, finance_incentive, finance_stage"
            ),
          supabase
            .from("consultation_tire_details")
            .select(
              "consultation_id, vehicle_type, tire_size, current_brand, inflow_channel, association_name, process_status, quantity, front_quantity, rear_quantity, note"
            ),
          supabase
            .from("narumi_tasks")
            .select(
              "id, created_at, is_lotte_autolease, has_insurance, docs_ready, is_registered, vehicle_doc_path, status"
            )
            .gte("created_at", yearStart)
            .lte("created_at", yearEnd)
            .order("created_at", { ascending: false }),
        ]);

        const firstError =
          consultationsRes.error ||
          insuranceRes.error ||
          financeRes.error ||
          tireRes.error ||
          narumiRes.error;

        if (firstError) throw firstError;
        if (!alive) return;

        setConsultations((consultationsRes.data || []) as ConsultationRow[]);

        const caseIdSet = new Set<number>((consultationsRes.data || []).map((row: any) => row.id));

        setInsuranceDetails(
          ((insuranceRes.data || []) as InsuranceDetailRow[]).filter((row) =>
            caseIdSet.has(row.consultation_id)
          )
        );
        setFinanceDetails(
          ((financeRes.data || []) as FinanceDetailRow[]).filter((row) =>
            caseIdSet.has(row.consultation_id)
          )
        );
        setTireDetails(
          ((tireRes.data || []) as TireDetailRow[]).filter((row) =>
            caseIdSet.has(row.consultation_id)
          )
        );
        setNarumiTasks((narumiRes.data || []) as NarumiTask[]);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "운영 대시보드 데이터를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [selectedYear]);

  const ranges = useMemo(() => {
    const monthStart = startOfMonth(selectedYear, selectedMonth);
    const monthEnd = endOfMonth(selectedYear, selectedMonth);
    const yearStart = startOfYear(selectedYear);
    const yearEnd = endOfYear(selectedYear);
    return { monthStart, monthEnd, yearStart, yearEnd };
  }, [selectedYear, selectedMonth]);

  const consultationMap = useMemo(() => {
    const map = new Map<number, ConsultationRow>();
    consultations.forEach((row) => map.set(row.id, row));
    return map;
  }, [consultations]);

  const tireDetailMap = useMemo(() => {
    const map = new Map<number, TireDetailRow>();
    tireDetails.forEach((row) => map.set(row.consultation_id, row));
    return map;
  }, [tireDetails]);

  const monthConsultations = useMemo(
    () => consultations.filter((row) => isInRange(row.created_at, ranges.monthStart, ranges.monthEnd)),
    [consultations, ranges]
  );

  const monthConsultationIdSet = useMemo(
    () => new Set(monthConsultations.map((row) => row.id)),
    [monthConsultations]
  );

  const monthTireConsultations = useMemo(
    () => monthConsultations.filter((row) => row.work_type === "tire_sales"),
    [monthConsultations]
  );

  const ytdTireConsultations = useMemo(
    () => consultations.filter((row) => row.work_type === "tire_sales"),
    [consultations]
  );

  const monthNarumiTasks = useMemo(
    () => narumiTasks.filter((row) => isInRange(row.created_at, ranges.monthStart, ranges.monthEnd)),
    [narumiTasks, ranges]
  );

  const metricNewConsultations: Metric = useMemo(
    () => ({ month: monthConsultations.length, ytd: consultations.length }),
    [monthConsultations.length, consultations.length]
  );

  const metricNarumiInflows: Metric = useMemo(
    () => ({ month: monthNarumiTasks.length, ytd: narumiTasks.length }),
    [monthNarumiTasks.length, narumiTasks.length]
  );

  const insuranceMonthRows = useMemo(
    () => insuranceDetails.filter((row) => monthConsultationIdSet.has(row.consultation_id)),
    [insuranceDetails, monthConsultationIdSet]
  );

  const financeMonthRows = useMemo(
    () => financeDetails.filter((row) => monthConsultationIdSet.has(row.consultation_id)),
    [financeDetails, monthConsultationIdSet]
  );

  const tireMonthRows = useMemo(
    () => tireDetails.filter((row) => monthConsultationIdSet.has(row.consultation_id)),
    [tireDetails, monthConsultationIdSet]
  );

  const insuranceSummary = useMemo(() => {
    const monthPolicyIssued = insuranceMonthRows.filter((row) => !!row.policy_issued).length;
    const ytdPolicyIssued = insuranceDetails.filter((row) => !!row.policy_issued).length;
    const monthInProgress = insuranceMonthRows.filter((row) => !row.policy_issued).length;
    const ytdInProgress = insuranceDetails.filter((row) => !row.policy_issued).length;
    const monthNarumiDone = monthNarumiTasks.filter((row) => !!row.has_insurance).length;
    const ytdNarumiDone = narumiTasks.filter((row) => !!row.has_insurance).length;

    return {
      policyIssued: { month: monthPolicyIssued, ytd: ytdPolicyIssued },
      inProgress: { month: monthInProgress, ytd: ytdInProgress },
      narumiDone: { month: monthNarumiDone, ytd: ytdNarumiDone },
    };
  }, [insuranceMonthRows, insuranceDetails, monthNarumiTasks, narumiTasks]);

  const financeSummary = useMemo(() => {
    const stageCount = (rows: FinanceDetailRow[], stage: string) =>
      rows.filter((row) => row.finance_stage === stage).length;
    const amountSum = (rows: FinanceDetailRow[]) =>
      rows.reduce((sum, row) => sum + safeNumber(row.finance_amount), 0);
    const incentiveSum = (rows: FinanceDetailRow[]) =>
      rows.reduce((sum, row) => sum + (safeNumber(row.finance_amount) * safeNumber(row.finance_incentive) / 100), 0);

    const monthConfirmedRows = financeMonthRows.filter((row) => row.finance_stage === "confirmed");
    const ytdConfirmedRows = financeDetails.filter((row) => row.finance_stage === "confirmed");

    return {
      consulting: {
        month: stageCount(financeMonthRows, "consulting"),
        ytd: stageCount(financeDetails, "consulting"),
      },
      approved: {
        month: stageCount(financeMonthRows, "approved"),
        ytd: stageCount(financeDetails, "approved"),
      },
      documentsRequested: {
        month: stageCount(financeMonthRows, "documents_requested"),
        ytd: stageCount(financeDetails, "documents_requested"),
      },
      confirmed: {
        month: stageCount(financeMonthRows, "confirmed"),
        ytd: stageCount(financeDetails, "confirmed"),
      },
      rejected: {
        month: stageCount(financeMonthRows, "rejected"),
        ytd: stageCount(financeDetails, "rejected"),
      },
      confirmedAmount: {
        month: amountSum(monthConfirmedRows),
        ytd: amountSum(ytdConfirmedRows),
      },
      expectedIncentive: {
        month: incentiveSum(monthConfirmedRows),
        ytd: incentiveSum(ytdConfirmedRows),
      },
    };
  }, [financeMonthRows, financeDetails]);

  const tireSummary = useMemo(() => {
    const monthInflow = monthTireConsultations.length;
    const ytdInflow = ytdTireConsultations.length;
    const monthCompleted = tireMonthRows.filter((row) => row.process_status === "completed").length;
    const ytdCompleted = tireDetails.filter((row) => row.process_status === "completed").length;
    const monthQuote = tireMonthRows.filter((row) => row.process_status === "quote_sent").length;
    const ytdQuote = tireDetails.filter((row) => row.process_status === "quote_sent").length;

    const toRate = (won: number, total: number) => (total > 0 ? (won / total) * 100 : 0);

    return {
      inflow: { month: monthInflow, ytd: ytdInflow },
      quote: { month: monthQuote, ytd: ytdQuote },
      completed: { month: monthCompleted, ytd: ytdCompleted },
      conversionRate: {
        month: toRate(monthCompleted, monthInflow),
        ytd: toRate(ytdCompleted, ytdInflow),
      },
    };
  }, [monthTireConsultations, ytdTireConsultations, tireMonthRows, tireDetails]);

  const inflowSummary = useMemo(() => {
    const result = {
      total: { month: 0, ytd: 0 },
      association: { month: 0, ytd: 0 },
      gotruck: { month: 0, ytd: 0 },
      etc: { month: 0, ytd: 0 },
      seoul: { month: 0, ytd: 0 },
      gwangju: { month: 0, ytd: 0 },
      gyeongbuk: { month: 0, ytd: 0 },
      gyeongnam: { month: 0, ytd: 0 },
      unknownAssociation: { month: 0, ytd: 0 },
    };

    const apply = (consultation: ConsultationRow, bucket: "month" | "ytd") => {
      const detail = tireDetailMap.get(consultation.id);
      result.total[bucket] += 1;

      if (detail?.inflow_channel === "association") {
        result.association[bucket] += 1;
        if (detail.association_name === "서울") result.seoul[bucket] += 1;
        else if (detail.association_name === "광주") result.gwangju[bucket] += 1;
        else if (detail.association_name === "경북") result.gyeongbuk[bucket] += 1;
        else if (detail.association_name === "경남") result.gyeongnam[bucket] += 1;
        else result.unknownAssociation[bucket] += 1;
      } else if (detail?.inflow_channel === "gotruck") {
        result.gotruck[bucket] += 1;
      } else if (detail?.inflow_channel === "etc") {
        result.etc[bucket] += 1;
      }
    };

    monthTireConsultations.forEach((row) => apply(row, "month"));
    ytdTireConsultations.forEach((row) => apply(row, "ytd"));

    return result;
  }, [monthTireConsultations, ytdTireConsultations, tireDetailMap]);

  const dailyInflowData = useMemo(() => {
    const daysInMonth = endOfMonth(selectedYear, selectedMonth).getDate();
    const counts = Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      count: 0,
    }));

    monthTireConsultations.forEach((row) => {
      const date = new Date(row.created_at);
      const day = date.getDate();
      if (Number.isNaN(day) || day < 1 || day > daysInMonth) return;
      counts[day - 1].count += 1;
    });

    return counts;
  }, [monthTireConsultations, selectedYear, selectedMonth]);

  const hotList = useMemo(() => {
    const financeAttention = financeDetails
      .filter((row) => row.finance_stage === "approved" || row.finance_stage === "documents_requested")
      .map((row) => {
        const consultation = consultationMap.get(row.consultation_id);
        return {
          type: "금융",
          label: `${consultation?.customer_name || "고객명없음"} · ${financeStageLabel(
            row.finance_stage
          )}`,
          sub: `${row.finance_company || "금융사 미입력"} / ${formatCurrency(safeNumber(row.finance_amount))}`,
        };
      });

    const tireAttention = tireDetails
      .filter((row) => row.process_status === "quote_sent" || row.process_status === "waiting_order")
      .map((row) => {
        const consultation = consultationMap.get(row.consultation_id);
        return {
          type: "타이어",
          label: `${consultation?.customer_name || "고객명없음"} · ${tireStageLabel(row.process_status)}`,
          sub: `${row.current_brand || "브랜드 미입력"} / ${row.tire_size || "규격 미입력"}`,
        };
      });

    const insuranceAttention = insuranceDetails
      .filter((row) => !row.policy_issued)
      .map((row) => {
        const consultation = consultationMap.get(row.consultation_id);
        return {
          type: "보험",
          label: `${consultation?.customer_name || "고객명없음"} · ${insuranceStep(row)}`,
          sub: `${row.insurance_company || "보험사 미입력"} / ${row.vehicle_no || "차량번호 미입력"}`,
        };
      });

    return [...financeAttention, ...tireAttention, ...insuranceAttention].slice(0, 10);
  }, [financeDetails, tireDetails, insuranceDetails, consultationMap]);

  const monthLabel = `${selectedYear}년 ${selectedMonth}월`;
  const ytdLabel = `${selectedYear}년 누적`;

  const openConsultationList = (params?: Record<string, string | number | null | undefined>) => {
    if (typeof window === "undefined") return;
    window.open(consultationListUrl(params), "_blank", "noopener,noreferrer");
  };


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
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">Operations</p>
              <h1 className="mt-3 text-3xl md:text-4xl font-semibold leading-[1.15] text-white break-keep">
                운영 대시보드
              </h1>
              <p className="mt-3 text-base leading-7 text-white/75 break-keep">
                기본 표시는 월 기준이며, 모든 카드 하단에 {ytdLabel} 보조지표를 함께 노출합니다.
              </p>
            </div>

            {/* 연도/월 선택 */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">연도</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="h-[44px] rounded-2xl border border-white/20 bg-white/10 text-white px-4 text-sm font-medium focus:outline-none focus:border-orange-400 transition-all"
                >
                  {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((year) => (
                    <option key={year} value={year} className="text-navy-900 bg-white">{year}년</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">월</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="h-[44px] rounded-2xl border border-white/20 bg-white/10 text-white px-4 text-sm font-medium focus:outline-none focus:border-orange-400 transition-all"
                >
                  {Array.from({ length: 12 }).map((_, index) => (
                    <option key={index + 1} value={index + 1} className="text-navy-900 bg-white">{index + 1}월</option>
                  ))}
                </select>
              </div>
              <div className="h-[44px] rounded-2xl border border-orange-400/40 bg-orange-500/20 px-4 flex items-center text-sm font-semibold text-orange-300">
                {monthLabel}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">

        {/* ── 로딩 / 에러 ── */}
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white flex items-center justify-center gap-3 py-16 text-gray-400 shadow-sm">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span className="text-sm font-medium">데이터를 불러오는 중입니다.</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-6 py-4 text-sm font-semibold">
            {error}
          </div>
        ) : (
          <>
            {/* ── KPI 카드 5개 ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {[
                {
                  label: "신규 상담 유입",
                  value: metricNewConsultations.month.toLocaleString("ko-KR"),
                  ytd: formatCount(metricNewConsultations.ytd),
                  icon: <PhoneCall className="w-4 h-4 text-orange-500" />,
                  sub: monthLabel,
                },
                {
                  label: "나르미 신규 업무",
                  value: metricNarumiInflows.month.toLocaleString("ko-KR"),
                  ytd: formatCount(metricNarumiInflows.ytd),
                  icon: <Truck className="w-4 h-4 text-orange-500" />,
                  sub: monthLabel,
                },
                {
                  label: "보험 완료",
                  value: insuranceSummary.narumiDone.month.toLocaleString("ko-KR"),
                  ytd: formatCount(insuranceSummary.narumiDone.ytd),
                  icon: <Shield className="w-4 h-4 text-orange-500" />,
                  sub: "나르미 기준 완료건",
                },
                {
                  label: "금융 확정금액",
                  value: formatCurrency(financeSummary.confirmedAmount.month),
                  ytd: formatCurrency(financeSummary.confirmedAmount.ytd),
                  icon: <CircleDollarSign className="w-4 h-4 text-orange-500" />,
                  sub: "확정 단계 합계",
                },
                {
                  label: "타이어 판매전환율",
                  value: formatPercent(tireSummary.conversionRate.month),
                  ytd: formatPercent(tireSummary.conversionRate.ytd),
                  icon: <BadgePercent className="w-4 h-4 text-orange-500" />,
                  sub: "판매완료 / 신규상담",
                },
              ].map((kpi) => (
                <div key={kpi.label} className={`${cardClass} p-5`}>
                  <p className={labelClass}>{kpi.label}</p>
                  <p className={valueClass}>{kpi.value}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
                    {kpi.icon}
                    <span>{kpi.sub}</span>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">{ytdLabel} {kpi.ytd}</p>
                </div>
              ))}
            </div>

            {/* ── 유입채널 + 즉시처리 ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

              {/* 유입채널별 문의건수 */}
              <section className={`${cardClass} p-6 xl:col-span-2 space-y-5`}>
                <div>
                  <p className={sectionTitleClass}>Inflow</p>
                  <h2 className="mt-1 text-lg font-semibold text-navy-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-orange-500" />
                    유입채널별 문의건수
                  </h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: "association", label: "협회", data: inflowSummary.association },
                    { key: "gotruck",     label: "고트럭", data: inflowSummary.gotruck },
                    { key: "etc",         label: "기타",   data: inflowSummary.etc },
                    { key: "total",       label: "전체",   data: inflowSummary.total },
                  ].map((item) => (
                    <div key={item.key} className={subCardClass}>
                      <p className="text-xs font-medium text-gray-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-navy-900">{formatCount(item.data.month)}</p>
                      <p className="mt-1 text-xs text-gray-400">{ytdLabel} {formatCount(item.data.ytd)}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                  {[
                    { key: "서울",   data: inflowSummary.seoul },
                    { key: "광주",   data: inflowSummary.gwangju },
                    { key: "경북",   data: inflowSummary.gyeongbuk },
                    { key: "경남",   data: inflowSummary.gyeongnam },
                    { key: "미지정", data: inflowSummary.unknownAssociation },
                  ].map((item) => (
                    <div key={item.key} className={subCardClass}>
                      <p className="text-xs font-medium text-gray-500">협회 · {item.key}</p>
                      <p className="mt-2 text-xl font-semibold text-navy-900">{formatCount(item.data.month)}</p>
                      <p className="mt-1 text-xs text-gray-400">{ytdLabel} {formatCount(item.data.ytd)}</p>
                    </div>
                  ))}
                </div>

                {/* 일별 유입 바차트 */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <p className="text-sm font-semibold text-navy-900">일별 유입현황</p>
                    <p className="text-xs text-gray-400">세로축 최대 10건</p>
                  </div>
                  <div className="h-64 flex items-end gap-1 overflow-x-auto pb-2">
                    {dailyInflowData.map((item) => {
                      const heightPercent = Math.max((item.count / 10) * 100, item.count > 0 ? 8 : 2);
                      return (
                        <div
                          key={item.day}
                          className="min-w-[22px] flex-1 flex flex-col items-center justify-end gap-1"
                          title={`${item.day}일 · ${item.count}건`}
                        >
                          <span className="text-[10px] font-medium text-gray-500">{item.count > 0 ? item.count : ""}</span>
                          <div className="w-full h-44 flex items-end">
                            <div
                              className="w-full rounded-t-lg bg-orange-500/80 hover:bg-orange-500 transition-colors"
                              style={{ height: `${heightPercent}%`, maxHeight: "100%" }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400">{item.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 즉시 처리 필요 */}
              <section className={`${cardClass} p-6 xl:col-span-1`}>
                <div className="mb-5">
                  <p className={sectionTitleClass}>Urgent</p>
                  <h2 className="mt-1 text-lg font-semibold text-navy-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-orange-500" />
                    즉시 처리 필요
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => openConsultationList({ work_type: "all", priority: "urgent" })}
                  className="w-full text-left space-y-3"
                >
                  {hotList.length === 0 ? (
                    <div className={`${subCardClass} text-sm text-gray-400`}>
                      현재 즉시 처리 필요 목록이 없습니다.
                    </div>
                  ) : (
                    hotList.map((item, index) => (
                      <div key={`${item.type}-${index}`} className={subCardClass}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-orange-600">{item.type}</span>
                          <span className={chipClass}>새 탭 열기 →</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-navy-900">{item.label}</p>
                        <p className="mt-1 text-xs text-gray-500">{item.sub}</p>
                      </div>
                    ))
                  )}
                </button>
              </section>
            </div>

            {/* ── 보험 / 금융 / 타이어 상세 ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

              {/* 보험 */}
              <section className={`${cardClass} p-6 space-y-4`}>
                <div>
                  <p className={sectionTitleClass}>Insurance</p>
                  <button
                    type="button"
                    onClick={() => openConsultationList({ work_type: "registration_insurance" })}
                    className="mt-1 text-lg font-semibold text-navy-900 flex items-center gap-2 hover:text-orange-600 transition-colors"
                  >
                    <Gauge className="w-5 h-5 text-orange-500" />
                    보험 진행 요약
                  </button>
                </div>
                <div className="space-y-3">
                  {insuranceMonthRows.slice(0, 6).map((row) => {
                    const consultation = consultationMap.get(row.consultation_id);
                    return (
                      <div key={row.consultation_id} className={subCardClass}>
                        <p className="text-sm font-semibold text-navy-900">{consultation?.customer_name || "고객명없음"}</p>
                        <p className="mt-1 text-xs text-gray-600">
                          {row.insurance_company || "보험사 미입력"} · {insuranceStep(row)}
                        </p>
                      </div>
                    );
                  })}
                  {insuranceMonthRows.length === 0 && (
                    <div className={`${subCardClass} text-sm text-gray-400`}>해당 월 보험 데이터가 없습니다.</div>
                  )}
                </div>
              </section>

              {/* 금융 */}
              <section className={`${cardClass} p-6 space-y-4`}>
                <div>
                  <p className={sectionTitleClass}>Finance</p>
                  <button
                    type="button"
                    onClick={() => openConsultationList({ work_type: "finance" })}
                    className="mt-1 text-lg font-semibold text-navy-900 flex items-center gap-2 hover:text-orange-600 transition-colors"
                  >
                    <FileText className="w-5 h-5 text-orange-500" />
                    금융 단계별 상세
                  </button>
                </div>
                <div className="space-y-3">
                  {financeMonthRows.slice(0, 6).map((row) => {
                    const consultation = consultationMap.get(row.consultation_id);
                    const incentiveAmount = (safeNumber(row.finance_amount) * safeNumber(row.finance_incentive)) / 100;
                    return (
                      <div key={row.consultation_id} className={subCardClass}>
                        <p className="text-sm font-semibold text-navy-900">{consultation?.customer_name || "고객명없음"}</p>
                        <p className="mt-1 text-xs text-gray-600">
                          {financeStageLabel(row.finance_stage)} · {row.finance_company || "금융사 미입력"}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          취급액 {formatCurrency(safeNumber(row.finance_amount))} / 인센티브 {formatCurrency(incentiveAmount)}
                        </p>
                      </div>
                    );
                  })}
                  {financeMonthRows.length === 0 && (
                    <div className={`${subCardClass} text-sm text-gray-400`}>해당 월 금융 데이터가 없습니다.</div>
                  )}
                </div>
              </section>

              {/* 타이어 */}
              <section className={`${cardClass} p-6 space-y-4`}>
                <div>
                  <p className={sectionTitleClass}>Tire</p>
                  <button
                    type="button"
                    onClick={() => openConsultationList({ work_type: "tire_sales" })}
                    className="mt-1 text-lg font-semibold text-navy-900 flex items-center gap-2 hover:text-orange-600 transition-colors"
                  >
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                    타이어 진행 상세
                  </button>
                </div>
                <div className="space-y-3">
                  {tireMonthRows.slice(0, 6).map((row, index) => {
                    const consultation = consultationMap.get(row.consultation_id);
                    return (
                      <div key={`${row.consultation_id}-${index}`} className={subCardClass}>
                        <p className="text-sm font-semibold text-navy-900">{consultation?.customer_name || "고객명없음"}</p>
                        <p className="mt-1 text-xs text-gray-600">
                          {tireStageLabel(row.process_status)} · {row.current_brand || "브랜드 미입력"}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {row.tire_size || "규격 미입력"} / {inflowChannelLabel(row.inflow_channel, row.association_name)}
                        </p>
                      </div>
                    );
                  })}
                  {tireMonthRows.length === 0 && (
                    <div className={`${subCardClass} text-sm text-gray-400`}>해당 월 타이어 데이터가 없습니다.</div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;