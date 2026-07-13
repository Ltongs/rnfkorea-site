// pages/RentalOS/index.tsx — Rental_O/S (렌탈 딜 아웃소싱) 관리 페이지
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import {
  Plus, Search, Loader2, Upload, Download, Trash2, Pencil, X, Check,
  ChevronDown, ChevronUp, RefreshCw, FileText, Clock,
} from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────
type DealStatus = "접수" | "진행중" | "확정" | "반려";
type Deal = {
  id: number;
  deal_no: string | null;
  customer_name: string;
  company_name: string | null;
  customer_phone: string | null;
  description: string | null;
  equipment_type: string | null;
  equipment_spec: string | null;
  rental_period: string | null;
  amount: number | null;
  outsourcing_partner: string | null;
  sales_rep: string | null;
  status: DealStatus;
  reject_reason: string | null;
  special_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};
type DealFile = {
  id: number; deal_id: number; file_name: string; storage_path: string;
  file_size: number | null; uploaded_by: string | null; created_at: string;
};
type DealHistory = {
  id: number; deal_id: number; event_type: string;
  from_status: string | null; to_status: string | null;
  note: string | null; created_by: string | null; created_at: string;
};

const STATUS_ORDER: DealStatus[] = ["접수", "진행중", "확정", "반려"];
const STATUS_STYLE: Record<DealStatus, string> = {
  "접수": "bg-gray-100 text-gray-600",
  "진행중": "bg-blue-100 text-blue-700",
  "확정": "bg-emerald-100 text-emerald-700",
  "반려": "bg-red-100 text-red-700",
};
const CARD_BORDER: Record<DealStatus, string> = {
  "접수": "border-gray-200",
  "진행중": "border-blue-200",
  "확정": "border-emerald-200",
  "반려": "border-red-200",
};

// ── 유틸 ──────────────────────────────────────────────────────
const fmtWon = (n: number | null | undefined) => n ? `${Math.round(n).toLocaleString("ko-KR")}원` : "-";
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
const fmtFileSize = (n: number | null | undefined) => {
  if (!n) return "";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
};
// 회사 전체가 공유하는 통합 번호(RNF-YYMM-NNNNNN) — 매달 초기화되는 카운터를 DB에서 원자적으로 발급받는다.
async function genDealNo(): Promise<string> {
  const { data, error } = await supabase.rpc("next_rnf_number");
  if (error || !data) throw new Error(error?.message || "번호 발급 실패");
  return data as string;
}

const inputClass = "w-full h-[42px] rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-900 bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all";
const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5";
const btnPrimary = "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50";
const btnSecondary = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50";
const card = "border border-gray-200 rounded-2xl bg-white shadow-sm";

const EMPTY_FORM = {
  customer_name: "", company_name: "", customer_phone: "",
  description: "", equipment_type: "", equipment_spec: "", rental_period: "",
  amount: "", outsourcing_partner: "", sales_rep: "", special_note: "",
};

export default function RentalOSPage() {
  const navigate = useNavigate();
  const { user, isAdmin, isSubAdmin, isRentalOS, logout } = useAuth() as any;
  const isAdminLevel = isAdmin || isSubAdmin;
  const canManage = isAdminLevel || isRentalOS; // 이 페이지 접근이 허용된 두 사람 모두 동일 권한

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DealStatus | "전체">("전체");
  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [files, setFiles] = useState<Record<number, DealFile[]>>({});
  const [history, setHistory] = useState<Record<number, DealHistory[]>>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // ── 목록 로드 ──
  const loadDeals = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("rental_os_deals")
      .select("*").order("created_at", { ascending: false });
    if (error) { alert("목록 로드 실패: " + error.message); setLoading(false); return; }
    setDeals((data ?? []) as Deal[]);
    setLoading(false);
  };
  useEffect(() => { void loadDeals(); }, []);

  const loadFiles = async (dealId: number) => {
    const { data } = await supabase.from("rental_os_deal_files")
      .select("*").eq("deal_id", dealId).order("created_at", { ascending: true });
    setFiles(prev => ({ ...prev, [dealId]: (data ?? []) as DealFile[] }));
  };
  const loadHistory = async (dealId: number) => {
    const { data } = await supabase.from("rental_os_deal_history")
      .select("*").eq("deal_id", dealId).order("created_at", { ascending: false });
    setHistory(prev => ({ ...prev, [dealId]: (data ?? []) as DealHistory[] }));
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    void loadFiles(id);
    void loadHistory(id);
  };

  const addHistory = async (dealId: number, event_type: string, opts: { from_status?: string | null; to_status?: string | null; note?: string | null } = {}) => {
    await supabase.from("rental_os_deal_history").insert({
      deal_id: dealId, event_type,
      from_status: opts.from_status ?? null, to_status: opts.to_status ?? null,
      note: opts.note ?? null, created_by: user?.email ?? null,
    });
    if (expandedId === dealId) void loadHistory(dealId);
  };

  // ── 카카오톡 알림 (신규 딜 등록 시, 실패해도 업무 영향 없음) ──
  const sendKakaoNotify = (payload: Record<string, string>) => {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-rentalos-kakao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify(payload),
    }).catch((e) => console.warn("[rental-os kakao notify] 전송 실패:", e));
  };

  // ── 신규 딜 등록 ──
  const onCreate = async () => {
    if (!canManage) return;
    if (!form.customer_name.trim()) { alert("고객명을 입력해주세요."); return; }
    setSaving(true);
    try {
      const payload = {
        deal_no: await genDealNo(),
        customer_name: form.customer_name.trim(),
        company_name: form.company_name.trim() || null,
        customer_phone: form.customer_phone.trim() || null,
        description: form.description.trim() || null,
        equipment_type: form.equipment_type.trim() || null,
        equipment_spec: form.equipment_spec.trim() || null,
        rental_period: form.rental_period.trim() || null,
        amount: form.amount ? Number(form.amount) : null,
        outsourcing_partner: form.outsourcing_partner.trim() || null,
        sales_rep: form.sales_rep.trim() || null,
        special_note: form.special_note.trim() || null,
        status: "접수" as DealStatus,
        created_by: user?.email ?? null,
      };
      const { data, error } = await supabase.from("rental_os_deals").insert(payload).select().single();
      if (error) throw error;
      await addHistory(data.id, "created", { to_status: "접수", note: "딜 등록" });
      sendKakaoNotify({
        dealNo: payload.deal_no, customerName: payload.customer_name, companyName: payload.company_name ?? "",
        equipmentType: payload.equipment_type ?? "", equipmentSpec: payload.equipment_spec ?? "",
        outsourcingPartner: payload.outsourcing_partner ?? "", amount: payload.amount != null ? String(payload.amount) : "",
        salesRep: payload.sales_rep ?? "",
      });
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      await loadDeals();
    } catch (e: any) {
      alert("등록 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── 상태 변경 ──
  const changeStatus = async (deal: Deal, next: DealStatus) => {
    if (!canManage) return;
    let reject_reason: string | null = null;
    if (next === "반려") {
      reject_reason = window.prompt("반려 사유를 입력해주세요.") ?? "";
      if (!reject_reason.trim()) { alert("반려 사유가 필요합니다."); return; }
    }
    const closed = next === "확정" || next === "반려";
    const { error } = await supabase.from("rental_os_deals").update({
      status: next,
      reject_reason: next === "반려" ? reject_reason : deal.reject_reason,
      closed_at: closed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", deal.id);
    if (error) { alert("상태 변경 실패: " + error.message); return; }
    await addHistory(deal.id, "status_change", { from_status: deal.status, to_status: next, note: next === "반려" ? reject_reason : null });
    await loadDeals();
  };

  // ── 수정 ──
  const openEdit = (deal: Deal) => {
    setEditingId(deal.id);
    setEditForm({
      customer_name: deal.customer_name, company_name: deal.company_name ?? "",
      customer_phone: deal.customer_phone ?? "", description: deal.description ?? "",
      equipment_type: deal.equipment_type ?? "", equipment_spec: deal.equipment_spec ?? "",
      rental_period: deal.rental_period ?? "", amount: deal.amount != null ? String(deal.amount) : "",
      outsourcing_partner: deal.outsourcing_partner ?? "", sales_rep: deal.sales_rep ?? "",
      special_note: deal.special_note ?? "",
    });
  };
  const saveEdit = async (dealId: number) => {
    const { error } = await supabase.from("rental_os_deals").update({
      customer_name: editForm.customer_name.trim(),
      company_name: editForm.company_name.trim() || null,
      customer_phone: editForm.customer_phone.trim() || null,
      description: editForm.description.trim() || null,
      equipment_type: editForm.equipment_type.trim() || null,
      equipment_spec: editForm.equipment_spec.trim() || null,
      rental_period: editForm.rental_period.trim() || null,
      amount: editForm.amount ? Number(editForm.amount) : null,
      outsourcing_partner: editForm.outsourcing_partner.trim() || null,
      sales_rep: editForm.sales_rep.trim() || null,
      special_note: editForm.special_note.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", dealId);
    if (error) { alert("수정 실패: " + error.message); return; }
    await addHistory(dealId, "edit", { note: "딜 정보 수정" });
    setEditingId(null);
    await loadDeals();
  };

  // ── 삭제 ──
  const deleteDeal = async (deal: Deal) => {
    if (!canManage) return;
    if (!window.confirm(`'${deal.customer_name}' 딜을 삭제하시겠습니까? 첨부파일도 모두 삭제됩니다.`)) return;
    const fileRows = files[deal.id] ?? (await supabase.from("rental_os_deal_files").select("*").eq("deal_id", deal.id)).data ?? [];
    const paths = (fileRows as DealFile[]).map(f => f.storage_path);
    if (paths.length) await supabase.storage.from("rental_os_docs").remove(paths);
    const { error } = await supabase.from("rental_os_deals").delete().eq("id", deal.id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    await loadDeals();
  };

  // ── 파일 업로드/다운로드/삭제 ──
  const uploadFiles = async (dealId: number, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingId(dealId);
    try {
      for (const file of Array.from(fileList)) {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
        const path = `rental_os/${dealId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("rental_os_docs")
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("rental_os_deal_files").insert({
          deal_id: dealId, file_name: file.name, storage_path: path,
          file_size: file.size, uploaded_by: user?.email ?? null,
        });
        if (dbErr) throw dbErr;
        await addHistory(dealId, "file_upload", { note: file.name });
      }
      await loadFiles(dealId);
    } catch (e: any) {
      alert("업로드 실패: " + e.message);
    } finally {
      setUploadingId(null);
      const ref = fileInputRefs.current[dealId];
      if (ref) ref.value = "";
    }
  };

  const downloadFile = async (f: DealFile) => {
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const { data, error } = await supabase.storage.from("rental_os_docs").createSignedUrl(f.storage_path, 60);
        if (error || !data?.signedUrl) throw error ?? new Error("URL 생성 실패");
        window.open(data.signedUrl, "_blank");
      } else {
        const { data, error } = await supabase.storage.from("rental_os_docs").download(f.storage_path);
        if (error || !data) { alert("다운로드 실패: " + error?.message); return; }
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url; a.download = f.file_name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }
    } catch (e: any) { alert("다운로드 실패: " + e.message); }
  };

  const deleteFile = async (f: DealFile) => {
    if (!window.confirm(`'${f.file_name}' 파일을 삭제하시겠습니까?`)) return;
    await supabase.storage.from("rental_os_docs").remove([f.storage_path]);
    await supabase.from("rental_os_deal_files").delete().eq("id", f.id);
    await addHistory(f.deal_id, "file_delete", { note: f.file_name });
    await loadFiles(f.deal_id);
  };

  // ── 메모(히스토리 수기 기록) 추가 ──
  const addNote = async (dealId: number) => {
    const note = (noteDrafts[dealId] ?? "").trim();
    if (!note) return;
    await addHistory(dealId, "note", { note });
    setNoteDrafts(prev => ({ ...prev, [dealId]: "" }));
  };

  // ── 집계/필터 ──
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    STATUS_ORDER.forEach(s => { m[s] = 0; });
    deals.forEach(d => { m[d.status] = (m[d.status] ?? 0) + 1; });
    return m;
  }, [deals]);

  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (statusFilter !== "전체" && d.status !== statusFilter) return false;
      if (!showClosed && (d.status === "확정" || d.status === "반려")) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [d.customer_name, d.company_name, d.description, d.equipment_type, d.outsourcing_partner].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [deals, statusFilter, showClosed, search]);

  const confirmedAmt = deals.filter(d => d.status === "확정").reduce((s, d) => s + (d.amount ?? 0), 0);

  const EVENT_LABEL: Record<string, string> = {
    created: "📝 딜 등록", status_change: "🔄 상태 변경", note: "💬 메모",
    file_upload: "📎 파일 업로드", file_delete: "🗑 파일 삭제", edit: "✏️ 정보 수정",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 + 상태필터 + 액션바 (전부 한 덩어리로 고정) ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 space-y-3 pb-3">
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-3 flex items-center justify-between">
          <button onClick={() => navigate("/work/secretary")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-gray-300 hover:text-gray-700 transition-all">
            ← AI비서
          </button>
          <p className="text-sm font-semibold text-[#0a192f]">🚐 Rental_O/S <span className="text-xs font-normal text-gray-400">렌탈 딜 아웃소싱</span></p>
          <button onClick={() => void logout()} className="text-xs text-gray-400 hover:text-gray-600">로그아웃</button>
        </div>

        {/* ── 상태 요약 배지 ── */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-wrap gap-2">
          <button onClick={() => setStatusFilter("전체")}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${statusFilter === "전체" ? "bg-[#0a192f] text-white border-[#0a192f]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
            전체 {deals.length}
          </button>
          {STATUS_ORDER.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${STATUS_STYLE[s]} ${statusFilter === s ? "ring-2 ring-offset-2 ring-orange-300/60" : "opacity-80 hover:opacity-100"}`}>
              {s} {statusCounts[s] ?? 0}
            </button>
          ))}
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            확정 취급액 {fmtWon(confirmedAmt)}
          </span>
        </div>

        {/* ── 액션바 ── */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <button onClick={() => setShowForm(s => !s)} className={btnPrimary}>
                <Plus className="w-4 h-4" /> 신규 딜 등록
              </button>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="고객·업체·설명 검색"
                className="h-[38px] w-56 pl-8 pr-3 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-orange-400" />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
              종료건 포함
            </label>
          </div>
          <button onClick={() => void loadDeals()} disabled={loading} className={btnSecondary}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 새로고침
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-4">

        {/* ── 신규 등록 폼 ── */}
        {showForm && (
          <div className={`${card} p-4 space-y-3`}>
            <p className="text-sm font-semibold text-[#0a192f]">신규 딜 등록</p>
            <div className="grid md:grid-cols-3 gap-3">
              <div><label className={labelClass}>고객명 *</label><input className={inputClass} value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} /></div>
              <div><label className={labelClass}>업체명</label><input className={inputClass} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} /></div>
              <div><label className={labelClass}>연락처</label><input className={inputClass} value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} /></div>
              <div><label className={labelClass}>장비 종류</label><input className={inputClass} value={form.equipment_type} onChange={e => setForm(f => ({ ...f, equipment_type: e.target.value }))} placeholder="예: 지게차, 굴착기" /></div>
              <div><label className={labelClass}>규격/톤수</label><input className={inputClass} value={form.equipment_spec} onChange={e => setForm(f => ({ ...f, equipment_spec: e.target.value }))} /></div>
              <div><label className={labelClass}>렌탈 기간</label><input className={inputClass} value={form.rental_period} onChange={e => setForm(f => ({ ...f, rental_period: e.target.value }))} placeholder="예: 12개월" /></div>
              <div><label className={labelClass}>딜 금액</label><input type="number" className={inputClass} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><label className={labelClass}>아웃소싱 협력사</label><input className={inputClass} value={form.outsourcing_partner} onChange={e => setForm(f => ({ ...f, outsourcing_partner: e.target.value }))} /></div>
              <div><label className={labelClass}>담당자</label><input className={inputClass} value={form.sales_rep} onChange={e => setForm(f => ({ ...f, sales_rep: e.target.value }))} placeholder={user?.email ?? ""} /></div>
            </div>
            <div><label className={labelClass}>딜 설명</label><textarea className={`${inputClass} h-20`} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><label className={labelClass}>특이사항</label><textarea className={`${inputClass} h-16`} value={form.special_note} onChange={e => setForm(f => ({ ...f, special_note: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className={btnSecondary}>취소</button>
              <button onClick={() => void onCreate()} disabled={saving} className={btnPrimary}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 등록
              </button>
            </div>
          </div>
        )}

        {/* ── 딜 목록 ── */}
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">불러오는 중...</p>
        ) : filteredDeals.length === 0 ? (
          <div className={`${card} text-sm text-gray-400 text-center py-12`}>딜이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {filteredDeals.map(deal => {
              const isClosed = deal.status === "확정" || deal.status === "반려";
              const isExpanded = expandedId === deal.id;
              const isEditing = editingId === deal.id;
              const dealFiles = files[deal.id] ?? [];
              const dealHistory = history[deal.id] ?? [];

              return (
                <div key={deal.id} className={`${card} border overflow-hidden ${CARD_BORDER[deal.status]}`}>
                  {/* 카드 헤더 */}
                  <div className="p-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-gray-400">{deal.deal_no}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[deal.status]}`}>{deal.status}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#0a192f]">
                        {deal.customer_name}{deal.company_name ? ` · ${deal.company_name}` : ""}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtDate(deal.created_at)} 등록{deal.sales_rep ? ` · 담당 ${deal.sales_rep}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {canManage && deal.status === "접수" && (
                        <button onClick={() => void changeStatus(deal, "진행중")} className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600">진행중으로</button>
                      )}
                      {canManage && deal.status === "진행중" && (
                        <>
                          <button onClick={() => void changeStatus(deal, "확정")} className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600">확정</button>
                          <button onClick={() => void changeStatus(deal, "반려")} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600">반려</button>
                        </>
                      )}
                      {canManage && isAdminLevel && isClosed && (
                        <button onClick={() => void changeStatus(deal, "진행중")} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">재오픈</button>
                      )}
                      {canManage && <button onClick={() => openEdit(deal)} className="text-xs p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><Pencil className="w-3.5 h-3.5" /></button>}
                      {canManage && <button onClick={() => void deleteDeal(deal)} className="text-xs p-1.5 rounded-lg border border-gray-200 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>}
                      <button onClick={() => toggleExpand(deal.id)} className="text-xs p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* 요약 정보 (항상 표시) */}
                  {!isEditing && (
                    <div className="px-4 pb-4 grid sm:grid-cols-3 gap-2 text-xs">
                      {deal.equipment_type && <div><span className="text-gray-400">장비 </span>{deal.equipment_type}{deal.equipment_spec ? ` (${deal.equipment_spec})` : ""}</div>}
                      {deal.rental_period && <div><span className="text-gray-400">렌탈기간 </span>{deal.rental_period}</div>}
                      {deal.amount != null && <div><span className="text-gray-400">금액 </span><span className="font-semibold text-[#0a192f]">{fmtWon(deal.amount)}</span></div>}
                      {deal.outsourcing_partner && <div><span className="text-gray-400">협력사 </span>{deal.outsourcing_partner}</div>}
                      {deal.reject_reason && <div className="sm:col-span-3 text-red-600">반려 사유: {deal.reject_reason}</div>}
                    </div>
                  )}

                  {/* 수정 폼 */}
                  {isEditing && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                      <div className="grid md:grid-cols-3 gap-3">
                        <div><label className={labelClass}>고객명</label><input className={inputClass} value={editForm.customer_name} onChange={e => setEditForm((f: any) => ({ ...f, customer_name: e.target.value }))} /></div>
                        <div><label className={labelClass}>업체명</label><input className={inputClass} value={editForm.company_name} onChange={e => setEditForm((f: any) => ({ ...f, company_name: e.target.value }))} /></div>
                        <div><label className={labelClass}>연락처</label><input className={inputClass} value={editForm.customer_phone} onChange={e => setEditForm((f: any) => ({ ...f, customer_phone: e.target.value }))} /></div>
                        <div><label className={labelClass}>장비 종류</label><input className={inputClass} value={editForm.equipment_type} onChange={e => setEditForm((f: any) => ({ ...f, equipment_type: e.target.value }))} /></div>
                        <div><label className={labelClass}>규격/톤수</label><input className={inputClass} value={editForm.equipment_spec} onChange={e => setEditForm((f: any) => ({ ...f, equipment_spec: e.target.value }))} /></div>
                        <div><label className={labelClass}>렌탈 기간</label><input className={inputClass} value={editForm.rental_period} onChange={e => setEditForm((f: any) => ({ ...f, rental_period: e.target.value }))} /></div>
                        <div><label className={labelClass}>딜 금액</label><input type="number" className={inputClass} value={editForm.amount} onChange={e => setEditForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
                        <div><label className={labelClass}>아웃소싱 협력사</label><input className={inputClass} value={editForm.outsourcing_partner} onChange={e => setEditForm((f: any) => ({ ...f, outsourcing_partner: e.target.value }))} /></div>
                        <div><label className={labelClass}>담당자</label><input className={inputClass} value={editForm.sales_rep} onChange={e => setEditForm((f: any) => ({ ...f, sales_rep: e.target.value }))} /></div>
                      </div>
                      <div><label className={labelClass}>딜 설명</label><textarea className={`${inputClass} h-20`} value={editForm.description} onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
                      <div><label className={labelClass}>특이사항</label><textarea className={`${inputClass} h-16`} value={editForm.special_note} onChange={e => setEditForm((f: any) => ({ ...f, special_note: e.target.value }))} /></div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className={btnSecondary}><X className="w-4 h-4" /> 취소</button>
                        <button onClick={() => void saveEdit(deal.id)} className={btnPrimary}><Check className="w-4 h-4" /> 저장</button>
                      </div>
                    </div>
                  )}

                  {/* 딜 설명 (펼쳤을 때) */}
                  {isExpanded && !isEditing && (
                    <div className="border-t border-gray-100">
                      {deal.description && (
                        <div className="px-4 py-3 text-xs text-gray-600 whitespace-pre-wrap bg-gray-50/60">{deal.description}</div>
                      )}
                      {deal.special_note && (
                        <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50">⚠ {deal.special_note}</div>
                      )}

                      <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        {/* 첨부파일 */}
                        <div className="p-4">
                          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> 첨부파일 ({dealFiles.length})</p>
                          <div className="space-y-1.5 mb-2">
                            {dealFiles.length === 0 && <p className="text-xs text-gray-400">첨부된 파일이 없습니다.</p>}
                            {dealFiles.map(f => (
                              <div key={f.id} className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                                <span className="truncate flex-1 text-gray-700">{f.file_name}</span>
                                <span className="text-gray-400 flex-shrink-0">{fmtFileSize(f.file_size)}</span>
                                <button onClick={() => void downloadFile(f)} className="text-orange-500 hover:text-orange-600 flex-shrink-0"><Download className="w-3.5 h-3.5" /></button>
                                {canManage && <button onClick={() => void deleteFile(f)} className="text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                              </div>
                            ))}
                          </div>
                          {canManage && (
                            <>
                              <input ref={el => { fileInputRefs.current[deal.id] = el; }} type="file" multiple className="hidden"
                                onChange={e => void uploadFiles(deal.id, e.target.files)} />
                              <button onClick={() => fileInputRefs.current[deal.id]?.click()} disabled={uploadingId === deal.id} className={btnSecondary}>
                                {uploadingId === deal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} 파일 추가
                              </button>
                            </>
                          )}
                        </div>

                        {/* 딜 히스토리 */}
                        <div className="p-4">
                          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 딜 히스토리</p>
                          <div className="space-y-2 mb-2 max-h-56 overflow-y-auto">
                            {dealHistory.length === 0 && <p className="text-xs text-gray-400">기록이 없습니다.</p>}
                            {dealHistory.map(h => (
                              <div key={h.id} className="text-xs border-l-2 border-gray-200 pl-2.5">
                                <p className="text-gray-700 font-medium">
                                  {EVENT_LABEL[h.event_type] ?? h.event_type}
                                  {h.from_status && h.to_status ? ` (${h.from_status} → ${h.to_status})` : ""}
                                </p>
                                {h.note && <p className="text-gray-500">{h.note}</p>}
                                <p className="text-[10px] text-gray-400">{fmtDate(h.created_at)}{h.created_by ? ` · ${h.created_by}` : ""}</p>
                              </div>
                            ))}
                          </div>
                          {canManage && (
                            <div className="flex gap-1.5">
                              <input value={noteDrafts[deal.id] ?? ""} onChange={e => setNoteDrafts(prev => ({ ...prev, [deal.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === "Enter") void addNote(deal.id); }}
                                placeholder="경과 메모 추가..." className="flex-1 h-[34px] rounded-lg border border-gray-200 px-2.5 text-xs focus:outline-none focus:border-orange-400" />
                              <button onClick={() => void addNote(deal.id)} className="text-xs px-2.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">추가</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
