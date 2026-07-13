import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  ChevronLeft, ChevronRight, Loader2, ArrowLeft, RefreshCw,
  PhoneCall, CheckCircle2, Truck, Package, TrendingUp, CircleDollarSign,
} from "lucide-react";

// ── 날짜 유틸 (로컬 시간 기준 조립. toISOString()은 UTC 변환 과정에서
//    한국 시간 새벽 0~8시대에 하루 밀리는 문제가 있어 사용하지 않음) ──
const pad = (n: number) => String(n).padStart(2, "0");
const toLocalStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); // 0=일 ... 6=토
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}
// 해당 연/월에 "속하는" 주(월요일 기준)의 목록. 한 주의 월요일이 그 달에 있으면 그 달의 N주차로 취급.
function weeksInMonth(year: number, month: number): Date[] {
  let m = mondayOf(new Date(year, month - 1, 1));
  if (m.getMonth() + 1 !== month || m.getFullYear() !== year) m = addDays(m, 7);
  const list: Date[] = [];
  while (m.getFullYear() === year && m.getMonth() + 1 === month) {
    list.push(m);
    m = addDays(m, 7);
  }
  return list;
}
const sameDay = (a: Date, b: Date) => toLocalStr(a) === toLocalStr(b);
const fmtWon = (n: number) => `${Math.round(n || 0).toLocaleString("ko-KR")}원`;
const fmtMD = (d: Date) => `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;

// ── 업무유형 라벨 (신규 상담 등록 폼과 동일 매핑, secretary/index.tsx 참조) ──
const WORK_TYPE_LABEL: Record<string, string> = {
  finance: "💳 할부금융",
  registration_insurance: "🛡 보험",
  export: "🌏 수출",
  forklift_sales: "🚜 지게차",
  battery_sales: "🔋 배터리",
  tire_sales: "🔧 타이어",
  tire: "🔧 타이어",
  battery: "🔋 배터리",
  narumi: "🚛 나르미",
};
const workTypeLabel = (wt: string | null) => (wt && WORK_TYPE_LABEL[wt]) || wt || "기타";

// ── 스타일 ──
const card = "border border-gray-200 rounded-2xl bg-white shadow-sm";
const sectionTitle = "text-xs font-semibold tracking-[0.12em] uppercase text-orange-500";
const btnHero = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors disabled:opacity-50";

type Row = Record<string, any>;

export default function WeeklyReviewPage() {
  const navigate = useNavigate();
  const thisWeekMonday = useMemo(() => mondayOf(new Date()), []);
  const [selectedMonday, setSelectedMonday] = useState<Date>(thisWeekMonday);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // 월/주차 선택 — 그 주의 월요일이 속한 연/월을 기준으로 함
  const pickerYear = selectedMonday.getFullYear();
  const pickerMonth = selectedMonday.getMonth() + 1;
  const weekOptions = useMemo(() => weeksInMonth(pickerYear, pickerMonth), [pickerYear, pickerMonth]);
  const weekIndex = Math.max(0, weekOptions.findIndex(m => sameDay(m, selectedMonday)));

  const goPrevWeek = () => setSelectedMonday(m => addDays(m, -7));
  const goNextWeek = () => setSelectedMonday(m => addDays(m, 7));
  const goThisWeek = () => setSelectedMonday(thisWeekMonday);
  const onYearChange = (y: number) => {
    const weeks = weeksInMonth(y, pickerMonth);
    setSelectedMonday(weeks[Math.min(weekIndex, weeks.length - 1)] ?? mondayOf(new Date(y, pickerMonth - 1, 1)));
  };
  const onMonthChange = (mo: number) => {
    const weeks = weeksInMonth(pickerYear, mo);
    setSelectedMonday(weeks[0] ?? mondayOf(new Date(pickerYear, mo - 1, 1)));
  };
  const onWeekChange = (idx: number) => {
    if (weekOptions[idx]) setSelectedMonday(weekOptions[idx]);
  };

  const { monday, sunday, from, to, dtFrom, dtTo } = useMemo(() => {
    const monday = selectedMonday;
    const sunday = addDays(monday, 6);
    const from = toLocalStr(monday), to = toLocalStr(sunday);
    return { monday, sunday, from, to, dtFrom: `${from}T00:00:00`, dtTo: `${to}T23:59:59` };
  }, [selectedMonday]);

  const [consultations, setConsultations] = useState<Row[]>([]);
  const [hcm, setHcm] = useState<Row[]>([]);
  const [taesan, setTaesan] = useState<Row[]>([]);
  const [otherFin, setOtherFin] = useState<Row[]>([]);
  const [ordersCreated, setOrdersCreated] = useState<Row[]>([]);
  const [ordersDelivered, setOrdersDelivered] = useState<Row[]>([]);
  const [salesWeek, setSalesWeek] = useState<Row[]>([]);
  const [forkliftQuotes, setForkliftQuotes] = useState<Row[]>([]);
  const [insurance, setInsurance] = useState<Row[]>([]);
  const [narumi, setNarumi] = useState<Row[]>([]);
  const [rentalOS, setRentalOS] = useState<Row[]>([]);

  async function load() {
    setLoading(true);
    await Promise.all([
      supabase.from("consultation_cases")
        .select("id,customer_name,work_type,sub_type,status,created_at")
        .gte("created_at", dtFrom).lte("created_at", dtTo)
        .then(({ data }) => setConsultations(data ?? [])),

      supabase.from("hyundaicm_tasks")
        .select("id,customer_name,company_name,finance_company,equipment_ton,installment_principal,purchase_amount,created_at")
        .eq("status", "확정").gte("created_at", dtFrom).lte("created_at", dtTo)
        .then(({ data }) => setHcm(data ?? [])),

      supabase.from("taesan_tasks")
        .select("id,customer_name,company_name,finance_company,equipment_ton,installment_principal,purchase_amount,created_at")
        .eq("status", "확정").gte("created_at", dtFrom).lte("created_at", dtTo)
        .then(({ data }) => setTaesan(data ?? [])),

      supabase.from("consultation_cases")
        .select("id,customer_name,sub_type,consultation_finance_details(finance_stage,finance_company,finance_amount,finance_product)")
        .eq("work_type", "finance")
        .or("sub_type.not.in.(현대CM,태산통운),sub_type.is.null")
        .gte("created_at", dtFrom).lte("created_at", dtTo)
        .then(({ data }) => setOtherFin(
          (data ?? []).filter((c: any) => c.consultation_finance_details?.finance_stage === "confirmed")
            .map((c: any) => ({ ...c, ...c.consultation_finance_details, amount: c.consultation_finance_details?.finance_amount ?? 0 }))
        )),

      supabase.from("tb_orders")
        .select("id,customer_name_raw,product_spec,quantity,status,price_to_customer,margin,created_at,delivered_at")
        .gte("created_at", dtFrom).lte("created_at", dtTo)
        .then(({ data }) => setOrdersCreated(data ?? [])),

      supabase.from("tb_orders")
        .select("id,customer_name_raw,product_spec,quantity,status,price_to_customer,margin,created_at,delivered_at")
        .gte("delivered_at", dtFrom).lte("delivered_at", dtTo)
        .then(({ data }) => setOrdersDelivered(data ?? [])),

      // "매출" 공식 정의 = 세금계산서 발행 기준(tax_invoice=true). 실적관리/대시보드와 통일.
      supabase.from("sales_records")
        .select("id,customer_name,category,spec,quantity,total_revenue,margin,sale_date,tax_invoice,payment_confirmed")
        .eq("tax_invoice", true)
        .gte("sale_date", from).lte("sale_date", to)
        .then(({ data }) => setSalesWeek(data ?? [])),

      supabase.from("tb_quotations")
        .select("id,quote_no,recipient,grand_total,total_amount,quote_type,quote_date,created_at")
        .eq("quote_type", "forklift").gte("created_at", dtFrom).lte("created_at", dtTo)
        .then(({ data }) => setForkliftQuotes(data ?? [])),

      // "완료" 공식 정의 = 증권발급 기준(policy_issued=true). 이번 주 상담 접수된 건 중
      // (지금까지) 증권까지 발급된 것만 집계 — 대시보드와 동일한 정의.
      supabase.from("consultation_cases")
        .select("id,customer_name,phone,status,created_at,consultation_insurance_details(policy_issued)")
        .eq("work_type", "registration_insurance")
        .gte("created_at", dtFrom).lte("created_at", dtTo)
        .then(({ data }) => setInsurance((data ?? []).filter((c: any) => c.consultation_insurance_details?.policy_issued))),

      supabase.from("narumi_tasks")
        .select("id,customer_name,vin,is_registered,status,created_at")
        .gte("created_at", dtFrom).lte("created_at", dtTo)
        .then(({ data }) => setNarumi(data ?? [])),

      supabase.from("rental_os_deals")
        .select("id,customer_name,company_name,outsourcing_partner,amount,status,created_at")
        .eq("status", "확정").gte("created_at", dtFrom).lte("created_at", dtTo)
        .then(({ data }) => setRentalOS(data ?? [])),
    ]);
    setLoading(false);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to]);

  // ── 집계 ──
  const consultByType = useMemo(() => {
    const m = new Map<string, number>();
    consultations.forEach(c => m.set(c.work_type, (m.get(c.work_type) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [consultations]);

  const hcmAmt = hcm.reduce((s, r) => s + (r.installment_principal ?? r.purchase_amount ?? 0), 0);
  const taesanAmt = taesan.reduce((s, r) => s + (r.installment_principal ?? r.purchase_amount ?? 0), 0);
  const otherFinAmt = otherFin.reduce((s, r) => s + (r.amount ?? 0), 0);
  const rentalOSAmt = rentalOS.reduce((s, r) => s + (r.amount ?? 0), 0);
  const confirmedCnt = hcm.length + taesan.length + otherFin.length + rentalOS.length;
  const confirmedAmt = hcmAmt + taesanAmt + otherFinAmt + rentalOSAmt;

  const ordersCreatedAmt = ordersCreated.reduce((s, r) => s + (r.price_to_customer ?? 0), 0);
  const ordersDeliveredAmt = ordersDelivered.reduce((s, r) => s + (r.price_to_customer ?? 0), 0);

  // 상단 KPI "매출"은 전 품목 합계(지게차 포함)를 그대로 쓰고, 아래 "매출(품목별)" 목록에서만
  // 지게차를 뺀다 — 지게차는 별도 "지게차 판매" 섹션(견적서+세금계산서 통합)에서 표시하므로,
  // 품목별 목록에도 함께 나오면 두 섹션을 더할 때 중복 카운트되기 때문.
  const isForkliftCat = (cat: string | null) => /^지게차/.test(cat ?? "");
  const salesTotal = salesWeek.reduce((s, r) => s + (r.total_revenue ?? 0), 0);
  const salesByCategory = useMemo(() => {
    const bucket = (cat: string) => {
      if (/^타이어/.test(cat)) return "🔧 타이어";
      if (/배터리|LFP/i.test(cat)) return "🔋 배터리";
      return "📦 기타";
    };
    const m = new Map<string, { cnt: number; amt: number }>();
    salesWeek.forEach(r => {
      if (isForkliftCat(r.category)) return;
      const key = bucket(r.category ?? "");
      const cur = m.get(key) ?? { cnt: 0, amt: 0 };
      cur.cnt += 1; cur.amt += r.total_revenue ?? 0;
      m.set(key, cur);
    });
    return Array.from(m.entries());
  }, [salesWeek]);

  const forkliftSalesRows = useMemo(() => salesWeek.filter(r => isForkliftCat(r.category)), [salesWeek]);
  const forkliftSalesAmt = forkliftSalesRows.reduce((s, r) => s + (r.total_revenue ?? 0), 0);
  const forkliftQuoteAmt = forkliftQuotes.reduce((s, r) => s + (r.grand_total ?? r.total_amount ?? 0), 0);
  const narumiRegistered = narumi.filter((r: any) => r.is_registered).length;

  const totalHandling = confirmedAmt + ordersCreatedAmt; // 취급액 = 금융 확정액 + 발주 매출

  const weekLabel = `${monday.getFullYear()}.${fmtMD(monday)}(월) ~ ${sunday.getFullYear() !== monday.getFullYear() ? sunday.getFullYear() + "." : ""}${fmtMD(sunday)}(일)`;
  const isThisWeek = sameDay(monday, thisWeekMonday);

  // ── KPI 카드 ──
  const kpis = [
    { label: "상담 건수", value: `${consultations.length}건`, icon: PhoneCall, color: "text-white" },
    { label: "확정 건수", value: `${confirmedCnt}건`, sub: fmtWon(confirmedAmt), icon: CheckCircle2, color: "text-emerald-300" },
    { label: "발주 건수", value: `${ordersCreated.length}건`, sub: fmtWon(ordersCreatedAmt), icon: Package, color: "text-sky-300" },
    { label: "납품 건수", value: `${ordersDelivered.length}건`, sub: fmtWon(ordersDeliveredAmt), icon: Truck, color: "text-indigo-300" },
    { label: "매출", value: fmtWon(salesTotal), sub: `${salesWeek.length}건`, icon: TrendingUp, color: "text-orange-300" },
    { label: "취급액", value: fmtWon(totalHandling), sub: "확정+발주 합계", icon: CircleDollarSign, color: "text-amber-300" },
  ];

  // ── 재사용 컴포넌트 ──
  const RowItem = ({ label, cnt, amt, sub }: { label: string; cnt: number; amt?: number; sub?: string }) => (
    <div className="flex items-center justify-between py-2 px-4">
      <span className="text-xs text-gray-700 font-medium">{label}</span>
      <div className="text-right">
        <span className="text-sm font-bold text-[#0a192f]">{cnt}건</span>
        {amt !== undefined && amt > 0 && <span className="text-xs text-gray-500 ml-2">{fmtWon(amt)}</span>}
        {sub && <span className="text-[11px] text-gray-400 ml-1">({sub})</span>}
      </div>
    </div>
  );

  const DetailList = ({ rows, cols }: { rows: Row[]; cols: (r: Row) => string }) => (
    <div className="border-t border-gray-100 bg-gray-50/60 divide-y divide-gray-100">
      {rows.length === 0
        ? <p className="text-xs text-gray-400 text-center py-3">내역 없음</p>
        : rows.map((r, i) => (
          <div key={r.id ?? i} className="px-4 py-2 flex gap-2 items-start">
            <span className="text-[11px] text-gray-400 w-4 flex-shrink-0 text-right mt-0.5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#0a192f]">{cols(r) || "—"}</p>
              <p className="text-[11px] text-gray-400">{(r.sale_date || r.quote_date || r.delivered_at || r.created_at || "").toString().slice(0, 10)}</p>
            </div>
          </div>
        ))
      }
    </div>
  );

  const Section = ({ id, color, hColor, title, sub, children, rows, cols }: {
    id: string; color: string; hColor: string; title: string; sub?: string;
    children: React.ReactNode; rows?: Row[]; cols?: (r: Row) => string;
  }) => {
    const open = expanded === id;
    return (
      <div className={`border rounded-2xl overflow-hidden ${color}`}>
        <button className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-all" onClick={() => setExpanded(open ? null : id)}>
          <div className="text-left">
            <span className={`text-xs font-bold ${hColor}`}>{title}</span>
            {sub && <span className="text-[11px] text-gray-400 ml-2">{sub}</span>}
          </div>
          <span className={`text-gray-400 text-xs transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
        </button>
        <div className="divide-y divide-white/50">{children}</div>
        {open && rows && cols && <DetailList rows={rows} cols={cols} />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 히어로 ── */}
      <section className="relative bg-[#0a192f] text-white overflow-hidden sticky top-16 z-30">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)", backgroundSize: "24px 24px" }} />
        <div className="relative max-w-6xl mx-auto px-6 md:px-8 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button onClick={() => navigate("/work/finance-hub")} className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 mb-2">
                <ArrowLeft className="w-3.5 h-3.5" /> 매출/매입으로
              </button>
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-orange-400">Weekly Review</p>
              <h1 className="mt-1 text-2xl md:text-3xl font-semibold text-white">주간 리뷰</h1>
              <p className="mt-1 text-sm text-white/60">{weekLabel}{isThisWeek && <span className="ml-2 text-orange-400 font-semibold">이번 주</span>}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={pickerYear} onChange={e => onYearChange(Number(e.target.value))}
                className="h-[34px] rounded-xl border border-white/20 bg-white/10 text-white px-2 text-xs focus:outline-none">
                {[thisWeekMonday.getFullYear() - 1, thisWeekMonday.getFullYear(), thisWeekMonday.getFullYear() + 1].map(y =>
                  <option key={y} value={y} className="text-gray-900 bg-white">{y}년</option>)}
              </select>
              <select value={pickerMonth} onChange={e => onMonthChange(Number(e.target.value))}
                className="h-[34px] rounded-xl border border-white/20 bg-white/10 text-white px-2 text-xs focus:outline-none">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
                  <option key={m} value={m} className="text-gray-900 bg-white">{m}월</option>)}
              </select>
              <select value={weekIndex} onChange={e => onWeekChange(Number(e.target.value))}
                className="h-[34px] rounded-xl border border-white/20 bg-white/10 text-white px-2 text-xs focus:outline-none">
                {weekOptions.map((m, i) => (
                  <option key={i} value={i} className="text-gray-900 bg-white">{i + 1}주차 ({fmtMD(m)}~{fmtMD(addDays(m, 6))})</option>
                ))}
              </select>
              <button className={btnHero} onClick={goPrevWeek}><ChevronLeft className="w-4 h-4" /></button>
              <button className={btnHero} onClick={goThisWeek} disabled={isThisWeek}>이번주</button>
              <button className={btnHero} onClick={goNextWeek}><ChevronRight className="w-4 h-4" /></button>
              <button className={btnHero} onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* KPI */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide flex items-center gap-1">
                  <k.icon className="w-3 h-3" /> {k.label}
                </p>
                <p className={`mt-1 text-base font-semibold ${k.color}`}>{k.value}</p>
                {k.sub && <p className="text-[10px] text-white/40 mt-0.5">{k.sub}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 본문 ── */}
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-6 space-y-5">

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">불러오는 중...</p>
        ) : (
          <>
            {/* 상담 유형별 */}
            <section className={`${card} p-5`}>
              <p className={sectionTitle}>Consultations</p>
              <h2 className="mt-1 text-base font-semibold text-[#0a192f] flex items-center gap-2 mb-3">
                <PhoneCall className="w-4 h-4 text-orange-500" /> 이번 주 상담 {consultations.length}건
              </h2>
              {consultByType.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">이번 주 등록된 상담이 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {consultByType.map(([wt, cnt]) => (
                    <span key={wt} className="text-xs px-3 py-1.5 rounded-full font-medium bg-gray-100 text-gray-700">
                      {workTypeLabel(wt)} {cnt}건
                    </span>
                  ))}
                </div>
              )}
            </section>

            <div className="space-y-2">
              {/* 할부금융 확정 */}
              <Section id="fin" color="bg-blue-50 border-blue-200" hColor="text-blue-700" title="💳 할부금융 확정" sub="이번 주 확정 기준">
                <RowItem label="🏗 현대CM" cnt={hcm.length} amt={hcmAmt} />
                <RowItem label="🚛 태산통운" cnt={taesan.length} amt={taesanAmt} />
                <RowItem label="📋 기타금융" cnt={otherFin.length} amt={otherFinAmt} />
                <div className="flex items-center justify-between py-2 px-4 bg-blue-100/60">
                  <span className="text-xs font-bold text-blue-700">합계</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-blue-800">{confirmedCnt}건</span>
                    {confirmedAmt > 0 && <span className="text-xs text-blue-600 ml-2">{fmtWon(confirmedAmt)}</span>}
                  </div>
                </div>
              </Section>
              {expanded === "fin" && (
                <div className="grid md:grid-cols-3 gap-2 -mt-1">
                  {[
                    { label: "현대CM", rows: hcm, cols: (r: Row) => [r.customer_name, r.company_name, r.finance_company, r.equipment_ton ? r.equipment_ton + "톤" : "", (r.installment_principal ?? r.purchase_amount) ? fmtWon(r.installment_principal ?? r.purchase_amount) : ""].filter(Boolean).join(" · ") },
                    { label: "태산통운", rows: taesan, cols: (r: Row) => [r.customer_name, r.company_name, r.finance_company, (r.installment_principal ?? r.purchase_amount) ? fmtWon(r.installment_principal ?? r.purchase_amount) : ""].filter(Boolean).join(" · ") },
                    { label: "기타금융", rows: otherFin, cols: (r: Row) => [r.customer_name, r.finance_company, r.finance_product, r.amount ? fmtWon(r.amount) : ""].filter(Boolean).join(" · ") },
                  ].map(({ label, rows, cols }) => rows.length > 0 && (
                    <div key={label} className={`${card} overflow-hidden`}>
                      <p className="text-[11px] font-semibold text-blue-500 px-4 pt-2 pb-1">{label}</p>
                      <DetailList rows={rows} cols={cols} />
                    </div>
                  ))}
                </div>
              )}

              {/* Rental_O/S 확정 */}
              <Section id="rental" color="bg-teal-50 border-teal-200" hColor="text-teal-700" title="🚐 Rental_O/S 확정" sub="이번 주 확정 기준"
                rows={rentalOS} cols={(r: Row) => [r.customer_name, r.company_name, r.outsourcing_partner, r.amount ? fmtWon(r.amount) : ""].filter(Boolean).join(" · ")}>
                <RowItem label="확정 건수" cnt={rentalOS.length} amt={rentalOSAmt} />
              </Section>

              {/* 진흥 발주/납품 */}
              <Section id="ord" color="bg-purple-50 border-purple-200" hColor="text-purple-700" title="🚚 진흥 발주/납품" sub="발주=접수일, 납품=납품일 기준"
                rows={expanded === "ord" ? [...ordersCreated] : undefined}
                cols={(r: Row) => [r.customer_name_raw, r.product_spec, r.quantity ? r.quantity + "개" : "", r.price_to_customer ? fmtWon(r.price_to_customer) : "", r.delivered_at ? "납품✓" : ""].filter(Boolean).join(" · ")}>
                <RowItem label="발주 건수" cnt={ordersCreated.length} amt={ordersCreatedAmt} />
                <RowItem label="납품 건수" cnt={ordersDelivered.length} amt={ordersDeliveredAmt} />
              </Section>

              {/* 매출 (품목별, 지게차 제외 — 지게차는 아래 별도 섹션에서 견적+세금계산서 통합 표시) */}
              <Section id="sales" color="bg-orange-50 border-orange-200" hColor="text-orange-700" title="📦 매출 (품목별)" sub="세금계산서 발행 기준">
                {salesByCategory.length === 0
                  ? <RowItem label="이번 주 매출 없음" cnt={0} />
                  : salesByCategory.map(([cat, v]) => <RowItem key={cat} label={cat} cnt={v.cnt} amt={v.amt} />)}
                <div className="flex items-center justify-between py-2 px-4 bg-orange-100/60">
                  <span className="text-xs font-bold text-orange-700">소계 (지게차 제외)</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-orange-800">{salesByCategory.reduce((s, [, v]) => s + v.cnt, 0)}건</span>
                    {(() => { const amt = salesByCategory.reduce((s, [, v]) => s + v.amt, 0); return amt > 0 && <span className="text-xs text-orange-600 ml-2">{fmtWon(amt)}</span>; })()}
                  </div>
                </div>
              </Section>
              {expanded === "sales" && (
                <div className={`${card} overflow-hidden -mt-1`}>
                  <DetailList rows={salesWeek.filter(r => !isForkliftCat(r.category))} cols={(r: Row) => [r.customer_name, r.category, r.spec, r.total_revenue ? fmtWon(r.total_revenue) : "", r.payment_confirmed ? "입금✓" : ""].filter(Boolean).join(" · ")} />
                </div>
              )}

              {/* 지게차 판매 (견적서 발행 + 세금계산서 발행 통합 — 실적관리와 동일 구조) */}
              <Section id="fkl" color="bg-sky-50 border-sky-200" hColor="text-sky-700" title="🚜 지게차 판매" sub="견적서·세금계산서 기준"
                rows={[...forkliftQuotes, ...forkliftSalesRows]}
                cols={(r: Row) => 'quote_no' in r
                  ? [r.recipient, r.quote_no, (r.grand_total ?? r.total_amount) ? fmtWon(r.grand_total ?? r.total_amount) : ""].filter(Boolean).join(" · ")
                  : [r.customer_name, r.spec, r.total_revenue ? fmtWon(r.total_revenue) : "", r.payment_confirmed ? "입금✓" : ""].filter(Boolean).join(" · ")}>
                {forkliftQuotes.length > 0 && <RowItem label="견적서 발행" cnt={forkliftQuotes.length} amt={forkliftQuoteAmt} />}
                {forkliftSalesRows.length > 0 && <RowItem label="세금계산서 발행" cnt={forkliftSalesRows.length} amt={forkliftSalesAmt} />}
                {forkliftQuotes.length === 0 && forkliftSalesRows.length === 0 && <RowItem label="이번 주 없음" cnt={0} />}
              </Section>

              {/* 보험 */}
              <Section id="ins" color="bg-rose-50 border-rose-200" hColor="text-rose-700" title="🛡 보험 완료" sub="증권발급 기준"
                rows={insurance} cols={(r: Row) => [r.customer_name, r.phone, r.status].filter(Boolean).join(" · ")}>
                <RowItem label="증권발급 완료" cnt={insurance.length} />
              </Section>

              {/* 나르미 */}
              <Section id="nrm" color="bg-indigo-50 border-indigo-200" hColor="text-indigo-700" title="🚛 나르미 업무" sub="접수 기준"
                rows={narumi} cols={(r: Row) => [r.customer_name, r.vin ? `VIN:${r.vin}` : "", r.is_registered ? "등록완료" : ""].filter(Boolean).join(" · ")}>
                <RowItem label="전체 접수" cnt={narumi.length} />
                <RowItem label="등록완료" cnt={narumiRegistered} />
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
