// pages/Renthana/work/index.tsx — 렌타나 타이어렌탈 공유 업무페이지 (RNF ↔ 렌타나)
//
// 사전 단계(RNF): 1. 고객 기본정보  2. 사업자등록증·차량등록증  3. 견적서 → 모두 갖추면 [심사요청]
// 렌타나: 승인 / 보류 / 부결
// 사후 단계(RNF): 4. 설치사진·보증서 → [장착완료]
// 렌타나: 대금 지급 후 [대금지급 완료] → 마무리
//
// 단계 전환 조건·권한은 DB 트리거(renthana_case_guard)에서도 같은 규칙으로 막고,
// 카카오 알림도 단계가 바뀔 때 DB 트리거가 send-renthana-kakao를 호출해 보낸다(화면에서 따로 발송하지 않음).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { compressImage } from "../../../lib/imageCompress";
import { renthanaMonthlyFee } from "../../../lib/renthanaRate";
import { buildCertificatePdf, type CertificateData } from "./InstallCertificate";
import {
  Plus, Search, Loader2, Upload, Trash2, Pencil, X, Check, ChevronDown, ChevronUp,
  RefreshCw, FileText, Clock, Send, CircleCheck, Circle, Image as ImageIcon,
} from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────
type CaseStatus = "draft" | "submitted" | "approved" | "on_hold" | "rejected" | "installed" | "paid";
type FileKind = "biz_reg" | "vehicle_reg" | "quote" | "install_photo" | "warranty" | "etc";
type RentalCase = {
  id: number;
  case_no: string | null;
  status: CaseStatus;
  customer_name: string;
  customer_phone: string | null;
  company_name: string | null;
  biz_no: string | null;
  vehicle_no: string | null;
  vehicle_model: string | null;
  quote_no: string | null;
  tire_spec: string | null;
  tire_qty_front: number | null;
  tire_qty_rear: number | null;
  supply_price: number | null;
  rental_months: number | null;
  monthly_fee: number | null;
  install_shop: string | null;
  install_date: string | null;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  paid_amount: number | null;
  paid_date: string | null;
  payment_note: string | null;
  special_note: string | null;
  submitted_at: string | null;
  installed_at: string | null;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
type CaseFile = {
  id: number; case_id: number; kind: FileKind; file_name: string; storage_path: string;
  file_size: number | null; uploaded_by: string | null; created_at: string;
};
type CaseHistory = {
  id: number; case_id: number; event_type: string;
  from_status: string | null; to_status: string | null;
  note: string | null; created_by: string | null; created_at: string;
};

const BUCKET = "renthana_docs";
// 지급완료·부결 후 이 기간이 지나면 케이스 전체(고객정보·첨부·이력)가 자동 삭제된다 — DB clear_expired_renthana_cases()와 같은 기준
const RETENTION_DAYS = 7;
const purgeDate = (c: { status: string; paid_at: string | null; decided_at: string | null }) => {
  const base = c.status === "paid" ? c.paid_at : c.status === "rejected" ? c.decided_at : null;
  if (!base) return null;
  return new Date(new Date(base).getTime() + RETENTION_DAYS * 86400000)
    .toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const STATUS_LABEL: Record<CaseStatus, string> = {
  draft: "작성중", submitted: "심사중", approved: "승인", on_hold: "보류",
  rejected: "부결", installed: "장착완료", paid: "지급완료",
};
const STATUS_ORDER: CaseStatus[] = ["draft", "submitted", "on_hold", "approved", "installed", "paid", "rejected"];
const STATUS_STYLE: Record<CaseStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  installed: "bg-violet-100 text-violet-700",
  paid: "bg-slate-800 text-white",
};
const CARD_BORDER: Record<CaseStatus, string> = {
  draft: "border-gray-200", submitted: "border-blue-200", approved: "border-emerald-200",
  on_hold: "border-amber-200", rejected: "border-red-200", installed: "border-violet-200", paid: "border-slate-300",
};
// 다음 처리 차례 — RNF가 할 일 / 렌타나가 할 일
const RNF_TURN: CaseStatus[] = ["draft", "on_hold", "approved"];
const RENTHANA_TURN: CaseStatus[] = ["submitted", "installed"];

const FILE_KIND_LABEL: Record<FileKind, string> = {
  biz_reg: "사업자등록증", vehicle_reg: "차량등록증", quote: "견적서",
  install_photo: "설치사진", warranty: "보증서", etc: "기타",
};

const EVENT_LABEL: Record<string, string> = {
  created: "📝 등록", status_change: "🔄 단계 변경", note: "💬 메모", notify: "🔔 알림 발송",
  file_upload: "📎 파일 첨부", file_delete: "🗑 파일 삭제", edit: "✏️ 정보 수정", fax: "📠 팩스 발송",
};

// ── 유틸 ──────────────────────────────────────────────────────
const fmtWon = (n: number | null | undefined) => n != null ? `${Math.round(n).toLocaleString("ko-KR")}원` : "-";
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
const fmtFileSize = (n: number | null | undefined) => {
  if (!n) return "";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
};
const isImage = (name: string) => /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name);
const fmtPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
};
const toNum = (v: string) => (v.trim() === "" ? null : Number(v.replace(/,/g, "")));

async function genCaseNo(): Promise<string> {
  const { data, error } = await supabase.rpc("next_rnf_number");
  if (error || !data) throw new Error(error?.message || "번호 발급 실패");
  return data as string;
}

// 사전 단계 체크리스트 — DB 트리거의 submitted 조건과 같게 유지
function preChecks(c: RentalCase, kinds: Set<FileKind>) {
  return [
    { label: "1. 고객 이름·전화번호", ok: !!c.customer_name?.trim() && !!c.customer_phone?.trim() },
    { label: "2. 사업자등록증", ok: kinds.has("biz_reg") },
    { label: "2. 차량등록증", ok: kinds.has("vehicle_reg") },
    { label: "3. 견적서", ok: kinds.has("quote") },
  ];
}
function postChecks(kinds: Set<FileKind>) {
  return [
    { label: "4. 설치사진", ok: kinds.has("install_photo") },
    { label: "4. 보증서", ok: kinds.has("warranty") },
  ];
}

const inputClass = "w-full h-[42px] rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-900 bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all disabled:bg-gray-50 disabled:text-gray-400";
const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const btnSecondary = "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50";
const card = "border border-gray-200 rounded-2xl bg-white shadow-sm";
const sectionTitle = "text-xs font-bold text-[#0a192f] mb-2";

const EMPTY_NEW = { customer_name: "", customer_phone: "", company_name: "", special_note: "" };

type EditForm = Record<
  "customer_name" | "customer_phone" | "company_name" | "biz_no" | "vehicle_no" | "vehicle_model" |
  "quote_no" | "tire_spec" | "tire_qty_front" | "tire_qty_rear" | "supply_price" | "rental_months" | "monthly_fee" |
  "install_shop" | "install_date" | "special_note", string>;

const toEditForm = (c: RentalCase): EditForm => ({
  customer_name: c.customer_name ?? "", customer_phone: c.customer_phone ?? "",
  company_name: c.company_name ?? "", biz_no: c.biz_no ?? "",
  vehicle_no: c.vehicle_no ?? "", vehicle_model: c.vehicle_model ?? "",
  quote_no: c.quote_no ?? "", tire_spec: c.tire_spec ?? "",
  tire_qty_front: c.tire_qty_front != null ? String(c.tire_qty_front) : "",
  tire_qty_rear: c.tire_qty_rear != null ? String(c.tire_qty_rear) : "",
  supply_price: c.supply_price != null ? String(c.supply_price) : "",
  rental_months: c.rental_months != null ? String(c.rental_months) : "",
  monthly_fee: c.monthly_fee != null ? String(c.monthly_fee) : "",
  install_shop: c.install_shop ?? "", install_date: c.install_date ?? "",
  special_note: c.special_note ?? "",
});

type QuoteRow = { quote_no: string; quote_type: string; quote_date: string; recipient: string | null; items: any[] | null };

// 수량 표기: 전 2 · 후 4
const fmtQty = (front: number | null, rear: number | null) =>
  front == null && rear == null ? "" : `전 ${front ?? 0} · 후 ${rear ?? 0}`;

// 견적서 → 공급가·규격·전/후 수량 추출
//  - 타이어 견적서(tire): 품목 줄마다 단가×수량 합계, 품목명에 "전륜"/"후륜"이 있으면 그 줄 수량을 전·후로 나눔
//  - 렌타나 계산기(renthana): 공급가 1줄, 품목명에 "전륜 … 2p / 후륜 … 4p"처럼 적혀 있으면 수량을 읽음
function parseQuote(q: QuoteRow) {
  const rows = (q.items ?? []).filter((it: any) => it && String(it.name ?? "").trim() && Number(it.price) > 0);
  if (q.quote_type === "renthana") {
    const it = rows[0] ?? {};
    const name = String(it.name ?? "");
    const pick = (re: RegExp) => { const m = name.match(re); return m ? Number(m[1]) : null; };
    return {
      supply: Number(it.price) || null,
      spec: name && name !== it.product ? name : "",
      front: pick(/전륜.*?(\d+)\s*(?:p|P|본|개)/),
      rear: pick(/후륜.*?(\d+)\s*(?:p|P|본|개)/),
    };
  }
  let supply = 0, front: number | null = null, rear: number | null = null;
  const specs: string[] = [];
  for (const it of rows) {
    const qty = Number(it.qty) || 1;
    supply += Number(it.price) * qty;
    const label = `${it.name}${it.spec ? ` ${it.spec}` : ""}`;
    if (/전륜|앞/.test(label)) front = (front ?? 0) + qty;
    else if (/후륜|뒤/.test(label)) rear = (rear ?? 0) + qty;
    specs.push(`${/전륜/.test(label) ? "전륜 " : /후륜/.test(label) ? "후륜 " : ""}${it.spec || it.name}`);
  }
  return { supply: supply || null, spec: specs.join(" / "), front, rear };
}

export default function RenthanaWorkPage() {
  const { user, isAdmin, isSubAdmin, isRenthana, logout } = useAuth() as any;
  const isRnf = isAdmin || isSubAdmin;           // RNF 쪽: 등록·서류·장착 입력
  const isPartner = isRenthana || isRnf;          // 렌타나 쪽 처리(심사·지급) — 관리자는 대행·테스트용으로 허용
  const myTurn: CaseStatus[] = isRenthana ? RENTHANA_TURN : RNF_TURN;

  const [cases, setCases] = useState<RentalCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "전체" | "내차례">("전체");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_NEW });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [certBusy, setCertBusy] = useState<string | null>(null); // `${caseId}:pdf` | `${caseId}:fax`
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const [files, setFiles] = useState<Record<number, CaseFile[]>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<number, CaseHistory[]>>({});
  const [uploading, setUploading] = useState<string | null>(null); // `${caseId}:${kind}`
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [decisionDrafts, setDecisionDrafts] = useState<Record<number, string>>({});
  const [payDrafts, setPayDrafts] = useState<Record<number, { amount: string; date: string; note: string }>>({});
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── 로드 ──
  const loadCases = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("renthana_rental_cases")
      .select("*").order("created_at", { ascending: false });
    setLoading(false);
    if (error) { alert("목록 로드 실패: " + error.message); return; }
    setCases((data ?? []) as RentalCase[]);
  };
  useEffect(() => { void loadCases(); }, []);

  // 렌타나 계산기에서 저장한 견적 이력 — 견적번호·공급가·렌탈료 자동 입력용 (RNF만 조회 가능)
  useEffect(() => {
    if (!isRnf) return;
    supabase.from("tb_quotations").select("quote_no, quote_type, quote_date, recipient, items")
      .in("quote_type", ["renthana", "tire"]).order("created_at", { ascending: false }).limit(80)
      .then(({ data }: { data: unknown[] | null }) => setQuotes((data ?? []) as QuoteRow[]));
  }, [isRnf]);

  const loadFiles = async (caseId: number) => {
    const { data } = await supabase.from("renthana_case_files")
      .select("*").eq("case_id", caseId).order("created_at", { ascending: true });
    const rows = (data ?? []) as CaseFile[];
    setFiles(prev => ({ ...prev, [caseId]: rows }));
    const imgPaths = rows.filter(f => isImage(f.file_name)).map(f => f.storage_path);
    if (imgPaths.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(imgPaths, 3600);
      const m: Record<string, string> = {};
      (signed ?? []).forEach((s: { path: string | null; signedUrl: string }) => { if (s.path && s.signedUrl) m[s.path] = s.signedUrl; });
      setThumbs(prev => ({ ...prev, ...m }));
    }
  };
  const loadHistory = async (caseId: number) => {
    const { data } = await supabase.from("renthana_case_history")
      .select("*").eq("case_id", caseId).order("created_at", { ascending: false });
    setHistory(prev => ({ ...prev, [caseId]: (data ?? []) as CaseHistory[] }));
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    void loadFiles(id);
    void loadHistory(id);
  };

  const addHistory = async (caseId: number, event_type: string, opts: { from_status?: string | null; to_status?: string | null; note?: string | null } = {}) => {
    await supabase.from("renthana_case_history").insert({
      case_id: caseId, event_type,
      from_status: opts.from_status ?? null, to_status: opts.to_status ?? null,
      note: opts.note ?? null, created_by: user?.email ?? null,
    });
    void loadHistory(caseId);
  };

  // ── 신규 등록 (작성중으로 저장 → 서류 첨부 후 심사요청) ──
  const onCreate = async () => {
    if (!newForm.customer_name.trim()) { alert("고객 이름을 입력해주세요."); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("renthana_rental_cases").insert({
        case_no: await genCaseNo(),
        status: "draft",
        customer_name: newForm.customer_name.trim(),
        customer_phone: newForm.customer_phone.trim() || null,
        company_name: newForm.company_name.trim() || null,
        special_note: newForm.special_note.trim() || null,
        created_by: user?.email ?? null,
      }).select().single();
      if (error) throw error;
      await addHistory(data.id, "created", { to_status: "draft", note: "케이스 등록" });
      setNewForm({ ...EMPTY_NEW });
      setShowNew(false);
      await loadCases();
      setExpandedId(data.id);
      void loadFiles(data.id);
      setEditingId(data.id);
      setEditForm(toEditForm(data as RentalCase));
    } catch (e: any) {
      alert("등록 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── 단계 변경 (조건 검사·알림 발송은 DB 트리거가 담당) ──
  const changeStatus = async (c: RentalCase, next: CaseStatus, extra: Partial<RentalCase> = {}, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusyId(c.id);
    const { error } = await supabase.from("renthana_rental_cases")
      .update({ status: next, ...extra }).eq("id", c.id);
    setBusyId(null);
    if (error) { alert(error.message); return; }
    const note = (extra.decision_note as string | undefined) ?? (extra.payment_note as string | undefined) ?? null;
    await addHistory(c.id, "status_change", { from_status: STATUS_LABEL[c.status], to_status: STATUS_LABEL[next], note });
    await loadCases();
  };

  const decide = (c: RentalCase, next: "approved" | "on_hold" | "rejected") => {
    const note = (decisionDrafts[c.id] ?? "").trim();
    if (next !== "approved" && !note) { alert(`${STATUS_LABEL[next]} 사유를 입력해주세요.`); return; }
    void changeStatus(c, next, { decision_note: note || null },
      `'${c.customer_name}' 건을 ${STATUS_LABEL[next]} 처리하고 RNF에 알림을 보낼까요?`);
  };

  const markPaid = (c: RentalCase) => {
    const d = payDrafts[c.id] ?? { amount: c.supply_price != null ? String(c.supply_price) : "", date: new Date().toISOString().slice(0, 10), note: "" };
    const amount = toNum(d.amount);
    if (!amount) { alert("지급액을 입력해주세요."); return; }
    void changeStatus(c, "paid", { paid_amount: amount, paid_date: d.date || null, payment_note: d.note.trim() || null },
      `${fmtWon(amount)} 대금지급 완료 처리할까요? 처리 후 건이 마무리됩니다.`);
  };

  // ── 정보 수정 ──
  const openEdit = (c: RentalCase) => { setEditingId(c.id); setEditForm(toEditForm(c)); };
  const saveEdit = async (c: RentalCase) => {
    if (!editForm) return;
    if (!editForm.customer_name.trim()) { alert("고객 이름은 비울 수 없습니다."); return; }
    setBusyId(c.id);
    const { error } = await supabase.from("renthana_rental_cases").update({
      customer_name: editForm.customer_name.trim(),
      customer_phone: editForm.customer_phone.trim() || null,
      company_name: editForm.company_name.trim() || null,
      biz_no: editForm.biz_no.trim() || null,
      vehicle_no: editForm.vehicle_no.trim() || null,
      vehicle_model: editForm.vehicle_model.trim() || null,
      quote_no: editForm.quote_no.trim() || null,
      tire_spec: editForm.tire_spec.trim() || null,
      tire_qty_front: toNum(editForm.tire_qty_front),
      tire_qty_rear: toNum(editForm.tire_qty_rear),
      supply_price: toNum(editForm.supply_price),
      rental_months: toNum(editForm.rental_months),
      monthly_fee: toNum(editForm.monthly_fee),
      install_shop: editForm.install_shop.trim() || null,
      install_date: editForm.install_date || null,
      special_note: editForm.special_note.trim() || null,
    }).eq("id", c.id);
    setBusyId(null);
    if (error) { alert("수정 실패: " + error.message); return; }
    await addHistory(c.id, "edit", { note: "정보 수정" });
    setEditingId(null);
    setEditForm(null);
    await loadCases();
  };

  // 공급가·기간이 바뀌면 월 렌탈료를 렌타나 요율로 다시 계산 (계산기와 같은 공식)
  const withFee = (f: EditForm): EditForm => {
    const price = toNum(f.supply_price);
    const months = f.rental_months === "12" ? 12 : f.rental_months === "24" ? 24 : null;
    return price && months ? { ...f, monthly_fee: String(renthanaMonthlyFee(price, months)) } : f;
  };

  const applyQuote = (quoteNo: string) => {
    const q = quotes.find(x => x.quote_no === quoteNo);
    if (!q || !editForm) return;
    const p = parseQuote(q);
    setEditForm(withFee({
      ...editForm,
      quote_no: q.quote_no,
      tire_spec: p.spec || editForm.tire_spec,
      tire_qty_front: p.front != null ? String(p.front) : editForm.tire_qty_front,
      tire_qty_rear: p.rear != null ? String(p.rear) : editForm.tire_qty_rear,
      supply_price: p.supply != null ? String(p.supply) : editForm.supply_price,
      rental_months: editForm.rental_months || "12",
    }));
  };

  const deleteCase = async (c: RentalCase) => {
    if (!window.confirm(`'${c.customer_name}' 건을 삭제할까요? 첨부파일도 모두 삭제됩니다.`)) return;
    const rows = files[c.id] ?? ((await supabase.from("renthana_case_files").select("*").eq("case_id", c.id)).data ?? []) as CaseFile[];
    if (rows.length) await supabase.storage.from(BUCKET).remove(rows.map(f => f.storage_path));
    const { error } = await supabase.from("renthana_rental_cases").delete().eq("id", c.id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    await loadCases();
  };

  // ── 파일 ──
  const uploadFiles = async (c: RentalCase, kind: FileKind, list: FileList | null) => {
    if (!list || list.length === 0) return;
    const key = `${c.id}:${kind}`;
    setUploading(key);
    try {
      for (const original of Array.from(list)) {
        const file = await compressImage(original);
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
        const path = `cases/${c.id}/${kind}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("renthana_case_files").insert({
          case_id: c.id, kind, file_name: file.name, storage_path: path,
          file_size: file.size, uploaded_by: user?.email ?? null,
        });
        if (dbErr) throw dbErr;
        await addHistory(c.id, "file_upload", { note: `${FILE_KIND_LABEL[kind]}: ${file.name}` });
      }
      await loadFiles(c.id);
    } catch (e: any) {
      alert("업로드 실패: " + e.message);
    } finally {
      setUploading(null);
      const ref = fileInputRefs.current[key];
      if (ref) ref.value = "";
    }
  };

  // ── 설치확인서 (장착확인서 + 품질보증 안내) ──
  const certData = (c: RentalCase): CertificateData => ({
    caseNo: c.case_no, customerName: c.customer_name, companyName: c.company_name,
    vehicleNo: c.vehicle_no, tireSpec: c.tire_spec, qtyFront: c.tire_qty_front, qtyRear: c.tire_qty_rear,
    installDate: c.install_date, installShop: c.install_shop,
  });

  const downloadCertificate = async (c: RentalCase) => {
    setCertBusy(`${c.id}:pdf`);
    try {
      const blob = await buildCertificatePdf(certData(c));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `장착확인서_${c.case_no ?? c.id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) {
      alert("설치확인서 만들기 실패: " + e.message);
    } finally {
      setCertBusy(null);
    }
  };

  const faxCertificate = async (c: RentalCase) => {
    const missing = [!c.vehicle_no && "차량번호", !c.install_date && "장착일"].filter(Boolean);
    if (missing.length && !window.confirm(`${missing.join("·")}이(가) 비어 있습니다. 빈칸으로 보낼까요?`)) return;
    if (!window.confirm(`'${c.customer_name}' 건 설치확인서를 렌타나 팩스로 보낼까요?`)) return;
    setCertBusy(`${c.id}:fax`);
    try {
      const blob = await buildCertificatePdf(certData(c));
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
      const { data, error } = await supabase.functions.invoke("send-renthana-fax", { body: { caseId: c.id, pdfBase64 } });
      if (error) {
        const detail = await (error as any).context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? error.message);
      }
      alert(`팩스 발송을 접수했습니다 (${data.to}). 수신까지 몇 분 걸릴 수 있습니다.`);
      void loadFiles(c.id);
      void loadHistory(c.id);
    } catch (e: any) {
      alert("팩스 발송 실패: " + e.message);
    } finally {
      setCertBusy(null);
    }
  };

  const openFile = async (f: CaseFile) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 300);
    if (error || !data?.signedUrl) { alert("파일 열기 실패: " + (error?.message ?? "")); return; }
    window.open(data.signedUrl, "_blank");
  };

  const deleteFile = async (f: CaseFile) => {
    if (!window.confirm(`'${f.file_name}' 파일을 삭제할까요?`)) return;
    const { error } = await supabase.from("renthana_case_files").delete().eq("id", f.id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    await addHistory(f.case_id, "file_delete", { note: `${FILE_KIND_LABEL[f.kind]}: ${f.file_name}` });
    await loadFiles(f.case_id);
  };

  const addNote = async (caseId: number) => {
    const note = (noteDrafts[caseId] ?? "").trim();
    if (!note) return;
    await addHistory(caseId, "note", { note });
    setNoteDrafts(prev => ({ ...prev, [caseId]: "" }));
  };

  // ── 집계/필터 ──
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    cases.forEach(c => { m[c.status] = (m[c.status] ?? 0) + 1; });
    return m;
  }, [cases]);
  const myTurnCount = cases.filter(c => myTurn.includes(c.status)).length;

  const filtered = useMemo(() => cases.filter(c => {
    if (statusFilter === "내차례" && !myTurn.includes(c.status)) return false;
    if (statusFilter !== "전체" && statusFilter !== "내차례" && c.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [c.case_no, c.customer_name, c.company_name, c.customer_phone, c.vehicle_no].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [cases, statusFilter, search, myTurn]);

  // ── 파일 슬롯 ──
  // 컴포넌트가 아니라 렌더 함수로 호출한다 — 부모가 다시 그려질 때 file input이 새로 만들어지지 않도록
  const fileSlot = (c: RentalCase, kind: FileKind, canUpload: boolean, canDelete: boolean) => {
    const list = (files[c.id] ?? []).filter(f => f.kind === kind);
    const key = `${c.id}:${kind}`;
    return (
      <div key={kind} className="rounded-xl border border-gray-200 p-2.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            {list.length > 0 ? <CircleCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Circle className="w-3.5 h-3.5 text-gray-300" />}
            {FILE_KIND_LABEL[kind]} <span className="text-gray-400 font-normal">{list.length > 0 ? `${list.length}건` : "미첨부"}</span>
          </span>
          {canUpload && (
            <>
              <input ref={el => { fileInputRefs.current[key] = el; }} type="file" multiple accept="image/*,application/pdf" className="hidden"
                onChange={e => void uploadFiles(c, kind, e.target.files)} />
              <button onClick={() => fileInputRefs.current[key]?.click()} disabled={uploading === key}
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1">
                {uploading === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} 첨부
              </button>
            </>
          )}
        </div>
        {list.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {list.map(f => (
              <div key={f.id} className="group relative">
                {isImage(f.file_name) && thumbs[f.storage_path] ? (
                  <button onClick={() => void openFile(f)} title={f.file_name}
                    className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={thumbs[f.storage_path]} alt={f.file_name} className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <button onClick={() => void openFile(f)} title={f.file_name}
                    className="flex items-center gap-1 max-w-[180px] text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 hover:border-orange-300">
                    {isImage(f.file_name) ? <ImageIcon className="w-3 h-3 flex-shrink-0" /> : <FileText className="w-3 h-3 flex-shrink-0" />}
                    <span className="truncate">{f.file_name}</span>
                    <span className="text-gray-400 flex-shrink-0">{fmtFileSize(f.file_size)}</span>
                  </button>
                )}
                {(canDelete || (isRenthana && f.uploaded_by === user?.email)) && (
                  <button onClick={() => void deleteFile(f)} title="삭제"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 flex items-center justify-center shadow-sm">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Checklist = ({ items }: { items: { label: string; ok: boolean }[] }) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map(it => (
        <span key={it.label} className={`text-[11px] px-2 py-1 rounded-full font-medium inline-flex items-center gap-1 ${it.ok ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
          {it.ok ? <Check className="w-3 h-3" /> : <Circle className="w-2.5 h-2.5" />} {it.label}
        </span>
      ))}
    </div>
  );

  const Stepper = ({ c }: { c: RentalCase }) => {
    const steps = [
      { label: "사전입력", done: c.status !== "draft" },
      { label: "심사", done: ["approved", "installed", "paid"].includes(c.status), fail: c.status === "rejected", hold: c.status === "on_hold" },
      { label: "장착", done: ["installed", "paid"].includes(c.status) },
      { label: "지급", done: c.status === "paid" },
    ];
    return (
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <span className={`h-px w-3 ${s.done ? "bg-emerald-400" : "bg-gray-200"}`} />}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              s.fail ? "bg-red-100 text-red-600" : s.hold ? "bg-amber-100 text-amber-700" : s.done ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
              {s.label}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const field = (k: keyof EditForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input className={inputClass} value={editForm?.[k] ?? ""} {...props}
        onChange={e => setEditForm(f => {
          if (!f) return f;
          const next = { ...f, [k]: k === "customer_phone" ? fmtPhone(e.target.value) : e.target.value };
          return k === "supply_price" ? withFee(next) : next;
        })} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 + 필터 (고정) ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 space-y-3 pb-3">
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#0a192f]">
            🛞 렌타나 타이어렌탈 <span className="text-xs font-normal text-gray-400">RNF ↔ 렌타나 공유</span>
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${isRenthana ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-600"}`}>
              {isRenthana ? "렌타나" : "RNF"}
            </span>
            <button onClick={() => void logout()} className="text-xs text-gray-400 hover:text-gray-600">로그아웃</button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-6 flex flex-wrap gap-1.5">
          <button onClick={() => setStatusFilter("내차례")}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${statusFilter === "내차례" ? "bg-orange-500 text-white border-orange-500" : "bg-orange-50 text-orange-600 border-orange-200"}`}>
            처리할 건 {myTurnCount}
          </button>
          <button onClick={() => setStatusFilter("전체")}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${statusFilter === "전체" ? "bg-[#0a192f] text-white border-[#0a192f]" : "bg-white text-gray-500 border-gray-200"}`}>
            전체 {cases.length}
          </button>
          {STATUS_ORDER.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${STATUS_STYLE[s]} ${statusFilter === s ? "ring-2 ring-offset-1 ring-orange-300" : "opacity-80 hover:opacity-100"}`}>
              {STATUS_LABEL[s]} {counts[s] ?? 0}
            </button>
          ))}
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-6 flex flex-wrap items-center gap-2">
          {isRnf && (
            <button onClick={() => setShowNew(s => !s)} className={btnPrimary}>
              <Plus className="w-4 h-4" /> 신규 등록
            </button>
          )}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="고객·상호·전화·차량번호"
              className="h-[38px] w-full pl-8 pr-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-orange-400" />
          </div>
          <button onClick={() => void loadCases()} disabled={loading} className={btnSecondary}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 space-y-3">
        {/* ── 신규 등록 ── */}
        {showNew && isRnf && (
          <div className={`${card} p-4 space-y-3`}>
            <div>
              <p className="text-sm font-semibold text-[#0a192f]">신규 등록</p>
              <p className="text-xs text-gray-400 mt-0.5">작성중으로 저장됩니다. 서류·견적을 모두 첨부한 뒤 [심사요청]을 누르면 렌타나에 알림이 갑니다. 지급완료·부결 {RETENTION_DAYS}일 뒤 모든 정보가 자동 삭제됩니다.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div><label className={labelClass}>고객 이름 *</label><input className={inputClass} value={newForm.customer_name} onChange={e => setNewForm(f => ({ ...f, customer_name: e.target.value }))} /></div>
              <div><label className={labelClass}>전화번호 *</label><input className={inputClass} inputMode="tel" value={newForm.customer_phone} onChange={e => setNewForm(f => ({ ...f, customer_phone: fmtPhone(e.target.value) }))} placeholder="010-0000-0000" /></div>
              <div><label className={labelClass}>상호</label><input className={inputClass} value={newForm.company_name} onChange={e => setNewForm(f => ({ ...f, company_name: e.target.value }))} /></div>
            </div>
            <div><label className={labelClass}>특이사항</label><input className={inputClass} value={newForm.special_note} onChange={e => setNewForm(f => ({ ...f, special_note: e.target.value }))} placeholder="렌타나에 전달할 내용" /></div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className={btnSecondary}>취소</button>
              <button onClick={() => void onCreate()} disabled={saving} className={btnPrimary}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 저장
              </button>
            </div>
          </div>
        )}

        {/* ── 목록 ── */}
        {loading && cases.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <div className={`${card} text-sm text-gray-400 text-center py-12`}>
            {statusFilter === "내차례" ? "지금 처리할 건이 없습니다." : "등록된 건이 없습니다."}
          </div>
        ) : filtered.map(c => {
          const isExpanded = expandedId === c.id;
          const isEditing = editingId === c.id && !!editForm;
          const caseFiles = files[c.id] ?? [];
          const kinds = new Set(caseFiles.map(f => f.kind));
          const pre = preChecks(c, kinds);
          const post = postChecks(kinds);
          const preReady = pre.every(x => x.ok);
          const postReady = post.every(x => x.ok);
          const preEditable = isRnf && (c.status === "draft" || c.status === "on_hold");
          const postEditable = isRnf && c.status === "approved";
          const busy = busyId === c.id;
          const turn = myTurn.includes(c.status);
          const pay = payDrafts[c.id] ?? { amount: c.supply_price != null ? String(c.supply_price) : "", date: new Date().toISOString().slice(0, 10), note: "" };

          return (
            <div key={c.id} className={`${card} overflow-hidden ${CARD_BORDER[c.status]}`}>
              {/* 카드 헤더 */}
              <button onClick={() => toggleExpand(c.id)} className="w-full text-left p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                    {turn && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-orange-500 text-white">처리 필요</span>}
                    <span className="text-[11px] font-mono text-gray-400">{c.case_no}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#0a192f] truncate">
                    {c.customer_name}{c.company_name ? ` · ${c.company_name}` : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.customer_phone ?? "전화 미입력"}
                    {c.monthly_fee != null ? ` · ${c.rental_months ?? "-"}개월 월 ${fmtWon(c.monthly_fee)}` : ""}
                  </p>
                  <div className="mt-2"><Stepper c={c} /></div>
                </div>
                <span className="p-1.5 rounded-lg border border-gray-200 text-gray-500 flex-shrink-0">
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {c.decision_note && ["approved", "on_hold", "rejected", "installed", "paid"].includes(c.status) && (
                <div className={`mx-4 mb-3 text-xs rounded-lg px-3 py-2 ${c.status === "rejected" ? "bg-red-50 text-red-700" : c.status === "on_hold" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                  <span className="font-semibold">렌타나 {c.status === "rejected" ? "부결 사유" : c.status === "on_hold" ? "보류 사유" : "승인 메모"}:</span> {c.decision_note}
                </div>
              )}

              {purgeDate(c) && (
                <p className="mx-4 mb-3 text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
                  🗑 개인정보 보호를 위해 {purgeDate(c)} 이후 고객정보·서류·이력이 모두 자동 삭제됩니다. 필요한 자료는 그 전에 내려받아 주세요.
                </p>
              )}

              {isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-5">
                  {/* ── 정보 (조회/수정) ── */}
                  {isEditing && editForm ? (
                    <div className="space-y-4">
                      <div>
                        <p className={sectionTitle}>1. 고객 기본정보</p>
                        <div className="grid sm:grid-cols-4 gap-3">
                          {field("customer_name", "이름 *")}
                          {field("customer_phone", "전화번호 *", { inputMode: "tel", placeholder: "010-0000-0000" })}
                          {field("company_name", "상호")}
                          {field("biz_no", "사업자등록번호", { placeholder: "000-00-00000" })}
                        </div>
                      </div>
                      <div>
                        <p className={sectionTitle}>2. 차량</p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {field("vehicle_no", "차량번호", { placeholder: "여러 대면 쉼표로 구분" })}
                          {field("vehicle_model", "차종")}
                        </div>
                      </div>
                      <div>
                        <p className={sectionTitle}>3. 견적</p>
                        {quotes.length > 0 && (
                          <div className="mb-3">
                            <label className={labelClass}>기존 견적 불러오기 (타이어 견적서·렌타나 계산기)</label>
                            <select className={inputClass} value="" onChange={e => applyQuote(e.target.value)}>
                              <option value="">견적번호 선택…</option>
                              {quotes.map(q => {
                                const p = parseQuote(q);
                                return <option key={q.quote_no} value={q.quote_no}>{q.quote_no} · {q.quote_date} · {q.quote_type === "tire" ? "타이어견적" : "렌타나계산기"} · {q.recipient || "-"} · {p.supply ? fmtWon(p.supply) : ""}</option>;
                              })}
                            </select>
                          </div>
                        )}
                        <div className="grid sm:grid-cols-4 gap-3">
                          {field("quote_no", "견적번호")}
                          {field("tire_spec", "타이어 규격·브랜드", { placeholder: "예: 미쉐린 295/80R22.5" })}
                          {field("tire_qty_front", "전륜 수량(본)", { inputMode: "numeric" })}
                          {field("tire_qty_rear", "후륜 수량(본)", { inputMode: "numeric" })}
                        </div>
                        <div className="grid sm:grid-cols-3 gap-3 mt-3">
                          {field("supply_price", "공급가격(VAT 제외)", { inputMode: "numeric" })}
                          <div>
                            <label className={labelClass}>렌탈 기간</label>
                            <select className={inputClass} value={editForm.rental_months} onChange={e => setEditForm(f => f ? withFee({ ...f, rental_months: e.target.value }) : f)}>
                              <option value="">선택</option><option value="12">12개월</option><option value="24">24개월</option>
                            </select>
                          </div>
                          {field("monthly_fee", "월 렌탈료", { inputMode: "numeric" })}
                        </div>
                      </div>
                      <div>
                        <p className={sectionTitle}>4. 장착</p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {field("install_shop", "장착점")}
                          {field("install_date", "장착일", { type: "date" })}
                        </div>
                      </div>
                      {field("special_note", "특이사항")}
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditingId(null); setEditForm(null); }} className={btnSecondary}><X className="w-4 h-4" /> 취소</button>
                        <button onClick={() => void saveEdit(c)} disabled={busy} className={btnPrimary}><Check className="w-4 h-4" /> 저장</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
                        <div><span className="text-gray-400">사업자번호 </span>{c.biz_no ?? "-"}</div>
                        <div><span className="text-gray-400">차량 </span>{c.vehicle_no ?? "-"}{c.vehicle_model ? ` (${c.vehicle_model})` : ""}</div>
                        <div><span className="text-gray-400">견적번호 </span>{c.quote_no ?? "-"}</div>
                        <div><span className="text-gray-400">타이어 </span>{c.tire_spec ?? "-"}{fmtQty(c.tire_qty_front, c.tire_qty_rear) ? ` (${fmtQty(c.tire_qty_front, c.tire_qty_rear)})` : ""}</div>
                        <div><span className="text-gray-400">공급가 </span><span className="font-semibold text-[#0a192f]">{fmtWon(c.supply_price)}</span></div>
                        <div><span className="text-gray-400">렌탈 </span>{c.rental_months ? `${c.rental_months}개월` : "-"} / 월 {fmtWon(c.monthly_fee)}</div>
                        <div><span className="text-gray-400">장착 </span>{c.install_date ?? "-"}{c.install_shop ? ` · ${c.install_shop}` : ""}</div>
                        {c.status === "paid" && <div><span className="text-gray-400">지급 </span><span className="font-semibold">{fmtWon(c.paid_amount)}</span>{c.paid_date ? ` (${c.paid_date})` : ""}</div>}
                      </div>
                      {c.special_note && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">⚠ {c.special_note}</p>}
                      {isRnf && (
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(c)} className={btnSecondary}><Pencil className="w-3.5 h-3.5" /> 정보 수정</button>
                          {(c.status === "draft" || c.status === "rejected") && (
                            <button onClick={() => void deleteCase(c)} className={`${btnSecondary} text-red-500`}><Trash2 className="w-3.5 h-3.5" /> 삭제</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── 사전 서류 (1~3) ── */}
                  <div>
                    <p className={sectionTitle}>사전 서류</p>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {fileSlot(c, "biz_reg", preEditable, preEditable)}
                      {fileSlot(c, "vehicle_reg", preEditable, preEditable)}
                      {fileSlot(c, "quote", preEditable, preEditable)}
                    </div>
                  </div>

                  {/* RNF: 심사요청 */}
                  {preEditable && (
                    <div className="rounded-xl bg-orange-50/60 border border-orange-100 p-3 space-y-2">
                      <Checklist items={pre} />
                      <button disabled={!preReady || busy || isEditing}
                        onClick={() => void changeStatus(c, "submitted", {}, `렌타나에 ${c.status === "on_hold" ? "재" : ""}심사요청 알림을 보낼까요?`)}
                        className={btnPrimary}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {c.status === "on_hold" ? "보완 완료 · 재심사요청" : "심사요청 (렌타나 알림)"}
                      </button>
                      {!preReady && <p className="text-[11px] text-gray-500">1~3번이 모두 갖춰져야 심사요청할 수 있습니다.</p>}
                      {isEditing && <p className="text-[11px] text-gray-500">정보 수정을 먼저 저장해주세요.</p>}
                    </div>
                  )}

                  {/* 렌타나: 승인/보류/부결 */}
                  {isPartner && c.status === "submitted" && (
                    <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-3 space-y-2">
                      <p className="text-xs font-bold text-blue-800">렌타나 심사 결과</p>
                      <textarea value={decisionDrafts[c.id] ?? ""} onChange={e => setDecisionDrafts(p => ({ ...p, [c.id]: e.target.value }))}
                        placeholder="승인 조건 / 보류 사유·보완 요청 서류 / 부결 사유 (보류·부결은 필수)"
                        className="w-full h-20 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                      <div className="grid grid-cols-3 gap-2">
                        <button disabled={busy} onClick={() => decide(c, "approved")} className="py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40">승인</button>
                        <button disabled={busy} onClick={() => decide(c, "on_hold")} className="py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-40">보류</button>
                        <button disabled={busy} onClick={() => decide(c, "rejected")} className="py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-40">부결</button>
                      </div>
                    </div>
                  )}

                  {/* ── 사후 (4) ── */}
                  {["approved", "installed", "paid"].includes(c.status) && (
                    <div>
                      <p className={sectionTitle}>사후 서류 (장착 후)</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {fileSlot(c, "install_photo", postEditable, postEditable)}
                        {fileSlot(c, "warranty", postEditable, postEditable)}
                      </div>
                    </div>
                  )}

                  {/* RNF: 설치확인서 PDF·팩스 (기본정보로 자동 작성) */}
                  {isRnf && ["approved", "installed", "paid"].includes(c.status) && (
                    <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                      <p className="text-xs font-bold text-[#0a192f]">설치확인서 (장착확인서 + 품질보증 안내)</p>
                      <p className="text-[11px] text-gray-500">차량번호·제조사·규격·수량·장착일·장착점은 위 정보로 자동 입력됩니다. 정보 수정을 저장한 뒤 보내주세요.</p>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void downloadCertificate(c)} disabled={!!certBusy || isEditing} className={btnSecondary}>
                          {certBusy === `${c.id}:pdf` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF 미리받기
                        </button>
                        <button onClick={() => void faxCertificate(c)} disabled={!!certBusy || isEditing} className={btnPrimary}>
                          {certBusy === `${c.id}:fax` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 렌타나로 팩스 발송
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RNF: 장착완료 */}
                  {postEditable && (
                    <div className="rounded-xl bg-violet-50/60 border border-violet-100 p-3 space-y-2">
                      <Checklist items={[...post, { label: "장착일", ok: !!c.install_date }]} />
                      <button disabled={!postReady || !c.install_date || busy || isEditing}
                        onClick={() => void changeStatus(c, "installed", {}, "장착완료로 넘기고 렌타나에 대금지급 요청 알림을 보낼까요?")}
                        className={btnPrimary}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 장착완료 (렌타나 알림)
                      </button>
                      {!c.install_date && <p className="text-[11px] text-gray-500">[정보 수정]에서 장착일을 입력해주세요.</p>}
                    </div>
                  )}

                  {/* 렌타나: 대금지급 */}
                  {isPartner && c.status === "installed" && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                      <p className="text-xs font-bold text-slate-800">대금 지급</p>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <div><label className={labelClass}>지급액</label>
                          <input className={inputClass} inputMode="numeric" value={pay.amount} onChange={e => setPayDrafts(p => ({ ...p, [c.id]: { ...pay, amount: e.target.value } }))} /></div>
                        <div><label className={labelClass}>지급일</label>
                          <input type="date" className={inputClass} value={pay.date} onChange={e => setPayDrafts(p => ({ ...p, [c.id]: { ...pay, date: e.target.value } }))} /></div>
                        <div><label className={labelClass}>메모</label>
                          <input className={inputClass} value={pay.note} onChange={e => setPayDrafts(p => ({ ...p, [c.id]: { ...pay, note: e.target.value } }))} placeholder="입금 계좌·비고" /></div>
                      </div>
                      <button disabled={busy} onClick={() => markPaid(c)} className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0a192f] text-white text-sm font-semibold disabled:opacity-40">
                        <Check className="w-4 h-4" /> 대금지급 완료
                      </button>
                    </div>
                  )}

                  {isRnf && ["submitted", "on_hold", "rejected"].includes(c.status) && (
                    <button onClick={() => void changeStatus(c, "draft", {}, "작성중으로 되돌릴까요? (알림 없음)")} className="text-[11px] text-gray-400 underline">
                      관리자: 작성중으로 되돌리기
                    </button>
                  )}

                  {/* ── 이력 ── */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 진행 이력</p>
                    <div className="space-y-2 mb-2 max-h-56 overflow-y-auto">
                      {(history[c.id] ?? []).length === 0 && <p className="text-xs text-gray-400">기록이 없습니다.</p>}
                      {(history[c.id] ?? []).map(h => (
                        <div key={h.id} className="text-xs border-l-2 border-gray-200 pl-2.5">
                          <p className="text-gray-700 font-medium">
                            {EVENT_LABEL[h.event_type] ?? h.event_type}
                            {h.from_status && h.to_status ? ` (${h.from_status} → ${h.to_status})` : ""}
                          </p>
                          {h.note && <p className="text-gray-500 whitespace-pre-wrap">{h.note}</p>}
                          <p className="text-[10px] text-gray-400">{fmtDate(h.created_at)}{h.created_by ? ` · ${h.created_by}` : ""}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input value={noteDrafts[c.id] ?? ""} onChange={e => setNoteDrafts(p => ({ ...p, [c.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void addNote(c.id); }}
                        placeholder="메모 남기기 (알림 없음)" className="flex-1 h-[34px] rounded-lg border border-gray-200 px-2.5 text-xs focus:outline-none focus:border-orange-400" />
                      <button onClick={() => void addNote(c.id)} className="text-xs px-2.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">추가</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
