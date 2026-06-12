import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Pencil,
  Trash2,
  Loader2,
  PackageCheck,
  Truck,
  CircleDollarSign,
  AlertCircle,
} from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────────────────────
type Customer = {
  id: string;
  name: string;
  business_no: string | null;
  representative: string | null;
  address: string | null;
};

type SalesRecord = {
  id: number;
  sale_date: string;
  customer_name: string;
  business_no: string | null;
  category: string;
  maker: string | null;
  spec: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total_revenue: number;
  total_cost: number;
  margin: number;
  tax_invoice: boolean;
  payment_confirmed: boolean;
  payment_date: string | null;
  delivery_date: string | null;
  delivery_confirmed: boolean;
  wheel_returned: boolean;
  closing: boolean;
  note: string | null;
};

type FormData = {
  sale_date: string;
  customer_name: string;
  business_no: string;
  category: string;
  maker: string;
  spec: string;
  quantity: string;
  unit_price: string;
  unit_cost: string;
  tax_invoice: boolean;
  payment_confirmed: boolean;
  payment_date: string;
  delivery_date: string;
  delivery_confirmed: boolean;
  wheel_returned: boolean;
  closing: boolean;
  note: string;
};

// ── 상수 ─────────────────────────────────────────────────────────────────────
const CATEGORIES = ["타이어", "렌탈", "LFP(지게차)", "LFP(고소작업대)", "기타"];

const CATEGORY_COLORS: Record<string, string> = {
  "타이어":          "bg-blue-100 text-blue-700",
  "렌탈":            "bg-purple-100 text-purple-700",
  "LFP(지게차)":     "bg-emerald-100 text-emerald-700",
  "LFP(고소작업대)": "bg-teal-100 text-teal-700",
  "기타":            "bg-gray-100 text-gray-600",
};

const EMPTY_FORM: FormData = {
  sale_date: new Date().toISOString().split("T")[0],
  customer_name: "",
  business_no: "",
  category: "타이어",
  maker: "",
  spec: "",
  quantity: "",
  unit_price: "",
  unit_cost: "",
  tax_invoice: false,
  payment_confirmed: false,
  payment_date: "",
  delivery_date: "",
  delivery_confirmed: false,
  wheel_returned: false,
  closing: false,
  note: "",
};

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function calcPreview(form: FormData) {
  const qty = parseFloat(form.quantity) || 0;
  const price = parseFloat(form.unit_price) || 0;
  const cost = parseFloat(form.unit_cost) || 0;
  const revenue = qty * price * 1.1;
  const totalCost = qty * cost * 1.1;
  const margin = revenue - totalCost;
  return { revenue, totalCost, margin };
}

// ── 스타일 ───────────────────────────────────────────────────────────────────
const cardClass = "border border-gray-200 rounded-2xl bg-white shadow-sm";
const inputClass =
  "w-full h-[44px] rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-900 bg-white " +
  "focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all";
const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide";
const btnPrimary =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold " +
  "hover:bg-orange-600 active:bg-orange-700 transition-colors disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium " +
  "text-gray-600 hover:bg-gray-50 transition-colors";
const btnGhost =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors";

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────
const SalesPage: React.FC = () => {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [filterCategory, setFilterCategory] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");

  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 폼 상태
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // 거래처 자동완성
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  // ── 데이터 로드 ───────────────────────────────────────────────────────────
  useEffect(() => {
    loadRecords();
    loadCustomers();
  }, [selectedYear, selectedMonth]);

  async function loadRecords() {
    setLoading(true);
    setError(null);
    const from = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    const to = new Date(selectedYear, selectedMonth, 0).toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("sales_records")
      .select("*")
      .gte("sale_date", from)
      .lte("sale_date", to)
      .order("sale_date", { ascending: false });

    if (error) setError(error.message);
    else setRecords((data || []) as SalesRecord[]);
    setLoading(false);
  }

  async function loadCustomers() {
    const { data } = await supabase
      .from("customers")
      .select("id, name, business_no, representative, address")
      .eq("is_active", true)
      .order("name");
    setCustomers((data || []) as Customer[]);
  }

  // ── 거래처 자동완성 ───────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    if (!customerQuery) return customers;
    const q = customerQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.business_no || "").includes(q)
    );
  }, [customers, customerQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectCustomer(c: Customer) {
    setForm((prev) => ({
      ...prev,
      customer_name: c.name,
      business_no: c.business_no || "",
    }));
    setCustomerQuery(c.name);
    setShowCustomerDropdown(false);
  }

  // ── 폼 처리 ───────────────────────────────────────────────────────────────
  function openNewForm() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setCustomerQuery("");
    setShowForm(true);
  }

  function openEditForm(r: SalesRecord) {
    setEditId(r.id);
    setForm({
      sale_date: r.sale_date,
      customer_name: r.customer_name,
      business_no: r.business_no || "",
      category: r.category,
      maker: r.maker || "",
      spec: r.spec || "",
      quantity: String(r.quantity),
      unit_price: String(r.unit_price),
      unit_cost: String(r.unit_cost),
      tax_invoice: r.tax_invoice,
      payment_confirmed: r.payment_confirmed,
      payment_date: r.payment_date || "",
      delivery_date: r.delivery_date || "",
      delivery_confirmed: r.delivery_confirmed,
      wheel_returned: r.wheel_returned,
      closing: r.closing,
      note: r.note || "",
    });
    setCustomerQuery(r.customer_name);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setCustomerQuery("");
  }

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.customer_name) return setError("거래처를 입력해주세요.");
    if (!form.sale_date) return setError("날짜를 입력해주세요.");
    if (!form.quantity || !form.unit_price) return setError("수량과 단가를 입력해주세요.");

    setSaving(true);
    setError(null);

    const payload = {
      sale_date: form.sale_date,
      customer_name: form.customer_name,
      business_no: form.business_no || null,
      category: form.category,
      maker: form.maker || null,
      spec: form.spec || null,
      quantity: parseFloat(form.quantity) || 0,
      unit_price: parseFloat(form.unit_price) || 0,
      unit_cost: parseFloat(form.unit_cost) || 0,
      tax_invoice: form.tax_invoice,
      payment_confirmed: form.payment_confirmed,
      payment_date: form.payment_date || null,
      delivery_date: form.delivery_date || null,
      delivery_confirmed: form.delivery_confirmed,
      wheel_returned: form.wheel_returned,
      closing: form.closing,
      note: form.note || null,
    };

    const { error } =
      editId !== null
        ? await supabase.from("sales_records").update(payload).eq("id", editId)
        : await supabase.from("sales_records").insert(payload);

    if (error) {
      setError(error.message);
    } else {
      closeForm();
      loadRecords();
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("이 매출 건을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("sales_records").delete().eq("id", id);
    if (error) setError(error.message);
    else loadRecords();
  }

  // 빠른 토글 (입금/배송확인)
  async function quickToggle(id: number, field: "payment_confirmed" | "delivery_confirmed" | "wheel_returned" | "closing", current: boolean) {
    const update: Record<string, unknown> = { [field]: !current };
    if (field === "payment_confirmed" && !current) {
      update.payment_date = new Date().toISOString().split("T")[0];
    }
    const { error } = await supabase.from("sales_records").update(update).eq("id", id);
    if (error) setError(error.message);
    else loadRecords();
  }

  // ── 필터링 ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filterCategory !== "전체" && r.category !== filterCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.customer_name.toLowerCase().includes(q) ||
          (r.spec || "").toLowerCase().includes(q) ||
          (r.maker || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, filterCategory, searchQuery]);

  // ── 월 합계 ───────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const revenue = filtered.reduce((s, r) => s + (r.total_revenue || 0), 0);
    const margin = filtered.reduce((s, r) => s + (r.margin || 0), 0);
    const unpaid = filtered.filter((r) => !r.payment_confirmed).reduce((s, r) => s + (r.total_revenue || 0), 0);
    return { revenue, margin, unpaid, count: filtered.length };
  }, [filtered]);

  const preview = calcPreview(form);

  // ── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* 히어로 */}
      <section className="relative bg-[#0a192f] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]" aria-hidden="true"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-orange-400">Sales</p>
              <h1 className="mt-2 text-2xl md:text-3xl font-semibold text-white">매출 관리</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* 연도/월 선택 */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-[40px] rounded-xl border border-white/20 bg-white/10 text-white px-3 text-sm font-medium focus:outline-none focus:border-orange-400"
              >
                {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
                  <option key={y} value={y} className="text-gray-900 bg-white">{y}년</option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="h-[40px] rounded-xl border border-white/20 bg-white/10 text-white px-3 text-sm font-medium focus:outline-none focus:border-orange-400"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1} className="text-gray-900 bg-white">{i + 1}월</option>
                ))}
              </select>
              <button onClick={openNewForm} className={btnPrimary}>
                <Plus className="w-4 h-4" />
                매출 입력
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* 에러 */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* KPI 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "매출 합계", value: formatCurrency(summary.revenue), color: "text-navy-900" },
            { label: "수익 합계", value: formatCurrency(summary.margin), color: "text-emerald-600" },
            { label: "미수금", value: formatCurrency(summary.unpaid), color: summary.unpaid > 0 ? "text-red-600" : "text-gray-400" },
            { label: "건수", value: `${summary.count}건`, color: "text-gray-700" },
          ].map((k) => (
            <div key={k.label} className={`${cardClass} p-4`}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{k.label}</p>
              <p className={`mt-1.5 text-xl font-semibold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* 필터 */}
        <div className={`${cardClass} px-4 py-3 flex flex-wrap gap-3 items-center`}>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="거래처, Maker, 규격 검색"
              className="w-full h-[38px] pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["전체", ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  filterCategory === cat
                    ? "bg-navy-900 text-white border-navy-900"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        {loading ? (
          <div className={`${cardClass} flex items-center justify-center gap-3 py-16 text-gray-400`}>
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span className="text-sm">불러오는 중...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${cardClass} flex flex-col items-center justify-center py-16 text-gray-400`}>
            <PackageCheck className="w-10 h-10 mb-3 text-gray-300" />
            <p className="text-sm font-medium">매출 데이터가 없습니다.</p>
            <button onClick={openNewForm} className={`${btnPrimary} mt-4`}>
              <Plus className="w-4 h-4" /> 첫 매출 입력하기
            </button>
          </div>
        ) : (
          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["날짜", "거래처", "종류", "Maker / 규격", "수량", "매출", "수익", "계산서", "입금", "배송", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.sale_date}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 whitespace-nowrap">{r.customer_name}</p>
                        {r.business_no && <p className="text-xs text-gray-400">{r.business_no}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${CATEGORY_COLORS[r.category] || "bg-gray-100 text-gray-600"}`}>
                          {r.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {[r.maker, r.spec].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 text-right whitespace-nowrap">{r.quantity}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                        {formatCurrency(r.total_revenue || 0)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold text-right whitespace-nowrap ${(r.margin || 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {formatCurrency(r.margin || 0)}
                      </td>
                      {/* 계산서 */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.tax_invoice ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                          {r.tax_invoice ? "완료" : "-"}
                        </span>
                      </td>
                      {/* 입금 */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => quickToggle(r.id, "payment_confirmed", r.payment_confirmed)}
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                            r.payment_confirmed
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-red-100 text-red-600 hover:bg-red-200"
                          }`}
                        >
                          {r.payment_confirmed ? "입금" : "미수"}
                        </button>
                      </td>
                      {/* 배송 */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => quickToggle(r.id, "delivery_confirmed", r.delivery_confirmed)}
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                            r.delivery_confirmed
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                        >
                          {r.delivery_confirmed ? "완료" : "-"}
                        </button>
                      </td>
                      {/* 액션 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditForm(r)}
                            className={`${btnGhost} text-gray-400 hover:text-orange-500 hover:bg-orange-50`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className={`${btnGhost} text-gray-400 hover:text-red-500 hover:bg-red-50`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 입력 폼 모달 ─────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl">

            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editId !== null ? "매출 수정" : "새 매출 입력"}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* 날짜 + 카테고리 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>날짜</label>
                  <input
                    type="date"
                    value={form.sale_date}
                    onChange={(e) => setField("sale_date", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>종류</label>
                  <select
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                    className={inputClass}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 거래처 자동완성 */}
              <div ref={customerRef}>
                <label className={labelClass}>거래처</label>
                <div className="relative">
                  <input
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setField("customer_name", e.target.value);
                      setField("business_no", "");
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="거래처명 또는 사업자번호 검색"
                    className={inputClass}
                  />
                  {showCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCustomer(c)}
                          className="w-full text-left px-4 py-2.5 hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.business_no || "-"}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.business_no && (
                  <p className="mt-1 text-xs text-gray-400">사업자번호: {form.business_no}</p>
                )}
              </div>

              {/* Maker + 규격 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Maker</label>
                  <input
                    value={form.maker}
                    onChange={(e) => setField("maker", e.target.value)}
                    placeholder="예: MAXAM, 금호타이어"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>규격</label>
                  <input
                    value={form.spec}
                    onChange={(e) => setField("spec", e.target.value)}
                    placeholder="예: 815-15, 4.5톤"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* 수량 + 판매단가 + 매입단가 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>수량</label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => setField("quantity", e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>판매단가</label>
                  <input
                    type="number"
                    value={form.unit_price}
                    onChange={(e) => setField("unit_price", e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>매입단가</label>
                  <input
                    type="number"
                    value={form.unit_cost}
                    onChange={(e) => setField("unit_cost", e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* 미리보기 */}
              {(parseFloat(form.quantity) > 0 && parseFloat(form.unit_price) > 0) && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 grid grid-cols-3 gap-3">
                  {[
                    { label: "총매출 (VAT포함)", value: formatCurrency(preview.revenue), color: "text-gray-900" },
                    { label: "총매입 (VAT포함)", value: formatCurrency(preview.totalCost), color: "text-gray-600" },
                    { label: "수익", value: formatCurrency(preview.margin), color: preview.margin >= 0 ? "text-emerald-600" : "text-red-500" },
                  ].map((p) => (
                    <div key={p.label}>
                      <p className="text-[11px] text-gray-400 font-medium">{p.label}</p>
                      <p className={`text-sm font-semibold mt-0.5 ${p.color}`}>{p.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 날짜들 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>배송일자</label>
                  <input
                    type="date"
                    value={form.delivery_date}
                    onChange={(e) => setField("delivery_date", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>입금일자</label>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setField("payment_date", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* 체크박스들 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "tax_invoice" as const,        label: "계산서" },
                  { key: "payment_confirmed" as const,  label: "입금확인" },
                  { key: "delivery_confirmed" as const, label: "배송완료" },
                  { key: "wheel_returned" as const,     label: "휠반납" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setField(key, !form[key])}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        form[key]
                          ? "bg-orange-500 border-orange-500"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      {form[key] && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              {/* 비고 */}
              <div>
                <label className={labelClass}>비고</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setField("note", e.target.value)}
                  placeholder="추가 메모"
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-900 bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none"
                />
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeForm} className={btnSecondary}>취소</button>
              <button onClick={handleSave} disabled={saving} className={btnPrimary}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editId !== null ? "수정 저장" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPage;