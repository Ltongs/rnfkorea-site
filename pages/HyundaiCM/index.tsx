// pages/HyundaiCM/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ─── 정책 ─────────────────────────────────────────────────
const HIDE_CLOSED_AFTER_DAYS_FOR_NON_ADMIN = 30;

// ─── 타입 ─────────────────────────────────────────────────
type CustomerType = "개인" | "법인";
type HCMStatus    = "접수" | "신용조회" | "서류업로드" | "승인" | "종료";

type HCMTask = {
  id: string | number;
  customer_type: CustomerType;
  customer_name: string;
  customer_phone: string | null;
  customer_id_no: string | null;
  company_name: string | null;
  equipment_model: string | null;
  equipment_serial: string | null;
  purchase_amount: number | null;
  finance_company: string | null;
  sales_rep: string | null;
  sales_rep_phone: string | null;
  status: HCMStatus;
  special_note: string | null;
  doc_id_card: string | null;
  doc_employment: string | null;
  doc_income: string | null;
  doc_estimate: string | null;
  doc_excavator_license: string | null;
  doc_etc: string | null;
  created_at?: string;
  closed_at?: string | null;
};

// ─── 유틸 ─────────────────────────────────────────────────
function onlyDigits(s: string) { return (s ?? "").replace(/\D/g, ""); }

function formatPhoneKR(raw: string) {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function formatCreatedAt(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function formatAmount(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

function extFromName(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

// ─── 상태 설정 ────────────────────────────────────────────
const STATUS_ORDER: HCMStatus[] = ["접수", "신용조회", "서류업로드", "승인", "종료"];

function statusStyle(status: HCMStatus) {
  switch (status) {
    case "접수":       return "bg-gray-100 text-gray-600 border-gray-200";
    case "신용조회":   return "bg-orange-50 text-orange-600 border-orange-200";
    case "서류업로드": return "bg-orange-50 text-orange-700 border-orange-200";
    case "승인":       return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "종료":       return "bg-gray-100 text-gray-400 border-gray-200";
    default:           return "bg-gray-50 text-gray-500 border-gray-200";
  }
}

// ─── 서류 목록 ────────────────────────────────────────────
const DOC_FIELDS: { key: keyof HCMTask; label: string; dbCol: string }[] = [
  { key: "doc_id_card",           label: "신분증",               dbCol: "doc_id_card" },
  { key: "doc_employment",        label: "재직증명서/사업자등록증", dbCol: "doc_employment" },
  { key: "doc_income",            label: "소득증빙",              dbCol: "doc_income" },
  { key: "doc_estimate",          label: "견적서/계약서",         dbCol: "doc_estimate" },
  { key: "doc_excavator_license", label: "굴삭기조종면허증",      dbCol: "doc_excavator_license" },
  { key: "doc_etc",               label: "기타서류",              dbCol: "doc_etc" },
];

// ─── 스타일 상수 ──────────────────────────────────────────
const inputClass =
  "h-[48px] w-full px-4 rounded-2xl border border-gray-200 bg-white text-sm " +
  "font-medium text-navy-900 placeholder:text-gray-400 " +
  "focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 " +
  "disabled:opacity-50 disabled:bg-gray-50 transition-all";

const labelClass = "block text-sm font-medium text-navy-900 mb-2";

const btnPrimary =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-orange-500 " +
  "text-white font-semibold text-sm hover:bg-orange-600 transition-all disabled:opacity-50";

const btnSecondary =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-2xl border border-gray-300 " +
  "bg-white text-navy-900 font-semibold text-sm hover:shadow-md transition-all disabled:opacity-50";

const btnGhost =
  "inline-flex items-center justify-center px-4 py-2 rounded-2xl border border-gray-200 " +
  "bg-white text-sm font-medium text-gray-600 hover:border-gray-300 hover:shadow-sm transition-all disabled:opacity-50";

// ─── 메인 컴포넌트 ────────────────────────────────────────
export default function HyundaiCMPage() {
  const { user, logout, isAdmin, isHyundaiCM } = useAuth() as any;
  const canCreate       = isAdmin || isHyundaiCM;
  const canEditExisting = isAdmin || isHyundaiCM;
  const canChangeStatus = isAdmin || isHyundaiCM;
  const canUploadDoc    = isAdmin || isHyundaiCM;
  const canDelete       = isAdmin;

  // ── 신규 접수 폼 ──
  const [customerType,     setCustomerType]     = useState<CustomerType>("개인");
  const [customerName,     setCustomerName]     = useState("");
  const [customerPhone,    setCustomerPhone]    = useState("");
  const [customerIdNo,     setCustomerIdNo]     = useState("");
  const [companyName,      setCompanyName]      = useState("");
  const [equipmentModel,   setEquipmentModel]   = useState("");
  const [equipmentSerial,  setEquipmentSerial]  = useState("");
  const [purchaseAmount,   setPurchaseAmount]   = useState("");
  const [financeCompany,   setFinanceCompany]   = useState("");
  const [salesRep,         setSalesRep]         = useState("");
  const [salesRepPhone,    setSalesRepPhone]    = useState("");
  const [specialNote,      setSpecialNote]      = useState("");

  // ── 데이터 ──
  const [rows,    setRows]    = useState<HCMTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  // ── UI ──
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchText,      setSearchText]      = useState("");
  const [statusFilter,    setStatusFilter]    = useState<HCMStatus | "all">("all");
  const [showClosed,      setShowClosed]      = useState(false);

  // ── 수정 모달 ──
  const [editRow,            setEditRow]            = useState<HCMTask | null>(null);
  const [editSaving,         setEditSaving]         = useState(false);
  const [editCustomerType,   setEditCustomerType]   = useState<CustomerType>("개인");
  const [editCustomerName,   setEditCustomerName]   = useState("");
  const [editCustomerPhone,  setEditCustomerPhone]  = useState("");
  const [editCustomerIdNo,   setEditCustomerIdNo]   = useState("");
  const [editCompanyName,    setEditCompanyName]    = useState("");
  const [editEquipmentModel, setEditEquipmentModel] = useState("");
  const [editEquipmentSerial,setEditEquipmentSerial]= useState("");
  const [editPurchaseAmount, setEditPurchaseAmount] = useState("");
  const [editFinanceCompany, setEditFinanceCompany] = useState("");
  const [editSalesRep,       setEditSalesRep]       = useState("");
  const [editSalesRepPhone,  setEditSalesRepPhone]  = useState("");
  const [editSpecialNote,    setEditSpecialNote]    = useState("");

  // ── 메모 ──
  const [memoDrafts,   setMemoDrafts]   = useState<Record<string, string>>({});
  const [memoSavingId, setMemoSavingId] = useState<string | number | null>(null);

  // ── 업로드 ──
  const [uploadingDocKey,   setUploadingDocKey]   = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUploadInfo, setPendingUploadInfo] = useState<{
    rowId: string | number; docKey: string; dbCol: string; label: string;
  } | null>(null);

  // ── 삭제 ──
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [deleting,        setDeleting]        = useState(false);

  // ─── FETCH ──────────────────────────────────────────────
  const fetchRows = async () => {
    setLoading(true); setErr("");
    try {
      const cutoffISO = new Date(
        Date.now() - HIDE_CLOSED_AFTER_DAYS_FOR_NON_ADMIN * 24 * 60 * 60 * 1000
      ).toISOString();

      let q = supabase.from("hyundaicm_tasks").select("*");
      if (!isAdmin) {
        q = q.or(`status.neq.종료,created_at.gte.${cutoffISO}`);
      } else if (!showClosed) {
        q = q.or(`status.neq.종료,created_at.gte.${cutoffISO}`);
      }

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;

      const nextRows = (data ?? []) as HCMTask[];
      setRows(nextRows);
      const drafts: Record<string, string> = {};
      nextRows.forEach((r) => { drafts[String(r.id)] = r.special_note ?? ""; });
      setMemoDrafts(drafts);
    } catch (e: any) {
      setErr(e?.message || "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, [showClosed, isAdmin, isHyundaiCM]); // eslint-disable-line

  // ─── 필터 ────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let result = [...rows];
    const q = searchText.trim().toLowerCase();
    if (q) {
      const qd = onlyDigits(q);
      result = result.filter((r) =>
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        (r.company_name ?? "").toLowerCase().includes(q) ||
        (r.equipment_model ?? "").toLowerCase().includes(q) ||
        (r.equipment_serial ?? "").toLowerCase().includes(q) ||
        (r.finance_company ?? "").toLowerCase().includes(q) ||
        (r.sales_rep ?? "").toLowerCase().includes(q) ||
        (r.special_note ?? "").toLowerCase().includes(q) ||
        String(r.id).includes(q) ||
        (qd ? onlyDigits(r.customer_phone ?? "").includes(qd) : false) ||
        (qd ? onlyDigits(r.sales_rep_phone ?? "").includes(qd) : false)
      );
    }
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    return result;
  }, [rows, searchText, statusFilter]);

  const summaryCounts = useMemo(() =>
    STATUS_ORDER.reduce((acc, s) => {
      acc[s] = rows.filter((r) => r.status === s).length;
      return acc;
    }, {} as Record<HCMStatus, number>)
  , [rows]);

  // ─── 신규 접수 ───────────────────────────────────────────
  const onReset = () => {
    setCustomerType("개인"); setCustomerName(""); setCustomerPhone("");
    setCustomerIdNo(""); setCompanyName(""); setEquipmentModel("");
    setEquipmentSerial(""); setPurchaseAmount(""); setFinanceCompany("");
    setSalesRep(""); setSalesRepPhone(""); setSpecialNote("");
  };

  const onAdd = async () => {
    if (!canCreate) { alert("신규 입력 권한이 없습니다."); return; }
    if (!customerName.trim())  { alert("고객명을 입력해주세요."); return; }
    if (!customerPhone.trim()) { alert("고객 전화번호를 입력해주세요."); return; }
    if (!equipmentModel.trim()){ alert("건설기계 모델명을 입력해주세요."); return; }
    if (!salesRep.trim())      { alert("영업사원을 입력해주세요."); return; }
    if (customerType === "법인" && !companyName.trim()) { alert("법인명을 입력해주세요."); return; }

    setSaving(true); setErr("");
    try {
      const payload = {
        customer_type:    customerType,
        customer_name:    customerName.trim(),
        customer_phone:   onlyDigits(customerPhone) || null,
        customer_id_no:   customerIdNo.trim() || null,
        company_name:     customerType === "법인" ? companyName.trim() : null,
        equipment_model:  equipmentModel.trim(),
        equipment_serial: equipmentSerial.trim() || null,
        purchase_amount:  purchaseAmount.trim() ? parseInt(onlyDigits(purchaseAmount), 10) || null : null,
        finance_company:  financeCompany.trim() || null,
        sales_rep:        salesRep.trim(),
        sales_rep_phone:  onlyDigits(salesRepPhone) || null,
        special_note:     specialNote.trim() || null,
        status:           "접수" as HCMStatus,
        doc_id_card: null, doc_employment: null, doc_income: null,
        doc_estimate: null, doc_excavator_license: null, doc_etc: null,
        closed_at: null,
      };
      const { error } = await supabase.from("hyundaicm_tasks").insert(payload);
      if (error) throw error;
      onReset(); setShowCreatePanel(false); await fetchRows();
    } catch (e: any) {
      setErr(e?.message || "등록 실패");
      alert(e?.message || "등록 실패");
    } finally { setSaving(false); }
  };

  // ─── 상태 변경 ───────────────────────────────────────────
  const changeStatus = async (row: HCMTask, next: HCMStatus) => {
    if (!canChangeStatus) { alert("상태 변경 권한이 없습니다."); return; }
    if (row.status === next) return;
    const patch: Partial<HCMTask> = { status: next };
    if (next === "종료") patch.closed_at = new Date().toISOString();
    setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, ...patch } : r));
    const { error } = await supabase.from("hyundaicm_tasks").update(patch).eq("id", row.id as any);
    if (error) {
      setRows((prev) => prev.map((r) => String(r.id) === String(row.id) ? { ...r, status: row.status } : r));
      alert(error.message);
    }
  };

  // ─── 메모 저장 ───────────────────────────────────────────
  const saveMemo = async (rowId: string | number) => {
    setMemoSavingId(rowId);
    try {
      const note = memoDrafts[String(rowId)] ?? "";
      const { error } = await supabase.from("hyundaicm_tasks").update({ special_note: note || null }).eq("id", rowId as any);
      if (error) throw error;
      setRows((prev) => prev.map((r) => String(r.id) === String(rowId) ? { ...r, special_note: note || null } : r));
    } catch (e: any) { alert(e?.message || "메모 저장 실패"); }
    finally { setMemoSavingId(null); }
  };

  // ─── 수정 모달 ───────────────────────────────────────────
  const openEditModal = (row: HCMTask) => {
    if (!canEditExisting) { alert("수정 권한이 없습니다."); return; }
    setEditRow(row);
    setEditCustomerType(row.customer_type ?? "개인");
    setEditCustomerName(row.customer_name ?? "");
    setEditCustomerPhone(formatPhoneKR(row.customer_phone ?? ""));
    setEditCustomerIdNo(row.customer_id_no ?? "");
    setEditCompanyName(row.company_name ?? "");
    setEditEquipmentModel(row.equipment_model ?? "");
    setEditEquipmentSerial(row.equipment_serial ?? "");
    setEditPurchaseAmount(row.purchase_amount != null ? String(row.purchase_amount) : "");
    setEditFinanceCompany(row.finance_company ?? "");
    setEditSalesRep(row.sales_rep ?? "");
    setEditSalesRepPhone(formatPhoneKR(row.sales_rep_phone ?? ""));
    setEditSpecialNote(row.special_note ?? "");
  };

  const closeEditModal = () => { if (editSaving) return; setEditRow(null); };

  const saveEditRow = async () => {
    if (!editRow) return;
    if (!editCustomerName.trim()) { alert("고객명을 입력해주세요."); return; }
    setEditSaving(true);
    try {
      const patch = {
        customer_type: editCustomerType, customer_name: editCustomerName.trim(),
        customer_phone: onlyDigits(editCustomerPhone) || null,
        customer_id_no: editCustomerIdNo.trim() || null,
        company_name: editCustomerType === "법인" ? editCompanyName.trim() : null,
        equipment_model: editEquipmentModel.trim() || null,
        equipment_serial: editEquipmentSerial.trim() || null,
        purchase_amount: editPurchaseAmount.trim() ? parseInt(onlyDigits(editPurchaseAmount), 10) || null : null,
        finance_company: editFinanceCompany.trim() || null,
        sales_rep: editSalesRep.trim() || null,
        sales_rep_phone: onlyDigits(editSalesRepPhone) || null,
        special_note: editSpecialNote.trim() || null,
      };
      const { error } = await supabase.from("hyundaicm_tasks").update(patch).eq("id", editRow.id as any);
      if (error) throw error;
      setRows((prev) => prev.map((r) => String(r.id) === String(editRow.id) ? { ...r, ...patch } : r));
      closeEditModal();
    } catch (e: any) { alert(e?.message || "수정 저장 실패"); }
    finally { setEditSaving(false); }
  };

  // ─── 파일 업로드 ─────────────────────────────────────────
  const triggerDocUpload = (rowId: string | number, docKey: string, dbCol: string, label: string) => {
    if (!canUploadDoc) { alert("서류 업로드 권한이 없습니다."); return; }
    setPendingUploadInfo({ rowId, docKey, dbCol, label });
    docInputRef.current?.click();
  };

  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadInfo) return;
    const { rowId, dbCol, label } = pendingUploadInfo;
    const ext  = extFromName(file.name) || "pdf";
    const path = `hyundaicm/${String(rowId)}/${dbCol}.${ext}`;
    setUploadingDocKey(`${rowId}_${dbCol}`);
    try {
      const { error: upErr } = await supabase.storage.from("hcm_docs").upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("hyundaicm_tasks").update({ [dbCol]: path }).eq("id", rowId as any);
      if (dbErr) throw dbErr;
      setRows((prev) => prev.map((r) => String(r.id) === String(rowId) ? { ...r, [dbCol]: path } : r));
      alert(`${label} 업로드 완료`);
    } catch (e: any) { alert(`업로드 실패: ${e?.message}`); }
    finally {
      setUploadingDocKey(null); setPendingUploadInfo(null);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const downloadDoc = async (path: string, label: string) => {
    try {
      const { data, error } = await supabase.storage.from("hcm_docs").download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a   = document.createElement("a");
      a.href = url; a.download = `${label}_${path.split("/").pop() ?? "file"}`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert(`다운로드 실패: ${e?.message}`); }
  };

  // ─── 삭제 ────────────────────────────────────────────────
  const deleteRow = async (rowId: string | number) => {
    if (!canDelete) { alert("삭제 권한은 관리자만 가능합니다."); return; }
    setDeleting(true);
    try {
      const target = rows.find((r) => String(r.id) === String(rowId));
      if (target) {
        const paths = DOC_FIELDS.map((f) => target[f.key] as string | null).filter(Boolean) as string[];
        if (paths.length > 0) await supabase.storage.from("hcm_docs").remove(paths);
      }
      const { error } = await supabase.from("hyundaicm_tasks").delete().eq("id", rowId as any);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => String(r.id) !== String(rowId)));
      setDeleteConfirmId(null);
    } catch (e: any) { alert(`삭제 실패: ${e?.message}`); }
    finally { setDeleting(false); }
  };

  // ─── JSX ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 숨겨진 파일 인풋 */}
      <input
        ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic"
        className="hidden" onChange={handleDocFileChange}
      />

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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">Business</p>
              <h1 className="mt-3 text-3xl md:text-4xl font-semibold leading-[1.15] text-white break-keep">
                현대건설기계 업무
              </h1>
              <p className="mt-3 text-base leading-7 text-white/75 break-keep">
                건설기계 할부금융 신용조회 및 서류관리
              </p>
            </div>
            <button
              onClick={() => { if (window.confirm("로그아웃 하시겠습니까?")) logout(); }}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
            >
              로그아웃
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">

        {/* ── 상태 요약 뱃지 ── */}
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter((prev) => prev === s ? "all" : s)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-2xl border text-xs font-semibold transition-all
                ${statusStyle(s)}
                ${statusFilter === s ? "ring-2 ring-offset-2 ring-orange-300/60 shadow-sm" : "hover:shadow-sm"}`}
            >
              {s} <span className="opacity-70">({summaryCounts[s] ?? 0})</span>
            </button>
          ))}
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="px-4 py-1.5 rounded-2xl border border-gray-200 bg-white text-xs font-semibold text-gray-500 hover:shadow-sm transition-all"
            >
              전체 보기
            </button>
          )}
        </div>

        {/* ── 액션 바 ── */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowCreatePanel((v) => !v)} className={btnPrimary}>
            + 신규 접수
          </button>
          <button onClick={() => setShowSearchPanel((v) => !v)} className={btnSecondary}>
            🔍 검색 / 필터
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowClosed((v) => !v)}
              className={`inline-flex items-center justify-center px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all
                ${showClosed ? "bg-orange-50 border-orange-200 text-orange-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
            >
              {showClosed ? "종료 건 숨기기" : "종료 건 포함"}
            </button>
          )}
          <button onClick={fetchRows} disabled={loading} className={`${btnGhost} ml-auto`}>
            {loading ? "로딩중..." : "새로고침"}
          </button>
        </div>

        {/* ── 검색 패널 ── */}
        {showSearchPanel && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>통합 검색</label>
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="고객명, 법인명, 장비모델, 영업사원, 금융사..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>상태 필터</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as HCMStatus | "all")} className={inputClass}>
                  <option value="all">전체</option>
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {searchText && (
              <button onClick={() => setSearchText("")} className="mt-3 text-xs text-gray-400 hover:text-gray-600">
                검색어 초기화
              </button>
            )}
          </div>
        )}

        {/* ── 신규 접수 패널 ── */}
        {showCreatePanel && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">New</p>
                <h2 className="mt-1 text-xl font-semibold text-navy-900">신규 접수</h2>
              </div>
              <button
                onClick={() => { setShowCreatePanel(false); onReset(); }}
                className="h-9 w-9 rounded-2xl border border-gray-200 text-gray-500 hover:border-gray-300 text-xl font-bold transition-all"
              >×</button>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>고객 유형 *</label>
                <select value={customerType} onChange={(e) => setCustomerType(e.target.value as CustomerType)} className={inputClass}>
                  <option value="개인">개인</option>
                  <option value="법인">법인</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>고객명 *</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="홍길동" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>전화번호 *</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(formatPhoneKR(e.target.value))} placeholder="010-1234-5678" inputMode="tel" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{customerType === "법인" ? "사업자번호" : "주민번호 앞 6자리"}</label>
                <input value={customerIdNo} onChange={(e) => setCustomerIdNo(e.target.value)} placeholder={customerType === "법인" ? "000-00-00000" : "YYMMDD"} className={inputClass} />
              </div>
              {customerType === "법인" && (
                <div>
                  <label className={labelClass}>법인명 *</label>
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="(주)현대건설" className={inputClass} />
                </div>
              )}
              <div>
                <label className={labelClass}>건설기계 모델명 *</label>
                <input value={equipmentModel} onChange={(e) => setEquipmentModel(e.target.value)} placeholder="HX220AL" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>장비 일련번호</label>
                <input value={equipmentSerial} onChange={(e) => setEquipmentSerial(e.target.value)} placeholder="KMHX220ALXXXXXX" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>구매금액 (원)</label>
                <input value={purchaseAmount} onChange={(e) => setPurchaseAmount(onlyDigits(e.target.value))} placeholder="150000000" inputMode="numeric" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>할부금융사</label>
                <input value={financeCompany} onChange={(e) => setFinanceCompany(e.target.value)} placeholder="현대캐피탈" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>영업사원 *</label>
                <input value={salesRep} onChange={(e) => setSalesRep(e.target.value)} placeholder="홍길동" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>영업사원 연락처</label>
                <input value={salesRepPhone} onChange={(e) => setSalesRepPhone(formatPhoneKR(e.target.value))} placeholder="010-9999-8888" inputMode="tel" className={inputClass} />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>특이사항</label>
              <textarea
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder="고객 요청사항, 특이사항, 신용조회 관련 메모..."
                className="w-full min-h-[80px] px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all"
              />
            </div>

            {err && (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">{err}</div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setShowCreatePanel(false); onReset(); }} disabled={saving} className={btnSecondary}>취소</button>
              <button onClick={onAdd} disabled={saving} className={btnPrimary}>{saving ? "등록중..." : "접수 등록"}</button>
            </div>
          </div>
        )}

        {/* ── 카드 목록 ── */}
        {loading && <div className="py-12 text-center text-sm text-gray-400">로딩 중...</div>}

        {!loading && filteredRows.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
            조회 결과가 없습니다.
          </div>
        )}

        <div className="space-y-4">
          {filteredRows.map((r) => {
            const memoVal     = memoDrafts[String(r.id)] ?? r.special_note ?? "";
            const memoChanged = memoVal !== (r.special_note ?? "");

            return (
              <div key={r.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden">

                {/* 카드 헤더 */}
                <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-2xl border text-xs font-semibold ${statusStyle(r.status)}`}>
                      {r.status}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-2xl border border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
                      {r.customer_type}
                    </span>
                    <span className="text-base font-semibold text-navy-900">
                      {r.customer_name}{r.company_name ? ` (${r.company_name})` : ""}
                    </span>
                    <span className="text-xs text-gray-400">#{String(r.id)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEditModal(r)} className={btnGhost}>수정</button>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteConfirmId(r.id)}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-2xl border border-red-100 bg-white text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
                      >삭제</button>
                    )}
                  </div>
                </div>

                {/* 카드 바디 */}
                <div className="px-6 py-5 grid md:grid-cols-2 gap-6">
                  {/* 왼쪽: 기본 정보 */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "전화번호",   value: r.customer_phone ? formatPhoneKR(r.customer_phone) : "-" },
                        { label: "할부금융사", value: r.finance_company ?? "-" },
                        { label: "장비 모델",  value: r.equipment_model ?? "-" },
                        { label: "구매금액",   value: formatAmount(r.purchase_amount) },
                        { label: "영업사원",   value: [r.sales_rep, r.sales_rep_phone ? formatPhoneKR(r.sales_rep_phone) : ""].filter(Boolean).join(" / ") || "-" },
                        { label: "접수일시",   value: formatCreatedAt(r.created_at) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">{label}</p>
                          <p className="mt-1 text-sm font-semibold text-navy-900 break-all">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* 진행 단계 */}
                    <div>
                      <p className="text-xs font-medium tracking-wide text-gray-400 uppercase mb-2">진행 단계</p>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_ORDER.map((s) => (
                          <button
                            key={s}
                            disabled={!canChangeStatus || r.status === s}
                            onClick={() => changeStatus(r, s)}
                            className={`px-3 py-1 rounded-2xl border text-xs font-semibold transition-all
                              ${r.status === s
                                ? statusStyle(s) + " ring-2 ring-offset-1 ring-orange-200/60"
                                : "bg-white border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              }`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 증빙서류 */}
                  <div>
                    <p className="text-xs font-medium tracking-wide text-gray-400 uppercase mb-3">증빙서류</p>
                    <div className="space-y-2.5">
                      {DOC_FIELDS.map((f) => {
                        const path        = r[f.key] as string | null;
                        const isUploading = uploadingDocKey === `${r.id}_${f.dbCol}`;
                        return (
                          <div key={f.key} className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-gray-600 w-36 shrink-0">{f.label}</span>
                            <div className="flex items-center gap-2">
                              {path ? (
                                <>
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                                    ✓ 완료
                                  </span>
                                  <button onClick={() => downloadDoc(path, f.label)} className="px-3 py-1 rounded-2xl border border-gray-200 text-gray-600 text-xs font-medium hover:border-navy-900 hover:text-navy-900 transition-all">
                                    다운로드
                                  </button>
                                  {canUploadDoc && (
                                    <button disabled={isUploading} onClick={() => triggerDocUpload(r.id, f.key, f.dbCol, f.label)} className="px-3 py-1 rounded-2xl border border-gray-200 text-gray-400 text-xs font-medium hover:border-orange-200 hover:text-orange-600 disabled:opacity-50 transition-all">
                                      {isUploading ? "..." : "재업로드"}
                                    </button>
                                  )}
                                </>
                              ) : (
                                <button disabled={isUploading || !canUploadDoc} onClick={() => triggerDocUpload(r.id, f.key, f.dbCol, f.label)} className="px-3 py-1 rounded-2xl border border-gray-200 text-gray-500 text-xs font-medium hover:border-orange-300 hover:text-orange-600 disabled:opacity-50 transition-all">
                                  {isUploading ? "업로드중..." : "+ 업로드"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 메모 */}
                <div className="px-6 pb-5 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">특이사항 / 메모</p>
                    {memoChanged && (
                      <button disabled={memoSavingId === r.id} onClick={() => saveMemo(r.id)} className={btnPrimary + " !py-1 !px-3 !text-xs"}>
                        {memoSavingId === r.id ? "저장중..." : "저장"}
                      </button>
                    )}
                  </div>
                  <textarea
                    value={memoVal}
                    onChange={(e) => setMemoDrafts((prev) => ({ ...prev, [String(r.id)]: e.target.value }))}
                    placeholder="신용조회 결과, 금융사 조건, 특이사항 입력..."
                    className="w-full h-[72px] text-sm text-gray-700 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-2.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 수정 모달 ── */}
      {editRow && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-6">
              <div>
                <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">Edit</p>
                <h2 className="mt-1 text-xl font-semibold text-navy-900">기본정보 수정</h2>
                <p className="mt-1 text-sm text-gray-500">고객 정보 및 장비/금융 정보를 수정합니다.</p>
              </div>
              <button onClick={closeEditModal} disabled={editSaving} className="h-9 w-9 rounded-2xl border border-gray-200 text-xl font-bold text-gray-500 hover:border-gray-300 disabled:opacity-50 transition-all">×</button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>고객 유형</label><select value={editCustomerType} onChange={(e) => setEditCustomerType(e.target.value as CustomerType)} className={inputClass} disabled={editSaving}><option value="개인">개인</option><option value="법인">법인</option></select></div>
              <div><label className={labelClass}>고객명 *</label><input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} className={inputClass} disabled={editSaving} placeholder="홍길동" /></div>
              <div><label className={labelClass}>전화번호</label><input value={editCustomerPhone} onChange={(e) => setEditCustomerPhone(formatPhoneKR(e.target.value))} className={inputClass} disabled={editSaving} inputMode="tel" /></div>
              <div><label className={labelClass}>{editCustomerType === "법인" ? "사업자번호" : "주민번호 앞 6자리"}</label><input value={editCustomerIdNo} onChange={(e) => setEditCustomerIdNo(e.target.value)} className={inputClass} disabled={editSaving} /></div>
              {editCustomerType === "법인" && <div><label className={labelClass}>법인명</label><input value={editCompanyName} onChange={(e) => setEditCompanyName(e.target.value)} className={inputClass} disabled={editSaving} /></div>}
              <div><label className={labelClass}>건설기계 모델명</label><input value={editEquipmentModel} onChange={(e) => setEditEquipmentModel(e.target.value)} className={inputClass} disabled={editSaving} placeholder="HX220AL" /></div>
              <div><label className={labelClass}>장비 일련번호</label><input value={editEquipmentSerial} onChange={(e) => setEditEquipmentSerial(e.target.value)} className={inputClass} disabled={editSaving} /></div>
              <div><label className={labelClass}>구매금액 (원)</label><input value={editPurchaseAmount} onChange={(e) => setEditPurchaseAmount(onlyDigits(e.target.value))} className={inputClass} disabled={editSaving} inputMode="numeric" /></div>
              <div><label className={labelClass}>할부금융사</label><input value={editFinanceCompany} onChange={(e) => setEditFinanceCompany(e.target.value)} className={inputClass} disabled={editSaving} placeholder="현대캐피탈" /></div>
              <div><label className={labelClass}>영업사원</label><input value={editSalesRep} onChange={(e) => setEditSalesRep(e.target.value)} className={inputClass} disabled={editSaving} /></div>
              <div><label className={labelClass}>영업사원 연락처</label><input value={editSalesRepPhone} onChange={(e) => setEditSalesRepPhone(formatPhoneKR(e.target.value))} className={inputClass} disabled={editSaving} inputMode="tel" /></div>
              <div><label className={labelClass}>ID</label><input value={String(editRow.id)} readOnly className={inputClass + " !bg-gray-50 !text-gray-400 cursor-not-allowed"} /></div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>특이사항</label>
              <textarea value={editSpecialNote} onChange={(e) => setEditSpecialNote(e.target.value)} placeholder="신용조회 결과, 금융사 조건, 특이사항..." className="min-h-[90px] w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 resize-none transition-all" disabled={editSaving} />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeEditModal} disabled={editSaving} className={btnSecondary}>취소</button>
              <button onClick={saveEditRow} disabled={editSaving} className={btnPrimary}>{editSaving ? "저장중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteConfirmId != null && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500 mb-2">Delete</p>
            <h2 className="text-xl font-semibold text-navy-900 mb-3">건 삭제 확인</h2>
            <p className="text-sm leading-6 text-gray-600">
              이 건의 <strong>모든 데이터 및 서류 파일이 영구 삭제</strong>됩니다.<br />삭제 후 복구가 불가능합니다.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmId(null)} disabled={deleting} className={btnSecondary}>취소</button>
              <button
                onClick={() => deleteRow(deleteConfirmId)}
                disabled={deleting}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-2xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all disabled:opacity-50"
              >{deleting ? "삭제중..." : "영구 삭제"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}