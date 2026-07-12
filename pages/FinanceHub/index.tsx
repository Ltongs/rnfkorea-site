import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  Plus, Search, Check, X, Pencil, Trash2, Loader2,
  PackageCheck, AlertCircle, Upload, FileText, Link2,
  ListChecks, FileSpreadsheet, BarChart3,
} from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────────────────────
type SalesRecord = {
  id: number;
  sale_date: string;
  customer_name: string;
  business_no: string | null;
  category: string;
  trade_type: string;
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
  invoice_id: number | null;
  is_confirmed: boolean;
};

type PurchaseRecord = {
  id: number;
  purchase_date: string;
  supplier_name: string;
  business_no: string | null;
  category: string;
  trade_type: string;
  maker: string | null;
  spec: string | null;
  quantity: number;
  unit_price: number;
  total_cost: number;
  tax_invoice: boolean;
  payment_confirmed: boolean;
  payment_date: string | null;
  invoice_id: number | null;
  note: string | null;
  is_confirmed: boolean;
};

type Customer = { id: string; name: string; business_no: string | null; };

// 진흥주문(tb_orders) — 매출건과 연결(sales_record_id)하기 위한 최소 타입
type TbOrder = {
  id: string;
  created_at: string;
  customer_name_raw: string | null;
  product_type: string | null;
  product_spec: string | null;
  quantity: number | null;
  status: string;
  price_to_customer: number | null;
  sales_record_id: number | null;
  delivered_at: string | null;
  invoiced_at: string | null;
  wheel_returned_at: string | null;
};
// AI비서 > 진흥주문 관리 탭과 동일한 방식으로 상태를 계산 — status 컬럼이 아니라
// delivered_at/invoiced_at/wheel_returned_at 날짜 필드 유무 기준 (두 화면 표시가 어긋나지 않도록).
// 종결 조건: 발송(납품완료) + 휠반납 + 매출건 연결 (개별 계산서발행 여부는 더 이상 종결 기준이 아님)
function orderStageLabel(o: TbOrder): string {
  const wheelDone = !!o.wheel_returned_at;
  const invoiced = !!o.invoiced_at || ["invoiced","billed_in","payment_in","payment_out","wheel_returned"].includes(o.status);
  const delivered = !!o.delivered_at || ["delivered","wheel_returned","invoiced","billed_in","payment_in","payment_out"].includes(o.status);
  const closed = delivered && wheelDone && !!o.sales_record_id;
  if (closed) return "종결";
  if (invoiced) return "계산서발행";
  if (delivered) return wheelDone ? "발송(휠반납✓)" : "발송(납품완료)";
  return "접수(진흥전달)";
}

type SalesFormData = {
  sale_date: string; customer_name: string; business_no: string;
  category: string; trade_type: "내수" | "수출"; maker: string; spec: string;
  quantity: string; unit_price: string; unit_cost: string;
  tax_invoice: boolean; payment_confirmed: boolean; payment_date: string;
  delivery_date: string; delivery_confirmed: boolean;
  wheel_returned: boolean; closing: boolean; note: string;
};

type PurchaseFormData = {
  purchase_date: string; supplier_name: string; business_no: string;
  category: string; trade_type: "국내" | "수입"; maker: string; spec: string;
  quantity: string; unit_price: string;
  tax_invoice: boolean; payment_confirmed: boolean; payment_date: string; note: string;
};

type ParsedInvoice = {
  invoice_no?: string | null; sale_date?: string | null;
  customer_name?: string | null; business_no?: string | null;
  supply_amount?: number | null; tax_amount?: number | null;
  total_amount?: number | null; items?: string | null;
};

type InvoiceForm = {
  invoice_no: string; issue_date: string; customer_name: string;
  business_no: string; supply_amount: string; tax_amount: string;
  total_amount: string; items: string;
};

// ── 상수 ─────────────────────────────────────────────────────────────────────
const CATEGORIES = ["타이어", "지게차렌탈", "건설기계수출", "배터리(LFP)", "배터리(납산)", "기타판매", "기타"];

const CAT_COLOR: Record<string, string> = {
  "타이어": "bg-blue-100 text-blue-700",
  "지게차렌탈": "bg-purple-100 text-purple-700",
  "건설기계수출": "bg-amber-100 text-amber-700",
  "배터리(LFP)": "bg-emerald-100 text-emerald-700",
  "배터리(납산)": "bg-teal-100 text-teal-700",
  "기타판매": "bg-indigo-100 text-indigo-700",
  "기타": "bg-gray-100 text-gray-600",
};

const PERIODS = ["월간", "분기", "반기", "연간"] as const;
type Period = typeof PERIODS[number];

const EMPTY_SALES_FORM: SalesFormData = {
  sale_date: todayLocalStr(), customer_name: "", business_no: "",
  category: "타이어", trade_type: "내수", maker: "", spec: "",
  quantity: "", unit_price: "", unit_cost: "",
  tax_invoice: false, payment_confirmed: false, payment_date: "",
  delivery_date: "", delivery_confirmed: false, wheel_returned: false, closing: false, note: "",
};

const EMPTY_PURCHASE_FORM: PurchaseFormData = {
  purchase_date: todayLocalStr(), supplier_name: "", business_no: "",
  category: "기타", trade_type: "국내", maker: "", spec: "",
  quantity: "1", unit_price: "",
  tax_invoice: true, payment_confirmed: false, payment_date: "", note: "",
};

const EMPTY_INVOICE_FORM: InvoiceForm = {
  invoice_no: "", issue_date: todayLocalStr(),
  customer_name: "", business_no: "", supply_amount: "", tax_amount: "", total_amount: "", items: "",
};

// ── 유틸 ─────────────────────────────────────────────────────────────────────
const fmt = (v: number) => `${Math.round(v || 0).toLocaleString("ko-KR")}원`;
const fmtAbs = (v: number) => `${Math.round(Math.abs(v || 0)).toLocaleString("ko-KR")}원`;

// 품목명/규격에서 카테고리 자동 추론
function guessCategory(spec: string): string {
  const s = spec.toLowerCase();
  if (/타이어|tyre|tire|솔리드|우레탄|튜브|휠|림/.test(s)) return "타이어";
  if (/배터리|battery|lfp|리튬|납산|agm|충전기/.test(s)) {
    if (/납산|agm/.test(s)) return "배터리(납산)";
    return "배터리(LFP)";
  }
  if (/지게차|forklift|리프트|마스트|포크/.test(s)) return "지게차렌탈";
  if (/굴삭기|굴착기|excavator|크레인|건설기계|덤프|로더/.test(s)) return "건설기계수출";
  if (/렌탈|리스|임대|월사용료|월납|관리비|수수료/.test(s)) return "기타판매";
  return "기타";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1] || "");
    r.onerror = () => rej(new Error("파일 읽기 실패"));
    r.readAsDataURL(file);
  });
}

// supabase.functions.invoke()가 던지는 에러는 기본적으로 "Edge Function returned a non-2xx status code"처럼
// 뭉뚱그려진 메시지만 담고 있고, 실제 원인(Edge Function 내부에서 던진 상세 에러 텍스트)은
// err.context(Response 객체)의 본문에 들어있음. 여기서 그 본문을 꺼내서 보여준다.
async function extractFnErrorMessage(err: any): Promise<string> {
  try {
    if (err?.context && typeof err.context.text === "function") {
      const bodyText = await err.context.text();
      try {
        const parsed = JSON.parse(bodyText);
        return parsed?.error || parsed?.message || bodyText || err.message || "알 수 없는 오류";
      } catch {
        return bodyText || err.message || "알 수 없는 오류";
      }
    }
  } catch { /* 무시하고 아래 기본 메시지로 폴백 */ }
  return err?.message || "알 수 없는 오류";
}

// 브라우저 로컬 시간 기준 오늘 날짜 (YYYY-MM-DD). new Date().toISOString()은 UTC 변환 과정에서
// 한국 시간 새벽 0~8시대에 하루 전 날짜로 잘못 나오는 문제가 있어 로컬 컴포넌트로 직접 조립함.
function todayLocalStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getDateRange(year: number, month: number, period: Period) {
  const pad = (n: number) => String(n).padStart(2, "0");
  // new Date(y, m, 0).getDate()는 로컬 시간 기준으로 구성/조회하므로 시간대 변환이 개입되지 않아 안전함.
  // (기존에 .toISOString()을 쓰면 로컬→UTC 변환 과정에서 날짜가 하루 밀리는 문제가 있었음 — KST 기준 매달 말일 매출/매입이 누락되던 원인)
  const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
  if (period === "월간") {
    const from = `${year}-${pad(month)}-01`;
    const to = `${year}-${pad(month)}-${pad(lastDay(year, month))}`;
    return { from, to };
  }
  if (period === "분기") {
    const q = Math.ceil(month / 3);
    const fm = (q - 1) * 3 + 1;
    const tm = q * 3;
    return { from: `${year}-${pad(fm)}-01`, to: `${year}-${pad(tm)}-${pad(lastDay(year, tm))}` };
  }
  if (period === "반기") {
    const h = month <= 6 ? 1 : 2;
    const fm = h === 1 ? 1 : 7;
    const tm = h === 1 ? 6 : 12;
    return { from: `${year}-${pad(fm)}-01`, to: `${year}-${pad(tm)}-${pad(lastDay(year, tm))}` };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

// ── 스타일 ───────────────────────────────────────────────────────────────────
const card = "border border-gray-200 rounded-2xl bg-white shadow-sm";
const inp = "w-full h-[44px] rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-900 bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all";
const inpSm = "w-full h-[38px] rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-900 bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all";
const lbl = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide";
const btnPrimary = "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50";
const btnSecondary = "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors";
const btnHero = "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors";

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────
const FinanceHubPage: React.FC = () => {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [period, setPeriod] = useState<Period>("월간");
  const [activeTab, setActiveTab] = useState<"sales" | "purchases" | "incomplete">("sales");
  const [filterCategory, setFilterCategory] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");

  // 데이터
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [allSales, setAllSales] = useState<SalesRecord[]>([]);
  const [allPurchases, setAllPurchases] = useState<PurchaseRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 미완성 건 보완 탭
  const [incompleteSales, setIncompleteSales] = useState<SalesRecord[]>([]);
  const [incompletePurchases, setIncompletePurchases] = useState<PurchaseRecord[]>([]);
  const [loadingIncomplete, setLoadingIncomplete] = useState(false);
  // 인라인 편집: { id, table, field, value }
  const [inlineEdits, setInlineEdits] = useState<Record<string, string>>({});

  // 매출 폼
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [salesEditId, setSalesEditId] = useState<number | null>(null);
  const [salesForm, setSalesForm] = useState<SalesFormData>(EMPTY_SALES_FORM);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustDrop, setShowCustDrop] = useState(false);
  const custRef = useRef<HTMLDivElement>(null);
  const [savingSales, setSavingSales] = useState(false);

  // 매입 폼
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseEditId, setPurchaseEditId] = useState<number | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormData>(EMPTY_PURCHASE_FORM);
  const [savingPurchase, setSavingPurchase] = useState(false);

  // 계산서 업로드 (매출)
  const salesInvRef = useRef<HTMLInputElement>(null);
  const [parsingSalesInv, setParsingSalesInv] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [invForm, setInvForm] = useState<InvoiceForm>(EMPTY_INVOICE_FORM);
  const [matchCandidates, setMatchCandidates] = useState<SalesRecord[]>([]);
  const [matchSearch, setMatchSearch] = useState("");
  const [matchSelectedIds, setMatchSelectedIds] = useState<Set<number>>(new Set());
  const [matchSaving, setMatchSaving] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // 매입 계산서 업로드
  const purchInvRef = useRef<HTMLInputElement>(null);
  const [parsingPurchInv, setParsingPurchInv] = useState(false);

  // 진흥주문(tb_orders) 연결
  const [showOrderLinkModal, setShowOrderLinkModal] = useState(false);
  const [orderLinkTarget, setOrderLinkTarget] = useState<SalesRecord | null>(null);
  const [orderCandidates, setOrderCandidates] = useState<TbOrder[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSelectedIds, setOrderSelectedIds] = useState<Set<string>>(new Set());
  const [loadingOrderCandidates, setLoadingOrderCandidates] = useState(false);
  const [orderLinkSaving, setOrderLinkSaving] = useState(false);
  const [linkedOrdersBySales, setLinkedOrdersBySales] = useState<Record<number, TbOrder[]>>({});

  // 엑셀 일괄등록 (매출/매입 자동 구분)
  const excelRef = useRef<HTMLInputElement>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number; errors: string[]; type?: string } | null>(null);

  // 미분류(기타) 전체 보기 모드
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [uncatSales, setUncatSales] = useState<SalesRecord[]>([]);
  const [uncatPurchases, setUncatPurchases] = useState<PurchaseRecord[]>([]);
  const [loadingUncat, setLoadingUncat] = useState(false);

  // 인라인 종류 편집
  const [editingCategoryId, setEditingCategoryId] = useState<{ id: number; table: "sales" | "purchases" } | null>(null);

  // 상세 보기 모달
  const [detailSales, setDetailSales] = useState<SalesRecord | null>(null);
  const [detailPurchase, setDetailPurchase] = useState<PurchaseRecord | null>(null);

  // ── 데이터 로드 ───────────────────────────────────────────────────────────
  const { from, to } = useMemo(() => getDateRange(year, month, period), [year, month, period]);

  // 초기 진입 시 가장 최근 매출 월로 자동 이동
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sales_records")
        .select("sale_date")
        .order("sale_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.sale_date) {
        const d = new Date(data.sale_date);
        setYear(d.getFullYear());
        setMonth(d.getMonth() + 1);
      }
    })();
    loadCustomers();
    loadIncomplete();
  }, []);

  useEffect(() => { loadAll(); }, [from, to]);
  useEffect(() => { if (showUncategorized) loadUncategorized(); }, [year]);

  async function loadAll() {
    setLoading(true); setError(null);
    const [s, p, sa, pa] = await Promise.all([
      supabase.from("sales_records").select("*").gte("sale_date", from).lte("sale_date", to).order("sale_date", { ascending: false }),
      supabase.from("purchase_records").select("*").gte("purchase_date", from).lte("purchase_date", to).order("purchase_date", { ascending: false }),
      supabase.from("sales_records").select("*").order("sale_date", { ascending: false }),
      supabase.from("purchase_records").select("*").order("purchase_date", { ascending: false }),
    ]);
    if (s.error) setError(s.error.message);
    else setSales((s.data || []) as SalesRecord[]);
    if (p.error) setError(p.error.message);
    else setPurchases((p.data || []) as PurchaseRecord[]);
    setAllSales((sa.data || []) as SalesRecord[]);
    setAllPurchases((pa.data || []) as PurchaseRecord[]);
    setLoading(false);
    const salesIds = (s.data || []).map((r: any) => r.id);
    if (salesIds.length > 0) void loadLinkedOrders(salesIds);
    else setLinkedOrdersBySales({});
  }

  // 진흥주문(tb_orders) 연결 현황 일괄 조회 — 화면에 보이는 매출건들에 이미 연결된 주문을 배지로 보여주기 위함
  async function loadLinkedOrders(salesIds: number[]) {
    const { data, error } = await supabase.from("tb_orders").select("*").in("sales_record_id", salesIds);
    if (error) return; // 조용히 실패 — tb_orders.sales_record_id 컬럼이 아직 없으면 여기서 에러가 날 수 있음
    const grouped: Record<number, TbOrder[]> = {};
    for (const o of (data || []) as TbOrder[]) {
      if (o.sales_record_id == null) continue;
      (grouped[o.sales_record_id] ||= []).push(o);
    }
    setLinkedOrdersBySales(grouped);
  }

  // 진흥주문 연결 모달 열기 — 거래처명으로 우선 검색
  function openOrderLink(rec: SalesRecord) {
    setOrderLinkTarget(rec);
    const cleanName = (rec.customer_name || "").replace(/^\(유\)|^\(주\)|^\(재\)|^\(사\)/g, "").trim();
    setOrderSearch(cleanName);
    setOrderSelectedIds(new Set((linkedOrdersBySales[rec.id] || []).map(o => o.id)));
    setShowOrderLinkModal(true);
    void loadOrderCandidates(cleanName);
  }

  async function loadOrderCandidates(q: string) {
    setLoadingOrderCandidates(true);
    const cleanQ = q.trim().replace(/^\(유\)|^\(주\)|^\(재\)|^\(사\)/g, "").trim();
    let query = supabase.from("tb_orders").select("*").order("created_at", { ascending: false }).limit(100);
    if (cleanQ) query = query.ilike("customer_name_raw", `%${cleanQ}%`);
    const { data, error } = await query;
    if (error) setError(error.message);
    setOrderCandidates((data || []) as TbOrder[]);
    setLoadingOrderCandidates(false);
  }

  // 체크된 주문은 이 매출건에 연결, 체크 해제된(이전에 연결돼 있던) 주문은 연결 해제
  async function confirmOrderLink() {
    if (!orderLinkTarget) return;
    setOrderLinkSaving(true); setError(null);
    const toLink = Array.from(orderSelectedIds);
    const previouslyLinked = orderCandidates.filter(o => o.sales_record_id === orderLinkTarget.id).map(o => o.id);
    const toUnlink = previouslyLinked.filter(id => !orderSelectedIds.has(id));

    if (toLink.length > 0) {
      const { error: linkErr } = await supabase.from("tb_orders").update({ sales_record_id: orderLinkTarget.id }).in("id", toLink);
      if (linkErr) { setError(linkErr.message); setOrderLinkSaving(false); return; }
    }
    if (toUnlink.length > 0) {
      await supabase.from("tb_orders").update({ sales_record_id: null }).in("id", toUnlink);
    }
    setShowOrderLinkModal(false); setOrderLinkTarget(null); setOrderSelectedIds(new Set());
    setOrderLinkSaving(false);
    loadAll();
  }

  // 미완성 건: is_confirmed=false인 건만 (category=기타이고 미확정)
  async function loadIncomplete() {
    setLoadingIncomplete(true);
    const [s, p] = await Promise.all([
      supabase.from("sales_records").select("*")
        .eq("category", "기타")
        .eq("is_confirmed", false)
        .order("sale_date", { ascending: false }),
      supabase.from("purchase_records").select("*")
        .eq("category", "기타")
        .eq("is_confirmed", false)
        .order("purchase_date", { ascending: false }),
    ]);
    setIncompleteSales((s.data || []) as SalesRecord[]);
    setIncompletePurchases((p.data || []) as PurchaseRecord[]);
    setLoadingIncomplete(false);
  }

  // 인라인 편집 값 변경
  function setInlineEdit(id: number, table: string, field: string, value: string) {
    setInlineEdits(prev => ({ ...prev, [`${table}-${id}-${field}`]: value }));
  }
  function getInlineEdit(id: number, table: string, field: string, fallback: string) {
    return inlineEdits[`${table}-${id}-${field}`] ?? fallback;
  }

  // 인라인 편집 저장 (매출) — 종류/Maker/규격 수정 + 확정 처리
  async function saveInlineSales(r: SalesRecord) {
    const category = getInlineEdit(r.id, "sales", "category", r.category);
    const maker = getInlineEdit(r.id, "sales", "maker", r.maker || "");
    const spec = getInlineEdit(r.id, "sales", "spec", r.spec || "");
    await supabase.from("sales_records").update({
      category,
      maker: maker || null,
      spec: spec || null,
      is_confirmed: true,
    }).eq("id", r.id);
    setInlineEdits(prev => {
      const next = { ...prev };
      delete next[`sales-${r.id}-category`];
      delete next[`sales-${r.id}-maker`];
      delete next[`sales-${r.id}-spec`];
      return next;
    });
    loadIncomplete();
    loadAll();
  }

  // 인라인 편집 저장 (매입) — 종류/규격 수정 + 확정 처리
  async function saveInlinePurchase(r: PurchaseRecord) {
    const category = getInlineEdit(r.id, "purchases", "category", r.category);
    const spec = getInlineEdit(r.id, "purchases", "spec", r.spec || "");
    await supabase.from("purchase_records").update({
      category,
      spec: spec || null,
      is_confirmed: true,
    }).eq("id", r.id);
    setInlineEdits(prev => {
      const next = { ...prev };
      delete next[`purchases-${r.id}-category`];
      delete next[`purchases-${r.id}-spec`];
      return next;
    });
    loadIncomplete();
    loadAll();
  }

  async function loadCustomers() {
    const { data } = await supabase.from("customers").select("id,name,business_no").eq("is_active", true).order("name");
    setCustomers((data || []) as Customer[]);
  }

  // 미분류(기타) 전체 건 로드 — 선택 연도 기준, 기간 무관
  async function loadUncategorized() {
    setLoadingUncat(true);
    const fromYear = `${year}-01-01`;
    const toYear = `${year}-12-31`;
    const [s, p] = await Promise.all([
      supabase.from("sales_records").select("*")
        .eq("category", "기타")
        .gte("sale_date", fromYear)
        .lte("sale_date", toYear)
        .order("sale_date", { ascending: false }),
      supabase.from("purchase_records").select("*")
        .eq("category", "기타")
        .gte("purchase_date", fromYear)
        .lte("purchase_date", toYear)
        .order("purchase_date", { ascending: false }),
    ]);
    setUncatSales((s.data || []) as SalesRecord[]);
    setUncatPurchases((p.data || []) as PurchaseRecord[]);
    setLoadingUncat(false);
  }

  function toggleUncategorized() {
    if (!showUncategorized) loadUncategorized();
    setShowUncategorized(v => !v);
  }

  // 인라인 종류 변경
  async function updateCategory(id: number, table: "sales" | "purchases", newCategory: string) {
    const tableName = table === "sales" ? "sales_records" : "purchase_records";
    await supabase.from(tableName).update({ category: newCategory }).eq("id", id);
    setEditingCategoryId(null);
    // 현재 보기 모드에 따라 갱신
    if (showUncategorized) loadUncategorized();
    else loadAll();
  }

  // ── KPI 계산 ──────────────────────────────────────────────────────────────
  // "매출" 공식 정의 = 세금계산서 발행 기준(tax_invoice=true). 실적관리/대시보드/주간리뷰와 통일.
  // 목록(sales/filteredSales)은 미발행분도 계속 그대로 보여줘야 하므로(관리용 원장이라 숨기면 안 됨)
  // 이 useMemo 안에서만 발행분으로 좁혀 KPI 헤더 숫자를 계산한다.
  const kpi = useMemo(() => {
    const invoicedSales = sales.filter(r => r.tax_invoice);
    const totalRevenue = invoicedSales.reduce((s, r) => s + (r.total_revenue || 0), 0);
    const totalCost = purchases.reduce((s, r) => s + (r.total_cost || 0), 0);
    const totalMargin = invoicedSales.reduce((s, r) => s + (r.margin || 0), 0);
    const netProfit = totalRevenue - totalCost;
    const unpaidSales = invoicedSales.filter(r => !r.payment_confirmed).reduce((s, r) => s + (r.total_revenue || 0), 0);
    const unpaidPurch = purchases.filter(r => !r.payment_confirmed).reduce((s, r) => s + (r.total_cost || 0), 0);
    const profitRate = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalCost, totalMargin, netProfit, unpaidSales, unpaidPurch, profitRate };
  }, [sales, purchases]);

  // ── 필터링 ────────────────────────────────────────────────────────────────
  // 미분류 모드일 때는 uncategorized 데이터, 아닐 때는 기간 필터된 데이터
  const displaySales = showUncategorized ? uncatSales : sales;
  const displayPurchases = showUncategorized ? uncatPurchases : purchases;

  const filteredSales = useMemo(() => {
    const base = searchQuery ? allSales : displaySales;
    return base.filter(r => {
      if (filterCategory !== "전체" && r.category !== filterCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return r.customer_name.toLowerCase().includes(q) || (r.spec || "").toLowerCase().includes(q) || (r.maker || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [displaySales, allSales, filterCategory, searchQuery]);

  const filteredPurchases = useMemo(() => {
    const base = searchQuery ? allPurchases : displayPurchases;
    return base.filter(r => {
      if (filterCategory !== "전체" && r.category !== filterCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return r.supplier_name.toLowerCase().includes(q) || (r.spec || "").toLowerCase().includes(q) || (r.maker || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [displayPurchases, allPurchases, filterCategory, searchQuery]);

  // ── 거래처 자동완성 ───────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    if (!customerQuery) return customers;
    const q = customerQuery.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.business_no || "").includes(q));
  }, [customers, customerQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setShowCustDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── 매출 CRUD ─────────────────────────────────────────────────────────────
  function openNewSales() {
    setSalesEditId(null); setSalesForm(EMPTY_SALES_FORM); setCustomerQuery(""); setShowSalesForm(true);
  }
  function openEditSales(r: SalesRecord) {
    setSalesEditId(r.id);
    setSalesForm({
      sale_date: r.sale_date, customer_name: r.customer_name, business_no: r.business_no || "",
      category: r.category, trade_type: r.trade_type === "수출" ? "수출" : "내수",
      maker: r.maker || "", spec: r.spec || "",
      quantity: String(r.quantity), unit_price: String(r.unit_price), unit_cost: String(r.unit_cost),
      tax_invoice: r.tax_invoice, payment_confirmed: r.payment_confirmed, payment_date: r.payment_date || "",
      delivery_date: r.delivery_date || "", delivery_confirmed: r.delivery_confirmed,
      wheel_returned: r.wheel_returned, closing: r.closing, note: r.note || "",
    });
    setCustomerQuery(r.customer_name); setShowSalesForm(true);
  }
  async function saveSales() {
    if (!salesForm.customer_name || !salesForm.quantity || !salesForm.unit_price) { setError("거래처, 수량, 단가를 입력해주세요."); return; }
    setSavingSales(true); setError(null);
    const qty = parseFloat(salesForm.quantity) || 0;
    const price = parseFloat(salesForm.unit_price) || 0;
    const cost = parseFloat(salesForm.unit_cost) || 0;
    const vat = salesForm.trade_type === "수출" ? 1 : 1.1;
    const payload = {
      sale_date: salesForm.sale_date, customer_name: salesForm.customer_name,
      business_no: salesForm.business_no || null, category: salesForm.category,
      trade_type: salesForm.trade_type, maker: salesForm.maker || null, spec: salesForm.spec || null,
      quantity: qty, unit_price: price, unit_cost: cost,
      total_revenue: qty * price * vat, total_cost: qty * cost * vat,
      margin: qty * (price - cost) * vat,
      tax_invoice: salesForm.tax_invoice, payment_confirmed: salesForm.payment_confirmed,
      payment_date: salesForm.payment_date || null, delivery_date: salesForm.delivery_date || null,
      delivery_confirmed: salesForm.delivery_confirmed, wheel_returned: salesForm.wheel_returned,
      closing: salesForm.closing, note: salesForm.note || null,
    };
    const { error } = salesEditId !== null
      ? await supabase.from("sales_records").update(payload).eq("id", salesEditId)
      : await supabase.from("sales_records").insert(payload);
    if (error) setError(error.message);
    else { setShowSalesForm(false); loadAll(); }
    setSavingSales(false);
  }
  async function deleteSales(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("sales_records").delete().eq("id", id); loadAll();
  }
  async function quickToggleSales(id: number, field: string, current: boolean) {
    const upd: Record<string, unknown> = { [field]: !current };
    if (field === "payment_confirmed" && !current) upd.payment_date = todayLocalStr();
    await supabase.from("sales_records").update(upd).eq("id", id); loadAll();
  }

  // ── 매입 CRUD ─────────────────────────────────────────────────────────────
  function openEditPurchase(r: PurchaseRecord) {
    setPurchaseEditId(r.id);
    setPurchaseForm({
      purchase_date: r.purchase_date, supplier_name: r.supplier_name, business_no: r.business_no || "",
      category: r.category, trade_type: r.trade_type === "수입" ? "수입" : "국내",
      maker: r.maker || "", spec: r.spec || "",
      quantity: String(r.quantity), unit_price: String(r.unit_price),
      tax_invoice: r.tax_invoice, payment_confirmed: r.payment_confirmed,
      payment_date: r.payment_date || "", note: r.note || "",
    });
    setShowPurchaseForm(true);
  }
  async function savePurchase() {
    if (!purchaseForm.supplier_name || !purchaseForm.unit_price) { setError("매입처와 단가를 입력해주세요."); return; }
    setSavingPurchase(true); setError(null);
    const payload = {
      purchase_date: purchaseForm.purchase_date, supplier_name: purchaseForm.supplier_name,
      business_no: purchaseForm.business_no || null, category: purchaseForm.category,
      trade_type: purchaseForm.trade_type, maker: purchaseForm.maker || null, spec: purchaseForm.spec || null,
      quantity: parseFloat(purchaseForm.quantity) || 0, unit_price: parseFloat(purchaseForm.unit_price) || 0,
      tax_invoice: purchaseForm.tax_invoice, payment_confirmed: purchaseForm.payment_confirmed,
      payment_date: purchaseForm.payment_date || null, note: purchaseForm.note || null,
    };
    const { error } = purchaseEditId !== null
      ? await supabase.from("purchase_records").update(payload).eq("id", purchaseEditId)
      : await supabase.from("purchase_records").insert(payload);
    if (error) setError(error.message);
    else { setShowPurchaseForm(false); loadAll(); }
    setSavingPurchase(false);
  }
  async function deletePurchase(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("purchase_records").delete().eq("id", id); loadAll();
  }
  async function quickTogglePurchase(id: number, current: boolean) {
    const upd: Record<string, unknown> = { payment_confirmed: !current };
    if (!current) upd.payment_date = todayLocalStr();
    await supabase.from("purchase_records").update(upd).eq("id", id); loadAll();
  }

  // ── 매출 계산서 업로드 → 매칭 모달 ──────────────────────────────────────
  async function handleSalesInvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setParsingSalesInv(true); setError(null);
    try {
      const base64 = await fileToBase64(file);
      const { data, error: fnErr } = await supabase.functions.invoke("parse-tax-invoice", {
        body: { image_base64: base64, media_type: file.type || "image/png", direction: "sales" },
      });
      if (fnErr) throw fnErr;
      const parsed = (data || {}) as ParsedInvoice;
      setInvForm({
        invoice_no: parsed.invoice_no ? String(parsed.invoice_no) : "",
        issue_date: parsed.sale_date || EMPTY_INVOICE_FORM.issue_date,
        customer_name: parsed.customer_name || "",
        business_no: parsed.business_no ? String(parsed.business_no).replace(/[^0-9]/g, "") : "",
        supply_amount: parsed.supply_amount != null ? String(Math.round(parsed.supply_amount)) : "",
        tax_amount: parsed.tax_amount != null ? String(Math.round(parsed.tax_amount)) : "",
        total_amount: parsed.total_amount != null ? String(Math.round(parsed.total_amount)) : "",
        items: parsed.items || "",
      });
      const cleanName = (parsed.customer_name || "").replace(/^\(유\)|^\(주\)|^\(재\)|^\(사\)/g, "").trim();
      setMatchSelectedIds(new Set()); setMatchSearch(cleanName);
      setShowMatchModal(true); loadMatchCandidates(cleanName);
    } catch (err: any) { const msg = await extractFnErrorMessage(err); setError("계산서 인식 실패: " + msg); }
    finally { setParsingSalesInv(false); if (salesInvRef.current) salesInvRef.current.value = ""; }
  }

  async function loadMatchCandidates(q: string) {
    setLoadingCandidates(true);
    // (유), (주) 등 법인 접두어 제거한 핵심 키워드로 검색
    const cleanQ = q.trim().replace(/^\(유\)|^\(주\)|^\(재\)|^\(사\)/g, "").trim();
    let query = supabase.from("sales_records").select("*").order("sale_date", { ascending: false }).limit(100);
    if (cleanQ) query = query.ilike("customer_name", `%${cleanQ}%`);
    const { data } = await query;
    setMatchCandidates((data || []) as SalesRecord[]);
    setLoadingCandidates(false);
  }

  const matchSelectedSum = useMemo(() =>
    matchCandidates.filter(c => matchSelectedIds.has(c.id)).reduce((s, c) => s + (c.total_revenue || 0), 0),
    [matchCandidates, matchSelectedIds]);
  const matchTotal = parseFloat(invForm.total_amount) || 0;
  const matchIsClose = Math.abs(matchTotal - matchSelectedSum) < 1;

  async function confirmMatch() {
    if (matchSelectedIds.size === 0) { setError("매칭할 매출건을 선택해주세요."); return; }
    setMatchSaving(true); setError(null);
    const { data: invRow, error: invErr } = await supabase.from("tax_invoices").insert({
      direction: "sales", invoice_no: invForm.invoice_no || null,
      issue_date: invForm.issue_date || null, customer_name: invForm.customer_name || null,
      business_no: invForm.business_no || null,
      supply_amount: invForm.supply_amount ? parseFloat(invForm.supply_amount) : null,
      tax_amount: invForm.tax_amount ? parseFloat(invForm.tax_amount) : null,
      total_amount: invForm.total_amount ? parseFloat(invForm.total_amount) : null,
      items: invForm.items || null, matched_total: matchSelectedSum,
    }).select().single();
    if (invErr || !invRow) { setError(invErr?.message || "계산서 등록 실패"); setMatchSaving(false); return; }

    // ── 계산서 금액을 sales_records에 반영 ──────────────────────
    const invoiceSupply = invForm.supply_amount ? parseFloat(invForm.supply_amount) : null;
    const selectedRecords = matchCandidates.filter(c => matchSelectedIds.has(c.id));

    if (invoiceSupply != null && invoiceSupply > 0 && selectedRecords.length > 0) {
      if (selectedRecords.length === 1) {
        // 1건: 계산서 공급가액을 그대로 반영 (unit_price 역산)
        const rec = selectedRecords[0];
        const newUnitPrice = rec.quantity > 0 ? Math.round(invoiceSupply / rec.quantity) : rec.unit_price;
        await supabase.from("sales_records")
          .update({ unit_price: newUnitPrice, tax_invoice: true, invoice_id: invRow.id })
          .eq("id", rec.id);
      } else {
        // 복수건: 기존 비율대로 계산서 금액 배분
        // 마지막 건은 반올림하지 않고 "계산서 총액 - 지금까지 배분한 합"으로 역산해서
        // 배분금액 합이 정확히 계산서 총액과 일치하게 함 (원 단위 반올림 오차 누적 방지 — 마지막 건이 오차 흡수)
        const totalExisting = selectedRecords.reduce((s, r) => s + (r.total_revenue || 0), 0);
        let allocatedSoFar = 0;
        for (let i = 0; i < selectedRecords.length; i++) {
          const rec = selectedRecords[i];
          const isLast = i === selectedRecords.length - 1;
          const ratio = totalExisting > 0 ? (rec.total_revenue || 0) / totalExisting : 1 / selectedRecords.length;
          const allocSupply = isLast ? (invoiceSupply - allocatedSoFar) : Math.round(invoiceSupply * ratio);
          allocatedSoFar += allocSupply;
          const newUnitPrice = rec.quantity > 0 ? Math.round(allocSupply / rec.quantity) : rec.unit_price;
          await supabase.from("sales_records")
            .update({ unit_price: newUnitPrice, tax_invoice: true, invoice_id: invRow.id })
            .eq("id", rec.id);
        }
      }
    } else {
      // 금액 없으면 매칭 표시만
      await supabase.from("sales_records")
        .update({ tax_invoice: true, invoice_id: invRow.id })
        .in("id", Array.from(matchSelectedIds));
    }

    setShowMatchModal(false); setInvForm(EMPTY_INVOICE_FORM); setMatchSelectedIds(new Set());
    loadAll(); setMatchSaving(false);
  }

  // ── 매입 계산서 이미지 업로드 ──────────────────────────────────────────────
  async function handlePurchInvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setParsingPurchInv(true); setError(null);
    try {
      const base64 = await fileToBase64(file);
      const { data, error: fnErr } = await supabase.functions.invoke("parse-tax-invoice", {
        body: { image_base64: base64, media_type: file.type || "image/png", direction: "purchase" },
      });
      if (fnErr) throw fnErr;
      const parsed = (data || {}) as ParsedInvoice;
      if (!parsed.customer_name && !parsed.total_amount) throw new Error("인식 실패. 더 선명한 이미지로 다시 시도해주세요.");
      const tradeType: "국내" | "수입" = (parsed.tax_amount ?? null) === 0 ? "수입" : "국내";
      const { data: invRow, error: invErr } = await supabase.from("tax_invoices").insert({
        direction: "purchase", invoice_no: parsed.invoice_no || null,
        issue_date: parsed.sale_date || todayLocalStr(),
        customer_name: parsed.customer_name || null,
        business_no: parsed.business_no ? String(parsed.business_no).replace(/[^0-9]/g, "") : null,
        supply_amount: parsed.supply_amount ?? null, tax_amount: parsed.tax_amount ?? null,
        total_amount: parsed.total_amount ?? null, items: parsed.items || null,
      }).select().single();
      if (invErr || !invRow) throw new Error(invErr?.message || "계산서 등록 실패");
      const { data: newRec } = await supabase.from("purchase_records").insert({
        purchase_date: parsed.sale_date || todayLocalStr(),
        supplier_name: parsed.customer_name || "거래처 미입력",
        business_no: parsed.business_no ? String(parsed.business_no).replace(/[^0-9]/g, "") : null,
        category: guessCategory(parsed.items || ""),
        trade_type: tradeType, maker: null, spec: parsed.items || null,
        quantity: 1, unit_price: Math.round(parsed.supply_amount ?? 0),
        tax_invoice: true, payment_confirmed: false, payment_date: null,
        invoice_id: invRow.id,
        note: `계산서 업로드 자동등록${parsed.invoice_no ? ` (#${parsed.invoice_no})` : ""} — 수량 확인 필요`,
      }).select().single();
      await loadAll();
      if (newRec) { setActiveTab("purchases"); openEditPurchase(newRec as PurchaseRecord); }
    } catch (err: any) { const msg = await extractFnErrorMessage(err); setError("계산서 인식/등록 실패: " + msg); }
    finally { setParsingPurchInv(false); if (purchInvRef.current) purchInvRef.current.value = ""; }
  }

  // ── 홈택스 엑셀 일괄등록 (매출/매입 자동 구분) ──────────────────────────
  // 파일 내 "매출 전자..." / "매입 전자..." 텍스트로 방향 자동 감지
  // 매출: 공급받는자(col 11) = 거래처, 공급자(col 6) = 알앤에프코리아
  // 매입: 공급자(col 6) = 매입처, 공급받는자(col 11) = 알앤에프코리아
  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImportingExcel(true); setImportResult(null); setError(null);
    try {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm" as any);
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      // 매출/매입 자동 감지
      const fullText = rows.slice(0, 6).map(r => r.join(" ")).join(" ");
      const isSales = fullText.includes("매출 전자");
      const direction = isSales ? "sales" : "purchase";

      // 헤더 행 탐지
      let headerRow = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        if (String(rows[i][0]).includes("작성일자")) { headerRow = i; break; }
      }
      if (headerRow === -1) throw new Error("홈택스 전자세금계산서 목록 형식이 아닙니다.");

      const dataRows = rows.slice(headerRow + 1).filter(r => r[0] && String(r[0]).trim() !== "");
      let success = 0, skipped = 0;
      const errors: string[] = [];

      for (const r of dataRows) {
        try {
          const invoice_no = String(r[1] || "").trim();
          const issue_date = r[0] instanceof Date
            ? r[0].toISOString().split("T")[0]
            : String(r[0]).trim().slice(0, 10);

          // 매출: 거래처 = col11, 사업자번호 = col9
          // 매입: 거래처(공급자) = col6, 사업자번호 = col4
          const counterpart_name = isSales ? String(r[11] || "").trim() : String(r[6] || "").trim();
          const counterpart_biz = isSales
            ? String(r[9] || "").replace(/[^0-9]/g, "")
            : String(r[4] || "").replace(/[^0-9]/g, "");

          const total_amount = parseFloat(String(r[14]).replace(/[^0-9,.-]/g, "").replace(/,/g, "")) || 0;
          const supply_amount = parseFloat(String(r[15]).replace(/[^0-9,.-]/g, "").replace(/,/g, "")) || 0;
          const tax_amount = parseFloat(String(r[16]).replace(/[^0-9,.-]/g, "").replace(/,/g, "")) || 0;
          const invoiceType = String(r[18] || "").trim();
          const isAmendment = supply_amount < 0 || invoiceType.includes("수정");
          const itemName = String(r[26] || "").trim();
          const itemSpec = String(r[27] || "").trim();
          const itemQty = parseFloat(String(r[28] || "1").replace(/[^0-9.-]/g, "")) || 1;
          const itemUnitPrice = parseFloat(String(r[29] || "0").replace(/[^0-9,.-]/g, "").replace(/,/g, "")) || 0;
          const spec = [itemName, itemSpec].filter(Boolean).join(" / ");

          if (!counterpart_name || !issue_date) { skipped++; continue; }

          // 승인번호 중복 체크
          if (invoice_no) {
            const { data: existing } = await supabase
              .from("tax_invoices").select("id")
              .eq("invoice_no", invoice_no).eq("direction", direction).maybeSingle();
            if (existing) { skipped++; continue; }
          }

          // tax_invoices 등록
          const { data: invRow, error: invErr } = await supabase
            .from("tax_invoices").insert({
              direction,
              invoice_no: invoice_no || null,
              issue_date,
              customer_name: counterpart_name,
              business_no: counterpart_biz || null,
              supply_amount, tax_amount, total_amount,
              items: spec || null,
            }).select().single();
          if (invErr || !invRow) throw new Error(invErr?.message || "계산서 저장 실패");

          if (isSales) {
            // 매출 등록
            const trade_type = Math.abs(tax_amount) === 0 ? "수출" : "내수";
            const vat = trade_type === "수출" ? 1 : 1.1;
            const unit_price = Math.round(Math.abs(itemUnitPrice || supply_amount));
            const qty = Math.abs(itemQty);
            const category = guessCategory(spec);
            const { error: recErr } = await supabase.from("sales_records").insert({
              sale_date: issue_date,
              customer_name: counterpart_name,
              business_no: counterpart_biz || null,
              category, trade_type,
              maker: null, spec: spec || null,
              quantity: qty, unit_price, unit_cost: 0,
              total_revenue: qty * unit_price * vat, total_cost: 0,
              margin: qty * unit_price * vat,
              tax_invoice: true, payment_confirmed: false,
              payment_date: null, delivery_date: null,
              delivery_confirmed: false, wheel_returned: false, closing: false,
              invoice_id: invRow.id,
              note: `엑셀 일괄등록${isAmendment ? " [수정세금계산서]" : ""}${invoice_no ? ` (#${invoice_no})` : ""}${category === "기타" ? " — 종류 확인 필요" : ""}`,
            });
            if (recErr) throw new Error(recErr.message);
          } else {
            // 매입 등록
            const trade_type: "국내" | "수입" = Math.abs(tax_amount) === 0 ? "수입" : "국내";
            const category = guessCategory(spec);
            const { error: recErr } = await supabase.from("purchase_records").insert({
              purchase_date: issue_date,
              supplier_name: counterpart_name,
              business_no: counterpart_biz || null,
              category, trade_type,
              maker: null, spec: spec || null,
              quantity: 1, unit_price: Math.round(supply_amount),
              tax_invoice: true, payment_confirmed: false,
              payment_date: null, invoice_id: invRow.id,
              note: `엑셀 일괄등록${isAmendment ? " [수정세금계산서]" : ""}${invoice_no ? ` (#${invoice_no})` : ""}${category === "기타" ? " — 종류 확인 필요" : ""}`,
            });
            if (recErr) throw new Error(recErr.message);
          }
          success++;
        } catch (rowErr: any) {
          errors.push(`${r[isSales ? 11 : 6] || r[0]}: ${rowErr.message}`);
        }
      }

      setImportResult({ success, skipped, errors, type: isSales ? "매출" : "매입" });
      await loadAll();
      if (isSales) setActiveTab("sales"); else setActiveTab("purchases");
    } catch (err: any) { setError("엑셀 처리 실패: " + (err?.message || "")); }
    finally { setImportingExcel(false); if (excelRef.current) excelRef.current.value = ""; }
  }

  // ── 기간 레이블 ───────────────────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    if (period === "월간") return `${year}년 ${month}월`;
    if (period === "분기") return `${year}년 ${Math.ceil(month / 3)}분기`;
    if (period === "반기") return `${year}년 ${month <= 6 ? "상반기" : "하반기"}`;
    return `${year}년`;
  }, [year, month, period]);

  // ── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* 히어로 */}
      <section className="relative bg-[#0a192f] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)", backgroundSize: "24px 24px" }} />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-orange-400">Finance</p>
              <h1 className="mt-1 text-2xl md:text-3xl font-semibold text-white">매출 / 매입 관리</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => navigate("/work/weekly-review")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-400/50 bg-orange-500/10 text-orange-300 text-xs font-semibold hover:bg-orange-500/20 transition-colors">
                <BarChart3 className="w-4 h-4" /> 주간 리뷰
              </button>
              <button onClick={() => navigate("/rental-os")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors">
                🚐 Rental_O/S
              </button>
              {/* 기간 선택 */}
              <div className="flex rounded-xl overflow-hidden border border-white/20">
                {PERIODS.map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-2 text-xs font-semibold transition-colors ${period === p ? "bg-orange-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}>
                    {p}
                  </button>
                ))}
              </div>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="h-[38px] rounded-xl border border-white/20 bg-white/10 text-white px-3 text-sm focus:outline-none">
                {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y =>
                  <option key={y} value={y} className="text-gray-900 bg-white">{y}년</option>)}
              </select>
              {period === "월간" && (
                <select value={month} onChange={e => setMonth(Number(e.target.value))}
                  className="h-[38px] rounded-xl border border-white/20 bg-white/10 text-white px-3 text-sm focus:outline-none">
                  {Array.from({ length: 12 }).map((_, i) =>
                    <option key={i + 1} value={i + 1} className="text-gray-900 bg-white">{i + 1}월</option>)}
                </select>
              )}
              {period === "분기" && (
                <select value={Math.ceil(month / 3)} onChange={e => setMonth((Number(e.target.value) - 1) * 3 + 1)}
                  className="h-[38px] rounded-xl border border-white/20 bg-white/10 text-white px-3 text-sm focus:outline-none">
                  {[1,2,3,4].map(q => <option key={q} value={q} className="text-gray-900 bg-white">{q}분기</option>)}
                </select>
              )}
              {period === "반기" && (
                <select value={month <= 6 ? 1 : 7} onChange={e => setMonth(Number(e.target.value))}
                  className="h-[38px] rounded-xl border border-white/20 bg-white/10 text-white px-3 text-sm focus:outline-none">
                  <option value={1} className="text-gray-900 bg-white">상반기</option>
                  <option value={7} className="text-gray-900 bg-white">하반기</option>
                </select>
              )}
            </div>
          </div>

          {/* KPI 수치 */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "매출", value: fmt(kpi.totalRevenue), color: "text-white" },
              { label: "매입", value: fmt(kpi.totalCost), color: "text-white" },
              { label: "손익 (매출-매입)", value: fmt(kpi.netProfit), color: kpi.netProfit >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "매출이익 (내부)", value: fmt(kpi.totalMargin), color: "text-sky-300" },
              { label: "이익률", value: `${kpi.profitRate.toFixed(1)}%`, color: kpi.profitRate >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "미수금 / 미지급", value: `${Math.round(kpi.unpaidSales / 10000)}만 / ${Math.round(kpi.unpaidPurch / 10000)}만`, color: "text-amber-300" },
            ].map(k => (
              <div key={k.label} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">{k.label}</p>
                <p className={`mt-1 text-base font-semibold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/30">{periodLabel} 기준 · 매출/이익은 세금계산서 발행분만 집계 (아래 목록은 미발행분 포함 전체)</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-4">

        {/* 에러 */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* 엑셀 등록 결과 */}
        {importResult && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between gap-3">
            <span>✅ {importResult.type || ""} 엑셀 일괄등록 완료 — <strong>{importResult.success}건 신규</strong>{importResult.skipped > 0 && `, ${importResult.skipped}건 중복건너뜀`}{importResult.errors.length > 0 && `, ${importResult.errors.length}건 오류`} — 종류를 확인해주세요</span>
            <button onClick={() => setImportResult(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* 탭 + 버튼 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["sales", "purchases", "incomplete"] as const).map(tab => (
                <button key={tab} onClick={() => {
                  setActiveTab(tab);
                  setFilterCategory("전체");
                  setSearchQuery("");
                  setShowUncategorized(false);
                  if (tab === "incomplete") loadIncomplete();
                }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {tab === "sales" ? `매출 (${sales.length}건)`
                    : tab === "purchases" ? `매입 (${purchases.length}건)`
                    : <span className={`flex items-center gap-1 ${(incompleteSales.length + incompletePurchases.length) > 0 ? "text-amber-600" : ""}`}>
                        ⚠ 보완필요 ({incompleteSales.length + incompletePurchases.length}건)
                      </span>
                  }
                </button>
              ))}
            </div>
            {/* 미분류 보기 토글 */}
            <button
              onClick={toggleUncategorized}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                showUncategorized
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-amber-600 border-amber-300 hover:bg-amber-50"
              }`}
            >
              {loadingUncat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {showUncategorized ? "▶ 기간별 보기로 돌아가기" : `⚠ ${year}년 미분류(기타) 전체 보기`}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* 엑셀 일괄등록 — 탭 무관, 매출/매입 자동 구분 */}
            <input ref={excelRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleExcelImport} />
            <button onClick={() => excelRef.current?.click()} disabled={importingExcel} className={btnHero}>
              {importingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {importingExcel ? "처리 중..." : "엑셀 일괄등록"}
            </button>

            {activeTab === "sales" ? (
              <>
                <input ref={salesInvRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={handleSalesInvFile} />
                <button onClick={() => salesInvRef.current?.click()} disabled={parsingSalesInv} className={btnHero}>
                  {parsingSalesInv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {parsingSalesInv ? "인식 중..." : "계산서 업로드"}
                </button>
                <button onClick={openNewSales} className={btnPrimary}>
                  <Plus className="w-4 h-4" /> 매출 입력
                </button>
              </>
            ) : (
              <>
                <input ref={purchInvRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={handlePurchInvFile} />
                <button onClick={() => purchInvRef.current?.click()} disabled={parsingPurchInv} className={btnHero}>
                  {parsingPurchInv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {parsingPurchInv ? "인식 중..." : "계산서 업로드"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 필터 */}
        <div className={`${card} px-4 py-3 flex flex-wrap gap-3 items-center`}>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={activeTab === "sales" ? "거래처, Maker, 규격 검색 (전 기간)" : "매입처, Maker, 규격 검색 (전 기간)"}
              className="w-full h-[38px] pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
            {searchQuery && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-orange-500 font-medium whitespace-nowrap">전 기간</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {["전체", ...CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filterCategory === cat ? "bg-[#0a192f] text-white border-[#0a192f]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── 매출 목록 ─────────────────────────────────────────────────────── */}
        {activeTab === "sales" && (
          loading ? <LoadingBox /> : filteredSales.length === 0 ? <EmptyBox msg="매출 데이터가 없습니다." /> : (
            <div className={`${card} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {["날짜", "거래처", "종류", "구분", "Maker / 규격", "수량", "매출", "이익", "계산서", "입금", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredSales.map(r => (
                      <React.Fragment key={r.id}>
                      <tr className={`transition-colors cursor-pointer ${detailSales?.id === r.id ? "bg-orange-50" : "hover:bg-orange-50/40"}`} onClick={() => setDetailSales(prev => prev?.id === r.id ? null : r)}>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.sale_date}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 whitespace-nowrap">{r.customer_name}</p>
                          {r.business_no && <p className="text-xs text-gray-400">{r.business_no}</p>}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {editingCategoryId?.id === r.id && editingCategoryId?.table === "sales" ? (
                            <select
                              autoFocus
                              defaultValue={r.category}
                              onChange={e => updateCategory(r.id, "sales", e.target.value)}
                              onBlur={() => setEditingCategoryId(null)}
                              className="h-[30px] rounded-lg border border-orange-400 px-2 text-xs font-medium bg-white focus:outline-none"
                            >
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingCategoryId({ id: r.id, table: "sales" })}
                              title="클릭하여 종류 변경"
                              className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap hover:ring-2 hover:ring-orange-300 transition-all ${CAT_COLOR[r.category] || "bg-gray-100 text-gray-600"}`}
                            >
                              {r.category}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${r.trade_type === "수출" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500"}`}>{r.trade_type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{[r.maker, r.spec].filter(Boolean).join(" / ") || "-"}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 text-right whitespace-nowrap">{r.quantity}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">{fmt(r.total_revenue || 0)}</td>
                        <td className={`px-4 py-3 text-sm font-semibold text-right whitespace-nowrap ${(r.margin || 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(r.margin || 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${r.tax_invoice ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                            {r.invoice_id && <Link2 className="w-3 h-3" />}{r.tax_invoice ? "완료" : "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button onClick={() => quickToggleSales(r.id, "payment_confirmed", r.payment_confirmed)}
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${r.payment_confirmed ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-100 text-red-600 hover:bg-red-200"}`}>
                            {r.payment_confirmed ? "입금" : "미수"}
                          </button>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditSales(r)} className={`${btnGhost} text-gray-400 hover:text-orange-500 hover:bg-orange-50`}><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteSales(r.id)} className={`${btnGhost} text-gray-400 hover:text-red-500 hover:bg-red-50`}><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                      {detailSales?.id === r.id && (
                        <tr>
                          <td colSpan={11} className="px-4 pb-3 pt-0 bg-orange-50">
                            <div className="rounded-xl border border-orange-100 bg-white shadow-sm p-4">
                              <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                                {/* 품목 */}
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">Maker / 규격</p>
                                  <p className="font-semibold text-gray-800">{[r.maker, r.spec].filter(Boolean).join(" / ") || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">수량</p>
                                  <p className="font-semibold text-gray-800">{r.quantity}개</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">판매단가</p>
                                  <p className="font-semibold text-gray-900">{fmt(r.unit_price || 0)}</p>
                                </div>
                                {/* 구분선 */}
                                <div className="w-full border-t border-dashed border-gray-200 my-0.5"/>
                                {/* 공급가액 / 부가세 / 합계 */}
                                {(() => {
                                  const isExport = r.trade_type === "수출";
                                  const supply = Math.round(r.total_revenue || 0);
                                  const vat = isExport ? 0 : Math.round(supply * 0.1);
                                  const total = supply + vat;
                                  return (<>
                                    <div>
                                      <p className="text-[11px] text-gray-400 mb-0.5">공급가액</p>
                                      <p className="font-semibold text-gray-900">{fmt(supply)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] text-gray-400 mb-0.5">부가세 {isExport ? "(영세율)" : "(10%)"}</p>
                                      <p className="font-semibold text-gray-500">{fmt(vat)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] text-orange-400 mb-0.5">합계금액 (VAT 포함)</p>
                                      <p className="font-bold text-orange-600 text-base">{fmt(total)}</p>
                                    </div>
                                  </>);
                                })()}
                                {/* 상태 */}
                                <div className="w-full border-t border-dashed border-gray-200 my-0.5"/>
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">계산서</p>
                                  <div className="flex items-center gap-1.5">
                                    <p className={`font-semibold text-xs ${r.tax_invoice ? "text-emerald-600" : "text-gray-400"}`}>{r.tax_invoice ? "✅ 발행완료" : "미발행"}</p>
                                    {r.invoice_id && (
                                      <button
                                        onClick={async () => {
                                          if (!confirm("계산서 매칭을 해제하고 금액을 0으로 초기화하시겠습니까?")) return;
                                          await supabase.from("sales_records")
                                            .update({ tax_invoice: false, invoice_id: null, unit_price: 0 })
                                            .eq("id", r.id);
                                          loadAll();
                                        }}
                                        className="text-[10px] px-1.5 py-0.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-all"
                                      >
                                        해제
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">진흥주문 연결</p>
                                  <div className="flex items-center gap-1.5">
                                    {(linkedOrdersBySales[r.id]?.length ?? 0) > 0 ? (
                                      <p className="font-semibold text-xs text-blue-600">🔗 {linkedOrdersBySales[r.id].length}건 연결됨</p>
                                    ) : (
                                      <p className="font-semibold text-xs text-gray-400">연결 안 됨</p>
                                    )}
                                    <button
                                      onClick={() => openOrderLink(r)}
                                      className="text-[10px] px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 border border-blue-200 transition-all"
                                    >
                                      연결관리
                                    </button>
                                  </div>
                                  {(linkedOrdersBySales[r.id]?.length ?? 0) > 0 && (
                                    <p className="text-[10px] text-gray-400 mt-1 max-w-[220px]">
                                      {linkedOrdersBySales[r.id].map(o => o.customer_name_raw).filter((v,i,a)=>a.indexOf(v)===i).join(", ")}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">납품일</p>
                                  <p className={`font-semibold text-xs ${r.delivery_confirmed ? "text-emerald-600" : "text-gray-400"}`}>{r.delivery_confirmed ? `✅ ${r.delivery_date || "납품완료"}` : r.delivery_date || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">입금일</p>
                                  <p className={`font-semibold text-xs ${r.payment_confirmed ? "text-emerald-600" : "text-red-500"}`}>{r.payment_confirmed ? `✅ ${r.payment_date || "입금완료"}` : "미수"}</p>
                                </div>
                                {r.note && (
                                  <div className="w-full">
                                    <p className="text-[11px] text-gray-400 mb-0.5">비고</p>
                                    <p className="text-sm text-gray-600">{r.note}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                                <button onClick={e => { e.stopPropagation(); openEditSales(r); setDetailSales(null); }} className={btnPrimary}><Pencil className="w-3.5 h-3.5" />수정</button>
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

        {/* ── 매입 목록 ─────────────────────────────────────────────────────── */}
        {activeTab === "purchases" && (
          loading ? <LoadingBox /> : filteredPurchases.length === 0 ? <EmptyBox msg="매입 데이터가 없습니다." /> : (
            <div className={`${card} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {["날짜", "매입처", "종류", "구분", "Maker / 규격", "수량", "매입액", "계산서", "지급", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredPurchases.map(r => (
                      <React.Fragment key={r.id}>
                      <tr className={`transition-colors cursor-pointer ${detailPurchase?.id === r.id ? "bg-blue-50" : "hover:bg-orange-50/40"}`} onClick={() => setDetailPurchase(prev => prev?.id === r.id ? null : r)}>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.purchase_date}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 whitespace-nowrap">{r.supplier_name}</p>
                          {r.business_no && <p className="text-xs text-gray-400">{r.business_no}</p>}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {editingCategoryId?.id === r.id && editingCategoryId?.table === "purchases" ? (
                            <select
                              autoFocus
                              defaultValue={r.category}
                              onChange={e => updateCategory(r.id, "purchases", e.target.value)}
                              onBlur={() => setEditingCategoryId(null)}
                              className="h-[30px] rounded-lg border border-orange-400 px-2 text-xs font-medium bg-white focus:outline-none"
                            >
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingCategoryId({ id: r.id, table: "purchases" })}
                              title="클릭하여 종류 변경"
                              className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap hover:ring-2 hover:ring-orange-300 transition-all ${CAT_COLOR[r.category] || "bg-gray-100 text-gray-600"}`}
                            >
                              {r.category}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${r.trade_type === "수입" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500"}`}>{r.trade_type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{[r.maker, r.spec].filter(Boolean).join(" / ") || "-"}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 text-right whitespace-nowrap">{r.quantity}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`text-sm font-semibold ${(r.total_cost || 0) < 0 ? "text-red-500" : "text-gray-900"}`}>
                            {(r.total_cost || 0) < 0 && "▼ "}{fmtAbs(r.total_cost || 0)}
                          </span>
                          {(r.total_cost || 0) < 0 && <span className="ml-1 text-[10px] font-medium text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">수정</span>}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.tax_invoice ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>{r.tax_invoice ? "완료" : "-"}</span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button onClick={() => quickTogglePurchase(r.id, r.payment_confirmed)}
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${r.payment_confirmed ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-100 text-red-600 hover:bg-red-200"}`}>
                            {r.payment_confirmed ? "지급" : "미납"}
                          </button>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditPurchase(r)} className={`${btnGhost} text-gray-400 hover:text-orange-500 hover:bg-orange-50`}><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deletePurchase(r.id)} className={`${btnGhost} text-gray-400 hover:text-red-500 hover:bg-red-50`}><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                      {detailPurchase?.id === r.id && (
                        <tr>
                          <td colSpan={10} className="px-4 pb-3 pt-0 bg-blue-50">
                            <div className="rounded-xl border border-blue-100 bg-white shadow-sm p-4">
                              <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                                {/* 품목 */}
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">Maker / 규격</p>
                                  <p className="font-semibold text-gray-800">{[r.maker, r.spec].filter(Boolean).join(" / ") || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">수량</p>
                                  <p className="font-semibold text-gray-800">{r.quantity}개</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">매입단가</p>
                                  <p className="font-semibold text-gray-900">{fmt(r.unit_price || 0)}</p>
                                </div>
                                {/* 구분선 */}
                                <div className="w-full border-t border-dashed border-gray-200 my-0.5"/>
                                {/* 공급가액 / 부가세 / 합계 */}
                                {(() => {
                                  const isImport = r.trade_type === "수입";
                                  const supply = Math.round(Math.abs(r.total_cost || 0));
                                  const vat = isImport ? 0 : Math.round(supply * 0.1);
                                  const total = supply + vat;
                                  return (<>
                                    <div>
                                      <p className="text-[11px] text-gray-400 mb-0.5">공급가액</p>
                                      <p className="font-semibold text-gray-900">{fmt(supply)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] text-gray-400 mb-0.5">부가세 {isImport ? "(영세율)" : "(10%)"}</p>
                                      <p className="font-semibold text-gray-500">{fmt(vat)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] text-blue-400 mb-0.5">합계금액 (VAT 포함)</p>
                                      <p className="font-bold text-blue-700 text-base">{fmt(total)}</p>
                                    </div>
                                  </>);
                                })()}
                                {/* 상태 */}
                                <div className="w-full border-t border-dashed border-gray-200 my-0.5"/>
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">계산서</p>
                                  <p className={`font-semibold text-xs ${r.tax_invoice ? "text-emerald-600" : "text-gray-400"}`}>{r.tax_invoice ? "✅ 수취완료" : "미수취"}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-gray-400 mb-0.5">지급일</p>
                                  <p className={`font-semibold text-xs ${r.payment_confirmed ? "text-emerald-600" : "text-red-500"}`}>{r.payment_confirmed ? `✅ ${r.payment_date || "지급완료"}` : "미납"}</p>
                                </div>
                                {r.note && (
                                  <div className="w-full">
                                    <p className="text-[11px] text-gray-400 mb-0.5">비고</p>
                                    <p className="text-sm text-gray-600">{r.note}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                                <button onClick={e => { e.stopPropagation(); openEditPurchase(r); setDetailPurchase(null); }} className={btnPrimary}><Pencil className="w-3.5 h-3.5" />수정</button>
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

        {/* ── 보완필요 탭 ──────────────────────────────────────────────────────── */}
        {activeTab === "incomplete" && (
          loadingIncomplete ? <LoadingBox /> : (incompleteSales.length + incompletePurchases.length) === 0 ? (
            <div className={`${card} flex flex-col items-center justify-center py-16 text-gray-400`}>
              <PackageCheck className="w-10 h-10 mb-3 text-emerald-300" />
              <p className="text-sm font-medium">보완이 필요한 건이 없습니다 🎉</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 매출 미완성 건 — 거래처별 그룹 */}
              {incompleteSales.length > 0 && (() => {
                // 거래처별 그룹핑
                const groups: Record<string, SalesRecord[]> = {};
                incompleteSales.forEach(r => {
                  const key = r.customer_name;
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(r);
                });

                const bulkSaveGroup = async (customerName: string, records: SalesRecord[]) => {
                  const firstId = records[0].id;
                  const category = getInlineEdit(firstId, "sales", "category", records[0].category);
                  const maker = getInlineEdit(firstId, "sales", "maker", records[0].maker || "");
                  await Promise.all(records.map(r =>
                    supabase.from("sales_records").update({
                      category,
                      maker: maker || null,
                      is_confirmed: true,
                    }).eq("id", r.id)
                  ));
                  setInlineEdits(prev => {
                    const next = { ...prev };
                    records.forEach(r => {
                      delete next[`sales-${r.id}-category`];
                      delete next[`sales-${r.id}-maker`];
                    });
                    return next;
                  });
                  loadIncomplete();
                  loadAll();
                };

                return (
                  <div className={`${card} overflow-hidden`}>
                    <div className="px-4 py-3 border-b border-gray-100 bg-amber-50">
                      <p className="text-sm font-semibold text-amber-700">
                        매출 확인 필요 ({incompleteSales.length}건, {Object.keys(groups).length}개 거래처) — 거래처별 종류 선택 후 일괄 저장
                      </p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {Object.entries(groups).map(([customerName, records]) => {
                        const firstId = records[0].id;
                        const currentCategory = getInlineEdit(firstId, "sales", "category", records[0].category);
                        const currentMaker = getInlineEdit(firstId, "sales", "maker", records[0].maker || "");
                        const totalAmt = records.reduce((s, r) => s + (r.total_revenue || 0), 0);
                        return (
                          <div key={customerName} className="px-4 py-3 hover:bg-amber-50/20 transition-colors">
                            <div className="flex flex-wrap items-center gap-3">
                              {/* 거래처 + 건수 */}
                              <div className="min-w-[160px]">
                                <p className="text-sm font-semibold text-gray-900">{customerName}</p>
                                <p className="text-xs text-gray-400">{records.length}건 · {fmt(totalAmt)}</p>
                              </div>
                              {/* 종류 — 그룹 전체에 적용 */}
                              <select
                                value={currentCategory}
                                onChange={e => {
                                  // 그룹 내 모든 건의 편집값을 동일하게 설정
                                  records.forEach(r => setInlineEdit(r.id, "sales", "category", e.target.value));
                                }}
                                className="h-8 rounded-lg border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400 w-32"
                              >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              {/* Maker */}
                              <input
                                value={currentMaker}
                                onChange={e => records.forEach(r => setInlineEdit(r.id, "sales", "maker", e.target.value))}
                                placeholder="Maker (선택)"
                                className="h-8 rounded-lg border border-gray-200 px-2 text-xs bg-white focus:outline-none focus:border-orange-400 w-28"
                              />
                              {/* 날짜 범위 표시 */}
                              <span className="text-xs text-gray-400">
                                {records[records.length - 1].sale_date} ~ {records[0].sale_date}
                              </span>
                              {/* 일괄 저장 버튼 */}
                              <button
                                onClick={() => bulkSaveGroup(customerName, records)}
                                className="ml-auto px-4 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors whitespace-nowrap"
                              >
                                {records.length}건 일괄 저장
                              </button>
                            </div>
                            {/* 해당 거래처 건 목록 (축약) */}
                            <div className="mt-2 ml-2 space-y-0.5">
                              {records.map(r => (
                                <div key={r.id} className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="w-20 shrink-0">{r.sale_date}</span>
                                  <span className="truncate flex-1">{r.spec || "-"}</span>
                                  <span className="shrink-0 font-medium text-gray-700">{fmt(r.total_revenue || 0)}</span>
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

              {/* 매입 미완성 건 — 거래처별 그룹 */}
              {incompletePurchases.length > 0 && (() => {
                const groups: Record<string, PurchaseRecord[]> = {};
                incompletePurchases.forEach(r => {
                  if (!groups[r.supplier_name]) groups[r.supplier_name] = [];
                  groups[r.supplier_name].push(r);
                });

                const bulkSavePurchaseGroup = async (records: PurchaseRecord[]) => {
                  const firstId = records[0].id;
                  const category = getInlineEdit(firstId, "purchases", "category", records[0].category);
                  await Promise.all(records.map(r =>
                    supabase.from("purchase_records").update({ category, is_confirmed: true }).eq("id", r.id)
                  ));
                  setInlineEdits(prev => {
                    const next = { ...prev };
                    records.forEach(r => { delete next[`purchases-${r.id}-category`]; });
                    return next;
                  });
                  loadIncomplete();
                  loadAll();
                };

                return (
                  <div className={`${card} overflow-hidden`}>
                    <div className="px-4 py-3 border-b border-gray-100 bg-blue-50">
                      <p className="text-sm font-semibold text-blue-700">
                        매입 확인 필요 ({incompletePurchases.length}건, {Object.keys(groups).length}개 매입처) — 거래처별 종류 선택 후 일괄 저장
                      </p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {Object.entries(groups).map(([supplierName, records]) => {
                        const firstId = records[0].id;
                        const currentCategory = getInlineEdit(firstId, "purchases", "category", records[0].category);
                        const totalAmt = records.reduce((s, r) => s + Math.abs(r.total_cost || 0), 0);
                        return (
                          <div key={supplierName} className={`px-4 py-3 transition-colors ${records.some(r => (r.total_cost || 0) < 0) ? "bg-red-50/20" : "hover:bg-blue-50/20"}`}>
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="min-w-[160px]">
                                <p className="text-sm font-semibold text-gray-900">{supplierName}</p>
                                <p className="text-xs text-gray-400">{records.length}건 · {fmt(totalAmt)}</p>
                              </div>
                              <select
                                value={currentCategory}
                                onChange={e => records.forEach(r => setInlineEdit(r.id, "purchases", "category", e.target.value))}
                                className="h-8 rounded-lg border border-amber-300 px-2 text-xs bg-white focus:outline-none focus:border-orange-400 w-32"
                              >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <span className="text-xs text-gray-400">
                                {records[records.length - 1].purchase_date} ~ {records[0].purchase_date}
                              </span>
                              <button
                                onClick={() => bulkSavePurchaseGroup(records)}
                                className="ml-auto px-4 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors whitespace-nowrap"
                              >
                                {records.length}건 일괄 저장
                              </button>
                            </div>
                            <div className="mt-2 ml-2 space-y-0.5">
                              {records.map(r => (
                                <div key={r.id} className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="w-20 shrink-0">{r.purchase_date}</span>
                                  <span className="truncate flex-1">{r.spec || "-"}</span>
                                  <span className={`shrink-0 font-medium ${(r.total_cost || 0) < 0 ? "text-red-500" : "text-gray-700"}`}>
                                    {(r.total_cost || 0) < 0 && "▼ "}{fmtAbs(r.total_cost || 0)}
                                    {(r.total_cost || 0) < 0 && <span className="ml-1 text-[10px] text-red-400 bg-red-50 px-1 py-0.5 rounded-full">수정</span>}
                                  </span>
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
      </div>
      {showSalesForm && (
        <Modal title={salesEditId ? "매출 수정" : "새 매출 입력"} onClose={() => setShowSalesForm(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>날짜</label><input type="date" value={salesForm.sale_date} onChange={e => setSalesForm(f => ({ ...f, sale_date: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>종류</label>
                <select value={salesForm.category} onChange={e => setSalesForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className={lbl}>거래구분</label>
                <select value={salesForm.trade_type} onChange={e => setSalesForm(f => ({ ...f, trade_type: e.target.value as "내수" | "수출" }))} className={inp}>
                  <option value="내수">내수 (VAT 10%)</option><option value="수출">수출 (영세율)</option>
                </select>
              </div>
            </div>
            <div ref={custRef}>
              <label className={lbl}>거래처</label>
              <div className="relative">
                <input value={customerQuery} onChange={e => { setCustomerQuery(e.target.value); setSalesForm(f => ({ ...f, customer_name: e.target.value, business_no: "" })); setShowCustDrop(true); }}
                  onFocus={() => setShowCustDrop(true)} placeholder="거래처명 또는 사업자번호" className={inp} />
                {showCustDrop && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button key={c.id} type="button" onClick={() => { setSalesForm(f => ({ ...f, customer_name: c.name, business_no: c.business_no || "" })); setCustomerQuery(c.name); setShowCustDrop(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-orange-50 border-b border-gray-50 last:border-0">
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.business_no || "-"}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {salesForm.business_no && <p className="mt-1 text-xs text-gray-400">사업자번호: {salesForm.business_no}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Maker</label><input value={salesForm.maker} onChange={e => setSalesForm(f => ({ ...f, maker: e.target.value }))} placeholder="예: MAXAM" className={inp} /></div>
              <div><label className={lbl}>규격</label><input value={salesForm.spec} onChange={e => setSalesForm(f => ({ ...f, spec: e.target.value }))} placeholder="예: 815-15" className={inp} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>수량</label><input type="number" value={salesForm.quantity} onChange={e => setSalesForm(f => ({ ...f, quantity: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>판매단가</label><input type="number" value={salesForm.unit_price} onChange={e => setSalesForm(f => ({ ...f, unit_price: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>매입단가</label><input type="number" value={salesForm.unit_cost} onChange={e => setSalesForm(f => ({ ...f, unit_cost: e.target.value }))} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>입금일자</label><input type="date" value={salesForm.payment_date} onChange={e => setSalesForm(f => ({ ...f, payment_date: e.target.value }))} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([["tax_invoice","계산서"],["payment_confirmed","입금확인"]] as [keyof SalesFormData, string][]).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setSalesForm(f => ({ ...f, [k]: !f[k] }))}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${salesForm[k] ? "bg-orange-500 border-orange-500" : "bg-white border-gray-300"}`}>
                    {salesForm[k] && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            <div><label className={lbl}>비고</label><textarea value={salesForm.note} onChange={e => setSalesForm(f => ({ ...f, note: e.target.value }))} rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-orange-400 resize-none" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setShowSalesForm(false)} className={btnSecondary}>취소</button>
            <button onClick={saveSales} disabled={savingSales} className={btnPrimary}>
              {savingSales ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {salesEditId ? "수정 저장" : "저장"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── 매입 수정 모달 ────────────────────────────────────────────────────── */}
      {showPurchaseForm && (
        <Modal title="매입 정보 확인/수정" onClose={() => setShowPurchaseForm(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>종류</label>
                <select value={purchaseForm.category} onChange={e => setPurchaseForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className={lbl}>거래구분</label>
                <select value={purchaseForm.trade_type} onChange={e => setPurchaseForm(f => ({ ...f, trade_type: e.target.value as "국내" | "수입" }))} className={inp}>
                  <option value="국내">국내 (VAT 10%)</option><option value="수입">수입 (영세율)</option>
                </select>
              </div>
            </div>
            <div><label className={lbl}>매입처</label>
              <input value={purchaseForm.supplier_name} onChange={e => setPurchaseForm(f => ({ ...f, supplier_name: e.target.value }))} className={inp} />
              {purchaseForm.business_no && <p className="mt-1 text-xs text-gray-400">사업자번호: {purchaseForm.business_no}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Maker</label><input value={purchaseForm.maker} onChange={e => setPurchaseForm(f => ({ ...f, maker: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>규격</label><input value={purchaseForm.spec} onChange={e => setPurchaseForm(f => ({ ...f, spec: e.target.value }))} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>수량</label><input type="number" value={purchaseForm.quantity} onChange={e => setPurchaseForm(f => ({ ...f, quantity: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>매입단가 (VAT 제외)</label><input type="number" value={purchaseForm.unit_price} onChange={e => setPurchaseForm(f => ({ ...f, unit_price: e.target.value }))} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>발행일자</label><input type="date" value={purchaseForm.purchase_date} onChange={e => setPurchaseForm(f => ({ ...f, purchase_date: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>지급일자</label><input type="date" value={purchaseForm.payment_date} onChange={e => setPurchaseForm(f => ({ ...f, payment_date: e.target.value }))} className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([["tax_invoice","계산서 수취"],["payment_confirmed","지급완료"]] as [keyof PurchaseFormData, string][]).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setPurchaseForm(f => ({ ...f, [k]: !f[k] }))}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${purchaseForm[k] ? "bg-orange-500 border-orange-500" : "bg-white border-gray-300"}`}>
                    {purchaseForm[k] && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            <div><label className={lbl}>비고</label><textarea value={purchaseForm.note} onChange={e => setPurchaseForm(f => ({ ...f, note: e.target.value }))} rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-orange-400 resize-none" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setShowPurchaseForm(false)} className={btnSecondary}>취소</button>
            <button onClick={savePurchase} disabled={savingPurchase} className={btnPrimary}>
              {savingPurchase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}저장
            </button>
          </div>
        </Modal>
      )}

      {/* ── 매출 계산서 매칭 모달 ────────────────────────────────────────────── */}
      {showMatchModal && (
        <Modal title="계산서 매칭" onClose={() => setShowMatchModal(false)} wide>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />계산서 정보</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "작성일자", key: "issue_date" as const, type: "date" },
                  { label: "계산서번호", key: "invoice_no" as const, type: "text" },
                  { label: "거래처명", key: "customer_name" as const, type: "text" },
                  { label: "사업자번호", key: "business_no" as const, type: "text" },
                  { label: "공급가액", key: "supply_amount" as const, type: "number" },
                  { label: "합계금액", key: "total_amount" as const, type: "number" },
                ].map(f => (
                  <div key={f.key}><label className={lbl}>{f.label}</label>
                    <input type={f.type} value={invForm[f.key]} onChange={e => setInvForm(p => ({ ...p, [f.key]: e.target.value }))} className={inpSm} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={matchSearch} onChange={e => setMatchSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && loadMatchCandidates(matchSearch)}
                  placeholder="거래처명으로 미매칭 매출건 검색" className="w-full h-[38px] pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <button onClick={() => loadMatchCandidates(matchSearch)} className={btnSecondary}><Search className="w-4 h-4" />검색</button>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-gray-50">
              {loadingCandidates ? (
                <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin text-orange-500 mr-2" />불러오는 중...</div>
              ) : matchCandidates.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">미매칭 매출건이 없습니다.</div>
              ) : matchCandidates.map(c => {
                const checked = matchSelectedIds.has(c.id);
                const alreadyMatched = c.invoice_id != null;
                return (
                  <label key={c.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? "bg-orange-50" : alreadyMatched ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <div onClick={e => { e.preventDefault(); setMatchSelectedIds(prev => { const n = new Set(prev); checked ? n.delete(c.id) : n.add(c.id); return n; }); }}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "bg-orange-500 border-orange-500" : "bg-white border-gray-300"}`}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-xs text-gray-400 w-20 shrink-0">{c.sale_date}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${CAT_COLOR[c.category] || "bg-gray-100 text-gray-600"}`}>{c.category}</span>
                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{c.customer_name}</span>
                    <span className="text-xs text-gray-500 truncate flex-1">{[c.maker, c.spec].filter(Boolean).join(" / ") || "-"}</span>
                    {alreadyMatched && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium shrink-0">재매칭</span>}
                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{fmt(c.total_revenue || 0)}</span>
                  </label>
                );
              })}
            </div>
            <div className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${matchIsClose && matchTotal > 0 ? "border-emerald-200 bg-emerald-50" : "border-gray-100 bg-gray-50"}`}>
              <div><p className="text-[11px] text-gray-400">선택 합계</p><p className="text-sm font-semibold text-gray-900 mt-0.5">{fmt(matchSelectedSum)} ({matchSelectedIds.size}건)</p></div>
              <div><p className="text-[11px] text-gray-400">계산서 합계</p><p className="text-sm font-semibold text-gray-900 mt-0.5">{fmt(matchTotal)}</p></div>
              <div><p className="text-[11px] text-gray-400">차이</p><p className={`text-sm font-semibold mt-0.5 ${matchIsClose ? "text-emerald-600" : "text-red-500"}`}>{fmt(matchTotal - matchSelectedSum)}{matchIsClose && matchTotal > 0 ? " · 일치" : ""}</p></div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setShowMatchModal(false)} className={btnSecondary}>취소</button>
            <button onClick={confirmMatch} disabled={matchSaving} className={btnPrimary}>
              {matchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              매칭 확정 ({matchSelectedIds.size}건)
            </button>
          </div>
        </Modal>
      )}

      {/* ── 진흥주문 연결 모달 ────────────────────────────────────────────── */}
      {showOrderLinkModal && orderLinkTarget && (
        <Modal title={`진흥주문 연결 — ${orderLinkTarget.customer_name}`} onClose={() => setShowOrderLinkModal(false)} wide>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span className="text-gray-400">매출일 <span className="text-gray-700 font-medium">{orderLinkTarget.sale_date}</span></span>
              <span className="text-gray-400">품목 <span className="text-gray-700 font-medium">{[orderLinkTarget.maker, orderLinkTarget.spec].filter(Boolean).join(" / ") || "-"}</span></span>
              <span className="text-gray-400">매출액 <span className="text-gray-700 font-medium">{fmt(orderLinkTarget.total_revenue || 0)}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && loadOrderCandidates(orderSearch)}
                  placeholder="거래처명으로 진흥주문 검색" className="w-full h-[38px] pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <button onClick={() => loadOrderCandidates(orderSearch)} className={btnSecondary}><Search className="w-4 h-4" />검색</button>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-gray-50">
              {loadingOrderCandidates ? (
                <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin text-orange-500 mr-2" />불러오는 중...</div>
              ) : orderCandidates.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">검색된 진흥주문이 없습니다.</div>
              ) : orderCandidates.map(o => {
                const checked = orderSelectedIds.has(o.id);
                const linkedElsewhere = o.sales_record_id != null && o.sales_record_id !== orderLinkTarget.id;
                return (
                  <label key={o.id} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${linkedElsewhere ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${checked ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <div onClick={e => { e.preventDefault(); if (linkedElsewhere) return; setOrderSelectedIds(prev => { const n = new Set(prev); checked ? n.delete(o.id) : n.add(o.id); return n; }); }}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"}`}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-xs text-gray-400 w-32 shrink-0">{new Date(o.created_at).toLocaleDateString("ko-KR")}</span>
                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{o.customer_name_raw || "거래처 미입력"}</span>
                    <span className="text-xs text-gray-500 truncate flex-1">{[o.product_type, o.product_spec].filter(Boolean).join(" / ") || "-"}{o.quantity ? ` (${o.quantity}개)` : ""}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 shrink-0">{orderStageLabel(o)}</span>
                    {linkedElsewhere && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 font-medium shrink-0">다른 매출건에 연결됨</span>}
                    {o.price_to_customer != null && <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{fmt(o.price_to_customer)}</span>}
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400">체크된 주문이 이 매출건에 연결됩니다. 이미 연결돼 있던 주문의 체크를 해제하면 연결이 풀립니다. 다른 매출건에 이미 연결된 주문은 그쪽 연결을 먼저 해제해야 선택할 수 있습니다.</p>
          </div>
          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => setShowOrderLinkModal(false)} className={btnSecondary}>취소</button>
            <button onClick={confirmOrderLink} disabled={orderLinkSaving} className={btnPrimary}>
              {orderLinkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              연결 저장 ({orderSelectedIds.size}건)
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── 공통 서브컴포넌트 ──────────────────────────────────────────────────────────
const LoadingBox: React.FC = () => (
  <div className="border border-gray-200 rounded-2xl bg-white shadow-sm flex items-center justify-center gap-3 py-16 text-gray-400">
    <Loader2 className="w-5 h-5 animate-spin text-orange-500" /><span className="text-sm">불러오는 중...</span>
  </div>
);
const EmptyBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="border border-gray-200 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center py-16 text-gray-400">
    <PackageCheck className="w-10 h-10 mb-3 text-gray-300" /><p className="text-sm font-medium">{msg}</p>
  </div>
);
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8 px-4">
    <div className={`w-full ${wide ? "max-w-3xl" : "max-w-2xl"} bg-white rounded-2xl shadow-2xl`}>
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
);

export default FinanceHubPage;